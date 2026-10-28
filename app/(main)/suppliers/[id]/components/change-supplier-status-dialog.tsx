"use client";

import { doc, serverTimestamp, writeBatch } from "firebase/firestore";
import { Power } from "lucide-react";
import { useState } from "react";
import ConfirmationDialog from "@/components/custom/confirmation-dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { appendAuditLog } from "@/lib/firebase/audit-log";
import { db } from "@/lib/firebase/firebase-client";
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
      const batch = writeBatch(db);
      batch.update(
        doc(db, "companies", activeCompany, "suppliers", supplier.id),
        { status: nextStatus, updatedAt: serverTimestamp() },
      );
      appendAuditLog(batch, {
        userId: user.uid,
        companyId: activeCompany,
        action: "update",
        description: `Supplier status changed to ${nextStatus}: ${supplier.name}`,
      });
      await batch.commit();
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
