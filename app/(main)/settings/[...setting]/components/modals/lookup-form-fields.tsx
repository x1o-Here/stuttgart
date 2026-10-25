"use client";

import { Controller, type UseFormReturn } from "react-hook-form";
import { RuledDialogSection } from "@/components/shared/ruled-dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { FormSchema } from "./create-modal";

type LookupFormFieldsProps = {
  form: UseFormReturn<FormSchema>;
  entityLabel: string;
  idPrefix: string;
  formError?: string;
  onEdit?: () => void;
};

/** Name + short form section shared by the create and update lookup modals. */
export function LookupFormFields({
  form,
  entityLabel,
  idPrefix,
  formError,
  onEdit,
}: LookupFormFieldsProps) {
  return (
    <RuledDialogSection label="01 / Entry" className="sm:grid-cols-[1fr_9rem]">
      <Controller
        name="name"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor={`${idPrefix}-name`}>Name</FieldLabel>
            <Input
              {...field}
              id={`${idPrefix}-name`}
              aria-invalid={fieldState.invalid}
              placeholder={`e.g. ${entityLabel === "Department" ? "Operations" : "Bank"}`}
              autoComplete="off"
              onChange={(event) => {
                field.onChange(event);
                onEdit?.();
              }}
            />
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />
      <Controller
        name="shortForm"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor={`${idPrefix}-short`}>Short form</FieldLabel>
            <Input
              {...field}
              id={`${idPrefix}-short`}
              aria-invalid={fieldState.invalid}
              placeholder={entityLabel === "Department" ? "OPS" : "BNK"}
              autoComplete="off"
              className="font-mono"
            />
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />
      <p className="text-xs text-muted-foreground sm:col-span-2">
        The short form is the tag shown in tables, e.g. on the dashboard.
      </p>
      {formError ? (
        <p className="rounded-md bg-danger-soft px-3 py-2 text-sm text-destructive sm:col-span-2">
          {formError}
        </p>
      ) : null}
    </RuledDialogSection>
  );
}
