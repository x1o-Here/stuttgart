"use client";

import { useMemo } from "react";
import { Cell, Pie, PieChart } from "recharts";
import { LoadingState } from "@/components/shared/loading-state";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { useReportFilter } from "@/contexts/report-filter-context";
import { useAccountsContext } from "@/contexts/useAccountsContext";
import { FLOW_COLORS } from "./report-colors";
import { ReportPanel } from "./report-panel";

const chartConfig = {
  credits: { label: "Credits", color: FLOW_COLORS.credits },
  debits: { label: "Debits", color: FLOW_COLORS.debits },
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
        if (txDate.getMonth() !== monthIndex || txDate.getFullYear() !== year) {
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

  return (
    <ReportPanel
      className="min-h-80"
      label="05 / Cash flow composition"
      caption={`Credits vs debits · ${selectedMonthYear}`}
    >
      {loading ? (
        <LoadingState
          message="Loading composition..."
          variant="compact"
          className="flex-1"
        />
      ) : data.length ? (
        <ChartContainer config={chartConfig} className="min-h-56 w-full flex-1">
          <PieChart>
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent nameKey="key" />} />
            <Pie
              data={data}
              dataKey="value"
              nameKey="key"
              innerRadius={50}
              outerRadius={85}
              stroke="var(--card)"
              strokeWidth={2}
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
        <p className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          No cash flow for this period.
        </p>
      )}
    </ReportPanel>
  );
}
