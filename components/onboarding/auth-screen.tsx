"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightIcon, CheckIcon, EyeIcon, EyeOffIcon, LoaderCircleIcon, MailIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { createBrowserClient } from "@supabase/ssr";
import { validateEmail } from "@/lib/validation/email";
import { OnboardingShell } from "./onboarding-shell";

function GithubMark() {
	return <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .9a11.1 11.1 0 0 0-3.5 21.6c.6.1.8-.2.8-.5v-2.1c-3.1.7-3.8-1.3-3.8-1.3-.5-1.3-1.2-1.6-1.2-1.6-1-.7.1-.7.1-.7 1.1.1 1.7 1.2 1.7 1.2 1 1.7 2.6 1.2 3.2.9.1-.7.4-1.2.7-1.5-2.5-.3-5.1-1.3-5.1-5.5 0-1.2.4-2.2 1.1-3-.1-.3-.5-1.4.1-2.9 0 0 .9-.3 3.1 1.1a10.8 10.8 0 0 1 5.6 0c2.1-1.4 3.1-1.1 3.1-1.1.6 1.5.2 2.6.1 2.9.7.8 1.1 1.8 1.1 3 0 4.3-2.6 5.2-5.1 5.5.4.3.8 1 .8 2.1V22c0 .3.2.6.8.5A11.1 11.1 0 0 0 12 .9Z" /></svg>;
}

export function AuthScreen() {
	const router = useRouter();
	const [client, setClient] = useState<ReturnType<typeof createClient>>(null);
	const [authOptions, setAuthOptions] = useState<{ configured: boolean; providers: { google: boolean; github: boolean }; unavailable?: boolean } | null>(null);
	const [oauthBusy, setOauthBusy] = useState<"google" | "github" | null>(null);
	const [mode, setMode] = useState<"signup" | "signin">("signup");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [showPassword, setShowPassword] = useState(false);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [confirmation, setConfirmation] = useState(false);
	const [resent, setResent] = useState(false);
	const confirmationHeading = useRef<HTMLHeadingElement>(null);
	const emailInput = useRef<HTMLInputElement>(null);
	const wasConfirming = useRef(false);
	useEffect(() => {
		const controller = new AbortController();
		void fetch("/api/auth/providers", { signal: controller.signal, cache: "no-store" }).then(async response => {
			if (!response.ok) throw new Error("Auth options unavailable");
			const options = await response.json();
			if (controller.signal.aborted) return;
			setAuthOptions(options);
			if (options.configured && typeof options.url === "string" && typeof options.publicKey === "string") setClient(createBrowserClient(options.url, options.publicKey));
		}).catch(() => {
			if (controller.signal.aborted) return;
			const fallback = createClient();
			setClient(fallback);
			setAuthOptions({ configured: !!fallback, providers: { google: false, github: false }, unavailable: true });
		});
		return () => controller.abort();
	// Bootstrap once from the server's public sign-in capabilities.
	}, []);
	useEffect(() => {
		if (confirmation) confirmationHeading.current?.focus();
		else if (wasConfirming.current) emailInput.current?.focus();
		wasConfirming.current = confirmation;
	}, [confirmation]);
	useEffect(() => { if (new URLSearchParams(window.location.search).has("error")) setError("That sign-in link could not be completed. Please try signing in again."); }, []);
	useEffect(() => {
		// A cancelled provider window can restore this page from the back/forward cache.
		const resume = (event: PageTransitionEvent) => { if (event.persisted) { setBusy(false); setOauthBusy(null); } };
		window.addEventListener("pageshow", resume);
		return () => window.removeEventListener("pageshow", resume);
	}, []);
	const changeMode = (value: typeof mode) => { setMode(value); setError(""); setPassword(""); };
	async function submit(event: FormEvent) {
		event.preventDefault();
		if (!client) { setError("Account access is not available yet. Please try again later."); return; }

		const emailValidation = validateEmail(email);
		if (!emailValidation.valid) {
			setError(emailValidation.error || "Please enter a valid email address.");
			return;
		}

		setBusy(true); setError("");
		try {
			const cleanEmail = emailValidation.normalized;
			if (mode === "signin") {
				const result = await client.auth.signInWithPassword({ email: cleanEmail, password });
				if (result.error) throw result.error;
				router.replace("/onboarding"); router.refresh();
			} else {
				const result = await client.auth.signUp({ email: cleanEmail, password, options: { emailRedirectTo: `${window.location.origin}/auth/callback` } });
				if (result.error) throw result.error;
				setPassword("");
				if (result.data.session) { router.replace("/onboarding"); router.refresh(); }
				else setConfirmation(true);
			}
		} catch (cause) { setError(cause instanceof Error ? cause.message : "We could not sign you in. Please try again."); }
		finally { setBusy(false); }
	}
	async function oauth(provider: "google" | "github") {
		if (!client) { setError("Account access is not available yet. Please try again later."); return; }
		setBusy(true); setOauthBusy(provider); setError("");
		try {
			const result = await client.auth.signInWithOAuth({
				provider,
				options: {
					redirectTo: `${window.location.origin}/auth/callback`,
				},
			});
			if (result.error) throw result.error;
			if (result.data?.url) {
				window.location.assign(result.data.url);
			}
		} catch (cause) {
			const msg = cause instanceof Error ? cause.message : "";
			if (msg.toLowerCase().includes("not enabled") || msg.toLowerCase().includes("unsupported provider") || authOptions?.providers[provider] === false) {
				setError(`${provider === "google" ? "Google" : "GitHub"} sign-in is not turned on in your Supabase project yet. In your Supabase Dashboard -> Authentication -> Providers, turn on ${provider === "google" ? "Google" : "GitHub"}.`);
			} else {
				setError(msg || "We couldn’t open that sign-in provider. Please try email instead.");
			}
			setBusy(false);
			setOauthBusy(null);
		}
	}
	async function resend() {
		if (!client) return;
		const emailValidation = validateEmail(email);
		if (!emailValidation.valid) {
			setError(emailValidation.error || "Please enter a valid email address.");
			return;
		}
		setBusy(true); setError("");
		try {
			const result = await client.auth.resend({ type: "signup", email: emailValidation.normalized, options: { emailRedirectTo: `${window.location.origin}/auth/callback` } });
			if (result.error) throw result.error;
			setResent(true);
		} catch { setError("The email could not be resent yet. Please try again shortly."); }
		finally { setBusy(false); }
	}
	return <OnboardingShell step={0}><div className="onboarding-step" key={confirmation ? "confirm" : "auth"}>
		{confirmation ? <>
			<div className="onboarding-confirm-icon"><MailIcon /></div>
			<h2 ref={confirmationHeading} tabIndex={-1} aria-describedby="confirmation-instructions">A small check.<br />A new beginning.</h2>
			<p id="confirmation-instructions" className="onboarding-intro">We sent a confirmation link to <strong>{email}</strong>. Open it to continue setting up your learning space.</p>
			{error && <p role="alert" className="onboarding-error">{error}</p>}
			{resent && <p role="status" className="onboarding-success"><CheckIcon />A fresh link is on its way.</p>}
			<button className="onboarding-primary" disabled={busy || resent} onClick={() => void resend()}>{busy ? "Sending…" : resent ? "Email sent" : "Resend confirmation email"}</button>
			<button className="onboarding-text-button" onClick={() => { setConfirmation(false); setResent(false); setError(""); }}>Use a different email</button>
		</> : <>
			<div className="onboarding-auth-tabs" aria-label="Account action">{(["signup", "signin"] as const).map(value => <button key={value} type="button" aria-pressed={mode === value} disabled={busy} onClick={() => changeMode(value)}>{value === "signup" ? "Create account" : "Log in"}</button>)}</div>
			<h2>{mode === "signup" ? "Your next chapter\nstarts here." : "Welcome back\nto your own space."}</h2>
			<p className="onboarding-intro">{mode === "signup" ? "Create your account. Bring your questions." : "Pick up where curiosity left you."}</p>
			<form onSubmit={submit} className="onboarding-form" aria-busy={busy}>
				<label htmlFor="cognera-email">Email address</label>
				<input ref={emailInput} id="cognera-email" name="email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" disabled={busy} />
				<label htmlFor="cognera-password">Password</label>
				<div className="onboarding-secret-field"><input id="cognera-password" name="password" type={showPassword ? "text" : "password"} autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={mode === "signup" ? 8 : 1} required value={password} onChange={e => setPassword(e.target.value)} placeholder={mode === "signup" ? "At least 8 characters" : "Your password"} disabled={busy} /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)}>{showPassword ? <EyeOffIcon /> : <EyeIcon />}</button></div>
				{error && <p role="alert" className="onboarding-error">{error}</p>}
				<button className="onboarding-primary" disabled={busy} type="submit">{busy ? <><LoaderCircleIcon className="onboarding-spinner" />One moment…</> : <>{mode === "signup" ? "Create your space" : "Log in"}<ArrowRightIcon /></>}</button>
			</form>
			<div className="onboarding-divider"><span>or continue with</span></div>
			<div className="onboarding-social">
				<button type="button" disabled={busy} onClick={() => void oauth("google")} aria-label={mode === "signup" ? "Sign up with Google" : "Sign in with Google"}>
					{oauthBusy === "google" ? <LoaderCircleIcon className="onboarding-spinner" /> : <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M21.6 12.2c0-.7-.1-1.4-.2-2.1H12v4h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.8 3-4.3 3-7.4ZM12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 .9-3.4.9a6 6 0 0 1-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22ZM6.4 13.9a6 6 0 0 1 0-3.8V7.5H3.1a10 10 0 0 0 0 9l3.3-2.6ZM12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.8A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.9 5.5l3.3 2.6A6 6 0 0 1 12 6Z" /></svg>}
					Google
				</button>
				<button type="button" disabled={busy} onClick={() => void oauth("github")} aria-label={mode === "signup" ? "Sign up with GitHub" : "Sign in with GitHub"}>
					{oauthBusy === "github" ? <LoaderCircleIcon className="onboarding-spinner" /> : <GithubMark />}
					GitHub
				</button>
			</div>
			<p id="social-availability" className="onboarding-auth-availability" role="status">{!authOptions ? "Checking sign-in options…" : !authOptions.configured ? "Account sign-in is temporarily unavailable." : ""}</p>
			<p className="onboarding-small">Your learning, connected to your account.</p>
		</>}
	</div></OnboardingShell>;
}
