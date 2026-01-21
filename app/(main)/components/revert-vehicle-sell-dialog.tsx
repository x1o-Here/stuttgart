'use client'

import { useState } from "react"
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
import { Vehicle } from "./columns"
import { useAccountsContext } from "@/contexts/useAccountsContext"
import { addDoc, collection, doc, getDocs, updateDoc } from "firebase/firestore"
import { db } from "@/lib/firebase/firebase-client"

interface ConfirmationDialogProps {
    vehicle: Vehicle
    title?: string
    description?: string
}

export default function RevertSellVehicleDialog({
    vehicle,
    title = "Are you sure you want to revert this vehicle sale?",
    description = "This action cannot be undone.",
}: ConfirmationDialogProps) {
    const [open, setOpen] = useState(false)
    const { accounts } = useAccountsContext();

    const handleConfirm = async () => {
        try {
            // 1️⃣ Get all sales payments
            const salesPaymentsCol = collection(db, "salesDetails", vehicle.id, "salesPayments")
            const paymentsSnap = await getDocs(salesPaymentsCol)

            for (const paymentDoc of paymentsSnap.docs) {
                const payment = paymentDoc.data()
                const accountId = payment.method
                const amount = payment.amount || 0

                // 2️⃣ Find account
                const accountRef = doc(db, "accounts", accountId)
                const account = accounts.find(a => a.id === accountId)

                if (!account) continue

                // 3️⃣ Reverse the balance
                const newBalance = (account.balance || 0) - amount // salesPayment → debit originally → credit to revert
                await updateDoc(accountRef, { balance: newBalance })

                // 4️⃣ Add reversal transaction
                const transactionsCol = collection(db, "accounts", accountId, "transactions")
                await addDoc(transactionsCol, {
                    date: new Date(),
                    description: `Reversal of sales payment for vehicle ${vehicle.vehicleNo}`,
                    amount: amount,
                    type: "credit", // reverse of original debit
                })
            }

            // 5️⃣ Update vehicle status back to active
            const vehicleRef = doc(db, "vehicles", vehicle.id)
            await updateDoc(vehicleRef, { vehicleStatus: "active", updatedAt: new Date() })

            // Optional: Reset salesDetails
            const salesDetailsRef = doc(db, "salesDetails", vehicle.id)
            await updateDoc(salesDetailsRef, {
                salesAmount: 0,
                salesDate: null,
                buyerName: "",
                buyerContact: "",
                updatedAt: new Date(),
            })

        } catch (error) {
            console.error("Failed to revert vehicle sale", error)
        }
    }

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
