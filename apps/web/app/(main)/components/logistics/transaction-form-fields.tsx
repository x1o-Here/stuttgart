"use client";

import { ArrowRight, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { Controller, type UseFormReturn } from "react-hook-form";
import z from "zod";
import CalendarPopover from "@/components/shared/calendar-popover";
import { SectionLabel } from "@/components/shared/ruled-dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAccountsContext } from "@/contexts/useAccountsContext";
import { useLookupStore } from "@/stores/use-lookup-store";

export const transactionFormSchema = z.object({
  date: z.date(),
  description: z.string().min(1, "Description is required"),
  department: z.string().min(1, "Department is required"),
  vehicle: z.string().optional(),
  voucherNo: z.number().min(0, "Voucher number must be positive"),
  creditingAccount: z.string().min(1, "Crediting account is required"),
  debitingAccount: z.string().min(1, "Debiting account is required"),
  amount: z.number().min(0, "Amount must be positive"),
});

export type TransactionFormValues = z.infer<typeof transactionFormSchema>;

type TransactionFormProps = {
  form: UseFormReturn<TransactionFormValues>;
};

/** Mono footer summary, e.g. "LKR 48,250.00 · Cash → Fuel"; null until complete. */
export function useTransactionSummary({ form }: TransactionFormProps) {
  const { accounts } = useAccountsContext();
  const [amount, debitId, creditId] = form.watch([
    "amount",
    "debitingAccount",
    "creditingAccount",
  ]);
  const debitName = accounts.find((a) => a.id === debitId)?.name;
  const creditName = accounts.find((a) => a.id === creditId)?.name;
  if (!debitName || !creditName || !(amount > 0)) return null;

  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "LKR",
  }).format(amount);
  return `${formatted} · ${debitName} → ${creditName}`;
}

/** The three ruled sections shared by the add and edit transaction dialogs. */
export function TransactionFormSections({ form }: TransactionFormProps) {
  const { accounts } = useAccountsContext();
  const router = useRouter();
  const departments = useLookupStore((state) => state.departments);
  const vehicles = useLookupStore((state) => state.vehicles);

  return (
    <>
      <section className="grid gap-4 border-b px-6 py-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <SectionLabel>01 / Details</SectionLabel>
        </div>
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
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
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
                inputMode="numeric"
                className="font-mono tabular-nums"
                {...field}
                onChange={(e) => field.onChange(Number(e.target.value))}
                placeholder="0001"
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <Controller
          name="description"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid} className="sm:col-span-2">
              <FieldLabel htmlFor="description">Description</FieldLabel>
              <Textarea
                id="description"
                rows={2}
                {...field}
                placeholder="e.g. Diesel refill, Colombo depot"
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
      </section>

      <section className="grid gap-4 border-b px-6 py-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <SectionLabel>02 / Allocation</SectionLabel>
        </div>
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
                  <SelectValue placeholder="Select a department" />
                </SelectTrigger>
                <SelectContent position="popper" side="bottom">
                  {departments.map((department) => (
                    <SelectItem key={department.id} value={department.name}>
                      {department.name}
                    </SelectItem>
                  ))}
                  <SelectItem value="__new__">
                    <Plus className="mr-2 h-4 w-4" />
                    Create new department
                  </SelectItem>
                </SelectContent>
              </Select>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
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
                    router.push("/fleet");
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
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
      </section>

      <section className="flex flex-col gap-4 px-6 py-5">
        <SectionLabel>03 / Money flow</SectionLabel>
        <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto_1fr]">
          <Controller
            name="debitingAccount"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid} className="min-w-0">
                <FieldLabel htmlFor="debitingAccount">
                  From (debiting)
                </FieldLabel>
                <Select
                  name={field.name}
                  value={field.value}
                  onValueChange={field.onChange}
                >
                  <SelectTrigger
                    id="debitingAccount"
                    className="w-full"
                    aria-invalid={fieldState.invalid}
                  >
                    <SelectValue placeholder="Select an account" />
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
          <div
            aria-hidden="true"
            className="hidden size-9 items-center justify-center rounded-md border text-muted-foreground sm:flex"
          >
            <ArrowRight className="size-4" />
          </div>
          <Controller
            name="creditingAccount"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid} className="min-w-0">
                <FieldLabel htmlFor="creditingAccount">
                  To (crediting)
                </FieldLabel>
                <Select
                  name={field.name}
                  value={field.value}
                  onValueChange={field.onChange}
                >
                  <SelectTrigger
                    id="creditingAccount"
                    className="w-full"
                    aria-invalid={fieldState.invalid}
                  >
                    <SelectValue placeholder="Select an account" />
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
        </div>

        <Controller
          name="amount"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="amount">Amount</FieldLabel>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center font-mono text-xs text-muted-foreground">
                  LKR
                </span>
                <Input
                  id="amount"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  className="h-12 pl-12 font-mono text-2xl font-light tabular-nums md:text-2xl"
                  {...field}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                  placeholder="0.00"
                />
              </div>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
      </section>
    </>
  );
}
