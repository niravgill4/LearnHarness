import { graphView, stores, graphSnapshot } from "@/src/server";
import { createClient } from "@/lib/supabase/server";
import { restoreGraphFromCloud } from "@/lib/supabase/sync";

export const dynamic = "force-dynamic";

export async function GET() {
 const supabase = await createClient();
 if (!supabase) return Response.json(graphView());
 const { data: { user } } = await supabase.auth.getUser();
 if (!user) return Response.json({ error: "Sign in to continue." }, { status: 401 });
 const cloud = await restoreGraphFromCloud(user.id, supabase);
 if (!cloud) return Response.json({ error: "Your knowledge graph could not be loaded." }, { status: 503 });
 // Account-scoped database rows are the entire snapshot. Never merge the
 // process-global filesystem cache into an authenticated user's graph.
 const snapshot = graphSnapshot({
  graphStore: { ...stores.graphStore,
   readNodes: () => cloud.nodes,
   readChains: () => cloud.chains,
   readSources: () => cloud.sources,
   readPositions: () => cloud.positions,
  },
  chatStore: { ...stores.chatStore, getChat: () => null },
 });
 return Response.json(snapshot, { headers: { "Cache-Control": "no-store" } });
}
