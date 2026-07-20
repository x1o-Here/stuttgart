"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useMemo,
} from "react";
import { useAuth } from "@/contexts/auth-context";
import {
  type Account,
  mergeAccountsWithTransactions,
  useAccountTransactionsMap,
  useAccountsMeta,
} from "@/hooks/use-accounts";

interface AccountsContextValue {
  accounts: Account[];
  loading: boolean;
  error: string | null;
}

const AccountsContext = createContext<AccountsContextValue | undefined>(
  undefined,
);

/** Layout-safe: accounts list only (no transaction listeners). */
export function AccountsProvider({ children }: { children: ReactNode }) {
  const { accounts, loading, error } = useAccountsMeta();

  const value = useMemo(
    () => ({ accounts, loading, error }),
    [accounts, loading, error],
  );

  return (
    <AccountsContext.Provider value={value}>{children}</AccountsContext.Provider>
  );
}

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

export function useAccountsContext() {
  const context = useContext(AccountsContext);
  if (!context) {
    throw new Error("useAccountsContext must be used within AccountsProvider");
  }
  return context;
}
