"use client";

import { doc, onSnapshot } from "firebase/firestore";
import { Download, Printer } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { LoadingState } from "@/components/shared/loading-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase/firebase-client";
import InvoicePreview from "../../../components/invoice-preview";
import {
  type ClientInvoiceDocument,
  mapClientInvoiceDocument,
} from "../../../invoice-model";
import {
  applyExportPageBreaks,
  clearExportPageBreaks,
} from "./export-page-breaks";

type PdfAction = "download" | "print";

function waitForNextPaint() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

export default function InvoiceDocumentPage() {
  const params = useParams();
  const { activeCompany } = useAuth();
  const clientId = typeof params.id === "string" ? params.id : undefined;
  const invoiceId =
    typeof params.invoiceId === "string" ? params.invoiceId : undefined;
  const previewRef = useRef<HTMLDivElement>(null);
  const [invoice, setInvoice] = useState<ClientInvoiceDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [busyAction, setBusyAction] = useState<PdfAction | null>(null);
  const [exportError, setExportError] = useState("");

  useEffect(() => {
    if (!activeCompany || !clientId || !invoiceId) return;

    setLoading(true);
    return onSnapshot(
      doc(
        db,
        "companies",
        activeCompany,
        "clients",
        clientId,
        "invoices",
        invoiceId,
      ),
      (snapshot) => {
        if (!snapshot.exists() || snapshot.data().entityStatus === false) {
          setInvoice(null);
          setNotFound(true);
        } else {
          setInvoice(
            mapClientInvoiceDocument(
              snapshot.id,
              snapshot.data() as Record<string, unknown>,
            ),
          );
          setNotFound(false);
        }
        setLoading(false);
      },
      (error) => {
        console.error("Failed to fetch invoice document:", error);
        setNotFound(true);
        setLoading(false);
      },
    );
  }, [activeCompany, clientId, invoiceId]);

  async function buildInvoicePdf(paper: HTMLElement) {
    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
      import("html2canvas-pro"),
      import("jspdf"),
    ]);

    const canvas = await html2canvas(paper, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
      onclone: (_document, clonedElement) => {
        // html2canvas cannot parse lab()/oklch() from Tailwind v4; bake rgb values.
        const sourceNodes = [
          paper,
          ...Array.from(paper.querySelectorAll<HTMLElement>("*")),
        ];
        const clonedNodes = [
          clonedElement,
          ...Array.from(clonedElement.querySelectorAll<HTMLElement>("*")),
        ];

        for (let index = 0; index < clonedNodes.length; index += 1) {
          const source = sourceNodes[index];
          const clone = clonedNodes[index];
          if (!source || !clone) continue;

          const styles = window.getComputedStyle(source);
          clone.style.color = styles.color;
          clone.style.backgroundColor = styles.backgroundColor;
          clone.style.borderTopColor = styles.borderTopColor;
          clone.style.borderRightColor = styles.borderRightColor;
          clone.style.borderBottomColor = styles.borderBottomColor;
          clone.style.borderLeftColor = styles.borderLeftColor;
          clone.style.outlineColor = styles.outlineColor;
          clone.style.boxShadow = "none";
          clone.style.textShadow = "none";
        }
      },
    });

    const image = canvas.toDataURL("image/png");
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imageHeight = (canvas.height * pageWidth) / canvas.width;

    let heightLeft = imageHeight;
    let position = 0;
    pdf.addImage(image, "PNG", 0, position, pageWidth, imageHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position = heightLeft - imageHeight;
      pdf.addPage();
      pdf.addImage(image, "PNG", 0, position, pageWidth, imageHeight);
      heightLeft -= pageHeight;
    }

    return pdf;
  }

  async function handlePdfAction(action: PdfAction) {
    if (!invoice || !previewRef.current || exporting) return;

    let paper: HTMLElement | null = null;

    try {
      setExportError("");
      setBusyAction(action);
      flushSync(() => {
        setExporting(true);
      });
      await waitForNextPaint();

      paper = previewRef.current.querySelector(
        "[data-invoice-paper]",
      ) as HTMLElement | null;
      if (!paper) {
        throw new Error("Could not find the invoice page to export.");
      }

      applyExportPageBreaks(paper);
      await waitForNextPaint();

      const pdf = await buildInvoicePdf(paper);
      const safeName = (invoice.taxInvoiceNo || invoice.id)
        .replace(/[^\w.-]+/g, "_")
        .slice(0, 80);

      if (action === "download") {
        pdf.save(`tax-invoice-${safeName}.pdf`);
      } else {
        pdf.autoPrint();
        window.open(pdf.output("bloburl"), "_blank", "noopener,noreferrer");
      }
    } catch (error) {
      console.error(`Failed to ${action} invoice PDF`, error);
      setExportError(
        action === "download"
          ? "Failed to download the invoice PDF."
          : "Failed to open the print dialog for this invoice.",
      );
    } finally {
      if (paper) clearExportPageBreaks(paper);
      setExporting(false);
      setBusyAction(null);
    }
  }

  const backHref =
    clientId && invoiceId
      ? `/clients/${clientId}/invoices/${invoiceId}`
      : clientId
        ? `/clients/${clientId}`
        : "/clients";

  return (
    <div className="flex h-full flex-col divide-y overflow-y-auto bg-card font-sans">
      <PageHeader
        back={{
          href: backHref,
          label: invoice?.taxInvoiceNo
            ? `Invoice ${invoice.taxInvoiceNo}`
            : "Invoice details",
        }}
        eyebrow={"( Invoice details )"}
        lead="Tax invoice"
        title={invoice?.taxInvoiceNo || (loading ? "…" : "Not found")}
        description={invoice ? invoice.client.name : undefined}
        actions={
          !loading && invoice && clientId ? (
            <>
              {exportError ? (
                <p className="text-sm text-destructive">{exportError}</p>
              ) : null}
              <Button
                variant="outline"
                disabled={exporting}
                onClick={() => void handlePdfAction("print")}
              >
                <Printer />
                {busyAction === "print" ? "Preparing…" : "Print"}
              </Button>
              <Button
                disabled={exporting}
                onClick={() => void handlePdfAction("download")}
              >
                <Download />
                {busyAction === "download" ? "Downloading…" : "Download PDF"}
              </Button>
            </>
          ) : null
        }
      />

      <div className="flex-1 bg-canvas px-4 py-6 md:px-8 md:py-10">
        {loading ? (
          <div className="rounded-md border bg-card p-6">
            <LoadingState
              message="Loading tax invoice..."
              variant="skeleton"
              rows={8}
            />
          </div>
        ) : notFound || !invoice ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            This invoice doesn’t exist.
          </p>
        ) : (
          <div className="mx-auto w-fit max-w-full overflow-x-auto rounded-md border bg-white shadow-card">
            <div ref={previewRef}>
              <InvoicePreview
                template={invoice.template}
                client={invoice.client}
                taxInvoiceNo={invoice.taxInvoiceNo}
                invoiceDate={invoice.date}
                delivery={invoice.delivery}
                lineItems={invoice.lineItems}
                totalAmount={invoice.totalAmount}
                status={invoice.status}
                exportTopGap={exporting}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
