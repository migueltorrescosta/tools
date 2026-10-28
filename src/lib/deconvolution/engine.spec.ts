import { describe, expect, it } from 'vitest';
import type { WorkerLike } from '$lib/worker-pool';
import { EstimatePool, StoppedError, type FromWorker, type ToWorker } from './engine';
import type { Task, TaskResult } from './estimate';

/** An in-process worker that answers when `flush` is called, or fails on demand. */
class FakeWorker implements WorkerLike<ToWorker, FromWorker> {
	onmessage: ((e: MessageEvent<FromWorker>) => void) | null = null;
	onerror: ((e: ErrorEvent) => void) | null = null;
	inbox: ToWorker[] = [];
	terminated = false;
	postMessage(msg: ToWorker) {
		this.inbox.push(msg);
	}
	terminate() {
		this.terminated = true;
	}
	flush(result: (task: Task) => TaskResult) {
		const msg = this.inbox.shift()!;
		this.onmessage?.({
			data: { id: msg.id, ok: true, result: result(msg.task) }
		} as MessageEvent<FromWorker>);
	}
	fail(error: string) {
		const msg = this.inbox.shift()!;
		this.onmessage?.({ data: { id: msg.id, ok: false, error } } as MessageEvent<FromWorker>);
	}
}

const task = (count: number): Task => ({
	kind: 'bootstrap',
	method: 'npmle',
	data: new Float64Array(1),
	y: { family: 'normal', params: [0, 1] },
	grid: { x0: 0, h: 1, m: 1 },
	options: { df: 5, c0: 1, bandwidth: null, seed: 0 },
	seed: 0,
	count
});
const reply = (t: Task): TaskResult => ({
	kind: 'bootstrap',
	masses: [Float64Array.of(t.kind === 'bootstrap' ? t.count : -1)]
});

describe('EstimatePool', () => {
	it('spreads tasks over at most `size` workers and queues the rest', async () => {
		const workers: FakeWorker[] = [];
		const pool = new EstimatePool(() => {
			const w = new FakeWorker();
			workers.push(w);
			return w;
		}, 2);
		const results = [1, 2, 3].map((n) => pool.run(task(n)));
		expect(workers.length).toBe(2);
		expect(workers.map((w) => w.inbox.length)).toEqual([1, 1]);
		workers[0].flush(reply);
		expect(workers[0].inbox.length).toBe(1);
		workers[1].flush(reply);
		workers[0].flush(reply);
		const got = await Promise.all(results);
		expect(got.map((r) => (r.kind === 'bootstrap' ? r.masses[0][0] : 0))).toEqual([1, 2, 3]);
	});

	it('rejects a task whose worker reports an error, and keeps going', async () => {
		const w = new FakeWorker();
		const pool = new EstimatePool(() => w, 1);
		const a = pool.run(task(1));
		const b = pool.run(task(2));
		w.fail('bad noise');
		await expect(a).rejects.toThrow('bad noise');
		w.flush(reply);
		await expect(b).resolves.toMatchObject({ kind: 'bootstrap' });
	});

	it('stop terminates the workers and rejects everything pending', async () => {
		const workers: FakeWorker[] = [];
		const pool = new EstimatePool(() => {
			const w = new FakeWorker();
			workers.push(w);
			return w;
		}, 1);
		const a = pool.run(task(1));
		const b = pool.run(task(2));
		pool.stop();
		await expect(a).rejects.toBeInstanceOf(StoppedError);
		await expect(b).rejects.toBeInstanceOf(StoppedError);
		expect(workers[0].terminated).toBe(true);
		const c = pool.run(task(3));
		expect(workers.length).toBe(2);
		workers[1].flush(reply);
		await expect(c).resolves.toMatchObject({ kind: 'bootstrap' });
	});

	it('replaces a worker that crashes, so queued tasks still run', async () => {
		const workers: FakeWorker[] = [];
		const pool = new EstimatePool(() => {
			const w = new FakeWorker();
			workers.push(w);
			return w;
		}, 1);
		const a = pool.run(task(1));
		const b = pool.run(task(2));
		workers[0].onerror?.({ message: 'out of memory' } as ErrorEvent);
		await expect(a).rejects.toThrow('out of memory');
		expect(workers[0].terminated).toBe(true);
		expect(workers.length).toBe(2);
		workers[1].flush(reply);
		await expect(b).resolves.toMatchObject({ kind: 'bootstrap' });
	});
});
