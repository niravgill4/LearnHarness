"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, ExternalLinkIcon, EyeIcon, EyeOffIcon, KeyRoundIcon, LoaderCircleIcon } from "lucide-react";
import { ONBOARDING_PROVIDERS, type LearningIntent, type OnboardingProvider, type SetupSnapshot } from "@/lib/onboarding";
import { OnboardingShell } from "./onboarding-shell";

async function setupRequest(body?: unknown, signal?: AbortSignal): Promise<SetupSnapshot & { saved?: boolean }> {
	const response = await fetch("/api/onboarding", { method: body ? "POST" : "GET", headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined, cache: "no-store", signal });
	const result = await response.json();
	if (!response.ok) throw new Error(result.error || "Your setup could not be loaded. Please try again.");
	return result;
}

export function SetupScreen() {
	const router = useRouter();
	const [snapshot, setSnapshot] = useState<SetupSnapshot | null>(null);
	const [step, setStep] = useState(1);
	const [provider, setProvider] = useState<OnboardingProvider>("openrouter");
	const [key, setKey] = useState("");
	const [showKey, setShowKey] = useState(false);
	const [modelId, setModelId] = useState("");
	const [search, setSearch] = useState("");
	const [topic, setTopic] = useState("");
	const [intent, setIntent] = useState<LearningIntent>("understand");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [loadAttempt, setLoadAttempt] = useState(0);
	const heading = useRef<HTMLHeadingElement>(null);
	useEffect(() => {
		const controller = new AbortController();
		setError("");
		void setupRequest(undefined, controller.signal).then(result => {
			if (result.setup?.completedAt) { router.replace("/"); return; }
			setSnapshot(result);
			if (result.connected.length) {
				setProvider(result.connected[0] as OnboardingProvider); setStep(2);
			}
		}).catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Your setup could not be loaded."); });
		return () => controller.abort();
	}, [loadAttempt, router]);
	useEffect(() => { if (snapshot) heading.current?.focus(); }, [step, snapshot]);
	const providerInfo = ONBOARDING_PROVIDERS.find(p => p.id === provider)!;
	const models = snapshot?.models.filter(m => m.provider === provider) ?? [];
	const filteredModels = models.filter(m => `${m.name} ${m.id}`.toLowerCase().includes(search.toLowerCase()));
	const selectedModel = models.find(m => m.id === modelId);
	const alreadyConnected = !!snapshot?.connected.includes(provider);
	async function connect(event: FormEvent) {
		event.preventDefault();
		setBusy(true); setError("");
		try {
			if (key.trim()) {
				await setupRequest({ action: "connect", provider, key: key.trim() });
				setSnapshot(previous => previous ? { ...previous, connected: [...new Set([...previous.connected, provider])] } : previous);
			} else if (!alreadyConnected) throw new Error("Enter your provider API key to continue.");
			setKey(""); setShowKey(false); setStep(2);
		} catch (cause) { setError(cause instanceof Error ? cause.message : "Your key could not be saved."); }
		finally { setBusy(false); }
	}
	async function finish(event: FormEvent) {
		event.preventDefault(); setBusy(true); setError("");
		try {
			await setupRequest({ action: "complete", provider, modelId, topic: topic.trim(), intent });
			router.replace("/?welcome=1"); router.refresh();
		} catch (cause) { setError(cause instanceof Error ? cause.message : "Your preferences could not be saved."); }
		finally { setBusy(false); }
	}
	const back = () => { setError(""); setStep(value => Math.max(1, value - 1)); };
	return <OnboardingShell step={step}><div className="onboarding-step" key={snapshot ? step : "loading"}>
		{!snapshot ? <>
			<h2 ref={heading} tabIndex={-1}>A space for<br />your next idea.</h2>
			{error ? <><p role="alert" className="onboarding-error">{error}</p><button type="button" className="onboarding-primary" onClick={() => setLoadAttempt(v => v + 1)}>Try again</button><a className="onboarding-text-button" href="/login">Back to account</a></> : <p role="status" className="onboarding-intro"><LoaderCircleIcon className="onboarding-spinner" /> Getting your space ready…</p>}
		</> : <>
			{step > 1 && <button className="onboarding-back" type="button" disabled={busy} onClick={back}><ArrowLeftIcon />Back</button>}
			{step === 1 && <>
				<h2 ref={heading} tabIndex={-1}>Bring your<br />own intelligence.</h2><p className="onboarding-intro">Choose a provider and add your API key. Your provider bills you directly for model use.</p>
				<form onSubmit={connect} className="onboarding-form" aria-busy={busy}>
					<div className="onboarding-providers" role="group" aria-label="Model provider">{ONBOARDING_PROVIDERS.map(p => <button type="button" key={p.id} aria-pressed={provider === p.id} disabled={busy} onClick={() => { setProvider(p.id); setKey(""); setModelId(""); setError(""); }}><span className="provider-monogram" aria-hidden="true">{p.name.charAt(0)}</span><span><strong>{p.name}</strong><small>{p.detail}</small></span>{provider === p.id && <CheckIcon />}</button>)}</div>
					<div className="onboarding-label-row"><label htmlFor="provider-key">{providerInfo.name} API key</label><a href={providerInfo.url} target="_blank" rel="noopener noreferrer">Get a key<ExternalLinkIcon /></a></div>
					<div className="onboarding-secret-field"><input id="provider-key" name="provider-key" autoComplete="off" autoCorrect="off" spellCheck={false} type={showKey ? "text" : "password"} value={key} onChange={event => setKey(event.target.value)} placeholder={alreadyConnected ? "A key is already saved" : "Paste your API key"} required={!alreadyConnected} disabled={busy} /><button type="button" aria-label={showKey ? "Hide API key" : "Show API key"} aria-pressed={showKey} onClick={() => setShowKey(value => !value)}>{showKey ? <EyeOffIcon /> : <EyeIcon />}</button></div>
					<p className="onboarding-key-note"><KeyRoundIcon />Encrypted in your account. Never stored in this browser.</p>
					{error && <p role="alert" className="onboarding-error">{error}</p>}
					<button type="submit" className="onboarding-primary" disabled={busy}>{busy ? <><LoaderCircleIcon className="onboarding-spinner" />Saving connection…</> : <>{alreadyConnected && !key ? "Use saved connection" : "Save and continue"}<ArrowRightIcon /></>}</button>
				</form><p className="onboarding-small">Saving checks the key’s format. Your first model request checks provider access.</p>
			</>}
			{step === 2 && <>
				<h2 ref={heading} tabIndex={-1}>Choose a mind<br />to learn alongside.</h2><p className="onboarding-intro">Pick a {providerInfo.name} model for your lessons. You can change it later in settings.</p>
				<div className="onboarding-connected"><CheckIcon />{providerInfo.name} key saved</div>
				<label className="onboarding-sr-label" htmlFor="model-search">Search models</label><input className="onboarding-search" id="model-search" type="search" placeholder="Find a model…" value={search} onChange={e => setSearch(e.target.value)} />
				<div className="onboarding-model-list" role="group" aria-label="Choose your model">{filteredModels.length ? filteredModels.map(model => <button key={model.id} type="button" aria-pressed={model.id === modelId} onClick={() => setModelId(model.id)}><span><strong>{model.name}</strong><small>{model.vision ? "Text and images" : "Text"}</small></span><span className="onboarding-choice-dot">{model.id === modelId && <CheckIcon />}</span></button>) : <p className="onboarding-small">No matching models. Try another name.</p>}</div>
				<button className="onboarding-primary" type="button" disabled={!selectedModel} onClick={() => { setError(""); setStep(3); }}>Continue<ArrowRightIcon /></button>
				<p className="onboarding-small">Model access and pricing depend on your provider account.</p>
			</>}
			{step === 3 && <>
				<h2 ref={heading} tabIndex={-1}>What’s on<br />your mind?</h2><p className="onboarding-intro">A topic, a question, a thing you’ve never quite understood. Start anywhere.</p>
				<form onSubmit={finish} className="onboarding-form" aria-busy={busy}>
					<label htmlFor="first-topic">Your first topic <span className="onboarding-optional">Optional</span></label><textarea id="first-topic" maxLength={500} rows={3} placeholder="I’ve always wondered how…" value={topic} onChange={e => setTopic(e.target.value)} disabled={busy} />
					<fieldset className="onboarding-intents"><legend>How would you like to begin?</legend>{([{ id: "understand", title: "Understand something deeply", description: "Work through the why, not just the what." }, { id: "exam", title: "Get ready for an exam", description: "Find the gaps. Practise what matters." }, { id: "explore", title: "Follow my curiosity", description: "Make connections as you go." }] as const).map(option => <label key={option.id}><input type="radio" name="learning-intent" value={option.id} checked={intent === option.id} onChange={() => setIntent(option.id)} disabled={busy} /><span><strong>{option.title}</strong><small>{option.description}</small></span></label>)}</fieldset>
					{error && <p role="alert" className="onboarding-error">{error}</p>}
					<button className="onboarding-primary" disabled={busy} type="submit">{busy ? <><LoaderCircleIcon className="onboarding-spinner" />Making it yours…</> : <>Enter your learning studio<ArrowRightIcon /></>}</button>
				</form><p className="onboarding-small">{selectedModel?.name} is selected. Your preferences stay with your account.</p>
			</>}
		</>}
	</div></OnboardingShell>;
}
