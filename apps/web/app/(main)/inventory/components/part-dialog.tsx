"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus } from "lucide-react";
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
import { Form } from "@/components/ui/form";
import { useAuth } from "@/contexts/auth-context";
import {
  createPart,
  InventoryError,
  type SparePart,
  updatePart,
} from "@/lib/inventory/spare-parts";
import {
  PartFormFields,
  type PartFormValues,
  partFormSchema,
} from "./part-form-fields";

/** Add a part to stock, or (with `part`) edit its ID and description. */
export function PartDialog({ part }: { part?: SparePart }) {
  const isEdit = !!part;
  const { user, activeCompany } = useAuth();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formId = isEdit ? `part-form-${part.id}` : "part-form-new";

  const form = useForm<PartFormValues>({
    resolver: zodResolver(partFormSchema),
    defaultValues: { partId: "", description: "" },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        partId: part?.partId ?? "",
        description: part?.description ?? "",
      });
      setError(null);
    }
  }, [open, part, form]);

  async function onSubmit(data: PartFormValues) {
    if (!activeCompany || !user) return;
    setSaving(true);
    setError(null);
    try {
      if (isEdit) {
        await updatePart(activeCompany, user.uid, part.id, data);
      } else {
        await createPart(activeCompany, user.uid, data);
      }
      setOpen(false);
    } catch (err) {
      console.error("Failed to save spare part", err);
      setError(
        err instanceof InventoryError
          ? err.message
          : "Couldn’t save the part. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  const watchedId = form.watch("partId")?.trim();

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!saving) setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        {isEdit ? (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Edit ${part.partId}`}
            className="text-muted-foreground hover:text-foreground"
          >
            <Pencil />
          </Button>
        ) : (
          <Button>
            <Plus />
            Add part
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className={`${ruledDialogContentClass} sm:max-w-lg`}>
        <RuledDialogHeader
          eyebrow={
            isEdit
              ? `( Inventory · ${part.partId} )`
              : "( Inventory · New part )"
          }
          lead={isEdit ? "Edit" : "Add a"}
          title={isEdit ? "spare part." : "spare part to stock."}
          description="Each part ID is one physical part and must be unique."
        />
        <Form {...form}>
          <form id={formId} onSubmit={form.handleSubmit(onSubmit)}>
            <PartFormFields form={form} idPrefix={formId} error={error} />
          </form>
        </Form>
        <RuledDialogFooter
          summary={
            watchedId
              ? isEdit
                ? `Saves ${watchedId}`
                : `Adds ${watchedId} to stock`
              : "Enter a part ID"
          }
        >
          <DialogClose asChild>
            <Button type="button" variant="ghost" disabled={saving}>
              Cancel
            </Button>
          </DialogClose>
          <Button type="submit" form={formId} disabled={saving}>
            {saving ? "Saving…" : isEdit ? "Save changes" : "Add to stock"}
          </Button>
        </RuledDialogFooter>
      </DialogContent>
    </Dialog>
  );
}
