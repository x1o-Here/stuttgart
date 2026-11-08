"use client";

import { zodResolver } from "@hookform/resolvers/zod";
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
import { addTransaction } from "@/lib/data/ledger";
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
      await addTransaction({ activeCompany, data, user });

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
