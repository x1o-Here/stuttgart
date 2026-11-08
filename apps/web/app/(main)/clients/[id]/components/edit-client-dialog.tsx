"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import ConfirmationDialog from "@/components/custom/confirmation-dialog";
import {
  RuledDialogFooter,
  RuledDialogHeader,
  ruledDialogContentClass,
} from "@/components/shared/ruled-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { useAuth } from "@/contexts/auth-context";
import { useUpdateClient } from "@/lib/data/clients";
import {
  ClientFormSections,
  type ClientFormValues,
  clientFormSchema,
} from "../../components/client-form-fields";

type EditClientDialogProps = {
  clientId: string;
  defaultValues: ClientFormValues;
};

export default function EditClientDialog({
  clientId,
  defaultValues,
}: EditClientDialogProps) {
  const [open, setOpen] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const { user, activeCompany } = useAuth();
  const updateClient = useUpdateClient(activeCompany, clientId);
  const isSubmitting = updateClient.isPending;

  const form = useForm<ClientFormValues>({
    defaultValues,
    resolver: zodResolver(clientFormSchema),
    mode: "onSubmit",
    reValidateMode: "onSubmit",
  });

  useEffect(() => {
    if (open) {
      form.reset(defaultValues);
    }
  }, [open, defaultValues, form]);

  async function onSubmit(data: ClientFormValues) {
    if (!activeCompany || !user) return;

    try {
      await updateClient.mutateAsync({
        input: data,
        previousName: defaultValues.name,
      });
      form.reset(data);
      setOpen(false);
    } catch (error) {
      console.error("Failed to update client", error);
    }
  }

  function handleCancel() {
    if (isSubmitting) return;
    if (form.formState.isDirty) {
      setConfirmClose(true);
    } else {
      form.reset(defaultValues);
      setOpen(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setOpen(true);
          return;
        }
        handleCancel();
      }}
    >
      <Form {...form}>
        <DialogTrigger asChild>
          <Button variant="outline">
            <Pencil />
            Edit details
          </Button>
        </DialogTrigger>
        <DialogContent className={ruledDialogContentClass}>
          <RuledDialogHeader
            eyebrow="( Client record · Edit )"
            lead="Edit"
            title="client details."
            description="Renaming the client also renames its linked account."
          />
          <form id="edit-client-form" onSubmit={form.handleSubmit(onSubmit)}>
            <ClientFormSections form={form} />
          </form>
          <RuledDialogFooter
            summary={
              form.formState.isDirty ? "Unsaved changes" : "No changes yet"
            }
          >
            <Button
              type="button"
              variant="ghost"
              onClick={handleCancel}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="edit-client-form"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Saving…" : "Save changes"}
            </Button>
          </RuledDialogFooter>
        </DialogContent>

        <ConfirmationDialog
          open={confirmClose}
          onOpenChange={setConfirmClose}
          onConfirm={() => {
            form.reset(defaultValues);
            setConfirmClose(false);
            setOpen(false);
          }}
        />
      </Form>
    </Dialog>
  );
}
