"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { useId, useState } from "react";
import { useForm } from "react-hook-form";
import z from "zod";
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
import { isSystemAccountTypeName } from "@/lib/constants/client-account";
import { LookupFormFields } from "./lookup-form-fields";

export const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  shortForm: z.string().optional(),
});

export type FormSchema = z.infer<typeof formSchema>;

interface CreateModalProps {
  entityLabel: string;
  onCreate?: (data: { name: string; shortForm?: string }) => Promise<void>;
  /**
   * Controlled mode (opened from a select's "Create new …" item): no
   * trigger button is rendered.
   */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Called with the new entry's name after it is created. */
  onCreated?: (name: string) => void;
}

export default function CreateModal({
  entityLabel,
  onCreate,
  open: controlledOpen,
  onOpenChange,
  onCreated,
}: CreateModalProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;
  const setOpen = (next: boolean) => {
    if (!isControlled) setUncontrolledOpen(next);
    onOpenChange?.(next);
  };
  const formId = useId();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const isAccountType = entityLabel.toLowerCase() === "account type";

  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      shortForm: "",
    },
  });

  async function onSubmit(data: FormSchema) {
    if (isAccountType && isSystemAccountTypeName(data.name)) {
      setFormError(
        `The "${data.name.trim()}" account type is system-managed and cannot be created manually.`,
      );
      return;
    }

    try {
      setIsSubmitting(true);
      setFormError("");
      await onCreate?.({
        name: data.name,
        shortForm: data.shortForm,
      });
      form.reset();
      setOpen(false);
      onCreated?.(data.name.trim());
    } catch (error) {
      console.error(`Failed to create ${entityLabel}`, error);
      setFormError(
        error instanceof Error
          ? error.message
          : `Failed to create ${entityLabel.toLowerCase()}.`,
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const lower = entityLabel.toLowerCase();
  const watchedName = form.watch("name")?.trim();

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (isSubmitting) return;
        setOpen(next);
        if (!next) {
          form.reset();
          setFormError("");
        }
      }}
    >
      {isControlled ? null : (
        <DialogTrigger asChild>
          <Button>
            <Plus />
            New {lower}
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className={`${ruledDialogContentClass} sm:max-w-lg`}>
        <RuledDialogHeader
          eyebrow={`( Settings · ${entityLabel}s )`}
          lead="Add a"
          title={`${lower}.`}
          description={`New ${lower}s appear in the pickers across the app straight away.`}
        />
        <form
          id={formId}
          onSubmit={(event) => {
            // Opened inside another form's dialog: don't submit that form too.
            event.stopPropagation();
            void form.handleSubmit(onSubmit)(event);
          }}
        >
          <LookupFormFields
            form={form}
            entityLabel={entityLabel}
            idPrefix="create"
            formError={formError}
            onEdit={() => {
              if (formError) setFormError("");
            }}
          />
        </form>
        <RuledDialogFooter
          summary={watchedName ? `Adds “${watchedName}”` : `Name the ${lower}`}
        >
          <DialogClose asChild>
            <Button type="button" variant="ghost" disabled={isSubmitting}>
              Cancel
            </Button>
          </DialogClose>
          <Button type="submit" form={formId} disabled={isSubmitting}>
            {isSubmitting ? "Adding…" : `Add ${lower}`}
          </Button>
        </RuledDialogFooter>
      </DialogContent>
    </Dialog>
  );
}
