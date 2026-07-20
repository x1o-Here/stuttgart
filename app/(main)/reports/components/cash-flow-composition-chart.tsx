"use client";

import { useMemo } from "react";
import { Cell, Pie, PieChart } from "recharts";
import { LoadingState } from "@/components/shared/loading-state";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { useReportFilter } from "@/contexts/report-filter-context";
import { useAccountsContext } from "@/contexts/useAccountsContext";

const chartConfig = {
  credits: { label: "Credits", color: "#10b981" },
  debits: { label: "Debits", color: "#f43f5e" },
} satisfies ChartConfig;

export default function CashFlowCompositionChart() {
  const { accounts, loading } = useAccountsContext();
  const { selectedMonthYear, selectedAccountId } = useReportFilter();

  const data = useMemo(() => {
    const [monthStr, yearStr] = selectedMonthYear.split(" ");
    const monthIndex = new Date(`${monthStr} 1, ${yearStr}`).getMonth();
    const year = Number.parseInt(yearStr, 10);

    const scoped =
      selectedAccountId === "all"
        ? accounts
        : accounts.filter((account) => account.id === selectedAccountId);

    let credits = 0;
    let debits = 0;

    for (const account of scoped) {
      for (const tx of account.transactions) {
        const txDate = new Date(tx.date);
        if (
          txDate.getMonth() !== monthIndex ||
          txDate.getFullYear() !== year
        ) {
          continue;
        }
        if (tx.type === "credit") credits += tx.amount;
        else debits += tx.amount;
      }
    }

    return [
      { key: "credits", name: "Credits", value: credits },
      { key: "debits", name: "Debits", value: debits },
    ].filter((item) => item.value > 0);
  }, [accounts, selectedAccountId, selectedMonthYear]);

  if (loading) {
    return (
      <div className="flex h-full flex-col rounded-xl bg-white p-6">
        <LoadingState message="Loading composition..." variant="compact" />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-72 flex-col rounded-xl bg-white p-6">
      <div className="mb-4 border-b border-zinc-100 pb-3">
        <h3 className="font-semibold text-zinc-800">Cash Flow Composition</h3>
        <p className="text-xs text-zinc-500">
          Credits vs debits · {selectedMonthYear}
        </p>
      </div>

      {data.length ? (
        <ChartContainer config={chartConfig} className="min-h-0 flex-1 w-full">
          <PieChart>
            <ChartTooltip content={<ChartTooltipContent />} />
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={50}
              outerRadius={85}
            >
              {data.map((entry) => (
                <Cell
                  key={entry.key}
                  fill={
                    entry.key === "credits"
                      ? "var(--color-credits)"
                      : "var(--color-debits)"
                  }
                />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
      ) : (
        <div className="flex flex-1 items-center justify-center text-sm text-zinc-500">
          No cash flow for this period.
        </div>
      )}
    </div>
  );
}
