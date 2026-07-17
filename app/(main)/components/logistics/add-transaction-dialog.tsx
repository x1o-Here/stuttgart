"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  collection,
  doc,
  increment,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import z from "zod";
import CalendarPopover from "@/components/shared/calendar-popover";
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
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/auth-context";
import { useAccountsContext } from "@/contexts/useAccountsContext";
import { appendAuditLog } from "@/lib/firebase/audit-log";
import { db } from "@/lib/firebase/firebase-client";
import { useLookupStore } from "@/stores/use-lookup-store";

const formSchema = z.object({
  date: z.date(),
  description: z.string().min(1, "Description is required"),
  department: z.string().min(1, "Department is required"),
  vehicle: z.string().optional(),
  voucherNo: z.number().min(0, "Voucher number must be positive"),
  creditingAccount: z.string().min(1, "Crediting Account is required"),
  debitingAccount: z.string().min(1, "Debitng Account is required"),
  amount: z.number().min(0, "Amount must be positive"),
});

type FormOutput = z.infer<typeof formSchema>;

export function AddTransactionDialog() {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { accounts } = useAccountsContext();
  const { user, activeCompany } = useAuth();
  const router = useRouter();

  const departments = useLookupStore((state) => state.departments);
  const vehicles = useLookupStore((state) => state.vehicles);

  const form = useForm<FormOutput>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date: new Date(),
      description: "",
      creditingAccount: "",
      debitingAccount: "",
      amount: 0,
      department: "",
      voucherNo: 0,
      vehicle: "",
    },
    mode: "onSubmit",
    reValidateMode: "onSubmit",
  });

  async function onSubmit(data: FormOutput) {
    try {
      setIsSubmitting(true);
      const batch = writeBatch(db);

      // Transactions
      const transactionId = doc(collection(db, "transactions")).id;

      const creditTransactionRef = doc(
        db,
        "companies",
        activeCompany,
        "accounts",
        data.creditingAccount,
        "transactions",
        transactionId,
      );

      batch.set(creditTransactionRef, {
        date: data.date,
        amount: data.amount,
        type: "credit",
        department: data.department,
        vehicle: data.vehicle,
        voucherNo: data.voucherNo,
        description: data.description,
        createdAt: serverTimestamp(),
      });

      const debitTransactionRef = doc(
        db,
        "companies",
        activeCompany,
        "accounts",
        data.debitingAccount,
        "transactions",
        transactionId,
      );

      batch.set(debitTransactionRef, {
        date: data.date,
        amount: data.amount,
        type: "debit",
        department: data.department,
        vehicle: data.vehicle,
        voucherNo: data.voucherNo,
        description: data.description,
        createdAt: serverTimestamp(),
      });

      // Accounts
      const creditAccountRef = doc(
        db,
        "companies",
        activeCompany,
        "accounts",
        data.creditingAccount,
      );
      batch.update(creditAccountRef, {
        balance: increment(data.amount),
      });

      const debitAccountRef = doc(
        db,
        "companies",
        activeCompany,
        "accounts",
        data.debitingAccount,
      );
      batch.update(debitAccountRef, {
        balance: increment(-data.amount),
      });

      // Audit Log
      appendAuditLog(batch, {
        userId: user?.uid,
        transactionId: transactionId,
        action: "create",
        description: `Transaction added`,
        companyId: activeCompany,
        entityStatus: true,
      });

      await batch.commit();

      form.reset();
      setOpen(false);
    } catch (err) {
      console.error("Transaction failed:", err);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleCancel() {
    if (isSubmitting) return;
    form.reset();
    setOpen(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (isSubmitting) return;
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Transaction
        </Button>
      </DialogTrigger>

      <DialogContent className="min-w-2xl">
        <DialogHeader className="pb-4">
          <DialogTitle>Add a New Transaction</DialogTitle>
        </DialogHeader>
        <form id="add-transaction-form" onSubmit={form.handleSubmit(onSubmit)}>
          <FieldGroup>
            <div className="grid grid-cols-2 gap-x-6 gap-y-6">
              <Controller
                name="date"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="date">Date</FieldLabel>
                    <CalendarPopover
                      value={field.value}
                      onChange={(date) => {
                        if (date) field.onChange(date);
                      }}
                    />
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />

              <Controller
                name="amount"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="amount">Amount</FieldLabel>
                    <Input
                      id="amount"
                      type="number"
                      {...field}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                      placeholder="Amount"
                    />
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />

              <Controller
                name="department"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="department">Department</FieldLabel>
                    <Select
                      onValueChange={(value) => {
                        if (value === "__new__") {
                          router.push("/settings/departments");
                          return;
                        }

                        field.onChange(value);
                      }}
                      defaultValue={field.value}
                      value={field.value}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select an department" />
                      </SelectTrigger>
                      <SelectContent position="popper" side="bottom">
                        {departments.map((department) => (
                          <SelectItem
                            key={department.id}
                            value={department.name}
                          >
                            {department.name}
                          </SelectItem>
                        ))}
                        <SelectItem value="__new__">
                          <Plus className="mr-2 h-4 w-4" />
                          Create new department
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />

              <Controller
                name="vehicle"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="vehicle">Vehicle</FieldLabel>
                    <Select
                      onValueChange={(value) => {
                        if (value === "__new__") {
                          router.push("/settings/vehicles");
                          return;
                        }

                        field.onChange(value === "__none__" ? "" : value);
                      }}
                      defaultValue={field.value}
                      value={field.value || undefined}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a vehicle" />
                      </SelectTrigger>
                      <SelectContent position="popper" side="bottom">
                        <SelectItem value="__none__">No vehicle</SelectItem>
                        {vehicles.map((vehicle) => (
                          <SelectItem key={vehicle.id} value={vehicle.name}>
                            {vehicle.name}
                          </SelectItem>
                        ))}
                        <SelectItem value="__new__">
                          <Plus className="mr-2 h-4 w-4" />
                          Create new vehicle
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />

              <Controller
                name="voucherNo"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="voucherNo">Voucher No</FieldLabel>
                    <Input
                      id="voucherNo"
                      type="number"
                      {...field}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                      placeholder="Voucher No"
                    />
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />

              <Separator className="col-span-2" />

              <Controller
                name="debitingAccount"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field
                    className="col-start-1"
                    data-invalid={fieldState.invalid}
                  >
                    <FieldLabel htmlFor="debitingAccount">
                      Debitng Account
                    </FieldLabel>
                    <Select
                      name={field.name}
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <SelectTrigger
                        id="debitingAccount"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        aria-invalid={fieldState.invalid}
                      >
                        <SelectValue placeholder="Select an option" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />

              <Controller
                name="creditingAccount"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="creditingAccount">
                      Crediting Account
                    </FieldLabel>
                    <Select
                      name={field.name}
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <SelectTrigger
                        id="creditingAccount"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        aria-invalid={fieldState.invalid}
                      >
                        <SelectValue placeholder="Select an option" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />

              <Controller
                name="description"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field
                    data-invalid={fieldState.invalid}
                    className="col-span-2"
                  >
                    <FieldLabel htmlFor="description">Description</FieldLabel>
                    <Textarea
                      id="description"
                      {...field}
                      placeholder="Description"
                    />
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />
            </div>
          </FieldGroup>
        </form>
        <DialogFooter className="mt-4">
          <Button
            type="submit"
            form="add-transaction-form"
            disabled={isSubmitting}
          >
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
      </DialogContent>
    </Dialog>
  );
}
