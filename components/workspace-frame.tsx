"use client";

import { usePathname } from "next/navigation";
import { AppShell, SidebarProvider } from "@/components/sidebar";
import { ActivityProvider } from "@/components/activity-dock";
import { ServerEventsProvider } from "@/components/server-events";
import { AppearanceProvider } from "@/components/settings/appearance";
import UpdateBanner from "@/components/update-banner";
import { PluginsProvider } from "@/components/plugins";
import type { ComponentProps, ReactNode } from "react";

/** Account/setup pages do not mount workspace effects, plugins or shared data feeds. */
export function WorkspaceFrame({ children, ...appearance }: { children: ReactNode } & Omit<ComponentProps<typeof AppearanceProvider>, "children">) {
	const pathname = usePathname();
	if (pathname === "/login" || pathname === "/onboarding" || pathname.startsWith("/auth/")) return children;
	return <ServerEventsProvider><PluginsProvider><AppearanceProvider {...appearance}><SidebarProvider><ActivityProvider><AppShell>{children}</AppShell></ActivityProvider></SidebarProvider></AppearanceProvider></PluginsProvider><UpdateBanner /></ServerEventsProvider>;
}
