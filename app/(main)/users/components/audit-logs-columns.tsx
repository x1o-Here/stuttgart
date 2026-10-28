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

function actionVariant(action?: string) {
  switch (action) {
    case "create":
      return "success" as const;
    case "update":
      return "brand" as const;
    case "delete":
      return "danger" as const;
    default:
      return "neutral" as const;
  }
}

export const auditLogsColumns: ColumnDef<AuditLogRow>[] = [
  {
    id: "createdAt",
    accessorFn: (row) => row.createdAt?.getTime() ?? 0,
    header: "When",
    size: 170,
    cell: ({ row }) => (
      <span className="font-mono text-xs tabular-nums text-muted-foreground">
        {row.original.createdAt ? row.original.createdAt.toLocaleString() : "–"}
      </span>
    ),
  },
  {
    accessorKey: "action",
    header: "Action",
    size: 100,
    cell: ({ row }) => (
      <Badge
        variant={actionVariant(row.original.action)}
        className="capitalize"
      >
        {row.original.action || "–"}
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
      <span className="block whitespace-normal text-foreground">
        {row.original.description || "–"}
      </span>
    ),
  },
  {
    id: "user",
    accessorFn: (row) => row.username || row.userId,
    header: "User",
    cell: ({ row }) => (
      <div className="flex min-w-0 flex-col">
        <TruncatedText className="font-medium text-foreground">
          {row.original.username || "–"}
        </TruncatedText>
        {row.original.userId ? (
          <TruncatedText className="font-mono text-[11px] text-muted-foreground">
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
      <div className="flex min-w-0 flex-col">
        <TruncatedText className="font-medium text-foreground">
          {row.original.companyName || "–"}
        </TruncatedText>
        {row.original.companyId ? (
          <TruncatedText className="font-mono text-[11px] text-muted-foreground">
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
        <TruncatedText className="font-mono text-xs">
          {row.original.transactionId}
        </TruncatedText>
      ) : (
        <span className="text-muted-foreground">–</span>
      ),
  },
  {
    accessorKey: "entityStatus",
    header: "Status",
    size: 100,
    cell: ({ row }) => (
      <Badge variant={row.original.entityStatus ? "success" : "neutral"}>
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
