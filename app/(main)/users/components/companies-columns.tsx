"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { TruncatedText } from "@/components/shared/truncated-text";
import { Badge } from "@/components/ui/badge";
import type { CompanyRecord } from "@/lib/companies/types";
import { CompanyActions } from "./company-actions";

export type { CompanyRecord };

export function getCompaniesColumns(
  onChanged?: () => void,
): ColumnDef<CompanyRecord>[] {
  return [
    {
      id: "name",
      // Searchable text covers both the name and the TIN shown beneath it.
      accessorFn: (row) => `${row.name} ${row.tin ?? ""}`,
      header: "Company",
      cell: ({ row }) => (
        <div className="flex min-w-0 flex-col">
          <TruncatedText className="font-medium text-foreground">
            {row.original.name}
          </TruncatedText>
          {row.original.tin ? (
            <TruncatedText className="font-mono text-xs text-muted-foreground">
              TIN {row.original.tin}
            </TruncatedText>
          ) : null}
        </div>
      ),
    },
    {
      accessorKey: "address",
      header: "Address",
      cell: ({ row }) => (
        <span className="line-clamp-2 whitespace-normal text-muted-foreground">
          {row.original.address || "–"}
        </span>
      ),
    },
    {
      accessorKey: "telephoneNo",
      header: "Telephone",
      size: 150,
      cell: ({ row }) => (
        <span className="font-mono text-xs">
          {row.original.telephoneNo || "–"}
        </span>
      ),
    },
    {
      accessorKey: "entityStatus",
      header: "Status",
      size: 100,
      cell: ({ row }) => {
        const active = row.original.entityStatus;
        return (
          <Badge variant={active ? "success" : "neutral"}>
            {active ? "Active" : "Inactive"}
          </Badge>
        );
      },
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      size: 56,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <CompanyActions company={row.original} onChanged={onChanged} />
        </div>
      ),
    },
  ];
}
