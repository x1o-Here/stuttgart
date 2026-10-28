import {
  ChartColumn,
  ContactRound,
  Factory,
  KeyRound,
  Landmark,
  LayoutDashboard,
  Settings2,
  SquareKanban,
  Truck,
  UserCog,
  Users,
  Warehouse,
} from "lucide-react";
import type { SidebarRouteKey } from "@/lib/active-route";
import type { Role } from "@/lib/auth/roles";

/** Roles that see an item; omitted = every role except mechanic. */
type SidebarItem = {
  key: SidebarRouteKey;
  title: string;
  href: string;
  icon: typeof LayoutDashboard;
  roles?: Role[];
};

const MainSidebarContent: SidebarItem[] = [
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
    key: "suppliers" as SidebarRouteKey,
    title: "Suppliers",
    href: "/suppliers",
    icon: Factory,
  },
  {
    key: "fleet" as SidebarRouteKey,
    title: "Fleet",
    href: "/fleet",
    icon: Truck,
  },
  {
    key: "inventory" as SidebarRouteKey,
    title: "Inventory",
    href: "/inventory",
    icon: Warehouse,
    roles: ["admin", "manager", "user", "mechanic"],
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
    roles: ["admin", "manager"],
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
