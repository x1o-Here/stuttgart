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
import { Vehicle } from "./columns"
import { useRouter } from "next/navigation"
import { useAccountsContext } from "@/contexts/useAccountsContext"
import { addDoc, collection, doc, getDocs, updateDoc } from "firebase/firestore"
import { db } from "@/lib/firebase/firebase-client"

interface ConfirmationDialogProps {
    vehicle: Vehicle
    title?: string
    description?: string
}

export default function DeletionDialog({
    vehicle,
    title = "Are you sure?",
    description = "This action cannot be undone.",
}: ConfirmationDialogProps) {
    const [open, setOpen] = useState(false)
    const { accounts } = useAccountsContext();

    const handleConfirm = async () => {
        try {
            // 1️⃣ Set entityStatus to false
            const vehicleRef = doc(db, "vehicles", vehicle.id)
            await updateDoc(vehicleRef, { entityStatus: false })

            // Helper to update account balance and log transaction
            const reversePayment = async (
                payment: { date: any; amount: number; method: string },
                type: "purchase" | "sales" | "quotation"
            ) => {
                const account = accounts.find(a => a.id === payment.method)
                if (!account) return

                const isDebit = type === "sales"
                const newBalance = isDebit
                    ? account.balance - payment.amount
                    : account.balance + payment.amount

                // Update account balance
                const accountRef = doc(db, "accounts", account.id)
                await updateDoc(accountRef, { balance: newBalance })

                // Add reversal transaction
                const transactionsCol = collection(accountRef, "transactions")
                await addDoc(transactionsCol, {
                    date: new Date(),
                    description: `Reversal of ${type} payment for vehicle ${vehicle.vehicleNo}`,
                    amount: payment.amount,
                    type: isDebit ? "debit" : "credit",
                })
            }

            // 2️⃣ Reverse purchasePayments
            const purchasePaymentsSnap = await getDocs(
                collection(db, "purchaseDetails", vehicle.id, "purchasePayments")
            )
            for (const docSnap of purchasePaymentsSnap.docs) {
                const payment = docSnap.data() as { date: any; amount: number; method: string }
                await reversePayment(payment, "purchase")
            }

            // 3️⃣ Reverse salesPayments
            const salesPaymentsSnap = await getDocs(
                collection(db, "salesDetails", vehicle.id, "salesPayments")
            )
            for (const docSnap of salesPaymentsSnap.docs) {
                const payment = docSnap.data() as { date: any; amount: number; method: string }
                await reversePayment(payment, "sales")
            }

            // 4️⃣ Reverse quotationPayments
            const quotationsSnap = await getDocs(collection(db, "quotations"))
            const vehicleQuotations = quotationsSnap.docs.filter(
                q => q.data().vehicleId === vehicle.id
            )

            for (const qDoc of vehicleQuotations) {
                const paymentsSnap = await getDocs(
                    collection(db, "quotations", qDoc.id, "quotationPayments")
                )
                for (const pDoc of paymentsSnap.docs) {
                    const payment = pDoc.data() as { date: any; amount: number; method: string }
                    await reversePayment(payment, "quotation")
                }
            }

            console.log("Vehicle deletion processed successfully")
        } catch (err) {
            console.error("Failed to delete vehicle", err)
        }
    }

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
