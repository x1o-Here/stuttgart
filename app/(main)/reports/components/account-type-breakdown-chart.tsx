"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { LoadingState } from "@/components/shared/loading-state";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { useReportFilter } from "@/contexts/report-filter-context";
import { useAccountsContext } from "@/contexts/useAccountsContext";
import { ReportPanel } from "./report-panel";

const chartConfig = {
  balance: { label: "Balance" },
  activity: { label: "Volume (LKR)", color: "var(--chart-1)" },
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
        if (txDate.getMonth() === monthIndex && txDate.getFullYear() === year) {
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

  return (
    <ReportPanel
      className="min-h-80"
      label="06 / By account type"
      caption={`Transaction volume this month · ${selectedMonthYear}`}
    >
      {loading ? (
        <LoadingState
          message="Loading account types..."
          variant="compact"
          className="flex-1"
        />
      ) : data.length ? (
        <ChartContainer config={chartConfig} className="min-h-56 w-full flex-1">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ left: 12, right: 8 }}
          >
            <CartesianGrid horizontal={false} strokeDasharray="2 4" />
            <XAxis
              type="number"
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => Number(value).toLocaleString()}
            />
            <YAxis
              type="category"
              dataKey="type"
              width={110}
              tickLine={false}
              axisLine={false}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar
              dataKey="activity"
              fill="var(--color-activity)"
              radius={[0, 4, 4, 0]}
              maxBarSize={22}
            />
          </BarChart>
        </ChartContainer>
      ) : (
        <p className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          No account type data yet.
        </p>
      )}
    </ReportPanel>
  );
}
