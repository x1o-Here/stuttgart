'use client'

import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { z } from "zod";

const formSchema = z.object({
    make: z.string().min(1, "Make is required"),
    yom: z.number().min(1900, "Year of Manufacture must be valid").max(new Date().getFullYear(), "Year of Manufacture cannot be in the future"),
    months: z.number().min(0, "Months cannot be negative"),
})

export default function InformationContent() {
    const form = useForm<z.infer<typeof formSchema>>({
        defaultValues: {
            make: "",
            yom: new Date().getFullYear(),
            months: 0,
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
                        name="make"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Make</FormLabel>
                                <FormControl>
                                    <Input
                                        placeholder="Make"
                                        {...field}
                                    />
                                </FormControl>
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="yom"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Year of Manufacture</FormLabel>
                                <FormControl>
                                    <Input
                                        type="number"
                                        placeholder="Year of Manufacture"
                                        {...field}
                                    />
                                </FormControl>
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="months"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Months</FormLabel>
                                <FormControl>
                                    <Input
                                        type="number"
                                        placeholder="Number of months with us"
                                        disabled
                                        {...field}
                                    />
                                </FormControl>
                            </FormItem>
                        )}
                    />
                </form>
            </Form>
        </div>
    )
}