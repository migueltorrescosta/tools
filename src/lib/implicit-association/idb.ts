/**
 * A tiny key-value store on IndexedDB, for custom comparisons: their uploaded images can
 * outgrow localStorage's few megabytes. Every call resolves to undefined where IndexedDB
 * is missing or blocked, so the page still works without saved comparisons.
 */
const DB = 'implicit-association';
const STORE = 'kv';

function open(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB, 1);
		req.onupgradeneeded = () => req.result.createObjectStore(STORE);
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

async function run<T>(mode: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T>) {
	const db = await open();
	try {
		return await new Promise<T>((resolve, reject) => {
			const tx = db.transaction(STORE, mode);
			const req = f(tx.objectStore(STORE));
			tx.oncomplete = () => resolve(req.result);
			tx.onerror = tx.onabort = () => reject(tx.error ?? req.error);
		});
	} finally {
		db.close();
	}
}

export async function idbGet<T>(key: string): Promise<T | undefined> {
	try {
		return (await run('readonly', (s) => s.get(key))) as T | undefined;
	} catch {
		return undefined;
	}
}

/** Rejects when the write fails (for example, storage is full). */
export const idbSet = (key: string, value: unknown) => run('readwrite', (s) => s.put(value, key));

export const idbDelete = (key: string) => run('readwrite', (s) => s.delete(key));
