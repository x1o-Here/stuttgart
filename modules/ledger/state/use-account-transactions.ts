"use client";

import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import type { Account, Transaction } from "@/modules/accounts/domain/types";
import { db, toDate } from "@/modules/platform";

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
