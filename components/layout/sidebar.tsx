"use client";

import { signOut } from "firebase/auth";
import { LogOut, Regex } from "lucide-react";
import { Bodoni_Moda } from "next/font/google";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { MainSidebarContent } from "@/data/sidebar-items";
import { getActiveSidebarRoute } from "@/lib/active-route";
import { auth } from "@/lib/firebase/firebase-client";
import { cn } from "@/lib/utils";
import { Sidebar, SidebarContent, SidebarHeader } from "../custom/ui/sidebar";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { Separator } from "../ui/separator";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "../ui/sidebar";

const bodoniModa = Bodoni_Moda({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

export default function AppSidebar() {
  const pathname = usePathname();
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

  return (
    <Sidebar
      collapsible="none"
      className="h-full flex flex-col justify-between p-1"
    >
      <div>
        <SidebarHeader className="flex items-center gap-2">
          <Regex className="size-7 text-red-500" strokeWidth={1.5} />
          <span
            className={cn(
              bodoniModa.className,
              "text-3xl text-gray-700 font-light",
            )}
          >
            Stuttgart
          </span>
        </SidebarHeader>

        <SidebarContent className="mt-4">
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu className="gap-y-2">
                {MainSidebarContent.map((item) => {
                  // Role-based visibility for Users menu
                  if (item.key === "users") {
                    if (role !== "admin" && role !== "manager") {
                      return null;
                    }
                  }

                  const isActive = activeRoute === item.key;

                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        className={cn(
                          "flex w-full items-center rounded-lg px-2 py-1",
                          isActive
                            ? "bg-zinc-100 text-zinc-800"
                            : "text-gray-600 hover:text-zinc-800 hover:bg-zinc-100",
                        )}
                        asChild
                      >
                        <a href={item.href}>
                          <item.icon className="mr-1" />
                          <span>{item.title}</span>
                        </a>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </div>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-y-2">
              <SidebarMenuItem>
                <SidebarMenuButton
                  className="text-gray-600 hover:text-red-500 hover:bg-red-100 flex w-full items-center rounded-lg px-2 py-1 cursor-pointer"
                  onClick={handleLogout}
                >
                  <LogOut className="mr-1" />
                  <span>Logout</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>

          <Separator className="my-2" />

          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className={cn(
                "flex w-full items-center rounded-lg px-2 py-1",
                activeRoute === "profile"
                  ? "bg-zinc-100 text-zinc-800"
                  : "text-gray-600 hover:text-zinc-800 hover:bg-zinc-100",
              )}
              asChild
            >
              <Link href="#" className="text-gray-600 hover:text-zinc-800">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback>
                      {username ? username.substring(0, 2).toUpperCase() : "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="">
                    <p className="font-medium leading-none">
                      {username || "User"}
                    </p>
                    <p className="text-xs font-light text-gray-500 capitalize">
                      {role || "Role"}
                    </p>
                  </div>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
