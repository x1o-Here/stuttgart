"use client";

import {
  collection,
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
  resolveOutstandingAmount,
  roundMoney,
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
  // Legacy / UI synonym for paid.
  if (value === "complete" || value === "completed") return "paid";
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

  const columns = useMemo(() => getInvoicesColumns(client.id), [client.id]);

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
            const supplyValue = Number(data.totalAmount) || 0;
            const totals = calculateInvoiceTotals(supplyValue);
            const totalIncludingVat =
              Number(data.totalIncludingVat) || totals.totalIncludingVat;
            let outstandingAmount = resolveOutstandingAmount(
              data.outstandingAmount,
              totalIncludingVat,
            );
            let status = normalizeStatus(data.status);
            if (
              status !== "cancelled" &&
              roundMoney(totalIncludingVat) > 0 &&
              outstandingAmount <= 0
            ) {
              outstandingAmount = 0;
              status = "paid";
            }
            if (status === "paid") {
              outstandingAmount = 0;
            }
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
              outstandingAmount,
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

  return (
    <div className="p-4 bg-white rounded-lg flex flex-col gap-4">
      {loading ? (
        <LoadingState
          message="Loading invoices..."
          variant="skeleton"
          rows={4}
        />
      ) : (
        <InvoicesTable columns={columns} data={invoices} client={client} />
      )}
    </div>
  );
}
