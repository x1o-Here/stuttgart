'use client'

import ConfirmationDialog from "@/components/custom/confirmation-dialog"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/contexts/auth-context"
import { db } from "@/lib/firebase/firebase-client"
import { zodResolver } from "@hookform/resolvers/zod"
import { collection, doc, serverTimestamp, updateDoc, writeBatch } from "firebase/firestore"
import { Edit } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import z from "zod"

const formSchema = z.object({
    vehicleNo: z.string().min(1, "Vehicle Number is required"),
    make: z.string().min(1, "Make is required"),
    yom: z.number().min(1900, "Year of Manufacture must be valid").max(new Date().getFullYear(), "Year of Manufacture cannot be in the future"),
})

type FormOutput = z.infer<typeof formSchema>

export default function EditInformationDialog({ id, data }: { id: string, data: any }) {
    const [open, setOpen] = useState(false)
    const [confirmClose, setConfirmClose] = useState(false)

    const { user } = useAuth()

    const form = useForm<FormOutput>({
        defaultValues: {
            vehicleNo: data?.vehicleNo,
            make: data?.make,
            yom: data?.yom,
        },
        resolver: zodResolver(formSchema),
        mode: "onSubmit",
        reValidateMode: "onSubmit",
    })

    async function onSubmit(formData: FormOutput) {
        try {
            const batch = writeBatch(db)
            const vehicleRef = doc(db, "vehicles", id)

            batch.update(vehicleRef, {
                vehicleNo: formData.vehicleNo,
                make: formData.make,
                yom: formData.yom,
                updatedAt: serverTimestamp(),
            })

            const auditLogRef = doc(collection(db, "auditLogs"))
            batch.set(auditLogRef, {
                userId: user?.uid,
                vehicleId: id,
                action: "update",
                description: "Vehicle information updated",
                entityStatus: true,
                createdAt: serverTimestamp(),
            })

            await batch.commit()

            form.reset(formData)
            setOpen(false)
        } catch (error) {
            console.error("Failed to update vehicle information", error)
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
                        Edit Information
                    </Button>
                </DialogTrigger>
                <DialogContent className="min-w-6xl">
                    <form onSubmit={form.handleSubmit(onSubmit)}>
                        <DialogHeader className="pb-4">
                            <DialogTitle>Edit Vehicle Information</DialogTitle>
                        </DialogHeader>
                        <div className="max-h-lg overflow-y-auto flex flex-col gap-8">
                            <div className="flex flex-col gap-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="vehicleNo"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Vehicle Number</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="text"
                                                        placeholder="LX-3204"
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
                                        name="make"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Make</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="text"
                                                        placeholder="Tata 10W"
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
                                        name="yom"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Year of Manufacture (YOM)</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="number"
                                                        placeholder="2020"
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
        </Dialog >
    )
}