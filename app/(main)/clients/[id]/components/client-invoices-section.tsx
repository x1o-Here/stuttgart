"use client";

import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { LoadingState } from "@/components/shared/loading-state";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase/firebase-client";
import { toDate } from "@/lib/helpers/to-date";
import {
  type ClientInvoice,
  type InvoiceStatus,
  getInvoicesColumns,
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
  clientId: string;
};

export default function ClientInvoicesSection({
  clientId,
}: ClientInvoicesSectionProps) {
  const { activeCompany } = useAuth();
  const [invoices, setInvoices] = useState<ClientInvoice[]>([]);
  const [loading, setLoading] = useState(true);

  const columns = useMemo(() => getInvoicesColumns(clientId), [clientId]);

  useEffect(() => {
    if (!activeCompany || !clientId) {
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
        clientId,
        "invoices",
      ),
      orderBy("date", "desc"),
    );

    const unsubscribe = onSnapshot(
      invoicesQuery,
      (snapshot) => {
        const next: ClientInvoice[] = snapshot.docs
          .map((docSnap) => {
            const data = docSnap.data() as Record<string, any>;
            if (data.entityStatus === false) return null;
            const status = normalizeStatus(data.status);
            return {
              id: docSnap.id,
              date: toDate(data.date) || new Date(0),
              taxInvoiceNo: data.taxInvoiceNo || data.invoiceNo || "—",
              totalAmount: Number(data.totalAmount) || 0,
              outstandingAmount: Number(data.outstandingAmount) || 0,
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
  }, [activeCompany, clientId]);

  return (
    <div className="p-4 bg-white rounded-lg flex flex-col gap-4">
      {loading ? (
        <LoadingState message="Loading invoices..." variant="skeleton" rows={4} />
      ) : (
        <InvoicesTable columns={columns} data={invoices} />
      )}
    </div>
  );
}
