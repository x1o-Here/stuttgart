'use client'

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Edit, Plus } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import z from "zod"
import CalendarPopover from "./calendar-popover"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import ConfirmationDialog from "@/components/custom/confirmation-dialog"
import { useAccountsContext } from "@/contexts/useAccountsContext"
import { addDoc, collection, doc, increment, serverTimestamp, updateDoc } from "firebase/firestore"
import { db } from "@/lib/firebase/firebase-client"
import { toDate } from "@/lib/helpers/to-date"

const formSchema = z.object({
    date: z.date().min(new Date("1900-01-01"), "Date must be after Jan 1, 1900"),
    amount: z.number().min(0, "Amount cannot be negative"),
    method: z.string().min(1, "Payment Method is required"),
})

type FormOutput = z.infer<typeof formSchema>

type EditPaymentDialogProps = {
    referenceId: string          // purchaseDetails.id OR salesDetails.id
    paymentId: string
    data: {
        date: any
        amount: number
        method: string
    }
    type: "purchase" | "sale"
}


export default function EditPaymentDialog({
    referenceId,
    paymentId,
    data,
    type
}: EditPaymentDialogProps) {
    const [open, setOpen] = useState(false)
    const [confirmClose, setConfirmClose] = useState(false)

    const { accounts } = useAccountsContext()

    const form = useForm<FormOutput>({
        defaultValues: {
            date: toDate(data?.date),
            amount: data?.amount,
            method: data?.method,
        },
        resolver: zodResolver(formSchema),
        mode: "onSubmit",
        reValidateMode: "onSubmit",
    })

    async function onSubmit(formData: FormOutput) {
        try {
            const isPurchase = type === "purchase"

            /** 1️⃣ Reverse previous transaction */
            await addDoc(
                collection(db, "accounts", data.method, "transactions"),
                {
                    date: new Date(),
                    amount: data.amount,
                    type: isPurchase ? "credit" : "debit",
                    description: `${type} payment reversal`,
                    createdAt: serverTimestamp(),
                    paymentId,
                    referenceId,
                }
            )

            /** 2️⃣ Apply new transaction */
            await addDoc(
                collection(db, "accounts", formData.method, "transactions"),
                {
                    date: formData.date,
                    amount: formData.amount,
                    type: isPurchase ? "debit" : "credit",
                    description: `${type} payment`,
                    createdAt: serverTimestamp(),
                    paymentId,
                    referenceId,
                }
            )

            /** 3️⃣ Update account balances */
            await updateDoc(doc(db, "accounts", data.method), {
                balance: increment(isPurchase ? data.amount : -data.amount),
            })

            await updateDoc(doc(db, "accounts", formData.method), {
                balance: increment(isPurchase ? -formData.amount : formData.amount),
            })

            /** 4️⃣ Update payment document */
            const paymentRef = isPurchase
                ? doc(db, "purchaseDetails", referenceId, "purchasePayments", paymentId)
                : doc(db, "salesDetails", referenceId, "salesPayments", paymentId)

            await updateDoc(paymentRef, {
                date: formData.date,
                amount: formData.amount,
                method: formData.method,
                updatedAt: serverTimestamp(),
            })

            form.reset(formData)
            setOpen(false)
        } catch (err) {
            console.error("Edit payment failed:", err)
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
                    <Button variant="outline" size="icon-sm"><Edit /></Button>
                </DialogTrigger>
                <DialogContent className="min-w-xl">
                    <form onSubmit={form.handleSubmit(onSubmit)}>
                        <DialogHeader className="pb-4">
                            <DialogTitle>Edit {type} payment</DialogTitle>
                        </DialogHeader>
                        <div className="max-h-lg overflow-y-auto flex flex-col gap-8">
                            <div className="flex flex-col gap-4">
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