"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { useState } from "react";
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
import { useCreateClient } from "@/lib/data/clients";
import {
  ClientFormSections,
  type ClientFormValues,
  clientFormSchema,
} from "./client-form-fields";

export default function AddClientDialog() {
  const [open, setOpen] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const { user, activeCompany } = useAuth();
  const createClient = useCreateClient(activeCompany);
  const isSubmitting = createClient.isPending;

  const form = useForm<ClientFormValues>({
    defaultValues: {
      name: "",
      address: "",
      vatNo: "",
      contactNo: "",
    },
    resolver: zodResolver(clientFormSchema),
    mode: "onSubmit",
    reValidateMode: "onSubmit",
  });

  async function onSubmit(data: ClientFormValues) {
    if (!activeCompany || !user) return;

    try {
      await createClient.mutateAsync(data);
      form.reset();
      setOpen(false);
    } catch (error) {
      console.error("Failed to add client", error);
    }
  }

  function handleCancel() {
    if (isSubmitting) return;
    if (form.formState.isDirty) {
      setConfirmClose(true);
    } else {
      form.reset();
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
          <Button>
            <Plus />
            New client
          </Button>
        </DialogTrigger>
        <DialogContent className={ruledDialogContentClass}>
          <RuledDialogHeader
            eyebrow="( New client · Receivables )"
            lead="Register a"
            title="new client."
            description="Also opens a matching client account in the chart of accounts."
          />
          <form id="add-client-form" onSubmit={form.handleSubmit(onSubmit)}>
            <ClientFormSections form={form} />
          </form>
          <RuledDialogFooter
            summary={
              form.watch("name")?.trim()
                ? `Opens client and account “${form.watch("name").trim()}”`
                : "Name the client to continue"
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
              form="add-client-form"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Creating…" : "Create client"}
            </Button>
          </RuledDialogFooter>
        </DialogContent>

        <ConfirmationDialog
          open={confirmClose}
          onOpenChange={setConfirmClose}
          onConfirm={() => {
            form.reset();
            setConfirmClose(false);
            setOpen(false);
          }}
        />
      </Form>
    </Dialog>
  );
}
