"use client";

import {
  type ColumnDef,
  getCoreRowModel,
  getFilteredRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { RuledTable, TableCaption } from "@/components/shared/ruled-table";
import { TruncatedText } from "@/components/shared/truncated-text";
import { Input } from "@/components/ui/input";
import type { Client } from "./clients-columns";

interface DataTableProps<TValue> {
  columns: ColumnDef<Client, TValue>[];
  data: Client[];
}

export default function ClientsDataTable<TValue>({
  columns,
  data,
}: DataTableProps<TValue>) {
  const router = useRouter();
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
    state: {
      globalFilter,
    },
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-col gap-3 px-4 py-3">
        <TableCaption
          label="Client register"
          count={table.getFilteredRowModel().rows.length}
        />
        <Input
          placeholder="Search by name, VAT number or contact"
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
        />
      </div>

      <RuledTable
        table={table}
        emptyMessage="No clients match this search."
        onRowClick={(client) => router.push(`/clients/${client.id}`)}
      />
    </div>
  );
}
