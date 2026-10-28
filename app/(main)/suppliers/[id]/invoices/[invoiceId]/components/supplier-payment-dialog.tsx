"use client";

import { ArrowRight, Pencil, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import type { InvoicePayment } from "@/app/(main)/clients/[id]/invoice-model";
import CalendarPopover from "@/components/shared/calendar-popover";
import {
  RuledDialogFooter,
  RuledDialogHeader,
  RuledDialogSection,
  ruledDialogContentClass,
} from "@/components/shared/ruled-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/auth-context";
import { useAccountsContext } from "@/contexts/useAccountsContext";
import {
  isSupplierAccountTypeName,
  isSystemAccountTypeName,
} from "@/lib/constants/client-account";
import { roundMoney } from "@/lib/invoices/money";
import {
  SupplierInvoiceError,
  saveSupplierPayment,
} from "@/lib/suppliers/supplier-invoices";
import type { Supplier, SupplierInvoice } from "@/lib/suppliers/supplier-model";

const money = (value: number) =>
  value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

type Props = {
  supplier: Supplier;
  invoice: SupplierInvoice;
  /** Omit to record a new payment. */
  payment?: InvoicePayment;
};

/** Records (or edits) a payment from one of our accounts to the supplier. */
export function SupplierPaymentDialog({ supplier, invoice, payment }: Props) {
  const isEditing = !!payment;
  const { user, activeCompany } = useAuth();
  const { accounts, loading: accountsLoading } = useAccountsContext();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [description, setDescription] = useState("");
  const [chequeNo, setChequeNo] = useState("");
  const [amount, setAmount] = useState("");
  const [fromId, setFromId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supplierAccount = useMemo(
    () =>
      accounts.find((account) => account.supplierId === supplier.id) ??
      accounts.find(
        (account) =>
          isSupplierAccountTypeName(account.accountType) &&
          account.name.trim().toLowerCase() ===
            supplier.name.trim().toLowerCase(),
      ),
    [accounts, supplier],
  );
  // Pay from our own accounts (cash, bank…), not client/supplier accounts.
  const fromAccounts = useMemo(
    () =>
      accounts.filter(
        (account) => !isSystemAccountTypeName(account.accountType),
      ),
    [accounts],
  );

  const available = roundMoney(
    invoice.outstandingAmount + (payment ? payment.amount : 0),
  );
  const amountValue = roundMoney(Number(amount));
  const fromName = fromAccounts.find((a) => a.id === fromId)?.name;

  function reset() {
    setDate(payment?.date.getTime() ? payment.date : new Date());
    setDescription(
      payment?.description ?? `Payment for invoice ${invoice.taxInvoiceNo}`,
    );
    setChequeNo(payment?.chequeNo ?? "");
    setAmount(
      payment ? String(payment.amount) : String(invoice.outstandingAmount),
    );
    setFromId(payment?.debitingAccountId ?? "");
    setError(null);
  }

  async function handleSave() {
    if (!activeCompany || !user) return;
    if (!date) return setError("Payment date is required.");
    if (!description.trim()) return setError("Description is required.");
    if (!(amountValue > 0))
      return setError("Enter an amount greater than zero.");
    if (amountValue > available) {
      return setError(`Amount can’t exceed LKR ${money(available)}.`);
    }
    const from = fromAccounts.find((a) => a.id === fromId);
    if (!from) return setError("Choose the account the payment comes from.");
    if (!supplierAccount) {
      return setError(
        `No supplier account found for ${supplier.name}. It’s created with the supplier; check the chart of accounts.`,
      );
    }

    setSaving(true);
    setError(null);
    try {
      await saveSupplierPayment(
        activeCompany,
        user.uid,
        { id: supplier.id, name: supplier.name },
        invoice.id,
        {
          date,
          description,
          chequeNo,
          amount: amountValue,
          debitingAccount: { id: from.id, name: from.name },
          creditingAccount: {
            id: supplierAccount.id,
            name: supplierAccount.name,
          },
        },
        payment
          ? {
              id: payment.id,
              amount: payment.amount,
              transactionId: payment.transactionId,
              debitingAccountId: payment.debitingAccountId,
              creditingAccountId: payment.creditingAccountId,
            }
          : undefined,
      );
      setOpen(false);
    } catch (err) {
      console.error("Failed to save supplier payment", err);
      setError(
        err instanceof SupplierInvoiceError
          ? err.message
          : "Couldn’t save the payment. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (saving) return;
        if (next) reset();
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        {isEditing ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Edit payment"
          >
            <Pencil />
          </Button>
        ) : (
          <Button disabled={invoice.outstandingAmount <= 0}>
            <Plus />
            Record payment
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className={ruledDialogContentClass}>
        <RuledDialogHeader
          eyebrow={`( Payment · Invoice ${invoice.taxInvoiceNo} )`}
          lead={isEditing ? "Edit" : "Record a"}
          title="payment."
          description={`Outstanding on this invoice: LKR ${money(invoice.outstandingAmount)}.`}
        />

        <RuledDialogSection label="01 / Details">
          <div className="flex flex-col gap-2">
            <Label>Date</Label>
            <CalendarPopover value={date} onChange={setDate} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="supplier-payment-cheque">Cheque no</Label>
            <Input
              id="supplier-payment-cheque"
              placeholder="Optional"
              className="font-mono"
              value={chequeNo}
              onChange={(e) => setChequeNo(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="supplier-payment-description">Description</Label>
            <Textarea
              id="supplier-payment-description"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </RuledDialogSection>

        <RuledDialogSection label="02 / Money flow">
          <div className="grid items-end gap-3 sm:col-span-2 sm:grid-cols-[1fr_auto_1fr]">
            <div className="flex min-w-0 flex-col gap-2">
              <Label>From (debiting)</Label>
              <Select
                value={fromId}
                onValueChange={setFromId}
                disabled={accountsLoading}
              >
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={
                      accountsLoading ? "Loading accounts…" : "Select account"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {fromAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div
              aria-hidden="true"
              className="hidden size-9 items-center justify-center rounded-md border text-muted-foreground sm:flex"
            >
              <ArrowRight className="size-4" />
            </div>
            <div className="flex min-w-0 flex-col gap-2">
              <Label>To (supplier account)</Label>
              <div className="flex h-9 items-center truncate rounded-md border bg-surface-muted px-3 text-sm">
                {supplierAccount?.name ?? (
                  <span className="text-destructive">No supplier account</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="supplier-payment-amount">Amount</Label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center font-mono text-xs text-muted-foreground">
                LKR
              </span>
              <Input
                id="supplier-payment-amount"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0.01"
                max={available}
                placeholder="0.00"
                className="h-12 pl-12 font-mono text-2xl font-light tabular-nums md:text-2xl"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
          </div>
          {error ? (
            <p
              role="alert"
              className="rounded-md bg-danger-soft px-3 py-2 text-sm text-destructive sm:col-span-2"
            >
              {error}
            </p>
          ) : null}
        </RuledDialogSection>

        <RuledDialogFooter
          summary={
            amountValue > 0 && fromName && supplierAccount
              ? `LKR ${money(amountValue)} · ${fromName} → ${supplierAccount.name}`
              : `Up to LKR ${money(available)}`
          }
        >
          <Button
            variant="ghost"
            disabled={saving}
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button disabled={saving} onClick={() => void handleSave()}>
            {saving ? "Saving…" : isEditing ? "Save changes" : "Record payment"}
          </Button>
        </RuledDialogFooter>
      </DialogContent>
    </Dialog>
  );
}
