import type { SupabaseClient } from "@supabase/supabase-js";

export function createCloudTurnReplay(
	client: SupabaseClient,
	userId: string,
	taskId: string,
	options: { pollMs?: number; maxMs?: number } = {},
): Response {
	let stopped = false;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let offset = 0;
	const started = Date.now();
	const encoder = new TextEncoder();
	const stream = new ReadableStream<Uint8Array>({
		async start(controller) {
			const poll = async () => {
				if (stopped) return;
				try {
					const { data, error } = await client.from("cloud_tasks").select("input,status,lease_until").eq("id", taskId).eq("user_id", userId).single();
					if (stopped) return;
					if (error || !data) throw new Error("Cloud stream unavailable");
					const saved = typeof data.input?.stream === "string" ? data.input.stream : "";
					if (saved.length > offset) {
						controller.enqueue(encoder.encode(saved.slice(offset)));
						offset = saved.length;
					}
					if (data.status !== "running" && data.status !== "queued") {
						if (!saved.endsWith("data: [DONE]\n\n")) controller.enqueue(encoder.encode('data: {"type":"turn-settled"}\n\ndata: [DONE]\n\n'));
						stopped = true;
						controller.close();
						return;
					}
					if (Date.now() - started > (options.maxMs ?? 45_000) || (data.lease_until && Date.parse(data.lease_until) < Date.now())) {
						stopped = true;
						controller.close();
						return;
					}
					timer = setTimeout(poll, options.pollMs ?? 750);
				} catch (error) {
					if (!stopped) {
						stopped = true;
						controller.error(error);
					}
				}
			};
			await poll();
		},
		cancel() {
			stopped = true;
			if (timer) clearTimeout(timer);
		},
	});
	return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" } });
}
