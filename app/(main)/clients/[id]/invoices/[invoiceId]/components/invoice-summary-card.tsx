"use client";

import type * as React from "react";
import type { ClientInvoiceDocument } from "../../../invoice-model";
import { outstandingFromPayments, roundMoney } from "../../../invoice-model";

function formatMoney(value: number) {
  return roundMoney(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

type InvoiceSummaryCardProps = {
  invoice: ClientInvoiceDocument;
  /** Sum of active payments for this invoice. */
  paidAmount?: number;
};

function Money({ value, strong }: { value: number; strong?: boolean }) {
  return (
    <span className="flex items-baseline gap-2">
      <span className="font-mono text-xs text-muted-foreground">LKR</span>
      <span
        className={`font-mono tabular-nums ${
          strong ? "text-2xl font-light text-foreground" : "text-base"
        }`}
      >
        {formatMoney(value)}
      </span>
    </span>
  );
}

/** Ruled facts grid summarising an invoice's figures. */
export default function InvoiceSummaryCard({
  invoice,
  paidAmount = 0,
}: InvoiceSummaryCardProps) {
  const outstanding =
    invoice.status === "paid"
      ? 0
      : outstandingFromPayments(invoice.totalIncludingVat, paidAmount);

  const facts: { label: string; value: React.ReactNode }[] = [
    {
      label: "01 / Purchaser",
      value: <span>{invoice.client.name || "–"}</span>,
    },
    {
      label: "02 / Value of supply",
      value: <Money value={invoice.totalAmount} />,
    },
    { label: "03 / VAT", value: <Money value={invoice.vatAmount} /> },
    {
      label: "04 / Total incl. VAT",
      value: <Money value={invoice.totalIncludingVat} />,
    },
    { label: "05 / Paid", value: <Money value={paidAmount} /> },
    {
      label: "06 / Outstanding",
      value: <Money value={outstanding} strong />,
    },
  ];

  return (
    <dl className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
      {facts.map((fact) => (
        <div
          key={fact.label}
          className="flex min-w-0 flex-col gap-2 bg-card px-5 py-4"
        >
          <dt className="eyebrow normal-case tracking-normal">{fact.label}</dt>
          <dd className="min-w-0 text-sm text-foreground">{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}
