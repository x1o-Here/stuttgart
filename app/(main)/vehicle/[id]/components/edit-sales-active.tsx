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
import { addDoc, collection, doc, serverTimestamp, updateDoc } from "firebase/firestore"
import { db } from "@/lib/firebase/firebase-client"
import { toDate } from "@/lib/helpers/to-date"

const formSchema = z.object({
    amount: z.number().min(0, "Amount cannot be negative"),
})

type FormOutput = z.infer<typeof formSchema>

export default function EditActiveSalesDialog({ id, data }: { id: string, data: any }) {
    const [open, setOpen] = useState(false)
    const [confirmClose, setConfirmClose] = useState(false)

    const { accounts } = useAccountsContext()

    const form = useForm<FormOutput>({
        defaultValues: {
            amount: data?.amount,
        },
        resolver: zodResolver(formSchema),
        mode: "onSubmit",
        reValidateMode: "onSubmit",
    })

    async function onSubmit(formData: FormOutput) {
        try {
            const salesRef = doc(db, "salesDetails", id)

            await updateDoc(salesRef, {
                salesAmount: formData.amount,
                updatedAt: serverTimestamp(),
            })

            form.reset(formData)
            setOpen(false)
        } catch (error) {
            console.error("Failed to update sales information", error)
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
                    <Button>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit Sales Details
                    </Button>
                </DialogTrigger>
                <DialogContent className="min-w-xl">
                    <form onSubmit={form.handleSubmit(onSubmit)}>
                        <DialogHeader className="pb-4">
                            <DialogTitle>Edit Sales Details</DialogTitle>
                        </DialogHeader>
                        <div className="max-h-lg overflow-y-auto flex flex-col gap-8">
                            <div className="flex flex-col gap-4">
                                <p className="font-medium">Purchase Detials</p>
                                <div className="grid gap-4">
                                    <FormField
                                        control={form.control}
                                        name="amount"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Selling Price</FormLabel>
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