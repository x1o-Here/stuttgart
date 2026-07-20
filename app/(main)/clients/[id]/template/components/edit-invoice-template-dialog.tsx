"use client";

import {
  collection,
  doc,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase/firebase-client";
import {
  createCustomColumnKey,
  DEFAULT_TEMPLATE_COLUMNS,
  EMPTY_SIGNING_INFORMATION,
  type InvoiceTemplate,
  type TemplateColumn,
  type TemplateColumnType,
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
  companyName: string;
  template: InvoiceTemplate | null;
};

function initialTemplate(
  template: InvoiceTemplate | null,
  companyName: string,
): InvoiceTemplate {
  if (template) {
    return structuredClone(template);
  }
  return {
    supplier: {
      name: companyName,
      address: "",
      vatNo: "",
      contactNo: "",
    },
    signing: { ...EMPTY_SIGNING_INFORMATION },
    columns: DEFAULT_TEMPLATE_COLUMNS.map((column) => ({ ...column })),
  };
}

export default function EditInvoiceTemplateDialog({
  clientId,
  clientName,
  companyName,
  template,
}: EditInvoiceTemplateDialogProps) {
  const { activeCompany, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<InvoiceTemplate>(() =>
    initialTemplate(template, companyName),
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setDraft(initialTemplate(template, companyName));
      setError("");
    }
  }, [open, template, companyName]);

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
    if (!draft.supplier.name.trim()) {
      setError("Supplier name is required.");
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
      batch.set(
        templateRef,
        {
          ...draft,
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
          <Pencil className="mr-2 h-4 w-4" />
          Manage Template
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Manage Invoice Template</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <section className="space-y-3">
            <h3 className="font-semibold">Supplier information</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                placeholder="Supplier name"
                value={draft.supplier.name}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    supplier: { ...current.supplier, name: event.target.value },
                  }))
                }
              />
              <Input
                placeholder="VAT number"
                value={draft.supplier.vatNo}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    supplier: {
                      ...current.supplier,
                      vatNo: event.target.value,
                    },
                  }))
                }
              />
              <Textarea
                placeholder="Supplier address"
                value={draft.supplier.address}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    supplier: {
                      ...current.supplier,
                      address: event.target.value,
                    },
                  }))
                }
              />
              <Input
                placeholder="Contact number"
                value={draft.supplier.contactNo}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    supplier: {
                      ...current.supplier,
                      contactNo: event.target.value,
                    },
                  }))
                }
              />
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold">Cost breakdown columns</h3>
                <p className="text-sm text-muted-foreground">
                  Base columns stay fixed: No, Date, and Vehicle No first; Rate
                  and Amount last. Additional columns you add appear between
                  those groups.
                </p>
              </div>
              <Button type="button" variant="outline" onClick={addColumn}>
                <Plus className="mr-2 h-4 w-4" />
                Add Column
              </Button>
            </div>

            <div className="rounded-md border">
              <div className="grid grid-cols-[1fr_180px_100px_140px] gap-2 border-b bg-muted/40 p-3 text-sm font-medium">
                <span>Column</span>
                <span>Type</span>
                <span>Required</span>
                <span>Actions</span>
              </div>
              {draft.columns.map((column) => (
                <div
                  key={column.id}
                  className="grid grid-cols-[1fr_180px_100px_140px] items-center gap-2 border-b p-3 last:border-b-0"
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
                    <span className="text-xs text-muted-foreground">Fixed</span>
                  ) : (
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => moveColumn(column.id, -1)}
                      >
                        <ArrowUp />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => moveColumn(column.id, 1)}
                      >
                        <ArrowDown />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeColumn(column.id)}
                      >
                        <Trash2 className="text-destructive" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="font-semibold">Signing section</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                placeholder="Left label"
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

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={() => void saveTemplate()} disabled={saving}>
            {saving ? "Saving..." : "Save Template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
