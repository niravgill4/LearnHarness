"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import { validateEmail } from "@/lib/validation/email";
import { HostDialog } from "@/components/host-dialog";
import { AlertTriangleIcon } from "lucide-react";
import { ReadingPaceTest } from "@/components/reading-pace-test";

// In-memory cache across tab switches to avoid re-fetching on every section click
let cachedUser: User | null = null;
let cachedDisplayName: string = "";

export function AccountSection() {
	const client = useMemo(() => createClient(), []);
	const [user, setUser] = useState<User | null>(cachedUser);
	const [loading, setLoading] = useState(!cachedUser);
	const [name, setName] = useState(cachedDisplayName || (cachedUser?.user_metadata?.display_name ?? ""));
	const [email, setEmail] = useState(cachedUser?.email ?? "");
	const [busy, setBusy] = useState(false);
	const [message, setMessage] = useState("");
	const [error, setError] = useState("");

	// Delete account modal state
	const [showDeleteModal, setShowDeleteModal] = useState(false);
	const [deleting, setDeleting] = useState(false);
	const [deleteError, setDeleteError] = useState("");

	useEffect(() => {
		let live = true;
		if (!client) {
			setLoading(false);
			return;
		}

		void client.auth.getUser().then(({ data, error }) => {
			if (!live) return;
			if (data.user) {
				cachedUser = data.user;
				cachedDisplayName = data.user.user_metadata?.display_name ?? "";
				setUser(data.user);
				setName(cachedDisplayName);
				setEmail(data.user.email ?? "");
			}
			if (error) setError(error.message);
			setLoading(false);
		}).catch(() => {
			if (live) {
				setLoading(false);
				setError("Your account could not be loaded. Reopen this section to retry.");
			}
		});

		return () => { live = false; };
	}, [client]);

	async function save(event: FormEvent) {
		event.preventDefault();
		if (!client || !user) return;
		const validation = validateEmail(email);
		if (!validation.valid) {
			setError(validation.error ?? "Enter a valid email address.");
			return;
		}
		setBusy(true);
		setError("");
		setMessage("");
		try {
			const changingEmail = email.trim() !== user.email;
			const { data, error } = await client.auth.updateUser({
				data: { display_name: name.trim() },
				...(changingEmail ? { email: email.trim() } : {}),
			});
			if (error) throw error;
			cachedUser = data.user;
			cachedDisplayName = name.trim();
			setUser(data.user);
			setMessage(changingEmail ? "Profile saved. Check your email inboxes to confirm the address change." : "Profile saved.");
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Your profile could not be saved.");
		} finally {
			setBusy(false);
		}
	}

	async function signOut() {
		if (!client) return;
		setBusy(true);
		setError("");
		try {
			cachedUser = null;
			cachedDisplayName = "";
			const { error } = await client.auth.signOut({ scope: "local" });
			if (error) throw error;
			window.location.assign("/login");
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Sign-out failed. Try again.");
			setBusy(false);
		}
	}

	async function confirmDeleteAccount() {
		setDeleting(true);
		setDeleteError("");
		try {
			const res = await fetch("/api/account", { method: "DELETE" });
			if (!res.ok) {
				const body = (await res.json().catch(() => ({}))) as { error?: string };
				throw new Error(body.error ?? "Failed to delete account");
			}
			cachedUser = null;
			cachedDisplayName = "";
			if (client) {
				try { await client.auth.signOut({ scope: "local" }); } catch {}
			}
			window.location.assign("/login");
		} catch (cause) {
			setDeleteError(cause instanceof Error ? cause.message : "Deletion failed. Try again.");
			setDeleting(false);
		}
	}

	return (
		<section className="account-settings px-7 py-6" aria-labelledby="account-heading">
			<h2 id="account-heading" className="text-xl font-medium tracking-tight text-foreground">Profile &amp; account</h2>
			<p className="mt-1 text-xs text-muted-foreground">Your identity and sign-in details for Cognera.</p>

			{loading && !user ? (
				<p role="status" className="mt-4 text-xs text-muted-foreground">Loading your account…</p>
			) : !user ? (
				<p className="mt-4 text-xs text-muted-foreground">
					Sign in to manage your cloud profile. <a href="/login" className="underline hover:text-foreground">Open sign-in</a>
				</p>
			) : (
				<div className="mt-6 flex flex-col gap-6">
					<div className="flex items-center gap-3.5">
						<span aria-hidden="true" className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-base font-semibold text-primary">
							{(name || email || "C").charAt(0).toUpperCase()}
						</span>
						<div>
							<strong className="block text-sm font-medium text-foreground">{name || "Your Cognera account"}</strong>
							<p className="text-xs text-muted-foreground">{user.email}</p>
						</div>
					</div>

					<form onSubmit={save} className="flex flex-col gap-3">
						<div>
							<label htmlFor="account-name" className="block text-xs font-medium text-muted-foreground mb-1">Display name</label>
							<input
								id="account-name"
								autoComplete="name"
								maxLength={80}
								value={name}
								onChange={(e) => setName(e.target.value)}
								disabled={busy}
								className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary disabled:opacity-50"
							/>
						</div>

						<div>
							<label htmlFor="account-email" className="block text-xs font-medium text-muted-foreground mb-1">Email address</label>
							<input
								id="account-email"
								type="email"
								autoComplete="email"
								required
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								disabled={busy}
								className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary disabled:opacity-50"
							/>
							<p className="mt-1 text-[11px] text-muted-foreground/80">Email changes require confirmation before the new address becomes active.</p>
						</div>

						<div className="pt-1">
							<button
								disabled={busy}
								type="submit"
								className="rounded-xl bg-primary px-4 py-2 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
							>
								{busy ? "Saving…" : "Save profile"}
							</button>
						</div>
					</form>
					<section className="account-reading-pace" aria-labelledby="account-reading-heading"><h3 id="account-reading-heading">Your reading pace</h3><ReadingPaceTest /></section>

					<div className="flex items-center justify-between border-t border-border pt-4">
						<div>
							<strong className="block text-xs font-medium text-foreground">This session</strong>
							<p className="text-[11px] text-muted-foreground">Sign out of Cognera on this browser.</p>
						</div>
						<button
							type="button"
							disabled={busy}
							onClick={() => void signOut()}
							className="rounded-xl border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50 cursor-pointer"
						>
							Sign out
						</button>
					</div>

					{/* Danger Zone: Delete Account */}
					<div className="rounded-2xl border border-destructive/25 bg-destructive/5 p-4 mt-2">
						<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
							<div>
								<strong className="block text-xs font-semibold text-destructive">Delete account</strong>
								<p className="mt-0.5 text-[11px] text-muted-foreground">
									Permanently wipe your account and all stored chats, graphs, and settings from the database.
								</p>
							</div>
							<button
								type="button"
								disabled={busy}
								onClick={() => setShowDeleteModal(true)}
								className="shrink-0 rounded-xl bg-destructive px-3.5 py-1.5 text-xs font-medium text-destructive-foreground transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
							>
								Delete account
							</button>
						</div>
					</div>
				</div>
			)}

			{error && <p role="alert" className="mt-3 text-xs text-destructive">{error}</p>}
			{message && <p role="status" className="mt-3 text-xs text-primary">{message}</p>}

			{/* Modal Dialog for Confirmation */}
			{showDeleteModal && (
				<HostDialog
					open
					onClose={() => {
						if (!deleting) setShowDeleteModal(false);
						return "closed";
					}}
					backdropProps={{ className: "fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm" }}
					frame={
						<div
							role="dialog"
							aria-modal="true"
							aria-label="Delete account"
							onClick={(e) => e.stopPropagation()}
							className="w-[28rem] max-w-[calc(100vw-2rem)] rounded-2xl border border-border bg-card p-6 shadow-2xl"
						>
							<div className="flex items-center gap-3">
								<div className="flex size-10 items-center justify-center rounded-full bg-destructive/10 text-destructive shrink-0">
									<AlertTriangleIcon className="size-5" />
								</div>
								<div>
									<h2 className="text-base font-semibold text-foreground">Permanently delete account?</h2>
									<p className="text-xs text-muted-foreground">This action is permanent and cannot be undone.</p>
								</div>
							</div>

							<div className="mt-4 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive/90 leading-relaxed">
								All your saved chat conversations, learning history, knowledge graph nodes, customized settings, and credentials will be permanently erased from the database.
							</div>

							{deleteError && (
								<p role="alert" className="mt-3 text-xs text-destructive">
									{deleteError}
								</p>
							)}

							<div className="mt-6 flex items-center justify-end gap-2.5">
								<button
									type="button"
									disabled={deleting}
									onClick={() => setShowDeleteModal(false)}
									className="rounded-xl border border-border px-3.5 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground cursor-pointer"
								>
									Cancel
								</button>
								<button
									type="button"
									disabled={deleting}
									onClick={() => void confirmDeleteAccount()}
									className="rounded-xl bg-destructive px-4 py-2 text-xs font-semibold text-destructive-foreground transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
								>
									{deleting ? "Deleting…" : "Permanently delete account"}
								</button>
							</div>
						</div>
					}
				>
					<span />
				</HostDialog>
			)}
		</section>
	);
}
