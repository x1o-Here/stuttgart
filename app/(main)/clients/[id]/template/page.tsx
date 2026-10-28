"use client";

import { doc, onSnapshot } from "firebase/firestore";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { LoadingState } from "@/components/shared/loading-state";
import { PageHeader } from "@/components/shared/page-header";
import { useAuth } from "@/contexts/auth-context";
import { type CompanyRecord, mapCompanyDoc } from "@/lib/companies/types";
import { db } from "@/lib/firebase/firebase-client";
import InvoicePreview from "../components/invoice-preview";
import {
  type ClientSnapshot,
  getDefaultInvoiceTemplate,
  type InvoiceTemplate,
  mapInvoiceTemplate,
  withCompanySupplier,
} from "../invoice-model";
import EditInvoiceTemplateDialog from "./components/edit-invoice-template-dialog";

export default function ClientInvoiceTemplatePage() {
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
        if (!snapshot.exists()) {
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

  const previewTemplate = useMemo(() => {
    const base = template ?? getDefaultInvoiceTemplate(company);
    return withCompanySupplier(base, company);
  }, [company, template]);

  const loading = clientLoading || companyLoading || templateLoading;

  if (loading) {
    return (
      <div className="h-full bg-card p-4 font-sans md:p-6">
        <LoadingState
          message="Loading invoice template..."
          variant="skeleton"
          rows={6}
        />
      </div>
    );
  }

  if (!client || !clientId) {
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
    <div className="flex h-full flex-col divide-y overflow-y-auto bg-card font-sans">
      <PageHeader
        back={{ href: `/clients/${clientId}`, label: client.name }}
        eyebrow={`( ${client.name} )`}
        lead="Invoice"
        title="template."
        description="Preview with sample data"
        actions={
          <EditInvoiceTemplateDialog
            clientId={clientId}
            clientName={client.name}
            company={company}
            template={template}
          />
        }
      />

      <div className="flex flex-col gap-2 px-4 py-4 md:px-6">
        <span className="eyebrow normal-case tracking-normal">
          About this template
        </span>
        <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
          Every invoice already includes the base layout: the Tax Invoice
          header, supplier and client details, delivery fields, the fixed cost
          columns (No, Date, Vehicle No, Rate, Amount), VAT totals and signature
          lines. Supplier details come from the active company. Use Manage
          template to set signing details and add extra columns between Vehicle
          No and Rate.
        </p>
      </div>

      <div className="flex-1 bg-canvas px-4 py-6 md:px-8 md:py-10">
        <div className="mx-auto w-fit max-w-full overflow-x-auto rounded-md border bg-white shadow-card">
          <InvoicePreview template={previewTemplate} client={client} preview />
        </div>
      </div>
    </div>
  );
}
