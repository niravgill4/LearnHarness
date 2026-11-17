import { createClient } from "@/lib/supabase/server";
import { readingPaceHandlers } from "@/lib/reading-pace-http";
export const dynamic = "force-dynamic";
const handlers = readingPaceHandlers(createClient);
export const GET = handlers.GET;
export const POST = handlers.POST;
