"use client";

import {
  collection,
  doc,
  increment,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import ConfirmationDialog from "@/components/custom/confirmation-dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase/firebase-client";
import {
  type ClientInvoiceDocument,
  deriveStatusFromBalances,
  type InvoicePayment,
  roundMoney,
} from "../../../invoice-model";

type DeleteInvoicePaymentDialogProps = {
  clientId: string;
  invoice: ClientInvoiceDocument;
  payment: InvoicePayment;
  /** Remaining balance after existing payments (total − paid). */
  outstandingAmount?: number;
  disabled?: boolean;
};

export default function DeleteInvoicePaymentDialog({
  clientId,
  invoice,
  payment,
  outstandingAmount,
  disabled = false,
}: DeleteInvoicePaymentDialogProps) {
  const { activeCompany, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!activeCompany || !user) return;

    try {
      setDeleting(true);
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
      const paymentRef = doc(invoiceRef, "payments", payment.id);
      const currentOutstanding = roundMoney(
        outstandingAmount ?? invoice.outstandingAmount,
      );
      const nextOutstanding = roundMoney(currentOutstanding + payment.amount);
      const nextStatus =
        invoice.status === "paid"
          ? deriveStatusFromBalances(
              invoice.totalIncludingVat,
              nextOutstanding,
              "partial",
            )
          : deriveStatusFromBalances(
              invoice.totalIncludingVat,
              nextOutstanding,
              invoice.status,
            );

      batch.update(paymentRef, {
        entityStatus: false,
        updatedAt: serverTimestamp(),
        updatedBy: user.uid,
      });

      batch.update(invoiceRef, {
        outstandingAmount: nextOutstanding,
        status: nextStatus,
        updatedAt: serverTimestamp(),
        updatedBy: user.uid,
      });

      if (payment.transactionId && payment.creditingAccountId) {
        batch.delete(
          doc(
            db,
            "companies",
            activeCompany,
            "accounts",
            payment.creditingAccountId,
            "transactions",
            payment.transactionId,
          ),
        );
        batch.update(
          doc(
            db,
            "companies",
            activeCompany,
            "accounts",
            payment.creditingAccountId,
          ),
          { balance: increment(-payment.amount) },
        );
      }

      if (payment.transactionId && payment.debitingAccountId) {
        batch.delete(
          doc(
            db,
            "companies",
            activeCompany,
            "accounts",
            payment.debitingAccountId,
            "transactions",
            payment.transactionId,
          ),
        );
        batch.update(
          doc(
            db,
            "companies",
            activeCompany,
            "accounts",
            payment.debitingAccountId,
          ),
          { balance: increment(payment.amount) },
        );
      }

      const auditRef = doc(collection(db, "auditLogs"));
      batch.set(auditRef, {
        userId: user.uid,
        companyId: activeCompany,
        action: "delete",
        description: `Payment of ${payment.amount} removed from invoice ${invoice.taxInvoiceNo}`,
        entityStatus: true,
        transactionId: payment.transactionId || payment.id,
        createdAt: serverTimestamp(),
      });

      await batch.commit();
      setOpen(false);
    } catch (error) {
      console.error("Failed to delete invoice payment", error);
    } finally {
      setDeleting(false);
    }
  }

  const amountLabel = roundMoney(payment.amount).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <ConfirmationDialog
      open={open}
      onOpenChange={(next) => {
        if (!deleting) setOpen(next);
      }}
      trigger={
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Delete payment"
          disabled={disabled}
          className="text-muted-foreground hover:bg-danger-soft hover:text-destructive"
        >
          <Trash2 />
        </Button>
      }
      eyebrow={`( Delete payment · LKR ${amountLabel} )`}
      lead="Delete"
      title="this payment?"
      description="The linked account transactions are reversed and the invoice’s outstanding balance is updated."
      confirmLabel={deleting ? "Deleting…" : "Delete payment"}
      cancelLabel="Keep it"
      pending={deleting}
      keepOpen
      onConfirm={() => void handleDelete()}
    />
  );
}
