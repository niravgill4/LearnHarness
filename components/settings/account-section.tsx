"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import { validateEmail } from "@/lib/validation/email";

export function AccountSection() {
	const client = useMemo(() => createClient(), []);
	const [user, setUser] = useState<User | null>(null), [loading, setLoading] = useState(true);
	const [name, setName] = useState(""), [email, setEmail] = useState("");
	const [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [error, setError] = useState("");
	useEffect(() => { let live = true; if (!client) { setLoading(false); return; }
		void client.auth.getUser().then(({ data, error }) => { if (!live) return; setUser(data.user); setName(data.user?.user_metadata?.display_name ?? ""); setEmail(data.user?.email ?? ""); if (error) setError(error.message); setLoading(false); }).catch(() => { if (live) { setLoading(false); setError("Your account could not be loaded. Reopen this section to retry."); } });
		return () => { live = false; };
	}, [client]);
	async function save(event: FormEvent) {
		event.preventDefault(); if (!client || !user) return;
		const validation = validateEmail(email);
		if (!validation.valid) { setError(validation.error ?? "Enter a valid email address."); return; }
		setBusy(true); setError(""); setMessage("");
		try {
			const changingEmail = email.trim() !== user.email;
			const { data, error } = await client.auth.updateUser({ data: { display_name: name.trim() }, ...(changingEmail ? { email: email.trim() } : {}) });
			if (error) throw error; setUser(data.user); setMessage(changingEmail ? "Profile saved. Check your email inboxes to confirm the address change." : "Profile saved.");
		} catch (cause) { setError(cause instanceof Error ? cause.message : "Your profile could not be saved."); } finally { setBusy(false); }
	}
	async function signOut() { if (!client) return; setBusy(true); setError(""); try { const { error } = await client.auth.signOut({ scope: "local" }); if (error) throw error; window.location.assign("/login"); } catch (cause) { setError(cause instanceof Error ? cause.message : "Sign-out failed. Try again."); setBusy(false); } }
	return <section className="account-settings" aria-labelledby="account-heading"><h2 id="account-heading">Profile &amp; account</h2><p>Your identity and sign-in details for Cognera.</p>
		{loading ? <p role="status">Loading your account…</p> : !user ? <p>Sign in to manage your cloud profile. <a href="/login">Open sign-in</a></p> : <>
			<div className="account-identity"><span aria-hidden="true">{(name || email || "C").charAt(0).toUpperCase()}</span><div><strong>{name || "Your Cognera account"}</strong><p>{user.email}</p></div></div>
			<form onSubmit={save}><label htmlFor="account-name">Display name</label><input id="account-name" autoComplete="name" maxLength={80} value={name} onChange={e => setName(e.target.value)} disabled={busy} /><label htmlFor="account-email">Email address</label><input id="account-email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} disabled={busy} /><p>Email changes require confirmation before the new address becomes active.</p><button disabled={busy} type="submit">{busy ? "Saving…" : "Save profile"}</button></form>
			<div className="account-session"><div><strong>This session</strong><p>Sign out of Cognera on this browser.</p></div><button type="button" disabled={busy} onClick={() => void signOut()}>Sign out</button></div>
		</>}{error && <p role="alert" className="account-error">{error}</p>}{message && <p role="status">{message}</p>}
	</section>;
}
