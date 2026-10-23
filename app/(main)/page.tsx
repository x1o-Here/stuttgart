"use client";

import { useMemo } from "react";
import { LoadingState } from "@/components/shared/loading-state";
import {
  AccountsLedgerProvider,
  useAccountsContext,
} from "@/contexts/useAccountsContext";
import { buildLedgerTransactions } from "./components/logistics/build-ledger-transactions";
import { transactionsColumns } from "./components/logistics/columns";
import { DashboardTransactionsTable } from "./components/logistics/data-table";

function HomeContent() {
  const { accounts, loading } = useAccountsContext();

  const transactionsData = useMemo(
    () => buildLedgerTransactions(accounts),
    [accounts],
  );

  return (
    <div className="min-h-screen h-full p-4 flex items-center justify-center font-sans">
      <div className="w-full h-full p-4 bg-zinc-100 rounded-lg overflow-y-auto">
        {loading ? (
          <div className="bg-white rounded-lg p-6">
            <LoadingState
              message="Loading transactions..."
              variant="skeleton"
              rows={8}
            />
          </div>
        ) : (
          <DashboardTransactionsTable
            columns={transactionsColumns}
            data={transactionsData}
          />
        )}
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <AccountsLedgerProvider mode="all">
      <HomeContent />
    </AccountsLedgerProvider>
  );
}
