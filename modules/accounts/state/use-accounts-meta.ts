"use client";

import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db, toDate, useAuth } from "@/modules/platform";
import type { Account } from "../domain/types";

/** Accounts collection only — no transaction subcollection listeners. */
export function useAccountsMeta() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { activeCompany } = useAuth();

  useEffect(() => {
    if (!activeCompany) {
      setAccounts([]);
      setLoading(true);
      return;
    }

    setAccounts([]);
    setLoading(true);
    setError(null);

    const accountsQuery = query(
      collection(db, "companies", activeCompany, "accounts"),
      orderBy("createdAt", "desc"),
    );

    const unsubscribe = onSnapshot(
      accountsQuery,
      (snapshot) => {
        const next: Account[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data() as Record<string, any>;
          return {
            id: docSnap.id,
            name: data.name || "Unnamed Account",
            accountType: data.accountType,
            balance: data.balance || 0,
            transactions: [],
            initialBalance: data.initialBalance || 0,
            createdAt: toDate(data.createdAt),
          };
        });
        setAccounts(next);
        setLoading(false);
      },
      (err) => {
        console.error("Failed to fetch accounts:", err);
        setError("Failed to fetch accounts");
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [activeCompany]);

  return { accounts, loading, error, activeCompany };
}

/** @deprecated Prefer useAccountsMeta + AccountsLedgerProvider. */
export function useAccounts() {
  return useAccountsMeta();
}
