"use client";

import { Eye, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import ConfirmationDialog from "@/components/custom/confirmation-dialog";
import {
  RuledDialogFooter,
  RuledDialogHeader,
  ruledDialogContentClass,
  SectionLabel,
} from "@/components/shared/ruled-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/auth-context";
import { deleteVatPayment, VatPaymentError } from "@/lib/vat/vat-payments";
import {
  VAT_STATUS_META,
  type VatPaymentRecord,
  type VatQuarterRow,
  type VatSourceInvoice,
} from "@/lib/vat/vat-summary";

const money = (value: number) =>
  value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

function InvoiceList({
  label,
  invoices,
  total,
}: {
  label: string;
  invoices: VatSourceInvoice[];
  total: number;
}) {
  return (
    <section className="flex flex-col border-b">
      <div className="flex items-baseline justify-between gap-3 px-6 py-3">
        <SectionLabel>{label}</SectionLabel>
        <span className="font-mono text-xs tabular-nums text-muted-foreground">
          {invoices.length} · LKR {money(total)}
        </span>
      </div>
      {invoices.length === 0 ? (
        <p className="px-6 pb-4 text-sm text-muted-foreground">
          No invoices in this quarter.
        </p>
      ) : (
        <ul className="max-h-48 divide-y overflow-y-auto border-t">
          {invoices.map((invoice) => (
            <li key={invoice.id}>
              <Link
                href={invoice.href}
                className="grid grid-cols-[5.5rem_1fr_auto] items-baseline gap-3 px-6 py-2 text-sm hover:bg-surface-muted"
              >
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  {invoice.date.toLocaleDateString()}
                </span>
                <span className="min-w-0 truncate">
                  <span className="font-mono">{invoice.invoiceNo}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {invoice.partyName}
                  </span>
                </span>
                <span className="font-mono tabular-nums">
                  {money(invoice.vatAmount)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function DeletePaymentButton({
  payment,
  quarterLabel,
}: {
  payment: VatPaymentRecord;
  quarterLabel: string;
}) {
  const { user, activeCompany } = useAuth();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!activeCompany || !user) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteVatPayment(activeCompany, user.uid, {
        ...payment,
        quarterLabel,
      });
      setOpen(false);
    } catch (err) {
      console.error("Failed to delete VAT payment", err);
      setError(
        err instanceof VatPaymentError
          ? err.message
          : "Couldn’t delete the payment. Please try again.",
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <ConfirmationDialog
      open={open}
      onOpenChange={(next) => {
        if (!deleting) setOpen(next);
      }}
      trigger={
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Delete VAT payment"
          className="text-muted-foreground hover:bg-danger-soft hover:text-destructive"
        >
          <Trash2 />
        </Button>
      }
      eyebrow={`( VAT · ${quarterLabel} )`}
      lead="Delete"
      title="this VAT payment?"
      description={`LKR ${money(payment.amount)} goes back to ${payment.accountName} and the quarter’s balance goes up again.`}
      confirmLabel={deleting ? "Deleting…" : "Delete payment"}
      cancelLabel="Keep it"
      pending={deleting}
      keepOpen
      onConfirm={() => void handleDelete()}
    >
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </ConfirmationDialog>
  );
}

/** Breakdown of one quarter: output / input invoices and VAT payments. */
export function VatQuarterDialog({ row }: { row: VatQuarterRow }) {
  const meta = VAT_STATUS_META[row.status];

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`View ${row.quarter.label}`}
          className="text-muted-foreground hover:text-foreground"
        >
          <Eye />
        </Button>
      </DialogTrigger>
      <DialogContent className={ruledDialogContentClass}>
        <RuledDialogHeader
          eyebrow={`( VAT · ${row.quarter.startDate.toLocaleDateString()} – ${row.quarter.endDate.toLocaleDateString()} )`}
          lead="Quarter"
          title={`${row.quarter.label}.`}
          description={
            <span className="flex items-center gap-2">
              <Badge variant={meta.variant}>{meta.label}</Badge>
              Due VAT = Outgoing VAT − Incoming VAT
            </span>
          }
        />
        <InvoiceList
          label="01 / Outgoing VAT · client invoices"
          invoices={row.outgoing}
          total={row.outputVat}
        />
        <InvoiceList
          label="02 / Incoming VAT · supplier invoices"
          invoices={row.incoming}
          total={row.inputVat}
        />
        <section className="flex flex-col">
          <div className="flex items-baseline justify-between gap-3 px-6 py-3">
            <SectionLabel>03 / VAT paid</SectionLabel>
            <span className="font-mono text-xs tabular-nums text-muted-foreground">
              LKR {money(row.paid)}
            </span>
          </div>
          {row.payments.length === 0 ? (
            <p className="px-6 pb-4 text-sm text-muted-foreground">
              No VAT payments recorded.
            </p>
          ) : (
            <ul className="divide-y border-t">
              {row.payments.map((payment) => (
                <li
                  key={payment.id}
                  className="grid grid-cols-[5.5rem_1fr_auto_auto] items-center gap-3 px-6 py-2 text-sm"
                >
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    {payment.date.toLocaleDateString()}
                  </span>
                  <span className="min-w-0 truncate">
                    {payment.accountName}
                    {payment.reference ? (
                      <span className="font-mono text-muted-foreground">
                        {" "}
                        · {payment.reference}
                      </span>
                    ) : null}
                  </span>
                  <span className="font-mono tabular-nums">
                    {money(payment.amount)}
                  </span>
                  <DeletePaymentButton
                    payment={payment}
                    quarterLabel={row.quarter.label}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
        <RuledDialogFooter
          summary={`${money(row.outputVat)} − ${money(row.inputVat)} = ${row.due < 0 ? "−" : ""}${money(Math.abs(row.due))} due · ${money(row.balance)} still payable`}
        >
          <DialogClose asChild>
            <Button variant="ghost">Close</Button>
          </DialogClose>
        </RuledDialogFooter>
      </DialogContent>
    </Dialog>
  );
}
