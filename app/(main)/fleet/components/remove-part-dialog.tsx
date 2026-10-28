"use client";

import { PackageMinus } from "lucide-react";
import { useState } from "react";
import ConfirmationDialog from "@/components/custom/confirmation-dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import {
  InventoryError,
  releasePart,
  type SparePart,
} from "@/lib/inventory/spare-parts";
import { cn } from "@/lib/utils";

const OPTIONS = [
  {
    value: "stock",
    title: "Return to stock",
    detail: "The part is available in Inventory again.",
  },
  {
    value: "scrapped",
    title: "Mark as scrapped",
    detail: "Worn or damaged. It leaves stock but stays in history.",
  },
] as const;

/** Removes a part from a vehicle, asking whether it returns to stock. */
export function RemovePartDialog({
  part,
  vehicleName,
}: {
  part: SparePart;
  vehicleName: string;
}) {
  const { user, activeCompany } = useAuth();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"stock" | "scrapped">("stock");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRemove() {
    if (!activeCompany || !user) return;
    setSaving(true);
    setError(null);
    try {
      await releasePart(activeCompany, user.uid, part.id, mode, vehicleName);
      setOpen(false);
    } catch (err) {
      console.error("Failed to remove spare part", err);
      setError(
        err instanceof InventoryError
          ? err.message
          : "Couldn’t remove the part. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <ConfirmationDialog
      open={open}
      onOpenChange={(next) => {
        if (saving) return;
        setOpen(next);
        if (next) {
          setMode("stock");
          setError(null);
        }
      }}
      trigger={
        <Button variant="outline" size="sm">
          <PackageMinus />
          Remove
        </Button>
      }
      eyebrow={`( ${vehicleName} · ${part.partId} )`}
      lead="Remove"
      title="this part?"
      description={part.description}
      confirmLabel={
        saving
          ? "Removing…"
          : mode === "stock"
            ? "Return to stock"
            : "Mark as scrapped"
      }
      cancelLabel="Keep fitted"
      destructive={mode === "scrapped"}
      pending={saving}
      keepOpen
      onConfirm={() => void handleRemove()}
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="eyebrow mb-2 normal-case tracking-normal">
          What happens to it?
        </legend>
        {OPTIONS.map((option) => (
          <label
            key={option.value}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2.5 transition-colors hover:bg-surface-muted",
              mode === option.value && "border-foreground bg-surface-muted",
            )}
          >
            <input
              type="radio"
              name={`remove-${part.id}`}
              value={option.value}
              checked={mode === option.value}
              onChange={() => setMode(option.value)}
              className="mt-1 accent-[var(--foreground)]"
            />
            <span className="flex flex-col">
              <span className="text-sm font-medium">{option.title}</span>
              <span className="text-xs text-muted-foreground">
                {option.detail}
              </span>
            </span>
          </label>
        ))}
        {error ? (
          <p
            role="alert"
            className="rounded-md bg-danger-soft px-3 py-2 text-sm text-destructive"
          >
            {error}
          </p>
        ) : null}
      </fieldset>
    </ConfirmationDialog>
  );
}
