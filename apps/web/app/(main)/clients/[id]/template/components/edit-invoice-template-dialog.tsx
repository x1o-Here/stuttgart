"use client";

import {
  evaluateAmountFormula,
  parseAmountFormula,
} from "@stuttgart/shared/invoices/amount-formula";
import {
  ArrowDown,
  ArrowUp,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
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
import { saveTemplate as saveInvoiceTemplate } from "@/lib/data/ledger";
import {
  createCustomColumnKey,
  DEFAULT_AMOUNT_FORMULA,
  DEFAULT_TEMPLATE_COLUMNS,
  formulaColumns,
  formulaFromDisplay,
  formulaToDisplay,
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

const FORMULA_OPERATORS: { insert: string; label: string; name: string }[] = [
  { insert: " + ", label: "+", name: "Add" },
  { insert: " - ", label: "−", name: "Subtract" },
  { insert: " * ", label: "×", name: "Multiply" },
  { insert: " / ", label: "÷", name: "Divide" },
  { insert: "(", label: "(", name: "Open bracket" },
  { insert: ")", label: ")", name: "Close bracket" },
];

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function formatSample(value: number) {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

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
  const [formulaText, setFormulaText] = useState(() =>
    formulaToDisplay(
      draft.settings.amountFormula ?? DEFAULT_AMOUNT_FORMULA,
      draft.columns,
    ),
  );
  const formulaInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Load the draft only when the dialog opens. `template` and `company` are
  // re-fetched in the background (focus, every 30s, after any save), and each
  // fetch is a new object; resetting on those would wipe unsaved edits.
  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      const next = initialTemplate(template, company);
      setDraft(next);
      setFormulaText(
        formulaToDisplay(
          next.settings.amountFormula ?? DEFAULT_AMOUNT_FORMULA,
          next.columns,
        ),
      );
      setError("");
    }
    setOpen(nextOpen);
  }

  const numericColumns = useMemo(
    () => formulaColumns(draft.columns),
    [draft.columns],
  );

  const formulaCheck = useMemo(
    () =>
      parseAmountFormula(
        formulaFromDisplay(formulaText, draft.columns),
        numericColumns.map((column) => column.key),
      ),
    [formulaText, draft.columns, numericColumns],
  );

  const formulaSample = useMemo(() => {
    if (!formulaCheck.ok) return null;
    const samples = new Map([
      ["quantity", 2],
      ["rate", 100],
    ]);
    const values: Record<string, number> = {};
    const parts: string[] = [];
    for (const column of numericColumns) {
      if (!formulaCheck.refs.includes(column.key)) continue;
      const value = samples.get(column.key) ?? 10;
      values[column.key] = value;
      parts.push(`${column.label} ${value}`);
    }
    return {
      inputs: parts.join(", "),
      amount: formatSample(evaluateAmountFormula(formulaCheck.ast, values)),
    };
  }, [formulaCheck, numericColumns]);

  function updateColumn(id: string, patch: Partial<TemplateColumn>) {
    const previous = draft.columns.find((column) => column.id === id);
    if (
      previous &&
      patch.label !== undefined &&
      previous.label.trim() &&
      patch.label.trim()
    ) {
      // Keep the formula pointing at a column when it is renamed.
      const pattern = new RegExp(
        `\\[\\s*${escapeRegExp(previous.label.trim())}\\s*\\]`,
        "gi",
      );
      setFormulaText((text) =>
        text.replace(pattern, `[${patch.label?.trim()}]`),
      );
    }
    setDraft((current) => ({
      ...current,
      columns: current.columns.map((column) =>
        column.id === id ? { ...column, ...patch } : column,
      ),
    }));
  }

  function insertIntoFormula(text: string) {
    const input = formulaInputRef.current;
    const start = input?.selectionStart ?? formulaText.length;
    const end = input?.selectionEnd ?? formulaText.length;
    const next = formulaText.slice(0, start) + text + formulaText.slice(end);
    setFormulaText(next);
    requestAnimationFrame(() => {
      if (!input) return;
      input.focus();
      const caret = start + text.length;
      input.setSelectionRange(caret, caret);
    });
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
    const column = draft.columns.find((item) => item.id === id);
    if (column && formulaCheck.ok && formulaCheck.refs.includes(column.key)) {
      setError(
        `"${column.label}" is used in the amount formula. Remove it from the formula first.`,
      );
      return;
    }
    setError("");
    setDraft((current) => ({
      ...current,
      columns: current.columns.filter((column) => column.id !== id),
    }));
  }

  function moveColumn(id: string, direction: -1 | 1) {
    setDraft((current) => {
      const index = current.columns.findIndex((column) => column.id === id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.columns.length) {
        return current;
      }
      const next = [...current.columns];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return { ...current, columns: next };
    });
  }

  async function saveTemplate() {
    if (!activeCompany || !user) return;

    // Base columns can be renamed too, so names are checked across all.
    if (draft.columns.some((column) => !column.label.trim())) {
      setError("Every column needs a name.");
      return;
    }
    const labels = draft.columns.map((column) =>
      column.label.trim().toLowerCase(),
    );
    if (new Set(labels).size !== labels.length) {
      setError("Column names must be unique.");
      return;
    }
    if (!formulaCheck.ok) {
      setError(`Amount formula: ${formulaCheck.error}`);
      return;
    }

    try {
      setSaving(true);
      setError("");
      await saveInvoiceTemplate({
        activeCompany,
        clientId,
        clientName,
        company,
        draft: {
          ...draft,
          settings: {
            ...draft.settings,
            amountFormula: formulaFromDisplay(formulaText, draft.columns),
          },
        },
        template,
        user,
      });
      setOpen(false);
    } catch (saveError) {
      console.error("Failed to save invoice template", saveError);
      setError("Failed to save the invoice template.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
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
                  Use the arrows to set the order the columns appear in on the
                  invoice. Base columns can be renamed and moved but not
                  removed.
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
                {draft.columns.map((column, index) => (
                  <div
                    key={column.id}
                    className="grid grid-cols-[1fr_180px_90px_120px] items-center gap-2 border-b px-3 py-2 last:border-b-0"
                  >
                    <Input
                      aria-label={`${column.system ? "Base column" : "Column"} name`}
                      placeholder={
                        DEFAULT_TEMPLATE_COLUMNS.find(
                          (base) => base.key === column.key,
                        )?.label ?? "Column name"
                      }
                      value={column.label}
                      onChange={(event) =>
                        updateColumn(column.id, {
                          label: event.target.value,
                        })
                      }
                    />
                    <Select
                      value={column.type}
                      disabled={column.system}
                      onValueChange={(value: TemplateColumnType) =>
                        updateColumn(column.id, { type: value })
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
                          updateColumn(column.id, {
                            required: checked === true,
                          })
                        }
                      />
                    </div>
                    <div className="flex justify-end gap-0.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Move ${column.label} up`}
                        disabled={index === 0}
                        onClick={() => moveColumn(column.id, -1)}
                      >
                        <ArrowUp />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Move ${column.label} down`}
                        disabled={index === draft.columns.length - 1}
                        onClick={() => moveColumn(column.id, 1)}
                      >
                        <ArrowDown />
                      </Button>
                      {column.system ? (
                        <span className="size-8" aria-hidden />
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Remove ${column.label}`}
                          className="text-muted-foreground hover:bg-danger-soft hover:text-destructive"
                          onClick={() => removeColumn(column.id)}
                        >
                          <Trash2 />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="flex flex-col gap-3 border-b px-6 py-5">
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

          <section className="flex flex-col gap-3 px-6 py-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex max-w-xl flex-col gap-1">
                <SectionLabel>04 / Advanced settings</SectionLabel>
                <p className="text-sm font-medium">Row amount formula</p>
                <p className="text-sm text-muted-foreground">
                  How each row&apos;s Amount is calculated. Use number or
                  decimal columns with + − × ÷ and brackets.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setFormulaText(
                    formulaToDisplay(DEFAULT_AMOUNT_FORMULA, draft.columns),
                  )
                }
              >
                <RotateCcw />
                Reset to default
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <span className="shrink-0 font-mono text-sm text-muted-foreground">
                Amount =
              </span>
              <Input
                ref={formulaInputRef}
                aria-label="Amount formula"
                className="font-mono"
                value={formulaText}
                aria-invalid={!formulaCheck.ok}
                onChange={(event) => setFormulaText(event.target.value)}
              />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {numericColumns.map((column) => (
                <Button
                  key={column.id}
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => insertIntoFormula(`[${column.label}]`)}
                >
                  {column.label}
                </Button>
              ))}
              <span className="mx-1 h-5 w-px bg-border" aria-hidden />
              {FORMULA_OPERATORS.map((operator) => (
                <Button
                  key={operator.label}
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  aria-label={operator.name}
                  className="font-mono"
                  onClick={() => insertIntoFormula(operator.insert)}
                >
                  {operator.label}
                </Button>
              ))}
            </div>
            {formulaCheck.ok ? (
              formulaSample ? (
                <p className="font-mono text-xs text-muted-foreground">
                  e.g. {formulaSample.inputs || "no columns"} → Amount{" "}
                  {formulaSample.amount}
                </p>
              ) : null
            ) : (
              <p className="text-sm text-destructive">{formulaCheck.error}</p>
            )}
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
