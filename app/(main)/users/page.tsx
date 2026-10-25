"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LoadingState } from "@/components/shared/loading-state";
import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/auth-context";
import AddUserDialog from "./components/add-user-dialog";
import AuditLogsTable from "./components/audit-logs-table";
import CompaniesTable from "./components/companies-table";
import CompanyFormDialog from "./components/company-form-dialog";
import UsersTable from "./components/users-table";

const TAB_TRIGGER =
  "h-10 flex-none rounded-none border-0 border-b-2 border-transparent bg-transparent px-1 font-normal text-muted-foreground shadow-none data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none";

const TAB_COPY: Record<string, { lead: string; title: string }> = {
  users: { lead: "Team and", title: "access." },
  companies: { lead: "Companies and", title: "suppliers." },
  "audit-logs": { lead: "Audit", title: "log." },
};

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
      <div className="flex h-full items-center justify-center bg-card font-sans">
        <LoadingState message="Checking access..." />
      </div>
    );
  }

  if (role !== "admin" && role !== "manager") {
    return null;
  }

  const copy = TAB_COPY[tab] ?? TAB_COPY.users;

  return (
    <div className="flex h-full flex-col bg-card font-sans">
      <PageHeader
        eyebrow={`( Administration · ${role === "admin" ? "Admin" : "Manager"} )`}
        lead={copy.lead}
        title={copy.title}
        className="border-b"
        actions={
          tab === "users" ? (
            <AddUserDialog
              onCreated={() => setUsersRefreshToken((token) => token + 1)}
            />
          ) : tab === "companies" ? (
            <CompanyFormDialog
              mode="create"
              onSaved={() => setCompaniesRefreshToken((token) => token + 1)}
            />
          ) : null
        }
      />

      <Tabs
        value={tab}
        onValueChange={setTab}
        className="flex min-h-0 flex-1 flex-col gap-0"
      >
        <TabsList className="h-auto w-full justify-start gap-6 rounded-none border-0 border-b bg-transparent p-0 px-4 md:px-6">
          <TabsTrigger value="users" className={TAB_TRIGGER}>
            01 / Users
          </TabsTrigger>
          <TabsTrigger value="companies" className={TAB_TRIGGER}>
            02 / Companies
          </TabsTrigger>
          <TabsTrigger value="audit-logs" className={TAB_TRIGGER}>
            03 / Audit log
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="users"
          className="mt-0 flex min-h-0 flex-1 flex-col"
        >
          <UsersTable refreshToken={usersRefreshToken} />
        </TabsContent>

        <TabsContent
          value="companies"
          className="mt-0 flex min-h-0 flex-1 flex-col"
        >
          <CompaniesTable refreshToken={companiesRefreshToken} />
        </TabsContent>

        <TabsContent
          value="audit-logs"
          className="mt-0 flex min-h-0 flex-1 flex-col"
        >
          <AuditLogsTable />
        </TabsContent>
      </Tabs>
    </div>
  );
}
