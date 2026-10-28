"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import {
  RuledDialogFooter,
  RuledDialogHeader,
  ruledDialogContentClass,
} from "@/components/shared/ruled-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/auth-context";
import { type CollectionKey, useLookupStore } from "@/stores/use-lookup-store";
import { type FormSchema, formSchema } from "./create-modal";
import { LookupFormFields } from "./lookup-form-fields";

interface UpdateModalProps {
  entityLabel: string;
  initialData: { id: string; name: string; shortForm: string };
}

export default function UpdateModal({
  entityLabel,
  initialData,
}: UpdateModalProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user, activeCompany } = useAuth();
  const updateItem = useLookupStore((s) => s.updateItem);

  const label = entityLabel.toLowerCase();
  const collectionKey: CollectionKey =
    label === "account type"
      ? "account-types"
      : label === "supplier type"
        ? "supplier-types"
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
    if (!activeCompany || !user || isSubmitting) return;

    const nextShortForm = data.shortForm ?? "";
    if (
      data.name === initialData.name &&
      nextShortForm === (initialData.shortForm ?? "")
    ) {
      setOpen(false);
      return;
    }

    try {
      setIsSubmitting(true);
      await updateItem(activeCompany, user.uid, collectionKey, initialData.id, {
        name: data.name,
        shortForm: nextShortForm,
      });
      form.reset();
      setOpen(false);
    } catch (error) {
      console.error(`Failed to update ${entityLabel}`, error);
    } finally {
      setIsSubmitting(false);
    }
  }

  const lower = entityLabel.toLowerCase();

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!isSubmitting) setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Edit ${initialData.name}`}
          className="text-muted-foreground hover:text-foreground"
        >
          <Pencil />
        </Button>
      </DialogTrigger>
      <DialogContent className={`${ruledDialogContentClass} sm:max-w-lg`}>
        <RuledDialogHeader
          eyebrow={`( Settings · ${initialData.name} )`}
          lead="Edit"
          title={`${lower}.`}
          description="Existing transactions keep the name they were recorded with."
        />
        <form
          id={`update-form-${initialData.id}`}
          onSubmit={form.handleSubmit(onSubmit)}
        >
          <LookupFormFields
            form={form}
            entityLabel={entityLabel}
            idPrefix={`update-${initialData.id}`}
          />
        </form>
        <RuledDialogFooter
          summary={
            form.formState.isDirty ? "Unsaved changes" : "No changes yet"
          }
        >
          <DialogClose asChild>
            <Button type="button" variant="ghost" disabled={isSubmitting}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            type="submit"
            form={`update-form-${initialData.id}`}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Saving…" : "Save changes"}
          </Button>
        </RuledDialogFooter>
      </DialogContent>
    </Dialog>
  );
}
