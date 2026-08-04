"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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
    size: 300,
  },
  {
    accessorKey: "status",
    header: "Status",
    size: 110,
    cell: ({ row }) => {
      const status = row.original.status;
      return (
        <Badge variant={status === "active" ? "default" : "secondary"}>
          {status === "active" ? "Active" : "Inactive"}
        </Badge>
      );
    },
  },
  {
    accessorKey: "activeInvoiceCount",
    header: "Active Invoices",
    size: 120,
  },
  {
    accessorKey: "outstandingInvoiceAmount",
    header: "Outstanding",
    cell: ({ row }) => {
      const amount = row.original.outstandingInvoiceAmount || 0;
      return amount.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    },
  },
  {
    id: "actions",
    header: "Actions",
    size: 100,
    cell: ({ row }) => (
      <Button asChild variant="outline" size="sm">
        <Link href={`/clients/${row.original.id}`}>View</Link>
      </Button>
    ),
  },
];
