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
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import axios from "axios"
import { addDoc, collection, deleteDoc, doc, serverTimestamp } from "firebase/firestore"
import { db } from "@/lib/firebase/firebase-client"
import { Delete } from "lucide-react"

interface DeletionDialogProps {
    vehicleId: string
    paymentId: string
    accountId: string
    amount: number
    title?: string
    description?: string
}

export default function PaymentDeletionDialog({
    vehicleId,
    paymentId,
    accountId,
    amount,
    title = "Are you sure?",
    description = "This action cannot be undone.",
}: DeletionDialogProps) {
    const [open, setOpen] = useState(false)

    const handleConfirm = async () => {
        try {
            // 1️⃣ Delete the payment document
            const paymentRef = doc(db, "purchaseDetails", vehicleId, "purchasePayment", paymentId)
            await deleteDoc(paymentRef)

            // 2️⃣ Add a reversal transaction to the account
            await addDoc(
                collection(db, "accounts", accountId, "transactions"),
                {
                    date: new Date(),
                    amount,
                    type: "credit", // reversal, so credit the account
                    description: `Purchase payment reversal for vehicle ${vehicleId}`,
                    createdAt: serverTimestamp(),
                }
            )

            setOpen(false)
        } catch (error) {
            console.error("Failed to delete payment and reverse transaction:", error)
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
