"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import z from "zod";
import {
  RuledDialogFooter,
  RuledDialogHeader,
  RuledDialogSection,
  ruledDialogContentClass,
} from "@/components/shared/ruled-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/auth-context";
import { useLookupStore } from "@/stores/use-lookup-store";

const vehicleSchema = z.object({
  name: z.string().trim().min(1, "Vehicle number is required"),
  description: z.string().trim().optional(),
});

type VehicleFormValues = z.infer<typeof vehicleSchema>;

export type VehicleRow = {
  id: string;
  name: string;
  description: string;
};

interface VehicleFormDialogProps {
  /** Omit to create a new vehicle. */
  vehicle?: VehicleRow;
  /** Edit trigger style: "icon" for table rows (default), "button" for headers. */
  triggerVariant?: "icon" | "button";
}

export default function VehicleFormDialog({
  vehicle,
  triggerVariant = "icon",
}: VehicleFormDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user, activeCompany } = useAuth();
  const createItem = useLookupStore((s) => s.createItem);
  const updateItem = useLookupStore((s) => s.updateItem);
  const vehicles = useLookupStore((s) => s.vehicles);

  const isEdit = !!vehicle;
  const formId = isEdit ? `vehicle-form-${vehicle.id}` : "vehicle-form-new";

  const form = useForm<VehicleFormValues>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: { name: "", description: "" },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name: vehicle?.name ?? "",
        description: vehicle?.description ?? "",
      });
    }
  }, [open, vehicle, form]);

  async function onSubmit(data: VehicleFormValues) {
    if (!activeCompany || !user || isSubmitting) return;

    const name = data.name.trim();
    const description = data.description?.trim() ?? "";

    const duplicate = vehicles.some(
      (v) =>
        v.id !== vehicle?.id &&
        v.name.trim().toLowerCase() === name.toLowerCase(),
    );
    if (duplicate) {
      form.setError("name", { message: "This vehicle number already exists" });
      return;
    }

    if (
      isEdit &&
      name === vehicle.name &&
      description === (vehicle.description ?? "")
    ) {
      setOpen(false);
      return;
    }

    try {
      setIsSubmitting(true);
      if (isEdit) {
        await updateItem(activeCompany, user.uid, "vehicles", vehicle.id, {
          name,
          description,
        });
      } else {
        await createItem(activeCompany, user.uid, "vehicles", {
          name,
          description,
        });
      }
      form.reset();
      setOpen(false);
    } catch (error) {
      console.error(`Failed to ${isEdit ? "update" : "create"} vehicle`, error);
    } finally {
      setIsSubmitting(false);
    }
  }

  const watchedName = form.watch("name")?.trim();

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!isSubmitting) setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        {isEdit ? (
          triggerVariant === "button" ? (
            <Button variant="outline">
              <Pencil />
              Edit details
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Edit ${vehicle.name}`}
              className="text-muted-foreground hover:text-foreground"
              onClick={(event) => event.stopPropagation()}
            >
              <Pencil />
            </Button>
          )
        ) : (
          <Button>
            <Plus />
            New vehicle
          </Button>
        )}
      </DialogTrigger>
      <DialogContent
        className={`${ruledDialogContentClass} sm:max-w-lg`}
        onClick={(event) => event.stopPropagation()}
      >
        <RuledDialogHeader
          eyebrow={
            isEdit ? `( Fleet · ${vehicle.name} )` : "( Fleet · New vehicle )"
          }
          lead={isEdit ? "Edit" : "Register a"}
          title={isEdit ? "vehicle." : "vehicle."}
          description="The vehicle number is what you pick when recording a transaction."
        />
        <form id={formId} onSubmit={form.handleSubmit(onSubmit)}>
          <FieldGroup className="gap-0">
            <RuledDialogSection label="01 / Identification">
              <Controller
                name="name"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field
                    data-invalid={fieldState.invalid}
                    className="sm:col-span-2"
                  >
                    <FieldLabel htmlFor={`${formId}-name`}>
                      Vehicle number
                    </FieldLabel>
                    <Input
                      {...field}
                      id={`${formId}-name`}
                      aria-invalid={fieldState.invalid}
                      placeholder="e.g. LB-1234"
                      autoComplete="off"
                      className="font-mono"
                    />
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />
              <Controller
                name="description"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field
                    data-invalid={fieldState.invalid}
                    className="sm:col-span-2"
                  >
                    <FieldLabel htmlFor={`${formId}-description`}>
                      Description
                    </FieldLabel>
                    <Textarea
                      {...field}
                      id={`${formId}-description`}
                      aria-invalid={fieldState.invalid}
                      placeholder="e.g. 20ft lorry, Isuzu Elf"
                      rows={3}
                    />
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />
            </RuledDialogSection>
          </FieldGroup>
        </form>
        <RuledDialogFooter
          summary={
            watchedName
              ? `${isEdit ? "Saves" : "Adds"} ${watchedName} to the fleet`
              : "Enter a vehicle number"
          }
        >
          <DialogClose asChild>
            <Button type="button" variant="ghost" disabled={isSubmitting}>
              Cancel
            </Button>
          </DialogClose>
          <Button type="submit" form={formId} disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : isEdit ? "Save changes" : "Add vehicle"}
          </Button>
        </RuledDialogFooter>
      </DialogContent>
    </Dialog>
  );
}
