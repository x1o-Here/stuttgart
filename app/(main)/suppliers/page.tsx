"use client";

import {
  type ColumnDef,
  getCoreRowModel,
  getFilteredRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { LoadingState } from "@/components/shared/loading-state";
import { HeaderFigure, PageHeader } from "@/components/shared/page-header";
import { RuledTable, TableCaption } from "@/components/shared/ruled-table";
import { TruncatedText } from "@/components/shared/truncated-text";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useSupplierInvoiceStats, useSuppliers } from "@/hooks/use-suppliers";
import type { Supplier } from "@/lib/suppliers/supplier-model";
import AddSupplierDialog from "./components/add-supplier-dialog";

type SupplierRow = Supplier & { openInvoices: number; outstanding: number };

const money = (value: number) =>
  value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const columns: ColumnDef<SupplierRow>[] = [
  {
    id: "name",
    accessorFn: (row) => `${row.name} ${row.tin}`,
    header: "Supplier",
    size: 260,
    cell: ({ row }) => (
      <div className="flex min-w-0 flex-col">
        <TruncatedText className="font-medium text-foreground">
          {row.original.name}
        </TruncatedText>
        {row.original.tin ? (
          <TruncatedText className="font-mono text-xs text-muted-foreground">
            TIN {row.original.tin}
          </TruncatedText>
        ) : null}
      </div>
    ),
  },
  {
    accessorKey: "supplierType",
    header: "Type",
    size: 140,
    cell: ({ row }) =>
      row.original.supplierType ? (
        <Badge variant="neutral" className="max-w-full">
          <TruncatedText>{row.original.supplierType}</TruncatedText>
        </Badge>
      ) : (
        <span className="text-muted-foreground">–</span>
      ),
  },
  {
    accessorKey: "contactNo",
    header: "Contact",
    size: 140,
    cell: ({ row }) => (
      <TruncatedText className="font-mono text-xs">
        {row.original.contactNo || "–"}
      </TruncatedText>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    size: 100,
    cell: ({ row }) => {
      const active = row.original.status === "active";
      return (
        <Badge variant={active ? "success" : "neutral"}>
          {active ? "Active" : "Inactive"}
        </Badge>
      );
    },
  },
  {
    accessorKey: "openInvoices",
    header: () => <div className="text-right">Open invoices</div>,
    size: 120,
    enableGlobalFilter: false,
    cell: ({ row }) => (
      <div className="text-right font-mono tabular-nums">
        {row.original.openInvoices}
      </div>
    ),
  },
  {
    accessorKey: "outstanding",
    header: () => <div className="text-right">Outstanding (LKR)</div>,
    size: 160,
    enableGlobalFilter: false,
    cell: ({ row }) => (
      <div className="text-right font-mono tabular-nums text-foreground">
        {money(row.original.outstanding)}
      </div>
    ),
  },
  {
    id: "open",
    header: () => <span className="sr-only">Open</span>,
    size: 48,
    cell: ({ row }) => (
      <Link
        href={`/suppliers/${row.original.id}`}
        aria-label={`Open ${row.original.name}`}
        onClick={(e) => e.stopPropagation()}
        className="flex justify-end text-muted-foreground hover:text-foreground"
      >
        <ArrowUpRight className="size-4" />
      </Link>
    ),
  },
];

export default function SuppliersPage() {
  const router = useRouter();
  const { suppliers, loading } = useSuppliers();
  const stats = useSupplierInvoiceStats(suppliers.map((s) => s.id));
  const [search, setSearch] = useState("");

  const rows = useMemo<SupplierRow[]>(
    () =>
      suppliers.map((supplier) => ({
        ...supplier,
        openInvoices: stats[supplier.id]?.openInvoices ?? 0,
        outstanding: stats[supplier.id]?.outstanding ?? 0,
      })),
    [suppliers, stats],
  );
  const totalOutstanding = rows.reduce((sum, row) => sum + row.outstanding, 0);
  const activeCount = rows.filter((row) => row.status === "active").length;

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onGlobalFilterChange: setSearch,
    globalFilterFn: "includesString",
    state: { globalFilter: search },
  });

  return (
    <div className="flex h-full flex-col divide-y bg-card font-sans">
      <PageHeader
        eyebrow="( Purchasing · Suppliers )"
        lead="Suppliers and"
        title="payables."
        description={
          loading
            ? "Loading suppliers…"
            : `${activeCount} active · ${rows.length} in total`
        }
        actions={
          <>
            <HeaderFigure
              label="( Outstanding )"
              unit="LKR"
              value={money(totalOutstanding)}
            />
            <AddSupplierDialog />
          </>
        }
      />

      {loading ? (
        <div className="p-4">
          <LoadingState
            message="Loading suppliers..."
            variant="skeleton"
            rows={5}
          />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex shrink-0 flex-col gap-3 px-4 py-3">
            <TableCaption
              label="Supplier register"
              count={table.getFilteredRowModel().rows.length}
            />
            <Input
              placeholder="Search by name, TIN, type or contact"
              aria-label="Search suppliers"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <RuledTable
            table={table}
            emptyMessage={
              rows.length
                ? "No suppliers match this search."
                : "No suppliers yet. Add the first one from the header."
            }
            onRowClick={(supplier) => router.push(`/suppliers/${supplier.id}`)}
          />
        </div>
      )}
    </div>
  );
}
