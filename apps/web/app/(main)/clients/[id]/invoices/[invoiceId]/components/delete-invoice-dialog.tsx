"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import ConfirmationDialog from "@/components/custom/confirmation-dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { deleteInvoice } from "@/lib/data/ledger";

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
      await deleteInvoice({
        activeCompany,
        clientId,
        invoiceId,
        taxInvoiceNo,
        user,
      });
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
