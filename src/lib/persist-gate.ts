/** Remove every key that starts with `prefix` (one tool's saved data). */
export function clearSaved(
	storage: Pick<Storage, 'length' | 'key' | 'removeItem'>,
	prefix: string
): void {
	const keys: string[] = [];
	for (let i = 0; i < storage.length; i++) {
		const key = storage.key(i);
		if (key?.startsWith(prefix)) keys.push(key);
	}
	for (const key of keys) storage.removeItem(key);
}

/** Parse JSON saved under `key`; null when absent or corrupt. */
export function readJson<T>(storage: Pick<Storage, 'getItem'> | null, key: string): T | null {
	if (!storage) return null;
	try {
		const raw = storage.getItem(key);
		return raw === null ? null : (JSON.parse(raw) as T);
	} catch {
		return null;
	}
}

/** The subset of the Web Storage API the gate writes through. */
export type WritableStorage = Pick<Storage, 'setItem'>;

export interface PersistGate {
	/** True once `open()` has been called. */
	readonly isOpen: boolean;
	/** Write `value` under `key`, or drop it while the gate is closed. */
	write(key: string, value: string): void;
	/** Allow writes. Call after saved state has been restored. */
	open(): void;
}

/**
 * Guard localStorage writes made from `$effect` until the page has restored its
 * saved state. In Svelte 5, `onMount` is itself a top-level effect, so effects
 * declared before it run first: an unguarded persistence effect would write the
 * initial defaults over the saved value before `onMount` reads it.
 *
 * Usage: compute the value inside the effect (so it is tracked) and pass it to
 * `write`; call `open()` at the end of `onMount`. The restore assigns new state,
 * which re-runs the effects after the gate is open.
 *
 * Pass `null` for storage outside the browser; every write is then dropped.
 */
export function createPersistGate(storage: WritableStorage | null): PersistGate {
	let isOpen = false;
	return {
		get isOpen() {
			return isOpen;
		},
		write(key, value) {
			if (!isOpen || !storage) return;
			try {
				storage.setItem(key, value);
			} catch {
				// QuotaExceededError / SecurityError: drop the write, keep the page alive
			}
		},
		open() {
			isOpen = true;
		}
	};
}
