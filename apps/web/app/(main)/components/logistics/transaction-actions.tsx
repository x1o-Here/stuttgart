"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Edit2, MoreHorizontal, Trash2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import ConfirmationDialog from "@/components/custom/confirmation-dialog";
import {
  RuledDialogFooter,
  RuledDialogHeader,
  ruledDialogContentClass,
} from "@/components/shared/ruled-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FieldGroup } from "@/components/ui/field";
import { useAuth } from "@/contexts/auth-context";
import { correctTransaction, deleteTransaction } from "@/lib/data/ledger";
import { hasRestrictedTags } from "@/lib/helpers/transaction-tags";
import type { Transaction } from "./columns";
import {
  TransactionFormSections,
  type TransactionFormValues,
  transactionFormSchema,
  useTransactionSummary,
} from "./transaction-form-fields";

interface TransactionActionsProps {
  transaction: Transaction;
}

export function TransactionActions({ transaction }: TransactionActionsProps) {
  const [openDropdown, setOpenDropdown] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const { user, activeCompany } = useAuth();

  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: {
      date: transaction.date || new Date(),
      description: transaction.description || "",
      department: transaction.department || "",
      vehicle: transaction.vehicle || "",
      voucherNo: transaction.voucher || 0,
      creditingAccount: transaction.creditingAccountId || "",
      debitingAccount: transaction.debitingAccountId || "",
      amount: transaction.amount || 0,
    },
    mode: "onSubmit",
    reValidateMode: "onSubmit",
  });

  const summary = useTransactionSummary({ form });

  async function onSubmit(data: TransactionFormValues) {
    try {
      setIsSubmitting(true);
      await correctTransaction({ activeCompany, data, transaction, user });

      setEditDialogOpen(false);
      setOpenDropdown(false);
    } catch (err) {
      console.error("Failed to edit transaction:", err);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (isDeleting) return;

    try {
      setIsDeleting(true);
      await deleteTransaction({ activeCompany, transaction, user });

      setOpenDropdown(false);
      setConfirmDelete(false);
    } catch (err) {
      console.error("Failed to delete transaction:", err);
    } finally {
      setIsDeleting(false);
    }
  }

  if (hasRestrictedTags(transaction.tags)) {
    return null;
  }

  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "LKR",
  }).format(transaction.amount || 0);

  return (
    <>
      <DropdownMenu open={openDropdown} onOpenChange={setOpenDropdown}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Transaction actions"
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() => {
              form.reset({
                date: transaction.date || new Date(),
                description: transaction.description || "",
                department: transaction.department || "",
                vehicle: transaction.vehicle || "",
                voucherNo: transaction.voucher || 0,
                creditingAccount: transaction.creditingAccountId || "",
                debitingAccount: transaction.debitingAccountId || "",
                amount: transaction.amount || 0,
              });
              setEditDialogOpen(true);
              setOpenDropdown(false);
            }}
          >
            <Edit2 />
            Edit transaction
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            disabled={isDeleting}
            onClick={() => {
              setOpenDropdown(false);
              setConfirmDelete(true);
            }}
          >
            <Trash2 />
            Delete transaction
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog
        open={editDialogOpen}
        onOpenChange={(next) => {
          if (isSubmitting) return;
          setEditDialogOpen(next);
        }}
      >
        <DialogContent className={ruledDialogContentClass}>
          <RuledDialogHeader
            eyebrow={`( Correction · V/No ${transaction.voucher ?? "–"} )`}
            lead="Edit"
            title="transaction."
            description="Saving reverses the original entry and records the corrected one, so the ledger keeps a full history."
          />
          <form
            id="edit-transaction-form"
            onSubmit={form.handleSubmit(onSubmit)}
          >
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
              onClick={() => setEditDialogOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="edit-transaction-form"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Saving…" : "Save correction"}
            </Button>
          </RuledDialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmationDialog
        open={confirmDelete}
        onOpenChange={(next) => {
          if (!isDeleting) setConfirmDelete(next);
        }}
        onConfirm={handleDelete}
        pending={isDeleting}
        eyebrow={`( Delete · ${formatted} )`}
        lead="Delete"
        title="this transaction?"
        description={`"${transaction.description || "Untitled"}" will be reversed on both accounts and marked as deleted. It stays in the ledger history.`}
        confirmLabel={isDeleting ? "Deleting…" : "Delete transaction"}
        cancelLabel="Keep it"
      />
    </>
  );
}
