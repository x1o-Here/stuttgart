"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";

export type AuditLogRow = {
  id: string;
  action: string;
  description: string;
  companyId: string;
  companyName: string;
  userId: string;
  username: string;
  transactionId: string;
  entityStatus: boolean;
  createdAt: Date | null;
};

export const auditLogsColumns: ColumnDef<AuditLogRow>[] = [
  {
    id: "createdAt",
    accessorFn: (row) => row.createdAt?.getTime() ?? 0,
    header: "Date",
    cell: ({ row }) =>
      row.original.createdAt
        ? row.original.createdAt.toLocaleString()
        : "—",
  },
  {
    accessorKey: "action",
    header: "Action",
    cell: ({ row }) => (
      <Badge variant="secondary" className="capitalize">
        {row.original.action || "—"}
      </Badge>
    ),
    filterFn: (row, _id, value: string) => {
      if (!value || value === "all") return true;
      return row.original.action === value;
    },
  },
  {
    accessorKey: "description",
    header: "Description",
    cell: ({ row }) => (
      <span className="block max-w-md whitespace-normal">
        {row.original.description || "—"}
      </span>
    ),
  },
  {
    id: "user",
    accessorFn: (row) => row.username || row.userId,
    header: "User",
    cell: ({ row }) => (
      <div className="min-w-28">
        <p className="font-medium">{row.original.username || "—"}</p>
        {row.original.userId ? (
          <p className="text-xs text-muted-foreground truncate max-w-[160px]">
            {row.original.userId}
          </p>
        ) : null}
      </div>
    ),
    filterFn: (row, _id, value: string) => {
      if (!value || value === "all") return true;
      return row.original.userId === value;
    },
  },
  {
    id: "company",
    accessorFn: (row) => row.companyName || row.companyId,
    header: "Company",
    cell: ({ row }) => (
      <div className="min-w-28">
        <p className="font-medium">{row.original.companyName || "—"}</p>
        {row.original.companyId ? (
          <p className="text-xs text-muted-foreground truncate max-w-[160px]">
            {row.original.companyId}
          </p>
        ) : null}
      </div>
    ),
    filterFn: (row, _id, value: string) => {
      if (!value || value === "all") return true;
      return row.original.companyId === value;
    },
  },
  {
    accessorKey: "transactionId",
    header: "Transaction",
    cell: ({ row }) =>
      row.original.transactionId ? (
        <span className="font-mono text-xs">{row.original.transactionId}</span>
      ) : (
        "—"
      ),
  },
  {
    accessorKey: "entityStatus",
    header: "Status",
    cell: ({ row }) => (
      <Badge variant={row.original.entityStatus ? "default" : "secondary"}>
        {row.original.entityStatus ? "Active" : "Inactive"}
      </Badge>
    ),
    filterFn: (row, _id, value: string) => {
      if (!value || value === "all") return true;
      if (value === "active") return row.original.entityStatus;
      if (value === "inactive") return !row.original.entityStatus;
      return true;
    },
  },
];
