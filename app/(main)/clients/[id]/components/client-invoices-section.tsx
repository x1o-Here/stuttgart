"use client";

import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { LoadingState } from "@/components/shared/loading-state";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase/firebase-client";
import { toDate } from "@/lib/helpers/to-date";
import {
  type ClientSnapshot,
  calculateInvoiceTotals,
  getDefaultInvoiceTemplate,
  type InvoiceTemplate,
  mapInvoiceTemplate,
} from "../invoice-model";
import {
  type ClientInvoice,
  getInvoicesColumns,
  type InvoiceStatus,
  isActiveInvoiceStatus,
} from "./invoices-columns";
import InvoicesTable from "./invoices-table";

const VALID_STATUSES: InvoiceStatus[] = [
  "draft",
  "issued",
  "paid",
  "partial",
  "overdue",
  "cancelled",
];

function normalizeStatus(value: unknown): InvoiceStatus {
  if (
    typeof value === "string" &&
    VALID_STATUSES.includes(value as InvoiceStatus)
  ) {
    return value as InvoiceStatus;
  }
  // Treat explicit "active" from data as an open invoice.
  if (value === "active") return "issued";
  return "issued";
}

type ClientInvoicesSectionProps = {
  client: ClientSnapshot;
};

export default function ClientInvoicesSection({
  client,
}: ClientInvoicesSectionProps) {
  const { activeCompany } = useAuth();
  const [invoices, setInvoices] = useState<ClientInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [template, setTemplate] = useState<InvoiceTemplate | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [templateLoading, setTemplateLoading] = useState(true);
  const [companyLoading, setCompanyLoading] = useState(true);

  const columns = useMemo(() => getInvoicesColumns(client.id), [client.id]);
  const effectiveTemplate = useMemo(
    () => template ?? getDefaultInvoiceTemplate(companyName),
    [companyName, template],
  );

  useEffect(() => {
    if (!activeCompany || !client.id) {
      setInvoices([]);
      setLoading(true);
      return;
    }

    setLoading(true);
    const invoicesQuery = query(
      collection(
        db,
        "companies",
        activeCompany,
        "clients",
        client.id,
        "invoices",
      ),
      orderBy("date", "desc"),
    );

    const unsubscribe = onSnapshot(
      invoicesQuery,
      (snapshot) => {
        const next: ClientInvoice[] = snapshot.docs
          .map((docSnap) => {
            const data = docSnap.data() as Record<string, unknown>;
            if (data.entityStatus === false) return null;
            const status = normalizeStatus(data.status);
            const supplyValue = Number(data.totalAmount) || 0;
            const totals = calculateInvoiceTotals(supplyValue);
            const totalIncludingVat =
              Number(data.totalIncludingVat) || totals.totalIncludingVat;
            return {
              id: docSnap.id,
              date: toDate(data.date) || new Date(0),
              taxInvoiceNo:
                typeof data.taxInvoiceNo === "string"
                  ? data.taxInvoiceNo
                  : typeof data.invoiceNo === "string"
                    ? data.invoiceNo
                    : "—",
              totalAmount: totalIncludingVat,
              outstandingAmount:
                Number(data.outstandingAmount) || totalIncludingVat,
              status,
              isActive: isActiveInvoiceStatus(status),
            } satisfies ClientInvoice;
          })
          .filter((invoice): invoice is ClientInvoice => invoice !== null)
          .sort((a, b) => {
            if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
            return b.date.getTime() - a.date.getTime();
          });

        setInvoices(next);
        setLoading(false);
      },
      (error) => {
        console.error("Failed to fetch invoices:", error);
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [activeCompany, client.id]);

  useEffect(() => {
    if (!activeCompany || !client.id) {
      setTemplate(null);
      setCompanyName("");
      setTemplateLoading(true);
      setCompanyLoading(true);
      return;
    }

    setTemplateLoading(true);
    setCompanyLoading(true);

    const unsubscribeCompany = onSnapshot(
      doc(db, "companies", activeCompany),
      (snapshot) => {
        setCompanyName(snapshot.exists() ? snapshot.data().name || "" : "");
        setCompanyLoading(false);
      },
      (error) => {
        console.error("Failed to fetch company:", error);
        setCompanyLoading(false);
      },
    );

    const unsubscribeTemplate = onSnapshot(
      doc(
        db,
        "companies",
        activeCompany,
        "clients",
        client.id,
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
      (error) => {
        console.error("Failed to fetch invoice template:", error);
        setTemplate(null);
        setTemplateLoading(false);
      },
    );

    return () => {
      unsubscribeCompany();
      unsubscribeTemplate();
    };
  }, [activeCompany, client.id]);

  return (
    <div className="p-4 bg-white rounded-lg flex flex-col gap-4">
      {loading || templateLoading || companyLoading ? (
        <LoadingState
          message="Loading invoices..."
          variant="skeleton"
          rows={4}
        />
      ) : (
        <InvoicesTable
          columns={columns}
          data={invoices}
          client={client}
          template={effectiveTemplate}
        />
      )}
    </div>
  );
}
