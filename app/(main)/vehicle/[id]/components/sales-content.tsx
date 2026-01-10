// Sales date, Buyer, Buyer Contact, Selling Price, Remaining Amount
// Sales payments table
'use client'

import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { z } from "zod";
import CalendarPopover from "./calendar-popover";
import { useForm } from "react-hook-form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import PaymentsTable from "./payments-table";

const formSchema = z.object({
    salesDate: z.date().min(new Date("1900-01-01"), "Sales Date must be after Jan 1, 1900"),
    buyer: z.string().min(1, "Buyer is required"),
    buyerContact: z.string().min(1, "Buyer Contact is required"),
    soldPrice: z.number().min(0, "Selling Price must be positive"),
    remainingAmount: z.number().min(0, "Remaining Amount must be positive"),
})

const paymentHeaders = [
    { id: "date", title: "Payment Date" },
    { id: "amount", title: "Amount" },
    { id: "method", title: "Payment Method" },
    { id: "actions", title: "" },
];

export default function SalesContent() {
    const form = useForm<z.infer<typeof formSchema>>({
        defaultValues: {
            salesDate: new Date(),
            buyer: "",
            buyerContact: "",
            soldPrice: 0,
            remainingAmount: 0,
        },
    });

    function onSubmit(data: z.infer<typeof formSchema>) {
        console.log(data);
    }

    return (
        <div className="p-4">
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-2 gap-4">
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
                                    <input
                                        type="text"
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
                                    <input
                                        type="text"
                                        placeholder="Buyer Contact"
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
                                <FormLabel>Sold Price</FormLabel>
                                <FormControl>
                                    <input
                                        type="number"
                                        placeholder="Sold Price"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                        {...field}
                                    />
                                </FormControl>
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="remainingAmount"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Remaining Amount</FormLabel>
                                <FormControl>
                                    <input
                                        type="number"
                                        placeholder="Remaining Amount"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                        {...field}
                                    />
                                </FormControl>
                            </FormItem>
                        )}
                    />
                </form>
            </Form>

            <Separator className="my-4" />

            <div className="w-full flex flex-col gap-2">
                <h2 className="text-lg font-medium mb-2">Sales Payments</h2>
                <PaymentsTable
                    headers={paymentHeaders}
                    data={[
                        {
                            date: "2020-01-01",
                            amount: "LKR 2000000",
                            method: "Cash"
                        }
                    ]}
                />
            </div>
        </div>
    );
}