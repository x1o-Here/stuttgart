"use client";

import {
  type ColumnDef,
  type ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  type Row,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ClientSnapshot, InvoiceTemplate } from "../invoice-model";
import CreateInvoiceDialog from "./create-invoice-dialog";
import type { ClientInvoice } from "./invoices-columns";
import { InvoicesSortPopover } from "./invoices-sort-popover";
import InvoicesStatusFilter from "./invoices-status-filter";

interface InvoicesTableProps {
  columns: ColumnDef<ClientInvoice>[];
  data: ClientInvoice[];
  client: ClientSnapshot;
  template: InvoiceTemplate | null;
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

export default function InvoicesTable({
  columns,
  data,
  client,
  template,
}: InvoicesTableProps) {
  const [search, setSearch] = useState("");
  const [sorting, setSorting] = useState<SortingState>([
    { id: "isActive", desc: true },
    { id: "date", desc: true },
  ]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [templateMessageOpen, setTemplateMessageOpen] = useState(false);

  const table = useReactTable({
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

  return (
    <div className="flex flex-col gap-4">
      <div className="w-full flex items-center justify-between gap-6 shrink-0">
        <div className="w-full flex items-center gap-2 min-w-0">
          <InvoicesSortPopover
            onSortChange={(column, direction) => {
              setSorting([{ id: column, desc: direction === "desc" }]);
            }}
          />

          <Input
            placeholder="Search by invoice no or amount..."
            className="w-full min-w-0"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <InvoicesStatusFilter table={table} />
        </div>

        {template ? (
          <CreateInvoiceDialog client={client} template={template} />
        ) : (
          <Popover
            open={templateMessageOpen}
            onOpenChange={setTemplateMessageOpen}
          >
            <PopoverTrigger asChild>
              <Button
                type="button"
                className="shrink-0 opacity-50"
                aria-disabled="true"
              >
                <Plus className="mr-2 h-4 w-4" />
                Create Invoice
              </Button>
            </PopoverTrigger>
            <PopoverContent
              side="bottom"
              align="end"
              className="w-72 space-y-3 text-sm"
            >
              <p>An invoice template should exist to create an invoice.</p>
              <Button asChild size="sm" className="w-full">
                <Link href={`/clients/${client.id}/template`}>
                  Create Template
                </Link>
              </Button>
            </PopoverContent>
          </Popover>
        )}
      </div>

      <div className="rounded-md border overflow-auto">
        <Table className="table-fixed w-full border-separate border-spacing-0">
          <TableHeader className="sticky top-0 bg-white z-10 shadow-sm">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow
                key={headerGroup.id}
                className="bg-white hover:bg-white"
              >
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="border-l border-gray-100 first:border-l-0"
                    style={{ width: `${header.getSize()}px` }}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="text-gray-600"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className="border-l border-b border-gray-100 first:border-l-0"
                      style={{ width: `${cell.column.getSize()}px` }}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-gray-600"
                >
                  No invoices yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
