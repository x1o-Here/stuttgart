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
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" disabled={disabled}>
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete invoice?</AlertDialogTitle>
          <AlertDialogDescription>
            Invoice <strong>{taxInvoiceNo || invoiceId}</strong> will be
            removed. This cannot be undone from the invoices list.
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
