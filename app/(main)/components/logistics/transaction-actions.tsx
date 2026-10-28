"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  arrayUnion,
  collection,
  doc,
  increment,
  serverTimestamp,
  Timestamp,
  writeBatch,
} from "firebase/firestore";
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
import { appendAuditLog } from "@/lib/firebase/audit-log";
import { db } from "@/lib/firebase/firebase-client";
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
      const batch = writeBatch(db);
      const transactionId = transaction.id;

      const reversalTxId = doc(collection(db, "transactions")).id;
      const newTxId = doc(collection(db, "transactions")).id;
      const reversalDate = transaction.date || data.date;
      const reversalCreatedAt = Timestamp.fromMillis(Date.now());
      const correctedCreatedAt = Timestamp.fromMillis(Date.now() + 500);
      const balanceDeltas = new Map<string, number>();

      const addBalanceDelta = (
        accountId: string | undefined,
        delta: number,
      ) => {
        if (!accountId) return;
        balanceDeltas.set(
          accountId,
          (balanceDeltas.get(accountId) || 0) + delta,
        );
      };

      // 1. Reverse the original transaction
      if (transaction.creditingAccountId) {
        const revDebitTxRef = doc(
          db,
          "companies",
          activeCompany,
          "accounts",
          transaction.creditingAccountId,
          "transactions",
          reversalTxId,
        );
        batch.set(revDebitTxRef, {
          date: reversalDate,
          amount: transaction.amount,
          type: "debit",
          department: transaction.department,
          vehicle: transaction.vehicle,
          voucherNo: transaction.voucher,
          description: `Reversal: ${transaction.description}`,
          tags: ["reversal"],
          createdAt: reversalCreatedAt,
        });

        addBalanceDelta(transaction.creditingAccountId, -transaction.amount);

        const oldCreditTxRef = doc(
          db,
          "companies",
          activeCompany,
          "accounts",
          transaction.creditingAccountId,
          "transactions",
          transactionId,
        );
        batch.update(oldCreditTxRef, {
          tags: arrayUnion("corrected"),
          updatedAt: reversalCreatedAt,
        });
      }

      if (transaction.debitingAccountId) {
        const revCreditTxRef = doc(
          db,
          "companies",
          activeCompany,
          "accounts",
          transaction.debitingAccountId,
          "transactions",
          reversalTxId,
        );
        batch.set(revCreditTxRef, {
          date: reversalDate,
          amount: transaction.amount,
          type: "credit",
          department: transaction.department,
          vehicle: transaction.vehicle,
          voucherNo: transaction.voucher,
          description: `Reversal: ${transaction.description}`,
          tags: ["reversal"],
          createdAt: reversalCreatedAt,
        });

        addBalanceDelta(transaction.debitingAccountId, transaction.amount);

        const oldDebitTxRef = doc(
          db,
          "companies",
          activeCompany,
          "accounts",
          transaction.debitingAccountId,
          "transactions",
          transactionId,
        );
        batch.update(oldDebitTxRef, {
          tags: arrayUnion("corrected"),
          updatedAt: reversalCreatedAt,
        });
      }

      // 2. Add the new transaction entry
      const newCreditTxRef = doc(
        db,
        "companies",
        activeCompany,
        "accounts",
        data.creditingAccount,
        "transactions",
        newTxId,
      );
      batch.set(newCreditTxRef, {
        date: data.date,
        amount: data.amount,
        type: "credit",
        department: data.department,
        vehicle: data.vehicle,
        voucherNo: data.voucherNo,
        description: data.description,
        createdAt: correctedCreatedAt,
      });

      addBalanceDelta(data.creditingAccount, data.amount);

      const newDebitTxRef = doc(
        db,
        "companies",
        activeCompany,
        "accounts",
        data.debitingAccount,
        "transactions",
        newTxId,
      );
      batch.set(newDebitTxRef, {
        date: data.date,
        amount: data.amount,
        type: "debit",
        department: data.department,
        vehicle: data.vehicle,
        voucherNo: data.voucherNo,
        description: data.description,
        createdAt: correctedCreatedAt,
      });

      addBalanceDelta(data.debitingAccount, -data.amount);

      // One balance write per account (coalesced deltas)
      for (const [accountId, delta] of balanceDeltas) {
        if (delta === 0) continue;
        batch.update(
          doc(db, "companies", activeCompany, "accounts", accountId),
          { balance: increment(delta) },
        );
      }

      appendAuditLog(batch, {
        userId: user?.uid,
        transactionId: newTxId,
        action: "update-with-reversal",
        description: `Transaction reversed and updated`,
        companyId: activeCompany,
        entityStatus: true,
        createdAt: correctedCreatedAt,
      });

      await batch.commit();

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
      const batch = writeBatch(db);
      const transactionId = transaction.id;
      const reversalTxId = doc(collection(db, "transactions")).id;

      if (transaction.creditingAccountId) {
        const revDebitTxRef = doc(
          db,
          "companies",
          activeCompany,
          "accounts",
          transaction.creditingAccountId,
          "transactions",
          reversalTxId,
        );
        batch.set(revDebitTxRef, {
          date: transaction.date || new Date(),
          amount: transaction.amount,
          type: "debit",
          department: transaction.department,
          vehicle: transaction.vehicle,
          voucherNo: transaction.voucher,
          description: `Reversal: ${transaction.description}`,
          tags: ["reversal"],
          createdAt: serverTimestamp(),
        });

        const oldCreditAccountRef = doc(
          db,
          "companies",
          activeCompany,
          "accounts",
          transaction.creditingAccountId,
        );
        batch.update(oldCreditAccountRef, {
          balance: increment(-transaction.amount),
        });

        const oldCreditTxRef = doc(
          db,
          "companies",
          activeCompany,
          "accounts",
          transaction.creditingAccountId,
          "transactions",
          transactionId,
        );
        batch.update(oldCreditTxRef, {
          tags: arrayUnion("deleted"),
          updatedAt: serverTimestamp(),
        });
      }

      if (transaction.debitingAccountId) {
        const revCreditTxRef = doc(
          db,
          "companies",
          activeCompany,
          "accounts",
          transaction.debitingAccountId,
          "transactions",
          reversalTxId,
        );
        batch.set(revCreditTxRef, {
          date: transaction.date || new Date(),
          amount: transaction.amount,
          type: "credit",
          department: transaction.department,
          vehicle: transaction.vehicle,
          voucherNo: transaction.voucher,
          description: `Reversal: ${transaction.description}`,
          tags: ["reversal"],
          createdAt: serverTimestamp(),
        });

        const oldDebitAccountRef = doc(
          db,
          "companies",
          activeCompany,
          "accounts",
          transaction.debitingAccountId,
        );
        batch.update(oldDebitAccountRef, {
          balance: increment(transaction.amount),
        });

        const oldDebitTxRef = doc(
          db,
          "companies",
          activeCompany,
          "accounts",
          transaction.debitingAccountId,
          "transactions",
          transactionId,
        );
        batch.update(oldDebitTxRef, {
          tags: arrayUnion("deleted"),
          updatedAt: serverTimestamp(),
        });
      }

      // Audit log for the edits
      appendAuditLog(batch, {
        userId: user?.uid,
        transactionId: reversalTxId,
        action: "delete",
        description: `Transaction deleted and reversed`,
        companyId: activeCompany,
        entityStatus: false,
      });

      await batch.commit();

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
