import { handleChatRequest, userAuthStorage } from "@/src/server";
import { createClient } from "@/lib/supabase/server";
import { readProfileKeys } from "@/lib/supabase/profile-keys";

export async function POST(req: Request) {
	const supabase = await createClient();
	if (supabase) {
		const { data: { user } } = await supabase.auth.getUser();
		if (!user) {
			return Response.json({ error: "Sign in to continue." }, { status: 401 });
		}
		const { data: profile } = await supabase
			.from("profiles")
			.select("encrypted_keys")
			.eq("id", user.id)
			.single();
		const keys = profile?.encrypted_keys ? readProfileKeys(profile.encrypted_keys) : {};
		return userAuthStorage.run({ userId: user.id, keys }, () => handleChatRequest(req));
	}
	return handleChatRequest(req);
}
