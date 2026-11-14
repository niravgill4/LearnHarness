import { createAdminClient } from "./server";
import type { ChatRecord, GraphChain, GraphNode, NotesSource, Position, PlanTree, LhMessage, TurnUsage } from "@/src/core";

/**
 * Cloud Synchronization Service
 * 
 * Asynchronously persists all session records, conversation turns,
 * knowledge graph nodes/chains, sources, and settings into Supabase
 * with Row-Level Security scoped by user_id.
 */

export async function syncChatToCloud(record: ChatRecord, userId?: string): Promise<void> {
	try {
		const supabase = createAdminClient();
		if (!supabase) return;

		let targetUserId = userId;
		if (!targetUserId) {
			const { data } = await supabase.from("chats").select("user_id").eq("id", record.id).maybeSingle();
			if (data?.user_id) targetUserId = data.user_id;
		}
		if (!targetUserId) return;

		// 1. Update chats metadata row
		await supabase.from("chats").upsert({
			id: record.id,
			user_id: targetUserId,
			title: record.title,
			kind: record.kind ?? "teach",
			created_at: record.createdAt,
			updated_at: record.updatedAt || new Date().toISOString(),
		});

		// 2. Persist messages to chat_messages
		if (record.messages && record.messages.length > 0) {
			const messageRows = record.messages.map((m) => ({
				id: m.id,
				chat_id: record.id,
				user_id: targetUserId,
				role: m.role,
				parts: m as unknown as Record<string, unknown>,
				created_at: new Date().toISOString(),
			}));
			await supabase.from("chat_messages").upsert(messageRows, { onConflict: "id,user_id" });
		}

		// 3. Persist reasoning plan tree to chat_plans
		if (record.tree) {
			await supabase.from("chat_plans").upsert({
				chat_id: record.id,
				user_id: targetUserId,
				tree: record.tree,
				updated_at: new Date().toISOString(),
			}, { onConflict: "chat_id,user_id" });
		}

		// 4. Persist turn usage metrics to chat_usage
		if (record.turns && record.turns.length > 0) {
			for (const turn of record.turns) {
				await supabase.from("chat_usage").insert({
					chat_id: record.id,
					user_id: targetUserId,
					entry: turn,
				});
			}
		}
	} catch (err) {
		console.error(`[supabase-sync] Failed to sync chat ${record.id}:`, err);
	}
}

export async function deleteChatFromCloud(chatId: string, userId?: string): Promise<void> {
	try {
		const supabase = createAdminClient();
		if (!supabase) return;

		let query = supabase.from("chats").delete().eq("id", chatId);
		if (userId) query = query.eq("user_id", userId);
		await query;

		// Cascade deletes will clean up related records via foreign keys,
		// but we also explicitly clean up if foreign keys allow orphan policies:
		let msgQuery = supabase.from("chat_messages").delete().eq("chat_id", chatId);
		if (userId) msgQuery = msgQuery.eq("user_id", userId);
		await msgQuery;

		let planQuery = supabase.from("chat_plans").delete().eq("chat_id", chatId);
		if (userId) planQuery = planQuery.eq("user_id", userId);
		await planQuery;
	} catch (err) {
		console.error(`[supabase-sync] Failed to delete chat ${chatId}:`, err);
	}
}

export async function restoreChatFromCloud(chatId: string, userId: string): Promise<ChatRecord | null> {
	try {
		const supabase = createAdminClient();
		if (!supabase) return null;

		const { data: chatRow } = await supabase
			.from("chats")
			.select("id, title, kind, created_at, updated_at")
			.eq("id", chatId)
			.eq("user_id", userId)
			.maybeSingle();

		if (!chatRow) return null;

		const { data: messagesData } = await supabase
			.from("chat_messages")
			.select("id, role, parts, created_at")
			.eq("chat_id", chatId)
			.eq("user_id", userId)
			.order("created_at", { ascending: true });

		const { data: planData } = await supabase
			.from("chat_plans")
			.select("tree")
			.eq("chat_id", chatId)
			.eq("user_id", userId)
			.maybeSingle();

		const { data: usageData } = await supabase
			.from("chat_usage")
			.select("entry")
			.eq("chat_id", chatId)
			.eq("user_id", userId);

		const messages: LhMessage[] = (messagesData ?? []).map((m) => {
			if (m.parts && typeof m.parts === "object") {
				return { ...(m.parts as Record<string, unknown>), id: m.id, role: m.role } as unknown as LhMessage;
			}
			return { id: m.id, role: m.role, content: "" } as unknown as LhMessage;
		});

		const turns: TurnUsage[] = (usageData ?? []).map((u) => u.entry as TurnUsage);

		return {
			id: chatRow.id,
			title: chatRow.title,
			kind: chatRow.kind === "practice" ? "practice" : "teach",
			createdAt: chatRow.created_at,
			updatedAt: chatRow.updated_at,
			messages,
			tree: planData?.tree ? (planData.tree as PlanTree) : undefined,
			turns: turns.length > 0 ? turns : undefined,
		};
	} catch (err) {
		console.error(`[supabase-sync] Failed to restore chat ${chatId}:`, err);
		return null;
	}
}

export async function syncNodeToCloud(node: GraphNode, userId?: string): Promise<void> {
	try {
		const supabase = createAdminClient();
		if (!supabase) return;

		let targetUserId = userId;
		if (!targetUserId && node.provenance && node.provenance.length > 0) {
			const chatId = node.provenance[0]?.chatId;
			if (chatId) {
				const { data } = await supabase.from("chats").select("user_id").eq("id", chatId).maybeSingle();
				if (data?.user_id) targetUserId = data.user_id;
			}
		}
		if (!targetUserId) return;

		await supabase.from("graph_nodes").upsert({
			id: node.id,
			user_id: targetUserId,
			name: node.name,
			statement: node.statement,
			created_at: new Date().toISOString(),
		}, { onConflict: "id,user_id" });
	} catch (err) {
		console.error(`[supabase-sync] Failed to sync node ${node.id}:`, err);
	}
}

export async function syncChainToCloud(chain: GraphChain, userId?: string): Promise<void> {
	try {
		const supabase = createAdminClient();
		if (!supabase) return;

		let targetUserId = userId;
		if (!targetUserId && chain.provenance && chain.provenance.length > 0) {
			const chatId = chain.provenance[0]?.chatId;
			if (chatId) {
				const { data } = await supabase.from("chats").select("user_id").eq("id", chatId).maybeSingle();
				if (data?.user_id) targetUserId = data.user_id;
			}
		}
		if (!targetUserId) return;

		await supabase.from("graph_chains").upsert({
			id: chain.id,
			user_id: targetUserId,
			premises: chain.premises,
			conclusion: chain.conclusion,
			created_at: new Date().toISOString(),
		}, { onConflict: "id,user_id" });
	} catch (err) {
		console.error(`[supabase-sync] Failed to sync chain ${chain.id}:`, err);
	}
}

export async function syncSourceToCloud(source: NotesSource, userId: string): Promise<void> {
	try {
		const supabase = createAdminClient();
		if (!supabase) return;

		await supabase.from("graph_sources").upsert({
			id: source.id,
			user_id: userId,
			source: source,
			updated_at: new Date().toISOString(),
		}, { onConflict: "id,user_id" });
	} catch (err) {
		console.error(`[supabase-sync] Failed to sync source ${source.id}:`, err);
	}
}

export async function restoreGraphFromCloud(userId: string): Promise<{
	nodes: GraphNode[];
	chains: GraphChain[];
	sources: NotesSource[];
	positions: Record<string, Position>;
} | null> {
	try {
		const supabase = createAdminClient();
		if (!supabase) return null;

		const [nodesRes, chainsRes, sourcesRes, posRes] = await Promise.all([
			supabase.from("graph_nodes").select("id, name, statement").eq("user_id", userId),
			supabase.from("graph_chains").select("id, premises, conclusion").eq("user_id", userId),
			supabase.from("graph_sources").select("source").eq("user_id", userId),
			supabase.from("graph_positions").select("positions").eq("user_id", userId).maybeSingle(),
		]);

		const nodes: GraphNode[] = (nodesRes.data ?? []).map((n) => ({
			id: n.id,
			name: n.name,
			statement: n.statement,
			aliases: [],
			createdAt: new Date().toISOString(),
			provenance: [],
		}));

		const chains: GraphChain[] = (chainsRes.data ?? []).map((c) => ({
			id: c.id,
			premises: c.premises ?? [],
			conclusion: c.conclusion ?? "",
			provenance: [],
			createdAt: new Date().toISOString(),
		}));

		const sources: NotesSource[] = (sourcesRes.data ?? []).map((s) => s.source as NotesSource);
		const positions: Record<string, Position> = (posRes.data?.positions as Record<string, Position>) ?? {};

		return { nodes, chains, sources, positions };
	} catch (err) {
		console.error(`[supabase-sync] Failed to restore graph for ${userId}:`, err);
		return null;
	}
}
