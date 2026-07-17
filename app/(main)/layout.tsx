import AppSidebar from "@/components/layout/sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AuthProvider } from "@/contexts/auth-context";
import { LookupProvider } from "@/contexts/lookup-context";
import { AccountsProvider } from "@/contexts/useAccountsContext";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <SidebarProvider className="h-screen w-screen">
          <AccountsProvider>
            <LookupProvider>
              <AppSidebar />
              <main className="flex-1 overflow-auto">{children}</main>
            </LookupProvider>
          </AccountsProvider>
      </SidebarProvider>
    </AuthProvider>
  );
}
