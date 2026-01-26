"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/contexts/auth-context";
import AddUserDialog from "./components/add-user-dialog";
import UsersTable from "./components/users-table";

export default function UserManagementPage() {
  const { role, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && role !== "admin" && role !== "manager") {
      router.push("/");
    }
  }, [role, loading, router]);

  if (loading || (role !== "admin" && role !== "manager")) {
    return null; // Or a loading spinner / unauthorized message
  }

  return (
    <div className="min-h-screen h-full p-4 flex items-center justify-center font-sans">
      <div className="w-full h-full p-4 bg-zinc-100 rounded-lg overflow-y-auto">
        <div className="w-full flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Users</h1>

          <AddUserDialog />
        </div>

        <div className="mt-2 p-4 bg-white rounded-md flex flex-col gap-4">
          <UsersTable />
        </div>
      </div>
    </div>
  );
}
