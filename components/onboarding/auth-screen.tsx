"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightIcon, CheckIcon, EyeIcon, EyeOffIcon, LoaderCircleIcon, MailIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { OnboardingShell } from "./onboarding-shell";

export function AuthScreen() {
	const router = useRouter();
	const [client] = useState(createClient);
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
		if (confirmation) confirmationHeading.current?.focus();
		else if (wasConfirming.current) emailInput.current?.focus();
		wasConfirming.current = confirmation;
	}, [confirmation]);
	useEffect(() => { if (new URLSearchParams(window.location.search).has("error")) setError("That sign-in link could not be completed. Please try signing in again."); }, []);
	const changeMode = (value: typeof mode) => { setMode(value); setError(""); setPassword(""); };
	async function submit(event: FormEvent) {
		event.preventDefault();
		if (!client) { setError("Account access is not available yet. Please try again later."); return; }
		setBusy(true); setError("");
		try {
			if (mode === "signin") {
				const result = await client.auth.signInWithPassword({ email: email.trim(), password });
				if (result.error) throw result.error;
				router.replace("/onboarding"); router.refresh();
			} else {
				const result = await client.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: `${window.location.origin}/auth/callback` } });
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
		setBusy(true); setError("");
		try {
			const result = await client.auth.signInWithOAuth({ provider, options: { redirectTo: `${window.location.origin}/auth/callback` } });
			if (result.error) throw result.error;
		} catch { setError("This sign-in option is not available. Try email instead."); setBusy(false); }
	}
	async function resend() {
		if (!client) return;
		setBusy(true); setError("");
		try {
			const result = await client.auth.resend({ type: "signup", email: email.trim(), options: { emailRedirectTo: `${window.location.origin}/auth/callback` } });
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
			<div className="onboarding-social"><button type="button" disabled={busy} onClick={() => void oauth("google")}>Google</button><button type="button" disabled={busy} onClick={() => void oauth("github")}>GitHub</button></div>
			<p className="onboarding-small">Your learning, connected to your account.</p>
		</>}
	</div></OnboardingShell>;
}
