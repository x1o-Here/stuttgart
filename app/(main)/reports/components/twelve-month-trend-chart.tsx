"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { LoadingState } from "@/components/shared/loading-state";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { useReportFilter } from "@/contexts/report-filter-context";
import { useAccountsContext } from "@/contexts/useAccountsContext";

const chartConfig = {
  credits: { label: "Credits", color: "#10b981" },
  debits: { label: "Debits", color: "#f43f5e" },
  net: { label: "Net", color: "#6366f1" },
} satisfies ChartConfig;

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string) {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleString(undefined, {
    month: "short",
    year: "2-digit",
  });
}

export default function TwelveMonthTrendChart() {
  const { accounts, loading } = useAccountsContext();
  const { selectedAccountId } = useReportFilter();

  const data = useMemo(() => {
    const scoped =
      selectedAccountId === "all"
        ? accounts
        : accounts.filter((account) => account.id === selectedAccountId);

    const now = new Date();
    const keys: string[] = [];
    for (let offset = 11; offset >= 0; offset -= 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      keys.push(monthKey(date));
    }

    const map = new Map(
      keys.map((key) => [key, { credits: 0, debits: 0, net: 0 }]),
    );

    for (const account of scoped) {
      for (const tx of account.transactions) {
        const key = monthKey(new Date(tx.date));
        const bucket = map.get(key);
        if (!bucket) continue;
        if (tx.type === "credit") bucket.credits += tx.amount;
        else bucket.debits += tx.amount;
        bucket.net = bucket.credits - bucket.debits;
      }
    }

    return keys.map((key) => {
      const bucket = map.get(key) ?? { credits: 0, debits: 0, net: 0 };
      return {
        key,
        label: monthLabel(key),
        credits: Math.round(bucket.credits),
        debits: Math.round(bucket.debits),
        net: Math.round(bucket.net),
      };
    });
  }, [accounts, selectedAccountId]);

  if (loading) {
    return (
      <div className="flex h-full flex-col rounded-xl bg-white p-6">
        <LoadingState message="Loading trend..." variant="compact" />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-72 flex-col rounded-xl bg-white p-6">
      <div className="mb-4 border-b border-zinc-100 pb-3">
        <h3 className="font-semibold text-zinc-800">12-Month Cash Flow</h3>
        <p className="text-xs text-zinc-500">
          Credits, debits, and net by month
        </p>
      </div>

      <ChartContainer config={chartConfig} className="min-h-0 flex-1 w-full">
        <BarChart data={data}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={56}
            tickFormatter={(value) => `${Number(value).toLocaleString()}`}
          />
          <ChartTooltip content={<ChartTooltipContent />} />
          <ChartLegend content={<ChartLegendContent />} />
          <Bar
            dataKey="credits"
            fill="var(--color-credits)"
            radius={[3, 3, 0, 0]}
          />
          <Bar
            dataKey="debits"
            fill="var(--color-debits)"
            radius={[3, 3, 0, 0]}
          />
          <Bar dataKey="net" fill="var(--color-net)" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ChartContainer>
    </div>
  );
}
