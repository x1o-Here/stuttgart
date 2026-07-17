import { SidebarProvider } from "@/components/ui/sidebar";
import { AccountsProvider } from "@/modules/accounts";
import { LookupSubscription } from "@/modules/catalog";
import { AppSidebar, RequireAuth } from "@/modules/platform";

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
