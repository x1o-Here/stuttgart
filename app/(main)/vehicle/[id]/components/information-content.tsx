'use client'

import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { z } from "zod";
import EditInformationDialog from "./edit-information";
import { useVehicleContext } from "@/contexts/useVehicleContext";
import { useEffect } from "react";

const formSchema = z.object({
    make: z.string().min(1, "Make is required"),
    yom: z.number().min(1900, "Year of Manufacture must be valid").max(new Date().getFullYear(), "Year of Manufacture cannot be in the future"),
    months: z.number().min(0, "Months cannot be negative"),
})

export default function InformationContent() {
    const { vehicle } = useVehicleContext();

    const form = useForm<z.infer<typeof formSchema>>({
        defaultValues: {
            make: vehicle?.make,
            yom: vehicle?.yom,
            months: vehicle?.months,
        },
    });

    useEffect(() => {
        form.reset({
            make: vehicle?.make,
            yom: vehicle?.yom,
            months: vehicle?.months,
        });
    }, [vehicle, form]);

    function onSubmit(data: z.infer<typeof formSchema>) {
        console.log(data);
    }

    return (
        <div className="flex flex-col gap-y-8 items-right justify-between p-4">
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
                                        disabled
                                        placeholder="Make"
                                        className="text-black"
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
                                        disabled
                                        placeholder="Year of Manufacture"
                                        className="text-black"
                                        max={4}
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
                                        className="text-black"
                                        disabled
                                        {...field}
                                    />
                                </FormControl>
                            </FormItem>
                        )}
                    />
                </form>
            </Form>

            <EditInformationDialog id={vehicle?.id} data={vehicle} />
        </div>
    )
}