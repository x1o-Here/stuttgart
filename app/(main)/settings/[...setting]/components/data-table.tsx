"use client";

import {
  type ColumnDef,
  getCoreRowModel,
  getFilteredRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useState } from "react";
import { RuledTable, TableCaption } from "@/components/shared/ruled-table";
import { TruncatedText } from "@/components/shared/truncated-text";
import { Input } from "@/components/ui/input";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  entityLabel: string;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  entityLabel,
}: DataTableProps<TData, TValue>) {
  const [globalFilter, setGlobalFilter] = useState("");

  const table = useReactTable({
    defaultColumn: {
      cell: ({ getValue }) => (
        <TruncatedText>{String(getValue() ?? "")}</TruncatedText>
      ),
    },
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: "includesString",
    state: { globalFilter },
  });

  const lower = entityLabel.toLowerCase();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-col gap-3 px-4 py-3">
        <TableCaption
          label={`${entityLabel}s`}
          count={table.getFilteredRowModel().rows.length}
        />
        <Input
          placeholder="Search by name or short form"
          value={globalFilter}
          onChange={(event) => setGlobalFilter(event.target.value)}
        />
      </div>
      <RuledTable
        table={table}
        emptyMessage={
          globalFilter
            ? "Nothing matches this search."
            : `No ${lower}s yet. Add the first one from the header.`
        }
      />
    </div>
  );
}
