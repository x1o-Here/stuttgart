/**
 * Runs every migration step against an in-memory fake Firestore whose
 * documents are shaped exactly like apps/web writes them, including some
 * deliberately broken ones. Use it to check the script before trusting it
 * with collections that are still empty in production.
 *
 *   DATABASE_URL=<throwaway local db> npx tsx scripts/migrate/selftest.ts
 *
 * It TRUNCATES the target database, so it refuses anything but a database
 * whose name ends in "_test".
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { type Firestore, Timestamp } from "firebase-admin/firestore";
import { PrismaClient } from "../../src/generated/prisma/client.js";
import { createCtx } from "./context.js";
import { migrateIdentity } from "./steps/identity.js";
import { migrateLedger } from "./steps/ledger.js";
import { migrateLookups } from "./steps/lookups.js";
import { migrateAuditLogs, migrateReports, migrateSpareParts, migrateVatPayments } from "./steps/other.js";
import { migrateParties } from "./steps/parties.js";
import { migratePurchases } from "./steps/purchases.js";
import { migrateSales } from "./steps/sales.js";
import { verify } from "./verify.js";

const ts = (iso: string) => Timestamp.fromDate(new Date(iso));
const C = "companies/co1";

// path → data
const DOCS: Record<string, Record<string, unknown>> = {
    "users/u1": { username: "Admin", email: "a@x.lk", role: "admin", companies: ["co1", "gone-co"], firstSignIn: false, createdAt: ts("2026-01-01") },
    "users/u2": { username: "Odd", email: "o@x.lk", role: "boss", companies: ["co1"], firstSignIn: true, createdAt: ts("2026-01-02") },
    "companies/co1": { name: "Test Co", address: "Colombo", telephoneNo: "011", tin: "123", updatedAt: ts("2026-01-03"), updatedBy: "u1" },

    "lookup-lists/co1/account-types/at-bank": { name: "Bank", shortForm: "BK", entityStatus: true, createdAt: ts("2026-01-04") },
    "lookup-lists/co1/account-types/at-client": { name: "Client", shortForm: "CL", isSystem: true, entityStatus: true },
    "lookup-lists/co1/account-types/at-sup": { name: "Supplier", shortForm: "SP", isSystem: true, entityStatus: true },
    "lookup-lists/co1/departments/d1": { name: "Transport", shortForm: "TR", entityStatus: true },
    "lookup-lists/co1/supplier-types/st1": { name: "Parts", shortForm: "PT", entityStatus: true },
    "lookup-lists/co1/vehicles/v1": { name: "WP-1234", shortForm: "", entityStatus: true }, // old copy: must be ignored
    [`${C}/vehicles/v1`]: { name: "WP-1234", shortForm: "", description: "Lorry", entityStatus: true },

    [`${C}/clients/cl1`]: { name: "Client One", address: "Kandy", contactNo: "077", vatNo: "V1", status: "active", entityStatus: true },
    [`${C}/suppliers/s1`]: { name: "Parts Ltd", tin: "T1", address: "Galle", supplierType: "Parts", contactNo: "071", status: "active", entityStatus: true },

    // Bank: 1000 + credits (500 + 200 + 40) − debits (300 + 50) = 1390
    [`${C}/accounts/a-bank`]: { name: "Main bank", accountType: "Bank", initialBalance: 1000, balance: 1390, entityStatus: true },
    // Client: 0 − debits (500 + 200) = −700
    [`${C}/accounts/a-client`]: { name: "Client One", accountType: "Client", initialBalance: 0, balance: -700, clientId: "cl1", entityStatus: true },
    // Supplier: 0 + credits 300 = 300
    [`${C}/accounts/a-sup`]: { name: "Parts Ltd", accountType: "Supplier", initialBalance: 0, balance: 300, supplierId: "s1", entityStatus: true },
    [`${C}/accounts/a-bad`]: { name: "Broken", accountType: "Nope", initialBalance: 0, balance: 0 }, // ✘ unknown type

    // t1: manual transaction with department/vehicle/voucher
    [`${C}/accounts/a-bank/transactions/t1`]: { type: "credit", date: ts("2026-02-01"), amount: 500, department: "Transport", vehicle: "WP-1234", voucherNo: 7, description: "Hire" },
    [`${C}/accounts/a-client/transactions/t1`]: { type: "debit", date: ts("2026-02-01"), amount: 500, department: "Transport", vehicle: "WP-1234", voucherNo: 7, description: "Hire" },
    // t2: invoice payment
    [`${C}/accounts/a-bank/transactions/t2`]: { type: "credit", date: ts("2026-02-05"), amount: 200, voucherNo: 0, tags: ["invoice-payment", "INV000000000001"] },
    [`${C}/accounts/a-client/transactions/t2`]: { type: "debit", date: ts("2026-02-05"), amount: 200, voucherNo: 0, tags: ["invoice-payment", "INV000000000001"] },
    // t3: supplier payment
    [`${C}/accounts/a-bank/transactions/t3`]: { type: "debit", date: ts("2026-02-06"), amount: 300, tags: ["supplier-payment"] },
    [`${C}/accounts/a-sup/transactions/t3`]: { type: "credit", date: ts("2026-02-06"), amount: 300, tags: ["supplier-payment"] },
    // t4: VAT payment (debit side only)
    [`${C}/accounts/a-bank/transactions/t4`]: { type: "debit", date: ts("2026-02-07"), amount: 50, tags: ["vat-payment"] },
    // t5: ✘ sides disagree on the amount
    [`${C}/accounts/a-bank/transactions/t5`]: { type: "credit", date: ts("2026-02-08"), amount: 10 },
    [`${C}/accounts/a-client/transactions/t5`]: { type: "debit", date: ts("2026-02-08"), amount: 11 },
    // t6: one side sits under the rejected account → that side dropped (warning)
    [`${C}/accounts/a-bank/transactions/t6`]: { type: "credit", date: ts("2026-02-09"), amount: 40, department: "Unknown dept" },
    [`${C}/accounts/a-bad/transactions/t6`]: { type: "debit", date: ts("2026-02-09"), amount: 40 },

    [`${C}/clients/cl1/invoice-template/tpl1`]: { clientId: "cl1", columns: [{ id: "c1", key: "vehicleNo", label: "Vehicle", type: "text", required: true, system: true }], signing: { leftLabel: "Prepared" }, supplier: { name: "Test Co" }, entityStatus: true, createdBy: "u1" },
    [`${C}/clients/cl1/invoices/inv1`]: {
        taxInvoiceNo: "INV000000000001", date: ts("2026-02-02"), status: "partial", entityStatus: true, isActive: true,
        client: { id: "cl1", name: "Client One" }, template: { columns: [], signing: {} },
        delivery: { address: "Port", date: ts("2026-02-02"), reference: "DN-1" },
        lineItems: [
            { no: 1, date: ts("2026-02-01"), vehicleNo: "WP-1234", rate: 100, amount: 100, customValues: { custom_x: "A" } },
            { no: 2, date: ts("2026-02-01"), vehicleNo: "WP-1234", rate: 100, amount: 100, customValues: {} },
        ],
        totalAmount: 200, vatAmount: 36, totalIncludingVat: 236, outstandingAmount: 36, createdBy: "u1",
    },
    [`${C}/clients/cl1/invoices/inv1/payments/p1`]: { date: ts("2026-02-05"), amount: 200, description: "Cheque", chequeNo: "123", transactionId: "t2", entityStatus: true, createdBy: "u1" },
    [`${C}/clients/cl1/invoices/inv1/payments/p2`]: { date: ts("2026-02-04"), amount: 99, transactionId: "gone", entityStatus: false }, // deleted: no warning

    [`${C}/suppliers/s1/invoices/si1`]: { taxInvoiceNo: "sup000000000001", date: ts("2026-02-03"), billAmount: 254.24, vatAmount: 45.76, totalIncludingVat: 300, outstandingAmount: 0, status: "paid", lineItems: [{ id: "l1", description: "Tyres", quantity: 2 }], entityStatus: true, createdBy: "u1" },
    [`${C}/suppliers/s1/invoices/si1/payments/sp1`]: { date: ts("2026-02-06"), amount: 300, transactionId: "t3", entityStatus: true },
    [`${C}/suppliers/s1/invoices/si2`]: { taxInvoiceNo: "SUP000000000001", date: ts("2026-02-03"), billAmount: 1, vatAmount: 0, totalIncludingVat: 1, outstandingAmount: 1, status: "issued", lineItems: [], entityStatus: true }, // ✘ duplicate live tax no

    [`${C}/vatPayments/vp1`]: { quarterKey: "2026-27-Q1", date: ts("2026-02-07"), amount: 50, reference: "R1", accountId: "a-bank", transactionId: "t4", entityStatus: true },

    [`${C}/spareParts/sp1`]: { partId: "AB-1", partIdKey: "ab-1", description: "Filter", status: "assigned", vehicleId: "v1", assignedAt: ts("2026-02-10"), entityStatus: true },
    [`${C}/spareParts/sp2`]: { partId: "ab-1", partIdKey: "ab-1", status: "in_stock", entityStatus: true }, // ✘ duplicate live part ID
    [`${C}/spareParts/sp3`]: { partId: "AB-1", partIdKey: "ab-1", status: "scrapped", entityStatus: false }, // deleted: allowed

    [`${C}/reports/r1`]: { name: "Bank report", accountIds: ["a-bank", "a-missing"], filters: { tagFilter: ["active"] }, fromDate: ts("2026-01-01"), entityStatus: true, createdBy: "u1" },

    "auditLogs/log1": { userId: "u1", companyId: "co1", action: "create", description: "Something", transactionId: "t1", entityStatus: true, createdAt: ts("2026-02-01") },
};

const EXPECT = {
    rejected: ["companies/co1/accounts/a-bad", "transactions/t5", "suppliers/s1/invoices/si", "spareParts/sp"],
    rows: { vehicles: 1, transactions: 5, invoice_line_items: 2, user_companies: 2, report_accounts: 1 },
};

function fakeFirestore(): Firestore {
    const docs = Object.entries(DOCS).map(([path, data]) => ({
        id: path.split("/").pop(),
        ref: { path },
        data: () => data,
    }));
    const result = (list: typeof docs) => ({ get: async () => ({ docs: list }) });
    return {
        collectionGroup: (name: string) => result(docs.filter((d) => d.ref.path.split("/").slice(-2)[0] === name)),
        collection: (name: string) => result(docs.filter((d) => d.ref.path.split("/").length === 2 && d.ref.path.startsWith(`${name}/`))),
    } as unknown as Firestore;
}

async function main() {
    const url = process.env.DATABASE_URL ?? "";
    if (!new URL(url).pathname.endsWith("_test")) throw new Error("Point DATABASE_URL at a database whose name ends in _test.");
    const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

    const tables = await db.$queryRawUnsafe<{ tablename: string }[]>(
        `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`,
    );
    await db.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(", ")} CASCADE`);

    const ctx = createCtx(fakeFirestore(), db, false);
    for (const step of [migrateIdentity, migrateLookups, migrateParties, migrateLedger, migrateSales, migratePurchases, migrateVatPayments, migrateSpareParts, migrateReports, migrateAuditLogs]) {
        await step(ctx);
    }
    const checks = await verify(ctx);

    const problems: string[] = [];
    const rejected = ctx.log.rejects.map((r) => `${r.path} — ${r.reason}`);
    for (const fragment of EXPECT.rejected) {
        if (!rejected.some((r) => r.includes(fragment))) problems.push(`expected a rejection matching "${fragment}"`);
    }
    if (rejected.length !== EXPECT.rejected.length) problems.push(`expected ${EXPECT.rejected.length} rejections, got ${rejected.length}`);
    for (const [table, want] of Object.entries(EXPECT.rows)) {
        const [{ n }] = await db.$queryRawUnsafe<{ n: bigint }[]>(`SELECT count(*) AS n FROM "${table}"`);
        if (Number(n) !== want) problems.push(`${table}: expected ${want} rows, got ${n}`);
    }
    for (const c of checks) if (!c.ok) problems.push(`verification failed: ${c.name}: ${c.details.join("; ")}`);

    const [t1] = await db.$queryRawUnsafe<{ d: string; v: string; voucher: number }[]>(
        `SELECT d.name AS d, v.name AS v, t.voucher_no AS voucher FROM transactions t JOIN departments d ON d.id = t.department_id JOIN vehicles v ON v.id = t.vehicle_id WHERE t.id = 't1'`,
    );
    if (t1?.d !== "Transport" || t1?.v !== "WP-1234" || t1?.voucher !== 7) problems.push("t1: department/vehicle/voucher not resolved");
    const [t2] = await db.$queryRawUnsafe<{ voucher: number | null }[]>(`SELECT voucher_no AS voucher FROM transactions WHERE id = 't2'`);
    if (t2?.voucher !== null) problems.push("t2: voucherNo 0 should become null");
    const [si1] = await db.$queryRawUnsafe<{ no: string }[]>(`SELECT tax_invoice_no AS no FROM supplier_invoices WHERE id = 'si1'`);
    if (si1?.no !== "SUP000000000001") problems.push("si1: tax invoice no should be upper-cased");

    // The checks must also *fail* on bad data: break three things and re-verify.
    await db.$executeRawUnsafe(`UPDATE accounts SET balance = balance + 1 WHERE id = 'a-bank'`);
    await db.$executeRawUnsafe(`UPDATE invoices SET outstanding_amount = outstanding_amount + 1 WHERE id = 'inv1'`);
    await db.$executeRawUnsafe(`UPDATE vat_payments SET amount = amount + 1 WHERE id = 'vp1'`);
    const tampered = await verify(ctx);
    for (const name of ["Account balances", "Sales invoice", "VAT paid"]) {
        if (tampered.find((c) => c.name.startsWith(name))?.ok !== false) problems.push(`"${name}" check did not catch tampered data`);
    }

    console.log("Rejected:");
    for (const r of rejected) console.log(`  ✘ ${r}`);
    console.log("Warnings:");
    for (const w of ctx.log.warnings) console.log(`  ! ${w}`);
    console.log("Verification:");
    for (const c of checks) console.log(`  ${c.ok ? "✔" : "✘"} ${c.name}`);
    console.log(problems.length ? `\n✘ SELF-TEST FAILED\n  - ${problems.join("\n  - ")}` : "\n✔ SELF-TEST PASSED");

    await db.$disconnect();
    process.exitCode = problems.length ? 1 : 0;
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
