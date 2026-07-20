"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import type { CompanyRecord } from "@/lib/companies/types";
import { CompanyActions } from "./company-actions";

export type { CompanyRecord };

export function getCompaniesColumns(
  onChanged?: () => void,
): ColumnDef<CompanyRecord>[] {
  return [
    {
      accessorKey: "name",
      header: "Company name",
    },
    {
      accessorKey: "address",
      header: "Address",
      cell: ({ row }) => (
        <span className="line-clamp-2 whitespace-normal">
          {row.original.address || "—"}
        </span>
      ),
    },
    {
      accessorKey: "telephoneNo",
      header: "Telephone",
      cell: ({ row }) => row.original.telephoneNo || "—",
    },
    {
      accessorKey: "tin",
      header: "TIN",
      cell: ({ row }) => row.original.tin || "—",
    },
    {
      accessorKey: "entityStatus",
      header: "Status",
      size: 110,
      cell: ({ row }) => {
        const active = row.original.entityStatus;
        return (
          <Badge variant={active ? "default" : "secondary"}>
            {active ? "Active" : "Inactive"}
          </Badge>
        );
      },
    },
    {
      id: "actions",
      header: "Actions",
      size: 80,
      cell: ({ row }) => (
        <CompanyActions company={row.original} onChanged={onChanged} />
      ),
    },
  ];
}
