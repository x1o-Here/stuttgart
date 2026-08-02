"use client";

import type { Table } from "@tanstack/react-table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ClientInvoice, InvoiceStatus } from "./invoices-columns";

const STATUS_OPTIONS: { value: InvoiceStatus | "all"; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "issued", label: "Issued" },
  { value: "paid", label: "Complete" },
  { value: "partial", label: "Partial" },
  { value: "overdue", label: "Overdue" },
  { value: "cancelled", label: "Cancelled" },
];

type InvoicesStatusFilterProps = {
  table: Table<ClientInvoice>;
};

export default function InvoicesStatusFilter({
  table,
}: InvoicesStatusFilterProps) {
  const column = table.getColumn("status");
  const value = (column?.getFilterValue() as string | undefined) ?? "all";

  return (
    <Select
      value={value}
      onValueChange={(next) => {
        if (next === "all") {
          column?.setFilterValue(undefined);
        } else {
          column?.setFilterValue(next);
        }
      }}
    >
      <SelectTrigger className="w-40 shrink-0">
        <SelectValue placeholder="Status" />
      </SelectTrigger>
      <SelectContent>
        {STATUS_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
