"use client";

import { doc, onSnapshot } from "firebase/firestore";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { LoadingState } from "@/components/shared/loading-state";
import { useAuth } from "@/contexts/auth-context";
import { type CompanyRecord, mapCompanyDoc } from "@/lib/companies/types";
import { db } from "@/lib/firebase/firebase-client";
import CreateInvoiceForm from "../../../components/create-invoice-form";
import {
  type ClientInvoiceDocument,
  mapClientInvoiceDocument,
  withCompanySupplier,
} from "../../../invoice-model";

export default function EditClientInvoicePage() {
  const params = useParams();
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

  if (pageLoading) {
    return (
      <div className="h-full bg-card p-4 font-sans md:p-6">
        <LoadingState
          message="Loading invoice..."
          variant="skeleton"
          rows={8}
        />
      </div>
    );
  }

  if (notFound || !invoice || !editTemplate) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-card p-6 text-center font-sans">
        <span className="eyebrow">( Not found )</span>
        <p className="heading text-2xl">
          <span className="text-muted-foreground">This invoice</span> can’t be
          edited or doesn’t exist.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-card font-sans">
      <CreateInvoiceForm
        client={invoice.client}
        template={editTemplate}
        invoice={invoice}
      />
    </div>
  );
}
