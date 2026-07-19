"use client";

import { doc, onSnapshot } from "firebase/firestore";
import { ChevronLeft } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LoadingState } from "@/components/shared/loading-state";
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
  const router = useRouter();
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

  return (
    <div className="min-h-screen h-full p-4 flex items-center justify-center font-sans">
      <div className="w-full h-full flex flex-col gap-4 p-4 bg-zinc-100 rounded-lg min-h-0 overflow-y-auto">
        <div className="flex flex-col gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="cursor-pointer hover:bg-gray-100 w-fit px-1"
            onClick={() => router.push("/clients")}
          >
            <ChevronLeft />
            Back
          </Button>
        </div>

        {loading ? (
          <LoadingState
            message="Loading client..."
            variant="skeleton"
            rows={4}
          />
        ) : notFound || !client ? (
          <div className="p-4 bg-white rounded-lg">
            <p className="text-lg font-semibold mb-4">Client not found</p>
            <Button onClick={() => router.push("/clients")}>
              Back to clients
            </Button>
          </div>
        ) : (
          <>
            <div className="p-4 bg-white rounded-lg flex flex-col gap-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold">{client.name}</h1>
                    <Badge
                      variant={
                        client.status === "active" ? "default" : "secondary"
                      }
                    >
                      {client.status === "active" ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground mb-1">Status</p>
                  <p className="capitalize">{client.status}</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">Address</p>
                  <p className="whitespace-pre-wrap">{client.address || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">VAT No</p>
                  <p>{client.vatNo || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">Contact No</p>
                  <p>{client.contactNo || "—"}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
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
                <Button
                  variant="outline"
                  onClick={() => router.push(`/clients/${client.id}/template`)}
                >
                  Template
                </Button>
              </div>
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
          </>
        )}
      </div>
    </div>
  );
}
