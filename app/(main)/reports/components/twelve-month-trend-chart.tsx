"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
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
  net: { label: "Net", color: FLOW_COLORS.net },
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

  return (
    <ReportPanel
      className="min-h-80"
      label="07 / 12-month cash flow"
      caption={"Credits, debits and net by month"}
    >
      {loading ? (
        <LoadingState
          message="Loading trend..."
          variant="compact"
          className="flex-1"
        />
      ) : (
        <ChartContainer config={chartConfig} className="min-h-56 w-full flex-1">
          <BarChart data={data} barGap={2}>
            <CartesianGrid vertical={false} strokeDasharray="2 4" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={64}
              tickFormatter={(value) => Number(value).toLocaleString()}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar
              dataKey="credits"
              fill="var(--color-credits)"
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey="debits"
              fill="var(--color-debits)"
              radius={[4, 4, 0, 0]}
            />
            <Bar dataKey="net" fill="var(--color-net)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartContainer>
      )}
    </ReportPanel>
  );
}
