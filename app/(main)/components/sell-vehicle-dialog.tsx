"use client"

import { useState } from "react"
import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import CalendarPopover from "../vehicle/[id]/components/calendar-popover"
import ConfirmationDialog from "@/components/custom/confirmation-dialog"
import { Vehicle } from "./columns"
import { db } from "@/lib/firebase/firebase-client"
import { collection, doc, serverTimestamp, writeBatch } from "firebase/firestore"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"

const sellVehicleSchema = z.object({
    salesDate: z.date().min(new Date("1900-01-01"), "Sales Date must be after Jan 1, 1900"),
    salesAmount: z.number().positive("Amount must be greater than 0"),
    buyerName: z.string().min(2, "Buyer name is required"),
    buyerContact: z.string().min(7, "Buyer contact is required"),
})

type SellVehicleFormValues = z.infer<typeof sellVehicleSchema>

interface SellVehicleDialogProps {
    vehicle: Vehicle
}

export function SellVehicleDialog({
    vehicle,
}: SellVehicleDialogProps) {
    const [open, setOpen] = useState(false);
    const [confirmClose, setConfirmClose] = useState(false);

    const { user } = useAuth()
    const form = useForm<SellVehicleFormValues>({
        resolver: zodResolver(sellVehicleSchema),
        defaultValues: {
            salesDate: new Date(),
            salesAmount: vehicle.sPrice,
            buyerName: "",
            buyerContact: "",
        },
    })

    const onSubmit = async (values: SellVehicleFormValues) => {
        try {
            const batch = writeBatch(db)
            const salesRef = doc(db, "salesDetails", vehicle.id)
            const vehicleRef = doc(db, "vehicles", vehicle.id)

            // 1️⃣ Update salesDetails document
            batch.set(salesRef, {
                salesDate: values.salesDate,
                salesAmount: values.salesAmount,
                buyerName: values.buyerName,
                buyerContact: values.buyerContact,
                pnl: values.salesAmount - (vehicle.totalCost || 0),
                updatedAt: serverTimestamp(),
            }, { merge: true })

            // 2️⃣ Update vehicle status
            batch.update(vehicleRef, {
                vehicleStatus: "sold",
                updatedAt: serverTimestamp(),
            })

            // 3️⃣ Add Audit Log
            const auditLogRef = doc(collection(db, "auditLogs"))
            batch.set(auditLogRef, {
                userId: user?.uid,
                vehicleId: vehicle.id,
                action: "update",
                description: `Vehicle ${vehicle.vehicleNo} marked as sold to ${values.buyerName}`,
                entityStatus: true,
                createdAt: serverTimestamp(),
            })

            await batch.commit()

            form.reset()
            setOpen(false)
        } catch (error) {
            console.error("Failed to sell vehicle", error)
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
                    <DropdownMenuItem
                        onSelect={(e) => {
                            e.preventDefault();
                            setOpen(true);
                        }}
                    >
                        Sell vehicle
                    </DropdownMenuItem>
                </DialogTrigger>

                <DialogContent className="min-w-4xl">
                    <form onSubmit={form.handleSubmit(onSubmit)}>
                        <DialogHeader className="pb-8">
                            <DialogTitle>Sell Vehicle</DialogTitle>
                        </DialogHeader>
                        <div className="max-h-lg overflow-y-auto flex flex-col gap-8">
                            <div className="flex flex-col gap-4">
                                <FormField
                                    control={form.control}
                                    name="salesDate"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Sales Date</FormLabel>
                                            <FormControl>
                                                <CalendarPopover
                                                    value={field.value}
                                                    onChange={field.onChange}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="salesAmount"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Selling Price</FormLabel>
                                            <FormControl>
                                                <input
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
                                    name="buyerName"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Buyer Name</FormLabel>
                                            <FormControl>
                                                <input
                                                    type="text"
                                                    placeholder="Seller Name"
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="buyerContact"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Buyer Contact</FormLabel>
                                            <FormControl>
                                                <input
                                                    type="text"
                                                    placeholder="Seller Contact"
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
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
                </DialogContent>

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
        </Dialog>
    )
}
