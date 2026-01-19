'use client'

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Plus } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import CalendarPopover from "../vehicle/[id]/components/calendar-popover";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect } from "react";
import ConfirmationDialog from "@/components/custom/confirmation-dialog";
import { zodResolver } from "@hookform/resolvers/zod"
import axios from "axios"

const formSchema = z.object({
    purchasedDate: z.date().min(new Date("1900-01-01"), "Purchased Date must be after Jan 1, 1900"),
    vehicleNo: z.string().min(1, "Vehicle Number is required"),
    make: z.string().min(1, "Make is required"),
    yom: z.number().min(1900, "Year of Manufacture must be valid").max(new Date().getFullYear(), "Year of Manufacture cannot be in the future"),
    isCR: z.boolean(),
    sellerName: z.string().min(1, "Seller Name is required"),
    sellerContact: z.string().min(1, "Seller Contact is required"),
    legalOwner: z.string().min(1, "Legal Owner is required"),
    purchasedAmount: z.number().min(0, "Amount must be positive"),
})

type FormOutput = z.infer<typeof formSchema>

export default function AddVehicleDialog() {
    const [open, setOpen] = useState(false)
    const [confirmClose, setConfirmClose] = useState(false)

    const form = useForm<FormOutput>({
        defaultValues: {
            purchasedDate: new Date(),
            vehicleNo: "",
            make: "",
            yom: 2025,
            isCR: false,
            sellerName: "",
            sellerContact: "",
            legalOwner: "",
            purchasedAmount: 0,
        },
        resolver: zodResolver(formSchema),
        mode: "onSubmit",
        reValidateMode: "onSubmit",
    })

    useEffect(() => {
        const subscription = form.watch((value) => {
            console.log("Form data changed:", value);
        });
        return () => subscription.unsubscribe();
    }, [form]);

    async function onSubmit(data: FormOutput) {
        console.log("data:", data)
        try {
            const res = await axios.post("/api/vehicle", {
                ...data,
                purchasedDate: data.purchasedDate.toISOString(),
            })

            if (res.data?.success) {
                form.reset()
                setOpen(false)
            }
        } catch (error) {
            console.error("Failed to add vehicle", error)
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
                        <Plus className="mr-2 h-4 w-4" />
                        Add Vehicle
                    </Button>
                </DialogTrigger>
                <DialogContent className="min-w-6xl">
                    <form onSubmit={form.handleSubmit(onSubmit)}>
                        <DialogHeader className="pb-4">
                            <DialogTitle>Add a New Vehicle</DialogTitle>
                        </DialogHeader>
                        <div className="max-h-lg overflow-y-auto flex flex-col gap-8">
                            <div className="flex flex-col gap-4">
                                <p className="font-medium">General Information</p>
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

                            <div className="flex flex-col gap-4">
                                <p className="font-medium">Purchase Detials</p>
                                <div className="grid grid-cols-2 gap-8">
                                    <FormField
                                        control={form.control}
                                        name="purchasedDate"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Purchased Date</FormLabel>
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
                                        name="isCR"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>CR</FormLabel>
                                                <FormControl>
                                                    <Select
                                                        value={field.value ? "true" : "false"}
                                                        onValueChange={(value) => field.onChange(value === "true")}
                                                    >
                                                        <SelectTrigger className="w-full px-3 py-2 border border-gray-300 rounded-md">
                                                            <SelectValue placeholder="Select an option" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="true">Yes</SelectItem>
                                                            <SelectItem value="false">No</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="sellerName"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Seller Name</FormLabel>
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
                                        name="sellerContact"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Seller Contact</FormLabel>
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

                                    <FormField
                                        control={form.control}
                                        name="legalOwner"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Legal Owner</FormLabel>
                                                <FormControl>
                                                    <input
                                                        type="text"
                                                        placeholder="Legal Owner"
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
                                        name="purchasedAmount"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Amount</FormLabel>
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