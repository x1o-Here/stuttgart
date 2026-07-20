"use client";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
} from "firebase/firestore";
import { useCallback, useEffect, useMemo, useState } from "react";
import { LoadingState } from "@/components/shared/loading-state";
import { useAuth } from "@/contexts/auth-context";
import { mapCompanyDoc } from "@/lib/companies/types";
import { db } from "@/lib/firebase/firebase-client";
import { getCompaniesColumns, type CompanyRecord } from "./companies-columns";
import { DataTable } from "./data-table";

export default function CompaniesTable({
  refreshToken = 0,
}: {
  refreshToken?: number;
}) {
  const { user, role } = useAuth();
  const [companies, setCompanies] = useState<CompanyRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const loadCompanies = useCallback(async () => {
    setLoading(true);
    try {
      if (role === "admin") {
        const snapshot = await getDocs(
          query(collection(db, "companies"), orderBy("name", "asc")),
        );
        setCompanies(
          snapshot.docs.map((companyDoc) =>
            mapCompanyDoc(companyDoc.id, companyDoc.data()),
          ),
        );
        return;
      }

      if (!user) {
        setCompanies([]);
        return;
      }

      const userSnap = await getDoc(doc(db, "users", user.uid));
      const companyIds = Array.isArray(userSnap.data()?.companies)
        ? (userSnap.data()?.companies as string[])
        : [];

      if (companyIds.length === 0) {
        setCompanies([]);
        return;
      }

      const snaps = await Promise.all(
        companyIds.map((companyId) => getDoc(doc(db, "companies", companyId))),
      );

      const records = snaps
        .filter((snap) => snap.exists())
        .map((snap) =>
          mapCompanyDoc(snap.id, snap.data() as Record<string, unknown>),
        )
        .sort((a, b) => a.name.localeCompare(b.name));

      setCompanies(records);
    } catch (error) {
      console.error("Error fetching companies:", error);
    } finally {
      setLoading(false);
    }
  }, [role, user]);

  useEffect(() => {
    void loadCompanies();
  }, [loadCompanies, refreshToken]);

  const columns = useMemo(
    () => getCompaniesColumns(() => void loadCompanies()),
    [loadCompanies],
  );

  if (loading) {
    return <LoadingState message="Loading companies..." variant="compact" />;
  }

  return (
    <div className="w-full">
      <DataTable columns={columns} data={companies} />
    </div>
  );
}
