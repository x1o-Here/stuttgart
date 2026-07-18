import {
  ChartColumn,
  ContactRound,
  KeyRound,
  Landmark,
  LayoutDashboard,
  Settings2,
  SquareKanban,
  UserCog,
  Users,
  Warehouse,
} from "lucide-react";
import type { SidebarRouteKey } from "@/lib/active-route";

const MainSidebarContent = [
  {
    key: "dashboard" as SidebarRouteKey,
    title: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    key: "accounts" as SidebarRouteKey,
    title: "Accounts",
    href: "/accounts",
    icon: Landmark,
  },
  {
    key: "clients" as SidebarRouteKey,
    title: "Clients",
    href: "/clients",
    icon: ContactRound,
  },
  {
    key: "reports" as SidebarRouteKey,
    title: "Reports",
    href: "/reports",
    icon: ChartColumn,
  },
  {
    key: "users" as SidebarRouteKey,
    title: "Users",
    href: "/users",
    icon: UserCog,
  },
];

const MainSidebarFooter = [
  {
    key: "settings" as SidebarRouteKey,
    title: "Settings",
    href: "/settings",
    icon: Settings2,
  },
];

export { MainSidebarContent, MainSidebarFooter };
