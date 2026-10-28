"use client";

import {
  type ColumnDef,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useMemo } from "react";
import { LoadingState } from "@/components/shared/loading-state";
import { RuledTable, TableCaption } from "@/components/shared/ruled-table";
import { Badge } from "@/components/ui/badge";
import { useVatLedger } from "@/hooks/use-vat-ledger";
import { VAT_RATE } from "@/lib/invoices/money";
import { taxQuarterOf } from "@/lib/vat/quarters";
import { VAT_STATUS_META, type VatQuarterRow } from "@/lib/vat/vat-summary";
import { RecordVatPaymentDialog } from "./record-vat-payment-dialog";
import { VatQuarterDialog } from "./vat-quarter-dialog";

const money = (value: number) =>
  value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const signed = (value: number) =>
  `${value < 0 ? "−" : ""}${money(Math.abs(value))}`;

function Tile({
  label,
  value,
  caption,
  tone,
}: {
  label: string;
  value: string;
  caption?: string;
  tone?: "default" | "warning" | "muted";
}) {
  return (
    <div className="flex min-w-0 flex-col gap-3 bg-card px-5 py-4">
      <span className="eyebrow normal-case tracking-normal">{label}</span>
      <p className="flex items-baseline gap-2">
        <span className="font-mono text-xs text-muted-foreground">LKR</span>
        <span
          className={`truncate font-mono text-2xl font-light tabular-nums ${
            tone === "warning"
              ? "text-warning"
              : tone === "muted"
                ? "text-muted-foreground"
                : "text-foreground"
          }`}
        >
          {value}
        </span>
      </p>
      {caption ? (
        <span className="text-xs text-muted-foreground">{caption}</span>
      ) : null}
    </div>
  );
}

/** Reports → VAT: quarterly output vs input VAT, payable and paid. */
export function VatTab() {
  const { rows, totals, loading } = useVatLedger();
  const currentKey = taxQuarterOf(new Date()).key;
  const current = rows.find((row) => row.quarter.key === currentKey);

  const columns = useMemo<ColumnDef<VatQuarterRow>[]>(
    () => [
      {
        id: "quarter",
        header: "Quarter",
        size: 190,
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium text-foreground">
              {row.original.quarter.label}
            </span>
            <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
              {row.original.quarter.startDate.toLocaleDateString()} –{" "}
              {row.original.quarter.endDate.toLocaleDateString()}
            </span>
          </div>
        ),
      },
      {
        id: "output",
        header: () => <div className="text-right">Outgoing VAT</div>,
        size: 140,
        cell: ({ row }) => (
          <div className="text-right font-mono tabular-nums">
            {money(row.original.outputVat)}
          </div>
        ),
      },
      {
        id: "input",
        header: () => <div className="text-right">Incoming VAT</div>,
        size: 140,
        cell: ({ row }) => (
          <div className="text-right font-mono tabular-nums">
            {money(row.original.inputVat)}
          </div>
        ),
      },
      {
        id: "due",
        header: () => <div className="text-right">Due VAT</div>,
        size: 140,
        cell: ({ row }) => (
          <div
            className={`text-right font-mono tabular-nums ${
              row.original.due < 0 ? "text-muted-foreground" : "text-foreground"
            }`}
          >
            {signed(row.original.due)}
          </div>
        ),
      },
      {
        id: "paid",
        header: () => <div className="text-right">Paid</div>,
        size: 130,
        cell: ({ row }) => (
          <div className="text-right font-mono tabular-nums text-muted-foreground">
            {money(row.original.paid)}
          </div>
        ),
      },
      {
        id: "balance",
        header: () => <div className="text-right">Balance</div>,
        size: 130,
        cell: ({ row }) => (
          <div
            className={`text-right font-mono tabular-nums ${
              row.original.balance > 0
                ? "text-foreground"
                : "text-muted-foreground"
            }`}
          >
            {money(row.original.balance)}
          </div>
        ),
      },
      {
        id: "status",
        header: "Status",
        size: 120,
        cell: ({ row }) => {
          const meta = VAT_STATUS_META[row.original.status];
          return <Badge variant={meta.variant}>{meta.label}</Badge>;
        },
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        size: 190,
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1">
            {row.original.balance > 0 && row.original.status !== "upcoming" && (
              <RecordVatPaymentDialog row={row.original} />
            )}
            <VatQuarterDialog row={row.original} />
          </div>
        ),
      },
    ],
    [],
  );

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (loading) {
    return (
      <div className="p-4">
        <LoadingState
          message="Calculating VAT..."
          variant="skeleton"
          rows={5}
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col divide-y">
      <div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        <Tile
          label={`01 / Outgoing VAT · ${current?.quarter.label ?? "this quarter"}`}
          value={money(current?.outputVat ?? 0)}
          caption={`${current?.outgoing.length ?? 0} client invoices`}
        />
        <Tile
          label="02 / Incoming VAT · this quarter"
          value={money(current?.inputVat ?? 0)}
          caption={`${current?.incoming.length ?? 0} supplier invoices`}
        />
        <Tile
          label="03 / Due VAT · this quarter"
          value={signed(current?.due ?? 0)}
          caption={
            (current?.due ?? 0) < 0
              ? "Refundable so far"
              : "Payable once the quarter ends"
          }
          tone={(current?.due ?? 0) < 0 ? "muted" : "default"}
        />
        <Tile
          label="04 / Payable outstanding"
          value={money(totals.payableOutstanding)}
          caption="Ended quarters not yet paid"
          tone={totals.payableOutstanding > 0 ? "warning" : "default"}
        />
        <Tile
          label="05 / VAT paid · this tax year"
          value={money(totals.paidThisYear)}
          caption="From 1 April"
        />
      </div>

      <div className="flex min-h-[20rem] flex-1 flex-col">
        <div className="flex flex-col gap-1 px-4 py-3">
          <TableCaption label="VAT by quarter" count={rows.length} />
          <p className="font-mono text-xs text-muted-foreground">
            Due VAT = Outgoing VAT − Incoming VAT · {Math.round(VAT_RATE * 100)}
            % · by invoice date · tax year from 1 April
          </p>
        </div>
        <RuledTable
          table={table}
          emptyMessage="No VAT activity yet. Client and supplier invoices appear here automatically."
        />
      </div>
    </div>
  );
}
