"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { companyInputSchema } from "@stuttgart/shared/schemas/identity";
import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import type z from "zod";
import ConfirmationDialog from "@/components/custom/confirmation-dialog";
import {
  RuledDialogFooter,
  RuledDialogHeader,
  RuledDialogSection,
  ruledDialogContentClass,
} from "@/components/shared/ruled-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
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
import { createCompany, updateCompany } from "@/lib/data/identity";
import { invalidateCompaniesCache } from "./companies-cache";

/** Same rules the server checks (packages/shared). */
const formSchema = companyInputSchema;

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
      const companyName = data.name.trim();

      const input = {
        name: companyName,
        address: data.address.trim(),
        telephoneNo: data.telephoneNo.trim(),
        tin: data.tin.trim(),
      };
      if (mode === "create") await createCompany(user, input);
      else if (company) await updateCompany(user, company, input);
      invalidateCompaniesCache();
      await refreshProfile();

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

  const isCreate = mode === "create";
  const watchedName = form.watch("name")?.trim();

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        {!hideTrigger ? (
          <DialogTrigger asChild>
            <Button>
              <Plus />
              New company
            </Button>
          </DialogTrigger>
        ) : null}
        <DialogContent className={`${ruledDialogContentClass} sm:max-w-lg`}>
          <RuledDialogHeader
            eyebrow={
              isCreate
                ? "( Administration · New company )"
                : `( Administration · ${company?.name ?? "Company"} )`
            }
            lead={isCreate ? "Add a" : "Edit"}
            title={isCreate ? "company." : "company details."}
            description="These details print on every tax invoice as the supplier."
          />
          <Form {...form}>
            <form id="company-form" onSubmit={form.handleSubmit(onSubmit)}>
              <RuledDialogSection label="01 / Company">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>Company name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g. Stuttgart Logistics (Pvt) Ltd"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="tin"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>TIN</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Taxpayer identification number"
                          className="font-mono"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </RuledDialogSection>
              <RuledDialogSection label="02 / Contact">
                <FormField
                  control={form.control}
                  name="telephoneNo"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>Telephone no</FormLabel>
                      <FormControl>
                        <Input
                          type="tel"
                          placeholder="+94 11 234 5678"
                          className="font-mono"
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
                    <FormItem className="sm:col-span-2">
                      <FormLabel>Address</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Street, city, postal code"
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </RuledDialogSection>
            </form>
          </Form>
          <RuledDialogFooter
            summary={
              watchedName
                ? `${isCreate ? "Creates" : "Saves"} “${watchedName}”`
                : "Name the company to continue"
            }
          >
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" form="company-form" disabled={isSubmitting}>
              {isSubmitting
                ? "Saving…"
                : isCreate
                  ? "Create company"
                  : "Save changes"}
            </Button>
          </RuledDialogFooter>
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
