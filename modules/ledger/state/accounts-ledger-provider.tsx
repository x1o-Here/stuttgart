"use client";

import { type ReactNode, useMemo } from "react";
import {
  AccountsContext,
  useAccountsContext,
} from "@/modules/accounts/state/accounts-context";
import { useAuth } from "@/modules/platform";
import {
  mergeAccountsWithTransactions,
  useAccountTransactionsMap,
} from "./use-account-transactions";

type LedgerMode = "all" | string;

/**
 * Nested provider that attaches transaction listeners and overrides accounts
 * for descendants. Use mode="all" on home/reports, or an account id on detail.
 */
export function AccountsLedgerProvider({
  children,
  mode,
}: {
  children: ReactNode;
  mode: LedgerMode;
}) {
  const parent = useAccountsContext();
  const { activeCompany } = useAuth();

  const accountIds = useMemo(() => {
    if (mode === "all") return parent.accounts.map((a) => a.id);
    return parent.accounts.some((a) => a.id === mode) ? [mode] : [];
  }, [mode, parent.accounts]);

  const { txByAccount, loading: txLoading } = useAccountTransactionsMap(
    activeCompany || undefined,
    accountIds,
  );

  const accounts = useMemo(() => {
    if (mode === "all") {
      return mergeAccountsWithTransactions(parent.accounts, txByAccount);
    }
    return parent.accounts.map((account) =>
      account.id === mode
        ? {
            ...account,
            transactions: txByAccount[mode] ?? account.transactions,
          }
        : account,
    );
  }, [mode, parent.accounts, txByAccount]);

  const value = useMemo(
    () => ({
      accounts,
      loading: parent.loading || (accountIds.length > 0 && txLoading),
      error: parent.error,
    }),
    [accounts, parent.loading, parent.error, accountIds.length, txLoading],
  );

  return (
    <AccountsContext.Provider value={value}>{children}</AccountsContext.Provider>
  );
}
