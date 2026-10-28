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

export const partFormSchema = z.object({
  partId: z.string().trim().min(1, "Part ID is required").max(60, "Too long"),
  description: z
    .string()
    .trim()
    .min(1, "Description is required")
    .max(300, "Keep it under 300 characters"),
});

export type PartFormValues = z.infer<typeof partFormSchema>;

/** Part ID + description section shared by the add and edit dialogs. */
export function PartFormFields({
  form,
  idPrefix,
  error,
}: {
  form: UseFormReturn<PartFormValues>;
  idPrefix: string;
  error?: string | null;
}) {
  return (
    <RuledDialogSection label="01 / Part">
      <FormField
        control={form.control}
        name="partId"
        render={({ field }) => (
          <FormItem className="sm:col-span-2">
            <FormLabel htmlFor={`${idPrefix}-part-id`}>Part ID</FormLabel>
            <FormControl>
              <Input
                id={`${idPrefix}-part-id`}
                placeholder="e.g. BRK-0042"
                autoComplete="off"
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
        name="description"
        render={({ field }) => (
          <FormItem className="sm:col-span-2">
            <FormLabel htmlFor={`${idPrefix}-description`}>
              Description
            </FormLabel>
            <FormControl>
              <Textarea
                id={`${idPrefix}-description`}
                rows={3}
                placeholder="e.g. Front brake pads, Isuzu Elf"
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      {error ? (
        <p
          role="alert"
          className="rounded-md bg-danger-soft px-3 py-2 text-sm text-destructive sm:col-span-2"
        >
          {error}
        </p>
      ) : null}
    </RuledDialogSection>
  );
}
