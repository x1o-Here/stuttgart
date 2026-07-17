"use client";

import { useParams } from "next/navigation";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { useAccountsContext } from "@/modules/accounts";
import { AccountsLedgerProvider } from "@/modules/ledger";
import { LoadingState, toDate } from "@/modules/platform";
import { transactionsColumns } from "./transactions-columns";
import { TransactionsDataTable } from "./transactions-table";

function AccountPageContent({ accountId }: { accountId: string }) {
  const { accounts, loading } = useAccountsContext();
  const account = accounts.find((acc) => acc.id === accountId);

  const transactionsWithRB = useMemo(() => {
    if (!account) return [];

    // Sort Newest first (Matching the table's default display) to calculate running balance backwards
    const sorted = [...account.transactions].sort((a, b) => {
      const dateA = toDate(a.date)?.getTime() || 0;
      const dateB = toDate(b.date)?.getTime() || 0;

      if (dateA !== dateB) return dateB - dateA;

      const createdA = toDate(a.createdAt)?.getTime() || 0;
      const createdB = toDate(b.createdAt)?.getTime() || 0;

      if (createdA !== createdB) return createdB - createdA;

      // Tie-breaker: New/Correction entries should come BEFORE reversals in DESC order
      const isReversalA = a.tags?.includes("reversal") ? 1 : 0;
      const isReversalB = b.tags?.includes("reversal") ? 1 : 0;
      return isReversalA - isReversalB;
    });

    let currentRB = account.balance || 0;

    const withRB = sorted.map((tx) => {
      const trWithRB = {
        ...tx,
        runningBalance: currentRB,
      };

      // Undo this transaction's impact to get the balance for the previous (older) one
      const amount = tx.amount || 0;
      if (tx.type === "credit") {
        currentRB -= amount;
      } else {
        currentRB += amount;
      }

      return trWithRB;
    });

    return withRB;
  }, [account]);

  const formattedAmount = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "LKR",
  }).format(account?.balance || 0);

  if (loading) {
    return (
      <div className="min-h-screen p-4 flex items-center justify-center font-sans">
        <div className="w-full min-h-[calc(100vh-2rem)] p-4 bg-zinc-100 rounded-lg">
          <div className="p-6 bg-white rounded-md">
            <LoadingState
              message="Loading account..."
              variant="skeleton"
              rows={6}
            />
          </div>
        </div>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="min-h-screen p-4 flex items-center justify-center font-sans">
        <div className="w-full min-h-[calc(100vh-2rem)] p-4 bg-zinc-100 rounded-lg flex items-center justify-center">
          <p className="text-muted-foreground">Account not found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 flex items-center justify-center font-sans">
      <div className="w-full min-h-[calc(100vh-2rem)] p-4 bg-zinc-100 rounded-lg flex flex-col">
        <div className="mt-2 p-4 bg-white rounded-md flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-end gap-2">
            <p className="text-black text-3xl font-semibold">{account.name}</p>
            {account.accountType && (
              <Badge variant="secondary" className="text-md rounded-md">
                {account.accountType}
              </Badge>
            )}
          </div>
          <p className="text-black text-xl font-light">{formattedAmount}</p>
        </div>

        <div className="mt-2 p-4 bg-white rounded-md flex flex-col flex-1 min-h-0">
          <TransactionsDataTable
            columns={transactionsColumns}
            data={transactionsWithRB}
          />
        </div>
      </div>
    </div>
  );
}

export default function AccountPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";

  if (!id) {
    return (
      <div className="min-h-screen p-4 flex items-center justify-center">
        <p className="text-muted-foreground">Account not found.</p>
      </div>
    );
  }

  return (
    <AccountsLedgerProvider mode={id}>
      <AccountPageContent accountId={id} />
    </AccountsLedgerProvider>
  );
}
