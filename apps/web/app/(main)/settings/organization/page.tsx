"use client";

import { Pencil } from "lucide-react";
import { useState } from "react";
import { LoadingState } from "@/components/shared/loading-state";
import { PageHeader } from "@/components/shared/page-header";
import { SectionLabel } from "@/components/shared/ruled-dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { useActiveCompany } from "@/hooks/use-active-company";
import { dataChanged } from "@/lib/data/live";
import CompanyFormDialog from "../../users/components/company-form-dialog";
import { VatSetting } from "../components/organization-settings";

/**
 * Settings → Organization: the active company's details (same form as
 * Users → Companies) and its tax setting.
 */
export default function OrganizationSettingsPage() {
  const { role } = useAuth();
  const { company, loading } = useActiveCompany();
  const [editing, setEditing] = useState(false);
  const canManage = role === "admin" || role === "manager";

  if (loading) {
    return (
      <div className="h-full bg-card p-4 font-sans md:p-6">
        <LoadingState message="Loading organization..." variant="skeleton" />
      </div>
    );
  }

  if (!company) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-card p-6 text-center font-sans">
        <span className="eyebrow">( Not found )</span>
        <p className="heading text-2xl">
          <span className="text-muted-foreground">No active company</span> is
          selected.
        </p>
      </div>
    );
  }

  const details = [
    { label: "Company name", value: company.name },
    { label: "TIN", value: company.tin, mono: true },
    { label: "Telephone no", value: company.telephoneNo, mono: true },
    { label: "Address", value: company.address, multiline: true },
  ];

  return (
    <div className="flex h-full flex-col divide-y overflow-y-auto bg-card font-sans">
      <PageHeader
        back={{ href: "/settings", label: "Settings" }}
        eyebrow="( Settings · Organization )"
        lead="Organization"
        title="settings."
        description={`${company.name} · switch companies from the sidebar to change another one`}
        actions={
          canManage ? (
            <Button variant="outline" onClick={() => setEditing(true)}>
              <Pencil />
              Edit details
            </Button>
          ) : null
        }
      />

      <section className="flex flex-col gap-3 px-5 py-5">
        <div className="flex flex-col gap-1">
          <SectionLabel>01 / Company details</SectionLabel>
          <p className="text-sm text-muted-foreground">
            Printed on every invoice as the supplier.
          </p>
        </div>
        <dl className="grid max-w-3xl gap-px overflow-hidden rounded-md border bg-border text-sm sm:grid-cols-2">
          {details.map((detail) => (
            <div
              key={detail.label}
              className="flex flex-col gap-1 bg-surface-muted px-3 py-2"
            >
              <dt className="eyebrow">{detail.label}</dt>
              <dd
                className={[
                  detail.mono ? "font-mono" : "",
                  detail.multiline ? "whitespace-pre-wrap" : "",
                ].join(" ")}
              >
                {detail.value || "–"}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="flex flex-col gap-3 px-5 py-5">
        <SectionLabel>02 / Tax</SectionLabel>
        <VatSetting company={company} canManage={canManage} />
      </section>

      {canManage ? null : (
        <p className="px-5 py-4 text-xs text-muted-foreground">
          Only admins and managers can change organization settings.
        </p>
      )}

      <CompanyFormDialog
        mode="edit"
        company={company}
        open={editing}
        onOpenChange={setEditing}
        hideTrigger
        onSaved={() => dataChanged()}
      />
    </div>
  );
}
