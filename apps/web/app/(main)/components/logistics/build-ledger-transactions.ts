import type { Account } from "@/hooks/use-accounts";
import type { Transaction } from "./columns";

/**
 * Merges per-account ledger entries into one row per transaction, with the
 * crediting/debiting account names resolved. Sorted newest first.
 */
export function buildLedgerTransactions(accounts: Account[]): Transaction[] {
  const txMap = new Map<string, Transaction>();

  for (const account of accounts) {
    if (!account.transactions) continue;

    for (const tx of account.transactions) {
      if (!txMap.has(tx.id)) {
        txMap.set(tx.id, {
          id: tx.id,
          date: tx.date || new Date(),
          createdAt: tx.createdAt || new Date(0),
          tags: tx.tags || [],
          department: tx.department,
          vehicle: tx.vehicle,
          voucher: tx.voucher,
          description: tx.description,
          amount: tx.amount,
          creditingAccount: "-",
          debitingAccount: "-",
        });
      }

      const existingTx = txMap.get(tx.id)!;
      if (tx.tags && tx.tags.length > 0) {
        existingTx.tags = Array.from(
          new Set([...(existingTx.tags || []), ...tx.tags]),
        );
      }
      if (!existingTx.department?.trim() && tx.department?.trim()) {
        existingTx.department = tx.department;
      }
      if (!existingTx.vehicle?.trim() && tx.vehicle?.trim()) {
        existingTx.vehicle = tx.vehicle;
      }

      if (tx.type === "credit") {
        existingTx.creditingAccount = account.name;
        existingTx.creditingAccountId = account.id;
      } else if (tx.type === "debit") {
        existingTx.debitingAccount = account.name;
        existingTx.debitingAccountId = account.id;
      }
    }
  }

  return Array.from(txMap.values()).sort((a, b) => {
    const dateDiff = b.date.getTime() - a.date.getTime();
    if (dateDiff === 0) {
      return (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0);
    }
    return dateDiff;
  });
}
