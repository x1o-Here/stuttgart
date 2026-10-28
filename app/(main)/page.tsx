"use client";

import { format } from "date-fns";
import { useMemo } from "react";
import { BlueprintLorry } from "@/components/shared/blueprint-lorry";
import { LoadingState } from "@/components/shared/loading-state";
import { useAuth } from "@/contexts/auth-context";
import {
  AccountsLedgerProvider,
  useAccountsContext,
} from "@/contexts/useAccountsContext";
import { AddTransactionDialog } from "./components/logistics/add-transaction-dialog";
import { buildLedgerTransactions } from "./components/logistics/build-ledger-transactions";
import { transactionsColumns } from "./components/logistics/columns";
import { DashboardTransactionsTable } from "./components/logistics/data-table";

function greeting(date: Date) {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function DashboardHero() {
  const { username, companies, activeCompany } = useAuth();
  const now = new Date();
  const companyName = companies.find((c) => c.id === activeCompany)?.name;

  return (
    <section className="relative grid overflow-hidden md:grid-cols-[1.1fr_1fr]">
      {/* Blueprint construction line */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -left-10 top-0 hidden h-px w-[140%] origin-top-left rotate-[17deg] bg-border md:block"
      />
      <div className="relative flex flex-col gap-2 px-4 py-4 md:px-6 md:py-5">
        <span className="eyebrow">
          {companyName ? `( Finance · ${companyName} )` : "( Finance )"}
        </span>
        <h1 className="heading text-2xl leading-tight md:text-3xl">
          <span className="text-muted-foreground">{greeting(now)},</span>{" "}
          <span className="text-foreground">{username || "there"}.</span>
        </h1>
        <p className="font-mono text-xs text-muted-foreground">
          {format(now, "EEEE, d MMMM yyyy")}
        </p>
        <div className="pt-1">
          <AddTransactionDialog />
        </div>
      </div>
      <div className="relative hidden items-end justify-center border-l px-6 pt-3 md:flex">
        <BlueprintLorry className="h-40 w-auto" />
      </div>
    </section>
  );
}

function HomeContent() {
  const { accounts, loading } = useAccountsContext();

  const transactionsData = useMemo(
    () => buildLedgerTransactions(accounts),
    [accounts],
  );

  return (
    <div className="h-full font-sans">
      <div className="flex min-h-full flex-col divide-y bg-card">
        <DashboardHero />
        {loading ? (
          <div className="p-6">
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
