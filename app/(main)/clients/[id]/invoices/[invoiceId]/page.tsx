"use client";

import { doc, onSnapshot } from "firebase/firestore";
import { ChevronLeft } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LoadingState } from "@/components/shared/loading-state";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase/firebase-client";
import InvoicePreview from "../../components/invoice-preview";
import {
  type ClientInvoiceDocument,
  mapClientInvoiceDocument,
} from "../../invoice-model";

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

  return (
    <div className="min-h-screen h-full p-4 font-sans">
      <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col gap-4 rounded-lg bg-zinc-50 p-4">
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

        {loading ? (
          <LoadingState
            message="Loading invoice..."
            variant="skeleton"
            rows={6}
          />
        ) : notFound || !invoice ? (
          <div className="rounded-lg bg-white p-6">
            <h1 className="text-xl font-semibold">Invoice not found</h1>
          </div>
        ) : (
          <InvoicePreview
            template={invoice.template}
            client={invoice.client}
            taxInvoiceNo={invoice.taxInvoiceNo}
            invoiceDate={invoice.date}
            delivery={invoice.delivery}
            lineItems={invoice.lineItems}
            totalAmount={invoice.totalAmount}
            status={invoice.status}
          />
        )}
      </div>
    </div>
  );
}
