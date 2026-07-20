"use client";

import {
  collection,
  doc,
  serverTimestamp,
  Timestamp,
  writeBatch,
} from "firebase/firestore";
import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { useLookupStore } from "@/stores/use-lookup-store";
import {
  amountInWords,
  calculateInvoiceTotals,
  type ClientInvoiceDocument,
  type ClientSnapshot,
  deriveStatusFromBalances,
  type InvoiceTemplate,
  orderedTemplateColumns,
  roundMoney,
  type TemplateColumn,
} from "../invoice-model";

type DraftLine = {
  id: string;
  date: string;
  vehicleNo: string;
  rate: string;
  amount: string;
  customValues: Record<string, string>;
};

type CreateInvoiceFormProps = {
  client: ClientSnapshot;
  template: InvoiceTemplate;
  /** When set, the form updates this invoice instead of creating one. */
  invoice?: ClientInvoiceDocument;
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

function lineFromInvoice(
  item: ClientInvoiceDocument["lineItems"][number],
  columns: TemplateColumn[],
): DraftLine {
  return {
    id: crypto.randomUUID(),
    date: toDateInput(item.date),
    vehicleNo: item.vehicleNo,
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

  const orderedColumns = useMemo(
    () => orderedTemplateColumns(template.columns),
    [template.columns],
  );
  const customColumns = useMemo(
    () => template.columns.filter((column) => !column.system),
    [template.columns],
  );
  const supplyValue = useMemo(
    () => lines.reduce((total, line) => total + (Number(line.amount) || 0), 0),
    [lines],
  );
  const totals = useMemo(
    () => calculateInvoiceTotals(supplyValue),
    [supplyValue],
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

    for (const [index, line] of lines.entries()) {
      if (
        !line.date ||
        !line.vehicleNo ||
        line.rate === "" ||
        line.amount === ""
      ) {
        return `Complete the default fields in row ${index + 1}.`;
      }
      if (
        !Number.isFinite(Number(line.rate)) ||
        !Number.isFinite(Number(line.amount))
      ) {
        return `Rate and amount must be valid numbers in row ${index + 1}.`;
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
      const batch = writeBatch(db);
      const invoiceRef = isEditing
        ? doc(
            db,
            "companies",
            activeCompany,
            "clients",
            client.id,
            "invoices",
            invoice.id,
          )
        : doc(
            collection(
              db,
              "companies",
              activeCompany,
              "clients",
              client.id,
              "invoices",
            ),
          );
      const lineItems = lines.map((line, index) => ({
        no: index + 1,
        date: Timestamp.fromDate(new Date(`${line.date}T00:00:00`)),
        vehicleNo: line.vehicleNo,
        rate: Number(line.rate),
        amount: Number(line.amount),
        customValues: Object.fromEntries(
          customColumns.map((column) => {
            const value = line.customValues[column.key] ?? "";
            return [
              column.key,
              column.type === "number" || column.type === "decimal"
                ? Number(value) || 0
                : value,
            ];
          }),
        ),
      }));

      const nextOutstanding = isEditing
        ? roundMoney(Math.max(0, totals.totalIncludingVat - paidAmount))
        : totals.totalIncludingVat;
      const nextStatus = isEditing
        ? deriveStatusFromBalances(
            totals.totalIncludingVat,
            nextOutstanding,
            invoice.status,
          )
        : "issued";

      const payload = {
        taxInvoiceNo: taxInvoiceNo.trim(),
        date: Timestamp.fromDate(new Date(`${invoiceDate}T00:00:00`)),
        delivery: {
          date: Timestamp.fromDate(new Date(`${deliveryDate}T00:00:00`)),
          address: placeOfSupply.trim(),
          reference: additionalInfo.trim(),
        },
        client: { ...client },
        template: structuredClone(template),
        lineItems,
        totalAmount: totals.supplyValue,
        vatAmount: totals.vatAmount,
        totalIncludingVat: totals.totalIncludingVat,
        outstandingAmount: nextOutstanding,
        status: nextStatus,
        isActive: nextStatus !== "paid" && nextStatus !== "cancelled",
        entityStatus: true,
      };

      if (isEditing) {
        batch.update(invoiceRef, {
          ...payload,
          updatedAt: serverTimestamp(),
          updatedBy: user.uid,
        });
      } else {
        batch.set(invoiceRef, {
          ...payload,
          createdAt: serverTimestamp(),
          createdBy: user.uid,
        });
      }

      const auditRef = doc(collection(db, "auditLogs"));
      batch.set(auditRef, {
        userId: user.uid,
        companyId: activeCompany,
        action: isEditing ? "update" : "create",
        description: isEditing
          ? `Invoice ${taxInvoiceNo.trim()} updated for ${client.name}`
          : `Invoice ${taxInvoiceNo.trim()} created for ${client.name}`,
        entityStatus: true,
        transactionId: invoiceRef.id,
        createdAt: serverTimestamp(),
      });

      await batch.commit();
      router.push(`/clients/${client.id}/invoices/${invoiceRef.id}`);
    } catch (createError) {
      console.error(
        isEditing ? "Failed to update invoice" : "Failed to create invoice",
        createError,
      );
      setError(
        isEditing
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
        <Select
          value={value}
          onValueChange={(next) => updateCustomValue(line.id, column.key, next)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Vehicle" />
          </SelectTrigger>
          <SelectContent>
            {vehicles.map((vehicle) => (
              <SelectItem key={vehicle.id} value={vehicle.name}>
                {vehicle.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    return (
      <Input
        type={
          column.type === "date"
            ? "date"
            : column.type === "number" || column.type === "decimal"
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
          <Input
            type="date"
            value={line.date}
            onChange={(event) =>
              updateLine(line.id, { date: event.target.value })
            }
          />
        );
      case "vehicleNo":
        return (
          <Select
            value={line.vehicleNo}
            onValueChange={(vehicleNo) => updateLine(line.id, { vehicleNo })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Vehicle" />
            </SelectTrigger>
            <SelectContent>
              {vehicles.map((vehicle) => (
                <SelectItem key={vehicle.id} value={vehicle.name}>
                  {vehicle.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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

  return (
    <div className="space-y-6 rounded-lg bg-white p-4 sm:p-6">
      <div>
        <h1 className="text-xl font-semibold">
          {isEditing ? "Edit Invoice" : "Create Invoice"}
        </h1>
        <p className="text-sm text-muted-foreground">{client.name}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label>Tax invoice no</Label>
          <Input
            value={taxInvoiceNo}
            onChange={(event) => setTaxInvoiceNo(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Date of invoice</Label>
          <Input
            type="date"
            value={invoiceDate}
            onChange={(event) => setInvoiceDate(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Date of delivery</Label>
          <Input
            type="date"
            value={deliveryDate}
            onChange={(event) => setDeliveryDate(event.target.value)}
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>Place of supply</Label>
          <Textarea
            value={placeOfSupply}
            onChange={(event) => setPlaceOfSupply(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Additional information if any</Label>
          <Input
            value={additionalInfo}
            onChange={(event) => setAdditionalInfo(event.target.value)}
          />
        </div>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Cost breakdown</h3>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              setLines((current) => [...current, newLine(template.columns)])
            }
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Row
          </Button>
        </div>

        <div className="overflow-auto rounded-md border">
          <table className="w-full min-w-max text-sm">
            <thead className="bg-muted/40">
              <tr>
                {orderedColumns.map((column) => (
                  <th key={column.id} className="p-2 text-left font-medium">
                    {column.label}
                    {column.required ? " *" : ""}
                  </th>
                ))}
                <th className="w-12 p-2" />
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => (
                <tr key={line.id} className="border-t align-top">
                  {orderedColumns.map((column) => (
                    <td
                      key={column.id}
                      className={column.key === "no" ? "p-2" : "min-w-32 p-2"}
                    >
                      {column.system
                        ? renderSystemCell(column, line, index)
                        : dynamicInput(column, line)}
                    </td>
                  ))}
                  <td className="p-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={lines.length === 1}
                      onClick={() =>
                        setLines((current) =>
                          current.filter((item) => item.id !== line.id),
                        )
                      }
                    >
                      <Trash2 className="text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="ml-auto w-full max-w-md space-y-1.5 rounded-md bg-muted/40 px-4 py-3 text-sm">
        <div className="flex justify-between gap-4">
          <span>Total Value of Supply</span>
          <span className="font-medium tabular-nums">
            {formatMoney(totals.supplyValue)}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span>VAT Amount (18%)</span>
          <span className="font-medium tabular-nums">
            {formatMoney(totals.vatAmount)}
          </span>
        </div>
        <div className="flex justify-between gap-4 border-t pt-2 text-base font-bold">
          <span>Total including VAT</span>
          <span className="tabular-nums">
            {formatMoney(totals.totalIncludingVat)}
          </span>
        </div>
        <p className="pt-1 text-xs text-muted-foreground">
          {amountInWords(totals.totalIncludingVat)}
        </p>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={saving}
          onClick={() =>
            router.push(
              isEditing
                ? `/clients/${client.id}/invoices/${invoice.id}`
                : `/clients/${client.id}`,
            )
          }
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
              ? "Saving..."
              : "Creating..."
            : isEditing
              ? "Save Changes"
              : "Create Invoice"}
        </Button>
      </div>
    </div>
  );
}
