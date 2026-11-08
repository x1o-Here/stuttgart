"use client";

import { Power } from "lucide-react";
import { useState } from "react";
import ConfirmationDialog from "@/components/custom/confirmation-dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { setSupplierStatus } from "@/lib/data/ledger";
import type { Supplier } from "@/lib/suppliers/supplier-model";

export default function ChangeSupplierStatusDialog({
  supplier,
}: {
  supplier: Supplier;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const { user, activeCompany } = useAuth();
  const deactivating = supplier.status === "active";
  const nextStatus = deactivating ? "inactive" : "active";

  async function handleConfirm() {
    if (!activeCompany || !user) return;
    setSaving(true);
    try {
      await setSupplierStatus({ activeCompany, supplier, nextStatus, user });
      setOpen(false);
    } catch (error) {
      console.error("Failed to change supplier status", error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ConfirmationDialog
      open={open}
      onOpenChange={(next) => {
        if (!saving) setOpen(next);
      }}
      trigger={
        <Button variant="outline">
          <Power />
          {deactivating ? "Deactivate" : "Activate"}
        </Button>
      }
      eyebrow={`( Supplier status · ${deactivating ? "Active" : "Inactive"} )`}
      lead={deactivating ? "Deactivate" : "Activate"}
      title={`${supplier.name}?`}
      description={
        deactivating
          ? "The supplier is marked inactive. Existing invoices, payments and its account stay as they are."
          : "The supplier is marked active again."
      }
      confirmLabel={
        saving
          ? "Updating…"
          : deactivating
            ? "Deactivate supplier"
            : "Activate supplier"
      }
      cancelLabel="Cancel"
      destructive={deactivating}
      pending={saving}
      keepOpen
      onConfirm={() => void handleConfirm()}
    />
  );
}
