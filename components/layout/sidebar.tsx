"use client";

import { signOut } from "firebase/auth";
import { LogOut, Regex, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { MainSidebarContent } from "@/data/sidebar-items";
import { getActiveSidebarRoute } from "@/lib/active-route";
import { isMechanic, type Role, roleLabel } from "@/lib/auth/roles";
import { auth } from "@/lib/firebase/firebase-client";
import { cn } from "@/lib/utils";
import { Sidebar, SidebarContent, SidebarHeader } from "../custom/ui/sidebar";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "../ui/sidebar";

export default function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const activeRoute = getActiveSidebarRoute(pathname);
  const { username, role } = useAuth();

  async function handleLogout() {
    try {
      await signOut(auth);
      // AuthContext will handle redirect, but we can force it too
      // router.push("/sign-in");
    } catch (error) {
      console.error("Failed to log out", error);
    }
  }

  const visibleItems = MainSidebarContent.filter((item) =>
    item.roles ? item.roles.includes(role as Role) : !isMechanic(role),
  );

  return (
    <Sidebar collapsible="none" className="h-full flex flex-col bg-canvas">
      <SidebarHeader className="border-b px-4 py-0">
        <div className="flex h-14 items-center gap-2">
          <Regex className="size-6 text-destructive" strokeWidth={1.5} />
          <span className="font-bodoni text-2xl font-light text-foreground/80">
            Stuttgart
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent className="flex-1 gap-0 px-2 py-3">
        <span className="eyebrow px-2 pb-2">( Modules )</span>
        <SidebarMenu className="gap-y-0.5">
          {visibleItems.map((item, index) => {
            const isActive = activeRoute === item.key;

            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  className={cn(
                    "h-9 rounded-md px-2 transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground active:bg-primary active:text-primary-foreground"
                      : "text-muted-foreground hover:bg-card hover:text-foreground",
                  )}
                  asChild
                >
                  <Link href={item.href}>
                    <item.icon />
                    <span className="flex-1">{item.title}</span>
                    <span
                      className={cn(
                        "font-mono text-[10px] tabular-nums",
                        isActive
                          ? "text-primary-foreground/60"
                          : "text-muted-foreground/70",
                      )}
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>

      <div className="border-t px-2 py-2">
        <SidebarMenu className="gap-y-0.5">
          {!isMechanic(role) && (
            <SidebarMenuItem>
              <SidebarMenuButton
                className={cn(
                  "h-9 cursor-pointer rounded-md px-2",
                  activeRoute === "settings"
                    ? "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
                    : "text-muted-foreground hover:bg-card hover:text-foreground",
                )}
                onClick={() => router.push("/settings")}
              >
                <Settings />
                <span>Settings</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          <SidebarMenuItem>
            <SidebarMenuButton
              className="h-9 cursor-pointer rounded-md px-2 text-muted-foreground hover:bg-danger-soft hover:text-destructive"
              onClick={handleLogout}
            >
              <LogOut />
              <span>Log out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </div>

      <Link
        href="/profile"
        className={cn(
          "flex items-center gap-3 border-t px-4 py-3 transition-colors",
          activeRoute === "profile" ? "bg-card" : "hover:bg-card",
        )}
      >
        <Avatar className="rounded-md">
          <AvatarFallback className="rounded-md bg-primary font-mono text-xs text-primary-foreground">
            {username ? username.substring(0, 2).toUpperCase() : "U"}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium leading-tight">
            {username || "User"}
          </p>
          <p className="eyebrow normal-case tracking-normal capitalize">
            {roleLabel(role)}
          </p>
        </div>
      </Link>
    </Sidebar>
  );
}
