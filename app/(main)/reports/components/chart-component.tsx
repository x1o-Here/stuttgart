"use client";

import { useMemo } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { LoadingState } from "@/components/shared/loading-state";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { useReportFilter } from "@/contexts/report-filter-context";
import { useAccountsContext } from "@/contexts/useAccountsContext";
import { ChartLegendPopover } from "./chart-legend-popover";
import { SERIES_COLORS, seriesColor } from "./report-colors";
import { ReportPanel } from "./report-panel";

/** @deprecated use seriesColor() from ./report-colors */
export const LINE_COLORS = SERIES_COLORS;

export default function ChartComponent() {
  const { accounts, loading } = useAccountsContext();
  const { selectedMonthYear, selectedAccountId, setSelectedAccountId } =
    useReportFilter();

  // Determine which accounts to display
  const activeAccounts = useMemo(() => {
    if (selectedAccountId === "all") return accounts;
    return accounts.filter((acc) => acc.id === selectedAccountId);
  }, [accounts, selectedAccountId]);

  // Generate chart configuration dynamically for labels and colors
  const chartConfig = useMemo(() => {
    const config: any = {};
    activeAccounts.forEach((acc) => {
      config[acc.id] = {
        label: acc.name,
        color: seriesColor(accounts.indexOf(acc)),
      };
    });
    return config;
  }, [activeAccounts, accounts]);

  // Calculate daily data with multiple account entries
  const chartData = useMemo(() => {
    const [monthStr, yearStr] = selectedMonthYear.split(" ");
    const monthIndex = new Date(`${monthStr} 1, ${yearStr}`).getMonth();
    const year = parseInt(yearStr);

    const firstDayOfMonth = new Date(year, monthIndex, 1);
    const lastDayOfMonth = new Date(year, monthIndex + 1, 0);
    const daysInMonth = lastDayOfMonth.getDate();

    // 1️⃣ Initialize data structure for each day
    const dailyData: any[] = Array.from({ length: daysInMonth }, (_, i) => ({
      date: i + 1,
    }));

    // 2️⃣ Calculate for each active account
    activeAccounts.forEach((acc) => {
      let currentBalance = acc.initialBalance;

      // Calculate starting balance for the month
      acc.transactions.forEach((tx) => {
        const txDate = new Date(tx.date);
        if (txDate < firstDayOfMonth) {
          currentBalance += tx.type === "credit" ? tx.amount : -tx.amount;
        }
      });

      // Fill in daily balances
      for (let day = 1; day <= daysInMonth; day++) {
        acc.transactions.forEach((tx) => {
          const txDate = new Date(tx.date);
          if (
            txDate.getDate() === day &&
            txDate.getMonth() === monthIndex &&
            txDate.getFullYear() === year
          ) {
            currentBalance += tx.type === "credit" ? tx.amount : -tx.amount;
          }
        });
        dailyData[day - 1][acc.id] = currentBalance;
      }
    });

    return dailyData;
  }, [activeAccounts, selectedMonthYear]);

  const caption =
    selectedAccountId === "all"
      ? `Daily balance · ${selectedMonthYear}${
          accounts.length > SERIES_COLORS.length
            ? ` · accounts after the ${SERIES_COLORS.length}th in gray`
            : ""
        }`
      : `Daily balance · ${selectedMonthYear}`;

  return (
    <ReportPanel
      label="01 / Account balance trends"
      caption={caption}
      actions={
        loading ? null : (
          <ChartLegendPopover
            items={accounts.map((acc, index) => ({
              id: acc.id,
              label: acc.name,
              color: seriesColor(index),
            }))}
            selectedId={selectedAccountId}
            onSelect={setSelectedAccountId}
          />
        )
      }
    >
      {loading ? (
        <LoadingState
          message="Loading account trends..."
          variant="bar"
          className="my-auto"
        />
      ) : (
        <ChartContainer config={chartConfig} className="h-full min-h-64 w-full">
          <LineChart
            data={chartData}
            margin={{ top: 8, right: 8, left: 8, bottom: 0 }}
          >
            <CartesianGrid vertical={false} strokeDasharray="2 4" />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={72}
              tickFormatter={(value) => Number(value).toLocaleString()}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            {activeAccounts.map((acc) => (
              <Line
                key={acc.id}
                type="monotone"
                dataKey={acc.id}
                stroke={seriesColor(accounts.indexOf(acc))}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
                name={acc.name}
              />
            ))}
          </LineChart>
        </ChartContainer>
      )}
    </ReportPanel>
  );
}
