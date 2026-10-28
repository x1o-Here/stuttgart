"use client";

import { Pencil } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type * as React from "react";
import { LoadingState } from "@/components/shared/loading-state";
import { PageHeader } from "@/components/shared/page-header";
import { TableCaption } from "@/components/shared/ruled-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useSupplier,
  useSupplierInvoice,
  useSupplierPayments,
} from "@/hooks/use-suppliers";
import { roundMoney, VAT_RATE } from "@/lib/invoices/money";
import { SUPPLIER_INVOICE_STATUS_META } from "@/lib/suppliers/supplier-model";
import { DeleteSupplierInvoiceDialog } from "./components/delete-supplier-invoice-dialog";
import { DeleteSupplierPaymentDialog } from "./components/delete-supplier-payment-dialog";
import { SupplierPaymentDialog } from "./components/supplier-payment-dialog";

const money = (value: number) =>
  value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const TH =
  "font-mono text-[11px] font-normal uppercase tracking-[0.08em] text-muted-foreground first:pl-4 last:pr-4 md:first:pl-6 md:last:pr-6";
const TD = "py-2.5 first:pl-4 last:pr-4 md:first:pl-6 md:last:pr-6";

function Money({ value, strong }: { value: number; strong?: boolean }) {
  return (
    <span className="flex items-baseline gap-2">
      <span className="font-mono text-xs text-muted-foreground">LKR</span>
      <span
        className={`font-mono tabular-nums ${
          strong ? "text-2xl font-light text-foreground" : "text-base"
        }`}
      >
        {money(value)}
      </span>
    </span>
  );
}

export default function SupplierInvoicePage() {
  const { id, invoiceId } = useParams<{ id: string; invoiceId: string }>();
  const { supplier, loading } = useSupplier(id);
  const { invoice, loading: invoiceLoading } = useSupplierInvoice(
    id,
    invoiceId,
  );
  const { payments, loading: paymentsLoading } = useSupplierPayments(
    id,
    invoiceId,
  );

  if (loading || invoiceLoading) {
    return (
      <div className="h-full bg-card p-4 font-sans md:p-6">
        <LoadingState
          message="Loading invoice..."
          variant="skeleton"
          rows={6}
        />
      </div>
    );
  }

  if (!supplier || !invoice) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-card p-6 text-center font-sans">
        <span className="eyebrow">( Not found )</span>
        <p className="heading text-2xl">
          <span className="text-muted-foreground">This invoice</span> doesn’t
          exist.
        </p>
        <Link
          href={supplier ? `/suppliers/${supplier.id}` : "/suppliers"}
          className="font-mono text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          Back to supplier
        </Link>
      </div>
    );
  }

  const meta = SUPPLIER_INVOICE_STATUS_META[invoice.status];
  const paid = roundMoney(
    invoice.totalIncludingVat - invoice.outstandingAmount,
  );
  const facts: { label: string; value: React.ReactNode }[] = [
    {
      label: "01 / Date",
      value: (
        <span className="font-mono">
          {invoice.date.getTime() ? invoice.date.toLocaleDateString() : "–"}
        </span>
      ),
    },
    { label: "02 / Bill amount", value: <Money value={invoice.billAmount} /> },
    {
      label: `03 / VAT (${Math.round(VAT_RATE * 100)}%)`,
      value: <Money value={invoice.vatAmount} />,
    },
    {
      label: "04 / Total incl. VAT",
      value: <Money value={invoice.totalIncludingVat} />,
    },
    { label: "05 / Paid", value: <Money value={paid} /> },
    {
      label: "06 / Outstanding",
      value: <Money value={invoice.outstandingAmount} strong />,
    },
  ];

  return (
    <div className="flex h-full flex-col divide-y overflow-y-auto bg-card font-sans">
      <PageHeader
        back={{ href: `/suppliers/${supplier.id}`, label: supplier.name }}
        eyebrow={`( ${supplier.name} · Purchase invoice )`}
        lead="Tax invoice"
        title={<span className="font-mono">{invoice.taxInvoiceNo}</span>}
        description={`${invoice.lineItems.length} ${
          invoice.lineItems.length === 1 ? "item" : "items"
        }`}
        actions={
          <>
            <Badge variant={meta.variant}>{meta.label}</Badge>
            <Button variant="outline" asChild>
              <Link
                href={`/suppliers/${supplier.id}/invoices/${invoice.id}/edit`}
              >
                <Pencil />
                Edit
              </Link>
            </Button>
            <DeleteSupplierInvoiceDialog
              supplier={supplier}
              invoice={invoice}
              hasPayments={payments.length > 0}
            />
          </>
        }
      />

      <dl className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
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

      <section className="flex flex-col">
        <div className="px-4 py-3 md:px-6">
          <TableCaption label="Items" count={invoice.lineItems.length} />
        </div>
        <div className="overflow-x-auto border-t">
          <Table>
            <TableHeader className="bg-surface-muted">
              <TableRow className="hover:bg-transparent">
                <TableHead className={`w-16 ${TH}`}>No</TableHead>
                <TableHead className={TH}>Description</TableHead>
                <TableHead className={`w-32 text-right ${TH}`}>
                  Quantity
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoice.lineItems.map((line, index) => (
                <TableRow key={line.id} className="hover:bg-surface-muted">
                  <TableCell
                    className={`font-mono text-xs tabular-nums text-muted-foreground ${TD}`}
                  >
                    {String(index + 1).padStart(2, "0")}
                  </TableCell>
                  <TableCell className={`whitespace-normal ${TD}`}>
                    {line.description}
                  </TableCell>
                  <TableCell
                    className={`text-right font-mono tabular-nums ${TD}`}
                  >
                    {line.quantity}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="flex min-h-[16rem] flex-1 flex-col">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-6">
          <TableCaption label="Payments" count={payments.length} />
          <SupplierPaymentDialog supplier={supplier} invoice={invoice} />
        </div>
        {paymentsLoading ? (
          <div className="px-4 pb-4">
            <LoadingState message="Loading payments..." variant="compact" />
          </div>
        ) : payments.length === 0 ? (
          <p className="border-t px-4 py-6 text-sm text-muted-foreground md:px-6">
            No payments recorded yet.
          </p>
        ) : (
          <div className="overflow-x-auto border-t">
            <Table>
              <TableHeader className="bg-surface-muted">
                <TableRow className="hover:bg-transparent">
                  <TableHead className={TH}>Date</TableHead>
                  <TableHead className={TH}>Description</TableHead>
                  <TableHead className={TH}>Cheque no</TableHead>
                  <TableHead className={TH}>Paid from</TableHead>
                  <TableHead className={`text-right ${TH}`}>
                    Amount (LKR)
                  </TableHead>
                  <TableHead className={TH}>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow key={payment.id} className="hover:bg-surface-muted">
                    <TableCell
                      className={`font-mono text-xs tabular-nums text-muted-foreground ${TD}`}
                    >
                      {payment.date.getTime()
                        ? payment.date.toLocaleDateString()
                        : "–"}
                    </TableCell>
                    <TableCell className={`whitespace-normal ${TD}`}>
                      {payment.description || "–"}
                    </TableCell>
                    <TableCell className={`font-mono text-xs ${TD}`}>
                      {payment.chequeNo || "–"}
                    </TableCell>
                    <TableCell className={TD}>
                      {payment.debitingAccountName || "–"}
                    </TableCell>
                    <TableCell
                      className={`text-right font-mono tabular-nums ${TD}`}
                    >
                      {money(payment.amount)}
                    </TableCell>
                    <TableCell className={TD}>
                      <div className="flex items-center justify-end gap-0.5">
                        <SupplierPaymentDialog
                          supplier={supplier}
                          invoice={invoice}
                          payment={payment}
                        />
                        <DeleteSupplierPaymentDialog
                          supplier={supplier}
                          invoiceId={invoice.id}
                          payment={payment}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}
