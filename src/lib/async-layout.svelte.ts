/**
 * A diagram layout computed off the main thread from a reactive request. The last layout
 * stays available while a newer one computes, so a diagram doesn't blink on every edit;
 * `ready` says whether it belongs to the current request. Create it during component setup.
 */
export class AsyncLayout<R, L> {
	#latest = $state.raw<{ request: R; layout: L }>();
	#request: () => R | undefined;

	constructor(request: () => R | undefined, compute: (request: R) => Promise<L>) {
		this.#request = request;
		$effect(() => {
			const r = request();
			if (r === undefined) return;
			let live = true;
			compute(r).then((layout) => {
				if (live) this.#latest = { request: r, layout };
			});
			return () => {
				live = false;
			};
		});
	}

	/** The newest layout, possibly made for an earlier request. */
	get latest(): L | undefined {
		return this.#latest?.layout;
	}

	/** Whether the newest layout was made for the current request. */
	get ready(): boolean {
		const r = this.#request();
		return r !== undefined && this.#latest?.request === r;
	}
}
