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
  const router = useRouter();
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
            ? mapCompanyDoc(snapshot.id, snapshot.data() as Record<string, unknown>)
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
            message="Loading invoice form..."
            variant="skeleton"
            rows={8}
          />
        ) : !client ? (
          <div className="rounded-lg bg-white p-6">Client not found.</div>
        ) : (
          <CreateInvoiceForm client={client} template={effectiveTemplate} />
        )}
      </div>
    </div>
  );
}
