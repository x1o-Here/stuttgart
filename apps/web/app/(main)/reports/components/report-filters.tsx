"use client";

import { useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useReportFilter } from "@/contexts/report-filter-context";
import { useAccountsContext } from "@/contexts/useAccountsContext";

/** Page-level month + account filters shared by every report panel. */
export default function ReportFilters() {
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

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={selectedMonthYear} onValueChange={setSelectedMonthYear}>
        <SelectTrigger className="w-full bg-card sm:w-40" aria-label="Month">
          <SelectValue placeholder="Select month" />
        </SelectTrigger>
        <SelectContent position="popper" side="bottom">
          {monthOptions.map((opt) => (
            <SelectItem key={opt} value={opt}>
              {opt}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
        <SelectTrigger className="w-full bg-card sm:w-56" aria-label="Account">
          <SelectValue placeholder="Select account" />
        </SelectTrigger>
        <SelectContent position="popper" side="bottom">
          <SelectItem value="all">All accounts</SelectItem>
          {accounts.map((acc) => (
            <SelectItem key={acc.id} value={acc.id}>
              {acc.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
