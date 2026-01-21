'use client'

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { db } from "@/lib/firebase/firebase-client";
import { collection, doc, getDocs, increment, Timestamp, writeBatch } from "firebase/firestore";
import { Delete } from "lucide-react";
import { useState } from "react";

interface QuotationDeletionDialogProps {
    quotationId: string;
    title?: string
    description?: string
}

export default function QuotationDeletionDialog({
    quotationId,
    title = "Are you sure?",
    description = "This action cannot be undone.",
}: QuotationDeletionDialogProps) {
    const [open, setOpen] = useState(false);

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
                const { amount, method } = docSnap.data()
                if (!method || !amount) return

                totalsByAccount[method] =
                    (totalsByAccount[method] || 0) + Number(amount)

                /** delete payment */
                batch.delete(docSnap.ref)
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
                    date: Timestamp.now(),
                    description: "Quotation deleted – payment reversal",
                    amount: total,
                    type: "credit",
                    createdAt: Timestamp.now(),
                })
            }

            /** 4️⃣ Delete quotation */
            batch.delete(doc(db, "quotations", quotationId))

            /** 5️⃣ Commit everything */
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