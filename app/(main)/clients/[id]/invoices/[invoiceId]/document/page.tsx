"use client";

import { doc, onSnapshot } from "firebase/firestore";
import { ChevronLeft, Download, Printer } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { LoadingState } from "@/components/shared/loading-state";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase/firebase-client";
import InvoicePreview from "../../../components/invoice-preview";
import {
  type ClientInvoiceDocument,
  mapClientInvoiceDocument,
} from "../../../invoice-model";

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
  const router = useRouter();
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

  async function buildInvoicePdf() {
    const paper = previewRef.current?.querySelector(
      "[data-invoice-paper]",
    ) as HTMLElement | null;
    if (!paper) {
      throw new Error("Could not find the invoice page to export.");
    }

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

    try {
      setExportError("");
      setBusyAction(action);
      flushSync(() => {
        setExporting(true);
      });
      await waitForNextPaint();

      const pdf = await buildInvoicePdf();
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
      setExporting(false);
      setBusyAction(null);
    }
  }

  return (
    <div className="min-h-screen h-full p-4 font-sans">
      <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col gap-4 rounded-lg bg-zinc-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button
            size="sm"
            variant="ghost"
            className="w-fit px-1"
            onClick={() =>
              router.push(
                clientId && invoiceId
                  ? `/clients/${clientId}/invoices/${invoiceId}`
                  : clientId
                    ? `/clients/${clientId}`
                    : "/clients",
              )
            }
          >
            <ChevronLeft />
            Back
          </Button>
          {!loading && invoice && clientId ? (
            <div className="flex flex-wrap items-center gap-2">
              {exportError ? (
                <p className="text-sm text-destructive">{exportError}</p>
              ) : null}
              <Button
                variant="outline"
                disabled={exporting}
                onClick={() => void handlePdfAction("download")}
              >
                <Download className="mr-2 h-4 w-4" />
                {busyAction === "download" ? "Downloading..." : "Download PDF"}
              </Button>
              <Button
                variant="outline"
                disabled={exporting}
                onClick={() => void handlePdfAction("print")}
              >
                <Printer className="mr-2 h-4 w-4" />
                {busyAction === "print" ? "Preparing..." : "Print PDF"}
              </Button>
              <Button asChild variant="outline">
                <Link href={`/clients/${clientId}/invoices/${invoice.id}`}>
                  Details
                </Link>
              </Button>
            </div>
          ) : null}
        </div>

        {loading ? (
          <LoadingState
            message="Loading tax invoice..."
            variant="skeleton"
            rows={8}
          />
        ) : notFound || !invoice ? (
          <div className="rounded-lg bg-white p-6">
            <h1 className="text-xl font-semibold">Invoice not found</h1>
          </div>
        ) : (
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
        )}
      </div>
    </div>
  );
}
