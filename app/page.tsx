import { Home } from "@/components/home";
import { readSettingsRecord } from "@/src/server";
import { resolveSettings, slotsConfigured } from "@/src/core";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { profileModelSlots } from "@/lib/onboarding";

export const dynamic = "force-dynamic";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
	let firstTopic = "";
	const params = await searchParams;
	const welcome = params.welcome === "1";
	const record = readSettingsRecord();
	const configured = slotsConfigured(record?.models);

	// Only hit cloud Supabase if models are unconfigured or this is the welcome redirect
	if (!configured || welcome) {
		const client = await createClient();
		if (client) {
			const { data: { user } } = await client.auth.getUser();
			if (!user) redirect("/login");
			const { data: profile } = await client.from("profiles").select("model_settings").eq("id", user.id).maybeSingle();
			if (!profile?.model_settings?.onboarding?.completedAt || !slotsConfigured(profileModelSlots(profile.model_settings))) {
				redirect("/onboarding");
			}
			if (welcome && typeof profile?.model_settings?.onboarding?.topic === "string") {
				firstTopic = profile.model_settings.onboarding.topic;
			}
		}
	}

	const rendering = resolveSettings(record ?? null).graph.rendering;
	return (
		<Home initialConfigured={configured} rendering={rendering} initialTopic={firstTopic} />
	);
}
