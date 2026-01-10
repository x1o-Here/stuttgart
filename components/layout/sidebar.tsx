'use client'

import { MainSidebarContent, MainSidebarFooter } from "@/data/sidebar-items";
import { SidebarFooter, SidebarGroup, SidebarGroupLabel, SidebarGroupContent, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "../ui/sidebar";
import { Sidebar, SidebarHeader, SidebarContent } from "../custom/sidebar";
import { LogOut, Regex } from "lucide-react";
import { Separator } from "../ui/separator";
import { Button } from "../ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getActiveSidebarRoute } from "@/lib/active-route";
import { cn } from "@/lib/utils";
import { Badge } from "../ui/badge";

export default function AppSidebar() {
    const pathname = usePathname();
    const activeRoute = getActiveSidebarRoute(pathname);

    return (
        <Sidebar collapsible="none" className="h-full flex flex-col justify-between p-1">
            <div>
                <SidebarHeader className="flex items-center gap-2">
                    <Regex className="mb-2 h-8 w-8 text-red-500" />
                    <span className="text-2xl text-gray-700 font-extrabold">Stuttgart</span>
                </SidebarHeader>

                <SidebarContent className="mt-4">
                    <SidebarGroup>
                        <SidebarGroupContent>
                            <SidebarMenu className="gap-y-2">
                                {MainSidebarContent.map((item) => {
                                    const isActive = activeRoute === item.key;

                                    return (
                                        <SidebarMenuItem key={item.title}>
                                            <SidebarMenuButton 
                                                className={cn(
                                                    "flex w-full items-center rounded-lg px-2 py-1"
                                                    , isActive 
                                                        ? "bg-zinc-100 text-zinc-800"
                                                        : "text-gray-600 hover:text-zinc-800 hover:bg-zinc-100"
                                                )}
                                                asChild
                                            >
                                                <a href={item.href}>
                                                    <item.icon className="mr-1" />
                                                    <span>{item.title}</span>
                                                </a>
                                            </SidebarMenuButton>
                                        </SidebarMenuItem>
                                    )
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
                            {MainSidebarFooter.map((item) => {
                                const isActive = activeRoute === item.key;

                                return (
                                    <SidebarMenuItem key={item.title}>
                                        <SidebarMenuButton 
                                            className={cn(
                                                "flex w-full items-center rounded-lg px-2 py-1"
                                                , isActive 
                                                    ? "bg-zinc-100 text-zinc-800"
                                                    : "text-gray-600 hover:text-zinc-800 hover:bg-zinc-100"
                                            )}
                                            asChild
                                        >
                                            <a href={item.href}>
                                                <item.icon className="mr-1" />
                                                <span>{item.title}</span>
                                            </a>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                )
                            })}

                            <SidebarMenuItem>
                                <SidebarMenuButton 
                                    className="text-gray-600 hover:text-red-500 hover:bg-red-100 flex w-full items-center rounded-lg px-2 py-1" 
                                    asChild
                                >
                                    <a href="/logout">
                                        <LogOut className="mr-1" />
                                        <span>Logout</span>
                                    </a>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        </SidebarMenu>
                    </SidebarGroupContent>

                    <Separator className="my-2" />

                    <SidebarMenuItem>
                        <SidebarMenuButton 
                            size="lg" 
                            className={cn(
                                "flex w-full items-center rounded-lg px-2 py-1"
                                , activeRoute === "profile" 
                                    ? "bg-zinc-100 text-zinc-800"
                                    : "text-gray-600 hover:text-zinc-800 hover:bg-zinc-100"
                            )}
                            asChild
                        >
                            <Link href="/profile" className="text-gray-600 hover:text-zinc-800">
                                <div className="flex items-center gap-3">
                                    <Avatar>
                                        <AvatarImage src="https://github.com/shadcn.png" alt="@shadcn" />
                                        <AvatarFallback>MK</AvatarFallback>
                                    </Avatar>
                                    <div className="">
                                        <p className="font-medium leading-none">Muthula Alwis</p>
                                        <p className="text-xs font-light text-gray-500">Admin</p>
                                    </div>
                                </div>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarGroup>
            </SidebarContent>
        </Sidebar>
    )
}