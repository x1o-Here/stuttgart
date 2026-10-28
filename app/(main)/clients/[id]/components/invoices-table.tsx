"use client";

import {
  type ColumnDef,
  type ColumnFiltersState,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  type Row,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { RuledTable, TableCaption } from "@/components/shared/ruled-table";
import { TruncatedText } from "@/components/shared/truncated-text";
import { Input } from "@/components/ui/input";
import type { ClientInvoice } from "./invoices-columns";
import { InvoicesSortPopover } from "./invoices-sort-popover";
import InvoicesStatusFilter from "./invoices-status-filter";

interface InvoicesTableProps {
  columns: ColumnDef<ClientInvoice>[];
  data: ClientInvoice[];
}

const fuzzyFilter = (
  row: Row<ClientInvoice>,
  _columnId: string,
  value: string,
) => {
  const searchValue = value.toLowerCase();

  return Object.values(row.original).some((cellValue) => {
    if (cellValue === undefined || cellValue === null) return false;

    if (cellValue instanceof Date) {
      return cellValue.toLocaleDateString().toLowerCase().includes(searchValue);
    }

    if (typeof cellValue === "number") {
      return cellValue.toString().includes(searchValue);
    }

    if (typeof cellValue === "string") {
      return cellValue.toLowerCase().includes(searchValue);
    }

    if (typeof cellValue === "boolean") {
      return false;
    }

    return false;
  });
};

export default function InvoicesTable({ columns, data }: InvoicesTableProps) {
  const router = useRouter();
  const { id: clientId } = useParams<{ id: string }>();
  const [search, setSearch] = useState("");
  const [sorting, setSorting] = useState<SortingState>([
    { id: "isActive", desc: true },
    { id: "date", desc: true },
  ]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const table = useReactTable({
    defaultColumn: {
      cell: ({ getValue }) => (
        <TruncatedText>{String(getValue() ?? "")}</TruncatedText>
      ),
    },
    data,
    columns,
    state: {
      globalFilter: search,
      sorting,
      columnFilters,
      columnVisibility: {
        isActive: false,
      },
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onGlobalFilterChange: setSearch,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    globalFilterFn: fuzzyFilter,
  });

  const outstanding = data.reduce(
    (sum, invoice) => sum + (invoice.outstandingAmount || 0),
    0,
  );

  return (
    <div className="flex min-h-[24rem] flex-1 flex-col">
      <div className="flex shrink-0 flex-col gap-3 px-4 py-3">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <TableCaption
            label="Invoices"
            count={table.getFilteredRowModel().rows.length}
          />
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            Outstanding LKR{" "}
            <span className="text-foreground">
              {outstanding.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <InvoicesSortPopover
            onSortChange={(column, direction) => {
              setSorting([{ id: column, desc: direction === "desc" }]);
            }}
          />
          <Input
            placeholder="Search by invoice no or amount"
            className="min-w-48 flex-1"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <InvoicesStatusFilter table={table} />
        </div>
      </div>

      <RuledTable
        table={table}
        emptyMessage="No invoices yet. Create the first one from the header."
        onRowClick={(invoice) =>
          router.push(`/clients/${clientId}/invoices/${invoice.id}`)
        }
      />
    </div>
  );
}
