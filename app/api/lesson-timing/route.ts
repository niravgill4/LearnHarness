import { recommendLessonScope, userAuthStorage } from "@/src/server";
import { createClient } from "@/lib/supabase/server";
import { lessonTimingHandler } from "@/lib/lesson-timing-http";

export const dynamic = "force-dynamic";
export const POST = lessonTimingHandler({
	getClient: createClient,
	recommend: recommendLessonScope,
	runWithUser: (context, task) => userAuthStorage.run(context, task),
});
