'use client'

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Plus } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import z from "zod"
import CalendarPopover from "./calendar-popover"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import ConfirmationDialog from "@/components/custom/confirmation-dialog"
import { useAccountsContext } from "@/contexts/useAccountsContext"
import { addDoc, collection, serverTimestamp } from "firebase/firestore"
import { db } from "@/lib/firebase/firebase-client"

const formSchema = z.object({
    date: z.date().min(new Date("1900-01-01"), "Date must be after Jan 1, 1900"),
    amount: z.number().min(0, "Amount cannot be negative"),
    method: z.string().min(1, "Payment Method is required"),
})

type FormOutput = z.infer<typeof formSchema>

export default function AddPaymentDialog({ id }: { id: string }) {
    const [open, setOpen] = useState(false)
    const [confirmClose, setConfirmClose] = useState(false)

    const { accounts } = useAccountsContext()

    const form = useForm<FormOutput>({
        defaultValues: {
            date: new Date(),
            amount: 0,
            method: "",
        },
        resolver: zodResolver(formSchema),
        mode: "onSubmit",
        reValidateMode: "onSubmit",
    })

    async function onSubmit(data: FormOutput) {
        try {
            if (!data.method) throw new Error("No account selected")

            const paymentData = {
                date: data.date,
                amount: data.amount,
                method: data.method,
                createdAt: serverTimestamp(),
            }

            // 1️⃣ Add payment to purchasePayment subcollection
            const paymentRef = await addDoc(
                collection(db, "purchaseDetails", id, "purchasePayment"),
                paymentData
            )

            // 2️⃣ Add transaction to the selected account
            const transactionData = {
                date: data.date,
                amount: data.amount,
                type: "debit", // assuming paying from the account
                description: `Payment for vehicle ${id}`,
                createdAt: serverTimestamp(),
                paymentId: paymentRef.id, // link to payment if needed
            }

            await addDoc(
                collection(db, "accounts", data.method, "transactions"),
                transactionData
            )

            form.reset()
            setOpen(false)
            console.log("Payment added successfully!")
        } catch (error) {
            console.error("Failed to add payment:", error)
        }
    }

    function handleCancel() {
        if (form.formState.isDirty) {
            setConfirmClose(true)
        } else {
            form.reset()
            setOpen(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <Form {...form}>

                <DialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="w-full">Add Record</Button>
                </DialogTrigger>
                <DialogContent className="min-w-xl">
                    <form onSubmit={form.handleSubmit(onSubmit)}>
                        <DialogHeader className="pb-4">
                            <DialogTitle>Add a Purchase Payment</DialogTitle>
                        </DialogHeader>
                        <div className="max-h-lg overflow-y-auto flex flex-col gap-8">
                            <div className="flex flex-col gap-4">
                                <p className="font-medium">Purchase Detials</p>
                                <div className="grid gap-4">
                                    <FormField
                                        control={form.control}
                                        name="date"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Date</FormLabel>
                                                <FormControl>
                                                    <CalendarPopover
                                                        value={field.value}
                                                        onChange={(date) => {
                                                            if (date) field.onChange(date)
                                                        }}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="amount"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Amount</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="number"
                                                        placeholder="Amount"
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                                        {...field}
                                                        onChange={(e) => field.onChange(Number(e.target.value))}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="method"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Method</FormLabel>
                                                <FormControl>
                                                    <Select
                                                        value={field.value || ""}
                                                        onValueChange={(value) => field.onChange(value)}
                                                    >
                                                        <SelectTrigger className="w-full px-3 py-2 border border-gray-300 rounded-md">
                                                            <SelectValue placeholder="Select an option" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {accounts.map((account) => (
                                                                <SelectItem key={account.id} value={account.id}>
                                                                    {account.name}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </div>
                        </div>
                        <DialogFooter className="mt-4">
                            <Button type="submit">Submit</Button>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleCancel}
                            >Cancel</Button>
                        </DialogFooter>
                    </form>
                </DialogContent >

                <ConfirmationDialog
                    open={confirmClose}
                    onOpenChange={setConfirmClose}
                    onConfirm={() => {
                        form.reset()
                        setConfirmClose(false)
                        setOpen(false)
                    }}
                />
            </Form>
        </Dialog >
    )
}