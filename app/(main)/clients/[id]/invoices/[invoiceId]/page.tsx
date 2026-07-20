"use client";

import { doc, onSnapshot } from "firebase/firestore";
import { ChevronLeft, FileText, Pencil } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LoadingState } from "@/components/shared/loading-state";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase/firebase-client";
import {
  type ClientInvoiceDocument,
  mapClientInvoiceDocument,
} from "../../invoice-model";
import DeleteInvoiceDialog from "./components/delete-invoice-dialog";
import InvoicePaymentsSection from "./components/invoice-payments-section";
import InvoiceSummaryCard from "./components/invoice-summary-card";

export default function ClientInvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { activeCompany } = useAuth();
  const clientId = typeof params.id === "string" ? params.id : undefined;
  const invoiceId =
    typeof params.invoiceId === "string" ? params.invoiceId : undefined;
  const [invoice, setInvoice] = useState<ClientInvoiceDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

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
        console.error("Failed to fetch invoice:", error);
        setNotFound(true);
        setLoading(false);
      },
    );
  }, [activeCompany, clientId, invoiceId]);

  const locked =
    invoice?.status === "paid" || invoice?.status === "cancelled";

  return (
    <div className="min-h-screen h-full p-4 font-sans">
      <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col gap-4 rounded-lg bg-zinc-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button
            size="sm"
            variant="ghost"
            className="w-fit px-1"
            onClick={() =>
              router.push(clientId ? `/clients/${clientId}` : "/clients")
            }
          >
            <ChevronLeft />
            Back
          </Button>

          {!loading && invoice && clientId ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                disabled={locked}
                onClick={() =>
                  router.push(
                    `/clients/${clientId}/invoices/${invoice.id}/edit`,
                  )
                }
              >
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Button>
              <DeleteInvoiceDialog
                clientId={clientId}
                invoiceId={invoice.id}
                taxInvoiceNo={invoice.taxInvoiceNo}
                disabled={locked}
              />
              <Button asChild>
                <Link
                  href={`/clients/${clientId}/invoices/${invoice.id}/document`}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Invoice
                </Link>
              </Button>
            </div>
          ) : null}
        </div>

        {loading ? (
          <LoadingState
            message="Loading invoice..."
            variant="skeleton"
            rows={6}
          />
        ) : notFound || !invoice || !clientId ? (
          <div className="rounded-lg bg-white p-6">
            <h1 className="text-xl font-semibold">Invoice not found</h1>
          </div>
        ) : (
          <>
            <InvoiceSummaryCard invoice={invoice} />
            <InvoicePaymentsSection clientId={clientId} invoice={invoice} />
          </>
        )}
      </div>
    </div>
  );
}
