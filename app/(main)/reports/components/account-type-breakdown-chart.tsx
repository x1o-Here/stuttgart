"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";
import { LoadingState } from "@/components/shared/loading-state";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { useReportFilter } from "@/contexts/report-filter-context";
import { useAccountsContext } from "@/contexts/useAccountsContext";
import { LINE_COLORS } from "./chart-component";

const chartConfig = {
  balance: { label: "Balance" },
  activity: { label: "Activity" },
} satisfies ChartConfig;

export default function AccountTypeBreakdownChart() {
  const { accounts, loading } = useAccountsContext();
  const { selectedMonthYear } = useReportFilter();

  const data = useMemo(() => {
    const [monthStr, yearStr] = selectedMonthYear.split(" ");
    const monthIndex = new Date(`${monthStr} 1, ${yearStr}`).getMonth();
    const year = Number.parseInt(yearStr, 10);

    const map = new Map<
      string,
      { balance: number; activity: number; count: number }
    >();

    for (const account of accounts) {
      const type = account.accountType?.trim() || "Uncategorized";
      const current = map.get(type) ?? { balance: 0, activity: 0, count: 0 };
      current.balance += account.balance;
      current.count += 1;

      for (const tx of account.transactions) {
        const txDate = new Date(tx.date);
        if (
          txDate.getMonth() === monthIndex &&
          txDate.getFullYear() === year
        ) {
          current.activity += tx.amount;
        }
      }

      map.set(type, current);
    }

    return Array.from(map.entries())
      .map(([type, value]) => ({
        type,
        balance: Math.round(value.balance),
        activity: Math.round(value.activity),
        count: value.count,
      }))
      .sort((a, b) => b.activity - a.activity);
  }, [accounts, selectedMonthYear]);

  if (loading) {
    return (
      <div className="flex h-full flex-col rounded-xl bg-white p-6">
        <LoadingState message="Loading account types..." variant="compact" />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-72 flex-col rounded-xl bg-white p-6">
      <div className="mb-4 border-b border-zinc-100 pb-3">
        <h3 className="font-semibold text-zinc-800">By Account Type</h3>
        <p className="text-xs text-zinc-500">
          Balance and monthly activity · {selectedMonthYear}
        </p>
      </div>

      {data.length ? (
        <ChartContainer config={chartConfig} className="min-h-0 flex-1 w-full">
          <BarChart data={data} layout="vertical" margin={{ left: 12 }}>
            <CartesianGrid horizontal={false} strokeDasharray="3 3" />
            <XAxis type="number" tickLine={false} axisLine={false} />
            <YAxis
              type="category"
              dataKey="type"
              width={100}
              tickLine={false}
              axisLine={false}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="activity" radius={[0, 4, 4, 0]}>
              {data.map((entry, index) => (
                <Cell
                  key={entry.type}
                  fill={LINE_COLORS[index % LINE_COLORS.length]}
                />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      ) : (
        <div className="flex flex-1 items-center justify-center text-sm text-zinc-500">
          No account type data yet.
        </div>
      )}
    </div>
  );
}
