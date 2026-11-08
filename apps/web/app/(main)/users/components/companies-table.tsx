"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LoadingState } from "@/components/shared/loading-state";
import { useAuth } from "@/contexts/auth-context";
import { listCompanies } from "@/lib/data/identity";
import { type CompanyRecord, getCompaniesColumns } from "./companies-columns";
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
      setCompanies(await listCompanies(role, user));
    } catch (error) {
      console.error("Error fetching companies:", error);
    } finally {
      setLoading(false);
    }
  }, [role, user]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: refreshToken is a "reload now" signal from the parent
  useEffect(() => {
    void loadCompanies();
  }, [loadCompanies, refreshToken]);

  const columns = useMemo(
    () => getCompaniesColumns(() => void loadCompanies()),
    [loadCompanies],
  );

  if (loading) {
    return (
      <div className="p-4">
        <LoadingState
          message="Loading companies..."
          variant="skeleton"
          rows={4}
        />
      </div>
    );
  }

  return (
    <DataTable
      columns={columns}
      data={companies}
      caption="Companies"
      searchPlaceholder="Search by name, TIN or telephone"
      emptyMessage="No companies yet."
    />
  );
}
