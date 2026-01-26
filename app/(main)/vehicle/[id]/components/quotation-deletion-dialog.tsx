'use client'

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { db } from "@/lib/firebase/firebase-client";
import { collection, doc, getDocs, increment, serverTimestamp, writeBatch } from "firebase/firestore";
import { Delete } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/contexts/auth-context";

interface QuotationDeletionDialogProps {
    quotationId: string;
    vehicleId: string;
    title?: string
    description?: string
}

export default function QuotationDeletionDialog({
    quotationId,
    vehicleId,
    title = "Are you sure?",
    description = "This action cannot be undone.",
}: QuotationDeletionDialogProps) {
    const [open, setOpen] = useState(false);
    const { user } = useAuth();

    async function handleConfirm() {
        if (!quotationId) return

        try {
            const batch = writeBatch(db)

            /** 1️⃣ Fetch quotation payments */
            const paymentsRef = collection(
                db,
                "quotations",
                quotationId,
                "quotationPayments"
            )
            const snapshot = await getDocs(paymentsRef)

            /** 2️⃣ Sum amounts per account */
            const totalsByAccount: Record<string, number> = {}

            snapshot.forEach((docSnap) => {
                const { amount, method, entityStatus } = docSnap.data()
                if (entityStatus === false) return // Skip already deleted
                if (!method || !amount) return

                totalsByAccount[method] =
                    (totalsByAccount[method] || 0) + Number(amount)

                /** Soft delete payment */
                batch.update(docSnap.ref, {
                    entityStatus: false,
                    updatedAt: serverTimestamp(),
                })
            })

            /** 3️⃣ Credit accounts + add transactions */
            for (const [accountId, total] of Object.entries(totalsByAccount)) {
                const accountRef = doc(db, "accounts", accountId)
                const transactionRef = doc(
                    collection(db, "accounts", accountId, "transactions")
                )

                // Update account balance
                batch.update(accountRef, {
                    balance: increment(total),
                })

                // Add transaction
                batch.set(transactionRef, {
                    date: new Date(),
                    vehicleId,
                    description: "Quotation deleted – payment reversal",
                    amount: total,
                    type: "credit",
                    createdAt: serverTimestamp(),
                })
            }

            /** 4️⃣ Soft delete quotation */
            batch.update(doc(db, "quotations", quotationId), {
                entityStatus: false,
                updatedAt: serverTimestamp(),
            })

            /** 5️⃣ Add Audit Log */
            const auditLogRef = doc(collection(db, "auditLogs"))
            batch.set(auditLogRef, {
                userId: user?.uid,
                vehicleId,
                action: "delete",
                description: "Quotation deleted",
                entityStatus: true,
                createdAt: serverTimestamp(),
            })

            /** 6️⃣ Commit everything */
            await batch.commit()

            setOpen(false)
        } catch (error) {
            console.error("Quotation deletion failed:", error)
        }
    }

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
                            await handleConfirm()
                            setOpen(false)
                        }}
                    >
                        Yes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}