'use client'

import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { z } from "zod";
import CalendarPopover from "./calendar-popover";
import { useForm } from "react-hook-form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import PaymentsTable from "./payments-table";
import { toDate } from "@/lib/helpers/to-date";
import EditPurchaseDialog from "./edit-purchasing";
import { Input } from "@/components/ui/input";
import { useVehicleContext } from "@/contexts/useVehicleContext";
import { useEffect } from "react";

const formSchema = z.object({
    purchasedDate: z.date().min(new Date("1900-01-01"), "Purchased Date must be after Jan 1, 1900"),
    amount: z.number().min(0, "Amount must be positive"),
    sellerName: z.string().min(1, "Seller Name is required"),
    sellerContact: z.string().min(1, "Seller Contact is required"),
    legalOwner: z.string().min(1, "Legal Owner is required"),
    isCR: z.boolean(),
    pRemainingAmount: z.number().min(0, "Remaining Amount must be positive"),
})

const paymentHeaders = [
    { id: "date", title: "Payment Date" },
    { id: "amount", title: "Amount" },
    { id: "method", title: "Payment Method" },
    { id: "actions", title: "" },
];

export default function PurchasingContent() {
    const { vehicle, purchaseDetails, pRemaining, purchasePayments } = useVehicleContext();

    const form = useForm<z.infer<typeof formSchema>>({
        defaultValues: {
            purchasedDate: toDate(purchaseDetails?.purchasedDate),
            amount: purchaseDetails?.purchasedAmount,
            sellerName: purchaseDetails?.sellerName,
            sellerContact: purchaseDetails?.sellerContact,
            legalOwner: purchaseDetails?.legalOwner,
            isCR: purchaseDetails?.isCR,
            pRemainingAmount: pRemaining,
        },
    });

    useEffect(() => {
        form.reset({
            purchasedDate: toDate(purchaseDetails?.purchasedDate),
            amount: purchaseDetails?.purchasedAmount,
            sellerName: purchaseDetails?.sellerName,
            sellerContact: purchaseDetails?.sellerContact,
            legalOwner: purchaseDetails?.legalOwner,
            isCR: purchaseDetails?.isCR,
            pRemainingAmount: pRemaining,
        });
    }, [vehicle, purchaseDetails, pRemaining, purchasePayments, form]);

    function onSubmit(data: z.infer<typeof formSchema>) {
        console.log(data);
    }

    return (
        <div className="p-4">
            <div className="h-full flex flex-col gap-y-8">
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-2 gap-4">
                        <FormField
                            control={form.control}
                            name="purchasedDate"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Purchased Date</FormLabel>
                                    <FormControl>
                                        <CalendarPopover
                                            value={field.value}
                                            onChange={field.onChange}
                                            disabled
                                        />
                                    </FormControl>
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
                                            disabled
                                            className="w-full text-black px-3 py-2 border border-gray-300 rounded-md"
                                            {...field}
                                        />
                                    </FormControl>
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
                                        <Input
                                            type="text"
                                            disabled
                                            placeholder="Seller Name"
                                            className="w-full text-black px-3 py-2 border border-gray-300 rounded-md"
                                            {...field}
                                        />
                                    </FormControl>
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
                                        <Input
                                            type="text"
                                            disabled
                                            placeholder="Seller Contact"
                                            className="w-full text-black px-3 py-2 border border-gray-300 rounded-md"
                                            {...field}
                                        />
                                    </FormControl>
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
                                        <Input
                                            type="text"
                                            disabled
                                            placeholder="Legal Owner"
                                            className="w-full text-black px-3 py-2 border border-gray-300 rounded-md"
                                            {...field}
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="isCR"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Is CR</FormLabel>
                                    <FormControl>
                                        <Select
                                            value={field.value ? "true" : "false"}
                                            onValueChange={(value) => field.onChange(value === "true")}
                                            disabled
                                        >
                                            <SelectTrigger className="w-full text-black px-3 py-2 border border-gray-300 rounded-md">
                                                <SelectValue placeholder="Select an option" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="true">Yes</SelectItem>
                                                <SelectItem value="false">No</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="pRemainingAmount"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Remaining Amount</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="number"
                                            placeholder="Remaining Amount"
                                            disabled
                                            className="w-full text-black px-3 py-2 border border-gray-300 rounded-md"
                                            {...field}
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                    </form>
                </Form>

                <EditPurchaseDialog id={vehicle?.id} data={purchaseDetails} />
            </div>

            <Separator className="my-4" />

            <div className="w-full flex flex-col gap-2">
                <h2 className="text-lg font-medium mb-2">Purchase Payments</h2>
                <PaymentsTable
                    id={vehicle?.id}
                    headers={paymentHeaders}
                    paymentType="purchase"
                    data={purchasePayments}
                />
            </div>
        </div>
    );
}