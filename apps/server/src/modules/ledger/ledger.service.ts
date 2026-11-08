import { BadRequestException, Injectable } from "@nestjs/common";
import { hasRestrictedTags } from "@stuttgart/shared/helpers/transaction-tags";
import type { AccountCreate, TransactionInput } from "@stuttgart/shared/schemas/ledger";
import type { Transaction } from "../../generated/prisma/client.js";
import { PrismaService } from "../../infra/prisma/prisma.service.js";
import { audit, type Tx } from "../audit/audit.js";
import type { AuthUser } from "../auth/index.js";
import { findTransactionOrThrow, post, resolveLookupIds } from "./ledger.primitives.js";

type ParsedTransaction = Omit<TransactionInput, "date" | "amount" | "vehicle" | "voucherNo"> & {
    date: Date;
    amount: number;
    vehicle: string;
    voucherNo: number;
};

@Injectable()
export class LedgerService {
    constructor(private readonly prisma: PrismaService) {}

    /** Was add-account-dialog.tsx. The opening balance is the initial balance. */
    createAccount(companyId: string, user: AuthUser, input: AccountCreate) {
        return this.prisma.$transaction(async (tx) => {
            const type = await tx.accountType.findFirst({
                where: {
                    companyId,
                    entityStatus: true,
                    name: { equals: input.accountType.trim(), mode: "insensitive" },
                },
            });
            if (!type) throw new BadRequestException(`Account type "${input.accountType}" doesn't exist.`);
            const balance = Number(input.balance ?? 0);
            const account = await tx.account.create({
                data: { companyId, name: input.name.trim(), accountTypeId: type.id, initialBalance: balance, balance },
            });
            await audit(tx, {
                userId: user.uid,
                companyId,
                action: "create",
                description: `Account created: ${account.name}`,
                entityId: account.id,
            });
            return { id: account.id };
        });
    }

    /** Was add-transaction-dialog.tsx. */
    createTransaction(companyId: string, user: AuthUser, input: ParsedTransaction) {
        return this.prisma.$transaction(async (tx) => {
            const row = await this.postFromForm(tx, companyId, input);
            await audit(tx, {
                userId: user.uid,
                companyId,
                action: "create",
                description: "Transaction added",
                entityId: row.id,
            });
            return { id: row.id };
        });
    }

    /**
     * Was the edit flow in transaction-actions.tsx: the original is never
     * changed. It is tagged "corrected", a reversal entry cancels it out, and
     * the corrected entry is posted, so the ledger keeps a full history.
     */
    correctTransaction(companyId: string, user: AuthUser, id: string, input: ParsedTransaction) {
        return this.prisma.$transaction(async (tx) => {
            const original = await this.editable(tx, companyId, id);
            const now = Date.now();
            await this.reverse(tx, original, "corrected", new Date(now));
            const corrected = await this.postFromForm(tx, companyId, input, new Date(now + 500));
            await audit(tx, {
                userId: user.uid,
                companyId,
                action: "update-with-reversal",
                description: "Transaction reversed and updated",
                entityId: corrected.id,
            });
            return { id: corrected.id };
        });
    }

    /** Was the delete flow in transaction-actions.tsx: tag "deleted" + reversal entry. */
    deleteTransaction(companyId: string, user: AuthUser, id: string) {
        return this.prisma.$transaction(async (tx) => {
            const original = await this.editable(tx, companyId, id);
            const reversal = await this.reverse(tx, original, "deleted", new Date());
            await tx.auditLog.create({
                data: {
                    userId: user.uid,
                    companyId,
                    action: "delete",
                    description: "Transaction deleted and reversed",
                    entityId: reversal.id,
                    entityStatus: false,
                },
            });
            return { id: reversal.id };
        });
    }

    // ── helpers ──────────────────────────────────────────────────────────

    private async editable(tx: Tx, companyId: string, id: string) {
        const original = await findTransactionOrThrow(tx, companyId, id);
        if (hasRestrictedTags(original.tags)) {
            throw new BadRequestException("This entry was already corrected, deleted or is a reversal.");
        }
        return original;
    }

    private async postFromForm(tx: Tx, companyId: string, input: ParsedTransaction, createdAt?: Date) {
        const { departmentId, vehicleId } = await resolveLookupIds(tx, companyId, input.department, input.vehicle);
        return post(tx, {
            companyId,
            date: input.date,
            amount: input.amount,
            description: input.description,
            voucherNo: input.voucherNo,
            creditAccountId: input.creditingAccount,
            debitAccountId: input.debitingAccount,
            departmentId,
            vehicleId,
            createdAt,
        });
    }

    /** Posts the mirror image of `original` and tags the original. */
    private async reverse(tx: Tx, original: Transaction, tag: "corrected" | "deleted", createdAt: Date) {
        await tx.transaction.update({
            where: { id: original.id },
            data: { tags: [...new Set([...original.tags, tag])] },
        });
        return post(tx, {
            companyId: original.companyId,
            date: original.date,
            amount: Number(original.amount),
            description: `Reversal: ${original.description}`,
            voucherNo: original.voucherNo,
            debitAccountId: original.creditAccountId,
            creditAccountId: original.debitAccountId,
            departmentId: original.departmentId,
            vehicleId: original.vehicleId,
            tags: ["reversal"],
            createdAt,
        });
    }
}
