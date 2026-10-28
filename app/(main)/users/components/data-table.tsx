"use client";

import {
  type ColumnDef,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useState } from "react";
import {
  RuledTable,
  TableCaption,
  TablePager,
} from "@/components/shared/ruled-table";
import { Input } from "@/components/ui/input";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  caption: string;
  searchPlaceholder: string;
  emptyMessage?: string;
}

/** Searchable, paginated ruled table used by the users and companies tabs. */
export function DataTable<TData, TValue>({
  columns,
  data,
  caption,
  searchPlaceholder,
  emptyMessage = "No results.",
}: DataTableProps<TData, TValue>) {
  const [globalFilter, setGlobalFilter] = useState("");
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  });

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    globalFilterFn: "includesString",
    state: {
      globalFilter,
      pagination,
    },
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-col gap-3 px-4 py-3">
        <TableCaption
          label={caption}
          count={table.getFilteredRowModel().rows.length}
        />
        <Input
          placeholder={searchPlaceholder}
          value={globalFilter}
          onChange={(event) => {
            setGlobalFilter(event.target.value);
            table.setPageIndex(0);
          }}
        />
      </div>
      <RuledTable
        table={table}
        emptyMessage={
          globalFilter ? "Nothing matches this search." : emptyMessage
        }
      />
      <TablePager table={table} />
    </div>
  );
}
