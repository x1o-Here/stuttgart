"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LoadingState } from "@/components/shared/loading-state";
import { listUsers } from "@/lib/data/identity";
import { createUserColumns, type UserData } from "./columns";
import { getAllCompanies } from "./companies-cache";
import { DataTable } from "./data-table";

export default function UsersTable({
  refreshToken = 0,
}: {
  refreshToken?: number;
}) {
  const [users, setUsers] = useState<UserData[]>([]);
  const [companyNames, setCompanyNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const [rows, companyOptions] = await Promise.all([
        listUsers(),
        getAllCompanies().catch(() => []),
      ]);
      setUsers(rows);
      setCompanyNames(
        Object.fromEntries(companyOptions.map((c) => [c.id, c.name])),
      );
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: refreshToken is a "reload now" signal from the parent
  useEffect(() => {
    loadUsers();
  }, [loadUsers, refreshToken]);

  const columns = useMemo(
    () => createUserColumns({ onChanged: () => void loadUsers() }),
    [loadUsers],
  );

  if (loading) {
    return (
      <div className="p-4">
        <LoadingState message="Loading users..." variant="skeleton" rows={5} />
      </div>
    );
  }

  return (
    <DataTable
      columns={columns}
      // Active users first; removed ones stay listed for traceability.
      data={[...users]
        .sort((a, b) => Number(a.removed) - Number(b.removed))
        .map((user) => ({
          ...user,
          companyNames: user.companies.map((id) => companyNames[id] ?? id),
        }))}
      caption="User directory"
      searchPlaceholder="Search by username, email or role"
      emptyMessage="No users yet."
    />
  );
}
