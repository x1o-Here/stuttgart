"use client";

import { useEffect, useState } from "react";
import { Download, FileSpreadsheet, FileText, Printer } from "lucide-react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type ExportAccountSummaryRow = {
  name: string;
  debits: number;
  credits: number;
  net: number;
};

export type ExportTransactionRow = {
  date: Date;
  accountName: string;
  description: string;
  department?: string;
  vehicle?: string;
  voucher?: number;
  type: "debit" | "credit";
  amount: number;
};

type ExportReportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportName: string;
  periodLabel: string;
  fromDate?: Date;
  toDate?: Date;
  accountNames: string[];
  accountSummaries: ExportAccountSummaryRow[];
  transactions: ExportTransactionRow[];
};

function escapeCsvValue(value: string | number) {
  const text = String(value ?? "");
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function formatCsvDate(value: Date | string | number | undefined | null) {
  if (value == null || value === "") return "";

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  // Quoted ISO date so Excel keeps a valid date value (not ##### / invalid)
  return `"${year}-${month}-${day}"`;
}

function csvLine(values: Array<string | number>) {
  return values
    .map((value) => {
      // Already quoted by formatCsvDate
      if (typeof value === "string" && value.startsWith('"') && value.endsWith('"')) {
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

function buildCsv({
  reportName,
  fromDate,
  toDate,
  periodLabel,
  accountNames,
  accountSummaries,
  transactions,
  includeAccounts,
  includeTransactions,
}: {
  reportName: string;
  fromDate?: Date;
  toDate?: Date;
  periodLabel: string;
  accountNames: string[];
  accountSummaries: ExportAccountSummaryRow[];
  transactions: ExportTransactionRow[];
  includeAccounts: boolean;
  includeTransactions: boolean;
}) {
  const periodValue =
    fromDate && toDate
      ? `${formatCsvDate(fromDate).replaceAll('"', "")} - ${formatCsvDate(toDate).replaceAll('"', "")}`
      : periodLabel;

  const lines: string[] = [
    csvLine(["Report Name", reportName]),
    csvLine(["Period", periodValue]),
    csvLine(["Selected Accounts", accountNames.join("; ") || "-"]),
    "",
  ];

  if (includeAccounts) {
    lines.push(csvLine(["Account Summary"]));
    lines.push(csvLine(["Account", "Debits", "Credits", "Net"]));
    accountSummaries.forEach((row) => {
      lines.push(
        csvLine([
          row.name,
          row.debits > 0 ? -row.debits : 0,
          row.credits > 0 ? row.credits : 0,
          row.net,
        ]),
      );
    });
    lines.push("");
  }

  if (includeTransactions) {
    lines.push(csvLine(["Transaction Summary"]));
    lines.push(
      csvLine([
        "Date",
        "Account",
        "Description",
        "Dept",
        "Vehicle",
        "Voucher",
        "Type",
        "Amount",
      ]),
    );
    transactions.forEach((tx) => {
      lines.push(
        csvLine([
          formatCsvDate(tx.date),
          tx.accountName,
          tx.description || "",
          tx.department || "",
          tx.vehicle || "",
          tx.voucher ?? "",
          tx.type,
          tx.type === "debit" ? -tx.amount : tx.amount,
        ]),
      );
    });
  }

  // BOM helps Excel open UTF-8 CSV and parse dates correctly
  return `\uFEFF${lines.join("\r\n")}`;
}

function formatDisplayDate(value: Date | string | number | undefined | null) {
  if (value == null || value === "") return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildPdf({
  reportName,
  periodLabel,
  fromDate,
  toDate,
  accountNames,
  accountSummaries,
  transactions,
  includeAccounts,
  includeTransactions,
}: {
  reportName: string;
  periodLabel: string;
  fromDate?: Date;
  toDate?: Date;
  accountNames: string[];
  accountSummaries: ExportAccountSummaryRow[];
  transactions: ExportTransactionRow[];
  includeAccounts: boolean;
  includeTransactions: boolean;
}) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  let cursorY = 18;

  const periodValue =
    fromDate && toDate
      ? `${formatDisplayDate(fromDate)} - ${formatDisplayDate(toDate)}`
      : periodLabel;

  doc.setProperties({ title: reportName });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(reportName, margin, cursorY);
  cursorY += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(70);
  doc.text(`Period: ${periodValue}`, margin, cursorY);
  cursorY += 5;

  const accountLine = doc.splitTextToSize(
    `Selected Accounts: ${accountNames.join(", ") || "-"}`,
    pageWidth - margin * 2,
  );
  doc.text(accountLine, margin, cursorY);
  cursorY += accountLine.length * 5 + 4;
  doc.setTextColor(0);

  if (includeAccounts) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Account Summary", margin, cursorY);
    cursorY += 2;

    autoTable(doc, {
      startY: cursorY,
      head: [["Account", "Debits", "Credits", "Net"]],
      body: accountSummaries.length
        ? accountSummaries.map((row) => [
            row.name,
            row.debits > 0 ? `-${row.debits.toLocaleString()}` : "0",
            row.credits > 0 ? `+${row.credits.toLocaleString()}` : "0",
            row.net.toLocaleString(),
          ])
        : [["No accounts", "-", "-", "-"]],
      styles: { fontSize: 9, cellPadding: 2.5 },
      headStyles: { fillColor: [39, 39, 42], textColor: 255 },
      columnStyles: {
        1: { halign: "right" },
        2: { halign: "right" },
        3: { halign: "right" },
      },
      margin: { left: margin, right: margin },
    });

    cursorY =
      ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
        ?.finalY ?? cursorY) + 10;
  }

  if (includeTransactions) {
    if (cursorY > doc.internal.pageSize.getHeight() - 40) {
      doc.addPage();
      cursorY = 18;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Transaction Summary", margin, cursorY);
    cursorY += 2;

    autoTable(doc, {
      startY: cursorY,
      head: [[
        "Date",
        "Account",
        "Description",
        "Dept",
        "Vehicle",
        "Voucher",
        "Type",
        "Amount",
      ]],
      body: transactions.length
        ? transactions.map((tx) => [
            formatDisplayDate(tx.date),
            tx.accountName,
            tx.description || "-",
            tx.department || "-",
            tx.vehicle || "-",
            tx.voucher ? String(tx.voucher) : "-",
            tx.type,
            `${tx.type === "debit" ? "-" : "+"}${tx.amount.toLocaleString()}`,
          ])
        : [["No transactions", "-", "-", "-", "-", "-", "-", "-"]],
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [39, 39, 42], textColor: 255 },
      columnStyles: {
        7: { halign: "right" },
      },
      margin: { left: margin, right: margin },
    });
  }

  return doc;
}

export default function ExportReportDialog({
  open,
  onOpenChange,
  reportName,
  periodLabel,
  fromDate,
  toDate,
  accountNames,
  accountSummaries,
  transactions,
}: ExportReportDialogProps) {
  const [includeAccounts, setIncludeAccounts] = useState(true);
  const [includeTransactions, setIncludeTransactions] = useState(true);

  useEffect(() => {
    if (!open) return;
    setIncludeAccounts(true);
    setIncludeTransactions(true);
  }, [open]);

  const canExport = includeAccounts || includeTransactions;
  const safeName = reportName.replace(/[^\w\-]+/g, "_").toLowerCase() || "report";

  const exportPayload = {
    reportName,
    periodLabel,
    fromDate,
    toDate,
    accountNames,
    accountSummaries,
    transactions,
    includeAccounts,
    includeTransactions,
  };

  function handleDownloadCsv() {
    if (!canExport) return;
    downloadBlob(`${safeName}.csv`, buildCsv(exportPayload), "text/csv;charset=utf-8;");
    onOpenChange(false);
  }

  function handleDownloadPdf() {
    if (!canExport) return;
    const pdf = buildPdf(exportPayload);
    pdf.save(`${safeName}.pdf`);
    onOpenChange(false);
  }

  function handlePrint() {
    if (!canExport) return;
    const pdf = buildPdf(exportPayload);
    pdf.autoPrint();
    window.open(pdf.output("bloburl"), "_blank", "noopener,noreferrer");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Export report
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-3">
            <p className="text-sm font-medium text-zinc-700">Include in export</p>
            <label className="flex items-center gap-3 cursor-pointer">
              <Checkbox
                checked={includeAccounts}
                onCheckedChange={(checked) => {
                  const next = checked === true;
                  if (!next && !includeTransactions) return;
                  setIncludeAccounts(next);
                }}
              />
              <span className="text-sm text-zinc-700">Account summary</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <Checkbox
                checked={includeTransactions}
                onCheckedChange={(checked) => {
                  const next = checked === true;
                  if (!next && !includeAccounts) return;
                  setIncludeTransactions(next);
                }}
              />
              <span className="text-sm text-zinc-700">Transaction summary</span>
            </label>
            {!canExport ? (
              <p className="text-xs text-red-500">Select at least one option</p>
            ) : null}
          </div>

          <div className="grid gap-2">
            <Button
              type="button"
              variant="outline"
              className="justify-start h-11"
              disabled={!canExport}
              onClick={handleDownloadPdf}
            >
              <FileText className="mr-2 h-4 w-4" />
              Download PDF
            </Button>
            <Button
              type="button"
              variant="outline"
              className="justify-start h-11"
              disabled={!canExport}
              onClick={handleDownloadCsv}
            >
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Download CSV
            </Button>
            <Button
              type="button"
              variant="outline"
              className="justify-start h-11"
              disabled={!canExport}
              onClick={handlePrint}
            >
              <Printer className="mr-2 h-4 w-4" />
              Print
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
