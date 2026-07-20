"use client";

import { doc, onSnapshot } from "firebase/firestore";
import { ChevronLeft } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { LoadingState } from "@/components/shared/loading-state";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase/firebase-client";
import InvoicePreview from "../components/invoice-preview";
import {
  type ClientSnapshot,
  getDefaultInvoiceTemplate,
  type InvoiceTemplate,
  mapInvoiceTemplate,
} from "../invoice-model";
import EditInvoiceTemplateDialog from "./components/edit-invoice-template-dialog";

export default function ClientInvoiceTemplatePage() {
  const params = useParams();
  const router = useRouter();
  const { activeCompany } = useAuth();
  const clientId = typeof params.id === "string" ? params.id : undefined;
  const [client, setClient] = useState<ClientSnapshot | null>(null);
  const [companyName, setCompanyName] = useState("");
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
        setCompanyName(snapshot.exists() ? snapshot.data().name || "" : "");
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

  const previewTemplate = useMemo(
    () => template ?? getDefaultInvoiceTemplate(companyName),
    [companyName, template],
  );

  const loading = clientLoading || companyLoading || templateLoading;

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
          {!loading && client && clientId ? (
            <EditInvoiceTemplateDialog
              clientId={clientId}
              clientName={client.name}
              companyName={companyName}
              template={template}
            />
          ) : null}
        </div>

        {loading ? (
          <LoadingState
            message="Loading invoice template..."
            variant="skeleton"
            rows={6}
          />
        ) : !client ? (
          <div className="rounded-lg bg-white p-6">Client not found.</div>
        ) : (
          <>
            <div className="rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-700">
              <p className="font-medium text-zinc-900">About this template</p>
              <p className="mt-1 leading-relaxed">
                Every invoice already includes the base layout: Tax Invoice
                header, supplier and client details, delivery fields, the fixed
                cost columns (No, Date, Vehicle No, Rate, Amount), VAT totals,
                and signature lines. Those stay in place. Use Manage Template to
                fill supplier and signing details, and to add any extra columns
                that appear between Vehicle No and Rate.
              </p>
            </div>
            <InvoicePreview
              template={previewTemplate}
              client={client}
              preview
            />
          </>
        )}
      </div>
    </div>
  );
}
