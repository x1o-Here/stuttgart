import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { roundMoney } from "@stuttgart/shared/invoices/money";
import { type ClientInvoiceStatus, deriveStatusFromBalances } from "@stuttgart/shared/invoices/status";
import type { invoiceInputSchema, invoiceTemplateInputSchema, paymentInputSchema } from "@stuttgart/shared/schemas/ledger";
import type { z } from "zod";
import type { Prisma } from "../../generated/prisma/client.js";
import { PrismaService } from "../../infra/prisma/prisma.service.js";
import { audit, type Tx } from "../audit/audit.js";
import type { AuthUser } from "../auth/index.js";
import { post, unpost } from "../ledger/ledger.primitives.js";

export type InvoiceBody = z.output<typeof invoiceInputSchema>;
export type TemplateBody = z.output<typeof invoiceTemplateInputSchema>;
export type PaymentBody = z.output<typeof paymentInputSchema>;

const json = (value: unknown) => value as Prisma.InputJsonValue;
const money = (value: unknown) => roundMoney(Number(value) || 0);

@Injectable()
export class SalesService {
    constructor(private readonly prisma: PrismaService) {}

    // ── Invoice template ────────────────────────────────────────────────

    /** Was edit-invoice-template-dialog.tsx (one template per client). */
    saveTemplate(companyId: string, user: AuthUser, clientId: string, input: TemplateBody) {
        return this.prisma.$transaction(async (tx) => {
            const client = await this.client(tx, companyId, clientId);
            const existing = await tx.invoiceTemplate.findUnique({ where: { clientId } });
            const data = { columns: json(input.columns), signing: json(input.signing), supplier: json(input.supplier) };
            if (existing) {
                await tx.invoiceTemplate.update({ where: { clientId }, data: { ...data, updatedById: user.uid } });
            } else {
                await tx.invoiceTemplate.create({
                    data: { id: `tpl-${clientId}`, clientId, ...data, createdById: user.uid },
                });
            }
            await audit(tx, {
                userId: user.uid,
                companyId,
                action: existing ? "update" : "create",
                description: `${existing ? "Invoice template updated" : "Invoice template created"}: ${client.name}`,
                entityId: clientId,
            });
        });
    }

    // ── Invoices ────────────────────────────────────────────────────────

    /** Was create-invoice-form.tsx (new invoice). */
    createInvoice(companyId: string, user: AuthUser, clientId: string, input: InvoiceBody) {
        return this.prisma.$transaction(async (tx) => {
            const client = await this.client(tx, companyId, clientId);
            const total = this.checkTotals(input);
            const invoice = await tx.invoice.create({
                data: {
                    companyId,
                    clientId,
                    ...this.invoiceFields(input),
                    outstandingAmount: total,
                    status: "issued",
                    createdById: user.uid,
                },
            });
            await this.replaceLines(tx, invoice.id, input);
            await audit(tx, {
                userId: user.uid,
                companyId,
                action: "create",
                description: `Invoice ${input.taxInvoiceNo} created for ${client.name}`,
                entityId: invoice.id,
            });
            return { id: invoice.id };
        });
    }

    /** Was create-invoice-form.tsx (editing). Outstanding = new total − payments made. */
    updateInvoice(companyId: string, user: AuthUser, clientId: string, invoiceId: string, input: InvoiceBody) {
        return this.prisma.$transaction(async (tx) => {
            const client = await this.client(tx, companyId, clientId);
            const invoice = await this.invoice(tx, companyId, clientId, invoiceId);
            const total = this.checkTotals(input);
            const paid = await this.paidOn(tx, invoiceId);
            if (total < paid) {
                throw new BadRequestException(`The total can’t be less than the ${paid.toFixed(2)} already paid.`);
            }
            const outstanding = roundMoney(Math.max(0, total - paid));
            await tx.invoice.update({
                where: { id: invoiceId },
                data: {
                    ...this.invoiceFields(input),
                    outstandingAmount: outstanding,
                    status: deriveStatusFromBalances(total, outstanding, invoice.status as ClientInvoiceStatus),
                    updatedById: user.uid,
                },
            });
            await this.replaceLines(tx, invoiceId, input);
            await audit(tx, {
                userId: user.uid,
                companyId,
                action: "update",
                description: `Invoice ${input.taxInvoiceNo} updated for ${client.name}`,
                entityId: invoiceId,
            });
            return { id: invoiceId };
        });
    }

    /** Was complete-invoice-dialog.tsx. */
    completeInvoice(companyId: string, user: AuthUser, clientId: string, invoiceId: string) {
        return this.prisma.$transaction(async (tx) => {
            const invoice = await this.invoice(tx, companyId, clientId, invoiceId);
            const canComplete =
                invoice.status !== "paid" &&
                invoice.status !== "cancelled" &&
                money(invoice.outstandingAmount) <= 0 &&
                money(invoice.totalIncludingVat) > 0;
            if (!canComplete) throw new BadRequestException("Only fully paid invoices can be completed.");
            await tx.invoice.update({
                where: { id: invoiceId },
                data: { status: "paid", outstandingAmount: 0, updatedById: user.uid },
            });
            await audit(tx, {
                userId: user.uid,
                companyId,
                action: "update",
                description: `Invoice ${invoice.taxInvoiceNo} marked as completed/paid`,
                entityId: invoiceId,
            });
        });
    }

    /** Was delete-invoice-dialog.tsx (soft delete, status cancelled). */
    deleteInvoice(companyId: string, user: AuthUser, clientId: string, invoiceId: string) {
        return this.prisma.$transaction(async (tx) => {
            const invoice = await this.invoice(tx, companyId, clientId, invoiceId);
            await tx.invoice.update({
                where: { id: invoiceId },
                data: { entityStatus: false, status: "cancelled", updatedById: user.uid },
            });
            await audit(tx, {
                userId: user.uid,
                companyId,
                action: "delete",
                description: `Invoice ${invoice.taxInvoiceNo || invoiceId} deleted`,
                entityId: invoiceId,
            });
        });
    }

    // ── Payments ────────────────────────────────────────────────────────

    /**
     * Was invoice-payment-dialog.tsx. Records (or edits) a payment: posts its
     * ledger entry, updates both balances, and the invoice's outstanding amount
     * and status, all in one SQL transaction.
     */
    savePayment(
        companyId: string,
        user: AuthUser,
        clientId: string,
        invoiceId: string,
        input: PaymentBody,
        paymentId?: string,
    ) {
        return this.prisma.$transaction(async (tx) => {
            const invoice = await this.invoice(tx, companyId, clientId, invoiceId);
            const existing = paymentId
                ? await tx.invoicePayment.findFirst({ where: { id: paymentId, invoiceId, entityStatus: true } })
                : null;
            if (paymentId && !existing) throw new NotFoundException("Payment not found");

            const amount = money(input.amount);
            const total = money(invoice.totalIncludingVat);
            const available = roundMoney(money(invoice.outstandingAmount) + (existing ? money(existing.amount) : 0));
            if (amount > available) throw new BadRequestException(`Amount cannot exceed ${available.toFixed(2)}.`);

            if (existing) await unpost(tx, companyId, existing.transactionId);
            const entry = await post(tx, {
                companyId,
                date: input.date,
                amount,
                description: input.description,
                chequeNo: input.chequeNo,
                creditAccountId: input.creditingAccountId,
                debitAccountId: input.debitingAccountId,
                tags: ["invoice-payment", invoice.taxInvoiceNo],
            });

            const fields = {
                transactionId: entry.id,
                date: input.date,
                amount,
                description: input.description,
                chequeNo: input.chequeNo,
            };
            const payment = existing
                ? await tx.invoicePayment.update({
                      where: { id: existing.id },
                      data: { ...fields, updatedById: user.uid },
                  })
                : await tx.invoicePayment.create({ data: { invoiceId, ...fields, createdById: user.uid } });

            const outstanding = roundMoney(available - amount);
            const base = (invoice.status === "paid" ? "partial" : invoice.status) as ClientInvoiceStatus;
            await tx.invoice.update({
                where: { id: invoiceId },
                data: {
                    outstandingAmount: Math.max(0, outstanding),
                    status: deriveStatusFromBalances(total, outstanding, base),
                    updatedById: user.uid,
                },
            });
            await audit(tx, {
                userId: user.uid,
                companyId,
                action: existing ? "update" : "create",
                description: existing
                    ? `Payment on invoice ${invoice.taxInvoiceNo} updated`
                    : `Payment of ${amount} added to invoice ${invoice.taxInvoiceNo}`,
                entityId: entry.id,
            });
            return { id: payment.id };
        });
    }

    /** Was delete-invoice-payment-dialog.tsx: payment soft-deleted, its ledger entry removed. */
    deletePayment(companyId: string, user: AuthUser, clientId: string, invoiceId: string, paymentId: string) {
        return this.prisma.$transaction(async (tx) => {
            const invoice = await this.invoice(tx, companyId, clientId, invoiceId);
            const payment = await tx.invoicePayment.findFirst({
                where: { id: paymentId, invoiceId, entityStatus: true },
            });
            if (!payment) throw new NotFoundException("Payment not found");

            const total = money(invoice.totalIncludingVat);
            const outstanding = roundMoney(Math.min(total, money(invoice.outstandingAmount) + money(payment.amount)));
            const base = (invoice.status === "paid" ? "partial" : invoice.status) as ClientInvoiceStatus;

            await unpost(tx, companyId, payment.transactionId);
            await tx.invoicePayment.update({
                where: { id: paymentId },
                data: { entityStatus: false, transactionId: null, updatedById: user.uid },
            });
            await tx.invoice.update({
                where: { id: invoiceId },
                data: {
                    outstandingAmount: outstanding,
                    status: deriveStatusFromBalances(total, outstanding, base),
                    updatedById: user.uid,
                },
            });
            await audit(tx, {
                userId: user.uid,
                companyId,
                action: "delete",
                description: `Payment of ${money(payment.amount)} removed from invoice ${invoice.taxInvoiceNo}`,
                entityId: payment.transactionId ?? payment.id,
            });
        });
    }

    // ── helpers ──────────────────────────────────────────────────────────

    private async client(tx: Tx, companyId: string, clientId: string) {
        const client = await tx.client.findFirst({ where: { id: clientId, companyId, entityStatus: true } });
        if (!client) throw new NotFoundException("Client not found");
        return client;
    }

    private async invoice(tx: Tx, companyId: string, clientId: string, invoiceId: string) {
        const invoice = await tx.invoice.findFirst({
            where: { id: invoiceId, companyId, clientId, entityStatus: true },
        });
        if (!invoice) throw new NotFoundException("Invoice not found");
        return invoice;
    }

    private async paidOn(tx: Tx, invoiceId: string) {
        const sum = await tx.invoicePayment.aggregate({
            where: { invoiceId, entityStatus: true },
            _sum: { amount: true },
        });
        return money(sum._sum.amount);
    }

    /** Line amounts must add up to the value of supply, and supply + VAT to the total. */
    private checkTotals(input: InvoiceBody) {
        const lines = roundMoney(input.lineItems.reduce((sum, line) => sum + money(line.amount), 0));
        if (Math.abs(lines - money(input.totalAmount)) > 0.01) {
            throw new BadRequestException("Line amounts don't add up to the invoice total.");
        }
        const total = money(input.totalIncludingVat);
        if (Math.abs(money(input.totalAmount) + money(input.vatAmount) - total) > 0.01) {
            throw new BadRequestException("Value of supply plus VAT doesn't equal the total.");
        }
        return total;
    }

    private invoiceFields(input: InvoiceBody) {
        return {
            taxInvoiceNo: input.taxInvoiceNo,
            date: input.date,
            deliveryDate: input.delivery.date,
            deliveryAddress: input.delivery.address,
            deliveryReference: input.delivery.reference,
            clientSnapshot: json(input.client),
            templateSnapshot: json(input.template),
            totalAmount: money(input.totalAmount),
            vatAmount: money(input.vatAmount),
            totalIncludingVat: money(input.totalIncludingVat),
        };
    }

    private async replaceLines(tx: Tx, invoiceId: string, input: InvoiceBody) {
        await tx.invoiceLineItem.deleteMany({ where: { invoiceId } });
        await tx.invoiceLineItem.createMany({
            data: input.lineItems.map((line, index) => ({
                invoiceId,
                position: index + 1,
                date: line.date,
                vehicleNo: line.vehicleNo,
                rate: money(line.rate),
                amount: money(line.amount),
                customValues: json(line.customValues),
            })),
        });
    }
}
