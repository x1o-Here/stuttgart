"use client";

import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase/firebase-client";
import { toDate } from "@/lib/helpers/to-date";

export type Transaction = {
  id: string;
  date: Date;
  description: string;
  amount: number;
  type: "debit" | "credit";
  department: string;
  vehicle: string;
  voucher: number;
  createdAt?: Date;
  tags?: string[];
  runningBalance?: number;
};

export type Account = {
  id: string;
  name: string;
  accountType?: string;
  balance: number;
  transactions: Transaction[];
  createdAt?: Date;
  initialBalance: number;
};

function mapTransactionDoc(tx: {
  id: string;
  data: () => Record<string, unknown>;
}): Transaction {
  const t = tx.data() as Record<string, any>;
  return {
    id: tx.id,
    description: t.description || "",
    department: t.department || "",
    vehicle: t.vehicle || "",
    voucher: t.voucherNo || 0,
    amount: t.amount || 0,
    type: t.type,
    tags: t.tags || [],
    date: toDate(t.date) || new Date(),
    createdAt: toDate(t.createdAt),
  };
}

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

/**
 * Live transaction listeners for the given account ids.
 * Pass a single id for account detail, or all meta account ids for home/reports.
 */
export function useAccountTransactionsMap(
  companyId: string | undefined,
  accountIds: string[],
) {
  const [txByAccount, setTxByAccount] = useState<Record<string, Transaction[]>>(
    {},
  );
  const [loading, setLoading] = useState(true);
  const unsubsRef = useRef<Record<string, () => void>>({});
  const accountIdsKey = accountIds.slice().sort().join(",");

  useEffect(() => {
    if (!companyId || accountIds.length === 0) {
      Object.values(unsubsRef.current).forEach((u) => u());
      unsubsRef.current = {};
      setTxByAccount({});
      setLoading(false);
      return;
    }

    setLoading(true);
    const wanted = new Set(accountIds);

    // Tear down listeners for accounts no longer needed
    for (const id of Object.keys(unsubsRef.current)) {
      if (!wanted.has(id)) {
        unsubsRef.current[id]();
        delete unsubsRef.current[id];
        setTxByAccount((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }
    }

    let pendingFirst = accountIds.filter((id) => !unsubsRef.current[id]).length;
    if (pendingFirst === 0) {
      setLoading(false);
    }

    for (const id of accountIds) {
      if (unsubsRef.current[id]) continue;

      const txQuery = query(
        collection(db, "companies", companyId, "accounts", id, "transactions"),
        orderBy("date", "desc"),
      );

      unsubsRef.current[id] = onSnapshot(
        txQuery,
        (txSnap) => {
          const transactions = txSnap.docs.map((docSnap) =>
            mapTransactionDoc(docSnap),
          );
          setTxByAccount((prev) => ({ ...prev, [id]: transactions }));
          if (pendingFirst > 0) {
            pendingFirst -= 1;
            if (pendingFirst === 0) setLoading(false);
          }
        },
        (err) => {
          console.error(`Failed to fetch transactions for ${id}:`, err);
          if (pendingFirst > 0) {
            pendingFirst -= 1;
            if (pendingFirst === 0) setLoading(false);
          }
        },
      );
    }

    return () => {
      Object.values(unsubsRef.current).forEach((u) => u());
      unsubsRef.current = {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- accountIdsKey captures id set
  }, [companyId, accountIdsKey]);

  return { txByAccount, loading };
}

export function mergeAccountsWithTransactions(
  accounts: Account[],
  txByAccount: Record<string, Transaction[]>,
): Account[] {
  return accounts.map((account) => ({
    ...account,
    transactions: txByAccount[account.id] ?? account.transactions,
  }));
}

/** @deprecated Prefer useAccountsMeta + AccountsLedgerProvider. */
export function useAccounts() {
  return useAccountsMeta();
}
