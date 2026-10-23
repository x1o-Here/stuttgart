"use client";

import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ChevronLeft } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { LoadingState } from "@/components/shared/loading-state";
import { TruncatedText } from "@/components/shared/truncated-text";
import { Button } from "@/components/ui/button";
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
import { useLookupStore } from "@/stores/use-lookup-store";
import { buildLedgerTransactions } from "../../components/logistics/build-ledger-transactions";
import { transactionsColumns } from "../../components/logistics/columns";
import DeleteModal from "../../settings/[...setting]/components/modals/delete-modal";
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

function formatLkr(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "LKR",
  }).format(amount);
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-white p-4">
      <TruncatedText className="text-sm text-muted-foreground">
        {label}
      </TruncatedText>
      <TruncatedText className="mt-1 text-xl font-semibold tabular-nums">
        {value}
      </TruncatedText>
    </div>
  );
}

function VehicleDetailContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const vehicles = useLookupStore((s) => s.vehicles);
  const vehiclesLoading = useLookupStore((s) => s.loading.vehicles);
  const { accounts, loading: ledgerLoading } = useAccountsContext();
  const [globalFilter, setGlobalFilter] = useState("");

  const vehicle = vehicles.find((v) => v.id === params.id);

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

  const backButton = (
    <Button
      size="sm"
      variant="ghost"
      className="cursor-pointer hover:bg-gray-100 w-fit px-1"
      onClick={() => router.push("/fleet")}
    >
      <ChevronLeft />
      Back
    </Button>
  );

  if (vehiclesLoading) {
    return (
      <div className="bg-white rounded-lg p-6">
        <LoadingState message="Loading vehicle..." variant="skeleton" />
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24">
        <p className="text-lg font-semibold">Vehicle not found</p>
        <Button onClick={() => router.push("/fleet")}>Back to fleet</Button>
      </div>
    );
  }

  return (
    <>
      <div className="p-4 bg-white rounded-lg flex flex-col gap-4">
        {backButton}
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h1 className="min-w-0 text-2xl font-bold">
              <TruncatedText>{vehicle.name}</TruncatedText>
            </h1>
            {vehicle.description?.trim() ? (
              <p className="text-sm text-zinc-600 whitespace-pre-wrap break-words">
                {vehicle.description}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                No description
              </p>
            )}
            {vehicle.createdAt && (
              <p className="text-xs text-muted-foreground">
                Added {vehicle.createdAt.toLocaleDateString()}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <VehicleFormDialog
              vehicle={{
                id: vehicle.id,
                name: vehicle.name,
                description: vehicle.description ?? "",
              }}
            />
            <DeleteModal
              entityLabel="Vehicle"
              itemId={vehicle.id}
              itemName={vehicle.name}
              onDeleted={() => router.push("/fleet")}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard
          label="Transactions"
          value={ledgerLoading ? "—" : String(transactions.length)}
        />
        <MetricCard
          label="Total amount"
          value={ledgerLoading ? "—" : formatLkr(totalAmount)}
        />
        <MetricCard
          label="Last activity"
          value={
            ledgerLoading || !lastActivity
              ? "—"
              : lastActivity.toLocaleDateString()
          }
        />
      </div>

      <div className="p-4 bg-white rounded-lg flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">Transactions</h2>
          <Input
            placeholder="Search transactions"
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="max-w-sm"
          />
        </div>

        {ledgerLoading ? (
          <LoadingState
            message="Loading transactions..."
            variant="skeleton"
            rows={5}
          />
        ) : (
          <div className="overflow-hidden rounded-md border">
            <Table className="table-fixed w-full">
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead
                        key={header.id}
                        className="overflow-hidden"
                        style={{ width: header.getSize() }}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id} className="text-gray-600">
                      {row.getVisibleCells().map((cell) => (
                        <TableCell
                          key={cell.id}
                          className="overflow-hidden"
                          style={{ width: cell.column.getSize() }}
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={vehicleTransactionColumns.length}
                      className="h-24 text-center text-muted-foreground"
                    >
                      No transactions for this vehicle.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </>
  );
}

export default function VehicleDetailPage() {
  return (
    <AccountsLedgerProvider mode="all">
      <div className="min-h-screen h-full p-4 flex items-center justify-center font-sans">
        <div className="w-full h-full flex flex-col gap-4 p-4 bg-zinc-100 rounded-lg overflow-y-auto">
          <VehicleDetailContent />
        </div>
      </div>
    </AccountsLedgerProvider>
  );
}
