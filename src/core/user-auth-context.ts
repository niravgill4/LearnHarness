import { AsyncLocalStorage } from "node:async_hooks";
import type { UserSettings } from "./settings.ts";

export interface UserAuthContext {
	userId: string;
	keys: Record<string, string>;
	settings?: UserSettings;
}

export const userAuthStorage = new AsyncLocalStorage<UserAuthContext | null>();

export function getActiveUserKeys(): Record<string, string> | null {
	return userAuthStorage.getStore()?.keys ?? null;
}

export function getActiveUserId(): string | null {
	return userAuthStorage.getStore()?.userId ?? null;
}

export function getActiveUserSettings(): UserSettings | null {
	return userAuthStorage.getStore()?.settings ?? null;
}
