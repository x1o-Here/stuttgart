"use client";

import { Badge } from "@/components/ui/badge";
import type { ClientInvoiceDocument } from "../../../invoice-model";
import { roundMoney } from "../../../invoice-model";

function formatMoney(value: number) {
  return roundMoney(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function statusVariant(status: ClientInvoiceDocument["status"]) {
  switch (status) {
    case "paid":
      return "default" as const;
    case "overdue":
    case "cancelled":
      return "destructive" as const;
    default:
      return "secondary" as const;
  }
}

type InvoiceSummaryCardProps = {
  invoice: ClientInvoiceDocument;
};

export default function InvoiceSummaryCard({ invoice }: InvoiceSummaryCardProps) {
  return (
    <div className="rounded-lg bg-white p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Invoice</h1>
          <p className="text-sm text-muted-foreground">
            {invoice.taxInvoiceNo || "Untitled"}
          </p>
        </div>
        <Badge variant={statusVariant(invoice.status)} className="capitalize">
          {invoice.status}
        </Badge>
      </div>

      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <dt className="text-sm text-muted-foreground">Tax invoice no</dt>
          <dd className="font-medium">{invoice.taxInvoiceNo || "—"}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Date of invoice</dt>
          <dd className="font-medium">
            {invoice.date.getTime()
              ? invoice.date.toLocaleDateString()
              : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Purchaser name</dt>
          <dd className="font-medium">{invoice.client.name || "—"}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Total value of supply</dt>
          <dd className="font-medium tabular-nums">
            {formatMoney(invoice.totalAmount)}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">VAT amount</dt>
          <dd className="font-medium tabular-nums">
            {formatMoney(invoice.vatAmount)}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">
            Total amount including VAT
          </dt>
          <dd className="font-medium tabular-nums">
            {formatMoney(invoice.totalIncludingVat)}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Outstanding amount</dt>
          <dd className="font-medium tabular-nums">
            {formatMoney(invoice.outstandingAmount)}
          </dd>
        </div>
      </dl>
    </div>
  );
}
