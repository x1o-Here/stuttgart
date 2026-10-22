"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { TruncatedText } from "@/components/shared/truncated-text";
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
          <TruncatedText className="max-w-[160px] text-xs text-muted-foreground">
            {row.original.userId}
          </TruncatedText>
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
          <TruncatedText className="max-w-[160px] text-xs text-muted-foreground">
            {row.original.companyId}
          </TruncatedText>
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
        <TruncatedText className="max-w-[140px] font-mono text-xs">
          {row.original.transactionId}
        </TruncatedText>
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
