"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LhMark } from "@/components/lh-mark";
import { SparklesIcon, MailIcon, LockIcon, ArrowRightIcon } from "lucide-react";

export default function LoginPage() {
	const router = useRouter();
	const [mode, setMode] = useState<"signin" | "signup">("signin");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [message, setMessage] = useState<string | null>(null);

	const supabase = createClient();

	const handleAuth = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!supabase) {
			setError("Supabase is not configured yet. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.");
			return;
		}

		setLoading(true);
		setError(null);
		setMessage(null);

		try {
			if (mode === "signin") {
				const { error: signInError } = await supabase.auth.signInWithPassword({
					email,
					password,
				});
				if (signInError) throw signInError;
				router.push("/");
				router.refresh();
			} else {
				const { error: signUpError } = await supabase.auth.signUp({
					email,
					password,
					options: {
						emailRedirectTo: `${window.location.origin}/auth/callback`,
					},
				});
				if (signUpError) throw signUpError;
				setMessage("Check your email for the confirmation link to complete registration!");
			}
		} catch (err: unknown) {
			setError(err instanceof Error ? err.message : "Authentication failed");
		} finally {
			setLoading(false);
		}
	};

	const handleOAuth = async (provider: "github" | "google") => {
		if (!supabase) {
			setError("Supabase is not configured yet.");
			return;
		}

		try {
			const { error } = await supabase.auth.signInWithOAuth({
				provider,
				options: {
					redirectTo: `${window.location.origin}/auth/callback`,
				},
			});
			if (error) throw error;
		} catch (err: unknown) {
			setError(err instanceof Error ? err.message : "OAuth sign in failed");
		}
	};

	return (
		<div className="relative min-h-screen w-full flex items-center justify-center p-4 apple-canvas-bg selection:bg-[#007aff]/30">
			{/* Ambient Top Glow */}
			<div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 size-[600px] rounded-full bg-gradient-to-b from-[#007aff]/20 via-[#5856d6]/10 to-transparent blur-3xl" />

			{/* Floating Glass Authentication Card */}
			<div className="relative w-full max-w-md rounded-3xl apple-glass p-8 shadow-[0_24px_70px_rgba(0,0,0,0.55),inset_0_1px_1px_rgba(255,255,255,0.2)] border border-white/15 backdrop-blur-3xl">
				{/* Top Branding Badge */}
				<div className="flex flex-col items-center text-center mb-6">
					<div className="relative mb-3 flex items-center justify-center">
						<div className="absolute -inset-2 rounded-2xl bg-gradient-to-tr from-[#007aff] to-[#5856d6] opacity-35 blur-lg animate-pulse" />
						<div className="relative size-14 rounded-2xl bg-gradient-to-b from-[#007aff] via-[#0071eb] to-[#5856d6] flex items-center justify-center text-white shadow-lg ring-1 ring-white/20">
							<LhMark className="size-7" />
						</div>
					</div>
					<h1 className="text-2xl font-bold tracking-tight text-foreground font-title">
						LearnHarness Cloud
					</h1>
					<p className="text-xs text-muted-foreground mt-1 max-w-xs leading-relaxed font-sans">
						Your adaptive AI tutor and reasoning canvas, synced across all your devices.
					</p>
				</div>

				{/* Segmented Auth Mode Switch */}
				<div className="mb-6 flex rounded-xl border border-white/10 bg-black/35 p-1 apple-glass">
					<button
						type="button"
						onClick={() => { setMode("signin"); setError(null); setMessage(null); }}
						className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-all apple-btn-tactile cursor-pointer ${
							mode === "signin"
								? "bg-[#007aff] text-white shadow-sm"
								: "text-muted-foreground hover:text-foreground"
						}`}
					>
						Sign In
					</button>
					<button
						type="button"
						onClick={() => { setMode("signup"); setError(null); setMessage(null); }}
						className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-all apple-btn-tactile cursor-pointer ${
							mode === "signup"
								? "bg-[#007aff] text-white shadow-sm"
								: "text-muted-foreground hover:text-foreground"
						}`}
					>
						Create Account
					</button>
				</div>

				{/* Error / Status Messages */}
				{error && (
					<div role="alert" className="mb-4 rounded-xl border border-[#ff453a]/30 bg-[#ff453a]/15 px-3.5 py-2.5 text-xs text-[#ff453a]">
						{error}
					</div>
				)}
				{message && (
					<div role="status" className="mb-4 rounded-xl border border-[#34c759]/30 bg-[#34c759]/15 px-3.5 py-2.5 text-xs text-[#34c759]">
						{message}
					</div>
				)}

				{/* Credentials Form */}
				<form onSubmit={handleAuth} className="space-y-3.5">
					<div className="space-y-1 text-left">
						<label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/80 pl-1 font-mono">
							Email
						</label>
						<div className="relative">
							<MailIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
							<input
								type="email"
								required
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								placeholder="name@example.com"
								className="h-10 w-full rounded-xl border border-white/10 bg-black/30 pl-10 pr-3.5 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none transition-all focus:border-[#007aff] focus:ring-1 focus:ring-[#007aff]"
							/>
						</div>
					</div>

					<div className="space-y-1 text-left">
						<label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/80 pl-1 font-mono">
							Password
						</label>
						<div className="relative">
							<LockIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
							<input
								type="password"
								required
								minLength={6}
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								placeholder="••••••••"
								className="h-10 w-full rounded-xl border border-white/10 bg-black/30 pl-10 pr-3.5 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none transition-all focus:border-[#007aff] focus:ring-1 focus:ring-[#007aff]"
							/>
						</div>
					</div>

					<button
						type="submit"
						disabled={loading}
						className="mt-2 w-full h-10 rounded-xl bg-[#007aff] hover:bg-[#0071eb] text-white font-medium text-sm flex items-center justify-center gap-2 shadow-[0_4px_14px_rgba(0,122,255,0.4)] transition-all apple-btn-tactile disabled:opacity-40 cursor-pointer"
					>
						<span>{loading ? "Processing…" : mode === "signin" ? "Sign In" : "Get Started"}</span>
						<ArrowRightIcon className="size-4" />
					</button>
				</form>

				{/* Social Login Separator */}
				<div className="relative my-6 flex items-center justify-center">
					<div className="w-full border-t border-white/10" />
					<span className="absolute bg-[#1c1c1e] px-2.5 text-[11px] uppercase tracking-wider text-muted-foreground font-mono">
						or continue with
					</span>
				</div>

				{/* Social Providers */}
				<div className="grid grid-cols-2 gap-2.5">
					<button
						type="button"
						onClick={() => handleOAuth("github")}
						className="h-9 rounded-xl border border-white/10 apple-glass-pill flex items-center justify-center gap-2 text-xs font-medium text-foreground hover:bg-white/10 transition-all apple-btn-tactile cursor-pointer"
					>
						<svg className="size-4" viewBox="0 0 24 24" fill="currentColor">
							<path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
						</svg>
						<span>GitHub</span>
					</button>

					<button
						type="button"
						onClick={() => handleOAuth("google")}
						className="h-9 rounded-xl border border-white/10 apple-glass-pill flex items-center justify-center gap-2 text-xs font-medium text-foreground hover:bg-white/10 transition-all apple-btn-tactile cursor-pointer"
					>
						<svg className="size-4" viewBox="0 0 24 24">
							<path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
							<path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
							<path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
							<path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
						</svg>
						<span>Google</span>
					</button>
				</div>
			</div>
		</div>
	);
}
