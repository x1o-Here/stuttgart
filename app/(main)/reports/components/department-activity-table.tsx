"use client";

import { useMemo } from "react";
import { LoadingState } from "@/components/shared/loading-state";
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
        if (
          txDate.getMonth() !== monthIndex ||
          txDate.getFullYear() !== year
        ) {
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

  if (loading) {
    return (
      <div className="flex h-full flex-col rounded-xl bg-white p-6">
        <LoadingState message="Loading departments..." variant="compact" />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-72 flex-col rounded-xl bg-white p-6">
      <div className="mb-4 border-b border-zinc-100 pb-3">
        <h3 className="font-semibold text-zinc-800">Department Activity</h3>
        <p className="text-xs text-zinc-500">{selectedMonthYear}</p>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Department</TableHead>
              <TableHead className="text-right">Txns</TableHead>
              <TableHead className="text-right">Debits</TableHead>
              <TableHead className="text-right">Credits</TableHead>
              <TableHead className="text-right">Net</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length ? (
              rows.map((row) => (
                <TableRow key={row.department}>
                  <TableCell className="font-medium">{row.department}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.count}
                  </TableCell>
                  <TableCell className="text-right font-mono text-red-600 tabular-nums">
                    {row.debits > 0 ? `-${row.debits.toLocaleString()}` : "0"}
                  </TableCell>
                  <TableCell className="text-right font-mono text-emerald-600 tabular-nums">
                    {row.credits > 0 ? `+${row.credits.toLocaleString()}` : "0"}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {`${row.net >= 0 ? "+" : ""}${row.net.toLocaleString()}`}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="h-24 text-center text-zinc-500"
                >
                  No department activity for this period.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
