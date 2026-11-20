"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  type EmployeeInput,
  employeeInputSchema,
} from "@stuttgart/shared/schemas/employees";
import { Pencil, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import {
  RuledDialogFooter,
  RuledDialogHeader,
  RuledDialogSection,
  ruledDialogContentClass,
} from "@/components/shared/ruled-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
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
import { useAuth } from "@/contexts/auth-context";
import { ApiError } from "@/lib/api-client";
import {
  createEmployee,
  type Employee,
  updateEmployee,
} from "@/lib/data/employees";

/** Add an employee, or (with `employee`) edit their number, name and role. */
export function EmployeeDialog({ employee }: { employee?: Employee }) {
  const isEdit = !!employee;
  const { activeCompany } = useAuth();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formId = isEdit ? `employee-form-${employee.id}` : "employee-form-new";

  const form = useForm<EmployeeInput>({
    resolver: zodResolver(employeeInputSchema),
    defaultValues: { employeeNo: "", name: "", role: "" },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        employeeNo: employee?.employeeNo ?? "",
        name: employee?.name ?? "",
        role: employee?.role ?? "",
      });
      setError(null);
    }
  }, [open, employee, form]);

  async function onSubmit(data: EmployeeInput) {
    if (!activeCompany) return;
    setSaving(true);
    setError(null);
    try {
      if (isEdit) {
        await updateEmployee(activeCompany, employee.id, data);
      } else {
        await createEmployee(activeCompany, data);
      }
      setOpen(false);
    } catch (err) {
      console.error("Failed to save employee", err);
      setError(
        err instanceof ApiError
          ? err.message
          : "Couldn’t save the employee. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  const name = form.watch("name")?.trim();

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!saving) setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        {isEdit ? (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Edit ${employee.name}`}
            className="text-muted-foreground hover:text-foreground"
          >
            <Pencil />
          </Button>
        ) : (
          <Button>
            <Plus />
            Add employee
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className={`${ruledDialogContentClass} sm:max-w-lg`}>
        <RuledDialogHeader
          eyebrow={
            isEdit
              ? `( Employees · ${employee.employeeNo} )`
              : "( Employees · New employee )"
          }
          lead={isEdit ? "Edit" : "Add an"}
          title="employee."
          description={
            isEdit
              ? "Renaming the employee also renames their EMP_ account."
              : "Also opens an EMP_ account for them, and the company’s EPF and ETF accounts if they don’t exist yet."
          }
        />
        <Form {...form}>
          <form id={formId} onSubmit={form.handleSubmit(onSubmit)}>
            <RuledDialogSection label="01 / Employee">
              <FormField
                control={form.control}
                name="employeeNo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Employee number</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="E001"
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
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <FormControl>
                      <Input placeholder="Driver" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Nimal Perera" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {error && (
                <p className="rounded-md bg-danger-soft px-3 py-2 text-sm text-destructive sm:col-span-2">
                  {error}
                </p>
              )}
            </RuledDialogSection>
          </form>
        </Form>
        <RuledDialogFooter
          summary={
            name
              ? isEdit
                ? `Saves ${name}`
                : `Opens account “EMP_${name}”`
              : "Name the employee to continue"
          }
        >
          <DialogClose asChild>
            <Button type="button" variant="ghost" disabled={saving}>
              Cancel
            </Button>
          </DialogClose>
          <Button type="submit" form={formId} disabled={saving}>
            {saving ? "Saving…" : isEdit ? "Save changes" : "Add employee"}
          </Button>
        </RuledDialogFooter>
      </DialogContent>
    </Dialog>
  );
}
