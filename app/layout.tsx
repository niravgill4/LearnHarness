import type { Metadata } from "next";
import localFont from "next/font/local";
import { connection } from "next/server";
import "katex/dist/katex.min.css";
import "./globals.css";
import { AppShell, SidebarProvider } from "@/components/sidebar";
import { ActivityProvider } from "@/components/activity-dock";
import { ServerEventsProvider } from "@/components/server-events";
import { AppearanceProvider } from "@/components/settings/appearance";
import UpdateBanner from "@/components/update-banner";
import { PluginsProvider } from "@/components/plugins";
import { readThemeBoot } from "@/src/server";

// Inter is the locally bundled interface face (globals.css). Existing reading
// and code font choices stay available without build-time network downloads.
const ui = localFont({ src: "../public/fonts/jetbrains-mono-variable.woff2", weight: "100 800", variable: "--font-jetbrains", display: "swap", preload: false });
const prose = localFont({ src: "../public/fonts/source-sans-variable.woff2", weight: "200 900", variable: "--font-sans3", display: "swap", preload: false });

export const metadata: Metadata = {
	title: "Cognera",
	description: "A teacher agent with a memory — sessions, quizzes, and a knowledge graph of what you know.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
	// The theme is server-rendered — its class AND its color variables —
	// so no first frame ever shows the wrong theme. connection(): the
	// record and the theme files are per-machine disk state — without it a
	// prerendered route (settings) would bake the BUILD machine's record.
	await connection();
	const { appearance, theme, vars } = readThemeBoot();
	return (
		<html
			lang="en"
			className={`${theme.mode} ${ui.variable} ${prose.variable}`}
			style={vars as React.CSSProperties}
			suppressHydrationWarning
		>
			<head><link rel="preload" href="/fonts/inter-variable.woff2" as="font" type="font/woff2" crossOrigin="anonymous" /></head>
            <body className="min-h-dvh antialiased">
			{/* The notification channel rides OUTSIDE everything: sidebar, dock,
				 and pages all subscribe as the polls retire (push S3, 2026-10-02). */}
			<ServerEventsProvider>
				<PluginsProvider>
					<AppearanceProvider initialAppearance={appearance} initialTheme={theme}>
						<SidebarProvider>
							<ActivityProvider>
								<AppShell>{children}</AppShell>
							</ActivityProvider>
						</SidebarProvider>
					</AppearanceProvider>
				</PluginsProvider>
			</ServerEventsProvider>
			{/* Auto-update banner (Wave C): fixed card, Electron-only pushes. */}
			<UpdateBanner />
		</body>
		</html>
	);
}
