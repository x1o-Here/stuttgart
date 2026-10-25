"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import ConfirmationDialog from "@/components/custom/confirmation-dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { type CollectionKey, useLookupStore } from "@/stores/use-lookup-store";

interface DeleteModalProps {
  entityLabel: string;
  itemId: string;
  itemName: string;
  onDeleted?: () => void;
  /** "icon" for table rows (default), "button" for page headers. */
  triggerVariant?: "icon" | "button";
}

export default function DeleteModal({
  entityLabel,
  itemId,
  itemName,
  onDeleted,
  triggerVariant = "icon",
}: DeleteModalProps) {
  const [open, setOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { user, activeCompany } = useAuth();
  const deleteItem = useLookupStore((s) => s.deleteItem);

  const label = entityLabel.toLowerCase();
  const collectionKey: CollectionKey =
    label === "vehicle"
      ? "vehicles"
      : label === "account type"
        ? "account-types"
        : "departments";

  const handleDelete = async () => {
    if (!activeCompany || !user) return;
    try {
      setIsDeleting(true);
      await deleteItem(
        activeCompany,
        user.uid,
        collectionKey,
        itemId,
        itemName,
      );
      setOpen(false);
      onDeleted?.();
    } catch (error) {
      console.error(`Failed to delete ${entityLabel.toLowerCase()}`, error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <ConfirmationDialog
      open={open}
      onOpenChange={(next) => {
        if (!isDeleting) setOpen(next);
      }}
      trigger={
        triggerVariant === "button" ? (
          <Button variant="outline">
            <Trash2 />
            Delete
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Delete ${itemName}`}
            className="text-muted-foreground hover:bg-danger-soft hover:text-destructive"
            onClick={(event) => event.stopPropagation()}
          >
            <Trash2 />
          </Button>
        )
      }
      eyebrow={`( Delete ${label} )`}
      lead="Delete"
      title={`${itemName}?`}
      description={`This ${label} is removed from your lists. Existing transactions keep the name they were recorded with. This can’t be undone.`}
      confirmLabel={isDeleting ? "Deleting…" : `Delete ${label}`}
      cancelLabel="Keep it"
      pending={isDeleting}
      keepOpen
      onConfirm={() => void handleDelete()}
    />
  );
}
