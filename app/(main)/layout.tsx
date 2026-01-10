import AppSidebar from "@/components/layout/sidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

export default function MainLayout({ children }: { children: React.ReactNode }) {
    return (
        <SidebarProvider className="h-screen w-screen"> 
            <AppSidebar />
            <main className="flex-1 overflow-auto">
                {children}
            </main>
        </SidebarProvider>
    )
}