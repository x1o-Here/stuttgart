"use client";

import { flexRender, type Table as TanstackTable } from "@tanstack/react-table";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type RuledTableProps<TData> = {
  table: TanstackTable<TData>;
  emptyMessage?: React.ReactNode;
  /** Makes rows clickable (e.g. open a record). */
  onRowClick?: (row: TData) => void;
  className?: string;
};

/**
 * Edge-to-edge table body for ruled pages: sticky mono header on
 * surface-muted, hairline rows, no vertical rules.
 */
export function RuledTable<TData>({
  table,
  emptyMessage = "No results.",
  onRowClick,
  className,
}: RuledTableProps<TData>) {
  const rows = table.getRowModel().rows;
  const columnCount = table.getVisibleLeafColumns().length;

  return (
    <div
      className={cn(
        "relative min-h-0 flex-1 overflow-auto border-t",
        className,
      )}
    >
      <Table className="w-full table-fixed border-separate border-spacing-0">
        <TableHeader className="sticky top-0 z-10 bg-surface-muted">
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow
              key={headerGroup.id}
              className="bg-surface-muted hover:bg-surface-muted"
            >
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className="overflow-hidden border-b font-mono text-[11px] font-normal uppercase tracking-[0.08em] text-muted-foreground first:pl-4 last:pr-4"
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
          {rows.length ? (
            rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() && "selected"}
                className={cn(
                  "text-foreground/80 hover:bg-surface-muted",
                  onRowClick && "cursor-pointer",
                )}
                onClick={
                  onRowClick ? () => onRowClick(row.original) : undefined
                }
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    className="overflow-hidden border-b py-3 first:pl-4 last:pr-4"
                    style={{ width: `${cell.column.getSize()}px` }}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow className="hover:bg-transparent">
              <TableCell
                colSpan={columnCount}
                className="h-24 text-center text-muted-foreground"
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

/** Small caption row above a ruled table: label + live count. */
export function TableCaption({
  label,
  count,
}: {
  label: React.ReactNode;
  count?: number;
}) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="eyebrow normal-case tracking-normal">{label}</span>
      {count !== undefined && (
        <span className="font-mono text-xs tabular-nums text-muted-foreground">
          {count}
        </span>
      )}
    </div>
  );
}

/** Footer row for paginated ruled tables: count + previous / next. */
export function TablePager<TData>({ table }: { table: TanstackTable<TData> }) {
  const pageCount = Math.max(table.getPageCount(), 1);
  const page = table.getState().pagination.pageIndex + 1;
  const total = table.getFilteredRowModel().rows.length;

  return (
    <div className="flex shrink-0 items-center justify-between gap-3 border-t px-4 py-3">
      <p className="font-mono text-xs tabular-nums text-muted-foreground">
        Page {page} of {pageCount} · {total} {total === 1 ? "row" : "rows"}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          <ChevronLeft />
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          Next
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}
