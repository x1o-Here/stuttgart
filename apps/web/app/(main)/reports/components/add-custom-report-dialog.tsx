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
import CalendarPopover from "@/components/shared/calendar-popover";
import {
  RuledDialogFooter,
  RuledDialogHeader,
  RuledDialogSection,
  ruledDialogContentClass,
} from "@/components/shared/ruled-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { useAccountsContext } from "@/contexts/useAccountsContext";
import { appendAuditLog } from "@/lib/firebase/audit-log";
import { db } from "@/lib/firebase/firebase-client";

const formSchema = z
  .object({
    name: z.string().min(1, "Report name is required"),
    description: z.string().optional(),
    fromDate: z.date({ error: "From date is required" }),
    toDate: z.date({ error: "To date is required" }),
    accountIds: z.array(z.string()).min(1, "Select at least one account"),
  })
  .refine((data) => data.toDate >= data.fromDate, {
    message: "To date must be on or after from date",
    path: ["toDate"],
  });

type FormOutput = z.infer<typeof formSchema>;

const defaultValues: FormOutput = {
  name: "",
  description: "",
  fromDate: new Date(),
  toDate: new Date(),
  accountIds: [],
};

export default function AddCustomReportDialog() {
  const [open, setOpen] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user, activeCompany } = useAuth();
  const { accounts } = useAccountsContext();

  const form = useForm<FormOutput>({
    defaultValues,
    resolver: zodResolver(formSchema),
    mode: "onSubmit",
    reValidateMode: "onSubmit",
  });

  const selectedAccountIds = form.watch("accountIds");
  const allSelected =
    accounts.length > 0 && selectedAccountIds.length === accounts.length;

  function toggleAllAccounts(checked: boolean) {
    form.setValue(
      "accountIds",
      checked ? accounts.map((account) => account.id) : [],
      { shouldDirty: true, shouldValidate: true },
    );
  }

  async function onSubmit(data: FormOutput) {
    if (!activeCompany || !user || isSubmitting) return;

    try {
      setIsSubmitting(true);
      const batch = writeBatch(db);

      const reportRef = doc(
        collection(db, "companies", activeCompany, "reports"),
      );
      batch.set(reportRef, {
        name: data.name.trim(),
        description: data.description?.trim() || "",
        fromDate: data.fromDate,
        toDate: data.toDate,
        accountIds: data.accountIds,
        createdBy: user.uid,
        entityStatus: true,
        createdAt: serverTimestamp(),
      });
      appendAuditLog(batch, {
        userId: user.uid,
        action: "create",
        description: `Custom report created: ${data.name.trim()}`,
        companyId: activeCompany,
        entityStatus: true,
      });

      await batch.commit();

      form.reset(defaultValues);
      setOpen(false);
    } catch (error) {
      console.error("Failed to add custom report", error);
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

  const selectedCount = form.watch("accountIds")?.length ?? 0;

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
          <Button size="sm" variant="outline">
            <Plus />
            New report
          </Button>
        </DialogTrigger>
        <DialogContent className={ruledDialogContentClass}>
          <RuledDialogHeader
            eyebrow="( Reports · Custom )"
            lead="Build a"
            title="custom report."
            description="Saves a date range and a set of accounts you can reopen, share and export."
          />
          <form id="add-report-form" onSubmit={form.handleSubmit(onSubmit)}>
            <RuledDialogSection label="01 / Details">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Report name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. Q1 Logistics Summary"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={2}
                        placeholder="Optional notes about this report"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </RuledDialogSection>

            <RuledDialogSection label="02 / Period">
              <FormField
                control={form.control}
                name="fromDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>From</FormLabel>
                    <FormControl>
                      <CalendarPopover
                        value={field.value}
                        onChange={(date) => {
                          if (date) field.onChange(date);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="toDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>To</FormLabel>
                    <FormControl>
                      <CalendarPopover
                        value={field.value}
                        onChange={(date) => {
                          if (date) field.onChange(date);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </RuledDialogSection>

            <RuledDialogSection label="03 / Accounts">
              <FormField
                control={form.control}
                name="accountIds"
                render={() => (
                  <FormItem className="sm:col-span-2">
                    <div className="flex items-center justify-between gap-3">
                      <FormLabel>Accounts included</FormLabel>
                      <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                        <Checkbox
                          checked={allSelected}
                          onCheckedChange={(checked) =>
                            toggleAllAccounts(checked === true)
                          }
                        />
                        Select all
                      </label>
                    </div>

                    <div className="mt-2 max-h-48 divide-y overflow-y-auto rounded-md border">
                      {accounts.length === 0 ? (
                        <p className="px-3 py-4 text-center text-sm text-muted-foreground">
                          No accounts available
                        </p>
                      ) : (
                        accounts.map((account) => (
                          <FormField
                            key={account.id}
                            control={form.control}
                            name="accountIds"
                            render={({ field }) => {
                              const checked = field.value.includes(account.id);
                              return (
                                <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-surface-muted">
                                  <Checkbox
                                    checked={checked}
                                    onCheckedChange={(isChecked) => {
                                      field.onChange(
                                        isChecked
                                          ? [...field.value, account.id]
                                          : field.value.filter(
                                              (id) => id !== account.id,
                                            ),
                                      );
                                    }}
                                  />
                                  <span className="text-sm text-foreground">
                                    {account.name}
                                  </span>
                                </label>
                              );
                            }}
                          />
                        ))
                      )}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </RuledDialogSection>
          </form>
          <RuledDialogFooter
            summary={`${selectedCount} of ${accounts.length} accounts selected`}
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
              form="add-report-form"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Creating…" : "Create report"}
            </Button>
          </RuledDialogFooter>
        </DialogContent>
      </Form>

      <ConfirmationDialog
        open={confirmClose}
        onOpenChange={setConfirmClose}
        onConfirm={() => {
          form.reset(defaultValues);
          setConfirmClose(false);
          setOpen(false);
        }}
      />
    </Dialog>
  );
}
