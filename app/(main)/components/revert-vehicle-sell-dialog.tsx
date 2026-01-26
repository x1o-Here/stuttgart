"use client";

import {
  collection,
  doc,
  getDocs,
  increment,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/auth-context";
import { useAccountsContext } from "@/contexts/useAccountsContext";
import { db } from "@/lib/firebase/firebase-client";
import type { Vehicle } from "./columns";

interface ConfirmationDialogProps {
  vehicle: Vehicle;
  title?: string;
  description?: string;
}

export default function RevertSellVehicleDialog({
  vehicle,
  title = "Are you sure you want to revert this vehicle sale?",
  description = "This action cannot be undone.",
}: ConfirmationDialogProps) {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const { accounts } = useAccountsContext();

  const handleConfirm = async () => {
    try {
      const batch = writeBatch(db);

      // 1️⃣ Get all sales payments
      const salesPaymentsCol = collection(
        db,
        "salesDetails",
        vehicle.id,
        "salesPayments",
      );
      const paymentsSnap = await getDocs(salesPaymentsCol);

      for (const paymentDoc of paymentsSnap.docs) {
        const payment = paymentDoc.data();
        const accountId = payment.method;
        const amount = payment.amount || 0;

        const account = accounts.find((a) => a.id === accountId);
        if (!account) continue;

        // 2️⃣ Reverse the balance (Sales payment was credit -> reversal is debit)
        const accountRef = doc(db, "accounts", accountId);
        batch.update(accountRef, {
          balance: increment(-amount),
        });

        // 3️⃣ Add reversal transaction
        const transactionRef = doc(
          collection(db, "accounts", accountId, "transactions"),
        );
        batch.set(transactionRef, {
          date: new Date(),
          vehicleId: vehicle.id,
          amount: amount,
          type: "debit",
          description: `Reversal of sales payment for vehicle ${vehicle.id} (Sale Reverted)`,
          createdAt: serverTimestamp(),
        });

        // 4️⃣ Soft delete the sales payment record too?
        // Previous logic didn't delete it, but typically we should if reverting.
        // For now, following soft delete pattern:
        batch.update(paymentDoc.ref, {
          entityStatus: false,
          updatedAt: serverTimestamp(),
        });
      }

      // 5️⃣ Update vehicle status back to active
      const vehicleRef = doc(db, "vehicles", vehicle.id);
      batch.update(vehicleRef, {
        vehicleStatus: "active",
        updatedAt: serverTimestamp(),
      });

      // 6️⃣ Reset salesDetails
      const salesDetailsRef = doc(db, "salesDetails", vehicle.id);
      batch.update(salesDetailsRef, {
        salesAmount: 0,
        salesDate: null,
        buyerName: "",
        buyerContact: "",
        updatedAt: serverTimestamp(),
      });

      // 7️⃣ Add Audit Log
      const auditLogRef = doc(collection(db, "auditLogs"));
      batch.set(auditLogRef, {
        userId: user?.uid,
        vehicleId: vehicle.id,
        action: "update",
        description: `Sale of vehicle ${vehicle.vehicleNo} reverted`,
        entityStatus: true,
        createdAt: serverTimestamp(),
      });

      await batch.commit();
      setOpen(false);
    } catch (error) {
      console.error("Failed to revert vehicle sale", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            setOpen(true);
          }}
        >
          Revert vehicle sale
        </DropdownMenuItem>
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
