"use client";

import type { UseFormReturn } from "react-hook-form";
import z from "zod";
import { RuledDialogSection } from "@/components/shared/ruled-dialog";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export const clientFormSchema = z.object({
  name: z.string().min(1, "Customer name is required"),
  address: z.string().min(1, "Address is required"),
  vatNo: z.string().min(1, "VAT number is required"),
  contactNo: z.string().min(1, "Contact number is required"),
});

export type ClientFormValues = z.infer<typeof clientFormSchema>;

/** Ruled sections shared by the add and edit client dialogs. */
export function ClientFormSections({
  form,
}: {
  form: UseFormReturn<ClientFormValues>;
}) {
  return (
    <>
      <RuledDialogSection label="01 / Identity">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem className="sm:col-span-2">
              <FormLabel>Customer name</FormLabel>
              <FormControl>
                <Input type="text" placeholder="Acme Ltd" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="vatNo"
          render={({ field }) => (
            <FormItem className="sm:col-span-2">
              <FormLabel>VAT No</FormLabel>
              <FormControl>
                <Input
                  type="text"
                  placeholder="VAT123456789"
                  className="font-mono"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </RuledDialogSection>

      <RuledDialogSection label="02 / Contact">
        <FormField
          control={form.control}
          name="contactNo"
          render={({ field }) => (
            <FormItem className="sm:col-span-2">
              <FormLabel>Contact No</FormLabel>
              <FormControl>
                <Input
                  type="tel"
                  placeholder="+94 77 123 4567"
                  className="font-mono"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem className="sm:col-span-2">
              <FormLabel>Billing address</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Street, city, postal code"
                  className="min-h-20"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </RuledDialogSection>
    </>
  );
}
