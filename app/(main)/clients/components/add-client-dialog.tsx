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
import z from "zod";
import ConfirmationDialog from "@/components/custom/confirmation-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/auth-context";
import {
  CLIENT_ACCOUNT_TYPE_NAME,
  CLIENT_ACCOUNT_TYPE_SHORT_FORM,
  isClientAccountTypeName,
} from "@/lib/constants/client-account";
import { db } from "@/lib/firebase/firebase-client";
import { useLookupStore } from "@/stores/use-lookup-store";

const formSchema = z.object({
  name: z.string().min(1, "Customer name is required"),
  address: z.string().min(1, "Address is required"),
  vatNo: z.string().min(1, "VAT number is required"),
  contactNo: z.string().min(1, "Contact number is required"),
});

type FormOutput = z.infer<typeof formSchema>;

export default function AddClientDialog() {
  const [open, setOpen] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user, activeCompany } = useAuth();
  const accountTypes = useLookupStore((state) => state.accountTypes);

  const form = useForm<FormOutput>({
    defaultValues: {
      name: "",
      address: "",
      vatNo: "",
      contactNo: "",
    },
    resolver: zodResolver(formSchema),
    mode: "onSubmit",
    reValidateMode: "onSubmit",
  });

  async function onSubmit(data: FormOutput) {
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
    <Dialog open={open} onOpenChange={setOpen}>
      <Form {...form}>
        <DialogTrigger asChild>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Client
          </Button>
        </DialogTrigger>
        <DialogContent className="min-w-xl">
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <DialogHeader className="pb-4">
              <DialogTitle>Add a New Client</DialogTitle>
            </DialogHeader>
            <div className="max-h-lg overflow-y-auto flex flex-col gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer&apos;s Name</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder="Acme Ltd"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Street, city, postal code"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md min-h-24"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="vatNo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>VAT No</FormLabel>
                      <FormControl>
                        <Input
                          type="text"
                          placeholder="VAT123456789"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="contactNo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact No</FormLabel>
                      <FormControl>
                        <Input
                          type="tel"
                          placeholder="+94 77 123 4567"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "Submit"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
            </DialogFooter>
          </form>
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
