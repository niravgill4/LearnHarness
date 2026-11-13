import { graphView } from "@/src/server";
import { createClient } from "@/lib/supabase/server";

/**
 * The home graph view's data endpoint (W4; vision §1 "Home page") — thin
 * transport: the server entry (src/server/graph.ts) returns nodes, edges,
 * session provenance, and per-session understanding observations.
 */

export const dynamic = "force-dynamic";

export async function GET() {
	const snapshot = graphView();
	const supabase = await createClient();
	if (supabase) {
		const { data: { user } } = await supabase.auth.getUser();
		if (user) {
			const { data: posData } = await supabase
				.from("graph_positions")
				.select("positions")
				.eq("user_id", user.id)
				.maybeSingle();
			if (posData?.positions && typeof posData.positions === "object") {
				snapshot.positions = {
					...snapshot.positions,
					...(posData.positions as Record<string, { x: number; y: number }>),
				};
			}
		}
	}
	return Response.json(snapshot);
}
