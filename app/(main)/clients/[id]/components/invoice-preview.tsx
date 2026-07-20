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
  /** Adds a ~1/10 page-height top gap (used only while exporting PDF). */
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
            style={{ height: "calc(297mm / 10)" }}
            className="shrink-0"
          />
        ) : null}

        <h1 className="mb-6 text-center text-base font-bold tracking-wide uppercase">
          Tax Invoice
        </h1>

        {/* Header: invoice date + supplier | client */}
        <div className="mb-5 grid grid-cols-2 gap-8 border-b border-zinc-300 pb-4">
          <div className="space-y-3">
            <DetailRow label="Date of Invoice" value={formatDate(invoiceDate)} />
            <div className="space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                Supplier Details
              </p>
              <DetailRow
                label="Supplier's TIN"
                value={template.supplier.vatNo}
              />
              <DetailRow
                label="Supplier's Name"
                value={template.supplier.name}
              />
              <DetailRow
                label="Address"
                value={template.supplier.address}
              />
              <DetailRow
                label="Telephone No"
                value={template.supplier.contactNo}
              />
            </div>
          </div>

          <div className="space-y-3">
            <DetailRow label="Tax Invoice No" value={taxInvoiceNo || "—"} />
            <div className="space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                Client Details
              </p>
              <DetailRow label="VAT No" value={client.vatNo} />
              <DetailRow label="Purchaser's Name" value={client.name} />
              <DetailRow label="Address" value={client.address} />
            </div>
          </div>
        </div>

        {/* Delivery */}
        <div className="mb-5 space-y-2 border-b border-zinc-300 pb-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Delivery Details
          </p>
          <div className="grid grid-cols-2 gap-8">
            <DetailRow
              label="Date of Delivery"
              value={formatDate(delivery?.date)}
            />
            <DetailRow
              label="Place of Supply"
              value={delivery?.address || ""}
            />
          </div>
          <DetailRow
            label="Additional information if any"
            value={delivery?.reference || ""}
          />
        </div>

        {/* Cost table */}
        <div className="mb-5 overflow-x-auto">
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

        {/* Totals */}
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
          Please make an arrangement to pay the above mentioned bill amount.<br />
          Cheques should be drawn in favour "D.M.K TRANSPORT (PVT) LTD"<br />
          <br />
          Thanking you<br />
          Your faithfull
        </p>

        {/* Signatures */}
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
