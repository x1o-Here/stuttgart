"use client";

import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { LoadingState } from "@/components/shared/loading-state";
import { HeaderFigure, PageHeader } from "@/components/shared/page-header";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase/firebase-client";
import {
  type InvoiceStatus,
  isActiveInvoiceStatus,
} from "./[id]/components/invoices-columns";
import { roundMoney } from "./[id]/invoice-model";
import AddClientDialog from "./components/add-client-dialog";
import { type Client, clientsColumns } from "./components/clients-columns";
import ClientsDataTable from "./components/data-table";

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
  if (value === "active") return "issued";
  return "issued";
}

function invoiceOutstanding(data: Record<string, unknown>): number {
  if (data.outstandingAmount !== undefined && data.outstandingAmount !== null) {
    return Number(data.outstandingAmount) || 0;
  }
  if (data.totalIncludingVat !== undefined && data.totalIncludingVat !== null) {
    return Number(data.totalIncludingVat) || 0;
  }
  return Number(data.totalAmount) || 0;
}

type ClientInvoiceStats = {
  activeInvoiceCount: number;
  outstandingInvoiceAmount: number;
};

function aggregateInvoiceStats(
  docs: Array<{ data: () => Record<string, unknown> }>,
): ClientInvoiceStats {
  let activeInvoiceCount = 0;
  let outstandingInvoiceAmount = 0;

  for (const docSnap of docs) {
    const data = docSnap.data();
    if (data.entityStatus === false) continue;

    const status = normalizeStatus(data.status);
    if (!isActiveInvoiceStatus(status)) continue;

    activeInvoiceCount += 1;
    outstandingInvoiceAmount += invoiceOutstanding(data);
  }

  return {
    activeInvoiceCount,
    outstandingInvoiceAmount: roundMoney(outstandingInvoiceAmount),
  };
}

export default function ClientsPage() {
  const { activeCompany } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [invoiceStats, setInvoiceStats] = useState<
    Record<string, ClientInvoiceStats>
  >({});
  const [loading, setLoading] = useState(true);

  const clientIds = useMemo(
    () => clients.map((client) => client.id).join("|"),
    [clients],
  );

  useEffect(() => {
    if (!activeCompany) {
      setClients([]);
      setInvoiceStats({});
      setLoading(true);
      return;
    }

    setLoading(true);
    const clientsQuery = query(
      collection(db, "companies", activeCompany, "clients"),
      orderBy("createdAt", "desc"),
    );

    const unsubscribe = onSnapshot(
      clientsQuery,
      (snapshot) => {
        const next: Client[] = snapshot.docs
          .map((docSnap) => {
            const data = docSnap.data() as Record<string, unknown>;
            if (data.entityStatus === false) return null;
            return {
              id: docSnap.id,
              name:
                typeof data.name === "string" ? data.name : "Unnamed Client",
              address: typeof data.address === "string" ? data.address : "",
              vatNo: typeof data.vatNo === "string" ? data.vatNo : "",
              contactNo:
                typeof data.contactNo === "string" ? data.contactNo : "",
              status: data.status === "inactive" ? "inactive" : "active",
              activeInvoiceCount: 0,
              outstandingInvoiceAmount: 0,
            } satisfies Client;
          })
          .filter((client): client is Client => client !== null);

        setClients(next);
        setLoading(false);
      },
      (error) => {
        console.error("Failed to fetch clients:", error);
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [activeCompany]);

  useEffect(() => {
    if (!activeCompany || !clientIds) {
      setInvoiceStats({});
      return;
    }

    const ids = clientIds.split("|").filter(Boolean);
    const unsubscribers = ids.map((clientId) =>
      onSnapshot(
        collection(
          db,
          "companies",
          activeCompany,
          "clients",
          clientId,
          "invoices",
        ),
        (snapshot) => {
          const stats = aggregateInvoiceStats(
            snapshot.docs.map((docSnap) => ({
              data: () => docSnap.data() as Record<string, unknown>,
            })),
          );
          setInvoiceStats((current) => ({
            ...current,
            [clientId]: stats,
          }));
        },
        (error) => {
          console.error(
            `Failed to fetch invoices for client ${clientId}:`,
            error,
          );
          setInvoiceStats((current) => ({
            ...current,
            [clientId]: {
              activeInvoiceCount: 0,
              outstandingInvoiceAmount: 0,
            },
          }));
        },
      ),
    );

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [activeCompany, clientIds]);

  const clientsWithStats = useMemo(
    () =>
      clients.map((client) => {
        const stats = invoiceStats[client.id];
        return {
          ...client,
          activeInvoiceCount: stats?.activeInvoiceCount ?? 0,
          outstandingInvoiceAmount: stats?.outstandingInvoiceAmount ?? 0,
        };
      }),
    [clients, invoiceStats],
  );

  const totalOutstanding = clientsWithStats.reduce(
    (sum, client) => sum + client.outstandingInvoiceAmount,
    0,
  );
  const activeCount = clientsWithStats.filter(
    (client) => client.status === "active",
  ).length;

  return (
    <div className="flex h-full flex-col divide-y bg-card font-sans">
      <PageHeader
        eyebrow="( Sales · Clients )"
        lead="Clients and"
        title="receivables."
        description={
          loading
            ? "Loading clients…"
            : `${activeCount} active · ${clientsWithStats.length} in total`
        }
        actions={
          <>
            <HeaderFigure
              label="( Outstanding )"
              unit="LKR"
              value={totalOutstanding.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            />
            <AddClientDialog />
          </>
        }
      />

      {loading ? (
        <div className="p-4">
          <LoadingState
            message="Loading clients..."
            variant="skeleton"
            rows={5}
          />
        </div>
      ) : (
        <ClientsDataTable columns={clientsColumns} data={clientsWithStats} />
      )}
    </div>
  );
}
