"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toDate } from "@/lib/helpers/to-date";

export type InvoiceStatus = "draft" | "issued" | "paid" | "partial" | "overdue" | "cancelled";

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
  return amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function statusVariant(status: InvoiceStatus) {
  switch (status) {
    case "paid":
      return "default" as const;
    case "overdue":
    case "cancelled":
      return "destructive" as const;
    default:
      return "secondary" as const;
  }
}

function statusLabel(status: InvoiceStatus) {
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
      cell: ({ row }) => {
        const date = toDate(row.original.date);
        return date ? date.toLocaleDateString() : "—";
      },
    },
    {
      accessorKey: "taxInvoiceNo",
      header: "Tax Invoice No",
    },
    {
      accessorKey: "totalAmount",
      header: "Total Amount",
      cell: ({ row }) => formatAmount(row.original.totalAmount || 0),
    },
    {
      accessorKey: "outstandingAmount",
      header: "Outstanding Amount",
      cell: ({ row }) => formatAmount(row.original.outstandingAmount || 0),
    },
    {
      accessorKey: "status",
      header: "Invoice Status",
      cell: ({ row }) => (
        <Badge variant={statusVariant(row.original.status)}>
          {statusLabel(row.original.status)}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      size: 100,
      cell: ({ row }) => (
        <Button asChild variant="outline" size="sm">
          <Link href={`/clients/${clientId}/invoices/${row.original.id}`}>
            View
          </Link>
        </Button>
      ),
    },
  ];
}
