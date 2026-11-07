import { toDate } from "@/lib/helpers/to-date";
import { roundMoney } from "@/lib/invoices/money";

export type SupplierStatus = "active" | "inactive";

export type Supplier = {
  id: string;
  name: string;
  tin: string;
  address: string;
  supplierType: string;
  contactNo: string;
  status: SupplierStatus;
};

export type SupplierInvoiceStatus = "issued" | "partial" | "paid";

export type SupplierInvoiceLine = {
  id: string;
  description: string;
  quantity: number;
};

export type SupplierInvoice = {
  id: string;
  supplierId: string;
  taxInvoiceNo: string;
  date: Date;
  totalIncludingVat: number;
  billAmount: number;
  vatAmount: number;
  lineItems: SupplierInvoiceLine[];
  outstandingAmount: number;
  status: SupplierInvoiceStatus;
};

const str = (value: unknown) => (typeof value === "string" ? value : "");

export function mapSupplierDoc(
  id: string,
  data: Record<string, unknown>,
): Supplier {
  return {
    id,
    name: str(data.name) || "Unnamed supplier",
    tin: str(data.tin),
    address: str(data.address),
    supplierType: str(data.supplierType),
    contactNo: str(data.contactNo),
    status: data.status === "inactive" ? "inactive" : "active",
  };
}

export function mapSupplierInvoice(
  supplierId: string,
  id: string,
  data: Record<string, unknown>,
): SupplierInvoice {
  const total = roundMoney(Number(data.totalIncludingVat) || 0);
  const outstandingRaw = Number(data.outstandingAmount);
  const outstanding = Number.isFinite(outstandingRaw)
    ? roundMoney(Math.max(0, outstandingRaw))
    : total;
  const status = (
    ["issued", "partial", "paid"].includes(str(data.status))
      ? data.status
      : "issued"
  ) as SupplierInvoiceStatus;
  const lines = Array.isArray(data.lineItems) ? data.lineItems : [];

  return {
    id,
    supplierId,
    taxInvoiceNo: str(data.taxInvoiceNo),
    date: toDate(data.date) ?? new Date(0),
    totalIncludingVat: total,
    billAmount: roundMoney(Number(data.billAmount) || 0),
    vatAmount: roundMoney(Number(data.vatAmount) || 0),
    lineItems: lines.map((line, index) => {
      const item = (line ?? {}) as Record<string, unknown>;
      return {
        id: str(item.id) || `line-${index}`,
        description: str(item.description),
        quantity: Number(item.quantity) || 0,
      };
    }),
    outstandingAmount: outstanding,
    status,
  };
}

export function supplierInvoiceStatus(
  total: number,
  outstanding: number,
): SupplierInvoiceStatus {
  if (roundMoney(total) > 0 && roundMoney(outstanding) <= 0) return "paid";
  if (roundMoney(outstanding) < roundMoney(total)) return "partial";
  return "issued";
}

export const SUPPLIER_INVOICE_STATUS_META: Record<
  SupplierInvoiceStatus,
  { label: string; variant: "brand" | "warning" | "success" }
> = {
  issued: { label: "Unpaid", variant: "brand" },
  partial: { label: "Partly paid", variant: "warning" },
  paid: { label: "Paid", variant: "success" },
};
