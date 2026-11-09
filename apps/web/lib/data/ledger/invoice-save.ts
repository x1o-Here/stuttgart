/**
 * Saving a client invoice (create-invoice-form). Both modes build the same
 * payload first, so this one function holds both: the API call, and the
 * Firestore batch that is deleted at the cutover. Returns the invoice id.
 */
import type { User } from "firebase/auth";
import {
  collection,
  doc,
  serverTimestamp,
  Timestamp,
  writeBatch,
} from "firebase/firestore";
import {
  type ClientInvoiceDocument,
  type ClientSnapshot,
  deriveStatusFromBalances,
  type InvoiceTemplate,
  type InvoiceTotals,
  roundMoney,
  type TemplateColumn,
} from "@/app/(main)/clients/[id]/invoice-model";
import { db } from "@/lib/firebase/firebase-client";
import { usesApi } from "../flags";
import { ledgerApi } from "./api";

type DraftLine = {
  id: string;
  date: string;
  vehicleNo: string;
  rate: string;
  amount: string;
  customValues: Record<string, string>;
};

export async function saveInvoice({
  activeCompany,
  additionalInfo,
  client,
  customColumns,
  deliveryDate,
  invoice,
  invoiceDate,
  lines,
  paidAmount,
  placeOfSupply,
  taxInvoiceNo,
  template,
  totals,
  user,
}: {
  activeCompany: string;
  additionalInfo: string;
  client: ClientSnapshot;
  customColumns: TemplateColumn[];
  deliveryDate: string;
  invoice?: ClientInvoiceDocument;
  invoiceDate: string;
  lines: DraftLine[];
  paidAmount: number;
  placeOfSupply: string;
  taxInvoiceNo: string;
  template: InvoiceTemplate;
  totals: InvoiceTotals;
  user: User;
}): Promise<string> {
  const isEditing = !!invoice;
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

  if (usesApi("ledger")) {
    const iso = (value: { toDate: () => Date }) => value.toDate().toISOString();
    const input = {
      taxInvoiceNo: payload.taxInvoiceNo,
      date: iso(payload.date),
      delivery: { ...payload.delivery, date: iso(payload.delivery.date) },
      client: payload.client as unknown as Record<string, unknown>,
      template: payload.template as unknown as Record<string, unknown>,
      lineItems: lineItems.map((line) => ({
        ...line,
        date: iso(line.date),
      })),
      totalAmount: payload.totalAmount,
      vatAmount: payload.vatAmount,
      totalIncludingVat: payload.totalIncludingVat,
    };
    const saved = isEditing
      ? await ledgerApi.updateInvoice(
          activeCompany,
          client.id,
          invoice.id,
          input,
        )
      : await ledgerApi.createInvoice(activeCompany, client.id, input);
    return saved.id;
  }

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
  return invoiceRef.id;
}
