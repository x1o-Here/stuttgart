"use client";

import { useMemo } from "react";
import { useAccountsContext } from "@/contexts/useAccountsContext";
import { useReportFilter } from "@/contexts/report-filter-context";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LINE_COLORS } from "./chart-component";

export default function MonthEndBalanceTable() {
  const { accounts } = useAccountsContext();
  const { selectedMonthYear, selectedAccountId, setSelectedAccountId } = useReportFilter();

  const monthEndBalances = useMemo(() => {
    const [monthStr, yearStr] = selectedMonthYear.split(" ");
    const monthIndex = new Date(`${monthStr} 1, ${yearStr}`).getMonth();
    const year = parseInt(yearStr);
    const lastDayOfMonth = new Date(year, monthIndex + 1, 0);

    return accounts.map((acc) => {
      let balance = acc.initialBalance;
      acc.transactions.forEach((tx) => {
        const txDate = new Date(tx.date);
        if (txDate <= lastDayOfMonth) {
          balance += tx.type === "credit" ? tx.amount : -tx.amount;
        }
      });
      return {
        id: acc.id,
        name: acc.name,
        balance: balance,
      };
    });
  }, [accounts, selectedMonthYear]);

  return (
    <div className="bg-white rounded-xl overflow-hidden flex flex-col h-full p-6">
      <div className="border-b border-zinc-100 bg-zinc-50/50">
        <h3 className="font-semibold text-zinc-800">Month-End Balances</h3>
        <p className="text-xs text-zinc-500">{selectedMonthYear}</p>
      </div>
      <div className="flex-1 overflow-y-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10"></TableHead>
              <TableHead>Account</TableHead>
              <TableHead className="text-right">Balance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {monthEndBalances.map((item, index) => {
              const isSelected = selectedAccountId === "all" || selectedAccountId === item.id;
              return (
                <TableRow
                  key={item.id}
                  className={`${!isSelected ? "opacity-40 grayscale" : "hover:bg-zinc-50"} transition-all`}
                  onClick={() => setSelectedAccountId(item.id)}
                  style={{ cursor: "pointer" }}
                >
                  <TableCell>
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: LINE_COLORS[index % LINE_COLORS.length] }}
                    />
                  </TableCell>
                  <TableCell className="font-medium text-zinc-700">{item.name}</TableCell>
                  <TableCell className="text-right font-mono text-zinc-600">
                    {item.balance.toLocaleString()}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
