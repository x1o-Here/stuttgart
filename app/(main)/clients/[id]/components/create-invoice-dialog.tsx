"use client";

import {
  collection,
  doc,
  serverTimestamp,
  Timestamp,
  writeBatch,
} from "firebase/firestore";
import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import type {
  ClientSnapshot,
  InvoiceTemplate,
  TemplateColumn,
} from "../invoice-model";

type DraftLine = {
  id: string;
  date: string;
  vehicleNo: string;
  rate: string;
  amount: string;
  customValues: Record<string, string>;
};

type CreateInvoiceDialogProps = {
  client: ClientSnapshot;
  template: InvoiceTemplate;
};

function todayValue() {
  const date = new Date();
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
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

export default function CreateInvoiceDialog({
  client,
  template,
}: CreateInvoiceDialogProps) {
  const { activeCompany, user } = useAuth();
  const vehicles = useLookupStore((state) => state.vehicles).filter(
    (vehicle) => vehicle.entityStatus,
  );
  const [open, setOpen] = useState(false);
  const [taxInvoiceNo, setTaxInvoiceNo] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(todayValue());
  const [deliveryDate, setDeliveryDate] = useState(todayValue());
  const [deliveryAddress, setDeliveryAddress] = useState(client.address);
  const [deliveryReference, setDeliveryReference] = useState("");
  const [lines, setLines] = useState<DraftLine[]>(() => [
    newLine(template.columns),
  ]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const customColumns = useMemo(
    () => template.columns.filter((column) => !column.system),
    [template.columns],
  );
  const totalAmount = useMemo(
    () => lines.reduce((total, line) => total + (Number(line.amount) || 0), 0),
    [lines],
  );

  function resetForm() {
    setTaxInvoiceNo("");
    setInvoiceDate(todayValue());
    setDeliveryDate(todayValue());
    setDeliveryAddress(client.address);
    setDeliveryReference("");
    setLines([newLine(template.columns)]);
    setError("");
  }

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
    if (!deliveryAddress.trim()) return "Delivery address is required.";
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
      const invoiceRef = doc(
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

      batch.set(invoiceRef, {
        taxInvoiceNo: taxInvoiceNo.trim(),
        date: Timestamp.fromDate(new Date(`${invoiceDate}T00:00:00`)),
        delivery: {
          date: Timestamp.fromDate(new Date(`${deliveryDate}T00:00:00`)),
          address: deliveryAddress.trim(),
          reference: deliveryReference.trim(),
        },
        client: { ...client },
        template: structuredClone(template),
        lineItems,
        totalAmount,
        outstandingAmount: totalAmount,
        status: "issued",
        isActive: true,
        entityStatus: true,
        createdAt: serverTimestamp(),
        createdBy: user.uid,
      });

      const auditRef = doc(collection(db, "auditLogs"));
      batch.set(auditRef, {
        userId: user.uid,
        companyId: activeCompany,
        action: "create",
        description: `Invoice ${taxInvoiceNo.trim()} created for ${client.name}`,
        entityStatus: true,
        transactionId: invoiceRef.id,
        createdAt: serverTimestamp(),
      });

      await batch.commit();
      resetForm();
      setOpen(false);
    } catch (createError) {
      console.error("Failed to create invoice", createError);
      setError("Failed to create the invoice.");
    } finally {
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

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next && !saving) resetForm();
      }}
    >
      <DialogTrigger asChild>
        <Button className="shrink-0">
          <Plus className="mr-2 h-4 w-4" />
          Create Invoice
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle>Create Invoice for {client.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Tax invoice no</Label>
              <Input
                value={taxInvoiceNo}
                onChange={(event) => setTaxInvoiceNo(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Invoice date</Label>
              <Input
                type="date"
                value={invoiceDate}
                onChange={(event) => setInvoiceDate(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Delivery date</Label>
              <Input
                type="date"
                value={deliveryDate}
                onChange={(event) => setDeliveryDate(event.target.value)}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Delivery address</Label>
              <Textarea
                value={deliveryAddress}
                onChange={(event) => setDeliveryAddress(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Delivery reference</Label>
              <Input
                value={deliveryReference}
                onChange={(event) => setDeliveryReference(event.target.value)}
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
                    {template.columns.map((column) => (
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
                      <td className="p-2">{index + 1}</td>
                      <td className="min-w-40 p-2">
                        <Input
                          type="date"
                          value={line.date}
                          onChange={(event) =>
                            updateLine(line.id, { date: event.target.value })
                          }
                        />
                      </td>
                      <td className="min-w-44 p-2">
                        <Select
                          value={line.vehicleNo}
                          onValueChange={(vehicleNo) =>
                            updateLine(line.id, { vehicleNo })
                          }
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
                      </td>
                      <td className="min-w-32 p-2">
                        <Input
                          type="number"
                          step="0.01"
                          value={line.rate}
                          onChange={(event) =>
                            updateLine(line.id, { rate: event.target.value })
                          }
                        />
                      </td>
                      <td className="min-w-32 p-2">
                        <Input
                          type="number"
                          step="0.01"
                          value={line.amount}
                          onChange={(event) =>
                            updateLine(line.id, { amount: event.target.value })
                          }
                        />
                      </td>
                      {customColumns.map((column) => (
                        <td key={column.id} className="min-w-40 p-2">
                          {dynamicInput(column, line)}
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

          <div className="flex justify-end">
            <div className="rounded-md bg-muted/40 px-4 py-3 text-lg font-bold">
              Total:{" "}
              {totalAmount.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
          </div>

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
          <Button onClick={() => void createInvoice()} disabled={saving}>
            {saving ? "Creating..." : "Create Invoice"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
