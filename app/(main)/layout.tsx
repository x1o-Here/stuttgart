import AppSidebar from "@/components/layout/sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { RequireAuth } from "@/contexts/auth-context";
import { LookupSubscription } from "@/contexts/lookup-context";
import { AccountsProvider } from "@/contexts/useAccountsContext";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RequireAuth>
      <SidebarProvider className="h-screen w-screen">
        <AccountsProvider>
          <LookupSubscription>
            <AppSidebar />
            <main className="flex-1 overflow-auto">{children}</main>
          </LookupSubscription>
        </AccountsProvider>
      </SidebarProvider>
    </RequireAuth>
  );
}
