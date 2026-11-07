"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  collection,
  doc,
  increment,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { Plus } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import {
  RuledDialogFooter,
  RuledDialogHeader,
  ruledDialogContentClass,
} from "@/components/shared/ruled-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { FieldGroup } from "@/components/ui/field";
import { useAuth } from "@/contexts/auth-context";
import { appendAuditLog } from "@/lib/firebase/audit-log";
import { db } from "@/lib/firebase/firebase-client";
import {
  TransactionFormSections,
  type TransactionFormValues,
  transactionFormSchema,
  useTransactionSummary,
} from "./transaction-form-fields";

export function AddTransactionDialog() {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { user, activeCompany } = useAuth();

  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: {
      date: new Date(),
      description: "",
      creditingAccount: "",
      debitingAccount: "",
      amount: 0,
      department: "",
      voucherNo: 0,
      vehicle: "",
    },
    mode: "onSubmit",
    reValidateMode: "onSubmit",
  });

  async function onSubmit(data: TransactionFormValues) {
    try {
      setIsSubmitting(true);
      const batch = writeBatch(db);

      // Transactions
      const transactionId = doc(collection(db, "transactions")).id;

      const creditTransactionRef = doc(
        db,
        "companies",
        activeCompany,
        "accounts",
        data.creditingAccount,
        "transactions",
        transactionId,
      );

      batch.set(creditTransactionRef, {
        date: data.date,
        amount: data.amount,
        type: "credit",
        department: data.department,
        vehicle: data.vehicle,
        voucherNo: data.voucherNo,
        description: data.description,
        createdAt: serverTimestamp(),
      });

      const debitTransactionRef = doc(
        db,
        "companies",
        activeCompany,
        "accounts",
        data.debitingAccount,
        "transactions",
        transactionId,
      );

      batch.set(debitTransactionRef, {
        date: data.date,
        amount: data.amount,
        type: "debit",
        department: data.department,
        vehicle: data.vehicle,
        voucherNo: data.voucherNo,
        description: data.description,
        createdAt: serverTimestamp(),
      });

      // Accounts
      const creditAccountRef = doc(
        db,
        "companies",
        activeCompany,
        "accounts",
        data.creditingAccount,
      );
      batch.update(creditAccountRef, {
        balance: increment(data.amount),
      });

      const debitAccountRef = doc(
        db,
        "companies",
        activeCompany,
        "accounts",
        data.debitingAccount,
      );
      batch.update(debitAccountRef, {
        balance: increment(-data.amount),
      });

      // Audit Log
      appendAuditLog(batch, {
        userId: user?.uid,
        transactionId: transactionId,
        action: "create",
        description: `Transaction added`,
        companyId: activeCompany,
        entityStatus: true,
      });

      await batch.commit();

      form.reset();
      setOpen(false);
    } catch (err) {
      console.error("Transaction failed:", err);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleCancel() {
    if (isSubmitting) return;
    form.reset();
    setOpen(false);
  }

  const summary = useTransactionSummary({ form });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (isSubmitting) return;
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus />
          Record transaction
        </Button>
      </DialogTrigger>

      <DialogContent className={ruledDialogContentClass}>
        <RuledDialogHeader
          eyebrow="( New entry · Ledger )"
          lead="Record a"
          title="transaction."
          description="Moves money from one account to another and updates both balances."
        />
        <form id="add-transaction-form" onSubmit={form.handleSubmit(onSubmit)}>
          <FieldGroup className="gap-0">
            <TransactionFormSections form={form} />
          </FieldGroup>
        </form>
        <RuledDialogFooter
          summary={summary ?? "Choose both accounts and an amount"}
        >
          <Button
            type="button"
            variant="ghost"
            onClick={handleCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="add-transaction-form"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Recording…" : "Record transaction"}
          </Button>
        </RuledDialogFooter>
      </DialogContent>
    </Dialog>
  );
}
