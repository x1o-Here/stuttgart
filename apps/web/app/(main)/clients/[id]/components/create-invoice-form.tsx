"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import CalendarPopover from "@/components/shared/calendar-popover";
import { PageHeader } from "@/components/shared/page-header";
import { SectionLabel } from "@/components/shared/ruled-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/auth-context";
import { ApiError } from "@/lib/api-client";
import { saveInvoice } from "@/lib/data/ledger";
import { useLookupStore } from "@/stores/use-lookup-store";
import {
  amountCalculator,
  amountInWords,
  type ClientInvoiceDocument,
  type ClientSnapshot,
  calculateInvoiceTotals,
  type InvoiceTemplate,
  roundMoney,
  type TemplateColumn,
} from "../invoice-model";
import { VehiclePicker } from "./vehicle-picker";

type DraftLine = {
  id: string;
  date: string;
  vehicleNo: string;
  description: string;
  quantity: string;
  rate: string;
  amount: string;
  customValues: Record<string, string>;
};

type CreateInvoiceFormProps = {
  client: ClientSnapshot;
  template: InvoiceTemplate;
  /** When set, the form updates this invoice instead of creating one. */
  invoice?: ClientInvoiceDocument;
  /** Organization setting: false = no VAT on this invoice. */
  vatRegistered?: boolean;
};

function todayValue() {
  const date = new Date();
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function toDateInput(value: Date) {
  if (!value.getTime()) return todayValue();
  const offset = value.getTimezoneOffset();
  return new Date(value.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function parseDateInput(value: string): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function lineFromInvoice(
  item: ClientInvoiceDocument["lineItems"][number],
  columns: TemplateColumn[],
): DraftLine {
  return {
    id: crypto.randomUUID(),
    date: toDateInput(item.date),
    vehicleNo: item.vehicleNo,
    description: item.description,
    quantity: String(item.quantity),
    rate: String(item.rate),
    amount: String(item.amount),
    customValues: Object.fromEntries(
      columns
        .filter((column) => !column.system)
        .map((column) => [
          column.key,
          item.customValues[column.key] !== undefined
            ? String(item.customValues[column.key])
            : "",
        ]),
    ),
  };
}

function newLine(columns: TemplateColumn[]): DraftLine {
  return {
    id: crypto.randomUUID(),
    date: todayValue(),
    vehicleNo: "",
    description: "",
    quantity: "1",
    rate: "",
    amount: "",
    customValues: Object.fromEntries(
      columns
        .filter((column) => !column.system)
        .map((column) => [column.key, ""]),
    ),
  };
}

function formatMoney(value: number) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function CreateInvoiceForm({
  client,
  template,
  invoice,
  vatRegistered = true,
}: CreateInvoiceFormProps) {
  const router = useRouter();
  const { activeCompany, user } = useAuth();
  const isEditing = !!invoice;
  const vehicles = useLookupStore((state) => state.vehicles).filter(
    (vehicle) => vehicle.entityStatus,
  );
  const [taxInvoiceNo, setTaxInvoiceNo] = useState(
    () => invoice?.taxInvoiceNo ?? "",
  );
  const [invoiceDate, setInvoiceDate] = useState(() =>
    invoice ? toDateInput(invoice.date) : todayValue(),
  );
  const [deliveryDate, setDeliveryDate] = useState(() =>
    invoice ? toDateInput(invoice.delivery.date) : todayValue(),
  );
  const [placeOfSupply, setPlaceOfSupply] = useState(
    () => invoice?.delivery.address ?? client.address,
  );
  const [additionalInfo, setAdditionalInfo] = useState(
    () => invoice?.delivery.reference ?? "",
  );
  const [lines, setLines] = useState<DraftLine[]>(() =>
    invoice?.lineItems.length
      ? invoice.lineItems.map((item) => lineFromInvoice(item, template.columns))
      : [newLine(template.columns)],
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const paidAmount = invoice
    ? roundMoney(invoice.totalIncludingVat - invoice.outstandingAmount)
    : 0;

  const orderedColumns = template.columns;
  const customColumns = useMemo(
    () => template.columns.filter((column) => !column.system),
    [template.columns],
  );
  const calculator = useMemo(() => amountCalculator(template), [template]);
  /** Lines with Amount filled in from the template formula, when there is one. */
  const resolvedLines = useMemo(() => {
    if (!calculator) return lines;
    return lines.map((line) => {
      const values: Record<string, number> = {
        quantity: Number(line.quantity) || 0,
        rate: Number(line.rate) || 0,
      };
      for (const [key, value] of Object.entries(line.customValues)) {
        values[key] = Number(value) || 0;
      }
      return { ...line, amount: String(calculator.calculate(values)) };
    });
  }, [calculator, lines]);
  const supplyValue = useMemo(
    () =>
      resolvedLines.reduce(
        (total, line) => total + (Number(line.amount) || 0),
        0,
      ),
    [resolvedLines],
  );
  const totals = useMemo(
    () => calculateInvoiceTotals(supplyValue, vatRegistered),
    [supplyValue, vatRegistered],
  );

  function updateLine(id: string, patch: Partial<DraftLine>) {
    setLines((current) =>
      current.map((line) => (line.id === id ? { ...line, ...patch } : line)),
    );
  }

  function updateCustomValue(id: string, key: string, value: string) {
    setLines((current) =>
      current.map((line) =>
        line.id === id
          ? {
              ...line,
              customValues: { ...line.customValues, [key]: value },
            }
          : line,
      ),
    );
  }

  function validate() {
    if (!taxInvoiceNo.trim()) return "Tax invoice number is required.";
    if (!invoiceDate || !deliveryDate) {
      return "Invoice and delivery dates are required.";
    }
    if (!placeOfSupply.trim()) return "Place of supply is required.";
    if (lines.length === 0) return "Add at least one cost item.";

    for (const [index, line] of resolvedLines.entries()) {
      if (
        !line.date ||
        !line.vehicleNo ||
        line.quantity === "" ||
        line.rate === "" ||
        line.amount === ""
      ) {
        return `Complete the default fields in row ${index + 1}.`;
      }
      if (
        !Number.isFinite(Number(line.quantity)) ||
        !Number.isFinite(Number(line.rate)) ||
        !Number.isFinite(Number(line.amount))
      ) {
        return `Quantity, rate and amount must be valid numbers in row ${index + 1}.`;
      }
      const missingCustom = customColumns.find(
        (column) =>
          column.required &&
          !String(line.customValues[column.key] ?? "").trim(),
      );
      if (missingCustom) {
        return `${missingCustom.label} is required in row ${index + 1}.`;
      }
      const invalidCustom = customColumns.find((column) => {
        const value = String(line.customValues[column.key] ?? "").trim();
        if (!value) return false;
        if (column.type === "number" || column.type === "decimal") {
          return !Number.isFinite(Number(value));
        }
        if (column.type === "date") {
          return Number.isNaN(new Date(`${value}T00:00:00`).getTime());
        }
        return false;
      });
      if (invalidCustom) {
        return `${invalidCustom.label} has an invalid value in row ${index + 1}.`;
      }
    }
    return "";
  }

  async function createInvoice() {
    if (!activeCompany || !user) return;
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setSaving(true);
      setError("");
      const savedId = await saveInvoice({
        activeCompany,
        additionalInfo,
        client,
        customColumns,
        deliveryDate,
        invoice,
        invoiceDate,
        lines: resolvedLines,
        paidAmount,
        placeOfSupply,
        taxInvoiceNo,
        template,
        totals,
        user,
      });
      router.push(`/clients/${client.id}/invoices/${savedId}`);
    } catch (createError) {
      console.error(
        isEditing ? "Failed to update invoice" : "Failed to create invoice",
        createError,
      );
      setError(
        createError instanceof ApiError
          ? createError.message
          : isEditing
            ? "Failed to update the invoice."
            : "Failed to create the invoice.",
      );
      setSaving(false);
    }
  }

  function dynamicInput(column: TemplateColumn, line: DraftLine) {
    const value = line.customValues[column.key] ?? "";
    if (column.type === "vehicle") {
      return (
        <VehiclePicker
          value={value}
          vehicles={vehicles}
          onChange={(next) => updateCustomValue(line.id, column.key, next)}
        />
      );
    }

    if (column.type === "date") {
      return (
        <CalendarPopover
          value={parseDateInput(value)}
          onChange={(date) =>
            updateCustomValue(
              line.id,
              column.key,
              date ? toDateInput(date) : "",
            )
          }
        />
      );
    }

    return (
      <Input
        type={
          column.type === "number" || column.type === "decimal"
            ? "number"
            : "text"
        }
        step={column.type === "decimal" ? "0.01" : undefined}
        value={value}
        placeholder={column.label}
        onChange={(event) =>
          updateCustomValue(line.id, column.key, event.target.value)
        }
      />
    );
  }

  function renderSystemCell(
    column: TemplateColumn,
    line: DraftLine,
    index: number,
  ) {
    switch (column.key) {
      case "no":
        return index + 1;
      case "date":
        return (
          <CalendarPopover
            value={parseDateInput(line.date)}
            onChange={(date) => {
              if (date) updateLine(line.id, { date: toDateInput(date) });
            }}
          />
        );
      case "vehicleNo":
        return (
          <VehiclePicker
            value={line.vehicleNo}
            vehicles={vehicles}
            onChange={(vehicleNo) => updateLine(line.id, { vehicleNo })}
          />
        );
      case "description":
        return (
          <Input
            value={line.description}
            placeholder={column.label}
            onChange={(event) =>
              updateLine(line.id, { description: event.target.value })
            }
          />
        );
      case "quantity":
        return (
          <Input
            type="number"
            step="any"
            value={line.quantity}
            onChange={(event) =>
              updateLine(line.id, { quantity: event.target.value })
            }
          />
        );
      case "rate":
        return (
          <Input
            type="number"
            step="0.01"
            value={line.rate}
            onChange={(event) =>
              updateLine(line.id, { rate: event.target.value })
            }
          />
        );
      case "amount":
        if (calculator) {
          const computed =
            resolvedLines.find((item) => item.id === line.id)?.amount ?? "0";
          return (
            <Input
              readOnly
              tabIndex={-1}
              aria-label={`Amount, row ${index + 1}`}
              title="Calculated from the template's amount formula"
              className="bg-surface-muted text-right font-mono"
              value={formatMoney(Number(computed) || 0)}
            />
          );
        }
        return (
          <Input
            type="number"
            step="0.01"
            value={line.amount}
            onChange={(event) =>
              updateLine(line.id, { amount: event.target.value })
            }
          />
        );
      default:
        return dynamicInput(column, line);
    }
  }

  const backHref = isEditing
    ? `/clients/${client.id}/invoices/${invoice.id}`
    : `/clients/${client.id}`;

  return (
    <div className="flex min-h-full flex-col divide-y">
      <PageHeader
        back={{
          href: backHref,
          label: isEditing
            ? `Invoice ${invoice.taxInvoiceNo || ""}`.trim()
            : client.name,
        }}
        eyebrow={`( ${client.name} )`}
        lead={isEditing ? "Edit" : "New"}
        title={isEditing ? "tax invoice." : "tax invoice."}
        description={
          taxInvoiceNo.trim() ? `No ${taxInvoiceNo.trim()}` : "Not numbered yet"
        }
      />

      <section className="grid gap-4 px-4 py-5 md:grid-cols-3 md:px-6">
        <div className="md:col-span-3">
          <SectionLabel>01 / Invoice details</SectionLabel>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="invoice-no">Tax invoice no</Label>
          <Input
            id="invoice-no"
            className="font-mono"
            value={taxInvoiceNo}
            onChange={(event) => setTaxInvoiceNo(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Date of invoice</Label>
          <CalendarPopover
            value={parseDateInput(invoiceDate)}
            onChange={(date) => {
              if (date) setInvoiceDate(toDateInput(date));
            }}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Date of delivery</Label>
          <CalendarPopover
            value={parseDateInput(deliveryDate)}
            onChange={(date) => {
              if (date) setDeliveryDate(toDateInput(date));
            }}
          />
        </div>
        <div className="flex flex-col gap-2 md:col-span-2">
          <Label htmlFor="invoice-place">Place of supply</Label>
          <Textarea
            id="invoice-place"
            rows={2}
            value={placeOfSupply}
            onChange={(event) => setPlaceOfSupply(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="invoice-info">Additional information</Label>
          <Input
            id="invoice-info"
            placeholder="Optional"
            value={additionalInfo}
            onChange={(event) => setAdditionalInfo(event.target.value)}
          />
        </div>
      </section>

      <section className="flex flex-col">
        <div className="flex items-center justify-between gap-3 px-4 py-3 md:px-6">
          <SectionLabel>02 / Cost breakdown</SectionLabel>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setLines((current) => [...current, newLine(template.columns)])
            }
          >
            <Plus />
            Add row
          </Button>
        </div>

        <div className="overflow-auto border-t">
          <table className="w-full min-w-max text-sm">
            <thead className="bg-surface-muted">
              <tr>
                {orderedColumns.map((column) => (
                  <th
                    key={column.id}
                    className="border-b px-2 py-2 text-left font-mono text-[11px] font-normal uppercase tracking-[0.08em] text-muted-foreground first:pl-4 md:first:pl-6"
                  >
                    {column.label}
                    {column.required ? " *" : ""}
                  </th>
                ))}
                <th className="w-12 border-b pr-4 md:pr-6" />
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => (
                <tr key={line.id} className="border-b align-top">
                  {orderedColumns.map((column) => (
                    <td
                      key={column.id}
                      className={`px-2 py-2 first:pl-4 md:first:pl-6 ${
                        column.key === "no" ? "" : "min-w-32"
                      }`}
                    >
                      {column.system
                        ? renderSystemCell(column, line, index)
                        : dynamicInput(column, line)}
                    </td>
                  ))}
                  <td className="py-2 pr-4 md:pr-6">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Remove row"
                      className="text-muted-foreground hover:bg-danger-soft hover:text-destructive"
                      disabled={lines.length === 1}
                      onClick={() =>
                        setLines((current) =>
                          current.filter((item) => item.id !== line.id),
                        )
                      }
                    >
                      <Trash2 />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex flex-col gap-4 px-4 py-5 md:flex-row md:items-start md:justify-between md:px-6">
        <SectionLabel>03 / Totals</SectionLabel>
        <dl className="w-full max-w-md divide-y rounded-md border text-sm md:ml-auto">
          <div className="flex justify-between gap-4 px-4 py-2">
            <dt className="text-muted-foreground">Total value of supply</dt>
            <dd className="font-mono tabular-nums">
              {formatMoney(totals.supplyValue)}
            </dd>
          </div>
          {vatRegistered ? (
            <div className="flex justify-between gap-4 px-4 py-2">
              <dt className="text-muted-foreground">VAT (18%)</dt>
              <dd className="font-mono tabular-nums">
                {formatMoney(totals.vatAmount)}
              </dd>
            </div>
          ) : null}
          <div className="flex items-baseline justify-between gap-4 bg-surface-muted px-4 py-3">
            <dt className="font-medium">
              {vatRegistered ? "Total including VAT" : "Total"}
            </dt>
            <dd className="flex items-baseline gap-2">
              <span className="font-mono text-xs text-muted-foreground">
                LKR
              </span>
              <span className="font-mono text-2xl font-light tabular-nums">
                {formatMoney(totals.totalIncludingVat)}
              </span>
            </dd>
          </div>
          <p className="px-4 py-2 text-xs text-muted-foreground">
            {amountInWords(totals.totalIncludingVat)}
          </p>
        </dl>
      </section>

      <div className="sticky bottom-0 mt-auto flex flex-col gap-3 bg-surface-muted px-4 py-3 sm:flex-row sm:items-center sm:justify-between md:px-6">
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : (
          <p className="font-mono text-xs tabular-nums text-muted-foreground">
            {lines.length} {lines.length === 1 ? "line" : "lines"} · LKR{" "}
            {formatMoney(totals.totalIncludingVat)}
          </p>
        )}
        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            disabled={saving}
            onClick={() => router.push(backHref)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={saving}
            onClick={() => void createInvoice()}
          >
            {saving
              ? isEditing
                ? "Saving…"
                : "Creating…"
              : isEditing
                ? "Save changes"
                : "Create invoice"}
          </Button>
        </div>
      </div>
    </div>
  );
}
