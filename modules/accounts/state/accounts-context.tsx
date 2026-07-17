"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useMemo,
} from "react";
import type { Account } from "../domain/types";
import { useAccountsMeta } from "./use-accounts-meta";

export interface AccountsContextValue {
  accounts: Account[];
  loading: boolean;
  error: string | null;
}

export const AccountsContext = createContext<AccountsContextValue | undefined>(
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

export function useAccountsContext() {
  const context = useContext(AccountsContext);
  if (!context) {
    throw new Error("useAccountsContext must be used within AccountsProvider");
  }
  return context;
}
