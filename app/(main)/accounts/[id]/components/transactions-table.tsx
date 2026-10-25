"use client";

import {
  type ColumnDef,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { CircleX } from "lucide-react";
import { useState } from "react";
import { RuledTable, TableCaption } from "@/components/shared/ruled-table";
import { TransactionTypeFilterSelect } from "@/components/shared/transaction-type-filter-select";
import { TransactionsSortPopover } from "@/components/shared/transactions-sort-popover";
import { TruncatedText } from "@/components/shared/truncated-text";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
        <TableCaption
          label="Ledger"
          count={table.getFilteredRowModel().rows.length}
        />
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
            placeholder="Search by description or amount"
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

          <Button variant="ghost" onClick={() => setColumnFilters([])}>
            <CircleX />
            Clear
          </Button>
        </div>
      </div>

      <RuledTable
        table={table}
        emptyMessage="No transactions match these filters."
      />
    </div>
  );
}
