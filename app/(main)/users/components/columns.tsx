"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { CompanyChips } from "@/components/shared/company-chips";
import { TruncatedText } from "@/components/shared/truncated-text";
import { Badge } from "@/components/ui/badge";

import { UserActions } from "./user-actions";

export type UserData = {
  id: string;
  username: string;
  email: string;
  role: string;
  companies: string[];
  /** Company names resolved from ids, same order as `companies`. */
  companyNames?: string[];
  createdAt?: any;
};

function roleVariant(role: string) {
  if (role === "admin") return "brand" as const;
  if (role === "manager") return "warning" as const;
  return "neutral" as const;
}

export const columns: ColumnDef<UserData>[] = [
  {
    id: "username",
    // Searchable text covers both the name and the email shown beneath it.
    accessorFn: (row) => `${row.username} ${row.email}`,
    header: "User",
    cell: ({ row }) => (
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-surface-muted font-mono text-[11px] uppercase text-muted-foreground ring-1 ring-inset ring-border">
          {row.original.username.slice(0, 2)}
        </span>
        <div className="flex min-w-0 flex-col">
          <TruncatedText className="font-medium text-foreground">
            {row.original.username}
          </TruncatedText>
          <TruncatedText className="font-mono text-xs text-muted-foreground">
            {row.original.email}
          </TruncatedText>
        </div>
      </div>
    ),
  },
  {
    accessorKey: "role",
    header: "Role",
    size: 110,
    cell: ({ row }) => {
      const role = row.getValue("role") as string;
      return (
        <Badge variant={roleVariant(role)} className="capitalize">
          {role}
        </Badge>
      );
    },
  },
  {
    id: "companies",
    // Search by company name, not id.
    accessorFn: (row) => (row.companyNames ?? row.companies).join(" "),
    header: "Companies",
    cell: ({ row }) => {
      const names = row.original.companyNames ?? row.original.companies;
      return (
        <CompanyChips
          companies={row.original.companies.map((id, index) => ({
            id,
            name: names[index] ?? id,
          }))}
          max={3}
        />
      );
    },
  },
  {
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    size: 56,
    cell: ({ row }) => (
      <div className="flex justify-end">
        <UserActions user={row.original} />
      </div>
    ),
  },
];
