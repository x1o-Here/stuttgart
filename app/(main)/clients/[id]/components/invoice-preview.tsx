import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  ClientSnapshot,
  DeliveryDetails,
  InvoiceLineItem,
  InvoiceStatus,
  InvoiceTemplate,
  TemplateColumn,
} from "../invoice-model";

type InvoicePreviewProps = {
  template: InvoiceTemplate;
  client: ClientSnapshot;
  taxInvoiceNo?: string;
  invoiceDate?: Date;
  delivery?: DeliveryDetails;
  lineItems?: InvoiceLineItem[];
  totalAmount?: number;
  status?: InvoiceStatus;
  preview?: boolean;
};

function formatAmount(value: number) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
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
      return item.date.toLocaleDateString();
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
}: InvoicePreviewProps) {
  const rows =
    preview && lineItems.length === 0 ? [null, null, null] : lineItems;

  return (
    <div className="rounded-lg border bg-white p-6 shadow-sm space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Supplier
          </p>
          <h2 className="text-xl font-bold">
            {template.supplier.name || "Supplier name"}
          </h2>
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">
            {template.supplier.address || "Supplier address"}
          </p>
          <p className="text-sm">
            VAT: {template.supplier.vatNo || "—"} · Contact:{" "}
            {template.supplier.contactNo || "—"}
          </p>
        </div>

        <div className="min-w-56 space-y-1 text-sm">
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Tax invoice no</span>
            <span className="font-medium">
              {taxInvoiceNo || "Generated on invoice"}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Invoice date</span>
            <span className="font-medium">
              {invoiceDate
                ? invoiceDate.toLocaleDateString()
                : "Selected on invoice"}
            </span>
          </div>
          {status ? (
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Status</span>
              <Badge variant={status === "paid" ? "default" : "secondary"}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </Badge>
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-md bg-muted/40 p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Client information
          </p>
          <p className="font-semibold">{client.name || "Client name"}</p>
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">
            {client.address || "Client address"}
          </p>
          <p className="mt-2 text-sm">
            VAT: {client.vatNo || "—"} · Contact: {client.contactNo || "—"}
          </p>
        </section>

        <section className="rounded-md bg-muted/40 p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Delivery details
          </p>
          <p className="text-sm">
            Date:{" "}
            {delivery?.date
              ? delivery.date.toLocaleDateString()
              : "Selected on invoice"}
          </p>
          <p className="text-sm">
            Reference: {delivery?.reference || "Entered on invoice"}
          </p>
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">
            {delivery?.address || "Delivery address entered on invoice"}
          </p>
        </section>
      </div>

      <div className="overflow-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {template.columns.map((column) => (
                <TableHead key={column.id}>{column.label}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((item, rowIndex) => (
              <TableRow key={item ? `${item.no}-${rowIndex}` : rowIndex}>
                {template.columns.map((column) => (
                  <TableCell key={column.id}>
                    {item ? displayCell(column, item, rowIndex) : "—"}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-end">
        <div className="flex min-w-64 items-center justify-between rounded-md bg-muted/40 px-4 py-3">
          <span className="font-semibold">Total amount</span>
          <span className="text-lg font-bold">{formatAmount(totalAmount)}</span>
        </div>
      </div>

      <div className="grid gap-8 pt-10 sm:grid-cols-2">
        <div className="border-t pt-2 text-center">
          <p className="font-medium">
            {template.signing.leftName || "Signature"}
          </p>
          <p className="text-sm text-muted-foreground">
            {template.signing.leftLabel}
          </p>
        </div>
        <div className="border-t pt-2 text-center">
          <p className="font-medium">
            {template.signing.rightName || "Signature"}
          </p>
          <p className="text-sm text-muted-foreground">
            {template.signing.rightLabel}
          </p>
        </div>
      </div>
    </div>
  );
}
