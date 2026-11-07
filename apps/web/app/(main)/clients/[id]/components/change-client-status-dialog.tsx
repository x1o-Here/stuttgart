"use client";

import {
  collection,
  doc,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { Power } from "lucide-react";
import { useState } from "react";
import ConfirmationDialog from "@/components/custom/confirmation-dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase/firebase-client";
import type { ClientStatus } from "../../components/clients-columns";

type ChangeClientStatusDialogProps = {
  clientId: string;
  clientName: string;
  currentStatus: ClientStatus;
};

export default function ChangeClientStatusDialog({
  clientId,
  clientName,
  currentStatus,
}: ChangeClientStatusDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user, activeCompany } = useAuth();

  const nextStatus: ClientStatus =
    currentStatus === "active" ? "inactive" : "active";

  async function handleConfirm() {
    if (!activeCompany || !user) return;

    try {
      setIsSubmitting(true);
      const batch = writeBatch(db);

      const clientRef = doc(
        db,
        "companies",
        activeCompany,
        "clients",
        clientId,
      );
      batch.update(clientRef, {
        status: nextStatus,
        updatedAt: serverTimestamp(),
      });

      const auditLogRef = doc(collection(db, "auditLogs"));
      batch.set(auditLogRef, {
        userId: user.uid,
        action: "update",
        description: `Client status changed to ${nextStatus}: ${clientName}`,
        companyId: activeCompany,
        entityStatus: true,
        createdAt: serverTimestamp(),
      });

      await batch.commit();
      setOpen(false);
    } catch (error) {
      console.error("Failed to change client status", error);
    } finally {
      setIsSubmitting(false);
    }
  }

  const deactivating = currentStatus === "active";

  return (
    <ConfirmationDialog
      open={open}
      onOpenChange={(next) => {
        if (!isSubmitting) setOpen(next);
      }}
      trigger={
        <Button variant="outline">
          <Power />
          {deactivating ? "Deactivate" : "Activate"}
        </Button>
      }
      eyebrow={`( Client status · ${deactivating ? "Active" : "Inactive"} )`}
      lead={deactivating ? "Deactivate" : "Activate"}
      title={`${clientName}?`}
      description={
        deactivating
          ? "The client is marked inactive. Existing invoices and its account stay as they are."
          : "The client is marked active again and appears in the active register."
      }
      confirmLabel={
        isSubmitting
          ? "Updating…"
          : deactivating
            ? "Deactivate client"
            : "Activate client"
      }
      cancelLabel="Cancel"
      destructive={deactivating}
      pending={isSubmitting}
      keepOpen
      onConfirm={() => void handleConfirm()}
    />
  );
}
