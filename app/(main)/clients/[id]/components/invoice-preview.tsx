import type { ReactNode } from "react";
import type {
  ClientSnapshot,
  DeliveryDetails,
  InvoiceLineItem,
  InvoiceStatus,
  InvoiceTemplate,
  TemplateColumn,
} from "../invoice-model";
import {
  amountInWords,
  calculateInvoiceTotals,
  orderedTemplateColumns,
} from "../invoice-model";

type InvoicePreviewProps = {
  template: InvoiceTemplate;
  client: ClientSnapshot;
  taxInvoiceNo?: string;
  invoiceDate?: Date;
  delivery?: DeliveryDetails;
  lineItems?: InvoiceLineItem[];
  /** Sum of line amounts (total value of supply, before VAT). */
  totalAmount?: number;
  status?: InvoiceStatus;
  preview?: boolean;
  /** Adds a top gap used only while exporting PDF. */
  exportTopGap?: boolean;
};

function formatAmount(value: number) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(value?: Date) {
  if (!value || Number.isNaN(value.getTime()) || value.getTime() === 0) {
    return "—";
  }
  return value.toLocaleDateString();
}

function displayCustomValue(
  column: TemplateColumn,
  value: string | number | undefined,
) {
  if (value === undefined || value === "") return "—";
  if (column.type === "decimal" && typeof value === "number") {
    return formatAmount(value);
  }
  if (column.type === "date") {
    const date = new Date(String(value));
    return Number.isNaN(date.getTime())
      ? String(value)
      : date.toLocaleDateString();
  }
  return String(value);
}

function displayCell(
  column: TemplateColumn,
  item: InvoiceLineItem,
  rowIndex: number,
) {
  switch (column.key) {
    case "no":
      return rowIndex + 1;
    case "date":
      return formatDate(item.date);
    case "vehicleNo":
      return item.vehicleNo || "—";
    case "rate":
      return formatAmount(item.rate);
    case "amount":
      return formatAmount(item.amount);
    default:
      return displayCustomValue(column, item.customValues[column.key]);
  }
}

function InvoiceBox({
  children,
  className = "",
  title,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <div className={`border border-zinc-800 ${className}`}>
      {title ? (
        <div className="border-b border-zinc-800 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider">
          {title}
        </div>
      ) : null}
      <div className="px-2 py-1.5">{children}</div>
    </div>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="grid grid-cols-[auto_1fr] gap-x-2 text-[11px] leading-relaxed">
      <span className="text-zinc-600">{label}:</span>
      <span className="whitespace-pre-wrap">{value || "—"}</span>
    </div>
  );
}

export default function InvoicePreview({
  template,
  client,
  taxInvoiceNo,
  invoiceDate,
  delivery,
  lineItems = [],
  totalAmount = 0,
  status,
  preview = false,
  exportTopGap = false,
}: InvoicePreviewProps) {
  const columns = orderedTemplateColumns(template.columns);
  const rows =
    preview && lineItems.length === 0 ? [null, null, null, null, null] : lineItems;
  const totals = calculateInvoiceTotals(totalAmount);

  return (
    <div className="mx-auto w-full max-w-[210mm]">
      {/* A4 page */}
      <div
        data-invoice-paper
        className="font-mono bg-white text-zinc-900 shadow-sm border border-zinc-200"
        style={{
          minHeight: "297mm",
          padding: "14mm 16mm",
        }}
      >
        {exportTopGap ? (
          <div
            aria-hidden
            style={{ height: "calc(297mm / 8)" }}
            className="shrink-0"
          />
        ) : null}

        <div className="mb-3 px-2 py-2">
          <h1 className="text-center text-base font-bold tracking-wide uppercase">
            Tax Invoice
          </h1>
        </div>

        <div className="mb-3 grid grid-cols-2 gap-3">
          <InvoiceBox>
            <DetailRow
              label="Date of Invoice"
              value={formatDate(invoiceDate)}
            />
          </InvoiceBox>
          <InvoiceBox>
            <DetailRow label="Tax Invoice No" value={taxInvoiceNo || "—"} />
          </InvoiceBox>
        </div>

        <div className="mb-3 grid grid-cols-2 gap-3">
          <InvoiceBox>
            <div className="space-y-0.5">
              <DetailRow
                label="Supplier's TIN"
                value={template.supplier.vatNo}
              />
              <div className="grid grid-cols-[auto_1fr] gap-x-2 text-[11px] leading-relaxed">
                <span className="text-zinc-600">Supplier&apos;s Name:</span>
                <div>
                  <span>{template.supplier.name || "—"}</span>
                  {template.supplier.address?.trim() ? (
                    <p className="whitespace-pre-wrap">
                      {template.supplier.address}
                    </p>
                  ) : null}
                </div>
              </div>
              <DetailRow
                label="Telephone No"
                value={template.supplier.contactNo}
              />
            </div>
          </InvoiceBox>
          <InvoiceBox>
            <div className="space-y-0.5">
              <DetailRow label="VAT No" value={client.vatNo} />
              <DetailRow label="Purchaser's Name" value={client.name} />
              <DetailRow label="Address" value={client.address} />
            </div>
          </InvoiceBox>
        </div>

        <div className="mb-3 grid grid-cols-2 gap-3">
          <InvoiceBox>
            <DetailRow
              label="Date of Delivery"
              value={formatDate(delivery?.date)}
            />
          </InvoiceBox>
          <InvoiceBox>
            <DetailRow
              label="Place of Supply"
              value={delivery?.address || ""}
            />
          </InvoiceBox>
          {preview || delivery?.reference?.trim() ? (
            <InvoiceBox className="col-span-2">
              <DetailRow
                label="Additional information if any"
                value={delivery?.reference || ""}
              />
            </InvoiceBox>
          ) : null}
        </div>

        <div className="mt-8 mb-6 overflow-x-auto">
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr className="border-y border-zinc-800">
                {columns.map((column) => (
                  <th
                    key={column.id}
                    className="px-1.5 py-2 text-left font-semibold"
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((item, rowIndex) => (
                <tr
                  key={item ? `${item.no}-${rowIndex}` : `empty-${rowIndex}`}
                  className="border-b border-zinc-200"
                >
                  {columns.map((column) => (
                    <td key={column.id} className="px-1.5 py-1.5 align-top">
                      {item ? displayCell(column, item, rowIndex) : "\u00A0"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mb-6 w-full space-y-1.5 text-[11px]">
          <div className="flex justify-between gap-4 border-b border-zinc-200 py-1">
            <span>Total Value of Supply</span>
            <span className="tabular-nums">
              {formatAmount(totals.supplyValue)}
            </span>
          </div>
          <div className="flex justify-between gap-4 border-b border-zinc-200 py-1">
            <span>VAT Amount (Total value of supply @ 18%)</span>
            <span className="tabular-nums">
              {formatAmount(totals.vatAmount)}
            </span>
          </div>
          <div className="flex justify-between gap-4 border-b border-zinc-800 py-1.5 font-semibold">
            <span>Total amount including VAT</span>
            <span className="tabular-nums">
              {formatAmount(totals.totalIncludingVat)}
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <p className="text-zinc-600">Total amount in words</p>
            <p className="font-medium leading-snug">
              {amountInWords(totals.totalIncludingVat)}
            </p>
          </div>
        </div>

        <p className="mb-10 text-[11px] leading-relaxed text-zinc-700">
          Please make an arrangement to pay the above mentioned bill amount.
          <br />
          Cheques should be drawn in favour &quot;D.M.K TRANSPORT (PVT) LTD&quot;
          <br />
          <br />
          Thanking you
          <br />
          Your faithfull
        </p>

        <div className="mt-auto grid grid-cols-2 gap-12 pt-16">
          <div className="border-t border-zinc-800 pt-2 text-center text-[11px]">
            <p className="min-h-5 font-medium">
              {template.signing.leftName || "\u00A0"}
            </p>
            <p className="text-zinc-600">
              {template.signing.leftLabel || "Prepared by"}
            </p>
          </div>
          <div className="border-t border-zinc-800 pt-2 text-center text-[11px]">
            <p className="min-h-5 font-medium">
              {template.signing.rightName || "\u00A0"}
            </p>
            <p className="text-zinc-600">
              {template.signing.rightLabel || "Authorized by"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
