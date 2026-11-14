import { createClient, createAdminClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export async function DELETE() {
	const client = await createClient();
	if (!client) {
		return Response.json({ error: "Supabase client not configured" }, { status: 503 });
	}

	const {
		data: { user },
		error: userError,
	} = await client.auth.getUser();

	if (userError || !user) {
		return Response.json({ error: "Unauthorized" }, { status: 401 });
	}

	const admin = createAdminClient();
	if (!admin) {
		return Response.json({ error: "Admin client not configured" }, { status: 503 });
	}

	// Delete user from auth.users — database foreign key ON DELETE CASCADE
	// automatically wipes profiles, chats, chat_messages, chat_plans, chat_usage,
	// graph_nodes, graph_chains, graph_positions, etc.
	const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
	if (deleteError) {
		return Response.json({ error: deleteError.message }, { status: 500 });
	}

	// Sign out and clear session cookies
	try {
		await client.auth.signOut({ scope: "global" });
	} catch {
		// Ignore if auth session is already invalidated
	}

	const cookieStore = await cookies();
	for (const cookie of cookieStore.getAll()) {
		if (cookie.name.startsWith("sb-")) {
			try {
				cookieStore.delete(cookie.name);
			} catch {
				// Ignore cookie deletion errors in non-standard runtimes
			}
		}
	}

	return Response.json({ success: true });
}
