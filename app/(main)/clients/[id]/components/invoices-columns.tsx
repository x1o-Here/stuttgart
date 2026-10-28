"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { TruncatedText } from "@/components/shared/truncated-text";
import { Badge } from "@/components/ui/badge";
import { toDate } from "@/lib/helpers/to-date";

export type InvoiceStatus =
  | "draft"
  | "issued"
  | "paid"
  | "partial"
  | "overdue"
  | "cancelled";

export type ClientInvoice = {
  id: string;
  date: Date;
  taxInvoiceNo: string;
  totalAmount: number;
  outstandingAmount: number;
  status: InvoiceStatus;
  /** Open/unsettled invoices sort above closed ones. */
  isActive: boolean;
};

export function isActiveInvoiceStatus(status: InvoiceStatus): boolean {
  return status !== "paid" && status !== "cancelled";
}

function formatAmount(amount: number) {
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function invoiceStatusVariant(status: InvoiceStatus) {
  switch (status) {
    case "paid":
      return "success" as const;
    case "partial":
      return "warning" as const;
    case "overdue":
      return "danger" as const;
    case "issued":
      return "brand" as const;
    default:
      return "neutral" as const;
  }
}

export function invoiceStatusLabel(status: InvoiceStatus) {
  if (status === "paid") return "Complete";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function getInvoicesColumns(
  clientId: string,
): ColumnDef<ClientInvoice>[] {
  return [
    {
      accessorKey: "isActive",
      header: "Active",
      enableHiding: true,
    },
    {
      accessorKey: "date",
      header: "Date",
      size: 110,
      cell: ({ row }) => {
        const date = toDate(row.original.date);
        return (
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {date ? date.toLocaleDateString() : "–"}
          </span>
        );
      },
    },
    {
      accessorKey: "taxInvoiceNo",
      header: "Tax invoice no",
      cell: ({ row }) => (
        <TruncatedText className="font-mono text-foreground">
          {row.original.taxInvoiceNo}
        </TruncatedText>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      size: 110,
      cell: ({ row }) => (
        <Badge variant={invoiceStatusVariant(row.original.status)}>
          {invoiceStatusLabel(row.original.status)}
        </Badge>
      ),
    },
    {
      accessorKey: "totalAmount",
      header: () => <div className="text-right">Total (LKR)</div>,
      cell: ({ row }) => (
        <TruncatedText className="block text-right font-mono tabular-nums">
          {formatAmount(row.original.totalAmount || 0)}
        </TruncatedText>
      ),
    },
    {
      accessorKey: "outstandingAmount",
      header: () => <div className="text-right">Outstanding (LKR)</div>,
      cell: ({ row }) => {
        const amount = row.original.outstandingAmount || 0;
        return (
          <TruncatedText
            className={`block text-right font-mono tabular-nums ${
              amount > 0 ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            {formatAmount(amount)}
          </TruncatedText>
        );
      },
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Open</span>,
      size: 48,
      cell: ({ row }) => (
        <Link
          href={`/clients/${clientId}/invoices/${row.original.id}`}
          aria-label={`Open invoice ${row.original.taxInvoiceNo}`}
          onClick={(e) => e.stopPropagation()}
          className="flex justify-end text-muted-foreground hover:text-foreground"
        >
          <ArrowUpRight className="size-4" />
        </Link>
      ),
    },
  ];
}
