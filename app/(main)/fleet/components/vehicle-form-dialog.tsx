"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import z from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
}

export default function VehicleFormDialog({ vehicle }: VehicleFormDialogProps) {
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isEdit ? (
          <Button
            variant="outline"
            size="icon"
            className="cursor-pointer w-8 h-8"
          >
            <Pencil />
          </Button>
        ) : (
          <Button className="cursor-pointer">
            <Plus />
            Add Vehicle
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Vehicle" : "Add Vehicle"}</DialogTitle>
        </DialogHeader>
        <form id={formId} onSubmit={form.handleSubmit(onSubmit)}>
          <FieldGroup className="gap-6 py-2">
            <Controller
              name="name"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={`${formId}-name`}>
                    Vehicle Number
                  </FieldLabel>
                  <Input
                    {...field}
                    id={`${formId}-name`}
                    aria-invalid={fieldState.invalid}
                    placeholder="e.g. LB-1234"
                    autoComplete="off"
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
                <Field data-invalid={fieldState.invalid}>
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
          </FieldGroup>
        </form>
        <DialogFooter className="pt-4 border-t">
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={isSubmitting}>
              Cancel
            </Button>
          </DialogClose>
          <Button type="submit" form={formId} disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : isEdit ? "Save Changes" : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
