"use client";

import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { FileText, Pencil } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { LoadingState } from "@/components/shared/loading-state";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase/firebase-client";
import {
  invoiceStatusLabel,
  invoiceStatusVariant,
} from "../../components/invoices-columns";
import {
  type ClientInvoiceDocument,
  type InvoicePayment,
  mapClientInvoiceDocument,
  mapInvoicePayment,
  roundMoney,
} from "../../invoice-model";
import DeleteInvoiceDialog from "./components/delete-invoice-dialog";
import InvoicePaymentsSection from "./components/invoice-payments-section";
import InvoiceSummaryCard from "./components/invoice-summary-card";

export default function ClientInvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { activeCompany } = useAuth();
  const clientId = typeof params.id === "string" ? params.id : undefined;
  const invoiceId =
    typeof params.invoiceId === "string" ? params.invoiceId : undefined;
  const [invoice, setInvoice] = useState<ClientInvoiceDocument | null>(null);
  const [payments, setPayments] = useState<InvoicePayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [paymentsLoading, setPaymentsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!activeCompany || !clientId || !invoiceId) return;

    setLoading(true);
    return onSnapshot(
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
          setInvoice(
            mapClientInvoiceDocument(
              snapshot.id,
              snapshot.data() as Record<string, unknown>,
            ),
          );
          setNotFound(false);
        }
        setLoading(false);
      },
      (error) => {
        console.error("Failed to fetch invoice:", error);
        setNotFound(true);
        setLoading(false);
      },
    );
  }, [activeCompany, clientId, invoiceId]);

  useEffect(() => {
    if (!activeCompany || !clientId || !invoiceId) {
      setPayments([]);
      setPaymentsLoading(true);
      return;
    }

    setPaymentsLoading(true);
    return onSnapshot(
      query(
        collection(
          db,
          "companies",
          activeCompany,
          "clients",
          clientId,
          "invoices",
          invoiceId,
          "payments",
        ),
        orderBy("date", "desc"),
      ),
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
        setPaymentsLoading(false);
      },
      (error) => {
        console.error("Failed to fetch invoice payments:", error);
        setPaymentsLoading(false);
      },
    );
  }, [activeCompany, clientId, invoiceId]);

  const paidAmount = useMemo(
    () =>
      roundMoney(payments.reduce((sum, payment) => sum + payment.amount, 0)),
    [payments],
  );

  const locked = invoice?.status === "paid" || invoice?.status === "cancelled";

  if (loading) {
    return (
      <div className="h-full bg-card p-4 font-sans md:p-6">
        <LoadingState
          message="Loading invoice..."
          variant="skeleton"
          rows={6}
        />
      </div>
    );
  }

  if (notFound || !invoice || !clientId) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-card p-6 text-center font-sans">
        <span className="eyebrow">( Not found )</span>
        <p className="heading text-2xl">
          <span className="text-muted-foreground">This invoice</span> doesn’t
          exist.
        </p>
        <Link
          href={clientId ? `/clients/${clientId}` : "/clients"}
          className="font-mono text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          Back to client
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col divide-y overflow-y-auto bg-card font-sans">
      <PageHeader
        back={{
          href: `/clients/${clientId}`,
          label: invoice.client.name || "Client",
        }}
        eyebrow={`( ${invoice.client.name || "Client"} · Invoices )`}
        lead="Tax invoice"
        title={invoice.taxInvoiceNo || "Untitled"}
        description={
          invoice.date.getTime()
            ? `Dated ${invoice.date.toLocaleDateString()}`
            : undefined
        }
        actions={
          <>
            <Badge variant={invoiceStatusVariant(invoice.status)}>
              {invoiceStatusLabel(invoice.status)}
            </Badge>
            <Button
              variant="outline"
              disabled={locked}
              onClick={() =>
                router.push(`/clients/${clientId}/invoices/${invoice.id}/edit`)
              }
            >
              <Pencil />
              Edit
            </Button>
            <DeleteInvoiceDialog
              clientId={clientId}
              invoiceId={invoice.id}
              taxInvoiceNo={invoice.taxInvoiceNo}
              disabled={locked}
            />
            <Button asChild>
              <Link
                href={`/clients/${clientId}/invoices/${invoice.id}/document`}
              >
                <FileText />
                View document
              </Link>
            </Button>
          </>
        }
      />
      <InvoiceSummaryCard invoice={invoice} paidAmount={paidAmount} />
      <InvoicePaymentsSection
        clientId={clientId}
        invoice={invoice}
        payments={payments}
        loading={paymentsLoading}
      />
    </div>
  );
}
