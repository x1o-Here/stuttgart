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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          className="text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="mr-1 h-3.5 w-3.5" />
          Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete payment?</AlertDialogTitle>
          <AlertDialogDescription>
            This payment of{" "}
            <strong>
              {roundMoney(payment.amount).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </strong>{" "}
            will be removed, linked account transactions will be reversed, and
            the outstanding balance will be updated.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={deleting}
            onClick={(event) => {
              event.preventDefault();
              void handleDelete();
            }}
          >
            {deleting ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
