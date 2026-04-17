"use client";

import { useMemo } from "react";
import { transactionsColumns, type Transaction } from "./components/logistics/columns";
import { DashboardTransactionsTable } from "./components/logistics/data-table";
import { useAccountsContext } from "@/contexts/useAccountsContext";

export default function Home() {
  const { accounts } = useAccountsContext();

  const transactionsData = useMemo(() => {
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
            description: tx.description,
            amount: tx.amount,
            creditingAccount: "-",
            debitingAccount: "-",
          });
        }

        const existingTx = txMap.get(tx.id)!;
        if (tx.tags && tx.tags.length > 0) {
          existingTx.tags = Array.from(new Set([...(existingTx.tags || []), ...tx.tags]));
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
  }, [accounts]);

  return (
    <div className="min-h-screen h-full p-4 flex items-center justify-center font-sans">
      <div className="w-full h-full p-4 bg-zinc-100 rounded-lg overflow-y-auto">
        {/* <TableTabs /> */}
        <DashboardTransactionsTable
          columns={transactionsColumns}
          data={transactionsData}
        />
      </div>
    </div>
  );
}
