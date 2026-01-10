// Purchased date, amount, seller name, seller contact, legal owner, isCR
// Purchase payments table
'use client'

import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { z } from "zod";
import CalendarPopover from "./calendar-popover";
import { useForm } from "react-hook-form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import PaymentsTable from "./payments-table";

const formSchema = z.object({
    purchasedDate: z.date().min(new Date("1900-01-01"), "Purchased Date must be after Jan 1, 1900"),
    amount: z.number().min(0, "Amount must be positive"),
    sellerName: z.string().min(1, "Seller Name is required"),
    sellerContact: z.string().min(1, "Seller Contact is required"),
    legalOwner: z.string().min(1, "Legal Owner is required"),
    isCR: z.boolean(),
})

const paymentHeaders = [
    { id: "date", title: "Payment Date" },
    { id: "amount", title: "Amount" },
    { id: "method", title: "Payment Method" },
    { id: "actions", title: "" },
];

export default function PurchasingContent() {
    const form = useForm<z.infer<typeof formSchema>>({
        defaultValues: {
            purchasedDate: new Date(),
            amount: 0,
            sellerName: "",
            sellerContact: "",
            legalOwner: "",
            isCR: false,
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
                        name="purchasedDate"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Purchased Date</FormLabel>
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
                        name="amount"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Amount</FormLabel>
                                <FormControl>
                                    <input
                                        type="number"
                                        placeholder="Amount"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
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
                                    <input
                                        type="text"
                                        placeholder="Seller Name"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
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
                                    <input
                                        type="text"
                                        placeholder="Seller Contact"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
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
                                    <input
                                        type="text"
                                        placeholder="Legal Owner"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
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
                            </FormItem>
                        )}
                    />
                </form>
            </Form>

            <Separator className="my-4" />

            <div className="w-full flex flex-col gap-2">
                <h2 className="text-lg font-medium mb-2">Purchase Payments</h2>
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