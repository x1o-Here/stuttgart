"use client";

import {
  collection,
  doc,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import ConfirmationDialog from "@/components/custom/confirmation-dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase/firebase-client";

type DeleteInvoiceDialogProps = {
  clientId: string;
  invoiceId: string;
  taxInvoiceNo: string;
  disabled?: boolean;
};

export default function DeleteInvoiceDialog({
  clientId,
  invoiceId,
  taxInvoiceNo,
  disabled = false,
}: DeleteInvoiceDialogProps) {
  const router = useRouter();
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
        invoiceId,
      );
      batch.update(invoiceRef, {
        entityStatus: false,
        status: "cancelled",
        updatedAt: serverTimestamp(),
        updatedBy: user.uid,
      });

      const auditRef = doc(collection(db, "auditLogs"));
      batch.set(auditRef, {
        userId: user.uid,
        companyId: activeCompany,
        action: "delete",
        description: `Invoice ${taxInvoiceNo || invoiceId} deleted`,
        entityStatus: true,
        transactionId: invoiceId,
        createdAt: serverTimestamp(),
      });

      await batch.commit();
      setOpen(false);
      router.push(`/clients/${clientId}`);
    } catch (error) {
      console.error("Failed to delete invoice", error);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <ConfirmationDialog
      open={open}
      onOpenChange={(next) => {
        if (!deleting) setOpen(next);
      }}
      trigger={
        <Button variant="outline" disabled={disabled}>
          <Trash2 />
          Delete
        </Button>
      }
      eyebrow={`( Delete · ${taxInvoiceNo || invoiceId} )`}
      lead="Delete"
      title="this invoice?"
      description="It is cancelled and removed from the client’s invoice list. This can’t be undone from the list."
      confirmLabel={deleting ? "Deleting…" : "Delete invoice"}
      cancelLabel="Keep it"
      pending={deleting}
      keepOpen
      onConfirm={() => void handleDelete()}
    />
  );
}
