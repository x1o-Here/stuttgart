"use client";

import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase/firebase-client";
import { toDate } from "@/lib/helpers/to-date";
import type { SparePart, SparePartStatus } from "@/lib/inventory/spare-parts";

/** Live list of the active company's spare parts (deleted ones excluded). */
export function useSpareParts() {
  const { activeCompany } = useAuth();
  const [parts, setParts] = useState<SparePart[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeCompany) {
      setParts([]);
      setLoading(true);
      return;
    }
    setLoading(true);
    return onSnapshot(
      query(
        collection(db, "companies", activeCompany, "spareParts"),
        // Single-field order only (no composite index); deleted rows are
        // filtered below.
        orderBy("createdAt", "desc"),
      ),
      (snapshot) => {
        setParts(
          snapshot.docs
            .filter((d) => d.data().entityStatus !== false)
            .map((d) => {
              const data = d.data();
              return {
                id: d.id,
                partId: (data.partId as string) ?? "",
                partIdKey: (data.partIdKey as string) ?? "",
                description: (data.description as string) ?? "",
                status: (data.status as SparePartStatus) ?? "in_stock",
                vehicleId: (data.vehicleId as string | null) ?? null,
                assignedAt: toDate(data.assignedAt),
                createdAt: toDate(data.createdAt),
              };
            }),
        );
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.error("Failed to load spare parts:", err);
        setError("Couldn’t load inventory. Check your connection and access.");
        setLoading(false);
      },
    );
  }, [activeCompany]);

  return { parts, loading, error };
}
