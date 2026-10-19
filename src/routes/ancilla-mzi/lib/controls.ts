import { AXES, freeControls, type Setup } from '$lib/ancilla-mzi/types';

export interface ControlEntry {
	/** Index into the control vector. */
	index: number;
	/** Symbol and subscript, e.g. α and xz. */
	symbol: string;
	sub: string;
	bound: number;
	group: 'coupling' | 'field' | 'pulse';
}

/** The control entries the engine frees for the setup, in its vector layout. */
export function activeControls(setup: Setup): ControlEntry[] {
	const K = setup.pulses.length;
	const cb = setup.controlBound;
	return freeControls(setup).map((index): ControlEntry => {
		const axis = AXES[index % 3];
		if (index < 9)
			return {
				index,
				symbol: 'α',
				sub: AXES[Math.floor(index / 3)] + axis,
				bound: cb,
				group: 'coupling'
			};
		if (index < 15)
			return { index, symbol: index < 12 ? 'b' : 'c', sub: axis, bound: cb, group: 'field' };
		const j = index - 15;
		const onS = j >= 3 * K;
		return {
			index,
			symbol: `v${Math.floor((onS ? j - 3 * K : j) / 3) + 1}`,
			sub: `${onS ? 'S' : 'A'}${axis}`,
			bound: setup.pulseBound,
			group: 'pulse'
		};
	});
}
