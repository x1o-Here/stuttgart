"use client";

import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/contexts/auth-context";
import type { CompanyRecord } from "@/lib/companies/types";
import { setCompanyVatRegistered } from "@/lib/data/identity";
import { dataChanged } from "@/lib/data/live";

/** Settings → Organization → Tax: whether the company charges and claims VAT. */
export function VatSetting({
  company,
  canManage,
}: {
  company: CompanyRecord;
  canManage: boolean;
}) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  /** Shown until the live record catches up with a save. */
  const [pending, setPending] = useState<boolean | null>(null);

  const vatRegistered = pending ?? company.vatRegistered;

  // Drop the optimistic value once the live record agrees.
  if (pending !== null && company.vatRegistered === pending) {
    setPending(null);
  }

  async function toggleVat(next: boolean) {
    if (!user) return;
    setSaving(true);
    setError("");
    setPending(next);
    try {
      await setCompanyVatRegistered(user, company, next);
      dataChanged();
    } catch (saveError) {
      console.error("Failed to update the VAT setting", saveError);
      setError("Couldn’t save the VAT setting.");
      setPending(null);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor="vat-registered"
        className="flex max-w-2xl items-start gap-3 rounded-md border px-4 py-3"
      >
        <Checkbox
          id="vat-registered"
          className="mt-0.5"
          checked={vatRegistered}
          disabled={saving || !canManage}
          onCheckedChange={(checked) => void toggleVat(checked === true)}
        />
        <span className="flex flex-col gap-1">
          <span className="font-medium text-foreground">
            Registered for VAT
          </span>
          <span className="text-sm text-muted-foreground">
            When ticked, client invoices add 18% VAT, supplier invoices split
            out input VAT, and VAT reports are available. Untick for a company
            that isn’t VAT registered. Invoices already issued keep their
            figures.
          </span>
        </span>
      </label>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
