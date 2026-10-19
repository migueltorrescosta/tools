import { AXES, type Setup } from '$lib/ancilla-mzi/types';

export interface ControlEntry {
	/** Index into the control vector. */
	index: number;
	/** Symbol and subscript, e.g. α and xz. */
	symbol: string;
	sub: string;
	bound: number;
	group: 'coupling' | 'field' | 'pulse';
}

/** The control entries the setup switches on, in the engine's vector layout. */
export function activeControls(setup: Setup): ControlEntry[] {
	const out: ControlEntry[] = [];
	const cb = setup.controlBound;
	setup.coupling.forEach((on, k) => {
		if (on)
			out.push({
				index: k,
				symbol: 'α',
				sub: AXES[Math.floor(k / 3)] + AXES[k % 3],
				bound: cb,
				group: 'coupling'
			});
	});
	setup.fieldA.forEach((on, i) => {
		if (on) out.push({ index: 9 + i, symbol: 'b', sub: AXES[i], bound: cb, group: 'field' });
	});
	setup.fieldS.forEach((on, i) => {
		if (on) out.push({ index: 12 + i, symbol: 'c', sub: AXES[i], bound: cb, group: 'field' });
	});
	const K = setup.pulses.length;
	for (const register of ['A', 'S'] as const)
		setup.pulses.forEach((p, m) => {
			if (p.target !== 'both' && p.target !== register) return;
			const offset = 15 + (register === 'A' ? 0 : 3 * K) + 3 * m;
			AXES.forEach((axis, i) =>
				out.push({
					index: offset + i,
					symbol: `v${m + 1}`,
					sub: `${register}${axis}`,
					bound: setup.pulseBound,
					group: 'pulse'
				})
			);
		});
	return out;
}
