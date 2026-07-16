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
import { Checkbox } from "@/components/ui/checkbox";
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
import { useAccountsContext } from "@/contexts/useAccountsContext";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase/firebase-client";
import CalendarPopover from "../../vehicle/[id]/components/calendar-popover";

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
    if (!activeCompany || !user) return;

    try {
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
        updatedAt: serverTimestamp(),
      });

      const auditLogRef = doc(collection(db, "auditLogs"));
      batch.set(auditLogRef, {
        userId: user.uid,
        action: "create",
        description: `Custom report created: ${data.name.trim()}`,
        companyId: activeCompany,
        entityStatus: true,
        createdAt: serverTimestamp(),
      });

      await batch.commit();

      form.reset(defaultValues);
      setOpen(false);
    } catch (error) {
      console.error("Failed to add custom report", error);
    }
  }

  function handleCancel() {
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
          <Button size="sm">
            <Plus className="mr-1.5 h-4 w-4" />
            Add
          </Button>
        </DialogTrigger>
        <DialogContent className="min-w-2xl max-h-[90vh] overflow-y-auto">
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <DialogHeader>
              <DialogTitle>Add Custom Report</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Report name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Q1 Logistics Summary" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Optional notes about this report"
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
              </div>

              <FormField
                control={form.control}
                name="accountIds"
                render={() => (
                  <FormItem>
                    <div className="flex items-center justify-between gap-3">
                      <FormLabel>Accounts included</FormLabel>
                      <label className="flex items-center gap-2 text-sm text-zinc-600 cursor-pointer">
                        <Checkbox
                          checked={allSelected}
                          onCheckedChange={(checked) =>
                            toggleAllAccounts(checked === true)
                          }
                        />
                        Select all
                      </label>
                    </div>

                    <div className="mt-2 max-h-48 overflow-y-auto rounded-md border border-zinc-200 divide-y divide-zinc-100">
                      {accounts.length === 0 ? (
                        <p className="px-3 py-4 text-sm text-zinc-500 text-center">
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
                                <label className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-zinc-50">
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
                                  <span className="text-sm text-zinc-700">
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
            </div>

            <DialogFooter>
              <Button type="submit">Create Report</Button>
              <Button type="button" variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
            </DialogFooter>
          </form>
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
