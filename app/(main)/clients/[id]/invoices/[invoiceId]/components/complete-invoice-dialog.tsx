"use client";

import {
  collection,
  doc,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
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
  canCompleteInvoice,
  type ClientInvoiceDocument,
  roundMoney,
} from "../../../invoice-model";

type CompleteInvoiceDialogProps = {
  clientId: string;
  invoice: ClientInvoiceDocument;
};

export default function CompleteInvoiceDialog({
  clientId,
  invoice,
}: CompleteInvoiceDialogProps) {
  const { activeCompany, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [completing, setCompleting] = useState(false);
  const canComplete = canCompleteInvoice(
    invoice.totalIncludingVat,
    invoice.outstandingAmount,
    invoice.status,
  );

  async function handleComplete() {
    if (!activeCompany || !user || !canComplete) return;

    try {
      setCompleting(true);
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

      batch.update(invoiceRef, {
        status: "paid",
        outstandingAmount: 0,
        updatedAt: serverTimestamp(),
        updatedBy: user.uid,
      });

      const auditRef = doc(collection(db, "auditLogs"));
      batch.set(auditRef, {
        userId: user.uid,
        companyId: activeCompany,
        action: "update",
        description: `Invoice ${invoice.taxInvoiceNo} marked as completed/paid`,
        entityStatus: true,
        transactionId: invoice.id,
        createdAt: serverTimestamp(),
      });

      await batch.commit();
      setOpen(false);
    } catch (error) {
      console.error("Failed to complete invoice", error);
    } finally {
      setCompleting(false);
    }
  }

  if (invoice.status === "paid") {
    return (
      <Button disabled variant="outline">
        Completed
      </Button>
    );
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button disabled={!canComplete}>Complete Invoice</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Complete this invoice?</AlertDialogTitle>
          <AlertDialogDescription>
            {canComplete
              ? `Payments cover the full amount of ${roundMoney(invoice.totalIncludingVat).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}. Marking it complete will set the status to paid.`
              : `Payments must cover the full invoice amount before you can complete it. Outstanding: ${roundMoney(invoice.outstandingAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={completing}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={completing || !canComplete}
            onClick={(event) => {
              event.preventDefault();
              void handleComplete();
            }}
          >
            {completing ? "Completing..." : "Complete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
