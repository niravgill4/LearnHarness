import { Home } from "@/components/home";
import { readSettingsRecord } from "@/src/server";
import { resolveSettings, slotsConfigured } from "@/src/core";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

// Dynamic: the configured state is server-rendered into the page (the
// setup CTA's truth on the first frame), and every navigation re-reads
// the record (dynamic routes aren't cached client-side).
export const dynamic = "force-dynamic";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
	let firstTopic = "";
	const welcome = (await searchParams).welcome === "1";
	const client = await createClient();
	if (client) {
		const { data: { user } } = await client.auth.getUser();
		if (!user) redirect("/login");
		const { data: profile } = await client.from("profiles").select("model_settings").eq("id", user.id).single();
		if (!profile?.model_settings?.onboarding?.completedAt) redirect("/onboarding");
		if (welcome && typeof profile.model_settings.onboarding.topic === "string") firstTopic = profile.model_settings.onboarding.topic;
	}
	// First-run gate (model-slots wave): chats cannot start until the user
	// has picked all three slots — the dock shows the CTA while the raw
	// record's models section lacks any slot pin.
	const record = readSettingsRecord();
	// GRAPH RENDERING (owner, 2026-10-06): off = the home's main view is
	// the chains view. Resolved through the one core resolver (missing
	// section / absent key → factory default on); re-read per navigation.
	const rendering = resolveSettings(record ?? null).graph.rendering;
	return (
		<Home initialConfigured={slotsConfigured(record?.models)} rendering={rendering} initialTopic={firstTopic} />
	);
}
