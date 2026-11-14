import Image from "next/image";
/** Locally hosted provider brand assets. */
export function ProviderLogo({ provider }: { provider: string }) {
	const brand = /claude|anthropic/i.test(provider) ? "anthropic" : /gemini|google/i.test(provider) ? "google" : /openai|chatgpt|gpt|codex/i.test(provider) ? "openai" : /openrouter/i.test(provider) ? "openrouter" : null;
	return brand ? <Image src={`/provider-logos/${brand}.svg`} width={22} height={22} unoptimized alt="" aria-hidden="true" className={`provider-logo provider-logo-${brand}`} /> : null;
}
