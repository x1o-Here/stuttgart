"use client";

import {
  getCoreRowModel,
  getFilteredRowModel,
  useReactTable,
} from "@tanstack/react-table";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { LoadingState } from "@/components/shared/loading-state";
import { PageHeader } from "@/components/shared/page-header";
import { RuledTable, TableCaption } from "@/components/shared/ruled-table";
import { TruncatedText } from "@/components/shared/truncated-text";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AccountsLedgerProvider,
  useAccountsContext,
} from "@/contexts/useAccountsContext";
import { useSpareParts } from "@/hooks/use-spare-parts";
import { useLookupStore } from "@/stores/use-lookup-store";
import { buildLedgerTransactions } from "../../components/logistics/build-ledger-transactions";
import { transactionsColumns } from "../../components/logistics/columns";
import DeleteModal from "../../settings/[...setting]/components/modals/delete-modal";
import { RemovePartDialog } from "../components/remove-part-dialog";
import VehicleFormDialog from "../components/vehicle-form-dialog";

// Lorry is implied by the page; tags/createdAt are hidden on the dashboard too.
const VEHICLE_TX_COLUMN_KEYS = [
  "date",
  "department",
  "description",
  "voucher",
  "creditingAccount",
  "debitingAccount",
  "amount",
];

const vehicleTransactionColumns = transactionsColumns.filter(
  (column) =>
    "accessorKey" in column &&
    VEHICLE_TX_COLUMN_KEYS.includes(column.accessorKey as string),
);

const PART_TH =
  "font-mono text-[11px] font-normal uppercase tracking-[0.08em] text-muted-foreground first:pl-4 last:pr-4";
const PART_TD = "py-2.5 first:pl-4 last:pr-4";

function formatAmount(amount: number) {
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function VehicleDetailContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const vehicles = useLookupStore((s) => s.vehicles);
  const vehiclesLoading = useLookupStore((s) => s.loading.vehicles);
  const { accounts, loading: ledgerLoading } = useAccountsContext();
  const [globalFilter, setGlobalFilter] = useState("");

  const vehicle = vehicles.find((v) => v.id === params.id);
  const { parts, loading: partsLoading } = useSpareParts();
  const fittedParts = useMemo(
    () =>
      parts.filter(
        (part) => part.status === "assigned" && part.vehicleId === params.id,
      ),
    [parts, params.id],
  );

  const transactions = useMemo(() => {
    const number = vehicle?.name.trim().toLowerCase();
    if (!number) return [];
    return buildLedgerTransactions(accounts).filter(
      (tx) => tx.vehicle?.trim().toLowerCase() === number,
    );
  }, [accounts, vehicle?.name]);

  const totalAmount = transactions.reduce(
    (sum, tx) => sum + (Number(tx.amount) || 0),
    0,
  );
  const lastActivity = transactions[0]?.date;

  const table = useReactTable({
    defaultColumn: {
      cell: ({ getValue }) => (
        <TruncatedText>{String(getValue() ?? "")}</TruncatedText>
      ),
    },
    data: transactions,
    columns: vehicleTransactionColumns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: "includesString",
    state: { globalFilter },
  });

  if (vehiclesLoading) {
    return (
      <div className="p-4 md:p-6">
        <LoadingState message="Loading vehicle..." variant="skeleton" />
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <span className="eyebrow">( Not found )</span>
        <p className="heading text-2xl">
          <span className="text-muted-foreground">This vehicle</span> isn’t in
          the fleet.
        </p>
        <Link
          href="/fleet"
          className="font-mono text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          Back to fleet
        </Link>
      </div>
    );
  }

  const facts = [
    {
      label: "01 / Description",
      value: vehicle.description?.trim() ? (
        <span className="whitespace-pre-wrap break-words">
          {vehicle.description}
        </span>
      ) : (
        <span className="text-muted-foreground">No description</span>
      ),
    },
    {
      label: "02 / Transactions",
      value: (
        <span className="font-mono text-2xl font-light tabular-nums">
          {ledgerLoading ? "–" : transactions.length}
        </span>
      ),
    },
    {
      label: "03 / Total moved",
      value: (
        <span className="flex items-baseline gap-2">
          <span className="font-mono text-xs text-muted-foreground">LKR</span>
          <span className="font-mono text-2xl font-light tabular-nums">
            {ledgerLoading ? "–" : formatAmount(totalAmount)}
          </span>
        </span>
      ),
    },
    {
      label: "04 / Last activity",
      value: (
        <span className="font-mono tabular-nums">
          {ledgerLoading || !lastActivity
            ? "–"
            : lastActivity.toLocaleDateString()}
        </span>
      ),
    },
    {
      label: "05 / Spare parts fitted",
      value: (
        <span className="font-mono text-2xl font-light tabular-nums">
          {partsLoading ? "–" : fittedParts.length}
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        back={{ href: "/fleet", label: "Fleet" }}
        eyebrow="( Fleet · Vehicle )"
        title={<span className="font-mono">{vehicle.name}</span>}
        description={
          vehicle.createdAt
            ? `Added ${vehicle.createdAt.toLocaleDateString()}`
            : undefined
        }
        actions={
          <>
            <VehicleFormDialog
              triggerVariant="button"
              vehicle={{
                id: vehicle.id,
                name: vehicle.name,
                description: vehicle.description ?? "",
              }}
            />
            <DeleteModal
              triggerVariant="button"
              entityLabel="Vehicle"
              itemId={vehicle.id}
              itemName={vehicle.name}
              onDeleted={() => router.push("/fleet")}
            />
          </>
        }
      />

      <dl className="grid gap-px bg-border sm:grid-cols-2 xl:grid-cols-5">
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

      <section className="flex flex-col">
        <div className="flex flex-wrap items-baseline justify-between gap-3 px-4 py-3">
          <TableCaption
            label="Spare parts"
            count={partsLoading ? undefined : fittedParts.length}
          />
          <Link
            href="/inventory"
            className="font-mono text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Assign parts from Inventory
          </Link>
        </div>
        {partsLoading ? (
          <div className="px-4 pb-4">
            <LoadingState message="Loading parts..." variant="compact" />
          </div>
        ) : fittedParts.length === 0 ? (
          <p className="border-t px-4 py-6 text-sm text-muted-foreground">
            No parts fitted to this vehicle.
          </p>
        ) : (
          <div className="overflow-x-auto border-t">
            <Table>
              <TableHeader className="bg-surface-muted">
                <TableRow className="hover:bg-transparent">
                  <TableHead className={PART_TH}>Part ID</TableHead>
                  <TableHead className={PART_TH}>Description</TableHead>
                  <TableHead className={PART_TH}>Assigned on</TableHead>
                  <TableHead className={PART_TH}>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fittedParts.map((part) => (
                  <TableRow key={part.id} className="hover:bg-surface-muted">
                    <TableCell
                      className={`font-mono font-medium text-foreground ${PART_TD}`}
                    >
                      {part.partId}
                    </TableCell>
                    <TableCell className={`whitespace-normal ${PART_TD}`}>
                      {part.description}
                    </TableCell>
                    <TableCell
                      className={`font-mono text-xs tabular-nums text-muted-foreground ${PART_TD}`}
                    >
                      {part.assignedAt
                        ? part.assignedAt.toLocaleDateString()
                        : "–"}
                    </TableCell>
                    <TableCell className={`text-right ${PART_TD}`}>
                      <RemovePartDialog
                        part={part}
                        vehicleName={vehicle.name}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <div className="flex min-h-[20rem] flex-1 flex-col">
        <div className="flex shrink-0 flex-col gap-3 px-4 py-3">
          <TableCaption
            label="Transactions"
            count={
              ledgerLoading
                ? undefined
                : table.getFilteredRowModel().rows.length
            }
          />
          <Input
            placeholder="Search by description, account or amount"
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
          />
        </div>
        {ledgerLoading ? (
          <div className="p-4">
            <LoadingState
              message="Loading transactions..."
              variant="skeleton"
              rows={5}
            />
          </div>
        ) : (
          <RuledTable
            table={table}
            emptyMessage="No transactions recorded for this vehicle yet."
          />
        )}
      </div>
    </>
  );
}

export default function VehicleDetailPage() {
  return (
    <AccountsLedgerProvider mode="all">
      <div className="flex h-full flex-col divide-y overflow-y-auto bg-card font-sans">
        <VehicleDetailContent />
      </div>
    </AccountsLedgerProvider>
  );
}
