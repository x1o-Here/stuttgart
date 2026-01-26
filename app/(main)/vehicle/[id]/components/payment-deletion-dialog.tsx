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
import { collection, doc, increment, serverTimestamp, writeBatch } from "firebase/firestore"
import { db } from "@/lib/firebase/firebase-client"
import { Delete } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"

interface DeletionDialogProps {
    type: "purchase" | "sale"
    vehicleId: string
    paymentId: string
    accountId: string
    amount: number
    title?: string
    description?: string
}

export default function PaymentDeletionDialog({
    type,
    vehicleId,
    paymentId,
    accountId,
    amount,
    title = "Are you sure?",
    description = "This action cannot be undone.",
}: DeletionDialogProps) {
    const [open, setOpen] = useState(false)
    const { user } = useAuth()

    const handleConfirm = async () => {
        try {
            const batch = writeBatch(db)

            // 🔹 Determine paths
            const paymentRef =
                type === "purchase"
                    ? doc(db, "purchaseDetails", vehicleId, "purchasePayments", paymentId)
                    : doc(db, "salesDetails", vehicleId, "salesPayments", paymentId)

            // 🔹 Determine reversal logic
            const transactionType = type === "purchase" ? "credit" : "debit"
            const balanceChange = type === "purchase" ? amount : -amount

            // 1️⃣ Soft delete payment document
            batch.update(paymentRef, {
                entityStatus: false,
                updatedAt: serverTimestamp(),
            })

            // 2️⃣ Add reversal transaction
            const transactionRef = doc(collection(db, "accounts", accountId, "transactions"))
            batch.set(transactionRef, {
                date: new Date(),
                amount,
                vehicleId,
                type: transactionType,
                description: `${type.charAt(0).toUpperCase() + type.slice(1)} payment deletion reversal`,
                createdAt: serverTimestamp(),
            })

            // 3️⃣ Update account balance
            const accountRef = doc(db, "accounts", accountId)
            batch.update(accountRef, {
                balance: increment(balanceChange),
            })

            // 4️⃣ Add Audit Log
            const auditLogRef = doc(collection(db, "auditLogs"))
            batch.set(auditLogRef, {
                userId: user?.uid,
                vehicleId,
                action: "delete",
                description: `${type.charAt(0).toUpperCase() + type.slice(1)} payment deleted`,
                entityStatus: true,
                createdAt: serverTimestamp(),
            })

            await batch.commit()

            setOpen(false)
        } catch (error) {
            console.error("Failed to delete payment:", error)
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
