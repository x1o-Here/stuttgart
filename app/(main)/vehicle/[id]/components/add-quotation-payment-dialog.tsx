'use client'

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
import { useForm } from "react-hook-form"
import z from "zod"
import CalendarPopover from "./calendar-popover"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import ConfirmationDialog from "@/components/custom/confirmation-dialog"
import { useAccountsContext } from "@/contexts/useAccountsContext"
import { collection, doc, increment, serverTimestamp, writeBatch } from "firebase/firestore"
import { db } from "@/lib/firebase/firebase-client"
import { useAuth } from "@/contexts/auth-context"
import { useVehicleContext } from "@/contexts/useVehicleContext"

const formSchema = z.object({
    date: z.date().min(new Date("1900-01-01"), "Date must be after Jan 1, 1900"),
    amount: z.number().min(0, "Amount cannot be negative"),
    method: z.string().min(1, "Payment Method is required"),
})

type FormOutput = z.infer<typeof formSchema>

export default function AddQuotationPaymentDialog({ quotationId }: { quotationId: string }) {
    const [open, setOpen] = useState(false)
    const [confirmClose, setConfirmClose] = useState(false)

    const { user } = useAuth()
    const { accounts } = useAccountsContext()
    const { vehicle } = useVehicleContext()

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
            const batch = writeBatch(db)

            // Add quotation payment
            const paymentRef = doc(collection(db, "quotations", quotationId, "quotationPayments"))
            batch.set(paymentRef, {
                date: data.date,
                amount: data.amount,
                method: data.method, // accountId
                entityStatus: true,
                createdAt: serverTimestamp(),
            })

            // Add transaction
            const transactionRef = doc(collection(db, "accounts", data.method, "transactions"))
            batch.set(transactionRef, {
                date: data.date,
                vehicleId: vehicle?.id || "",
                amount: data.amount,
                type: "debit",
                description: `Quotation payment`,
                createdAt: serverTimestamp(),
            })

            // Update account balance
            const accountRef = doc(db, "accounts", data.method)
            batch.update(accountRef, {
                balance: increment(-data.amount),
            })

            // Add Audit Log
            const auditLogRef = doc(collection(db, "auditLogs"))
            batch.set(auditLogRef, {
                userId: user?.uid,
                vehicleId: vehicle?.id || "",
                action: "create",
                description: "Quotation payment added",
                entityStatus: true,
                createdAt: serverTimestamp(),
            })

            await batch.commit()

            form.reset()
            setOpen(false)
        } catch (error) {
            console.error("Failed to add quotation payment:", error)
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
                            <DialogTitle>Add a Quotation Payment</DialogTitle>
                        </DialogHeader>
                        <div className="max-h-lg overflow-y-auto flex flex-col gap-8">
                            <div className="flex flex-col gap-4">
                                <p className="font-medium">Quotation Details</p>
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