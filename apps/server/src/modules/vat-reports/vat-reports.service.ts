import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { roundMoney } from "@stuttgart/shared/invoices/money";
import type { Prisma } from "../../generated/prisma/client.js";
import { PrismaService } from "../../infra/prisma/prisma.service.js";
import { audit } from "../audit/audit.js";
import type { AuthUser } from "../auth/index.js";
import { assertAccounts, post, unpost } from "../ledger/ledger.primitives.js";

const lkr = (value: number) =>
    `LKR ${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export type VatPaymentBody = {
    quarterKey: string;
    quarterLabel: string;
    /** VAT due for the quarter (output − input), as shown on the VAT tab. */
    due: number;
    date: Date;
    amount: number;
    reference: string;
    accountId: string;
};

export type ReportBody = {
    name: string;
    description: string;
    fromDate?: Date | null;
    toDate?: Date | null;
    accountIds: string[];
};

@Injectable()
export class VatReportsService {
    constructor(private readonly prisma: PrismaService) {}

    /**
     * Was lib/vat/vat-payments.ts recordVatPayment: the payment plus a
     * debit-only ledger entry on the paying account, capped at what is still
     * payable for the quarter.
     */
    recordVatPayment(companyId: string, user: AuthUser, input: VatPaymentBody) {
        return this.prisma.$transaction(async (tx) => {
            const amount = roundMoney(input.amount);
            if (!(amount > 0)) throw new BadRequestException("Enter an amount greater than zero.");
            await assertAccounts(tx, companyId, [input.accountId]);
            const account = await tx.account.findUniqueOrThrow({ where: { id: input.accountId } });

            const paid = await tx.vatPayment.aggregate({
                where: { companyId, quarterKey: input.quarterKey, entityStatus: true },
                _sum: { amount: true },
            });
            const remaining = roundMoney(Math.max(0, input.due) - roundMoney(Number(paid._sum.amount ?? 0)));
            if (amount > remaining) {
                throw new BadRequestException(
                    remaining > 0
                        ? `Only ${lkr(remaining)} is still payable for ${input.quarterLabel}.`
                        : `${input.quarterLabel} is already fully paid.`,
                );
            }

            const reference = input.reference.trim();
            const description = `VAT payment ${input.quarterLabel}${reference ? ` · ${reference}` : ""}`;
            const entry = await post(tx, {
                companyId,
                date: input.date,
                amount,
                description,
                debitAccountId: input.accountId,
                tags: ["vat-payment", input.quarterLabel],
            });
            const payment = await tx.vatPayment.create({
                data: {
                    companyId,
                    quarterKey: input.quarterKey,
                    date: input.date,
                    amount,
                    reference,
                    accountId: input.accountId,
                    transactionId: entry.id,
                    createdById: user.uid,
                },
            });
            await audit(tx, {
                userId: user.uid,
                companyId,
                action: "create",
                description: `${description}: ${lkr(amount)} from ${account.name}`,
                entityId: payment.id,
            });
            return { id: payment.id };
        });
    }

    /** Removes a VAT payment and reverses its ledger entry. */
    deleteVatPayment(companyId: string, user: AuthUser, id: string, quarterLabel: string) {
        return this.prisma.$transaction(async (tx) => {
            const payment = await tx.vatPayment.findFirst({
                where: { id, companyId, entityStatus: true },
                include: { account: { select: { name: true } } },
            });
            if (!payment) throw new NotFoundException("VAT payment not found");
            await unpost(tx, companyId, payment.transactionId);
            await tx.vatPayment.update({
                where: { id },
                data: { entityStatus: false, transactionId: null, updatedById: user.uid },
            });
            await audit(tx, {
                userId: user.uid,
                companyId,
                action: "delete",
                description: `VAT payment ${quarterLabel} of ${lkr(Number(payment.amount))} deleted and returned to ${payment.account.name}`,
                entityId: id,
            });
        });
    }

    /** Was add-custom-report-dialog.tsx. */
    createReport(companyId: string, user: AuthUser, input: ReportBody) {
        return this.prisma.$transaction(async (tx) => {
            await assertAccounts(tx, companyId, input.accountIds);
            const report = await tx.report.create({
                data: {
                    companyId,
                    name: input.name.trim(),
                    description: input.description.trim(),
                    fromDate: input.fromDate ?? null,
                    toDate: input.toDate ?? null,
                    createdById: user.uid,
                    accounts: { create: [...new Set(input.accountIds)].map((accountId) => ({ accountId })) },
                },
            });
            await audit(tx, {
                userId: user.uid,
                companyId,
                action: "create",
                description: `Custom report created: ${report.name}`,
                entityId: report.id,
            });
            return { id: report.id };
        });
    }

    /** Was the filter save on reports/[id]. */
    async saveReportFilters(companyId: string, id: string, filters: Record<string, unknown>) {
        const { count } = await this.prisma.report.updateMany({
            where: { id, companyId, entityStatus: true },
            data: { filters: filters as Prisma.InputJsonValue },
        });
        if (count === 0) throw new NotFoundException("Report not found");
    }
}
