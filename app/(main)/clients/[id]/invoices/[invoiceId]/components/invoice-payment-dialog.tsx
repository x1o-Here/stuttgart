"use client";

import {
  collection,
  doc,
  increment,
  serverTimestamp,
  Timestamp,
  writeBatch,
} from "firebase/firestore";
import { Pencil, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import CalendarPopover from "@/components/shared/calendar-popover";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { db } from "@/lib/firebase/firebase-client";
import type { Account } from "@/hooks/use-accounts";
import {
  type ClientInvoiceDocument,
  defaultInvoicePaymentDescription,
  deriveStatusFromBalances,
  type InvoicePayment,
  roundMoney,
} from "../../../invoice-model";

type InvoicePaymentDialogProps = {
  clientId: string;
  invoice: ClientInvoiceDocument;
  payment?: InvoicePayment;
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
  return accounts.find((account) => account.name.trim().toLowerCase() === target);
}

function accountTxRef(
  companyId: string,
  accountId: string,
  transactionId: string,
) {
  return doc(
    db,
    "companies",
    companyId,
    "accounts",
    accountId,
    "transactions",
    transactionId,
  );
}

export default function InvoicePaymentDialog({
  clientId,
  invoice,
  payment,
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
  const [amount, setAmount] = useState("");
  const [creditingAccountId, setCreditingAccountId] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const outstanding = roundMoney(invoice.outstandingAmount);
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
          defaultInvoicePaymentDescription(
            payment.invoiceNo || invoice.taxInvoiceNo,
          ),
      );
      setAmount(String(payment.amount));
      setCreditingAccountId(payment.creditingAccountId);
    } else {
      setDate(todayValue());
      setDescription(defaultInvoicePaymentDescription(invoice.taxInvoiceNo));
      setAmount("");
      setCreditingAccountId("");
    }
    setError("");
  }, [open, payment, invoice.taxInvoiceNo]);

  function resetForm() {
    setDate(todayValue());
    setDescription(defaultInvoicePaymentDescription(invoice.taxInvoiceNo));
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
      const batch = writeBatch(db);
      const invoiceRef = doc(
        db,
        "companies",
        activeCompany,
        "clients",
        clientId,
        "invoices",
        invoice.id,
      );
      const paymentRef = isEditing
        ? doc(invoiceRef, "payments", payment.id)
        : doc(collection(invoiceRef, "payments"));

      const nextOutstanding = isEditing
        ? roundMoney(outstanding + payment.amount - paymentAmount)
        : roundMoney(outstanding - paymentAmount);
      const nextStatus = deriveStatusFromBalances(
        invoice.totalIncludingVat,
        nextOutstanding,
        invoice.status === "paid" ? "partial" : invoice.status,
      );

      const paymentDate = Timestamp.fromDate(new Date(`${date}T00:00:00`));
      const txDescription = description.trim();
      const transactionId =
        (isEditing && payment.transactionId) ||
        doc(collection(db, "transactions")).id;

      const txPayload = {
        date: paymentDate,
        amount: paymentAmount,
        department: "",
        vehicle: "",
        voucherNo: 0,
        description: txDescription,
        tags: ["invoice-payment", invoice.taxInvoiceNo],
        invoiceId: invoice.id,
        invoiceNo: invoice.taxInvoiceNo,
        clientId,
        clientName: invoice.client.name,
        paymentId: paymentRef.id,
      };

      if (isEditing && payment.transactionId) {
        const previousCreditId = payment.creditingAccountId;
        const previousDebitId = payment.debitingAccountId || debitAccount.id;
        const previousAmount = payment.amount;

        // Reverse previous balances, then apply the new ones.
        if (previousCreditId) {
          batch.update(doc(db, "companies", activeCompany, "accounts", previousCreditId), {
            balance: increment(-previousAmount),
          });
        }
        if (previousDebitId) {
          batch.update(doc(db, "companies", activeCompany, "accounts", previousDebitId), {
            balance: increment(previousAmount),
          });
        }

        // Remove old transaction docs if the account changed.
        if (previousCreditId && previousCreditId !== creditAccount.id) {
          batch.delete(
            accountTxRef(activeCompany, previousCreditId, payment.transactionId),
          );
        }
        if (previousDebitId && previousDebitId !== debitAccount.id) {
          batch.delete(
            accountTxRef(activeCompany, previousDebitId, payment.transactionId),
          );
        }

        batch.set(
          accountTxRef(activeCompany, creditAccount.id, transactionId),
          {
            ...txPayload,
            type: "credit",
            updatedAt: serverTimestamp(),
            createdAt: serverTimestamp(),
          },
          { merge: true },
        );
        batch.set(
          accountTxRef(activeCompany, debitAccount.id, transactionId),
          {
            ...txPayload,
            type: "debit",
            updatedAt: serverTimestamp(),
            createdAt: serverTimestamp(),
          },
          { merge: true },
        );

        batch.update(doc(db, "companies", activeCompany, "accounts", creditAccount.id), {
          balance: increment(paymentAmount),
        });
        batch.update(doc(db, "companies", activeCompany, "accounts", debitAccount.id), {
          balance: increment(-paymentAmount),
        });
      } else {
        batch.set(accountTxRef(activeCompany, creditAccount.id, transactionId), {
          ...txPayload,
          type: "credit",
          createdAt: serverTimestamp(),
        });
        batch.set(accountTxRef(activeCompany, debitAccount.id, transactionId), {
          ...txPayload,
          type: "debit",
          createdAt: serverTimestamp(),
        });
        batch.update(doc(db, "companies", activeCompany, "accounts", creditAccount.id), {
          balance: increment(paymentAmount),
        });
        batch.update(doc(db, "companies", activeCompany, "accounts", debitAccount.id), {
          balance: increment(-paymentAmount),
        });
      }

      const payload = {
        date: paymentDate,
        description: txDescription,
        invoiceNo: invoice.taxInvoiceNo,
        amount: paymentAmount,
        creditingAccountId: creditAccount.id,
        creditingAccountName: creditAccount.name,
        debitingAccountId: debitAccount.id,
        debitingAccountName: debitAccount.name,
        transactionId,
        entityStatus: true,
      };

      if (isEditing) {
        batch.update(paymentRef, {
          ...payload,
          updatedAt: serverTimestamp(),
          updatedBy: user.uid,
        });
      } else {
        batch.set(paymentRef, {
          ...payload,
          createdAt: serverTimestamp(),
          createdBy: user.uid,
        });
      }

      batch.update(invoiceRef, {
        outstandingAmount: Math.max(0, nextOutstanding),
        status: nextStatus,
        updatedAt: serverTimestamp(),
        updatedBy: user.uid,
      });

      const auditRef = doc(collection(db, "auditLogs"));
      batch.set(auditRef, {
        userId: user.uid,
        companyId: activeCompany,
        action: isEditing ? "update" : "create",
        description: isEditing
          ? `Payment on invoice ${invoice.taxInvoiceNo} updated`
          : `Payment of ${paymentAmount} added to invoice ${invoice.taxInvoiceNo}`,
        entityStatus: true,
        transactionId,
        createdAt: serverTimestamp(),
      });

      await batch.commit();
      if (!isEditing) resetForm();
      setOpen(false);
    } catch (saveError) {
      console.error("Failed to save invoice payment", saveError);
      setError("Failed to save the payment.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next && !saving && !isEditing) resetForm();
      }}
    >
      {isEditing ? (
        <DialogTrigger asChild>
          <Button type="button" variant="outline" size="sm" disabled={disabled}>
            <Pencil className="mr-1 h-3.5 w-3.5" />
            Edit
          </Button>
        </DialogTrigger>
      ) : (
        <DialogTrigger asChild>
          <Button
            className="shrink-0"
            disabled={disabled || outstanding <= 0 || invoice.status === "paid"}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Payment
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit invoice payment" : "Add invoice payment"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Outstanding:{" "}
            <span className="font-medium text-foreground tabular-nums">
              {outstanding.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </p>
          <p className="text-sm text-muted-foreground">
            Debiting account:{" "}
            <span className="font-medium text-foreground">
              {clientAccount?.name ||
                `create an account named "${invoice.client.name}"`}
            </span>
          </p>

          <div className="space-y-2">
            <Label>Date</Label>
            <CalendarPopover
              value={parseDateInput(date)}
              onChange={(next) => {
                if (next) setDate(toDateInput(next));
              }}
            />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Invoice no</Label>
            <Input value={invoice.taxInvoiceNo} readOnly disabled />
          </div>
          <div className="space-y-2">
            <Label>Amount</Label>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              max={maxAmount}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Crediting account</Label>
            <Select
              value={creditingAccountId}
              onValueChange={setCreditingAccountId}
              disabled={accountsLoading}
            >
              <SelectTrigger>
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

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            disabled={saving}
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button disabled={saving} onClick={() => void handleSave()}>
            {saving ? "Saving..." : isEditing ? "Save Changes" : "Save Payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
