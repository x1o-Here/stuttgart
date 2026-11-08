/**
 * The only code that moves money. Every balance change happens together with
 * the transaction row that explains it, inside the caller's SQL transaction.
 *
 * Balance rule (same as the Firestore app): the credited account's balance
 * goes up by the amount, the debited account's balance goes down.
 */
import { BadRequestException, NotFoundException } from "@nestjs/common";
import type { Transaction } from "../../generated/prisma/client.js";
import type { Tx } from "../audit/audit.js";

export type PostingInput = {
    companyId: string;
    date: Date;
    amount: number;
    description: string;
    chequeNo?: string;
    voucherNo?: number | null;
    debitAccountId?: string | null;
    creditAccountId?: string | null;
    departmentId?: string | null;
    vehicleId?: string | null;
    tags?: string[];
    createdAt?: Date;
};

/** Accounts must exist, be active and belong to the company. */
export async function assertAccounts(tx: Tx, companyId: string, ids: (string | null | undefined)[]) {
    const wanted = [...new Set(ids.filter((id): id is string => !!id))];
    if (wanted.length === 0) return;
    const found = await tx.account.findMany({
        where: { id: { in: wanted }, companyId, entityStatus: true },
        select: { id: true },
    });
    if (found.length !== wanted.length) throw new BadRequestException("An account in this entry doesn't exist.");
}

async function moveBalance(tx: Tx, accountId: string | null | undefined, delta: number) {
    if (!accountId || delta === 0) return;
    await tx.account.update({ where: { id: accountId }, data: { balance: { increment: delta } } });
}

/** Creates a transaction row and applies it to both account balances. */
export async function post(tx: Tx, input: PostingInput): Promise<Transaction> {
    if (!(input.amount > 0)) throw new BadRequestException("Amount must be greater than zero.");
    if (!input.debitAccountId && !input.creditAccountId) throw new BadRequestException("Pick at least one account.");
    if (input.debitAccountId && input.debitAccountId === input.creditAccountId) {
        throw new BadRequestException("The crediting and debiting accounts must be different.");
    }
    await assertAccounts(tx, input.companyId, [input.debitAccountId, input.creditAccountId]);

    const row = await tx.transaction.create({
        data: {
            companyId: input.companyId,
            date: input.date,
            amount: input.amount,
            description: input.description,
            chequeNo: input.chequeNo ?? "",
            voucherNo: input.voucherNo && input.voucherNo > 0 ? input.voucherNo : null,
            debitAccountId: input.debitAccountId ?? null,
            creditAccountId: input.creditAccountId ?? null,
            departmentId: input.departmentId ?? null,
            vehicleId: input.vehicleId ?? null,
            tags: input.tags ?? [],
            ...(input.createdAt ? { createdAt: input.createdAt } : {}),
        },
    });
    await moveBalance(tx, row.creditAccountId, input.amount);
    await moveBalance(tx, row.debitAccountId, -input.amount);
    return row;
}

/** Deletes a transaction row and takes it back out of both balances (used for payments). */
export async function unpost(tx: Tx, companyId: string, transactionId: string | null | undefined) {
    if (!transactionId) return;
    const row = await tx.transaction.findFirst({ where: { id: transactionId, companyId } });
    if (!row) return;
    const amount = Number(row.amount);
    await moveBalance(tx, row.creditAccountId, -amount);
    await moveBalance(tx, row.debitAccountId, amount);
    await tx.transaction.delete({ where: { id: row.id } });
}

export async function findTransactionOrThrow(tx: Tx, companyId: string, id: string) {
    const row = await tx.transaction.findFirst({ where: { id, companyId } });
    if (!row) throw new NotFoundException("Transaction not found");
    return row;
}

/** Department / vehicle are chosen by name in the form. */
export async function resolveLookupIds(tx: Tx, companyId: string, department: string, vehicle: string) {
    let departmentId: string | null = null;
    let vehicleId: string | null = null;
    if (department.trim()) {
        const row = await tx.department.findFirst({
            where: { companyId, name: { equals: department.trim(), mode: "insensitive" } },
        });
        if (!row) throw new BadRequestException(`Department "${department}" doesn't exist.`);
        departmentId = row.id;
    }
    if (vehicle.trim()) {
        const row = await tx.vehicle.findFirst({
            where: { companyId, name: { equals: vehicle.trim(), mode: "insensitive" } },
        });
        if (!row) throw new BadRequestException(`Vehicle "${vehicle}" doesn't exist.`);
        vehicleId = row.id;
    }
    return { departmentId, vehicleId };
}
