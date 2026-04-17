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

export default function CashFlowTable() {
  const { accounts } = useAccountsContext();
  const { selectedMonthYear, selectedAccountId, setSelectedAccountId } = useReportFilter();

  const cashFlows = useMemo(() => {
    const [monthStr, yearStr] = selectedMonthYear.split(" ");
    const monthIndex = new Date(`${monthStr} 1, ${yearStr}`).getMonth();
    const year = parseInt(yearStr);

    return accounts.map((acc) => {
      let credits = 0;
      let debits = 0;

      acc.transactions.forEach((tx) => {
        const txDate = new Date(tx.date);
        if (
          txDate.getMonth() === monthIndex &&
          txDate.getFullYear() === year
        ) {
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
    <div className="bg-white rounded-xl overflow-hidden flex flex-col h-full p-6">
      <div className="border-b border-zinc-100 pb-4 mb-4">
        <h3 className="font-semibold text-zinc-800">Monthly Cash Flow</h3>
        <p className="text-xs text-zinc-500">{selectedMonthYear}</p>
      </div>
      <div className="flex-1 overflow-y-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-8"></TableHead>
              <TableHead>Account</TableHead>
              <TableHead className="text-right">Debits</TableHead>
              <TableHead className="text-right">Credits</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cashFlows.map((item, index) => {
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
                      className="w-2.5 h-2.5 rounded-full" 
                      style={{ backgroundColor: LINE_COLORS[index % LINE_COLORS.length] }}
                    />
                  </TableCell>
                  <TableCell className="font-medium text-zinc-700 whitespace-nowrap">{item.name}</TableCell>
                  <TableCell className="text-right font-mono text-red-600">
                    {item.debits > 0 ? `-${item.debits.toLocaleString()}` : "0"}
                  </TableCell>
                  <TableCell className="text-right font-mono text-emerald-600">
                    {item.credits > 0 ? `+${item.credits.toLocaleString()}` : "0"}
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
