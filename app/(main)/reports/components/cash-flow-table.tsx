"use client";

import { useMemo } from "react";
import { LoadingState } from "@/components/shared/loading-state";
import { TruncatedText } from "@/components/shared/truncated-text";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useReportFilter } from "@/contexts/report-filter-context";
import { useAccountsContext } from "@/contexts/useAccountsContext";
import { seriesColor } from "./report-colors";
import { ReportPanel, reportTd, reportTh } from "./report-panel";

export default function CashFlowTable() {
  const { accounts, loading } = useAccountsContext();
  const { selectedMonthYear, selectedAccountId, setSelectedAccountId } =
    useReportFilter();

  const cashFlows = useMemo(() => {
    const [monthStr, yearStr] = selectedMonthYear.split(" ");
    const monthIndex = new Date(`${monthStr} 1, ${yearStr}`).getMonth();
    const year = parseInt(yearStr);

    return accounts.map((acc) => {
      let credits = 0;
      let debits = 0;

      acc.transactions.forEach((tx) => {
        const txDate = new Date(tx.date);
        if (txDate.getMonth() === monthIndex && txDate.getFullYear() === year) {
          if (tx.type === "credit") {
            credits += tx.amount;
          } else {
            debits += tx.amount;
          }
        }
      });

      return {
        id: acc.id,
        name: acc.name,
        credits,
        debits,
      };
    });
  }, [accounts, selectedMonthYear]);

  return (
    <ReportPanel
      label="03 / Monthly cash flow"
      caption={selectedMonthYear}
      bodyClassName="p-0"
    >
      {loading ? (
        <LoadingState
          message="Loading cash flow..."
          variant="compact"
          className="flex-1"
        />
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto border-t">
          <Table className="table-fixed">
            <TableHeader className="sticky top-0 z-10 bg-surface-muted">
              <TableRow className="hover:bg-transparent">
                <TableHead className={`w-8 ${reportTh}`} />
                <TableHead className={reportTh}>Account</TableHead>
                <TableHead className={`w-28 text-right ${reportTh}`}>
                  Debits
                </TableHead>
                <TableHead className={`w-28 text-right ${reportTh}`}>
                  Credits
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cashFlows.map((item, index) => {
                const isSelected =
                  selectedAccountId === "all" || selectedAccountId === item.id;
                const select = () =>
                  setSelectedAccountId(
                    selectedAccountId === item.id ? "all" : item.id,
                  );
                return (
                  <TableRow
                    key={item.id}
                    tabIndex={0}
                    aria-selected={selectedAccountId === item.id}
                    className={`cursor-pointer transition-opacity hover:bg-surface-muted focus-visible:bg-surface-muted focus-visible:outline-none ${
                      isSelected ? "" : "opacity-40"
                    }`}
                    onClick={select}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        select();
                      }
                    }}
                  >
                    <TableCell className={`w-8 ${reportTd}`}>
                      <span
                        className="block size-2.5 rounded-full"
                        style={{ backgroundColor: seriesColor(index) }}
                      />
                    </TableCell>
                    <TableCell
                      className={`overflow-hidden font-medium text-foreground ${reportTd}`}
                    >
                      <TruncatedText>{item.name}</TruncatedText>
                    </TableCell>
                    <TableCell
                      className={`w-28 text-right font-mono tabular-nums ${reportTd} ${
                        item.debits > 0
                          ? "text-destructive"
                          : "text-muted-foreground"
                      }`}
                    >
                      {item.debits > 0
                        ? `−${item.debits.toLocaleString()}`
                        : "0"}
                    </TableCell>
                    <TableCell
                      className={`w-28 text-right font-mono tabular-nums ${reportTd} ${
                        item.credits > 0
                          ? "text-success"
                          : "text-muted-foreground"
                      }`}
                    >
                      {item.credits > 0
                        ? `+${item.credits.toLocaleString()}`
                        : "0"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </ReportPanel>
  );
}
