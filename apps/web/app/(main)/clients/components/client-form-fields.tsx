"use client";

import {
  type ClientInput,
  clientInputSchema,
} from "@stuttgart/shared/schemas/clients";
import type { UseFormReturn } from "react-hook-form";
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

/** Same schema the server validates with (packages/shared). */
export const clientFormSchema = clientInputSchema;
export type ClientFormValues = ClientInput;

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
