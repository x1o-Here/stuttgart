/**
 * One-time backfill after invoice postings and vehicle accounts were added
 * (migrations 20261120140000_invoice_ledger_postings and
 * 20261120150000_vehicle_accounts). For every company it:
 *
 *   1. creates a "Vehicle (<number>)" account for each live vehicle without one,
 *   2. creates the system Sales and Purchases accounts,
 *   3. posts the missing entry for each live client invoice
 *      (credit client account, debit Sales) and supplier invoice
 *      (debit supplier account, credit Purchases), dated on the invoice date.
 *
 *   npm run backfill:ledger              dry run: does everything, then rolls back
 *   npm run backfill:ledger -- --apply   writes it
 *
 * Safe to repeat: only vehicles without an account and invoices without a
 * ledger entry are touched. Each company runs in one SQL transaction, so a
 * company is either fully backfilled or not at all.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { vehicleAccountName, VEHICLE_ACCOUNT_TYPE_NAME, VEHICLE_ACCOUNT_TYPE_SHORT_FORM } from "@stuttgart/shared/constants/client-account";
import { PrismaClient } from "../src/generated/prisma/client.js";
import type { Tx } from "../src/modules/audit/audit.js";
import {
    postClientInvoice,
    postSupplierInvoice,
    systemAccountId,
    systemAccountTypeId,
} from "../src/modules/ledger/party-postings.js";

const apply = process.argv.includes("--apply");

class DryRunRollback extends Error {}

type Summary = {
    company: string;
    vehicleAccounts: number;
    clientInvoices: number;
    clientTotal: number;
    supplierInvoices: number;
    supplierTotal: number;
    skipped: string[];
};

const money = (value: unknown) => Math.round((Number(value) || 0) * 100) / 100;

/** Accounts whose balance ≠ opening balance + credits − debits. */
async function brokenBalances(tx: Tx, companyId: string) {
    const rows = await tx.$queryRawUnsafe<{ id: string; name: string }[]>(
        `SELECT a.id, a.name
         FROM accounts a
         LEFT JOIN (SELECT credit_account_id AS id, SUM(amount) AS s FROM transactions GROUP BY 1) c ON c.id = a.id
         LEFT JOIN (SELECT debit_account_id  AS id, SUM(amount) AS s FROM transactions GROUP BY 1) d ON d.id = a.id
         WHERE a.company_id = $1 AND a.balance <> a.initial_balance + COALESCE(c.s, 0) - COALESCE(d.s, 0)`,
        companyId,
    );
    return new Map(rows.map((r) => [r.id, r.name]));
}

async function backfillCompany(tx: Tx, company: { id: string; name: string }): Promise<Summary> {
    const companyId = company.id;
    const summary: Summary = {
        company: company.name,
        vehicleAccounts: 0,
        clientInvoices: 0,
        clientTotal: 0,
        supplierInvoices: 0,
        supplierTotal: 0,
        skipped: [],
    };
    const brokenBefore = await brokenBalances(tx, companyId);

    // 1. Vehicle accounts.
    const vehicles = await tx.vehicle.findMany({ where: { companyId, entityStatus: true, account: null } });
    if (vehicles.length > 0) {
        const accountTypeId = await systemAccountTypeId(tx, companyId, VEHICLE_ACCOUNT_TYPE_NAME, VEHICLE_ACCOUNT_TYPE_SHORT_FORM);
        for (const vehicle of vehicles) {
            await tx.account.create({
                data: { companyId, name: vehicleAccountName(vehicle.name), accountTypeId, vehicleId: vehicle.id },
            });
            summary.vehicleAccounts++;
        }
    }

    // 2. Sales and Purchases accounts (created even if there are no invoices yet).
    await systemAccountId(tx, companyId, "sales");
    await systemAccountId(tx, companyId, "purchases");

    // 3a. Client invoices without an entry.
    const invoices = await tx.invoice.findMany({
        where: { companyId, entityStatus: true, status: { not: "cancelled" }, transactionId: null },
        include: { client: { select: { name: true, account: { select: { id: true, entityStatus: true } } } } },
        orderBy: { date: "asc" },
    });
    for (const invoice of invoices) {
        const total = money(invoice.totalIncludingVat);
        if (!invoice.client.account?.entityStatus) {
            summary.skipped.push(`Client invoice ${invoice.taxInvoiceNo}: client "${invoice.client.name}" has no active account`);
            continue;
        }
        const transactionId = await postClientInvoice(tx, {
            companyId,
            clientId: invoice.clientId,
            taxInvoiceNo: invoice.taxInvoiceNo,
            date: invoice.date,
            total,
            partyName: invoice.client.name,
        });
        if (!transactionId) continue; // zero total
        await tx.invoice.update({ where: { id: invoice.id }, data: { transactionId } });
        summary.clientInvoices++;
        summary.clientTotal = money(summary.clientTotal + total);
    }

    // 3b. Supplier invoices without an entry.
    const supplierInvoices = await tx.supplierInvoice.findMany({
        where: { companyId, entityStatus: true, transactionId: null },
        include: { supplier: { select: { name: true, account: { select: { id: true, entityStatus: true } } } } },
        orderBy: { date: "asc" },
    });
    for (const invoice of supplierInvoices) {
        const total = money(invoice.totalIncludingVat);
        if (!invoice.supplier.account?.entityStatus) {
            summary.skipped.push(`Supplier invoice ${invoice.taxInvoiceNo}: supplier "${invoice.supplier.name}" has no active account`);
            continue;
        }
        const transactionId = await postSupplierInvoice(tx, {
            companyId,
            supplierId: invoice.supplierId,
            taxInvoiceNo: invoice.taxInvoiceNo,
            date: invoice.date,
            total,
            partyName: invoice.supplier.name,
        });
        if (!transactionId) continue; // zero total
        await tx.supplierInvoice.update({ where: { id: invoice.id }, data: { transactionId } });
        summary.supplierInvoices++;
        summary.supplierTotal = money(summary.supplierTotal + total);
    }

    // Every balance this run touched must still equal opening + credits − debits.
    const newlyBroken = [...(await brokenBalances(tx, companyId))].filter(([id]) => !brokenBefore.has(id));
    if (newlyBroken.length > 0) {
        throw new Error(`Balances out of step after backfill: ${newlyBroken.map(([, name]) => name).join(", ")}`);
    }
    if (brokenBefore.size > 0) {
        summary.skipped.push(`Already out of step before this run (left as is): ${[...brokenBefore.values()].join(", ")}`);
    }
    return summary;
}

async function main() {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) throw new Error("DATABASE_URL is not set in apps/server/.env");
    const target = new URL(databaseUrl);
    const socket = target.searchParams.get("host");
    console.log(`Postgres target: ${socket ? `socket ${socket}` : `${target.hostname}:${target.port}`}${target.pathname}`);
    console.log(`Mode:            ${apply ? "APPLY (writes)" : "DRY RUN (rolled back)"}\n`);

    const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
    try {
        const companies = await db.company.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });
        for (const company of companies) {
            let summary: Summary | undefined;
            try {
                await db.$transaction(
                    async (tx) => {
                        summary = await backfillCompany(tx, company);
                        if (!apply) throw new DryRunRollback();
                    },
                    { timeout: 10 * 60_000, maxWait: 30_000 },
                );
            } catch (error) {
                if (!(error instanceof DryRunRollback)) {
                    console.error(`✘ ${company.name}: ${(error as Error).message} — nothing written for this company.`);
                    process.exitCode = 1;
                    continue;
                }
            }
            const s = summary!;
            console.log(`${apply ? "✔" : "•"} ${s.company}`);
            console.log(`    vehicle accounts created: ${s.vehicleAccounts}`);
            console.log(`    client invoices posted:   ${s.clientInvoices} (total ${s.clientTotal.toFixed(2)})`);
            console.log(`    supplier invoices posted: ${s.supplierInvoices} (total ${s.supplierTotal.toFixed(2)})`);
            for (const line of s.skipped) console.log(`    ! ${line}`);
        }
        if (!apply) console.log("\nDry run only. Re-run with --apply to write.");
    } finally {
        await db.$disconnect();
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
