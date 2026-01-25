import { AuthProvider } from "@/contexts/auth-context";
import AppSidebar from "@/components/layout/sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AccountsProvider } from "@/contexts/useAccountsContext";
import { AllVehiclesProvider } from "@/contexts/useAllVehiclesContext";

export default function MainLayout({ children }: { children: React.ReactNode }) {
    return (
        <AuthProvider>
            <SidebarProvider className="h-screen w-screen">
                <AllVehiclesProvider>
                    <AccountsProvider>
                        <AppSidebar />
                        <main className="flex-1 overflow-auto">
                            {children}
                        </main>
                    </AccountsProvider>
                </AllVehiclesProvider>
            </SidebarProvider>
        </AuthProvider>
    )
}