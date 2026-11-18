/**
 * THE COMPOSITION ROOT for storage — the single place concrete store
 * adapters are wired. Everything else (core, services, agents) codes against
 * the port types in core/ports.ts and receives instances through this
 * module. Swapping the fs adapter for SQLite later changes exactly this
 * file (and the adapter implementations in src/store/).
 */

import { chatStore } from "../store/chats.ts";
import { graphStore as filesystemGraphStore } from "../store/graph.ts";
import { sourceOrganizationStore } from "../store/source-organization.ts";
import { jobStore } from "../store/jobs.ts";
import { settingsStore } from "../store/settings.ts";
import { themeStore } from "../store/themes.ts";
import { resolveSettings, type EffectiveSettings } from "../core/settings-resolution.ts";
import { syncCustomProvider } from "./custom-provider.ts";
import { configureWorkerRequestAdmission } from "../agent/worker-request-admission.ts";
import { userAuthStorage } from "../core/user-auth-context.ts";
import type { GraphStore } from "../core/ports.ts";

const graphStore: GraphStore = new Proxy(filesystemGraphStore, {
 get(target, property) {
  const context = userAuthStorage.getStore();
  if (context?.userId && !context.graphStore) throw new Error("Account graph has not been loaded; shared filesystem access refused");
  const selected = context?.graphStore ?? target;
  const value = Reflect.get(selected, property);
  return typeof value === "function" ? value.bind(selected) : value;
 },
});
/** The wired adapters. Satisfies core/graph.ts's GraphDeps structurally. */
export const stores = {
	chatStore,
	graphStore,
	sourceOrganizationStore,
	jobStore,
	settingsStore,
	themeStore,
};

export type Stores = typeof stores;

/**
 * The resolved view of the settings record (core/settings-resolution.ts):
 * every knob concrete over its factory default — EXCEPT MODELS (BYOK all
 * the way down, owner 2026-09-22): no factory pins exist, so unset model
 * slots resolve to null and per-need refusal gates fire downstream. Read
 * fresh on every call — the record is a small file and turns are rare, so
 * no caching layer (stale toggles after a settings PUT would be worse).
 */
export function effectiveSettings(): EffectiveSettings {
	return resolveSettings(settingsStore.readSettings());
}

// Runtime policy is supplied at the composition root, never imported by agents.
configureWorkerRequestAdmission(() => effectiveSettings().agent.workerRequestConcurrency);

// Boot: register the custom endpoint (when configured) into piModels(); the
// POST /api/custom-provider route re-syncs after every connect.
syncCustomProvider();
