"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import ConfirmationDialog from "@/components/custom/confirmation-dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { deleteInvoicePayment } from "@/lib/data/ledger";
import {
  type ClientInvoiceDocument,
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
      await deleteInvoicePayment({
        activeCompany,
        clientId,
        invoice,
        payment,
        outstandingAmount,
        user,
      });
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
