"use client";

import {
  collection,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { LoadingState } from "@/components/shared/loading-state";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase/firebase-client";
import {
  type ClientInvoiceDocument,
  type InvoicePayment,
  mapInvoicePayment,
} from "../../../invoice-model";
import InvoicePaymentsTable from "./invoice-payments-table";

type InvoicePaymentsSectionProps = {
  clientId: string;
  invoice: ClientInvoiceDocument;
};

export default function InvoicePaymentsSection({
  clientId,
  invoice,
}: InvoicePaymentsSectionProps) {
  const { activeCompany } = useAuth();
  const [payments, setPayments] = useState<InvoicePayment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeCompany || !clientId || !invoice.id) {
      setPayments([]);
      setLoading(true);
      return;
    }

    setLoading(true);
    const paymentsQuery = query(
      collection(
        db,
        "companies",
        activeCompany,
        "clients",
        clientId,
        "invoices",
        invoice.id,
        "payments",
      ),
      orderBy("date", "desc"),
    );

    return onSnapshot(
      paymentsQuery,
      (snapshot) => {
        setPayments(
          snapshot.docs
            .map((docSnap) => {
              const data = docSnap.data() as Record<string, unknown>;
              if (data.entityStatus === false) return null;
              return mapInvoicePayment(docSnap.id, data);
            })
            .filter((payment): payment is InvoicePayment => payment !== null),
        );
        setLoading(false);
      },
      (error) => {
        console.error("Failed to fetch invoice payments:", error);
        setLoading(false);
      },
    );
  }, [activeCompany, clientId, invoice.id]);

  return (
    <div className="rounded-lg bg-white p-4 sm:p-6">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">Invoice payments</h2>
        <p className="text-sm text-muted-foreground">
          Log payments against this invoice. Complete the invoice from the tax
          invoice view once the full amount is covered.
        </p>
      </div>

      {loading ? (
        <LoadingState
          message="Loading payments..."
          variant="skeleton"
          rows={4}
        />
      ) : (
        <InvoicePaymentsTable
          clientId={clientId}
          invoice={invoice}
          payments={payments}
        />
      )}
    </div>
  );
}
