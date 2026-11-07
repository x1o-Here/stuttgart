"use client";

import {
  collection,
  doc,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  RuledDialogFooter,
  RuledDialogHeader,
  ruledDialogContentClass,
  SectionLabel,
} from "@/components/shared/ruled-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/auth-context";
import type { CompanyRecord } from "@/lib/companies/types";
import { db } from "@/lib/firebase/firebase-client";
import {
  createCustomColumnKey,
  DEFAULT_TEMPLATE_COLUMNS,
  getDefaultInvoiceTemplate,
  type InvoiceTemplate,
  type TemplateColumn,
  type TemplateColumnType,
  withCompanySupplier,
} from "../../invoice-model";

const COLUMN_TYPES: { value: TemplateColumnType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "decimal", label: "Decimal" },
  { value: "date", label: "Date" },
  { value: "vehicle", label: "Vehicle lookup" },
];

type EditInvoiceTemplateDialogProps = {
  clientId: string;
  clientName: string;
  company: CompanyRecord | null;
  template: InvoiceTemplate | null;
};

function initialTemplate(
  template: InvoiceTemplate | null,
  company: CompanyRecord | null,
): InvoiceTemplate {
  const base = template
    ? structuredClone(template)
    : getDefaultInvoiceTemplate(company);
  return withCompanySupplier(base, company);
}

export default function EditInvoiceTemplateDialog({
  clientId,
  clientName,
  company,
  template,
}: EditInvoiceTemplateDialogProps) {
  const { activeCompany, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<InvoiceTemplate>(() =>
    initialTemplate(template, company),
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setDraft(initialTemplate(template, company));
      setError("");
    }
  }, [open, template, company]);

  const customColumns = useMemo(
    () => draft.columns.filter((column) => !column.system),
    [draft.columns],
  );

  function updateCustomColumn(id: string, patch: Partial<TemplateColumn>) {
    setDraft((current) => ({
      ...current,
      columns: current.columns.map((column) =>
        column.id === id ? { ...column, ...patch } : column,
      ),
    }));
  }

  function addColumn() {
    const id = crypto.randomUUID();
    setDraft((current) => ({
      ...current,
      columns: [
        ...current.columns,
        {
          id,
          key: createCustomColumnKey("new column"),
          label: "New Column",
          type: "text",
          required: false,
          system: false,
        },
      ],
    }));
  }

  function removeColumn(id: string) {
    setDraft((current) => ({
      ...current,
      columns: current.columns.filter((column) => column.id !== id),
    }));
  }

  function moveColumn(id: string, direction: -1 | 1) {
    setDraft((current) => {
      const defaults = current.columns.filter((column) => column.system);
      const custom = current.columns.filter((column) => !column.system);
      const index = custom.findIndex((column) => column.id === id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= custom.length) {
        return current;
      }
      const next = [...custom];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return { ...current, columns: [...defaults, ...next] };
    });
  }

  async function saveTemplate() {
    if (!activeCompany || !user) return;

    const labels = customColumns.map((column) =>
      column.label.trim().toLowerCase(),
    );
    if (customColumns.some((column) => !column.label.trim())) {
      setError("Every custom column needs a name.");
      return;
    }
    if (new Set(labels).size !== labels.length) {
      setError("Custom column names must be unique.");
      return;
    }
    const defaultLabels = new Set(
      DEFAULT_TEMPLATE_COLUMNS.map((column) => column.label.toLowerCase()),
    );
    if (labels.some((label) => defaultLabels.has(label))) {
      setError("Custom columns cannot use a default column name.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      const batch = writeBatch(db);
      const templateRef = doc(
        db,
        "companies",
        activeCompany,
        "clients",
        clientId,
        "invoice-template",
        "config",
      );
      const payload = withCompanySupplier(draft, company);
      batch.set(
        templateRef,
        {
          ...payload,
          clientId,
          entityStatus: true,
          updatedAt: serverTimestamp(),
          updatedBy: user.uid,
          ...(!template
            ? { createdAt: serverTimestamp(), createdBy: user.uid }
            : {}),
        },
        { merge: true },
      );

      const auditRef = doc(collection(db, "auditLogs"));
      batch.set(auditRef, {
        userId: user.uid,
        companyId: activeCompany,
        action: template ? "update" : "create",
        description: `${template ? "Invoice template updated" : "Invoice template created"}: ${clientName}`,
        entityStatus: true,
        createdAt: serverTimestamp(),
      });

      await batch.commit();
      setOpen(false);
    } catch (saveError) {
      console.error("Failed to save invoice template", saveError);
      setError("Failed to save the invoice template.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Pencil />
          Manage template
        </Button>
      </DialogTrigger>
      <DialogContent className={`${ruledDialogContentClass} sm:max-w-4xl`}>
        <RuledDialogHeader
          eyebrow={`( Invoice template · ${clientName} )`}
          lead="Manage"
          title="invoice template."
          description="Applies to new invoices for this client. Issued invoices keep the template they were created with."
        />

        <div className="flex flex-col">
          <section className="flex flex-col gap-3 border-b px-6 py-5">
            <SectionLabel>01 / Supplier</SectionLabel>
            <p className="text-sm text-muted-foreground">
              Pulled from the active company. Update company details under Users
              → Companies.
            </p>
            <dl className="grid gap-px overflow-hidden rounded-md border bg-border text-sm sm:grid-cols-2">
              <div className="flex flex-col gap-1 bg-surface-muted px-3 py-2">
                <dt className="eyebrow">Company name</dt>
                <dd>{company?.name || "–"}</dd>
              </div>
              <div className="flex flex-col gap-1 bg-surface-muted px-3 py-2">
                <dt className="eyebrow">TIN</dt>
                <dd className="font-mono">{company?.tin || "–"}</dd>
              </div>
              <div className="flex flex-col gap-1 bg-surface-muted px-3 py-2">
                <dt className="eyebrow">Address</dt>
                <dd className="whitespace-pre-wrap">
                  {company?.address || "–"}
                </dd>
              </div>
              <div className="flex flex-col gap-1 bg-surface-muted px-3 py-2">
                <dt className="eyebrow">Telephone no</dt>
                <dd className="font-mono">{company?.telephoneNo || "–"}</dd>
              </div>
            </dl>
          </section>

          <section className="flex flex-col gap-3 border-b px-6 py-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex max-w-xl flex-col gap-1">
                <SectionLabel>02 / Cost breakdown columns</SectionLabel>
                <p className="text-sm text-muted-foreground">
                  Base columns stay fixed: No, Date, and Vehicle No first; Rate
                  and Amount last. Additional columns you add appear between
                  those groups.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addColumn}
              >
                <Plus />
                Add column
              </Button>
            </div>

            <div className="overflow-x-auto rounded-md border">
              <div className="min-w-[36rem]">
                <div className="grid grid-cols-[1fr_180px_90px_120px] gap-2 border-b bg-surface-muted px-3 py-2 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                  <span>Column</span>
                  <span>Type</span>
                  <span className="text-center">Required</span>
                  <span className="text-right">Order</span>
                </div>
                {draft.columns.map((column) => (
                  <div
                    key={column.id}
                    className="grid grid-cols-[1fr_180px_90px_120px] items-center gap-2 border-b px-3 py-2 last:border-b-0"
                  >
                    {column.system ? (
                      <Input value={column.label} disabled />
                    ) : (
                      <Input
                        value={column.label}
                        onChange={(event) =>
                          updateCustomColumn(column.id, {
                            label: event.target.value,
                          })
                        }
                      />
                    )}
                    <Select
                      value={column.type}
                      disabled={column.system}
                      onValueChange={(value: TemplateColumnType) =>
                        updateCustomColumn(column.id, { type: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {COLUMN_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex justify-center">
                      <Checkbox
                        checked={column.required}
                        disabled={column.system}
                        onCheckedChange={(checked) =>
                          updateCustomColumn(column.id, {
                            required: checked === true,
                          })
                        }
                      />
                    </div>
                    {column.system ? (
                      <span className="text-right font-mono text-xs text-muted-foreground">
                        Fixed
                      </span>
                    ) : (
                      <div className="flex justify-end gap-0.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Move column up"
                          onClick={() => moveColumn(column.id, -1)}
                        >
                          <ArrowUp />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Move column down"
                          onClick={() => moveColumn(column.id, 1)}
                        >
                          <ArrowDown />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Remove column"
                          className="text-muted-foreground hover:bg-danger-soft hover:text-destructive"
                          onClick={() => removeColumn(column.id)}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="flex flex-col gap-3 px-6 py-5">
            <SectionLabel>03 / Signing section</SectionLabel>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                placeholder="Left label"
                aria-label="Left label"
                value={draft.signing.leftLabel}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    signing: {
                      ...current.signing,
                      leftLabel: event.target.value,
                    },
                  }))
                }
              />
              <Input
                placeholder="Left name"
                aria-label="Left name"
                value={draft.signing.leftName}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    signing: {
                      ...current.signing,
                      leftName: event.target.value,
                    },
                  }))
                }
              />
              <Input
                placeholder="Right label"
                aria-label="Right label"
                value={draft.signing.rightLabel}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    signing: {
                      ...current.signing,
                      rightLabel: event.target.value,
                    },
                  }))
                }
              />
              <Input
                placeholder="Right name"
                aria-label="Right name"
                value={draft.signing.rightName}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    signing: {
                      ...current.signing,
                      rightName: event.target.value,
                    },
                  }))
                }
              />
            </div>
          </section>

          {error ? (
            <p className="mx-6 mb-5 rounded-md bg-danger-soft px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </div>

        <RuledDialogFooter
          summary={`${draft.columns.length} columns · ${
            draft.columns.filter((column) => !column.system).length
          } custom`}
        >
          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={() => void saveTemplate()} disabled={saving}>
            {saving ? "Saving…" : "Save template"}
          </Button>
        </RuledDialogFooter>
      </DialogContent>
    </Dialog>
  );
}
