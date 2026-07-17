"use client";

import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { useEffect, useState } from "react";
import { LoadingState } from "@/components/shared/loading-state";
import { db } from "@/lib/firebase/firebase-client";
import { columns, type UserData } from "./columns";
import { DataTable } from "./data-table";

export default function UsersTable() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const usersRef = collection(db, "users");
    const q = query(usersRef, orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetchedUsers: UserData[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          fetchedUsers.push({
            id: doc.id,
            username: data.username || "N/A",
            email: data.email || "N/A",
            role: data.role || "user",
            companies: data.companies || [],
            createdAt: data.createdAt,
          });
        });
        setUsers(fetchedUsers);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching users:", error);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, []);

  if (loading) {
    return <LoadingState message="Loading users..." variant="compact" />;
  }

  return (
    <div className="w-full">
      <DataTable columns={columns} data={users} />
    </div>
  );
}
