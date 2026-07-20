"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LoadingState } from "@/components/shared/loading-state";
import { useAuth } from "@/contexts/auth-context";
import AddUserDialog from "./components/add-user-dialog";
import UsersTable from "./components/users-table";

export default function UserManagementPage() {
  const { role, loading } = useAuth();
  const router = useRouter();
  const [usersRefreshToken, setUsersRefreshToken] = useState(0);

  useEffect(() => {
    if (!loading && role !== "admin" && role !== "manager") {
      router.push("/");
    }
  }, [role, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen h-full p-4 flex items-center justify-center font-sans">
        <LoadingState message="Checking access..." />
      </div>
    );
  }

  if (role !== "admin" && role !== "manager") {
    return null;
  }

  return (
    <div className="min-h-screen h-full p-4 flex items-center justify-center font-sans">
      <div className="w-full h-full p-4 bg-zinc-100 rounded-lg overflow-y-auto">
        <div className="w-full flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Users</h1>

          <AddUserDialog
            onCreated={() => setUsersRefreshToken((token) => token + 1)}
          />
        </div>

        <div className="mt-2 p-4 bg-white rounded-md flex flex-col gap-4">
          <UsersTable refreshToken={usersRefreshToken} />
        </div>
      </div>
    </div>
  );
}
