"use client";

import {
  collection,
  doc,
  getDocs,
  increment,
  query,
  serverTimestamp,
  where,
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

export default function DeletionDialog({
  vehicle,
  title = "Are you sure?",
  description = "This action cannot be undone.",
}: ConfirmationDialogProps) {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const { accounts } = useAccountsContext();

  const handleConfirm = async () => {
    try {
      const batch = writeBatch(db);

      // 1️⃣ Fetch all associated payments BEFORE constructing the batch
      const [purchaseSnap, salesSnap, quotationsSnap] = await Promise.all([
        getDocs(
          collection(db, "purchaseDetails", vehicle.id, "purchasePayments"),
        ),
        getDocs(collection(db, "salesDetails", vehicle.id, "salesPayments")),
        getDocs(
          query(
            collection(db, "quotations"),
            where("vehicleId", "==", vehicle.id),
          ),
        ),
      ]);

      // Helper to add reversal to batch
      const addReversalToBatch = (
        payment: { amount: number; method: string },
        isDebit: boolean, // original was debit?
        typeLabel: string,
      ) => {
        const account = accounts.find((a) => a.id === payment.method);
        if (!account) return;

        // Reversal: if original was debit, we credit (add). If original was credit, we debit (subtract).
        // Wait, logic in previous code:
        // isDebit = type === "sales" -> sales payments are "cash in" usually?
        // Actually, purchase = money out (debit), sale = money in (credit).
        // Reversal: purchase reversal = credit, sale reversal = debit.
        const reversalType = isDebit ? "credit" : "debit";
        const balanceChange = isDebit ? payment.amount : -payment.amount;

        const txRef = doc(
          collection(db, "accounts", payment.method, "transactions"),
        );
        batch.set(txRef, {
          date: new Date(),
          vehicleId: vehicle.id,
          amount: payment.amount,
          type: reversalType,
          description: `${typeLabel} payment reversal (Vehicle Deletion)`,
          createdAt: serverTimestamp(),
        });

        const accountRef = doc(db, "accounts", payment.method);
        batch.update(accountRef, {
          balance: increment(balanceChange),
        });
      };

      // 2️⃣ Process Purchase Payments (Original: Debit -> Reversal: Credit)
      purchaseSnap.forEach((snap) => {
        addReversalToBatch(snap.data() as any, false, "Purchase");
        batch.update(snap.ref, {
          entityStatus: false,
          updatedAt: serverTimestamp(),
        });
      });

      // 3️⃣ Process Sales Payments (Original: Credit -> Reversal: Debit)
      salesSnap.forEach((snap) => {
        addReversalToBatch(snap.data() as any, true, "Sales");
        batch.update(snap.ref, {
          entityStatus: false,
          updatedAt: serverTimestamp(),
        });
      });

      // 4️⃣ Process Quotation Payments (Original: Debit -> Reversal: Credit)
      for (const qDoc of quotationsSnap.docs) {
        const pSnap = await getDocs(
          collection(db, "quotations", qDoc.id, "quotationPayments"),
        );
        pSnap.forEach((snap) => {
          addReversalToBatch(snap.data() as any, false, "Quotation");
          batch.update(snap.ref, {
            entityStatus: false,
            updatedAt: serverTimestamp(),
          });
        });
        batch.update(qDoc.ref, {
          entityStatus: false,
          updatedAt: serverTimestamp(),
        });
      }

      // 5️⃣ Soft delete vehicle
      const vehicleRef = doc(db, "vehicles", vehicle.id);
      batch.update(vehicleRef, {
        entityStatus: false,
        updatedAt: serverTimestamp(),
      });

      // 6️⃣ Add Audit Log
      const auditLogRef = doc(collection(db, "auditLogs"));
      batch.set(auditLogRef, {
        userId: user?.uid,
        vehicleId: vehicle.id,
        action: "delete",
        description: `Vehicle ${vehicle.vehicleNo} deleted and all payments reversed`,
        entityStatus: true,
        createdAt: serverTimestamp(),
      });

      await batch.commit();
      console.log("Vehicle deletion processed successfully");
      setOpen(false);
    } catch (err) {
      console.error("Failed to delete vehicle", err);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <DropdownMenuItem
          className="text-red-600 focus:text-red-600"
          onSelect={(e) => {
            e.preventDefault();
            setOpen(true);
          }}
        >
          Delete vehicle
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
