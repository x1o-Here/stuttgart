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
import { useMemo, useState } from "react";
import CalendarPopover from "@/components/shared/calendar-popover";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  ClientInvoiceDocument,
  InvoicePayment,
} from "../../../invoice-model";
import {
  outstandingFromPayments,
  roundMoney,
} from "../../../invoice-model";
import DeleteInvoicePaymentDialog from "./delete-invoice-payment-dialog";
import InvoicePaymentDialog from "./invoice-payment-dialog";

function formatMoney(value: number) {
  return roundMoney(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const fuzzyFilter = (
  row: Row<InvoicePayment>,
  _columnId: string,
  value: string,
) => {
  const search = value.toLowerCase();
  return [
    row.original.description,
    row.original.chequeNo,
    row.original.creditingAccountName,
    String(row.original.amount),
  ]
    .join(" ")
    .toLowerCase()
    .includes(search);
};

type InvoicePaymentsTableProps = {
  clientId: string;
  invoice: ClientInvoiceDocument;
  payments: InvoicePayment[];
};

export default function InvoicePaymentsTable({
  clientId,
  invoice,
  payments,
}: InvoicePaymentsTableProps) {
  const [search, setSearch] = useState("");
  const [sorting, setSorting] = useState<SortingState>([
    { id: "date", desc: true },
  ]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [amountFilter, setAmountFilter] = useState<"all" | "large" | "small">(
    "all",
  );
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const paidTotal = useMemo(
    () =>
      roundMoney(payments.reduce((sum, payment) => sum + payment.amount, 0)),
    [payments],
  );
  const outstandingAmount =
    invoice.status === "paid"
      ? 0
      : outstandingFromPayments(invoice.totalIncludingVat, paidTotal);
  const locked = invoice.status === "paid" || invoice.status === "cancelled";

  const columns = useMemo<ColumnDef<InvoicePayment>[]>(
    () => [
      {
        id: "date",
        accessorFn: (row) => row.date,
        header: "Date",
        cell: ({ row }) =>
          row.original.date.getTime()
            ? row.original.date.toLocaleDateString()
            : "—",
      },
      {
        id: "description",
        accessorFn: (row) => row.description,
        header: "Description",
        cell: ({ row }) => (
          <span className="block min-w-40 whitespace-normal">
            {row.original.description?.trim() || "—"}
          </span>
        ),
      },
      {
        id: "chequeNo",
        accessorFn: (row) => row.chequeNo,
        header: "Cheque no",
        cell: ({ row }) => row.original.chequeNo || "—",
      },
      {
        id: "amount",
        accessorFn: (row) => row.amount,
        header: "Amount",
        cell: ({ row }) => formatMoney(row.original.amount),
      },
      {
        id: "creditingAccountName",
        accessorFn: (row) => row.creditingAccountName,
        header: "Crediting account",
        cell: ({ row }) => (
          <span className="block min-w-32 whitespace-normal">
            {row.original.creditingAccountName?.trim() || "—"}
          </span>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <div className="flex flex-wrap items-center gap-2">
            <InvoicePaymentDialog
              clientId={clientId}
              invoice={invoice}
              payment={row.original}
              outstandingAmount={outstandingAmount}
              disabled={locked}
            />
            <DeleteInvoicePaymentDialog
              clientId={clientId}
              invoice={invoice}
              payment={row.original}
              outstandingAmount={outstandingAmount}
              disabled={locked}
            />
          </div>
        ),
      },
    ],
    [clientId, invoice, locked, outstandingAmount],
  );

  const filteredData = useMemo(() => {
    const mid = roundMoney(invoice.totalIncludingVat / 2);
    return payments.filter((payment) => {
      if (amountFilter === "large" && payment.amount < mid) return false;
      if (amountFilter === "small" && payment.amount >= mid) return false;
      if (dateFrom) {
        const from = new Date(dateFrom);
        from.setHours(0, 0, 0, 0);
        if (payment.date.getTime() < from.getTime()) return false;
      }
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        if (payment.date.getTime() > to.getTime()) return false;
      }
      return true;
    });
  }, [amountFilter, dateFrom, dateTo, invoice.totalIncludingVat, payments]);

  const table = useReactTable({
    data: filteredData,
    columns,
    state: {
      globalFilter: search,
      sorting,
      columnFilters,
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <Input
            placeholder="Search description, cheque no, account..."
            className="min-w-0 flex-1"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <div className="w-44" aria-label="From date">
            <CalendarPopover value={dateFrom} onChange={setDateFrom} />
          </div>
          <div className="w-44" aria-label="To date">
            <CalendarPopover value={dateTo} onChange={setDateTo} />
          </div>
          <Select
            value={amountFilter}
            onValueChange={(value: "all" | "large" | "small") =>
              setAmountFilter(value)
            }
          >
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Amount filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All amounts</SelectItem>
              <SelectItem value="large">Half or more</SelectItem>
              <SelectItem value="small">Under half</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <InvoicePaymentDialog
          clientId={clientId}
          invoice={invoice}
          outstandingAmount={outstandingAmount}
          disabled={locked || outstandingAmount <= 0}
        />
      </div>

      <div className="overflow-auto rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
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
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
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
                  No payments recorded yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
