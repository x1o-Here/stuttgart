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
import { ReportPanel, reportTd, reportTh } from "./report-panel";

export default function DepartmentActivityTable() {
  const { accounts, loading } = useAccountsContext();
  const { selectedMonthYear, selectedAccountId } = useReportFilter();

  const rows = useMemo(() => {
    const [monthStr, yearStr] = selectedMonthYear.split(" ");
    const monthIndex = new Date(`${monthStr} 1, ${yearStr}`).getMonth();
    const year = Number.parseInt(yearStr, 10);

    const scoped =
      selectedAccountId === "all"
        ? accounts
        : accounts.filter((account) => account.id === selectedAccountId);

    const map = new Map<
      string,
      { credits: number; debits: number; count: number }
    >();

    for (const account of scoped) {
      for (const tx of account.transactions) {
        const txDate = new Date(tx.date);
        if (txDate.getMonth() !== monthIndex || txDate.getFullYear() !== year) {
          continue;
        }
        const department = tx.department?.trim() || "Unassigned";
        const current = map.get(department) ?? {
          credits: 0,
          debits: 0,
          count: 0,
        };
        current.count += 1;
        if (tx.type === "credit") current.credits += tx.amount;
        else current.debits += tx.amount;
        map.set(department, current);
      }
    }

    return Array.from(map.entries())
      .map(([department, value]) => ({
        department,
        credits: value.credits,
        debits: value.debits,
        net: value.credits - value.debits,
        count: value.count,
      }))
      .sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
  }, [accounts, selectedAccountId, selectedMonthYear]);

  return (
    <ReportPanel
      className="min-h-80"
      label="08 / Department activity"
      caption={selectedMonthYear}
      bodyClassName="p-0"
    >
      {loading ? (
        <LoadingState
          message="Loading departments..."
          variant="compact"
          className="flex-1"
        />
      ) : (
        <div className="min-h-0 flex-1 overflow-auto border-t">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-surface-muted">
              <TableRow className="hover:bg-transparent">
                <TableHead className={reportTh}>Department</TableHead>
                <TableHead className={`text-right ${reportTh}`}>Txns</TableHead>
                <TableHead className={`text-right ${reportTh}`}>
                  Debits
                </TableHead>
                <TableHead className={`text-right ${reportTh}`}>
                  Credits
                </TableHead>
                <TableHead className={`text-right ${reportTh}`}>Net</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length ? (
                rows.map((row) => (
                  <TableRow
                    key={row.department}
                    className="hover:bg-surface-muted"
                  >
                    <TableCell
                      className={`font-medium text-foreground ${reportTd}`}
                    >
                      <TruncatedText className="max-w-[180px]">
                        {row.department}
                      </TruncatedText>
                    </TableCell>
                    <TableCell
                      className={`text-right font-mono tabular-nums ${reportTd}`}
                    >
                      {row.count}
                    </TableCell>
                    <TableCell
                      className={`text-right font-mono tabular-nums ${reportTd} ${row.debits > 0 ? "text-destructive" : "text-muted-foreground"}`}
                    >
                      {row.debits > 0 ? `−${row.debits.toLocaleString()}` : "0"}
                    </TableCell>
                    <TableCell
                      className={`text-right font-mono tabular-nums ${reportTd} ${row.credits > 0 ? "text-success" : "text-muted-foreground"}`}
                    >
                      {row.credits > 0
                        ? `+${row.credits.toLocaleString()}`
                        : "0"}
                    </TableCell>
                    <TableCell
                      className={`text-right font-mono tabular-nums text-foreground ${reportTd}`}
                    >
                      {`${row.net >= 0 ? "+" : "−"}${Math.abs(row.net).toLocaleString()}`}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow className="hover:bg-transparent">
                  <TableCell
                    colSpan={5}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No department activity for this period.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </ReportPanel>
  );
}
