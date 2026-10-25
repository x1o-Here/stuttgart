"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  collection,
  doc,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
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
import {
  CLIENT_ACCOUNT_TYPE_NAME,
  CLIENT_ACCOUNT_TYPE_SHORT_FORM,
  isClientAccountTypeName,
} from "@/lib/constants/client-account";
import { db } from "@/lib/firebase/firebase-client";
import { useLookupStore } from "@/stores/use-lookup-store";
import {
  ClientFormSections,
  type ClientFormValues,
  clientFormSchema,
} from "./client-form-fields";

export default function AddClientDialog() {
  const [open, setOpen] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user, activeCompany } = useAuth();
  const accountTypes = useLookupStore((state) => state.accountTypes);

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
      setIsSubmitting(true);
      const batch = writeBatch(db);
      const clientName = data.name.trim();

      const clientRef = doc(
        collection(db, "companies", activeCompany, "clients"),
      );
      batch.set(clientRef, {
        name: clientName,
        address: data.address,
        vatNo: data.vatNo,
        contactNo: data.contactNo,
        status: "active",
        entityStatus: true,
        createdAt: serverTimestamp(),
      });

      const existingClientType = accountTypes.find((type) =>
        isClientAccountTypeName(type.name),
      );
      if (!existingClientType) {
        const clientTypeRef = doc(
          collection(db, "lookup-lists", activeCompany, "account-types"),
        );
        batch.set(clientTypeRef, {
          name: CLIENT_ACCOUNT_TYPE_NAME,
          shortForm: CLIENT_ACCOUNT_TYPE_SHORT_FORM,
          isSystem: true,
          entityStatus: true,
          createdAt: serverTimestamp(),
        });
      } else if (!existingClientType.isSystem) {
        batch.update(
          doc(
            db,
            "lookup-lists",
            activeCompany,
            "account-types",
            existingClientType.id,
          ),
          {
            isSystem: true,
            updatedAt: serverTimestamp(),
          },
        );
      }

      const accountRef = doc(
        collection(db, "companies", activeCompany, "accounts"),
      );
      batch.set(accountRef, {
        name: clientName,
        accountType: CLIENT_ACCOUNT_TYPE_NAME,
        initialBalance: 0,
        balance: 0,
        clientId: clientRef.id,
        entityStatus: true,
        createdAt: serverTimestamp(),
      });

      const auditLogRef = doc(collection(db, "auditLogs"));
      batch.set(auditLogRef, {
        userId: user.uid,
        action: "create",
        description: `Client created: ${clientName}`,
        companyId: activeCompany,
        entityStatus: true,
        createdAt: serverTimestamp(),
      });

      const accountAuditRef = doc(collection(db, "auditLogs"));
      batch.set(accountAuditRef, {
        userId: user.uid,
        action: "create",
        description: `Client account created: ${clientName}`,
        companyId: activeCompany,
        entityStatus: true,
        createdAt: serverTimestamp(),
      });

      await batch.commit();

      form.reset();
      setOpen(false);
    } catch (error) {
      console.error("Failed to add client", error);
    } finally {
      setIsSubmitting(false);
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
