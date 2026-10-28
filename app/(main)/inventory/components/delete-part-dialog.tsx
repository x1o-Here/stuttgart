"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import ConfirmationDialog from "@/components/custom/confirmation-dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import {
  deletePart,
  InventoryError,
  type SparePart,
} from "@/lib/inventory/spare-parts";

export function DeletePartDialog({ part }: { part: SparePart }) {
  const { user, activeCompany } = useAuth();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const assigned = part.status === "assigned";

  async function handleDelete() {
    if (!activeCompany || !user) return;
    setDeleting(true);
    setError(null);
    try {
      await deletePart(activeCompany, user.uid, part.id);
      setOpen(false);
    } catch (err) {
      console.error("Failed to delete spare part", err);
      setError(
        err instanceof InventoryError
          ? err.message
          : "Couldn’t delete the part. Please try again.",
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
          variant="ghost"
          size="icon-sm"
          aria-label={
            assigned
              ? `${part.partId} is on a vehicle; remove it there first`
              : `Delete ${part.partId}`
          }
          title={
            assigned
              ? "On a vehicle. Remove it from the vehicle page first."
              : undefined
          }
          disabled={assigned}
          className="text-muted-foreground hover:bg-danger-soft hover:text-destructive"
        >
          <Trash2 />
        </Button>
      }
      eyebrow={`( Delete · ${part.partId} )`}
      lead="Delete"
      title="this spare part?"
      description="It’s removed from inventory and its part ID becomes free to reuse. The change is kept in the audit log."
      confirmLabel={deleting ? "Deleting…" : "Delete part"}
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
