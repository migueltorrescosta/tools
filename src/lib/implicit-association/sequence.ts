import type { Side, Trial } from './types.js';

export const BLOCK_TRIALS = 20;
export const PRACTICE_TRIALS = 16;
export const WARMUP = 4;

type Rng = () => number;

function shuffle<T>(xs: T[], rng: Rng): T[] {
	const a = [...xs];
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(rng() * (i + 1));
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
}

/** Draws items from a category in shuffled rounds, so each item shows before any repeats. */
function picker(size: number, rng: Rng) {
	let bag: number[] = [];
	return () => {
		if (bag.length === 0) bag = shuffle([...Array(size).keys()], rng);
		return bag.pop()!;
	};
}

/**
 * The trials of one block. Category 0 of each group is drawn as often as category 1.
 * Warm-up trials are targets only; then targets and attributes alternate.
 */
function block(
	index: number,
	size: number,
	focalTarget: 0 | 1,
	sizes: { target: [number, number]; attribute: [number, number] },
	rng: Rng
): Trial[] {
	const pick = {
		target: [picker(sizes.target[0], rng), picker(sizes.target[1], rng)],
		attribute: [picker(sizes.attribute[0], rng), picker(sizes.attribute[1], rng)]
	};
	const side = (group: 'target' | 'attribute', category: 0 | 1): Side =>
		(group === 'target' ? category === focalTarget : category === 0) ? 'right' : 'left';
	const halves = (n: number) =>
		shuffle(
			[...Array(n)].map((_, i) => (i % 2) as 0 | 1),
			rng
		);
	const warm = halves(WARMUP);
	const rest = size - WARMUP;
	const targets = halves(rest / 2);
	const attributes = halves(rest / 2);
	const trials: Trial[] = [];
	const push = (group: 'target' | 'attribute', category: 0 | 1, warmup: boolean) =>
		trials.push({
			block: index,
			group,
			category,
			item: pick[group][category](),
			correct: side(group, category),
			warmup
		});
	for (const c of warm) push('target', c, true);
	for (let i = 0; i < rest / 2; i++) {
		push('target', targets[i], false);
		push('attribute', attributes[i], false);
	}
	return trials;
}

export interface Plan {
	practice: Trial[];
	/** Four blocks; the focal target alternates, starting with `firstFocal`. */
	blocks: Trial[][];
	firstFocal: 0 | 1;
}

/** A full BIAT: a 16-trial practice block on neutral categories, then four 20-trial blocks. */
export function plan(
	sizes: { target: [number, number]; attribute: [number, number] },
	practiceSizes: { target: [number, number]; attribute: [number, number] },
	rng: Rng = Math.random
): Plan {
	const firstFocal: 0 | 1 = rng() < 0.5 ? 0 : 1;
	const other = (1 - firstFocal) as 0 | 1;
	return {
		practice: block(-1, PRACTICE_TRIALS, 0, practiceSizes, rng),
		blocks: [firstFocal, other, firstFocal, other].map((f, i) =>
			block(i, BLOCK_TRIALS, f, sizes, rng)
		),
		firstFocal
	};
}
