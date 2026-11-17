"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, ChevronDownIcon, ExternalLinkIcon, EyeIcon, EyeOffIcon, KeyRoundIcon, LoaderCircleIcon, SparklesIcon } from "lucide-react";
import { ONBOARDING_PROVIDERS, type LearningIntent, type OnboardingProvider, type SetupSnapshot } from "@/lib/onboarding";
import { OnboardingShell } from "./onboarding-shell";
import { ProviderLogo } from "@/components/provider-logo";
import { useChatGPTUI, ChatGPTConnection } from "@/components/settings/chatgpt-connection";
import { SubscriptionConnections } from "@/components/settings/subscription-connections";
import { ClaudeCodeInstallationStatus } from "@/components/settings/claude-code-status";
import { ReadingPaceTest } from "@/components/reading-pace-test";
import { FeatureTour } from "./feature-tour";

const GEMINI_FREE_MODELS = ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-2.5-flash-lite"];

export function recommendSlotsForProvider(
	provider: string,
	availableModels: { id: string; name: string; vision: boolean }[],
	preferFreeGemini = false,
): Record<"strong" | "cheap" | "vision", string> {
	if (!availableModels.length) return { strong: "", cheap: "", vision: "" };
	if (provider === "google" && preferFreeGemini) {
		for (const id of GEMINI_FREE_MODELS) {
			const candidate = availableModels.find(model => model.id === id && model.vision);
			if (candidate) return { strong: id, cheap: id, vision: id };
		}
	}
	const strong = availableModels.find(m => /chatgpt-?4o(?!-mini)|gpt-?4o(?!-mini)|sonnet|opus|o1\b|pro|gpt-?4-turbo|claude-3-5/i.test(`${m.name} ${m.id}`)) ?? availableModels[0];
	const cheap = availableModels.find(m => m.id !== strong?.id && /haiku|mini|flash|gpt-?3\.5/i.test(`${m.name} ${m.id}`))
		?? availableModels.find(m => /haiku|mini|flash|gpt-?3\.5/i.test(`${m.name} ${m.id}`))
		?? availableModels[1]
		?? availableModels[0];
	const vision = availableModels.find(m => m.vision && (m.id === strong?.id || /chatgpt-?4o|gpt-?4o|sonnet|opus|flash|pro/i.test(`${m.name} ${m.id}`)))
		?? availableModels.find(m => m.vision)
		?? availableModels[0];

	return {
		strong: strong?.id ?? "",
		cheap: cheap?.id ?? "",
		vision: vision?.id ?? "",
	};
}

export function isModelRecommended(
	model: { id: string; name: string; vision: boolean },
	slot: "strong" | "cheap" | "vision"
): boolean {
	const n = (model.name + " " + model.id).toLowerCase();
	if (slot === "strong") return /chatgpt-?4o(?!-mini)|gpt-?4o(?!-mini)|sonnet|opus|o1\b|pro|gpt-?4-turbo|claude-3-5/i.test(n);
	if (slot === "cheap") return /haiku|mini|flash|gpt-?3\.5/i.test(n);
	if (slot === "vision") return model.vision && /chatgpt-?4o|gpt-?4o|sonnet|opus|flash|pro/i.test(n);
	return false;
}

async function setupRequest(body?: unknown, signal?: AbortSignal): Promise<SetupSnapshot & { saved?: boolean }> {
	const response = await fetch("/api/onboarding", { method: body ? "POST" : "GET", headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined, cache: "no-store", signal });
	const result = await response.json();
	if (!response.ok) throw new Error(result.error || "Your setup could not be loaded. Please try again.");
	return result;
}

export function SetupScreen() {
	const router = useRouter();
	const chatgptUI = useChatGPTUI();
	const [snapshot, setSnapshot] = useState<SetupSnapshot | null>(null);
	const [step, setStep] = useState(1);
	const [tourSlide, setTourSlide] = useState(0);
	const [showGeminiGuide, setShowGeminiGuide] = useState(false);
	const [preferFreeGemini, setPreferFreeGemini] = useState(false);
	const [provider, setProvider] = useState<OnboardingProvider>("openrouter");
	const [key, setKey] = useState("");
	const [showKey, setShowKey] = useState(false);
	const [slots, setSlots] = useState<Record<"strong" | "cheap" | "vision", string>>({ strong: "", cheap: "", vision: "" });
	const [activeSlot, setActiveSlot] = useState<"strong" | "cheap" | "vision">("strong");
	const [search, setSearch] = useState("");
	const [topic, setTopic] = useState("");
	const [intent, setIntent] = useState<LearningIntent>("understand");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [loadAttempt, setLoadAttempt] = useState(0);
	const [callbackUrl, setCallbackUrl] = useState("");
	const [callbackSubmitting, setCallbackSubmitting] = useState(false);
	const heading = useRef<HTMLHeadingElement>(null);
	const providerKey = useRef<HTMLInputElement>(null);

	const isChatgptConnected = chatgptUI.status.accounts.some(a => a.id === chatgptUI.status.activeId && a.connected);
	const activeChatgptAccount = chatgptUI.status.accounts.find(a => a.id === chatgptUI.status.activeId && a.connected);

	useEffect(() => {
		if (isChatgptConnected) {
			setLoadAttempt(n => n + 1);
		}
	}, [isChatgptConnected]);

	useEffect(() => {
		const controller = new AbortController();
		setError("");
		void setupRequest(undefined, controller.signal).then(result => {
			if (result.setup?.completedAt && result.configured) { router.replace("/"); return; }
			setSnapshot(result);
			if (result.connected.length) {
				const firstConnected = (result.setup?.provider && result.connected.includes(result.setup.provider) ? result.setup.provider : result.connected[0]) as OnboardingProvider;
				setProvider(firstConnected);
				const availableModels = result.models.filter(m => m.provider === firstConnected);
				const recs = recommendSlotsForProvider(firstConnected, availableModels);
				if (result.setup?.provider === firstConnected && result.setup.slots) {
					setSlots({
						strong: result.setup.slots.strong || recs.strong,
						cheap: result.setup.slots.cheap || recs.cheap,
						vision: result.setup.slots.vision || recs.vision,
					});
				} else {
					setSlots(recs);
				}
				setStep(2);
			}
		}).catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Your setup could not be loaded."); });
		return () => controller.abort();
	}, [loadAttempt, router]);

	useEffect(() => { if (snapshot) heading.current?.focus(); }, [step, snapshot]);

	const fallbackProvider: (typeof ONBOARDING_PROVIDERS)[number] = ONBOARDING_PROVIDERS[0] ?? {
		id: "chatgpt",
		name: "Codex / ChatGPT",
		detail: "ChatGPT subscription",
		url: "https://chatgpt.com",
		keyless: true,
	};
	const providerInfo = ONBOARDING_PROVIDERS.find(p => p.id === provider) ?? fallbackProvider;
	const models = snapshot?.models.filter(m => m.provider === provider) ?? [];
	const filteredModels = models.filter(m => (activeSlot !== "vision" || m.vision) && `${m.name} ${m.id}`.toLowerCase().includes(search.toLowerCase()));
	const selectedModel = models.find(m => m.id === slots.strong);
	const alreadyConnected = provider === "chatgpt" ? isChatgptConnected : !!snapshot?.connected.includes(provider);
	const geminiFreeModel = provider === "google" ? GEMINI_FREE_MODELS
		.map(id => models.find(model => model.id === id && model.vision))
		.find(Boolean) : undefined;

	async function connect(event: FormEvent) {
		event.preventDefault();
		setBusy(true); setError("");
		try {
			if (providerInfo.keyless) {
				await setupRequest({ action: "connect", provider });
				setSnapshot(previous => previous ? { ...previous, connected: [...new Set([...previous.connected, provider])] } : previous);
				const targetModels = snapshot?.models.filter(m => m.provider === provider) ?? [];
				setSlots(recommendSlotsForProvider(provider, targetModels, preferFreeGemini));
				setStep(2);
			} else if (key.trim()) {
				await setupRequest({ action: "connect", provider, key: key.trim() });
				setSnapshot(previous => previous ? { ...previous, connected: [...new Set([...previous.connected, provider])] } : previous);
				setKey(""); setShowKey(false);
				const targetModels = snapshot?.models.filter(m => m.provider === provider) ?? [];
				setSlots(recommendSlotsForProvider(provider, targetModels, preferFreeGemini));
				setStep(2);
			} else if (!alreadyConnected) {
				throw new Error("Enter your provider API key to continue.");
			} else {
				setKey(""); setShowKey(false);
				const targetModels = snapshot?.models.filter(m => m.provider === provider) ?? [];
				setSlots(recommendSlotsForProvider(provider, targetModels, preferFreeGemini));
				setStep(2);
			}
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Your key could not be saved.");
		} finally {
			setBusy(false);
		}
	}

	async function finish(event: FormEvent) {
		event.preventDefault(); setBusy(true); setError("");
		if (!slots.strong || !slots.cheap || !slots.vision) {
			setError("Choose a model for all three roles.");
			setBusy(false);
			return;
		}
		try {
			await setupRequest({ action: "complete", provider, slots, topic: topic.trim(), intent });
			router.replace("/?welcome=1"); router.refresh();
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Your preferences could not be saved.");
		} finally {
			setBusy(false);
		}
	}

	const back = () => { setError(""); setStep(value => Math.max(1, value - 1)); };

	function triggerCodexConnect() {
		chatgptUI.connect();
	}

	return <OnboardingShell step={step}><div className="onboarding-step" key={snapshot ? step : "loading"}>
		{!snapshot ? <>
			<h2 ref={heading} tabIndex={-1}>A space for<br />your next idea.</h2>
			{error ? <><p role="alert" className="onboarding-error">{error}</p><button type="button" className="onboarding-primary" onClick={() => setLoadAttempt(v => v + 1)}>Try again</button><a className="onboarding-text-button" href="/login">Back to account</a></> : <p role="status" className="onboarding-intro"><LoaderCircleIcon className="onboarding-spinner" /> Getting your space ready…</p>}
		</> : <>
			{step > 1 && step !== 4 && <button className="onboarding-back" type="button" disabled={busy} onClick={back}><ArrowLeftIcon />Back</button>}
			{step === 1 && <>
				<h2 ref={heading} tabIndex={-1}>Bring your<br />own intelligence.</h2>
				<p className="onboarding-intro">Connect a model source, then choose which models teach, assist, and read images.</p>
				<button className="onboarding-gemini-toggle" type="button" aria-expanded={showGeminiGuide} aria-controls="onboarding-gemini-guide" onClick={() => setShowGeminiGuide(open => !open)}>
					Don’t have any of these? <ChevronDownIcon size={16} aria-hidden="true" />
				</button>
				<div className="onboarding-gemini-guide" id="onboarding-gemini-guide" hidden={!showGeminiGuide}>
					<div className="onboarding-gemini-title"><ProviderLogo provider="google" /><h3>Get a free Gemini API key</h3></div>
					<ol>
						<li>Open Google AI Studio and sign in with your Google account.</li>
						<li>Choose <strong>Create API key</strong> and select or create a Google Cloud project. Follow any verification prompts.</li>
						<li>Copy the key. Return here, choose <strong>Use a Gemini key</strong>, and paste it into the form.</li>
					</ol>
					<p>Google’s free tier has project and model limits. In model setup, choose a Flash-Lite model available on your project’s free tier for all three roles.</p>
					<div className="onboarding-gemini-actions">
						<a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">Open Google AI Studio <ExternalLinkIcon size={14} aria-hidden="true" /></a>
						<button type="button" disabled={busy} onClick={() => {
							setPreferFreeGemini(true);
							if (provider !== "google") {
								setProvider("google");
								setKey("");
								setShowKey(false);
								setSlots({ strong: "", cheap: "", vision: "" });
								setError("");
							}
							providerKey.current?.focus();
						}}>Use a Gemini key</button>
					</div>
				</div>
				
				<div className="onboarding-account-actions">
					<button type="button" className="onboarding-account-connect" disabled={busy || chatgptUI.busy} onClick={triggerCodexConnect}>
						<ProviderLogo provider="openai" />
						<span>
							{isChatgptConnected ? `Codex / ChatGPT Connected (${activeChatgptAccount?.email || "Account"})` : "Connect to Codex / ChatGPT"}
							<small>{isChatgptConnected ? "Click to manage accounts or reconnect" : "Opens ChatGPT connection popup"}</small>
						</span>
						<ArrowRightIcon />
					</button>
				</div>

				{chatgptUI.status.pending && (
					<div className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm mt-3 space-y-3">
						<div className="flex items-center gap-2 font-medium text-foreground">
							<LoaderCircleIcon className="w-4 h-4 animate-spin text-primary" />
							<span>Waiting for Codex / ChatGPT sign-in…</span>
						</div>
						<p className="text-xs text-muted-foreground leading-relaxed">
							If you are on an <strong>iPad or mobile device</strong>, Safari will display <em>“Safari cannot open the page because it could not connect to the server”</em> after you sign in on OpenAI.
						</p>
						<p className="text-xs text-muted-foreground leading-relaxed">
							Simply copy the address from Safari’s address bar (starting with <code className="text-primary font-mono bg-background px-1 py-0.5 rounded border border-border">http://127.0.0.1:...</code>) and paste it here:
						</p>
						<form
							onSubmit={async (e) => {
								e.preventDefault();
								if (!callbackUrl.trim() || callbackSubmitting) return;
								setCallbackSubmitting(true);
								try {
									await chatgptUI.callback(callbackUrl.trim());
								} finally {
									setCallbackSubmitting(false);
								}
							}}
							className="flex flex-col gap-2"
						>
							<div className="flex gap-2">
								<input
									name="callbackUrl"
									type="text"
									placeholder="Paste http://127.0.0.1:... address here"
									value={callbackUrl}
									onChange={(e) => setCallbackUrl(e.target.value)}
									disabled={callbackSubmitting}
									className="flex-1 select-text rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
								/>
								<button
									type="button"
									onClick={async () => {
										try {
											if (navigator.clipboard?.readText) {
												const text = await navigator.clipboard.readText();
												if (text) setCallbackUrl(text);
											}
										} catch {}
									}}
									disabled={callbackSubmitting}
									className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground hover:bg-muted cursor-pointer shrink-0"
								>
									Paste
								</button>
							</div>
							<button
								type="submit"
								disabled={!callbackUrl.trim() || callbackSubmitting}
								className="onboarding-primary !py-2 !px-4 !text-xs self-start whitespace-nowrap cursor-pointer"
							>
								{callbackSubmitting ? "Connecting…" : "Complete Sign-in"}
							</button>
						</form>
					</div>
				)}

				<div className="onboarding-native-block">
					<div className="onboarding-native-section">
						<h3 className="onboarding-section-title">Subscriptions</h3>
						<SubscriptionConnections setup />
					</div>
					<div className="onboarding-native-section">
						<h3 className="onboarding-section-title">External CLI</h3>
						<ClaudeCodeInstallationStatus />
					</div>
				</div>

				{isChatgptConnected && (
					<div className="onboarding-keyless-card">
						<p className="onboarding-keyless-note">
							<CheckIcon className="inline-block w-4 h-4 mr-1 text-emerald-400" />
							Connected to <strong>{activeChatgptAccount?.email || "ChatGPT"}</strong>. You can now proceed to model selection.
						</p>
						<button type="button" className="onboarding-primary mt-3" onClick={() => {
							setProvider("chatgpt");
							const targetModels = snapshot?.models.filter(m => m.provider === "chatgpt") ?? [];
							setSlots(recommendSlotsForProvider("chatgpt", targetModels));
							setStep(2);
						}}>
							Choose your ChatGPT models <ArrowRightIcon />
						</button>
					</div>
				)}

				<div className="onboarding-divider"><span>or use an API key</span></div>

				<form onSubmit={connect} className="onboarding-form" aria-busy={busy}>
					<div className="onboarding-providers" role="group" aria-label="Model provider">
						{ONBOARDING_PROVIDERS.filter(p => !p.keyless).map(p => (
							<button type="button" key={p.id} aria-pressed={provider === p.id} disabled={busy} onClick={() => { setProvider(p.id as OnboardingProvider); setPreferFreeGemini(false); setKey(""); setSlots({ strong: "", cheap: "", vision: "" }); setError(""); }}>
								<span className="provider-monogram" aria-hidden="true"><ProviderLogo provider={p.id} /></span>
								<span><strong>{p.name}</strong><small>{p.detail}</small></span>
								{provider === p.id && <CheckIcon />}
							</button>
						))}
					</div>

					<div className="onboarding-label-row">
						<label htmlFor="provider-key">{providerInfo.name} API key</label>
						<a href={providerInfo.url} target="_blank" rel="noopener noreferrer">Get a key<ExternalLinkIcon /></a>
					</div>
					<div className="onboarding-secret-field">
						<input ref={providerKey} id="provider-key" name="provider-key" autoComplete="off" autoCorrect="off" spellCheck={false} type={showKey ? "text" : "password"} value={key} onChange={event => setKey(event.target.value)} placeholder={alreadyConnected ? "A key is already saved" : "Paste your API key"} required={!alreadyConnected} disabled={busy} />
						<button type="button" aria-label={showKey ? "Hide API key" : "Show API key"} aria-pressed={showKey} onClick={() => setShowKey(value => !value)}>{showKey ? <EyeOffIcon /> : <EyeIcon />}</button>
					</div>
					<p className="onboarding-key-note"><KeyRoundIcon />Encrypted in your account. Never stored in this browser.</p>

					{error && <p role="alert" className="onboarding-error">{error}</p>}
					<button type="submit" className="onboarding-primary" disabled={busy}>
						{busy ? <><LoaderCircleIcon className="onboarding-spinner" />Connecting…</> : <>{alreadyConnected && !key ? "Use saved connection" : "Save and continue"}<ArrowRightIcon /></>}
					</button>
				</form>
				<p className="onboarding-small">Your API key is encrypted in your account. Local subscription and CLI connections depend on the machine running Cognera.</p>
			</>}
			{step === 2 && <>
				<h2 ref={heading} tabIndex={-1}>Choose a mind<br />to learn alongside.</h2>
				<p className="onboarding-intro">Give each job its own model. Strong teaches, cheap handles lighter work, and vision reads images.</p>
				<div className="onboarding-connected"><CheckIcon />{providerInfo.name} selected</div>
				{geminiFreeModel && <p className="onboarding-small">For free-tier setup, use {geminiFreeModel.name} in all three roles if it’s available on your <a className="underline" href="https://aistudio.google.com/rate-limit" target="_blank" rel="noopener noreferrer">Google AI Studio project</a>.</p>}
				<div className="onboarding-slot-tabs" role="group" aria-label="Model roles">{(["strong", "cheap", "vision"] as const).map(slot => <button key={slot} type="button" aria-pressed={activeSlot === slot} onClick={() => { setActiveSlot(slot); setSearch(""); }}><span>{slot === "strong" ? "01" : slot === "cheap" ? "02" : "03"} · {slot}</span><strong>{models.find(m => m.id === slots[slot])?.name ?? "Choose a model"}</strong></button>)}</div>
				<p className="onboarding-small">{activeSlot === "strong" ? "Strong is your main tutor and the default for new lessons." : activeSlot === "cheap" ? "Cheap handles supporting tasks. Pick a faster or lower-cost model if available." : "Vision needs an image-capable model for pictures and visual material."}</p>
				<label className="onboarding-sr-label" htmlFor="model-search">Search models</label>
				<input className="onboarding-search" id="model-search" type="search" placeholder="Find a model…" value={search} onChange={e => setSearch(e.target.value)} />
				<div className="onboarding-model-list" role="group" aria-label={`Choose ${activeSlot} model`}>
					{filteredModels.length ? filteredModels.map(model => (
						<button key={model.id} type="button" aria-pressed={slots[activeSlot] === model.id} onClick={() => { setSlots(previous => ({ ...previous, [activeSlot]: model.id })); if (activeSlot === "strong") setActiveSlot("cheap"); else if (activeSlot === "cheap") setActiveSlot("vision"); setSearch(""); }}>
							<span className="onboarding-model-identity">
								<ProviderLogo provider={model.id + " " + model.name + " " + model.provider} />
								<span>
									<strong>
										{model.name}
										{(preferFreeGemini && geminiFreeModel ? model.id === geminiFreeModel.id : isModelRecommended(model, activeSlot)) && (
											<span className="onboarding-model-badge">Recommended</span>
										)}
									</strong>
									<small>{model.vision ? "Text and images" : "Text"}</small>
								</span>
							</span>
							<span className="onboarding-choice-dot">{slots[activeSlot] === model.id && <CheckIcon />}</span>
						</button>
					)) : <p className="onboarding-small">{activeSlot === "vision" ? "No image-capable models for this provider." : "No matching models. Try another name."}</p>}
				</div>
				{!models.some(m => m.vision) && <p role="alert" className="onboarding-error">This provider has no image-capable model. Connect another provider to finish vision setup.</p>}
				<button className="onboarding-primary" type="button" disabled={!slots.strong || !slots.cheap || !slots.vision} onClick={() => { setError(""); setStep(3); }}>Continue<ArrowRightIcon /></button>
				<p className="onboarding-small">Model access depends on your provider account or subscription.</p>
			</>}
			{step === 3 && <>
				<h2 ref={heading} tabIndex={-1}>Find your<br />natural pace.</h2>
				<ReadingPaceTest allowSkip onContinue={() => { setTourSlide(0); setStep(4); }} />
			</>}
			{step === 4 && <FeatureTour slide={tourSlide} onSlideChange={setTourSlide} onBack={back} onDone={() => setStep(5)} />}
			{step === 5 && <>
				<h2 ref={heading} tabIndex={-1}>What’s on<br />your mind?</h2>
				<p className="onboarding-intro">A topic, a question, a thing you’ve never quite understood. Start anywhere.</p>
				<form onSubmit={finish} className="onboarding-form" aria-busy={busy}>
					<label htmlFor="first-topic">Your first topic <span className="onboarding-optional">Optional</span></label>
					<textarea id="first-topic" maxLength={500} rows={3} placeholder="I’ve always wondered how…" value={topic} onChange={e => setTopic(e.target.value)} disabled={busy} />
					<fieldset className="onboarding-intents">
						<legend>How would you like to begin?</legend>
						{([{ id: "understand", title: "Understand something deeply", description: "Work through the why, not just the what." }, { id: "exam", title: "Get ready for an exam", description: "Find the gaps. Practise what matters." }, { id: "explore", title: "Follow my curiosity", description: "Make connections as you go." }] as const).map(option => (
							<label key={option.id}>
								<input type="radio" name="learning-intent" value={option.id} checked={intent === option.id} onChange={() => setIntent(option.id)} disabled={busy} />
								<span><strong>{option.title}</strong><small>{option.description}</small></span>
							</label>
						))}
					</fieldset>
					{error && <p role="alert" className="onboarding-error">{error}</p>}
					<button className="onboarding-primary" disabled={busy} type="submit">
						{busy ? <><LoaderCircleIcon className="onboarding-spinner" />Entering your space…</> : <>Enter your learning studio<ArrowRightIcon /></>}
					</button>
				</form>
				<p className="onboarding-small">{selectedModel?.name ?? "Model"} selected. Your preferences stay with your account.</p>
			</>}
		</>}
	</div></OnboardingShell>;
}
