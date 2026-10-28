"use client";

import {
  type SortOption,
  SortPopover,
} from "@/components/shared/transactions-sort-popover";

interface InvoicesSortPopoverProps {
  onSortChange: (column: string, direction: "asc" | "desc") => void;
}

const INVOICE_SORT_OPTIONS: readonly SortOption[] = [
  { label: "Date · newest first", column: "date", direction: "desc" },
  { label: "Date · oldest first", column: "date", direction: "asc" },
  { label: "Total · high to low", column: "totalAmount", direction: "desc" },
  { label: "Total · low to high", column: "totalAmount", direction: "asc" },
  {
    label: "Outstanding · high to low",
    column: "outstandingAmount",
    direction: "desc",
  },
  {
    label: "Outstanding · low to high",
    column: "outstandingAmount",
    direction: "asc",
  },
];

export function InvoicesSortPopover({
  onSortChange,
}: InvoicesSortPopoverProps) {
  // Default order is open invoices first, then newest — no single option.
  return (
    <SortPopover
      onSortChange={onSortChange}
      options={INVOICE_SORT_OPTIONS}
      initialLabel={null}
    />
  );
}
