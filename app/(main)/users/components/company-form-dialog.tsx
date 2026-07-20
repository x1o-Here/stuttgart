"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  arrayUnion,
  collection,
  doc,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { Plus } from "lucide-react";
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
import type { CompanyRecord } from "@/lib/companies/types";
import { db } from "@/lib/firebase/firebase-client";
import { invalidateCompaniesCache } from "./companies-cache";

const formSchema = z.object({
  name: z.string().min(1, "Company name is required"),
  address: z.string().min(1, "Address is required"),
  telephoneNo: z.string().min(1, "Telephone number is required"),
  tin: z.string().min(1, "TIN is required"),
});

type FormOutput = z.infer<typeof formSchema>;

type CompanyFormDialogProps = {
  mode: "create" | "edit";
  company?: CompanyRecord;
  onSaved?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
};

export default function CompanyFormDialog({
  mode,
  company,
  onSaved,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  hideTrigger = false,
}: CompanyFormDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = controlledOnOpenChange ?? setUncontrolledOpen;
  const [confirmClose, setConfirmClose] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user, refreshProfile } = useAuth();

  const form = useForm<FormOutput>({
    defaultValues: {
      name: "",
      address: "",
      telephoneNo: "",
      tin: "",
    },
    resolver: zodResolver(formSchema),
    mode: "onSubmit",
    reValidateMode: "onSubmit",
  });

  useEffect(() => {
    if (!open) return;
    form.reset(
      mode === "edit" && company
        ? {
            name: company.name,
            address: company.address,
            telephoneNo: company.telephoneNo,
            tin: company.tin,
          }
        : {
            name: "",
            address: "",
            telephoneNo: "",
            tin: "",
          },
    );
  }, [open, mode, company, form]);

  async function onSubmit(data: FormOutput) {
    if (!user) return;

    try {
      setIsSubmitting(true);
      const batch = writeBatch(db);
      const companyName = data.name.trim();

      if (mode === "create") {
        const companyRef = doc(collection(db, "companies"));
        batch.set(companyRef, {
          name: companyName,
          address: data.address.trim(),
          telephoneNo: data.telephoneNo.trim(),
          tin: data.tin.trim(),
          entityStatus: true,
          createdAt: serverTimestamp(),
          createdBy: user.uid,
        });

        const userRef = doc(db, "users", user.uid);
        batch.update(userRef, {
          companies: arrayUnion(companyRef.id),
        });

        const auditLogRef = doc(collection(db, "auditLogs"));
        batch.set(auditLogRef, {
          userId: user.uid,
          action: "create",
          description: `Company created: ${companyName}`,
          companyId: companyRef.id,
          entityStatus: true,
          createdAt: serverTimestamp(),
        });

        await batch.commit();
        invalidateCompaniesCache();
        await refreshProfile();
      } else if (company) {
        const companyRef = doc(db, "companies", company.id);
        batch.update(companyRef, {
          name: companyName,
          address: data.address.trim(),
          telephoneNo: data.telephoneNo.trim(),
          tin: data.tin.trim(),
          updatedAt: serverTimestamp(),
          updatedBy: user.uid,
        });

        const auditLogRef = doc(collection(db, "auditLogs"));
        batch.set(auditLogRef, {
          userId: user.uid,
          action: "update",
          description: `Company updated: ${companyName}`,
          companyId: company.id,
          entityStatus: true,
          createdAt: serverTimestamp(),
        });

        await batch.commit();
        invalidateCompaniesCache();
        await refreshProfile();
      }

      form.reset();
      setOpen(false);
      onSaved?.();
    } catch (error) {
      console.error("Failed to save company", error);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && form.formState.isDirty) {
      setConfirmClose(true);
      return;
    }
    setOpen(nextOpen);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        {!hideTrigger ? (
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Company
            </Button>
          </DialogTrigger>
        ) : null}
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {mode === "create" ? "Add Company" : "Edit Company"}
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company name</FormLabel>
                    <FormControl>
                      <Input placeholder="Company name" {...field} />
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
                      <Textarea placeholder="Address" rows={3} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="telephoneNo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telephone no</FormLabel>
                    <FormControl>
                      <Input placeholder="Telephone number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="tin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>TIN</FormLabel>
                    <FormControl>
                      <Input placeholder="TIN" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleOpenChange(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting
                    ? "Saving..."
                    : mode === "create"
                      ? "Create"
                      : "Save"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <ConfirmationDialog
        open={confirmClose}
        onOpenChange={setConfirmClose}
        onConfirm={() => {
          form.reset();
          setConfirmClose(false);
          setOpen(false);
        }}
      />
    </>
  );
}
