"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import ConfirmationDialog from "@/components/custom/confirmation-dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import {
  deleteSupplierInvoice,
  SupplierInvoiceError,
} from "@/lib/suppliers/supplier-invoices";
import type { Supplier, SupplierInvoice } from "@/lib/suppliers/supplier-model";

export function DeleteSupplierInvoiceDialog({
  supplier,
  invoice,
  hasPayments,
}: {
  supplier: Supplier;
  invoice: SupplierInvoice;
  hasPayments: boolean;
}) {
  const router = useRouter();
  const { user, activeCompany } = useAuth();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!activeCompany || !user) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteSupplierInvoice(
        activeCompany,
        user.uid,
        { id: supplier.id, name: supplier.name },
        invoice,
      );
      setOpen(false);
      router.push(`/suppliers/${supplier.id}`);
    } catch (err) {
      console.error("Failed to delete supplier invoice", err);
      setError(
        err instanceof SupplierInvoiceError
          ? err.message
          : "Couldn’t delete the invoice. Please try again.",
      );
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
          variant="outline"
          disabled={hasPayments}
          title={
            hasPayments ? "Delete this invoice’s payments first." : undefined
          }
        >
          <Trash2 />
          Delete
        </Button>
      }
      eyebrow={`( Delete · ${invoice.taxInvoiceNo} )`}
      lead="Delete"
      title="this invoice?"
      description="It’s removed from the supplier’s invoices and its tax invoice number becomes free to use again."
      confirmLabel={deleting ? "Deleting…" : "Delete invoice"}
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
