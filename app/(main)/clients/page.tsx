"use client";

import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { useEffect, useState } from "react";
import { LoadingState } from "@/components/shared/loading-state";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase/firebase-client";
import {
  type Client,
  clientsColumns,
} from "./components/clients-columns";
import ClientsDataTable from "./components/data-table";

export default function ClientsPage() {
  const { activeCompany } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeCompany) {
      setClients([]);
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
            const data = docSnap.data() as Record<string, any>;
            if (data.entityStatus === false) return null;
            return {
              id: docSnap.id,
              name: data.name || "Unnamed Client",
              address: data.address || "",
              vatNo: data.vatNo || "",
              contactNo: data.contactNo || "",
              status: data.status === "inactive" ? "inactive" : "active",
              activeInvoiceCount: data.activeInvoiceCount || 0,
              outstandingInvoiceAmount: data.outstandingInvoiceAmount || 0,
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

  return (
    <div className="min-h-screen h-full p-4 flex items-center justify-center font-sans">
      <div className="w-full h-full flex flex-col p-4 bg-zinc-100 rounded-lg min-h-0">
        <div className="w-full h-full p-4 bg-white rounded-lg flex flex-col gap-4 min-h-0">
          <h2 className="text-2xl font-bold shrink-0">Clients</h2>

          {loading ? (
            <LoadingState
              message="Loading clients..."
              variant="skeleton"
              rows={5}
            />
          ) : (
            <div className="flex-1 min-h-0">
              <ClientsDataTable columns={clientsColumns} data={clients} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
