'use client'

import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { z } from "zod";
import CalendarPopover from "./calendar-popover";
import { useForm } from "react-hook-form";
import { Separator } from "@/components/ui/separator";
import PaymentsTable from "./payments-table";
import { toDate } from "@/lib/helpers/to-date";
import { useEffect } from "react";
import { useVehicleContext } from "@/contexts/useVehicleContext";
import { Input } from "@/components/ui/input";
import EditActiveSalesDialog from "./edit-sales-active";
import EditSoldSalesDialog from "./edit-sales-sold";

const formSchema = z.object({
    salesDate: z.date().min(new Date("1900-01-01"), "Sales Date must be after Jan 1, 1900"),
    buyer: z.string().min(1, "Buyer is required"),
    buyerContact: z.string().min(1, "Buyer Contact is required"),
    soldPrice: z.number().min(0, "Selling Price must be positive"),
    totalCost: z.number().min(0, "Total Cost must be positive"),
    sRemainingAmount: z.number().min(0, "Remaining Amount must be positive"),
})

const paymentHeaders = [
    { id: "date", title: "Payment Date" },
    { id: "amount", title: "Amount" },
    { id: "method", title: "Payment Method" },
    { id: "actions", title: "" },
];

export default function SalesContent() {
    const { vehicle, salesDetails, salesPayments, sRemaining, totalCost } = useVehicleContext();

    const soldPriceFallback = salesDetails?.salesAmount || totalCost;

    const form = useForm<z.infer<typeof formSchema>>({
        defaultValues: {
            salesDate: toDate(salesDetails?.salesDate),
            buyer: salesDetails?.buyerName,
            buyerContact: salesDetails?.buyerContact,
            totalCost: totalCost,
            soldPrice: soldPriceFallback,
            sRemainingAmount: sRemaining,
        },
    });

    useEffect(() => {
        form.reset({
            salesDate: toDate(salesDetails?.salesDate),
            buyer: salesDetails?.buyerName,
            buyerContact: salesDetails?.buyerContact,
            totalCost: totalCost,
            soldPrice: soldPriceFallback,
            sRemainingAmount: sRemaining,
        });
    }, [vehicle, salesDetails, salesPayments, sRemaining, totalCost, form]);

    function onSubmit(data: z.infer<typeof formSchema>) {
        console.log(data);
    }

    return (
        <div className="p-4">
            <div className="h-full flex flex-col gap-y-8">
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-2 gap-4">
                        {vehicle?.vehicleStatus === "sold" && (
                            <>
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
                                                    disabled
                                                />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="buyer"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Buyer</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="text"
                                                    disabled
                                                    placeholder="Buyer"
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                                    {...field}
                                                />
                                            </FormControl>
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
                                                <Input
                                                    type="text"
                                                    disabled
                                                    placeholder="Buyer Contact"
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                                    {...field}
                                                />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                            </>
                        )}
                        <FormField
                            control={form.control}
                            name="totalCost"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Total Cost</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="number"
                                            disabled
                                            placeholder="Total Cost"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                            {...field}
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="soldPrice"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{vehicle?.vehicleStatus === "sold" ? "Sold Price" : "Selling Price"}</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="number"
                                            disabled
                                            placeholder={vehicle?.vehicleStatus === "Sold" ? "Sold Price" : "Selling Price"}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                            {...field}
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                        {vehicle?.vehicleStatus === "sold" && (
                            <FormField
                                control={form.control}
                                name="sRemainingAmount"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Remaining Amount</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                disabled
                                                placeholder="Remaining Amount"
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                                {...field}
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                        )}
                    </form>
                </Form>

                {vehicle?.vehicleStatus === "active"
                    ? <EditActiveSalesDialog id={vehicle?.id} data={salesDetails} />
                    : <EditSoldSalesDialog id={vehicle?.id} data={salesDetails} />
                }
            </div>

            {vehicle?.vehicleStatus === "sold" && (
                <Separator className="my-4" />
            )}

            {vehicle?.vehicleStatus === "sold" && (
                <div className="w-full flex flex-col gap-2">
                    <h2 className="text-lg font-medium mb-2">Sales Payments</h2>
                    <PaymentsTable
                        id={vehicle?.id}
                        headers={paymentHeaders}
                        paymentType="sale"
                        data={salesPayments}
                    />
                </div>
            )}
        </div>
    );
}