import { claimCloudTask } from "@/lib/supabase/cloud-workers";
import { runClaimedCloudTask } from "@/src/server";
import { after } from "next/server";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
	const expected = process.env.CRON_SECRET;
	if (!expected || request.headers.get("authorization") !== `Bearer ${expected}`) {
		return Response.json({ error: "Unauthorized" }, { status: 401 });
	}
	const started = Date.now();
	let completed = 0;
	let failed = 0;
	while (completed + failed < 8 && Date.now() - started < 260_000) {
		const task = await claimCloudTask();
		if (!task) break;
		try {
			await runClaimedCloudTask(task);
			completed++;
		} catch (error) {
			failed++;
			console.error(`[cloud-worker ${task.id}] failed:`, error);
		}
	}
	return Response.json({ completed, failed });
}

export async function POST(request: Request) {
	const expected = process.env.CRON_SECRET;
	if (!expected || request.headers.get("authorization") !== `Bearer ${expected}`) {
		return Response.json({ error: "Unauthorized" }, { status: 401 });
	}
	const task = await claimCloudTask();
	if (!task) return Response.json({ accepted: false });
	after(async () => {
		try { await runClaimedCloudTask(task); }
		catch (error) { console.error(`[cloud-worker ${task.id}] failed:`, error); }
	});
	return Response.json({ accepted: true }, { status: 202 });
}
