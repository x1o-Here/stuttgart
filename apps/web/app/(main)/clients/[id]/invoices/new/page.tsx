"use client";

import { doc, onSnapshot } from "firebase/firestore";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { LoadingState } from "@/components/shared/loading-state";
import { useAuth } from "@/contexts/auth-context";
import { type CompanyRecord, mapCompanyDoc } from "@/lib/companies/types";
import { db } from "@/lib/firebase/firebase-client";
import CreateInvoiceForm from "../../components/create-invoice-form";
import {
  type ClientSnapshot,
  getDefaultInvoiceTemplate,
  type InvoiceTemplate,
  mapInvoiceTemplate,
  withCompanySupplier,
} from "../../invoice-model";

export default function CreateClientInvoicePage() {
  const params = useParams();
  const { activeCompany } = useAuth();
  const clientId = typeof params.id === "string" ? params.id : undefined;
  const [client, setClient] = useState<ClientSnapshot | null>(null);
  const [company, setCompany] = useState<CompanyRecord | null>(null);
  const [template, setTemplate] = useState<InvoiceTemplate | null>(null);
  const [clientLoading, setClientLoading] = useState(true);
  const [companyLoading, setCompanyLoading] = useState(true);
  const [templateLoading, setTemplateLoading] = useState(true);

  useEffect(() => {
    if (!activeCompany || !clientId) return;

    const unsubscribeClient = onSnapshot(
      doc(db, "companies", activeCompany, "clients", clientId),
      (snapshot) => {
        if (!snapshot.exists() || snapshot.data()?.entityStatus === false) {
          setClient(null);
        } else {
          const data = snapshot.data();
          setClient({
            id: snapshot.id,
            name: data.name || "Unnamed Client",
            address: data.address || "",
            vatNo: data.vatNo || "",
            contactNo: data.contactNo || "",
          });
        }
        setClientLoading(false);
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

    const unsubscribeTemplate = onSnapshot(
      doc(
        db,
        "companies",
        activeCompany,
        "clients",
        clientId,
        "invoice-template",
        "config",
      ),
      (snapshot) => {
        setTemplate(
          snapshot.exists()
            ? mapInvoiceTemplate(snapshot.data() as Record<string, unknown>)
            : null,
        );
        setTemplateLoading(false);
      },
    );

    return () => {
      unsubscribeClient();
      unsubscribeCompany();
      unsubscribeTemplate();
    };
  }, [activeCompany, clientId]);

  const effectiveTemplate = useMemo(() => {
    const base = template ?? getDefaultInvoiceTemplate(company);
    return withCompanySupplier(base, company);
  }, [company, template]);

  const loading = clientLoading || companyLoading || templateLoading;

  if (loading) {
    return (
      <div className="h-full bg-card p-4 font-sans md:p-6">
        <LoadingState
          message="Loading invoice form..."
          variant="skeleton"
          rows={8}
        />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-card p-6 text-center font-sans">
        <span className="eyebrow">( Not found )</span>
        <p className="heading text-2xl">
          <span className="text-muted-foreground">This client</span> could not
          be found.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-card font-sans">
      <CreateInvoiceForm client={client} template={effectiveTemplate} />
    </div>
  );
}
