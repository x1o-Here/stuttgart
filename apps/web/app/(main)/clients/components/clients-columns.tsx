"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { TruncatedText } from "@/components/shared/truncated-text";
import { Badge } from "@/components/ui/badge";
export type ClientStatus = "active" | "inactive";

export type Client = {
  id: string;
  name: string;
  address: string;
  vatNo: string;
  contactNo: string;
  status: ClientStatus;
  activeInvoiceCount: number;
  outstandingInvoiceAmount: number;
};

export const clientsColumns: ColumnDef<Client>[] = [
  {
    accessorKey: "name",
    header: "Name",
    size: 280,
    cell: ({ row }) => (
      <div className="flex min-w-0 flex-col">
        <TruncatedText className="font-medium text-foreground">
          {row.original.name}
        </TruncatedText>
        {row.original.vatNo && (
          <TruncatedText className="font-mono text-xs text-muted-foreground">
            VAT {row.original.vatNo}
          </TruncatedText>
        )}
      </div>
    ),
  },
  {
    accessorKey: "contactNo",
    header: "Contact",
    size: 140,
    cell: ({ row }) => (
      <TruncatedText className="font-mono text-xs tabular-nums">
        {row.original.contactNo || "–"}
      </TruncatedText>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    size: 100,
    cell: ({ row }) => {
      const active = row.original.status === "active";
      return (
        <Badge variant={active ? "success" : "neutral"}>
          {active ? "Active" : "Inactive"}
        </Badge>
      );
    },
  },
  {
    accessorKey: "activeInvoiceCount",
    header: () => <div className="text-right">Open invoices</div>,
    size: 120,
    cell: ({ row }) => (
      <div className="text-right font-mono tabular-nums">
        {row.original.activeInvoiceCount}
      </div>
    ),
  },
  {
    accessorKey: "outstandingInvoiceAmount",
    header: () => <div className="text-right">Outstanding (LKR)</div>,
    size: 160,
    cell: ({ row }) => {
      const amount = row.original.outstandingInvoiceAmount || 0;
      return (
        <TruncatedText className="block text-right font-mono tabular-nums text-foreground">
          {amount.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
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
        href={`/clients/${row.original.id}`}
        aria-label={`Open ${row.original.name}`}
        onClick={(e) => e.stopPropagation()}
        className="flex justify-end text-muted-foreground hover:text-foreground"
      >
        <ArrowUpRight className="size-4" />
      </Link>
    ),
  },
];
