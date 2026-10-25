"use client";

import { doc, onSnapshot } from "firebase/firestore";
import { ChartColumn, FileText, Plus } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { LoadingState } from "@/components/shared/loading-state";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase/firebase-client";
import type { ClientStatus } from "../components/clients-columns";
import ChangeClientStatusDialog from "./components/change-client-status-dialog";
import ClientInvoicesSection from "./components/client-invoices-section";
import EditClientDialog from "./components/edit-client-dialog";

type ClientDetail = {
  id: string;
  name: string;
  address: string;
  vatNo: string;
  contactNo: string;
  status: ClientStatus;
};

export default function ClientDetailPage() {
  const params = useParams();
  const { activeCompany } = useAuth();
  const clientId = typeof params.id === "string" ? params.id : undefined;

  const [client, setClient] = useState<ClientDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!activeCompany || !clientId) {
      setLoading(true);
      return;
    }

    setLoading(true);
    setNotFound(false);

    const unsubscribe = onSnapshot(
      doc(db, "companies", activeCompany, "clients", clientId),
      (snapshot) => {
        if (!snapshot.exists() || snapshot.data()?.entityStatus === false) {
          setClient(null);
          setNotFound(true);
          setLoading(false);
          return;
        }

        const data = snapshot.data() as Record<string, unknown>;
        setClient({
          id: snapshot.id,
          name: typeof data.name === "string" ? data.name : "Unnamed Client",
          address: typeof data.address === "string" ? data.address : "",
          vatNo: typeof data.vatNo === "string" ? data.vatNo : "",
          contactNo: typeof data.contactNo === "string" ? data.contactNo : "",
          status: data.status === "inactive" ? "inactive" : "active",
        });
        setNotFound(false);
        setLoading(false);
      },
      (error) => {
        console.error("Failed to fetch client:", error);
        setNotFound(true);
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [activeCompany, clientId]);

  if (loading) {
    return (
      <div className="h-full bg-card p-4 font-sans md:p-6">
        <LoadingState message="Loading client..." variant="skeleton" rows={4} />
      </div>
    );
  }

  if (notFound || !client) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-card p-6 text-center font-sans">
        <span className="eyebrow">( Not found )</span>
        <p className="heading text-2xl">
          <span className="text-muted-foreground">This client</span> doesn’t
          exist.
        </p>
        <Link
          href="/clients"
          className="font-mono text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          Back to clients
        </Link>
      </div>
    );
  }

  const active = client.status === "active";
  const facts = [
    {
      label: "01 / Status",
      value: (
        <Badge variant={active ? "success" : "neutral"}>
          {active ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      label: "02 / VAT No",
      value: <span className="font-mono">{client.vatNo || "–"}</span>,
    },
    {
      label: "03 / Contact",
      value: <span className="font-mono">{client.contactNo || "–"}</span>,
    },
    {
      label: "04 / Billing address",
      value: (
        <span className="whitespace-pre-wrap">{client.address || "–"}</span>
      ),
    },
  ];

  return (
    <div className="flex h-full flex-col divide-y overflow-y-auto bg-card font-sans">
      <PageHeader
        back={{ href: "/clients", label: "Clients" }}
        eyebrow={"( Clients · Client record )"}
        title={client.name}
        description={client.vatNo ? `VAT ${client.vatNo}` : undefined}
        actions={
          <Button asChild>
            <Link href={`/clients/${client.id}/invoices/new`}>
              <Plus />
              New invoice
            </Link>
          </Button>
        }
      />

      <dl className="grid gap-px bg-border sm:grid-cols-2 xl:grid-cols-4">
        {facts.map((fact) => (
          <div
            key={fact.label}
            className="flex min-w-0 flex-col gap-2 bg-card px-5 py-4"
          >
            <dt className="eyebrow normal-case tracking-normal">
              {fact.label}
            </dt>
            <dd className="min-w-0 text-sm text-foreground">{fact.value}</dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-wrap items-center gap-2 px-4 py-3">
        <EditClientDialog
          clientId={client.id}
          defaultValues={{
            name: client.name,
            address: client.address,
            vatNo: client.vatNo,
            contactNo: client.contactNo,
          }}
        />
        <ChangeClientStatusDialog
          clientId={client.id}
          clientName={client.name}
          currentStatus={client.status}
        />
        <Button variant="outline" asChild>
          <Link href={`/clients/${client.id}/template`}>
            <FileText />
            Invoice template
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href={`/clients/${client.id}/analytics`}>
            <ChartColumn />
            Analytics
          </Link>
        </Button>
      </div>

      <ClientInvoicesSection
        client={{
          id: client.id,
          name: client.name,
          address: client.address,
          vatNo: client.vatNo,
          contactNo: client.contactNo,
        }}
      />
    </div>
  );
}
