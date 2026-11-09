"use client";

import { ArrowRight, Pencil, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
import type { Account } from "@/hooks/use-accounts";
import { ApiError } from "@/lib/api-client";
import { saveInvoicePayment } from "@/lib/data/ledger";
import {
  type ClientInvoiceDocument,
  defaultInvoicePaymentDescription,
  type InvoicePayment,
  roundMoney,
} from "../../../invoice-model";

type InvoicePaymentDialogProps = {
  clientId: string;
  invoice: ClientInvoiceDocument;
  payment?: InvoicePayment;
  /** Remaining balance after existing payments (total − paid). */
  outstandingAmount?: number;
  disabled?: boolean;
};

function todayValue() {
  const date = new Date();
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function toDateInput(value: Date) {
  if (!value.getTime()) return todayValue();
  const offset = value.getTimezoneOffset();
  return new Date(value.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function parseDateInput(value: string): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function findAccountByName(accounts: Account[], name: string) {
  const target = name.trim().toLowerCase();
  if (!target) return undefined;
  return accounts.find(
    (account) => account.name.trim().toLowerCase() === target,
  );
}

export default function InvoicePaymentDialog({
  clientId,
  invoice,
  payment,
  outstandingAmount,
  disabled = false,
}: InvoicePaymentDialogProps) {
  const isEditing = !!payment;
  const { activeCompany, user } = useAuth();
  const { accounts, loading: accountsLoading } = useAccountsContext();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(todayValue());
  const [description, setDescription] = useState(
    defaultInvoicePaymentDescription(invoice.taxInvoiceNo),
  );
  const [chequeNo, setChequeNo] = useState("");
  const [amount, setAmount] = useState("");
  const [creditingAccountId, setCreditingAccountId] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const outstanding = roundMoney(
    outstandingAmount ?? invoice.outstandingAmount,
  );
  const maxAmount = isEditing
    ? roundMoney(outstanding + payment.amount)
    : outstanding;

  const activeAccounts = useMemo(
    () => accounts.filter((account) => !!account.name),
    [accounts],
  );

  const clientAccount = useMemo(
    () => findAccountByName(activeAccounts, invoice.client.name),
    [activeAccounts, invoice.client.name],
  );

  useEffect(() => {
    if (!open) return;
    if (payment) {
      setDate(toDateInput(payment.date));
      setDescription(
        payment.description ||
          defaultInvoicePaymentDescription(invoice.taxInvoiceNo),
      );
      setChequeNo(payment.chequeNo || "");
      setAmount(String(payment.amount));
      setCreditingAccountId(payment.creditingAccountId);
    } else {
      setDate(todayValue());
      setDescription(defaultInvoicePaymentDescription(invoice.taxInvoiceNo));
      setChequeNo("");
      setAmount("");
      setCreditingAccountId("");
    }
    setError("");
  }, [open, payment, invoice.taxInvoiceNo]);

  function resetForm() {
    setDate(todayValue());
    setDescription(defaultInvoicePaymentDescription(invoice.taxInvoiceNo));
    setChequeNo("");
    setAmount("");
    setCreditingAccountId("");
    setError("");
  }

  async function handleSave() {
    if (!activeCompany || !user) return;

    const paymentAmount = roundMoney(Number(amount));
    const creditAccount = activeAccounts.find(
      (item) => item.id === creditingAccountId,
    );
    const debitAccount =
      (payment?.debitingAccountId
        ? activeAccounts.find((item) => item.id === payment.debitingAccountId)
        : undefined) ?? clientAccount;

    if (!date) {
      setError("Payment date is required.");
      return;
    }
    if (!description.trim()) {
      setError("Description is required.");
      return;
    }
    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      setError("Enter a valid payment amount greater than zero.");
      return;
    }
    if (paymentAmount > maxAmount) {
      setError(
        `Amount cannot exceed ${maxAmount.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}.`,
      );
      return;
    }
    if (!creditAccount) {
      setError("Select a crediting account.");
      return;
    }
    if (!debitAccount) {
      setError(
        `No account found named "${invoice.client.name}". Create an account with this client name to debit the payment.`,
      );
      return;
    }
    if (debitAccount.id === creditAccount.id) {
      setError("Crediting account cannot be the same as the client account.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      await saveInvoicePayment({
        activeCompany,
        clientId,
        invoice,
        payment,
        outstanding,
        paymentAmount,
        date,
        description,
        chequeNo,
        creditAccount,
        debitAccount,
        user,
      });
      if (!isEditing) resetForm();
      setOpen(false);
    } catch (saveError) {
      console.error("Failed to save invoice payment", saveError);
      setError(
        saveError instanceof ApiError
          ? saveError.message
          : "Failed to save the payment.",
      );
    } finally {
      setSaving(false);
    }
  }

  const money = (value: number) =>
    value.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  const amountValue = Number(amount);
  const creditingName = activeAccounts.find(
    (account) => account.id === creditingAccountId,
  )?.name;
  const summary =
    amountValue > 0 && creditingName
      ? `LKR ${money(amountValue)} · ${clientAccount?.name ?? invoice.client.name} → ${creditingName}`
      : `Outstanding LKR ${money(outstanding)}`;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (saving) return;
        setOpen(next);
        if (!next && !isEditing) resetForm();
      }}
    >
      {isEditing ? (
        <DialogTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Edit payment"
            disabled={disabled}
          >
            <Pencil />
          </Button>
        </DialogTrigger>
      ) : (
        <DialogTrigger asChild>
          <Button
            className="shrink-0"
            disabled={disabled || outstanding <= 0 || invoice.status === "paid"}
          >
            <Plus />
            Record payment
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className={ruledDialogContentClass}>
        <RuledDialogHeader
          eyebrow={`( Payment · Invoice ${invoice.taxInvoiceNo || "–"} )`}
          lead={isEditing ? "Edit" : "Record a"}
          title={isEditing ? "payment." : "payment."}
          description={`Outstanding on this invoice: LKR ${money(outstanding)}.`}
        />

        <RuledDialogSection label="01 / Details">
          <div className="flex flex-col gap-2">
            <Label>Date</Label>
            <CalendarPopover
              value={parseDateInput(date)}
              onChange={(next) => {
                if (next) setDate(toDateInput(next));
              }}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="payment-cheque">Cheque no</Label>
            <Input
              id="payment-cheque"
              value={chequeNo}
              placeholder="Optional"
              className="font-mono"
              onChange={(event) => setChequeNo(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="payment-description">Description</Label>
            <Textarea
              id="payment-description"
              rows={2}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
        </RuledDialogSection>

        <RuledDialogSection label="02 / Money flow">
          <div className="grid items-end gap-3 sm:col-span-2 sm:grid-cols-[1fr_auto_1fr]">
            <div className="flex min-w-0 flex-col gap-2">
              <Label>From (client account)</Label>
              <div className="flex h-9 items-center truncate rounded-md border bg-surface-muted px-3 text-sm">
                {clientAccount?.name || (
                  <span className="text-destructive">
                    No account named “{invoice.client.name}”
                  </span>
                )}
              </div>
            </div>
            <div
              aria-hidden="true"
              className="hidden size-9 items-center justify-center rounded-md border text-muted-foreground sm:flex"
            >
              <ArrowRight className="size-4" />
            </div>
            <div className="flex min-w-0 flex-col gap-2">
              <Label>To (crediting)</Label>
              <Select
                value={creditingAccountId}
                onValueChange={setCreditingAccountId}
                disabled={accountsLoading}
              >
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={
                      accountsLoading ? "Loading accounts..." : "Select account"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {activeAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="payment-amount">Amount</Label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center font-mono text-xs text-muted-foreground">
                LKR
              </span>
              <Input
                id="payment-amount"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0.01"
                max={maxAmount}
                placeholder="0.00"
                className="h-12 pl-12 font-mono text-2xl font-light tabular-nums md:text-2xl"
                value={amount}
                onChange={(event) => {
                  const next = event.target.value;
                  if (next === "") {
                    setAmount("");
                    return;
                  }
                  const parsed = Number(next);
                  if (!Number.isFinite(parsed)) {
                    setAmount(next);
                    return;
                  }
                  if (parsed > maxAmount) {
                    setAmount(String(maxAmount));
                    setError(
                      `Amount cannot exceed ${maxAmount.toLocaleString(
                        undefined,
                        {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        },
                      )}.`,
                    );
                    return;
                  }
                  setAmount(next);
                  if (error.startsWith("Amount cannot exceed")) setError("");
                }}
              />
            </div>
          </div>
          {error ? (
            <p className="rounded-md bg-danger-soft px-3 py-2 text-sm text-destructive sm:col-span-2">
              {error}
            </p>
          ) : null}
        </RuledDialogSection>

        <RuledDialogFooter summary={summary}>
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
