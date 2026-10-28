"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useLookupStore } from "@/stores/use-lookup-store";

export const supplierFormSchema = z.object({
  name: z.string().trim().min(1, "Supplier name is required"),
  tin: z.string().trim().min(1, "TIN is required"),
  address: z.string().trim().min(1, "Address is required"),
  supplierType: z.string().min(1, "Supplier type is required"),
  contactNo: z.string().trim().min(1, "Contact number is required"),
});

export type SupplierFormValues = z.infer<typeof supplierFormSchema>;

export const EMPTY_SUPPLIER: SupplierFormValues = {
  name: "",
  tin: "",
  address: "",
  supplierType: "",
  contactNo: "",
};

/** Ruled sections shared by the add and edit supplier dialogs. */
export function SupplierFormSections({
  form,
}: {
  form: UseFormReturn<SupplierFormValues>;
}) {
  const router = useRouter();
  const supplierTypes = useLookupStore((s) => s.supplierTypes);
  const typesLoading = useLookupStore((s) => s.loading["supplier-types"]);

  return (
    <>
      <RuledDialogSection label="01 / Identity">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem className="sm:col-span-2">
              <FormLabel>Supplier name</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Lanka Tyre Traders" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="tin"
          render={({ field }) => (
            <FormItem>
              <FormLabel>TIN</FormLabel>
              <FormControl>
                <Input
                  placeholder="Taxpayer identification no"
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
          name="supplierType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Supplier type</FormLabel>
              <Select
                value={field.value}
                onValueChange={(value) => {
                  if (value === "__new__") {
                    router.push("/settings/supplier-types");
                    return;
                  }
                  field.onChange(value);
                }}
                disabled={typesLoading}
              >
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue
                      placeholder={
                        typesLoading ? "Loading types…" : "Select a type"
                      }
                    />
                  </SelectTrigger>
                </FormControl>
                <SelectContent position="popper" side="bottom">
                  {supplierTypes.map((type) => (
                    <SelectItem key={type.id} value={type.name}>
                      {type.name}
                    </SelectItem>
                  ))}
                  <SelectItem value="__new__">
                    <Plus />
                    Create new supplier type
                  </SelectItem>
                </SelectContent>
              </Select>
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
              <FormLabel>Address</FormLabel>
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
