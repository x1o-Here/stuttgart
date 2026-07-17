"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { useState } from "react";
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

export const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  shortForm: z.string().optional(),
});

export type FormSchema = z.infer<typeof formSchema>;

interface CreateModalProps {
  entityLabel: string;
  onCreate?: (data: { name: string; shortForm?: string }) => Promise<void>;
}

export default function CreateModal({
  entityLabel,
  onCreate,
}: CreateModalProps) {
  const [open, setOpen] = useState(false);
  const isVehicle = entityLabel.toLowerCase() === "vehicle";

  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      shortForm: "",
    },
  });

  async function onSubmit(data: FormSchema) {
    try {
      await onCreate?.({
        name: data.name,
        shortForm: isVehicle ? "" : data.shortForm,
      });
      form.reset();
      setOpen(false);
    } catch (error) {
      console.error(`Failed to create ${entityLabel}`, error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus />
          <span>Add</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="w-full min-w-2xl">
        <DialogHeader>
          <DialogTitle>Add {entityLabel}</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <form id="create-form" onSubmit={form.handleSubmit(onSubmit)}>
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
                      {isVehicle ? "Vehicle Number" : entityLabel}
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
          <Button type="submit" form="create-form">
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
