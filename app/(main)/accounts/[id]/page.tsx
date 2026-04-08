"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo } from "react";
import { useAccountsContext } from "@/contexts/useAccountsContext";
import { transactionsColumns } from "./components/transactions-columns";
import { TransactionsDataTable } from "./components/transactions-table";
import { toDate } from "@/lib/helpers/to-date";

export default function AccountPage() {
  const params = useParams();
  const { id } = params;

  const { accounts } = useAccountsContext();
  const account = accounts.find((acc) => acc.id === id);

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

  useEffect(() => {
    console.log("Account details:", account);
  }, [account]);

  return (
    <div className="min-h-screen p-4 flex items-center justify-center font-sans">
      <div className="w-full min-h-[calc(100vh-2rem)] p-4 bg-zinc-100 rounded-lg flex flex-col">
        <div className="mt-2 p-4 bg-white rounded-md flex items-center justify-between gap-4 shrink-0">
          <p className="text-black text-3xl font-semibold">{account?.name}</p>
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
