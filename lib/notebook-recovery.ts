import type { NotebookData } from "./notebook";
export type Recovery = { version: number; data: NotebookData; selection?: string };
async function database() {
	return new Promise<IDBDatabase>((resolve, reject) => {
		const request = indexedDB.open("cognera-notebook", 1);
		request.onupgradeneeded = () => request.result.createObjectStore("drafts");
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}
export async function recoveryRead(account: string) {
	const db = await database();
	try {
		return await new Promise<Recovery | undefined>((resolve, reject) => {
			const request = db.transaction("drafts").objectStore("drafts").get(account);
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
	} finally {
		db.close();
	}
}
let pending: Promise<void> = Promise.resolve();
export function recoveryWrite(account: string, draft: Recovery | null) {
	const next = pending.catch(() => {}).then(() => write(account, draft));
	pending = next;
	return next;
}
async function write(account: string, draft: Recovery | null) {
	const db = await database();
	try {
		await new Promise<void>((resolve, reject) => {
			const tx = db.transaction("drafts", "readwrite");
			if (draft) tx.objectStore("drafts").put(draft, account);
			else tx.objectStore("drafts").delete(account);
			tx.oncomplete = () => resolve();
			tx.onerror = () => reject(tx.error);
			tx.onabort = () => reject(tx.error);
		});
	} finally {
		db.close();
	}
}
