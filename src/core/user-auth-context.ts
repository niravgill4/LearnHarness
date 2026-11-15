import { AsyncLocalStorage } from "node:async_hooks";

export interface UserAuthContext {
	userId: string;
	keys: Record<string, string>;
}

export const userAuthStorage = new AsyncLocalStorage<UserAuthContext | null>();

export function getActiveUserKeys(): Record<string, string> | null {
	return userAuthStorage.getStore()?.keys ?? null;
}

export function getActiveUserId(): string | null {
	return userAuthStorage.getStore()?.userId ?? null;
}
