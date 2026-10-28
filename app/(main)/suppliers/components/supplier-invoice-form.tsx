"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import CalendarPopover from "@/components/shared/calendar-popover";
import { PageHeader } from "@/components/shared/page-header";
import { SectionLabel } from "@/components/shared/ruled-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/auth-context";
import {
  normalizeTaxInvoiceNo,
  roundMoney,
  splitVatInclusive,
  TAX_INVOICE_NO_LENGTH,
  VAT_RATE,
  validateTaxInvoiceNo,
} from "@/lib/invoices/money";
import {
  createSupplierInvoice,
  SupplierInvoiceError,
  updateSupplierInvoice,
} from "@/lib/suppliers/supplier-invoices";
import type {
  Supplier,
  SupplierInvoice,
  SupplierInvoiceLine,
} from "@/lib/suppliers/supplier-model";
import { cn } from "@/lib/utils";

const money = (value: number) =>
  value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

type LineDraft = { id: string; description: string; quantity: string };

const newLine = (): LineDraft => ({
  id: crypto.randomUUID(),
  description: "",
  quantity: "1",
});

/** Full-page form to submit or edit a supplier's tax invoice. */
export function SupplierInvoiceForm({
  supplier,
  invoice,
}: {
  supplier: Supplier;
  invoice?: SupplierInvoice;
}) {
  const router = useRouter();
  const { user, activeCompany } = useAuth();
  const isEditing = !!invoice;
  const paid = invoice
    ? roundMoney(invoice.totalIncludingVat - invoice.outstandingAmount)
    : 0;

  const [taxNo, setTaxNo] = useState(invoice?.taxInvoiceNo ?? "");
  const [taxTouched, setTaxTouched] = useState(false);
  const [date, setDate] = useState<Date | undefined>(
    invoice?.date.getTime() ? invoice.date : new Date(),
  );
  const [total, setTotal] = useState(
    invoice ? String(invoice.totalIncludingVat) : "",
  );
  const [lines, setLines] = useState<LineDraft[]>(
    invoice?.lineItems.length
      ? invoice.lineItems.map((line) => ({
          id: line.id,
          description: line.description,
          quantity: String(line.quantity),
        }))
      : [newLine()],
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalValue = Number(total);
  const split = useMemo(
    () => splitVatInclusive(Number.isFinite(totalValue) ? totalValue : 0),
    [totalValue],
  );
  const normalizedTaxNo = normalizeTaxInvoiceNo(taxNo);
  const taxError = validateTaxInvoiceNo(taxNo);
  const backHref = isEditing
    ? `/suppliers/${supplier.id}/invoices/${invoice.id}`
    : `/suppliers/${supplier.id}`;

  function updateLine(id: string, patch: Partial<LineDraft>) {
    setLines((current) =>
      current.map((line) => (line.id === id ? { ...line, ...patch } : line)),
    );
  }

  async function handleSubmit() {
    if (!activeCompany || !user) return;
    setTaxTouched(true);
    if (taxError) {
      setError(taxError);
      return;
    }
    if (!date) {
      setError("Invoice date is required.");
      return;
    }
    const lineItems: SupplierInvoiceLine[] = lines.map((line) => ({
      id: line.id,
      description: line.description,
      quantity: Number(line.quantity),
    }));

    setSaving(true);
    setError(null);
    try {
      const input = {
        taxInvoiceNo: taxNo,
        date,
        totalIncludingVat: totalValue,
        lineItems,
      };
      if (isEditing) {
        await updateSupplierInvoice(
          activeCompany,
          user.uid,
          supplier,
          invoice.id,
          input,
        );
        router.push(backHref);
      } else {
        const id = await createSupplierInvoice(
          activeCompany,
          user.uid,
          supplier,
          input,
        );
        router.push(`/suppliers/${supplier.id}/invoices/${id}`);
      }
    } catch (err) {
      console.error("Failed to save supplier invoice", err);
      setError(
        err instanceof SupplierInvoiceError
          ? err.message
          : "Couldn’t save the invoice. Please try again.",
      );
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-full flex-col divide-y">
      <PageHeader
        back={{
          href: backHref,
          label: isEditing ? `Invoice ${invoice.taxInvoiceNo}` : supplier.name,
        }}
        eyebrow={`( ${supplier.name} · Purchase invoice )`}
        lead={isEditing ? "Edit" : "Submit a"}
        title="tax invoice."
        description={
          isEditing && paid > 0
            ? `LKR ${money(paid)} already paid. The total can’t go below it.`
            : "Record the supplier’s invoice exactly as printed."
        }
      />

      <section className="grid gap-4 px-4 py-5 md:grid-cols-2 md:px-6">
        <div className="md:col-span-2">
          <SectionLabel>01 / Invoice details</SectionLabel>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-2">
            <Label htmlFor="tax-invoice-no">Tax invoice no</Label>
            <span
              className={cn(
                "font-mono text-xs tabular-nums",
                normalizedTaxNo.length === TAX_INVOICE_NO_LENGTH
                  ? "text-success"
                  : "text-muted-foreground",
              )}
            >
              {normalizedTaxNo.length} / {TAX_INVOICE_NO_LENGTH}
            </span>
          </div>
          <Input
            id="tax-invoice-no"
            value={taxNo}
            maxLength={TAX_INVOICE_NO_LENGTH}
            autoComplete="off"
            spellCheck={false}
            placeholder="e.g. INV/2026-000123"
            aria-invalid={taxTouched && !!taxError}
            aria-describedby="tax-invoice-no-help"
            className="font-mono uppercase"
            onChange={(event) =>
              setTaxNo(event.target.value.toUpperCase().replace(/\s/g, ""))
            }
            onBlur={() => setTaxTouched(true)}
          />
          <p
            id="tax-invoice-no-help"
            className={cn(
              "text-xs",
              taxTouched && taxError
                ? "text-destructive"
                : "text-muted-foreground",
            )}
          >
            {taxTouched && taxError
              ? taxError
              : "Exactly 15 characters: letters, digits, - or /. Must be unique across all suppliers."}
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Label>Invoice date</Label>
          <CalendarPopover value={date} onChange={setDate} />
        </div>
      </section>

      <section className="grid gap-4 px-4 py-5 md:grid-cols-2 md:px-6">
        <div className="md:col-span-2">
          <SectionLabel>02 / Amount</SectionLabel>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="invoice-total">Total amount including VAT</Label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center font-mono text-xs text-muted-foreground">
              LKR
            </span>
            <Input
              id="invoice-total"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              placeholder="0.00"
              className="h-12 pl-12 font-mono text-2xl font-light tabular-nums md:text-2xl"
              value={total}
              onChange={(event) => setTotal(event.target.value)}
            />
          </div>
        </div>
        <dl
          aria-live="polite"
          className="grid grid-cols-2 gap-px self-end overflow-hidden rounded-md border bg-border"
        >
          <div className="flex flex-col gap-1 bg-surface-muted px-4 py-3">
            <dt className="eyebrow normal-case tracking-normal">Bill amount</dt>
            <dd className="font-mono text-lg tabular-nums">
              {money(split.billAmount)}
            </dd>
          </div>
          <div className="flex flex-col gap-1 bg-surface-muted px-4 py-3">
            <dt className="eyebrow normal-case tracking-normal">
              VAT ({Math.round(VAT_RATE * 100)}%)
            </dt>
            <dd className="font-mono text-lg tabular-nums">
              {money(split.vatAmount)}
            </dd>
          </div>
        </dl>
      </section>

      <section className="flex flex-col">
        <div className="flex items-center justify-between gap-3 px-4 py-3 md:px-6">
          <SectionLabel>03 / Items</SectionLabel>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setLines((current) => [...current, newLine()])}
          >
            <Plus />
            Add item
          </Button>
        </div>
        <div className="overflow-x-auto border-t">
          <table className="w-full min-w-[32rem] text-sm">
            <thead className="bg-surface-muted">
              <tr>
                <th className="w-12 border-b py-2 pl-4 text-left font-mono text-[11px] font-normal uppercase tracking-[0.08em] text-muted-foreground md:pl-6">
                  No
                </th>
                <th className="border-b px-2 py-2 text-left font-mono text-[11px] font-normal uppercase tracking-[0.08em] text-muted-foreground">
                  Description
                </th>
                <th className="w-32 border-b px-2 py-2 text-left font-mono text-[11px] font-normal uppercase tracking-[0.08em] text-muted-foreground">
                  Quantity
                </th>
                <th className="w-12 border-b pr-4 md:pr-6" />
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => (
                <tr key={line.id} className="border-b">
                  <td className="py-2 pl-4 font-mono text-xs tabular-nums text-muted-foreground md:pl-6">
                    {String(index + 1).padStart(2, "0")}
                  </td>
                  <td className="px-2 py-2">
                    <Input
                      aria-label={`Item ${index + 1} description`}
                      placeholder="e.g. Diesel, 200 L"
                      value={line.description}
                      onChange={(event) =>
                        updateLine(line.id, { description: event.target.value })
                      }
                    />
                  </td>
                  <td className="px-2 py-2">
                    <Input
                      aria-label={`Item ${index + 1} quantity`}
                      type="number"
                      inputMode="numeric"
                      min="1"
                      step="1"
                      className="font-mono tabular-nums"
                      value={line.quantity}
                      onChange={(event) =>
                        updateLine(line.id, { quantity: event.target.value })
                      }
                    />
                  </td>
                  <td className="py-2 pr-4 md:pr-6">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove item ${index + 1}`}
                      className="text-muted-foreground hover:bg-danger-soft hover:text-destructive"
                      disabled={lines.length === 1}
                      onClick={() =>
                        setLines((current) =>
                          current.filter((item) => item.id !== line.id),
                        )
                      }
                    >
                      <Trash2 />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="sticky bottom-0 mt-auto flex flex-col gap-3 bg-surface-muted px-4 py-3 sm:flex-row sm:items-center sm:justify-between md:px-6">
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : (
          <p className="font-mono text-xs tabular-nums text-muted-foreground">
            {lines.length} {lines.length === 1 ? "item" : "items"} · LKR{" "}
            {money(split.total)} · VAT {money(split.vatAmount)}
          </p>
        )}
        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            disabled={saving}
            onClick={() => router.push(backHref)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={saving}
            onClick={() => void handleSubmit()}
          >
            {saving
              ? isEditing
                ? "Saving…"
                : "Submitting…"
              : isEditing
                ? "Save changes"
                : "Submit invoice"}
          </Button>
        </div>
      </div>
    </div>
  );
}
