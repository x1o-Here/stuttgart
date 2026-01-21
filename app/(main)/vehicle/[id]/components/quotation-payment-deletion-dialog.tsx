'use client'

import { useState, ReactNode } from "react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { addDoc, collection, deleteDoc, doc, serverTimestamp } from "firebase/firestore"
import { db } from "@/lib/firebase/firebase-client"
import { Delete } from "lucide-react"

interface DeletionDialogProps {
    quotationId: string
    paymentId: string
    amount: number
    method: string
    title?: string
    description?: string
}

export default function QuotationPaymentDeletionDialog({
    quotationId,
    paymentId,
    amount,
    method,
    title = "Are you sure?",
    description = "This action cannot be undone.",
}: DeletionDialogProps) {
    const [open, setOpen] = useState(false)

    const handleConfirm = async () => {
        try {
            /** 1️⃣ Delete quotation payment */
            await deleteDoc(
                doc(db, "quotations", quotationId, "quotationPayments", paymentId)
            )

            /** 2️⃣ Credit reversal transaction */
            await addDoc(
                collection(db, "accounts", method, "transactions"),
                {
                    date: new Date(),
                    amount,
                    type: "credit",
                    description: "Quotation payment reversal",
                    createdAt: serverTimestamp(),
                }
            )

            setOpen(false)
        } catch (error) {
            console.error("Payment deletion failed:", error)
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
