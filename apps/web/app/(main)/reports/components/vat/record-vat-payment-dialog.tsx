"use client";

import { ArrowRight, Landmark } from "lucide-react";
import { useMemo, useState } from "react";
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
import { useAuth } from "@/contexts/auth-context";
import { useAccountsContext } from "@/contexts/useAccountsContext";
import { isSystemAccountTypeName } from "@/lib/constants/client-account";
import { roundMoney } from "@/lib/invoices/money";
import { recordVatPayment, VatPaymentError } from "@/lib/vat/vat-payments";
import type { VatQuarterRow } from "@/lib/vat/vat-summary";

const money = (value: number) =>
  value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export function RecordVatPaymentDialog({ row }: { row: VatQuarterRow }) {
  const { user, activeCompany } = useAuth();
  const { accounts, loading: accountsLoading } = useAccountsContext();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [reference, setReference] = useState("");
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pay from our own accounts (cash, bank…), not client/supplier accounts.
  const payingAccounts = useMemo(
    () => accounts.filter((a) => !isSystemAccountTypeName(a.accountType)),
    [accounts],
  );
  const account = payingAccounts.find((a) => a.id === accountId);
  const amountValue = roundMoney(Number(amount));

  async function handleSave() {
    if (!activeCompany || !user) return;
    if (!date) return setError("Payment date is required.");
    if (!account) return setError("Choose the account the VAT is paid from.");
    setSaving(true);
    setError(null);
    try {
      await recordVatPayment(activeCompany, user.uid, {
        quarter: row.quarter,
        due: row.due,
        date,
        amount: amountValue,
        reference,
        account: { id: account.id, name: account.name },
      });
      setOpen(false);
    } catch (err) {
      console.error("Failed to record VAT payment", err);
      setError(
        err instanceof VatPaymentError
          ? err.message
          : "Couldn’t record the payment. Please try again.",
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
        if (next) {
          setDate(new Date());
          setReference("");
          setAmount(String(row.balance));
          setAccountId("");
          setError(null);
        }
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Landmark />
          Record payment
        </Button>
      </DialogTrigger>
      <DialogContent className={`${ruledDialogContentClass} sm:max-w-lg`}>
        <RuledDialogHeader
          eyebrow={`( VAT · ${row.quarter.label} )`}
          lead="Record a"
          title="VAT payment."
          description={`Due for the quarter: LKR ${money(row.due)} · still payable: LKR ${money(row.balance)}.`}
        />
        <RuledDialogSection label="01 / Payment">
          <div className="flex flex-col gap-2">
            <Label>Date paid</Label>
            <CalendarPopover value={date} onChange={setDate} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="vat-reference">Reference</Label>
            <Input
              id="vat-reference"
              placeholder="e.g. IRD receipt no"
              className="font-mono"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="vat-amount">Amount</Label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center font-mono text-xs text-muted-foreground">
                LKR
              </span>
              <Input
                id="vat-amount"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0.01"
                max={row.balance}
                className="h-12 pl-12 font-mono text-2xl font-light tabular-nums md:text-2xl"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
          </div>
        </RuledDialogSection>
        <RuledDialogSection label="02 / Paid from">
          <div className="grid items-end gap-3 sm:col-span-2 sm:grid-cols-[1fr_auto_1fr]">
            <div className="flex min-w-0 flex-col gap-2">
              <Label>From (debiting)</Label>
              <Select
                value={accountId}
                onValueChange={setAccountId}
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
                  {payingAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
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
              <Label>To</Label>
              <div className="flex h-9 items-center rounded-md border bg-surface-muted px-3 text-sm">
                Inland Revenue (VAT)
              </div>
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
            amountValue > 0 && account
              ? `LKR ${money(amountValue)} · ${account.name} → Inland Revenue`
              : `Up to LKR ${money(row.balance)}`
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
            {saving ? "Recording…" : "Record payment"}
          </Button>
        </RuledDialogFooter>
      </DialogContent>
    </Dialog>
  );
}
