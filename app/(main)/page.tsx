"use client";

import { useMemo } from "react";
import { LoadingState } from "@/components/shared/loading-state";
import {
  AccountsLedgerProvider,
  useAccountsContext,
} from "@/contexts/useAccountsContext";
import {
  type Transaction,
  transactionsColumns,
} from "./components/logistics/columns";
import { DashboardTransactionsTable } from "./components/logistics/data-table";

function HomeContent() {
  const { accounts, loading } = useAccountsContext();

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
        {loading ? (
          <div className="bg-white rounded-lg p-6">
            <LoadingState
              message="Loading transactions..."
              variant="skeleton"
              rows={8}
            />
          </div>
        ) : (
          <DashboardTransactionsTable
            columns={transactionsColumns}
            data={transactionsData}
          />
        )}
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <AccountsLedgerProvider mode="all">
      <HomeContent />
    </AccountsLedgerProvider>
  );
}
