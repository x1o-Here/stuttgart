import { SupplierInvoiceStatus } from "../../../src/generated/prisma/client.js";
import {
    type Ctx,
    date,
    docsAt,
    migrate,
    money,
    oneOf,
    Reject,
    requiredDate,
    seg,
    str,
    userRef,
} from "../context.js";
import { transactionRef } from "./sales.js";

const STATUSES = Object.values(SupplierInvoiceStatus);

/** Supplier invoices (+ lines) → supplier payments. */
export async function migratePurchases(ctx: Ctx) {
    await migrate(
        ctx,
        "supplier_invoices",
        await docsAt(ctx, "companies/*/suppliers/*/invoices/*"),
        (doc) => {
            const d = doc.data();
            const [, companyId, , supplierId] = seg(doc);
            if (!ctx.known.suppliers.has(supplierId)) throw new Reject(`supplier ${supplierId} not found`);
            const lines: Record<string, unknown>[] = Array.isArray(d.lineItems) ? d.lineItems : [];
            return {
                invoice: {
                    id: doc.id,
                    companyId,
                    supplierId,
                    taxInvoiceNo: str(d.taxInvoiceNo).toUpperCase(),
                    date: requiredDate(d.date, "date"),
                    billAmount: money(d.billAmount, "billAmount"),
                    vatAmount: money(d.vatAmount, "vatAmount"),
                    totalIncludingVat: money(d.totalIncludingVat, "totalIncludingVat"),
                    outstandingAmount: money(d.outstandingAmount ?? d.totalIncludingVat, "outstandingAmount"),
                    status: oneOf(d.status, STATUSES, SupplierInvoiceStatus.issued, () =>
                        ctx.log.warn(`${doc.ref.path}: unknown status "${d.status}" → issued`),
                    ),
                    entityStatus: d.entityStatus !== false,
                    createdAt: date(d.createdAt),
                    updatedAt: date(d.updatedAt),
                    createdById: userRef(ctx, d.createdBy, doc.ref.path, "createdBy"),
                    updatedById: userRef(ctx, d.updatedBy, doc.ref.path, "updatedBy"),
                },
                lines: lines.map((line, index) => {
                    const quantity = Number(line.quantity);
                    if (!Number.isInteger(quantity) || quantity <= 0) {
                        throw new Reject(`lineItems[${index}].quantity "${String(line.quantity)}" is not a whole number above 0`);
                    }
                    return {
                        id: `${doc.id}-${index + 1}`,
                        supplierInvoiceId: doc.id,
                        position: index + 1,
                        description: str(line.description),
                        quantity,
                    };
                }),
            };
        },
        ({ invoice: { id, ...data }, lines }) =>
            ctx.db.$transaction([
                ctx.db.supplierInvoice.upsert({ where: { id }, create: { id, ...data }, update: data }),
                ctx.db.supplierInvoiceLine.deleteMany({ where: { supplierInvoiceId: id } }),
                ctx.db.supplierInvoiceLine.createMany({ data: lines }),
            ]),
        (row) => ctx.known.supplierInvoices.add(row.invoice.id),
    );

    await migrate(
        ctx,
        "supplier_payments",
        await docsAt(ctx, "companies/*/suppliers/*/invoices/*/payments/*"),
        (doc) => {
            const d = doc.data();
            const supplierInvoiceId = seg(doc)[5];
            if (!ctx.known.supplierInvoices.has(supplierInvoiceId)) {
                throw new Reject(`supplier invoice ${supplierInvoiceId} not found`);
            }
            return {
                id: doc.id,
                supplierInvoiceId,
                transactionId: transactionRef(ctx, d, doc.ref.path),
                date: requiredDate(d.date, "date"),
                amount: money(d.amount, "amount"),
                description: str(d.description),
                chequeNo: str(d.chequeNo),
                entityStatus: d.entityStatus !== false,
                createdAt: date(d.createdAt),
                updatedAt: date(d.updatedAt),
                createdById: userRef(ctx, d.createdBy, doc.ref.path, "createdBy"),
                updatedById: userRef(ctx, d.updatedBy, doc.ref.path, "updatedBy"),
            };
        },
        ({ id, ...data }) => ctx.db.supplierPayment.upsert({ where: { id }, create: { id, ...data }, update: data }),
    );
}
