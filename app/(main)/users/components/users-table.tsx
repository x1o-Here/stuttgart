"use client";

import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { useCallback, useEffect, useState } from "react";
import { LoadingState } from "@/components/shared/loading-state";
import { db } from "@/lib/firebase/firebase-client";
import { columns, type UserData } from "./columns";
import { DataTable } from "./data-table";

function mapUsersSnapshot(
  docs: { id: string; data: () => Record<string, unknown> }[],
): UserData[] {
  return docs.map((userDoc) => {
    const data = userDoc.data() as Record<string, any>;
    return {
      id: userDoc.id,
      username: data.username || "N/A",
      email: data.email || "N/A",
      role: data.role || "user",
      companies: data.companies || [],
      createdAt: data.createdAt,
    };
  });
}

export default function UsersTable({
  refreshToken = 0,
}: {
  refreshToken?: number;
}) {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const usersRef = collection(db, "users");
      const q = query(usersRef, orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      setUsers(mapUsersSnapshot(snapshot.docs));
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers, refreshToken]);

  if (loading) {
    return <LoadingState message="Loading users..." variant="compact" />;
  }

  return (
    <div className="w-full">
      <DataTable columns={columns} data={users} />
    </div>
  );
}
