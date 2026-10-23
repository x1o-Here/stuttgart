"use client";

import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useState } from "react";
import { TransactionsSortPopover } from "@/components/shared/transactions-sort-popover";
import { TruncatedText } from "@/components/shared/truncated-text";
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import TransactionsDepartmentFilter from "./transactions-department-filter";
import { TransactionsTagFilter } from "./transactions-tag-filter";
import TransactionsVehicleFilter from "./transactions-vehicle-filter";

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

export function DashboardTransactionsTable<TData, TValue>({
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
  >([{ id: "tags", value: ["active"] }]);
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  });

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
      pagination,
      columnVisibility: {
        createdAt: false,
        tags: false,
      },
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onGlobalFilterChange: setSearch,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onPaginationChange: setPagination,
    globalFilterFn: fuzzyFilter,
  });

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex flex-col gap-3 px-4 py-3 shrink-0">
        <div className="flex items-baseline justify-between gap-4">
          <div className="flex items-baseline gap-3">
            <span className="eyebrow normal-case tracking-normal">
              Transactions
            </span>
            <span className="font-mono text-xs tabular-nums text-muted-foreground">
              {table.getFilteredRowModel().rows.length}
            </span>
          </div>
        </div>
        <div className="w-full flex items-center justify-between gap-6 shrink-0">
          <div className="w-full flex flex-wrap items-center gap-2">
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

            <TransactionsDepartmentFilter table={table} />
            <TransactionsVehicleFilter table={table} />

            <TransactionsTagFilter table={table} />
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 border-t overflow-auto relative">
        <Table className="table-fixed w-full border-separate border-spacing-0">
          <TableHeader className="sticky top-0 bg-surface-muted z-10">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow
                key={headerGroup.id}
                className="bg-surface-muted hover:bg-surface-muted"
              >
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="overflow-hidden border-b font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground font-normal"
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

      <Pagination className="flex items-center justify-end border-t px-4 py-3">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              onClick={() => table.previousPage()}
              className={
                !table.getCanPreviousPage()
                  ? "pointer-events-none opacity-50"
                  : "cursor-pointer"
              }
            />
          </PaginationItem>

          {Array.from({ length: table.getPageCount() }, (_, i) => (
            <PaginationItem key={i}>
              <PaginationLink
                onClick={() => table.setPageIndex(i)}
                isActive={table.getState().pagination.pageIndex === i}
                className="cursor-pointer data-[active=true]:bg-primary data-[active=true]:text-primary-foreground data-[active=true]:border-primary"
              >
                {i + 1}
              </PaginationLink>
            </PaginationItem>
          ))}

          <PaginationItem>
            <PaginationNext
              onClick={() => table.nextPage()}
              className={
                !table.getCanNextPage()
                  ? "pointer-events-none opacity-50"
                  : "cursor-pointer"
              }
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}
