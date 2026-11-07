"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import type { InvoicePayment } from "@/app/(main)/clients/[id]/invoice-model";
import ConfirmationDialog from "@/components/custom/confirmation-dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import {
  deleteSupplierPayment,
  SupplierInvoiceError,
} from "@/lib/suppliers/supplier-invoices";
import type { Supplier } from "@/lib/suppliers/supplier-model";

export function DeleteSupplierPaymentDialog({
  supplier,
  invoiceId,
  payment,
}: {
  supplier: Supplier;
  invoiceId: string;
  payment: InvoicePayment;
}) {
  const { user, activeCompany } = useAuth();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const amountLabel = payment.amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  async function handleDelete() {
    if (!activeCompany || !user) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteSupplierPayment(
        activeCompany,
        user.uid,
        { id: supplier.id, name: supplier.name },
        invoiceId,
        payment,
      );
      setOpen(false);
    } catch (err) {
      console.error("Failed to delete supplier payment", err);
      setError(
        err instanceof SupplierInvoiceError
          ? err.message
          : "Couldn’t delete the payment. Please try again.",
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <ConfirmationDialog
      open={open}
      onOpenChange={(next) => {
        if (deleting) return;
        setOpen(next);
        if (next) setError(null);
      }}
      trigger={
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Delete payment"
          className="text-muted-foreground hover:bg-danger-soft hover:text-destructive"
        >
          <Trash2 />
        </Button>
      }
      eyebrow={`( Delete payment · LKR ${amountLabel} )`}
      lead="Delete"
      title="this payment?"
      description="Both ledger entries are reversed and the invoice’s outstanding amount goes back up."
      confirmLabel={deleting ? "Deleting…" : "Delete payment"}
      cancelLabel="Keep it"
      pending={deleting}
      keepOpen
      onConfirm={() => void handleDelete()}
    >
      {error ? (
        <p
          role="alert"
          className="rounded-md bg-danger-soft px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}
    </ConfirmationDialog>
  );
}
