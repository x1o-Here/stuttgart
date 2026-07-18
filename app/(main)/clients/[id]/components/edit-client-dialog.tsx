"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  collection,
  doc,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { Pencil } from "lucide-react";
import { useEffect, useState } from "react";
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
import { db } from "@/lib/firebase/firebase-client";

const formSchema = z.object({
  name: z.string().min(1, "Customer name is required"),
  address: z.string().min(1, "Address is required"),
  vatNo: z.string().min(1, "VAT number is required"),
  contactNo: z.string().min(1, "Contact number is required"),
});

type FormOutput = z.infer<typeof formSchema>;

type EditClientDialogProps = {
  clientId: string;
  defaultValues: FormOutput;
};

export default function EditClientDialog({
  clientId,
  defaultValues,
}: EditClientDialogProps) {
  const [open, setOpen] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user, activeCompany } = useAuth();

  const form = useForm<FormOutput>({
    defaultValues,
    resolver: zodResolver(formSchema),
    mode: "onSubmit",
    reValidateMode: "onSubmit",
  });

  useEffect(() => {
    if (open) {
      form.reset(defaultValues);
    }
  }, [open, defaultValues, form]);

  async function onSubmit(data: FormOutput) {
    if (!activeCompany || !user) return;

    try {
      setIsSubmitting(true);
      const batch = writeBatch(db);

      const clientRef = doc(
        db,
        "companies",
        activeCompany,
        "clients",
        clientId,
      );
      batch.update(clientRef, {
        name: data.name,
        address: data.address,
        vatNo: data.vatNo,
        contactNo: data.contactNo,
        updatedAt: serverTimestamp(),
      });

      const auditLogRef = doc(collection(db, "auditLogs"));
      batch.set(auditLogRef, {
        userId: user.uid,
        action: "update",
        description: `Client updated: ${data.name}`,
        companyId: activeCompany,
        entityStatus: true,
        createdAt: serverTimestamp(),
      });

      await batch.commit();
      form.reset(data);
      setOpen(false);
    } catch (error) {
      console.error("Failed to update client", error);
    } finally {
      setIsSubmitting(false);
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
    <Dialog open={open} onOpenChange={setOpen}>
      <Form {...form}>
        <DialogTrigger asChild>
          <Button variant="outline">
            <Pencil className="mr-2 h-4 w-4" />
            Edit Details
          </Button>
        </DialogTrigger>
        <DialogContent className="min-w-xl">
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <DialogHeader className="pb-4">
              <DialogTitle>Edit Client Details</DialogTitle>
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
                {isSubmitting ? "Saving..." : "Save Changes"}
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
            form.reset(defaultValues);
            setConfirmClose(false);
            setOpen(false);
          }}
        />
      </Form>
    </Dialog>
  );
}
