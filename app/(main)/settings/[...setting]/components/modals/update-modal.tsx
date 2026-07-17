"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil } from "lucide-react";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
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
import { useAuth } from "@/contexts/auth-context";
import { type CollectionKey, useLookupStore } from "@/stores/use-lookup-store";
import { type FormSchema, formSchema } from "./create-modal";

interface UpdateModalProps {
  entityLabel: string;
  initialData: { id: string; name: string; shortForm: string };
}

export default function UpdateModal({
  entityLabel,
  initialData,
}: UpdateModalProps) {
  const [open, setOpen] = useState(false);
  const { user, activeCompany } = useAuth();
  const store = useLookupStore();

  const isVehicle = entityLabel.toLowerCase() === "vehicle";
  const label = entityLabel.toLowerCase();
  const collectionKey: CollectionKey =
    label === "vehicle"
      ? "vehicles"
      : label === "account type"
        ? "account-types"
        : "departments";

  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: initialData.name,
      shortForm: initialData.shortForm,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name: initialData.name,
        shortForm: initialData.shortForm,
      });
    }
  }, [open, initialData]);

  async function onSubmit(data: FormSchema) {
    if (!activeCompany || !user) return;
    try {
      await store.updateItem(
        activeCompany,
        user.uid,
        collectionKey,
        initialData.id,
        {
          name: data.name,
          shortForm: isVehicle ? "" : data.shortForm,
        },
      );
      form.reset();
      setOpen(false);
    } catch (error) {
      console.error(`Failed to update ${entityLabel}`, error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="cursor-pointer w-8 h-8"
        >
          <Pencil />
        </Button>
      </DialogTrigger>
      <DialogContent className="w-full min-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit {entityLabel}</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <form id="update-form" onSubmit={form.handleSubmit(onSubmit)}>
            <FieldGroup className="grid grid-cols-5 gap-6">
              <Controller
                name="name"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field
                    data-invalid={fieldState.invalid}
                    className={isVehicle ? "col-span-5" : "col-span-4"}
                  >
                    <FieldLabel htmlFor="name">
                      {isVehicle ? "Vehicle Number" : "Name"}
                    </FieldLabel>
                    <Input
                      {...field}
                      id="name"
                      aria-invalid={fieldState.invalid}
                      placeholder={
                        isVehicle
                          ? "e.g. MH-12-XX-1234"
                          : `Enter ${entityLabel.toLowerCase()} name`
                      }
                      autoComplete="off"
                    />
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />
              {!isVehicle && (
                <Controller
                  name="shortForm"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="shortForm">Short Form</FieldLabel>
                      <Input
                        {...field}
                        id="shortForm"
                        aria-invalid={fieldState.invalid}
                        placeholder="AST"
                        autoComplete="off"
                      />
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />
              )}
            </FieldGroup>
          </form>
        </div>
        <DialogFooter className="pt-4 border-t">
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button type="submit" form="update-form">
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
