/**
 * PUT /api/graph/positions — the live-physics drag commit. The client
 * anneals a drag to rest and sends the new positions; the server
 * sanitizes (finite coords, known ids only), writes the ledger, and if
 * the graph grew mid-drag runs one incremental settle to absorb the new
 * nodes with the client's arrangement as anchors. See
 * src/server/commit-positions.ts.
 *
 *   PUT → 200 {positions: {...}} with whatever survived sanitizing
 *         (empty object = nothing written).
 */
import { commitPositions, deriveView } from "@/src/server";
import { restoreGraphFromCloud } from "@/lib/supabase/sync";
import type { Position } from "@/src/core";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function PUT(request: Request) {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return Response.json({ error: "invalid JSON body" }, { status: 400 });
	}
	let positions: Record<string, Position>;

	const supabase = await createClient();
	if (supabase) {
		const { data: { user } } = await supabase.auth.getUser();
		if (!user) return Response.json({ error: "Sign in to continue." }, { status: 401 });
		const cloud = await restoreGraphFromCloud(user.id, supabase);
		if (!cloud) return Response.json({ error: "Your graph could not be loaded." }, { status: 503 });
		const known = new Set(deriveView(cloud).nodes.map(node => node.id));
		positions = {};
		if (body && typeof body === "object" && !Array.isArray(body)) {
			for (const [id, point] of Object.entries(body)) {
				if (!known.has(id) || !point || typeof point !== "object") continue;
				const { x, y } = point as Record<string, unknown>;
				if (typeof x !== "number" || typeof y !== "number" || !Number.isFinite(x) || !Number.isFinite(y)) continue;
				positions[id] = { x: Math.max(-1e6, Math.min(1e6, x)), y: Math.max(-1e6, Math.min(1e6, y)) };
			}
		}
		if (!Object.keys(positions).length) return Response.json({ positions });
		{
			const { error } = await supabase.from("graph_positions").upsert({
				user_id: user.id,
				positions: { ...cloud.positions, ...positions },
				updated_at: new Date().toISOString(),
			});
			if (error) return Response.json({ error: "Could not save graph positions." }, { status: 503 });
		}
	} else {
		positions = commitPositions(body);
	}

	return Response.json({ positions });
}
