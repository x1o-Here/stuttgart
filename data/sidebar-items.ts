import { KeyRound, Settings2, SquareKanban, Warehouse } from "lucide-react";
import type { SidebarRouteKey } from "@/lib/active-route";

const MainSidebarContent = [
  { 
    key: "dashboard" as SidebarRouteKey,
    title: "Dashboard", 
    href: "/",
    icon: Warehouse
  },
  { 
    key: "reports" as SidebarRouteKey,
    title: "Reports",
    href: "/reports", 
    icon: SquareKanban 
  },
  { 
    key: "accounts" as SidebarRouteKey,
    title: "Accounts", 
    href: "/accounts", 
    icon: KeyRound 
  },
];

const MainSidebarFooter = [
  { 
    key: "settings" as SidebarRouteKey,
    title: "Settings", 
    href: "/settings",
    icon: Settings2
  },
]

export { MainSidebarContent, MainSidebarFooter };