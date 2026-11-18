import { randomUUID } from "node:crypto";
import { createAdminClient } from "./server";

export async function reserveCloudTurn(userId: string, chatId: string, request: unknown) {
 const client = createAdminClient();
 if (!client) throw new Error("Cloud execution is not configured");
 // Expired executions must not block the session indefinitely. Do not
 // automatically repeat model/tool calls whose side effects may have landed.
 const expired = await client.from("cloud_tasks").update({ status: "failed", error_code: "execution_expired", updated_at: new Date().toISOString() })
  .eq("user_id",userId).eq("chat_id",chatId).eq("kind","turn").eq("status","running").lt("lease_until",new Date().toISOString());
 if (expired.error) throw new Error("Could not recover expired cloud execution");
 const token = randomUUID();
 const { data, error } = await client.from("cloud_tasks").insert({
  user_id: userId, chat_id: chatId, request_id: randomUUID(), kind: "turn", input: { request, stream: "" },
  status: "running", attempt: 1, lease_token: token, lease_until: new Date(Date.now()+300000).toISOString(),
 }).select("id").single();
 if (error) return { ok: false as const, conflict: error.code === "23505" };
 return { ok: true as const, id: data.id as string, token };
}

/** Every update is fenced by the lease so a stale function cannot overwrite a successor. */
export async function persistCloudTurn(id: string, token: string, request: unknown, stream: string, status: "running" | "completed" | "failed") {
 const client = createAdminClient();
 if (!client) throw new Error("Cloud execution is not configured");
 const { data, error } = await client.from("cloud_tasks").update({ input: { request, stream }, status,
  updated_at: new Date().toISOString(), ...(status === "running" ? {} : { lease_until: null }),
 }).eq("id",id).eq("lease_token",token).eq("status","running").select("id");
 if (error || !data?.length) throw new Error("Cloud turn persistence failed or execution lease was lost");
}
