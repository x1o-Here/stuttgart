"use client";

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { FileSpreadsheet, FileText, Printer } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ClientAnalyticsPayload } from "./client-analytics-types";

type ExportClientAnalyticsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payload: ClientAnalyticsPayload;
};

function escapeCsvValue(value: string | number) {
  const text = String(value ?? "");
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function formatCsvDate(value: Date) {
  if (!value.getTime()) return "";
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `"${year}-${month}-${day}"`;
}

function csvLine(values: Array<string | number>) {
  return values
    .map((value) => {
      if (
        typeof value === "string" &&
        value.startsWith('"') &&
        value.endsWith('"')
      ) {
        return value;
      }
      return escapeCsvValue(value);
    })
    .join(",");
}

function downloadBlob(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function money(value: number) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function buildCsv(payload: ClientAnalyticsPayload, options: {
  includeSummary: boolean;
  includeInvoices: boolean;
  includePayments: boolean;
}) {
  const lines: string[] = [];
  lines.push(csvLine(["Client Analytics", payload.clientName]));
  lines.push(csvLine(["Generated", new Date().toISOString()]));
  lines.push("");

  if (options.includeSummary) {
    lines.push(csvLine(["Summary"]));
    lines.push(csvLine(["Metric", "Value"]));
    lines.push(csvLine(["Total billed", payload.summary.totalBilled]));
    lines.push(csvLine(["Total collected", payload.summary.totalCollected]));
    lines.push(csvLine(["Outstanding", payload.summary.totalOutstanding]));
    lines.push(csvLine(["Active invoices", payload.summary.activeInvoices]));
    lines.push(csvLine(["Paid invoices", payload.summary.paidInvoices]));
    lines.push(csvLine(["Overdue invoices", payload.summary.overdueInvoices]));
    lines.push(csvLine(["VAT billed", payload.summary.vatBilled]));
    lines.push("");
  }

  if (options.includeInvoices) {
    lines.push(csvLine(["Invoices"]));
    lines.push(
      csvLine([
        "Date",
        "Tax Invoice No",
        "Status",
        "Total Incl. VAT",
        "Outstanding",
        "Collected",
      ]),
    );
    for (const invoice of payload.invoices) {
      lines.push(
        csvLine([
          formatCsvDate(invoice.date),
          invoice.taxInvoiceNo,
          invoice.status,
          invoice.totalIncludingVat,
          invoice.outstandingAmount,
          invoice.collectedAmount,
        ]),
      );
    }
    lines.push("");
  }

  if (options.includePayments) {
    lines.push(csvLine(["Payments"]));
    lines.push(
      csvLine([
        "Date",
        "Invoice No",
        "Description",
        "Amount",
        "Crediting Account",
      ]),
    );
    for (const payment of payload.payments) {
      lines.push(
        csvLine([
          formatCsvDate(payment.date),
          payment.invoiceNo,
          payment.description,
          payment.amount,
          payment.creditingAccountName,
        ]),
      );
    }
  }

  return `\uFEFF${lines.join("\n")}`;
}

function buildPdf(payload: ClientAnalyticsPayload, options: {
  includeSummary: boolean;
  includeInvoices: boolean;
  includePayments: boolean;
}) {
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  let cursorY = 14;

  pdf.setFontSize(16);
  pdf.text(`Client Analytics — ${payload.clientName}`, 14, cursorY);
  cursorY += 8;
  pdf.setFontSize(10);
  pdf.setTextColor(100);
  pdf.text(`Generated ${new Date().toLocaleString()}`, 14, cursorY);
  pdf.setTextColor(0);
  cursorY += 8;

  if (options.includeSummary) {
    autoTable(pdf, {
      startY: cursorY,
      head: [["Metric", "Value"]],
      body: [
        ["Total billed", money(payload.summary.totalBilled)],
        ["Total collected", money(payload.summary.totalCollected)],
        ["Outstanding", money(payload.summary.totalOutstanding)],
        ["Active invoices", String(payload.summary.activeInvoices)],
        ["Paid invoices", String(payload.summary.paidInvoices)],
        ["Overdue invoices", String(payload.summary.overdueInvoices)],
        ["VAT billed", money(payload.summary.vatBilled)],
      ],
      styles: { fontSize: 9 },
    });
    cursorY = (pdf as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable
      .finalY + 8;
  }

  if (options.includeInvoices) {
    if (cursorY > 250) {
      pdf.addPage();
      cursorY = 14;
    }
    pdf.setFontSize(12);
    pdf.text("Invoices", 14, cursorY);
    cursorY += 4;
    autoTable(pdf, {
      startY: cursorY,
      head: [["Date", "Invoice No", "Status", "Total", "Outstanding"]],
      body: payload.invoices.map((invoice) => [
        invoice.date.getTime() ? invoice.date.toLocaleDateString() : "—",
        invoice.taxInvoiceNo,
        invoice.status,
        money(invoice.totalIncludingVat),
        money(invoice.outstandingAmount),
      ]),
      styles: { fontSize: 8 },
    });
    cursorY = (pdf as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable
      .finalY + 8;
  }

  if (options.includePayments) {
    if (cursorY > 250) {
      pdf.addPage();
      cursorY = 14;
    }
    pdf.setFontSize(12);
    pdf.text("Payments", 14, cursorY);
    cursorY += 4;
    autoTable(pdf, {
      startY: cursorY,
      head: [["Date", "Invoice No", "Description", "Amount", "Account"]],
      body: payload.payments.map((payment) => [
        payment.date.getTime() ? payment.date.toLocaleDateString() : "—",
        payment.invoiceNo,
        payment.description,
        money(payment.amount),
        payment.creditingAccountName,
      ]),
      styles: { fontSize: 8 },
    });
  }

  return pdf;
}

export default function ExportClientAnalyticsDialog({
  open,
  onOpenChange,
  payload,
}: ExportClientAnalyticsDialogProps) {
  const [includeSummary, setIncludeSummary] = useState(true);
  const [includeInvoices, setIncludeInvoices] = useState(true);
  const [includePayments, setIncludePayments] = useState(true);

  const canExport = includeSummary || includeInvoices || includePayments;
  const safeName = payload.clientName.replace(/[^\w.-]+/g, "_").slice(0, 60);

  function handleDownloadCsv() {
    if (!canExport) return;
    downloadBlob(
      `${safeName}-analytics.csv`,
      buildCsv(payload, { includeSummary, includeInvoices, includePayments }),
      "text/csv;charset=utf-8;",
    );
    onOpenChange(false);
  }

  function handleDownloadPdf() {
    if (!canExport) return;
    buildPdf(payload, { includeSummary, includeInvoices, includePayments }).save(
      `${safeName}-analytics.pdf`,
    );
    onOpenChange(false);
  }

  function handlePrint() {
    if (!canExport) return;
    const pdf = buildPdf(payload, {
      includeSummary,
      includeInvoices,
      includePayments,
    });
    pdf.autoPrint();
    window.open(pdf.output("bloburl"), "_blank", "noopener,noreferrer");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export analytics</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <p className="text-sm text-muted-foreground">
            Choose what to include for {payload.clientName}.
          </p>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={includeSummary}
              onCheckedChange={(checked) => setIncludeSummary(checked === true)}
            />
            Summary metrics
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={includeInvoices}
              onCheckedChange={(checked) => setIncludeInvoices(checked === true)}
            />
            Invoice list
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={includePayments}
              onCheckedChange={(checked) => setIncludePayments(checked === true)}
            />
            Payment list
          </label>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button disabled={!canExport} onClick={handleDownloadPdf}>
            <FileText className="mr-2 h-4 w-4" />
            Download PDF
          </Button>
          <Button
            variant="outline"
            disabled={!canExport}
            onClick={handleDownloadCsv}
          >
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Download CSV
          </Button>
          <Button variant="outline" disabled={!canExport} onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
