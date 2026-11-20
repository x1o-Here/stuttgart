/**
 * Ledger entries for client and supplier invoices.
 *
 * A party's account reads as "what is owed" with the usual balance rule
 * (credit raises, debit lowers):
 *
 *   Client invoice issued      credit client account     debit Sales
 *   Client pays                debit client account      credit bank (chosen)
 *   Supplier invoice received  debit supplier account    credit Purchases
 *   We pay the supplier        credit supplier account   debit bank (chosen)
 *
 * So a positive client balance is money the client owes us, and a negative
 * supplier balance is money we owe the supplier.
 */
import { BadRequestException } from "@nestjs/common";
import {
    PURCHASES_ACCOUNT_TYPE_NAME,
    PURCHASES_ACCOUNT_TYPE_SHORT_FORM,
    SALES_ACCOUNT_TYPE_NAME,
    SALES_ACCOUNT_TYPE_SHORT_FORM,
} from "@stuttgart/shared/constants/client-account";
import type { Tx } from "../audit/audit.js";
import { post } from "./ledger.primitives.js";

/** Tags on invoice entries; these entries are changed only through their invoice. */
export const CLIENT_INVOICE_TAG = "invoice";
export const SUPPLIER_INVOICE_TAG = "supplier-invoice";
export const INVOICE_ENTRY_TAGS: readonly string[] = [CLIENT_INVOICE_TAG, SUPPLIER_INVOICE_TAG];

const SYSTEM_ACCOUNTS = {
    sales: { name: SALES_ACCOUNT_TYPE_NAME, shortForm: SALES_ACCOUNT_TYPE_SHORT_FORM },
    purchases: { name: PURCHASES_ACCOUNT_TYPE_NAME, shortForm: PURCHASES_ACCOUNT_TYPE_SHORT_FORM },
} as const;

/**
 * Finds (or creates) a system account type. A same-named type someone made by
 * hand is taken over and marked as system.
 */
export async function systemAccountTypeId(tx: Tx, companyId: string, name: string, shortForm: string) {
    const type = await tx.accountType.findFirst({
        where: { companyId, name: { equals: name, mode: "insensitive" } },
    });
    if (!type) {
        return (await tx.accountType.create({ data: { companyId, name, shortForm, isSystem: true } })).id;
    }
    if (!type.isSystem || !type.entityStatus) {
        await tx.accountType.update({ where: { id: type.id }, data: { isSystem: true, entityStatus: true } });
    }
    return type.id;
}

/** Finds (or creates) the company's Sales / Purchases system account. */
export async function systemAccountId(tx: Tx, companyId: string, kind: keyof typeof SYSTEM_ACCOUNTS) {
    const { name, shortForm } = SYSTEM_ACCOUNTS[kind];
    const type = { id: await systemAccountTypeId(tx, companyId, name, shortForm) };
    const existing = await tx.account.findFirst({
        where: { companyId, accountTypeId: type.id, entityStatus: true, clientId: null, supplierId: null, vehicleId: null },
        orderBy: { createdAt: "asc" },
        select: { id: true },
    });
    if (existing) return existing.id;
    const created = await tx.account.create({ data: { companyId, name, accountTypeId: type.id }, select: { id: true } });
    return created.id;
}

/** The client's or supplier's own ledger account. */
export async function partyAccountId(
    tx: Tx,
    companyId: string,
    party: { clientId: string } | { supplierId: string },
) {
    const account = await tx.account.findFirst({
        where: { companyId, entityStatus: true, ...party },
        select: { id: true },
    });
    if (!account) {
        const who = "clientId" in party ? "client" : "supplier";
        throw new BadRequestException(`This ${who} has no ledger account.`);
    }
    return account.id;
}

type InvoiceEntry = {
    companyId: string;
    taxInvoiceNo: string;
    date: Date;
    total: number;
    partyName: string;
};

/** Credit the client's account, debit Sales. Returns null for a zero total. */
export async function postClientInvoice(tx: Tx, entry: InvoiceEntry & { clientId: string }) {
    if (!(entry.total > 0)) return null;
    const row = await post(tx, {
        companyId: entry.companyId,
        date: entry.date,
        amount: entry.total,
        description: `Invoice ${entry.taxInvoiceNo} – ${entry.partyName}`,
        creditAccountId: await partyAccountId(tx, entry.companyId, { clientId: entry.clientId }),
        debitAccountId: await systemAccountId(tx, entry.companyId, "sales"),
        tags: [CLIENT_INVOICE_TAG, entry.taxInvoiceNo],
    });
    return row.id;
}

/** Debit the supplier's account, credit Purchases. Returns null for a zero total. */
export async function postSupplierInvoice(tx: Tx, entry: InvoiceEntry & { supplierId: string }) {
    if (!(entry.total > 0)) return null;
    const row = await post(tx, {
        companyId: entry.companyId,
        date: entry.date,
        amount: entry.total,
        description: `Supplier invoice ${entry.taxInvoiceNo} – ${entry.partyName}`,
        debitAccountId: await partyAccountId(tx, entry.companyId, { supplierId: entry.supplierId }),
        creditAccountId: await systemAccountId(tx, entry.companyId, "purchases"),
        tags: [SUPPLIER_INVOICE_TAG, entry.taxInvoiceNo],
    });
    return row.id;
}
