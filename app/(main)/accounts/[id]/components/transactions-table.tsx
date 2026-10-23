"use client";

import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { CircleX } from "lucide-react";
import { useState } from "react";
import { TransactionTypeFilterSelect } from "@/components/shared/transaction-type-filter-select";
import { TransactionsSortPopover } from "@/components/shared/transactions-sort-popover";
import { TruncatedText } from "@/components/shared/truncated-text";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TransactionsTagFilter } from "../../../components/logistics/transactions-tag-filter";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
}

const fuzzyFilter = (row: any, _columnId: string, value: string) => {
  const searchValue = value.toLowerCase();

  return Object.values(row.original).some((cellValue) => {
    if (cellValue === undefined || cellValue === null) return false;

    // Dates
    if (cellValue instanceof Date) {
      return cellValue.toLocaleDateString().toLowerCase().includes(searchValue);
    }

    // Numbers
    if (typeof cellValue === "number") {
      return cellValue.toString().includes(searchValue);
    }

    // Strings
    if (typeof cellValue === "string") {
      return cellValue.toLowerCase().includes(searchValue);
    }

    return false;
  });
};

const transactionTypeFilter = (row: any, columnId: string, value: string) => {
  if (!value || value === "all") return true;
  return row.getValue(columnId) === value;
};

export function TransactionsDataTable<TData, TValue>({
  columns,
  data,
}: DataTableProps<TData, TValue>) {
  const [search, setSearch] = useState("");
  const [sorting, setSorting] = useState([
    { id: "date", desc: true },
    { id: "createdAt", desc: true },
  ]);
  const [columnFilters, setColumnFilters] = useState<
    { id: string; value: any }[]
  >([]);

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
      sorting: sorting,
      columnFilters: columnFilters,
      columnVisibility: {
        createdAt: false,
        tags: false,
      },
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onGlobalFilterChange: setSearch,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    globalFilterFn: fuzzyFilter,
    filterFns: {
      transactionType: transactionTypeFilter,
    },
  });

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex shrink-0 flex-col gap-3 px-4 py-3">
        <div className="flex items-baseline gap-3">
          <span className="eyebrow normal-case tracking-normal">Ledger</span>
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {table.getFilteredRowModel().rows.length}
          </span>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2">
          <TransactionsSortPopover
            onSortChange={(column, direction) => {
              setSorting([
                { id: column, desc: direction === "desc" },
                { id: "createdAt", desc: true },
              ]);
            }}
          />

          <Input
            placeholder="Search by Description or Amount..."
            className="min-w-48 flex-1"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <TransactionTypeFilterSelect
            value={columnFilters.find((f) => f.id === "type")?.value ?? "all"}
            onChange={(value) => {
              if (value === "all") {
                setColumnFilters((prev) => prev.filter((f) => f.id !== "type"));
              } else {
                setColumnFilters((prev) => [
                  ...prev.filter((f) => f.id !== "type"),
                  { id: "type", value },
                ]);
              }
            }}
          />

          <TransactionsTagFilter table={table as unknown as any} />

          <Button
            variant="ghost"
            size="icon"
            aria-label="Clear filters"
            onClick={() => setColumnFilters([])}
          >
            <CircleX />
          </Button>
        </div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-auto border-t">
        <Table className="table-fixed w-full border-separate border-spacing-0">
          <TableHeader className="sticky top-0 z-10 bg-surface-muted">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow
                key={headerGroup.id}
                className="bg-surface-muted hover:bg-surface-muted"
              >
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="overflow-hidden border-b font-mono text-[11px] font-normal uppercase tracking-[0.08em] text-muted-foreground"
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
                  className="text-foreground/80 hover:bg-surface-muted"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className="overflow-hidden border-b py-3"
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
                  className="h-24 text-center text-muted-foreground"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
