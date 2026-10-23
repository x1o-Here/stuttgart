"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo } from "react";
import { LoadingState } from "@/components/shared/loading-state";
import { HeaderFigure, PageHeader } from "@/components/shared/page-header";
import {
  AccountsLedgerProvider,
  useAccountsContext,
} from "@/contexts/useAccountsContext";
import { toDate } from "@/lib/helpers/to-date";
import { isActiveTransaction } from "@/lib/helpers/transaction-tags";
import { transactionsColumns } from "./components/transactions-columns";
import { TransactionsDataTable } from "./components/transactions-table";

function AccountPageContent({ accountId }: { accountId: string }) {
  const { accounts, loading } = useAccountsContext();
  const account = accounts.find((acc) => acc.id === accountId);

  const transactionsWithRB = useMemo(() => {
    if (!account) return [];

    // Sort Newest first (Matching the table's default display) to calculate running balance backwards
    const sorted = [...account.transactions].sort((a, b) => {
      const dateA = toDate(a.date)?.getTime() || 0;
      const dateB = toDate(b.date)?.getTime() || 0;

      if (dateA !== dateB) return dateB - dateA;

      const createdA = toDate(a.createdAt)?.getTime() || 0;
      const createdB = toDate(b.createdAt)?.getTime() || 0;

      if (createdA !== createdB) return createdB - createdA;

      // Tie-breaker: New/Correction entries should come BEFORE reversals in DESC order
      const isReversalA = a.tags?.includes("reversal") ? 1 : 0;
      const isReversalB = b.tags?.includes("reversal") ? 1 : 0;
      return isReversalA - isReversalB;
    });

    let currentRB = account.balance || 0;

    const withRB = sorted.map((tx) => {
      const trWithRB = {
        ...tx,
        runningBalance: currentRB,
      };

      // Undo this transaction's impact to get the balance for the previous (older) one
      const amount = tx.amount || 0;
      if (tx.type === "credit") {
        currentRB -= amount;
      } else {
        currentRB += amount;
      }

      return trWithRB;
    });

    return withRB;
  }, [account]);

  const formattedAmount = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(account?.balance || 0);

  if (loading) {
    return (
      <div className="flex h-full flex-col bg-card font-sans">
        <div className="p-4 md:p-6">
          <LoadingState
            message="Loading account..."
            variant="skeleton"
            rows={6}
          />
        </div>
      </div>
    );
  }

  if (!account) {
    return <AccountNotFound />;
  }

  const credits = account.transactions.filter(
    (tx) => tx.type === "credit" && isActiveTransaction(tx.tags),
  ).length;
  const debits = account.transactions.filter(
    (tx) => tx.type === "debit" && isActiveTransaction(tx.tags),
  ).length;

  return (
    <div className="flex h-full flex-col divide-y bg-card font-sans">
      <PageHeader
        eyebrow={
          <Link
            href="/accounts"
            className="inline-flex items-center gap-1 hover:text-foreground"
          >
            <ArrowLeft className="size-3" />
            Accounts · {account.accountType || "Unassigned"}
          </Link>
        }
        title={account.name}
        description={`${credits} credits · ${debits} debits`}
        actions={
          <HeaderFigure
            label="( Current balance )"
            unit="LKR"
            value={formattedAmount}
            tone={account.balance < 0 ? "negative" : "default"}
          />
        }
      />

      <TransactionsDataTable
        columns={transactionsColumns}
        data={transactionsWithRB}
      />
    </div>
  );
}

function AccountNotFound() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 bg-card p-6 text-center font-sans">
      <span className="eyebrow">( Not found )</span>
      <p className="heading text-2xl">
        <span className="text-muted-foreground">This account</span> doesn’t
        exist.
      </p>
      <Link
        href="/accounts"
        className="font-mono text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
      >
        Back to accounts
      </Link>
    </div>
  );
}

export default function AccountPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";

  if (!id) {
    return <AccountNotFound />;
  }

  return (
    <AccountsLedgerProvider mode={id}>
      <AccountPageContent accountId={id} />
    </AccountsLedgerProvider>
  );
}
