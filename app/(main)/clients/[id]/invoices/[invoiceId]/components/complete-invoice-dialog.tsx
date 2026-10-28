"use client";

import {
  collection,
  doc,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { useState } from "react";
import ConfirmationDialog from "@/components/custom/confirmation-dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase/firebase-client";
import {
  type ClientInvoiceDocument,
  canCompleteInvoice,
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
        Complete
      </Button>
    );
  }

  const money = (value: number) =>
    roundMoney(value).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  return (
    <ConfirmationDialog
      open={open}
      onOpenChange={(next) => {
        if (!completing) setOpen(next);
      }}
      trigger={<Button disabled={!canComplete}>Complete invoice</Button>}
      eyebrow={`( Complete · Invoice ${invoice.taxInvoiceNo || "–"} )`}
      lead="Complete"
      title="this invoice?"
      description={
        canComplete
          ? `Payments cover the full LKR ${money(invoice.totalIncludingVat)}. Outstanding is set to 0 and the status to Complete.`
          : `Payments must cover the full amount first. Outstanding: LKR ${money(invoice.outstandingAmount)}.`
      }
      confirmLabel={completing ? "Completing…" : "Complete invoice"}
      cancelLabel="Cancel"
      destructive={false}
      pending={completing}
      confirmDisabled={!canComplete}
      keepOpen
      onConfirm={() => void handleComplete()}
    />
  );
}
