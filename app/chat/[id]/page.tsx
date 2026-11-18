import { notFound } from "next/navigation";
import { Chat } from "@/components/chat";
import { slotsConfigured } from "@/src/core";
import { compactionInFlight, getChat, isTurnRunning, readSettingsRecord, restoreChatRecord, turnFailure } from "@/src/server";
import { createClient } from "@/lib/supabase/server";
import { profileSettings } from "@/lib/supabase/profile-settings";
import { restoreChatFromCloud } from "@/lib/supabase/sync";

export const dynamic = "force-dynamic";

export default async function ChatPage({
	params,
	searchParams,
}: {
	params: Promise<{ id: string }>;
	searchParams: Promise<{ prompt?: string }>;
}) {
	const [{ id }, { prompt }] = await Promise.all([params, searchParams]);
	let chat = getChat(id);
	let settings = readSettingsRecord();
	const client = await createClient();
	if (client) {
		const { data: { user } } = await client.auth.getUser();
		if (user) {
			const [cloudChat, profileResult] = await Promise.all([
				restoreChatFromCloud(id, user.id, client),
				client.from("profiles").select("model_settings, theme_settings").eq("id", user.id).maybeSingle(),
			]);
			if (cloudChat) chat = restoreChatRecord(cloudChat, true);
			settings = profileSettings(profileResult.data ?? {});
		}
	}
	if (!chat) notFound();
	// The persistent setup CTA's seed (BYOK, owner 2026-09-22): slotsConfigured
	// over the settings record, server-read — the same gate home/new read. The
	// server's 503 stays the truth; this only decides whether the pill rides.
	return (
		<Chat
			key={chat.id}
			chatId={chat.id}
			title={chat.title}
			kind={chat.kind ?? "teach"}
			// Wave D: the record IS native agent history — the client view is
				// derived app-side (core/view.ts projectView; GET serves the same
				// native messages).
				initialMessages={chat.messages}
			initialError={turnFailure(chat.id)}
			initialConfigured={slotsConfigured(settings?.models)}
			initialPrompt={prompt}
			// A teacher turn that outlived its client: the remounted view must
			// attach (busy shimmer + poll), never resurrect the stale record.
			initiallyInFlight={isTurnRunning(chat.id)}
			initiallyCompacting={compactionInFlight(chat.id)}
		/>
	);
}
