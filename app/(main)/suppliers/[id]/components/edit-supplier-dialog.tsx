"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import { Pencil } from "lucide-react";
import { useEffect, useState } from "react";
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
import { appendAuditLog } from "@/lib/firebase/audit-log";
import { db } from "@/lib/firebase/firebase-client";
import type { Supplier } from "@/lib/suppliers/supplier-model";
import {
  SupplierFormSections,
  type SupplierFormValues,
  supplierFormSchema,
} from "../../components/supplier-form-fields";

export default function EditSupplierDialog({
  supplier,
}: {
  supplier: Supplier;
}) {
  const [open, setOpen] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user, activeCompany } = useAuth();

  const defaults: SupplierFormValues = {
    name: supplier.name,
    tin: supplier.tin,
    address: supplier.address,
    supplierType: supplier.supplierType,
    contactNo: supplier.contactNo,
  };

  const form = useForm<SupplierFormValues>({
    defaultValues: defaults,
    resolver: zodResolver(supplierFormSchema),
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset only when opened
  useEffect(() => {
    if (open) {
      form.reset(defaults);
      setError(null);
    }
  }, [open]);

  async function onSubmit(data: SupplierFormValues) {
    if (!activeCompany || !user) return;
    setSaving(true);
    setError(null);
    try {
      const batch = writeBatch(db);
      const name = data.name.trim();
      batch.update(
        doc(db, "companies", activeCompany, "suppliers", supplier.id),
        {
          name,
          tin: data.tin.trim(),
          address: data.address.trim(),
          supplierType: data.supplierType,
          contactNo: data.contactNo.trim(),
          updatedAt: serverTimestamp(),
        },
      );
      if (name !== supplier.name.trim()) {
        const accounts = await getDocs(
          query(
            collection(db, "companies", activeCompany, "accounts"),
            where("supplierId", "==", supplier.id),
          ),
        );
        for (const account of accounts.docs) {
          batch.update(account.ref, { name, updatedAt: serverTimestamp() });
        }
      }
      appendAuditLog(batch, {
        userId: user.uid,
        companyId: activeCompany,
        action: "update",
        description: `Supplier updated: ${name}`,
      });
      await batch.commit();
      form.reset(data);
      setOpen(false);
    } catch (err) {
      console.error("Failed to update supplier", err);
      setError("Couldn’t save the supplier. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    if (saving) return;
    if (form.formState.isDirty) {
      setConfirmClose(true);
    } else {
      setOpen(false);
    }
  }

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
          <Button variant="outline">
            <Pencil />
            Edit details
          </Button>
        </DialogTrigger>
        <DialogContent className={ruledDialogContentClass}>
          <RuledDialogHeader
            eyebrow={`( Supplier record · ${supplier.name} )`}
            lead="Edit"
            title="supplier details."
            description="Renaming the supplier also renames its linked account."
          />
          <form id="edit-supplier-form" onSubmit={form.handleSubmit(onSubmit)}>
            <SupplierFormSections form={form} />
          </form>
          <RuledDialogFooter
            summary={
              error ? (
                <span className="text-destructive">{error}</span>
              ) : form.formState.isDirty ? (
                "Unsaved changes"
              ) : (
                "No changes yet"
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
            <Button type="submit" form="edit-supplier-form" disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </RuledDialogFooter>
        </DialogContent>

        <ConfirmationDialog
          open={confirmClose}
          onOpenChange={setConfirmClose}
          onConfirm={() => {
            form.reset(defaults);
            setConfirmClose(false);
            setOpen(false);
          }}
        />
      </Form>
    </Dialog>
  );
}
