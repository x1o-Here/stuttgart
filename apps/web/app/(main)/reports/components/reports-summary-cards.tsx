"use client";

import { useMemo } from "react";
import { TruncatedText } from "@/components/shared/truncated-text";
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
        if (txDate.getMonth() !== monthIndex || txDate.getFullYear() !== year) {
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

  const cards = [
    {
      label: "Month credits",
      value: `+${money(stats.credits)}`,
      tone: "text-success",
    },
    {
      label: "Month debits",
      value: `−${money(stats.debits)}`,
      tone: "text-destructive",
    },
    {
      label: "Net cash flow",
      value: `${stats.net >= 0 ? "+" : "−"}${money(Math.abs(stats.net))}`,
      tone: stats.net >= 0 ? "text-success" : "text-destructive",
    },
    {
      label: "Transactions",
      value: String(stats.txCount),
      tone: "text-foreground",
    },
    {
      label: "Current balances",
      value: money(stats.currentBalance),
      tone: "text-foreground",
    },
    {
      label: "Accounts in view",
      value: String(stats.accountCount),
      tone: "text-foreground",
    },
  ];

  return (
    <div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
      {cards.map((card) => (
        <div
          key={card.label}
          className="flex min-w-0 flex-col gap-4 bg-card px-5 py-4"
        >
          <TruncatedText className="eyebrow normal-case tracking-normal">
            {card.label}
          </TruncatedText>
          <TruncatedText
            className={`font-mono text-2xl font-light tabular-nums ${
              loading ? "text-muted-foreground" : card.tone
            }`}
          >
            {loading ? "–" : card.value}
          </TruncatedText>
        </div>
      ))}
    </div>
  );
}
