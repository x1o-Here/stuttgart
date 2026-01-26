"use client";

import {
  collection,
  doc,
  increment,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { Delete } from "lucide-react";
import { ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/auth-context";
import { useVehicleContext } from "@/contexts/useVehicleContext";
import { db } from "@/lib/firebase/firebase-client";

interface DeletionDialogProps {
  quotationId: string;
  paymentId: string;
  amount: number;
  method: string;
  title?: string;
  description?: string;
}

export default function QuotationPaymentDeletionDialog({
  quotationId,
  paymentId,
  amount,
  method,
  title = "Are you sure?",
  description = "This action cannot be undone.",
}: DeletionDialogProps) {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const { vehicle } = useVehicleContext();

  const handleConfirm = async () => {
    try {
      const batch = writeBatch(db);

      /** 1️⃣ Soft delete quotation payment */
      const paymentRef = doc(
        db,
        "quotations",
        quotationId,
        "quotationPayments",
        paymentId,
      );
      batch.update(paymentRef, {
        entityStatus: false,
        updatedAt: serverTimestamp(),
      });

      /** 2️⃣ Credit reversal transaction */
      const transactionRef = doc(
        collection(db, "accounts", method, "transactions"),
      );
      batch.set(transactionRef, {
        date: new Date(),
        amount,
        vehicleId: vehicle?.id || "",
        type: "credit",
        description: "Quotation payment reversal",
        createdAt: serverTimestamp(),
      });

      /** 3️⃣ Update account balance */
      const accountRef = doc(db, "accounts", method);
      batch.update(accountRef, {
        balance: increment(amount),
      });

      /** 4️⃣ Add Audit Log */
      const auditLogRef = doc(collection(db, "auditLogs"));
      batch.set(auditLogRef, {
        userId: user?.uid,
        vehicleId: vehicle?.id || "",
        action: "delete",
        description: "Quotation payment deleted",
        entityStatus: true,
        createdAt: serverTimestamp(),
      });

      await batch.commit();

      setOpen(false);
    } catch (error) {
      console.error("Payment deletion failed:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon-sm">
          <Delete />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <p className="text-sm text-gray-600 mt-2">{description}</p>
        </DialogHeader>
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={async () => {
              await handleConfirm();
              setOpen(false);
            }}
          >
            Yes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
