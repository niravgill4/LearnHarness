import { graphView } from "@/src/server";
import { createClient } from "@/lib/supabase/server";
import { restoreGraphFromCloud } from "@/lib/supabase/sync";

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
			const cloudGraph = await restoreGraphFromCloud(user.id);
			if (cloudGraph) {
				if (cloudGraph.positions && typeof cloudGraph.positions === "object") {
					snapshot.positions = {
						...snapshot.positions,
						...cloudGraph.positions,
					};
				}
				if (cloudGraph.nodes && cloudGraph.nodes.length > 0) {
					const existingIds = new Set(snapshot.nodes.map((n) => n.id));
					for (const node of cloudGraph.nodes) {
						if (!existingIds.has(node.id)) {
							snapshot.nodes.push(node);
							snapshot.propositions.push(node);
						}
					}
				}
			}
		}
	}
	return Response.json(snapshot);
}
