"use client";

import { zodResolver } from "@hookform/resolvers/zod";
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
import { createSupplier } from "@/lib/data/ledger";
import { useLookupStore } from "@/stores/use-lookup-store";
import {
  EMPTY_SUPPLIER,
  SupplierFormSections,
  type SupplierFormValues,
  supplierFormSchema,
} from "./supplier-form-fields";

export default function AddSupplierDialog() {
  const [open, setOpen] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user, activeCompany } = useAuth();
  const _accountTypes = useLookupStore((s) => s.accountTypes);

  const form = useForm<SupplierFormValues>({
    defaultValues: EMPTY_SUPPLIER,
    resolver: zodResolver(supplierFormSchema),
  });

  async function onSubmit(data: SupplierFormValues) {
    if (!activeCompany || !user) return;
    setSaving(true);
    setError(null);
    try {
      await createSupplier({ activeCompany, data, user });
      form.reset(EMPTY_SUPPLIER);
      setOpen(false);
    } catch (err) {
      console.error("Failed to add supplier", err);
      setError("Couldn’t create the supplier. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    if (saving) return;
    if (form.formState.isDirty) {
      setConfirmClose(true);
    } else {
      form.reset(EMPTY_SUPPLIER);
      setOpen(false);
    }
  }

  const watchedName = form.watch("name")?.trim();

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setOpen(true);
          setError(null);
          return;
        }
        handleCancel();
      }}
    >
      <Form {...form}>
        <DialogTrigger asChild>
          <Button>
            <Plus />
            New supplier
          </Button>
        </DialogTrigger>
        <DialogContent className={ruledDialogContentClass}>
          <RuledDialogHeader
            eyebrow="( New supplier · Payables )"
            lead="Register a"
            title="new supplier."
            description="Also opens a matching supplier account in the chart of accounts."
          />
          <form id="add-supplier-form" onSubmit={form.handleSubmit(onSubmit)}>
            <SupplierFormSections form={form} />
          </form>
          <RuledDialogFooter
            summary={
              error ? (
                <span className="text-destructive">{error}</span>
              ) : watchedName ? (
                `Opens supplier and account “${watchedName}”`
              ) : (
                "Name the supplier to continue"
              )
            }
          >
            <Button
              type="button"
              variant="ghost"
              onClick={handleCancel}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" form="add-supplier-form" disabled={saving}>
              {saving ? "Creating…" : "Create supplier"}
            </Button>
          </RuledDialogFooter>
        </DialogContent>

        <ConfirmationDialog
          open={confirmClose}
          onOpenChange={setConfirmClose}
          onConfirm={() => {
            form.reset(EMPTY_SUPPLIER);
            setConfirmClose(false);
            setOpen(false);
          }}
        />
      </Form>
    </Dialog>
  );
}
