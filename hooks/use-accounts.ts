"use client";

import {
  collection,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
} from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import { db } from "@/lib/firebase/firebase-client";
import { useAuth } from "@/contexts/auth-context";

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

export function useAccounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { activeCompany } = useAuth();

  // Keep transaction unsubscribers per account
  const transactionUnsubs = useRef<Record<string, () => void>>({});

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

    const unsubscribeAccounts = onSnapshot(
      accountsQuery,
      (snapshot) => {
        setAccounts((prev) => {
          const accountMap = new Map(prev.map((a) => [a.id, a]));

          snapshot.docChanges().forEach((change) => {
            const id = change.doc.id;
            const data = change.doc.data() as any;

            if (change.type === "removed") {
              accountMap.delete(id);

              // cleanup transaction listener
              transactionUnsubs.current[id]?.();
              delete transactionUnsubs.current[id];
              return;
            }

            const account: Account = {
              id,
              name: data.name || "Unnamed Account",
              accountType: data.accountType,
              balance: data.balance || 0,
              transactions: accountMap.get(id)?.transactions || [],
              initialBalance: data.initialBalance || 0,
              createdAt:
                data.createdAt instanceof Timestamp
                  ? data.createdAt.toDate()
                  : data.createdAt,
            };

            accountMap.set(id, account);

            // 🔁 Attach transaction listener once per account
            if (!transactionUnsubs.current[id]) {
              const txQuery = query(
                collection(db, "companies", activeCompany, "accounts", id, "transactions"),
                orderBy("date", "desc"),
              );

              transactionUnsubs.current[id] = onSnapshot(txQuery, (txSnap) => {
                const transactions: Transaction[] = txSnap.docs.map((tx) => {
                  const t = tx.data() as any;
                  return {
                    id: tx.id,
                    vehicleId: t.vehicleId,
                    description: t.description || "",
                    department: t.department || "",
                    vehicle: t.vehicle || "",
                    voucher: t.voucherNo || 0,
                    amount: t.amount || 0,
                    type: t.type,
                    tags: t.tags || [],
                    date:
                      t.date instanceof Timestamp ? t.date.toDate() : t.date,
                    createdAt:
                      t.createdAt instanceof Timestamp ? t.createdAt.toDate() : t.createdAt,
                  };
                });

                setAccounts((current) =>
                  current.map((acc) =>
                    acc.id === id ? { ...acc, transactions } : acc,
                  ),
                );
              });
            }
          });

          setLoading(false);
          return Array.from(accountMap.values());
        });
      },
      (err) => {
        console.error("Failed to fetch accounts:", err);
        setError("Failed to fetch accounts");
        setLoading(false);
      },
    );

    return () => {
      unsubscribeAccounts();
      Object.values(transactionUnsubs.current).forEach((unsub) => unsub());
      transactionUnsubs.current = {};
    };
  }, [activeCompany]);

  return { accounts, loading, error };
}
