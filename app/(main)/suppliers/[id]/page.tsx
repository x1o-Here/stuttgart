"use client";

import {
  type ColumnDef,
  getCoreRowModel,
  getFilteredRowModel,
  type Row,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowUpRight, FilePlus2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { LoadingState } from "@/components/shared/loading-state";
import { HeaderFigure, PageHeader } from "@/components/shared/page-header";
import { RuledTable, TableCaption } from "@/components/shared/ruled-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSupplier, useSupplierInvoices } from "@/hooks/use-suppliers";
import {
  SUPPLIER_INVOICE_STATUS_META,
  type SupplierInvoice,
  type SupplierInvoiceStatus,
} from "@/lib/suppliers/supplier-model";
import ChangeSupplierStatusDialog from "./components/change-supplier-status-dialog";
import EditSupplierDialog from "./components/edit-supplier-dialog";

const money = (value: number) =>
  value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const invoiceSearch = (
  row: Row<SupplierInvoice>,
  _id: string,
  value: string,
) => {
  const q = value.trim().toLowerCase();
  if (!q) return true;
  return (
    row.original.taxInvoiceNo.toLowerCase().includes(q) ||
    String(row.original.totalIncludingVat).includes(q) ||
    row.original.lineItems.some((line) =>
      line.description.toLowerCase().includes(q),
    )
  );
};

export default function SupplierDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const supplierId = params.id;
  const { supplier, loading } = useSupplier(supplierId);
  const { invoices, loading: invoicesLoading } =
    useSupplierInvoices(supplierId);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | SupplierInvoiceStatus>("all");

  const filtered = useMemo(
    () =>
      status === "all"
        ? invoices
        : invoices.filter((invoice) => invoice.status === status),
    [invoices, status],
  );
  const outstanding = invoices.reduce(
    (sum, invoice) => sum + invoice.outstandingAmount,
    0,
  );

  const columns = useMemo<ColumnDef<SupplierInvoice>[]>(
    () => [
      {
        id: "date",
        header: "Date",
        size: 110,
        cell: ({ row }) => (
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {row.original.date.getTime()
              ? row.original.date.toLocaleDateString()
              : "–"}
          </span>
        ),
      },
      {
        accessorKey: "taxInvoiceNo",
        header: "Tax invoice no",
        size: 190,
        cell: ({ row }) => (
          <span className="font-mono text-foreground">
            {row.original.taxInvoiceNo}
          </span>
        ),
      },
      {
        id: "items",
        header: "Items",
        cell: ({ row }) => {
          const lines = row.original.lineItems;
          return (
            <span className="line-clamp-1 text-muted-foreground">
              {lines.length
                ? lines
                    .map((line) => `${line.description} × ${line.quantity}`)
                    .join(", ")
                : "–"}
            </span>
          );
        },
      },
      {
        accessorKey: "status",
        header: "Status",
        size: 110,
        cell: ({ row }) => {
          const meta = SUPPLIER_INVOICE_STATUS_META[row.original.status];
          return <Badge variant={meta.variant}>{meta.label}</Badge>;
        },
      },
      {
        accessorKey: "totalIncludingVat",
        header: () => <div className="text-right">Total (LKR)</div>,
        size: 140,
        cell: ({ row }) => (
          <div className="text-right font-mono tabular-nums">
            {money(row.original.totalIncludingVat)}
          </div>
        ),
      },
      {
        accessorKey: "outstandingAmount",
        header: () => <div className="text-right">Outstanding (LKR)</div>,
        size: 150,
        cell: ({ row }) => (
          <div
            className={`text-right font-mono tabular-nums ${
              row.original.outstandingAmount > 0
                ? "text-foreground"
                : "text-muted-foreground"
            }`}
          >
            {money(row.original.outstandingAmount)}
          </div>
        ),
      },
      {
        id: "open",
        header: () => <span className="sr-only">Open</span>,
        size: 48,
        cell: ({ row }) => (
          <Link
            href={`/suppliers/${supplierId}/invoices/${row.original.id}`}
            aria-label={`Open invoice ${row.original.taxInvoiceNo}`}
            onClick={(e) => e.stopPropagation()}
            className="flex justify-end text-muted-foreground hover:text-foreground"
          >
            <ArrowUpRight className="size-4" />
          </Link>
        ),
      },
    ],
    [supplierId],
  );

  const table = useReactTable({
    data: filtered,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onGlobalFilterChange: setSearch,
    globalFilterFn: invoiceSearch,
    state: { globalFilter: search },
  });

  if (loading) {
    return (
      <div className="h-full bg-card p-4 font-sans md:p-6">
        <LoadingState
          message="Loading supplier..."
          variant="skeleton"
          rows={4}
        />
      </div>
    );
  }

  if (!supplier) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-card p-6 text-center font-sans">
        <span className="eyebrow">( Not found )</span>
        <p className="heading text-2xl">
          <span className="text-muted-foreground">This supplier</span> doesn’t
          exist.
        </p>
        <Link
          href="/suppliers"
          className="font-mono text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          Back to suppliers
        </Link>
      </div>
    );
  }

  const active = supplier.status === "active";
  const facts = [
    {
      label: "01 / Status",
      value: (
        <Badge variant={active ? "success" : "neutral"}>
          {active ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      label: "02 / TIN",
      value: <span className="font-mono">{supplier.tin || "–"}</span>,
    },
    {
      label: "03 / Supplier type",
      value: supplier.supplierType ? (
        <Badge variant="neutral">{supplier.supplierType}</Badge>
      ) : (
        "–"
      ),
    },
    {
      label: "04 / Contact",
      value: <span className="font-mono">{supplier.contactNo || "–"}</span>,
    },
    {
      label: "05 / Address",
      value: (
        <span className="whitespace-pre-wrap">{supplier.address || "–"}</span>
      ),
    },
  ];

  return (
    <div className="flex h-full flex-col divide-y overflow-y-auto bg-card font-sans">
      <PageHeader
        back={{ href: "/suppliers", label: "Suppliers" }}
        eyebrow={`( Suppliers · ${supplier.supplierType || "Supplier record"} )`}
        title={supplier.name}
        description={supplier.tin ? `TIN ${supplier.tin}` : undefined}
        actions={
          <>
            <HeaderFigure
              label="( Outstanding )"
              unit="LKR"
              value={money(outstanding)}
            />
            <Button asChild>
              <Link href={`/suppliers/${supplier.id}/invoices/new`}>
                <FilePlus2 />
                Submit invoice
              </Link>
            </Button>
          </>
        }
      />

      <dl className="grid gap-px bg-border sm:grid-cols-2 xl:grid-cols-5">
        {facts.map((fact) => (
          <div
            key={fact.label}
            className="flex min-w-0 flex-col gap-2 bg-card px-5 py-4"
          >
            <dt className="eyebrow normal-case tracking-normal">
              {fact.label}
            </dt>
            <dd className="min-w-0 text-sm text-foreground">{fact.value}</dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-wrap items-center gap-2 px-4 py-3">
        <EditSupplierDialog supplier={supplier} />
        <ChangeSupplierStatusDialog supplier={supplier} />
      </div>

      <div className="flex min-h-[24rem] flex-1 flex-col">
        <div className="flex shrink-0 flex-col gap-3 px-4 py-3">
          <TableCaption
            label="Invoices"
            count={table.getFilteredRowModel().rows.length}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="Search by tax invoice no, item or amount"
              aria-label="Search invoices"
              className="min-w-48 flex-1"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Select
              value={status}
              onValueChange={(value) =>
                setStatus(value as "all" | SupplierInvoiceStatus)
              }
            >
              <SelectTrigger
                className="w-full bg-card sm:w-40"
                aria-label="Status"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper" side="bottom">
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="issued">Unpaid</SelectItem>
                <SelectItem value="partial">Partly paid</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {invoicesLoading ? (
          <div className="p-4">
            <LoadingState
              message="Loading invoices..."
              variant="skeleton"
              rows={4}
            />
          </div>
        ) : (
          <RuledTable
            table={table}
            emptyMessage={
              invoices.length
                ? "No invoices match these filters."
                : "No invoices yet. Submit the first one from the header."
            }
            onRowClick={(invoice) =>
              router.push(`/suppliers/${supplier.id}/invoices/${invoice.id}`)
            }
          />
        )}
      </div>
    </div>
  );
}
