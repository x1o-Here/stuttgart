"use client";

import { RoleGate } from "@/components/layout/role-gate";
import AppSidebar from "@/components/layout/sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { RequireAuth, useAuth } from "@/contexts/auth-context";
import { LookupSubscription } from "@/contexts/lookup-context";
import { AccountsProvider } from "@/contexts/useAccountsContext";
import { isMechanic } from "@/lib/auth/roles";

/** Mechanics never see ledger pages, so they skip the accounts listeners. */
function LedgerProviders({ children }: { children: React.ReactNode }) {
  const { role } = useAuth();
  if (isMechanic(role)) return children;
  return <AccountsProvider>{children}</AccountsProvider>;
}

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RequireAuth>
      <SidebarProvider className="h-screen w-screen bg-canvas">
        <LedgerProviders>
          <LookupSubscription>
            <AppSidebar />
            <main className="min-w-0 flex-1 overflow-auto border-l">
              <RoleGate>{children}</RoleGate>
            </main>
          </LookupSubscription>
        </LedgerProviders>
      </SidebarProvider>
    </RequireAuth>
  );
}
