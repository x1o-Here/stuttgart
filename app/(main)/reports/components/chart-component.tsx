"use client";

import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useReportFilter } from "@/contexts/report-filter-context";
import { useAccountsContext } from "@/contexts/useAccountsContext";

// indigo-500, emerald-500, rose-500, amber-500, sky-500, violet-500, pink-500, cyan-500
export const LINE_COLORS = [
  "#6366f1",
  "#10b981",
  "#f43f5e",
  "#f59e0b",
  "#0ea5e9",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
];

export default function ChartComponent() {
  const { accounts } = useAccountsContext();
  const {
    selectedMonthYear,
    setSelectedMonthYear,
    selectedAccountId,
    setSelectedAccountId,
  } = useReportFilter();

  // Derive unique months from all transactions across all accounts
  const monthOptions = useMemo(() => {
    const months = new Set<string>();
    accounts.forEach((acc) => {
      acc.transactions.forEach((tx) => {
        const date = new Date(tx.date);
        months.add(
          date.toLocaleString("default", { month: "short", year: "numeric" }),
        );
      });
    });

    // Ensure current month is always an option
    const now = new Date();
    months.add(
      now.toLocaleString("default", { month: "short", year: "numeric" }),
    );

    return Array.from(months).sort((a, b) => {
      const dateA = new Date(a);
      const dateB = new Date(b);
      return dateB.getTime() - dateA.getTime();
    });
  }, [accounts]);

  // Determine which accounts to display
  const activeAccounts = useMemo(() => {
    if (selectedAccountId === "all") return accounts;
    return accounts.filter((acc) => acc.id === selectedAccountId);
  }, [accounts, selectedAccountId]);

  // Generate chart configuration dynamically for labels and colors
  const chartConfig = useMemo(() => {
    const config: any = {};
    activeAccounts.forEach((acc, index) => {
      config[acc.id] = {
        label: acc.name,
        color: LINE_COLORS[index % LINE_COLORS.length],
      };
    });
    return config;
  }, [activeAccounts]);

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

  return (
    <div className="h-full w-full flex flex-col p-6">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-xl font-bold text-zinc-800">Account Balance Trends</h2>
        <div className="flex gap-3">
          <Select value={selectedMonthYear} onValueChange={setSelectedMonthYear}>
            <SelectTrigger className="w-[140px] bg-white border-zinc-200">
              <SelectValue placeholder="Select month" />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
            <SelectTrigger className="w-[180px] bg-white border-zinc-200">
              <SelectValue placeholder="Select account" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Accounts</SelectItem>
              {accounts.map((acc) => (
                <SelectItem key={acc.id} value={acc.id}>
                  {acc.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex-1 min-h-[400px]">
        <ChartContainer config={chartConfig} className="h-full w-full">
          <LineChart
            data={chartData}
            margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
          >
            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={10}
              tick={{ fill: "#6b7280", fontSize: 12 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={10}
              tick={{ fill: "#6b7280", fontSize: 12 }}
              tickFormatter={(value) => `Rs ${value.toLocaleString()}`}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            {activeAccounts.map((acc, index) => (
              <Line
                key={acc.id}
                type="monotone"
                dataKey={acc.id}
                stroke={LINE_COLORS[index % LINE_COLORS.length]}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
                name={acc.name}
              />
            ))}
          </LineChart>
        </ChartContainer>
      </div>
    </div>
  );
}
