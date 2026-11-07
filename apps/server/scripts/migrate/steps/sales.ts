import { InvoiceStatus } from "../../../src/generated/prisma/client.js";
import {
    type Ctx,
    date,
    docsAt,
    json,
    migrate,
    money,
    oneOf,
    Reject,
    requiredDate,
    seg,
    str,
    userRef,
} from "../context.js";

const STATUSES = Object.values(InvoiceStatus);

/** Invoice templates → invoices (+ line items) → invoice payments. */
export async function migrateSales(ctx: Ctx) {
    await migrate(
        ctx,
        "invoice_templates",
        await docsAt(ctx, "companies/*/clients/*/invoice-template/*"),
        (doc) => {
            const d = doc.data();
            const clientId = seg(doc)[3];
            if (!ctx.known.clients.has(clientId)) throw new Reject(`client ${clientId} not found`);
            return {
                id: doc.id,
                clientId,
                columns: json(d.columns ?? []),
                signing: json(d.signing ?? {}),
                supplier: json(d.supplier ?? {}),
                entityStatus: d.entityStatus !== false,
                createdAt: date(d.createdAt),
                updatedAt: date(d.updatedAt),
                createdById: userRef(ctx, d.createdBy, doc.ref.path, "createdBy"),
                updatedById: userRef(ctx, d.updatedBy, doc.ref.path, "updatedBy"),
            };
        },
        ({ id, ...data }) => ctx.db.invoiceTemplate.upsert({ where: { id }, create: { id, ...data }, update: data }),
    );

    await migrate(
        ctx,
        "invoices",
        await docsAt(ctx, "companies/*/clients/*/invoices/*"),
        (doc) => {
            const d = doc.data();
            const [, companyId, , clientId] = seg(doc);
            if (!ctx.known.clients.has(clientId)) throw new Reject(`client ${clientId} not found`);
            const invoiceDate = requiredDate(d.date, "date");
            const lines: Record<string, unknown>[] = Array.isArray(d.lineItems) ? d.lineItems : [];
            const delivery = (d.delivery ?? {}) as Record<string, unknown>;
            return {
                invoice: {
                    id: doc.id,
                    companyId,
                    clientId,
                    taxInvoiceNo: str(d.taxInvoiceNo),
                    date: invoiceDate,
                    deliveryAddress: str(delivery.address),
                    deliveryDate: date(delivery.date) ?? null,
                    deliveryReference: str(delivery.reference),
                    clientSnapshot: json(d.client ?? {}),
                    templateSnapshot: json(d.template ?? {}),
                    totalAmount: money(d.totalAmount, "totalAmount"),
                    vatAmount: money(d.vatAmount, "vatAmount"),
                    totalIncludingVat: money(d.totalIncludingVat, "totalIncludingVat"),
                    outstandingAmount: money(d.outstandingAmount, "outstandingAmount"),
                    status: oneOf(d.status, STATUSES, InvoiceStatus.issued, () =>
                        ctx.log.warn(`${doc.ref.path}: unknown status "${d.status}" → issued`),
                    ),
                    entityStatus: d.entityStatus !== false,
                    createdAt: date(d.createdAt),
                    updatedAt: date(d.updatedAt),
                    createdById: userRef(ctx, d.createdBy, doc.ref.path, "createdBy"),
                    updatedById: userRef(ctx, d.updatedBy, doc.ref.path, "updatedBy"),
                },
                lines: lines.map((line, index) => ({
                    id: `${doc.id}-${index + 1}`,
                    invoiceId: doc.id,
                    position: Number(line.no) || index + 1,
                    date: date(line.date) ?? invoiceDate,
                    vehicleNo: str(line.vehicleNo),
                    rate: money(line.rate ?? 0, `lineItems[${index}].rate`),
                    amount: money(line.amount, `lineItems[${index}].amount`),
                    customValues: json(line.customValues ?? {}),
                })),
            };
        },
        ({ invoice: { id, ...data }, lines }) =>
            ctx.db.$transaction([
                ctx.db.invoice.upsert({ where: { id }, create: { id, ...data }, update: data }),
                ctx.db.invoiceLineItem.deleteMany({ where: { invoiceId: id } }),
                ctx.db.invoiceLineItem.createMany({ data: lines }),
            ]),
        (row) => ctx.known.invoices.add(row.invoice.id),
    );

    await migrate(
        ctx,
        "invoice_payments",
        await docsAt(ctx, "companies/*/clients/*/invoices/*/payments/*"),
        (doc) => {
            const d = doc.data();
            const invoiceId = seg(doc)[5];
            if (!ctx.known.invoices.has(invoiceId)) throw new Reject(`invoice ${invoiceId} not found`);
            return {
                id: doc.id,
                invoiceId,
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
        ({ id, ...data }) => ctx.db.invoicePayment.upsert({ where: { id }, create: { id, ...data }, update: data }),
    );
}

/**
 * A payment's ledger transaction. Deleting a payment in the app removes its
 * transaction, so for deleted payments a missing transaction is expected.
 */
export function transactionRef(ctx: Ctx, d: Record<string, unknown>, path: string): string | null {
    const id = str(d.transactionId);
    if (id && ctx.known.transactions.has(id)) return id;
    if (d.entityStatus !== false) {
        ctx.log.warn(`${path}: active payment's transaction "${id}" not found → left empty`);
    }
    return null;
}
