"use client";

import { useMemo } from "react";
import { LoadingState } from "@/components/shared/loading-state";
import { useReportFilter } from "@/contexts/report-filter-context";
import { useAccountsContext } from "@/contexts/useAccountsContext";

function money(value: number) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export default function ReportsSummaryCards() {
  const { accounts, loading } = useAccountsContext();
  const { selectedMonthYear, selectedAccountId } = useReportFilter();

  const stats = useMemo(() => {
    const [monthStr, yearStr] = selectedMonthYear.split(" ");
    const monthIndex = new Date(`${monthStr} 1, ${yearStr}`).getMonth();
    const year = Number.parseInt(yearStr, 10);

    const scoped =
      selectedAccountId === "all"
        ? accounts
        : accounts.filter((account) => account.id === selectedAccountId);

    let credits = 0;
    let debits = 0;
    let txCount = 0;
    let currentBalance = 0;

    for (const account of scoped) {
      currentBalance += account.balance;
      for (const tx of account.transactions) {
        const txDate = new Date(tx.date);
        if (
          txDate.getMonth() !== monthIndex ||
          txDate.getFullYear() !== year
        ) {
          continue;
        }
        txCount += 1;
        if (tx.type === "credit") credits += tx.amount;
        else debits += tx.amount;
      }
    }

    return {
      credits,
      debits,
      net: credits - debits,
      txCount,
      currentBalance,
      accountCount: scoped.length,
    };
  }, [accounts, selectedAccountId, selectedMonthYear]);

  if (loading) {
    return (
      <div className="rounded-xl bg-white p-4">
        <LoadingState message="Loading summary..." variant="compact" />
      </div>
    );
  }

  const cards = [
    {
      label: "Month credits",
      value: `+${money(stats.credits)}`,
      tone: "text-emerald-600",
    },
    {
      label: "Month debits",
      value: `-${money(stats.debits)}`,
      tone: "text-red-600",
    },
    {
      label: "Net cash flow",
      value: `${stats.net >= 0 ? "+" : ""}${money(stats.net)}`,
      tone: stats.net >= 0 ? "text-emerald-600" : "text-red-600",
    },
    {
      label: "Transactions",
      value: String(stats.txCount),
      tone: "text-zinc-800",
    },
    {
      label: "Current balances",
      value: money(stats.currentBalance),
      tone: "text-zinc-800",
    },
    {
      label: "Accounts in view",
      value: String(stats.accountCount),
      tone: "text-zinc-800",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {cards.map((card) => (
        <div key={card.label} className="rounded-xl bg-white p-4">
          <p className="text-xs text-zinc-500">{card.label}</p>
          <p className={`mt-1 text-xl font-semibold tabular-nums ${card.tone}`}>
            {card.value}
          </p>
          <p className="mt-1 text-[11px] text-zinc-400">{selectedMonthYear}</p>
        </div>
      ))}
    </div>
  );
}
