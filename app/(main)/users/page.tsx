"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LoadingState } from "@/components/shared/loading-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/auth-context";
import AddUserDialog from "./components/add-user-dialog";
import CompaniesTable from "./components/companies-table";
import CompanyFormDialog from "./components/company-form-dialog";
import UsersTable from "./components/users-table";

export default function UserManagementPage() {
  const { role, loading } = useAuth();
  const router = useRouter();
  const [usersRefreshToken, setUsersRefreshToken] = useState(0);
  const [companiesRefreshToken, setCompaniesRefreshToken] = useState(0);
  const [tab, setTab] = useState("users");

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
          <h1 className="text-2xl font-bold">
            {tab === "companies" ? "Companies" : "Users"}
          </h1>

          {tab === "users" ? (
            <AddUserDialog
              onCreated={() => setUsersRefreshToken((token) => token + 1)}
            />
          ) : (
            <CompanyFormDialog
              mode="create"
              onSaved={() =>
                setCompaniesRefreshToken((token) => token + 1)
              }
            />
          )}
        </div>

        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="gap-1 p-0 bg-transparent mb-2">
            <TabsTrigger
              value="users"
              className="data-[state=active]:bg-white data-[state=active]:shadow-none data-[state=active]:font-medium font-normal cursor-pointer"
            >
              Users
            </TabsTrigger>
            <TabsTrigger
              value="companies"
              className="data-[state=active]:bg-white data-[state=active]:shadow-none data-[state=active]:font-medium font-normal cursor-pointer"
            >
              Companies
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="mt-2">
            <div className="p-4 bg-white rounded-md flex flex-col gap-4">
              <UsersTable refreshToken={usersRefreshToken} />
            </div>
          </TabsContent>

          <TabsContent value="companies" className="mt-2">
            <div className="p-4 bg-white rounded-md flex flex-col gap-4">
              <CompaniesTable refreshToken={companiesRefreshToken} />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
