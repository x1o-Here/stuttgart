"use client";

import { Badge } from "@/components/ui/badge";
import type { ClientInvoiceDocument } from "../../../invoice-model";
import {
  outstandingFromPayments,
  roundMoney,
} from "../../../invoice-model";

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

function statusLabel(status: ClientInvoiceDocument["status"]) {
  if (status === "paid") return "Complete";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

type InvoiceSummaryCardProps = {
  invoice: ClientInvoiceDocument;
  /** Sum of active payments for this invoice. */
  paidAmount?: number;
};

export default function InvoiceSummaryCard({
  invoice,
  paidAmount = 0,
}: InvoiceSummaryCardProps) {
  const outstanding =
    invoice.status === "paid"
      ? 0
      : outstandingFromPayments(invoice.totalIncludingVat, paidAmount);
  const isComplete = outstanding <= 0 && roundMoney(invoice.totalIncludingVat) > 0;

  return (
    <div className="rounded-lg bg-white p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Invoice</h1>
          <p className="text-sm text-muted-foreground">
            {invoice.taxInvoiceNo || "Untitled"}
          </p>
        </div>
        <Badge variant={statusVariant(invoice.status)}>
          {statusLabel(invoice.status)}
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
            {formatMoney(outstanding)}
          </dd>
          {isComplete ? (
            <Badge className="mt-2" variant="default">
              Complete
            </Badge>
          ) : null}
        </div>
      </dl>
    </div>
  );
}
