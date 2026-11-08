"use client";

import { LoadingState } from "@/components/shared/loading-state";
import { HeaderFigure, PageHeader } from "@/components/shared/page-header";
import { useAuth } from "@/contexts/auth-context";
import { useClients } from "@/lib/data/clients";
import AddClientDialog from "./components/add-client-dialog";
import { clientsColumns } from "./components/clients-columns";
import ClientsDataTable from "./components/data-table";

export default function ClientsPage() {
  const { activeCompany } = useAuth();
  const { data, isError } = useClients(activeCompany);
  const loading = data === undefined && !isError;
  const clientsWithStats = data ?? [];

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
