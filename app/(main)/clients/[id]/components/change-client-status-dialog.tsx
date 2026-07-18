"use client";

import {
  collection,
  doc,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant={currentStatus === "active" ? "default" : "outline"}>
          {currentStatus === "active" ? "Deactivate Client" : "Activate Client"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {currentStatus === "active"
              ? "Deactivate this client?"
              : "Activate this client?"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {currentStatus === "active"
              ? `${clientName} will be marked as inactive.`
              : `${clientName} will be marked as active.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault();
              void handleConfirm();
            }}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Updating..." : "Confirm"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
