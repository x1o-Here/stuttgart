"use client";

import { doc, onSnapshot } from "firebase/firestore";
import { ChevronLeft } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { LoadingState } from "@/components/shared/loading-state";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { mapCompanyDoc, type CompanyRecord } from "@/lib/companies/types";
import { db } from "@/lib/firebase/firebase-client";
import CreateInvoiceForm from "../../../components/create-invoice-form";
import {
  type ClientInvoiceDocument,
  mapClientInvoiceDocument,
  withCompanySupplier,
} from "../../../invoice-model";

export default function EditClientInvoicePage() {
  const params = useParams();
  const router = useRouter();
  const { activeCompany } = useAuth();
  const clientId = typeof params.id === "string" ? params.id : undefined;
  const invoiceId =
    typeof params.invoiceId === "string" ? params.invoiceId : undefined;
  const [invoice, setInvoice] = useState<ClientInvoiceDocument | null>(null);
  const [company, setCompany] = useState<CompanyRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [companyLoading, setCompanyLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!activeCompany || !clientId || !invoiceId) return;

    setLoading(true);
    const unsubscribeInvoice = onSnapshot(
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
          const mapped = mapClientInvoiceDocument(
            snapshot.id,
            snapshot.data() as Record<string, unknown>,
          );
          if (mapped.status === "paid" || mapped.status === "cancelled") {
            setInvoice(null);
            setNotFound(true);
          } else {
            setInvoice(mapped);
            setNotFound(false);
          }
        }
        setLoading(false);
      },
      (error) => {
        console.error("Failed to fetch invoice for edit:", error);
        setNotFound(true);
        setLoading(false);
      },
    );

    const unsubscribeCompany = onSnapshot(
      doc(db, "companies", activeCompany),
      (snapshot) => {
        setCompany(
          snapshot.exists()
            ? mapCompanyDoc(
                snapshot.id,
                snapshot.data() as Record<string, unknown>,
              )
            : null,
        );
        setCompanyLoading(false);
      },
    );

    return () => {
      unsubscribeInvoice();
      unsubscribeCompany();
    };
  }, [activeCompany, clientId, invoiceId]);

  const editTemplate = useMemo(() => {
    if (!invoice) return null;
    return withCompanySupplier(invoice.template, company);
  }, [company, invoice]);

  const pageLoading = loading || companyLoading;

  return (
    <div className="min-h-screen h-full p-4 font-sans">
      <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col gap-4 rounded-lg bg-zinc-50 p-4">
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

        {pageLoading ? (
          <LoadingState
            message="Loading invoice..."
            variant="skeleton"
            rows={8}
          />
        ) : notFound || !invoice || !editTemplate ? (
          <div className="rounded-lg bg-white p-6">
            <h1 className="text-xl font-semibold">
              Invoice not found or cannot be edited
            </h1>
          </div>
        ) : (
          <CreateInvoiceForm
            client={invoice.client}
            template={editTemplate}
            invoice={invoice}
          />
        )}
      </div>
    </div>
  );
}
