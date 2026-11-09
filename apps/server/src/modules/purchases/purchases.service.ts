import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
    SUPPLIER_ACCOUNT_TYPE_NAME,
    SUPPLIER_ACCOUNT_TYPE_SHORT_FORM,
} from "@stuttgart/shared/constants/client-account";
import {
    normalizeTaxInvoiceNo,
    roundMoney,
    splitVatInclusive,
    validateTaxInvoiceNo,
} from "@stuttgart/shared/invoices/money";
import type {
    paymentInputSchema,
    supplierInputSchema,
    supplierInvoiceInputSchema,
} from "@stuttgart/shared/schemas/ledger";
import { supplierInvoiceStatus } from "@stuttgart/shared/suppliers/supplier-model";
import type { z } from "zod";
import { Prisma } from "../../generated/prisma/client.js";
import { PrismaService } from "../../infra/prisma/prisma.service.js";
import { audit, type Tx } from "../audit/audit.js";
import type { AuthUser } from "../auth/index.js";
import { post, unpost } from "../ledger/ledger.primitives.js";

export type SupplierBody = z.output<typeof supplierInputSchema>;
export type SupplierInvoiceBody = z.output<typeof supplierInvoiceInputSchema>;
export type PaymentBody = z.output<typeof paymentInputSchema>;

const money = (value: unknown) => roundMoney(Number(value) || 0);
const lkr = (value: number) => `LKR ${value.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

@Injectable()
export class PurchasesService {
    constructor(private readonly prisma: PrismaService) {}

    // ── Suppliers ───────────────────────────────────────────────────────

    /** Was add-supplier-dialog.tsx: supplier + "Supplier" account type (if needed) + its account. */
    createSupplier(companyId: string, user: AuthUser, input: SupplierBody) {
        return this.prisma.$transaction(async (tx) => {
            const supplierTypeId = await this.supplierTypeId(tx, companyId, input.supplierType);
            const supplier = await tx.supplier.create({
                data: {
                    companyId,
                    name: input.name,
                    tin: input.tin,
                    address: input.address,
                    contactNo: input.contactNo,
                    supplierTypeId,
                },
            });
            let type = await tx.accountType.findFirst({
                where: { companyId, name: { equals: SUPPLIER_ACCOUNT_TYPE_NAME, mode: "insensitive" } },
            });
            if (!type) {
                type = await tx.accountType.create({
                    data: {
                        companyId,
                        name: SUPPLIER_ACCOUNT_TYPE_NAME,
                        shortForm: SUPPLIER_ACCOUNT_TYPE_SHORT_FORM,
                        isSystem: true,
                    },
                });
            } else if (!type.isSystem) {
                await tx.accountType.update({ where: { id: type.id }, data: { isSystem: true } });
            }
            await tx.account.create({
                data: { companyId, name: supplier.name, accountTypeId: type.id, supplierId: supplier.id },
            });
            await audit(tx, {
                userId: user.uid,
                companyId,
                action: "create",
                description: `Supplier created: ${supplier.name} (with supplier account)`,
                entityId: supplier.id,
            });
            return { id: supplier.id };
        });
    }

    /** Was edit-supplier-dialog.tsx. Renaming also renames the supplier's account. */
    updateSupplier(companyId: string, user: AuthUser, supplierId: string, input: SupplierBody) {
        return this.prisma.$transaction(async (tx) => {
            const before = await this.supplier(tx, companyId, supplierId);
            const supplierTypeId = await this.supplierTypeId(tx, companyId, input.supplierType);
            const supplier = await tx.supplier.update({
                where: { id: supplierId },
                data: {
                    name: input.name,
                    tin: input.tin,
                    address: input.address,
                    contactNo: input.contactNo,
                    supplierTypeId,
                },
            });
            if (supplier.name !== before.name) {
                await tx.account.updateMany({ where: { companyId, supplierId }, data: { name: supplier.name } });
            }
            await audit(tx, {
                userId: user.uid,
                companyId,
                action: "update",
                description: `Supplier updated: ${supplier.name}`,
                entityId: supplierId,
            });
        });
    }

    setSupplierStatus(companyId: string, user: AuthUser, supplierId: string, status: "active" | "inactive") {
        return this.prisma.$transaction(async (tx) => {
            const supplier = await this.supplier(tx, companyId, supplierId);
            await tx.supplier.update({ where: { id: supplierId }, data: { status } });
            await audit(tx, {
                userId: user.uid,
                companyId,
                action: "update",
                description: `Supplier status changed to ${status}: ${supplier.name}`,
                entityId: supplierId,
            });
        });
    }

    // ── Supplier invoices ───────────────────────────────────────────────

    createInvoice(companyId: string, user: AuthUser, supplierId: string, input: SupplierInvoiceBody) {
        const lines = this.validate(input);
        const taxNo = normalizeTaxInvoiceNo(input.taxInvoiceNo);
        const split = splitVatInclusive(input.totalIncludingVat);
        return this.withTaxNoCheck(companyId, taxNo, async (tx) => {
            const supplier = await this.supplier(tx, companyId, supplierId);
            const invoice = await tx.supplierInvoice.create({
                data: {
                    companyId,
                    supplierId,
                    taxInvoiceNo: taxNo,
                    date: input.date,
                    billAmount: split.billAmount,
                    vatAmount: split.vatAmount,
                    totalIncludingVat: split.total,
                    outstandingAmount: split.total,
                    status: "issued",
                    createdById: user.uid,
                },
            });
            await this.replaceLines(tx, invoice.id, lines);
            await audit(tx, {
                userId: user.uid,
                companyId,
                action: "create",
                description: `Supplier invoice ${taxNo} submitted for ${supplier.name}`,
                entityId: invoice.id,
            });
            return { id: invoice.id };
        });
    }

    updateInvoice(companyId: string, user: AuthUser, supplierId: string, invoiceId: string, input: SupplierInvoiceBody) {
        const lines = this.validate(input);
        const taxNo = normalizeTaxInvoiceNo(input.taxInvoiceNo);
        const split = splitVatInclusive(input.totalIncludingVat);
        return this.withTaxNoCheck(companyId, taxNo, async (tx) => {
            const supplier = await this.supplier(tx, companyId, supplierId);
            const invoice = await this.invoice(tx, companyId, supplierId, invoiceId);
            const paid = roundMoney(money(invoice.totalIncludingVat) - money(invoice.outstandingAmount));
            if (split.total < paid) {
                throw new BadRequestException(`The total can’t be less than the ${lkr(paid)} already paid.`);
            }
            const outstanding = roundMoney(split.total - paid);
            await tx.supplierInvoice.update({
                where: { id: invoiceId },
                data: {
                    taxInvoiceNo: taxNo,
                    date: input.date,
                    billAmount: split.billAmount,
                    vatAmount: split.vatAmount,
                    totalIncludingVat: split.total,
                    outstandingAmount: outstanding,
                    status: supplierInvoiceStatus(split.total, outstanding),
                    updatedById: user.uid,
                },
            });
            await this.replaceLines(tx, invoiceId, lines);
            await audit(tx, {
                userId: user.uid,
                companyId,
                action: "update",
                description: `Supplier invoice ${taxNo} updated for ${supplier.name}`,
                entityId: invoiceId,
            });
        });
    }

    /** Soft delete; frees the tax invoice number. Blocked while it has payments. */
    deleteInvoice(companyId: string, user: AuthUser, supplierId: string, invoiceId: string) {
        return this.prisma.$transaction(async (tx) => {
            const supplier = await this.supplier(tx, companyId, supplierId);
            const invoice = await this.invoice(tx, companyId, supplierId, invoiceId);
            const payments = await tx.supplierPayment.count({ where: { supplierInvoiceId: invoiceId, entityStatus: true } });
            if (payments > 0) throw new BadRequestException("This invoice has payments. Delete its payments first.");
            await tx.supplierInvoice.update({
                where: { id: invoiceId },
                data: { entityStatus: false, updatedById: user.uid },
            });
            await audit(tx, {
                userId: user.uid,
                companyId,
                action: "delete",
                description: `Supplier invoice ${invoice.taxInvoiceNo} deleted for ${supplier.name}`,
                entityId: invoiceId,
            });
        });
    }

    // ── Supplier payments ───────────────────────────────────────────────

    savePayment(
        companyId: string,
        user: AuthUser,
        supplierId: string,
        invoiceId: string,
        input: PaymentBody,
        paymentId?: string,
    ) {
        return this.prisma.$transaction(async (tx) => {
            const supplier = await this.supplier(tx, companyId, supplierId);
            const invoice = await this.invoice(tx, companyId, supplierId, invoiceId);
            const existing = paymentId
                ? await tx.supplierPayment.findFirst({
                      where: { id: paymentId, supplierInvoiceId: invoiceId, entityStatus: true },
                  })
                : null;
            if (paymentId && !existing) throw new NotFoundException("Payment not found");
            if (input.debitingAccountId === input.creditingAccountId) {
                throw new BadRequestException("Pay from an account other than the supplier’s own account.");
            }

            const amount = money(input.amount);
            const total = money(invoice.totalIncludingVat);
            const available = roundMoney(money(invoice.outstandingAmount) + (existing ? money(existing.amount) : 0));
            if (amount > available) {
                throw new BadRequestException(`Amount can’t exceed the ${lkr(available)} outstanding.`);
            }

            if (existing) await unpost(tx, companyId, existing.transactionId);
            const entry = await post(tx, {
                companyId,
                date: input.date,
                amount,
                description: input.description,
                chequeNo: input.chequeNo,
                debitAccountId: input.debitingAccountId,
                creditAccountId: input.creditingAccountId,
                tags: ["supplier-payment", invoice.taxInvoiceNo],
            });
            const fields = {
                transactionId: entry.id,
                date: input.date,
                amount,
                description: input.description,
                chequeNo: input.chequeNo,
            };
            const payment = existing
                ? await tx.supplierPayment.update({ where: { id: existing.id }, data: { ...fields, updatedById: user.uid } })
                : await tx.supplierPayment.create({
                      data: { supplierInvoiceId: invoiceId, ...fields, createdById: user.uid },
                  });

            const outstanding = roundMoney(available - amount);
            await tx.supplierInvoice.update({
                where: { id: invoiceId },
                data: {
                    outstandingAmount: outstanding,
                    status: supplierInvoiceStatus(total, outstanding),
                    updatedById: user.uid,
                },
            });
            await audit(tx, {
                userId: user.uid,
                companyId,
                action: existing ? "update" : "create",
                description: `Payment of ${lkr(amount)} ${existing ? "updated" : "recorded"} for supplier invoice ${invoice.taxInvoiceNo} (${supplier.name})`,
                entityId: entry.id,
            });
            return { id: payment.id };
        });
    }

    deletePayment(companyId: string, user: AuthUser, supplierId: string, invoiceId: string, paymentId: string) {
        return this.prisma.$transaction(async (tx) => {
            const supplier = await this.supplier(tx, companyId, supplierId);
            const invoice = await this.invoice(tx, companyId, supplierId, invoiceId);
            const payment = await tx.supplierPayment.findFirst({
                where: { id: paymentId, supplierInvoiceId: invoiceId, entityStatus: true },
            });
            if (!payment) throw new NotFoundException("Payment not found");
            const total = money(invoice.totalIncludingVat);
            const outstanding = roundMoney(Math.min(total, money(invoice.outstandingAmount) + money(payment.amount)));

            await unpost(tx, companyId, payment.transactionId);
            await tx.supplierPayment.update({
                where: { id: paymentId },
                data: { entityStatus: false, transactionId: null, updatedById: user.uid },
            });
            await tx.supplierInvoice.update({
                where: { id: invoiceId },
                data: {
                    outstandingAmount: outstanding,
                    status: supplierInvoiceStatus(total, outstanding),
                    updatedById: user.uid,
                },
            });
            await audit(tx, {
                userId: user.uid,
                companyId,
                action: "delete",
                description: `Payment of ${lkr(money(payment.amount))} deleted from supplier invoice ${invoice.taxInvoiceNo} (${supplier.name})`,
                entityId: paymentId,
            });
        });
    }

    // ── helpers ──────────────────────────────────────────────────────────

    private async supplier(tx: Tx, companyId: string, supplierId: string) {
        const supplier = await tx.supplier.findFirst({ where: { id: supplierId, companyId, entityStatus: true } });
        if (!supplier) throw new NotFoundException("Supplier not found");
        return supplier;
    }

    private async invoice(tx: Tx, companyId: string, supplierId: string, invoiceId: string) {
        const invoice = await tx.supplierInvoice.findFirst({
            where: { id: invoiceId, companyId, supplierId, entityStatus: true },
        });
        if (!invoice) throw new BadRequestException("This invoice no longer exists.");
        return invoice;
    }

    private async supplierTypeId(tx: Tx, companyId: string, name: string) {
        if (!name.trim()) return null;
        const type = await tx.supplierType.findFirst({
            where: { companyId, name: { equals: name.trim(), mode: "insensitive" } },
        });
        if (!type) throw new BadRequestException(`Supplier type "${name}" doesn't exist.`);
        return type.id;
    }

    /** Same rules and messages as lib/suppliers/supplier-invoices.ts. */
    private validate(input: SupplierInvoiceBody) {
        const taxError = validateTaxInvoiceNo(input.taxInvoiceNo);
        if (taxError) throw new BadRequestException(taxError);
        if (!(roundMoney(input.totalIncludingVat) > 0)) {
            throw new BadRequestException("Enter the total amount including VAT.");
        }
        const lines = input.lineItems.filter((line) => line.description.trim());
        if (lines.length === 0) throw new BadRequestException("Add at least one item with a description.");
        for (const line of lines) {
            if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
                throw new BadRequestException(
                    `Quantity for “${line.description.trim()}” must be a whole number above 0.`,
                );
            }
        }
        return lines.map((line) => ({ description: line.description.trim(), quantity: line.quantity }));
    }

    private async replaceLines(tx: Tx, invoiceId: string, lines: { description: string; quantity: number }[]) {
        await tx.supplierInvoiceLine.deleteMany({ where: { supplierInvoiceId: invoiceId } });
        await tx.supplierInvoiceLine.createMany({
            data: lines.map((line, index) => ({ supplierInvoiceId: invoiceId, position: index + 1, ...line })),
        });
    }

    /**
     * The partial unique index allows one live invoice per tax number per
     * company (it replaces the supplierInvoiceNos claim documents). Turn a
     * violation into the same message the app showed before.
     */
    private async withTaxNoCheck<T>(companyId: string, taxNo: string, work: (tx: Tx) => Promise<T>): Promise<T> {
        try {
            return await this.prisma.$transaction(work);
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
                const owner = await this.prisma.supplierInvoice.findFirst({
                    where: { companyId, taxInvoiceNo: taxNo, entityStatus: true },
                    include: { supplier: { select: { name: true } } },
                });
                throw new BadRequestException(
                    `Tax invoice no ${taxNo} already exists${owner ? ` for ${owner.supplier.name}` : ""}.`,
                );
            }
            throw error;
        }
    }
}
