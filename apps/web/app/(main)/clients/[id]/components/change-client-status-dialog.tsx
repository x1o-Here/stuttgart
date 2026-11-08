"use client";

import { Power } from "lucide-react";
import { useState } from "react";
import ConfirmationDialog from "@/components/custom/confirmation-dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { useSetClientStatus } from "@/lib/data/clients";
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
  const { user, activeCompany } = useAuth();
  const setClientStatus = useSetClientStatus(activeCompany, clientId);
  const isSubmitting = setClientStatus.isPending;

  const nextStatus: ClientStatus =
    currentStatus === "active" ? "inactive" : "active";

  async function handleConfirm() {
    if (!activeCompany || !user) return;

    try {
      await setClientStatus.mutateAsync({ status: nextStatus, clientName });
      setOpen(false);
    } catch (error) {
      console.error("Failed to change client status", error);
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
