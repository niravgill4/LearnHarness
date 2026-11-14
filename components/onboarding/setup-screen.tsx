"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, ExternalLinkIcon, EyeIcon, EyeOffIcon, KeyRoundIcon, LoaderCircleIcon, SparklesIcon } from "lucide-react";
import { ONBOARDING_PROVIDERS, type LearningIntent, type OnboardingProvider, type SetupSnapshot } from "@/lib/onboarding";
import { OnboardingShell } from "./onboarding-shell";
import { ProviderLogo } from "@/components/provider-logo";
import { useChatGPTUI, ChatGPTConnection } from "@/components/settings/chatgpt-connection";
import { SubscriptionConnections } from "@/components/settings/subscription-connections";
import { ClaudeCodeInstallationStatus } from "@/components/settings/claude-code-status";

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
	const heading = useRef<HTMLHeadingElement>(null);

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
				if (result.setup?.provider === firstConnected && result.setup.slots) setSlots(result.setup.slots);
				else if (availableModels[0]) setSlots({ strong: availableModels[0].id, cheap: "", vision: "" });
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

	async function connect(event: FormEvent) {
		event.preventDefault();
		setBusy(true); setError("");
		try {
			if (providerInfo.keyless) {
				await setupRequest({ action: "connect", provider });
				setSnapshot(previous => previous ? { ...previous, connected: [...new Set([...previous.connected, provider])] } : previous);
				const targetModels = snapshot?.models.filter(m => m.provider === provider) ?? [];
					if (targetModels[0]) setSlots({ strong: targetModels[0].id, cheap: "", vision: "" });
				setStep(2);
			} else if (key.trim()) {
				await setupRequest({ action: "connect", provider, key: key.trim() });
				setSnapshot(previous => previous ? { ...previous, connected: [...new Set([...previous.connected, provider])] } : previous);
				setKey(""); setShowKey(false);
				const targetModels = snapshot?.models.filter(m => m.provider === provider) ?? [];
					if (targetModels[0]) setSlots({ strong: targetModels[0].id, cheap: "", vision: "" });
				setStep(2);
			} else if (!alreadyConnected) {
				throw new Error("Enter your provider API key to continue.");
			} else {
				setKey(""); setShowKey(false);
				const targetModels = snapshot?.models.filter(m => m.provider === provider) ?? [];
					if (targetModels[0]) setSlots({ strong: targetModels[0].id, cheap: "", vision: "" });
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
			{step > 1 && <button className="onboarding-back" type="button" disabled={busy} onClick={back}><ArrowLeftIcon />Back</button>}
			{step === 1 && <>
				<h2 ref={heading} tabIndex={-1}>Bring your<br />own intelligence.</h2>
				<p className="onboarding-intro">Connect a model source, then choose which models teach, assist, and read images.</p>
				
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
						<button type="button" className="onboarding-primary mt-3" onClick={() => { setProvider("chatgpt"); setSlots({ strong: "", cheap: "", vision: "" }); setStep(2); }}>
							Choose your ChatGPT models <ArrowRightIcon />
						</button>
					</div>
				)}

				<div className="onboarding-divider"><span>or use an API key</span></div>

				<form onSubmit={connect} className="onboarding-form" aria-busy={busy}>
					<div className="onboarding-providers" role="group" aria-label="Model provider">
						{ONBOARDING_PROVIDERS.filter(p => !p.keyless).map(p => (
							<button type="button" key={p.id} aria-pressed={provider === p.id} disabled={busy} onClick={() => { setProvider(p.id as OnboardingProvider); setKey(""); setSlots({ strong: "", cheap: "", vision: "" }); setError(""); }}>
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
						<input id="provider-key" name="provider-key" autoComplete="off" autoCorrect="off" spellCheck={false} type={showKey ? "text" : "password"} value={key} onChange={event => setKey(event.target.value)} placeholder={alreadyConnected ? "A key is already saved" : "Paste your API key"} required={!alreadyConnected} disabled={busy} />
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
				<div className="onboarding-slot-tabs" role="group" aria-label="Model roles">{(["strong", "cheap", "vision"] as const).map(slot => <button key={slot} type="button" aria-pressed={activeSlot === slot} onClick={() => { setActiveSlot(slot); setSearch(""); }}><span>{slot === "strong" ? "01" : slot === "cheap" ? "02" : "03"} · {slot}</span><strong>{models.find(m => m.id === slots[slot])?.name ?? "Choose a model"}</strong></button>)}</div>
				<p className="onboarding-small">{activeSlot === "strong" ? "Strong is your main tutor and the default for new lessons." : activeSlot === "cheap" ? "Cheap handles supporting tasks. Pick a faster or lower-cost model if available." : "Vision needs an image-capable model for pictures and visual material."}</p>
				<label className="onboarding-sr-label" htmlFor="model-search">Search models</label>
				<input className="onboarding-search" id="model-search" type="search" placeholder="Find a model…" value={search} onChange={e => setSearch(e.target.value)} />
				<div className="onboarding-model-list" role="group" aria-label={`Choose ${activeSlot} model`}>
					{filteredModels.length ? filteredModels.map(model => (
						<button key={model.id} type="button" aria-pressed={slots[activeSlot] === model.id} onClick={() => { setSlots(previous => ({ ...previous, [activeSlot]: model.id })); if (activeSlot === "strong") setActiveSlot("cheap"); else if (activeSlot === "cheap") setActiveSlot("vision"); setSearch(""); }}>
							<span className="onboarding-model-identity">
								<ProviderLogo provider={model.id + " " + model.name + " " + model.provider} />
								<span><strong>{model.name}</strong><small>{model.vision ? "Text and images" : "Text"}</small></span>
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
