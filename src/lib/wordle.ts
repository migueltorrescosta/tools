export type TileColor = 'B' | 'Y' | 'G';

export interface TreeNode {
	word: string;
	subtree: SolutionTree | string[];
}

export type SolutionTree = Record<string, TreeNode>;

export const WIN_RESULT = 'GGGGG';
export const INVALID_RESULT_MESSAGE = 'This is not a valid result. Please try again.';
export const NO_MATCH_MESSAGE = 'There are no words satisfying all the results listed. Try again?';

const COLORS: TileColor[] = ['B', 'Y', 'G'];

/** Untouched tiles render black, so an untouched row means all black. */
export const EMPTY_RESULT = 'BBBBB';

export interface Attempt {
	word: string;
	result: string;
}

/** A fresh input row: its result matches the all-black tiles the user sees. */
export function newAttempt(word: string): Attempt {
	return { word, result: EMPTY_RESULT };
}

export function isValidResult(result: string): boolean {
	return /^[BGY]{5}$/.test(result);
}

export function getTileColor(result: string, index: number): TileColor {
	return (result[index] as TileColor) || 'B';
}

export function cycleColor(color: TileColor): TileColor {
	return COLORS[(COLORS.indexOf(color) + 1) % COLORS.length];
}

export function setTile(result: string, index: number, color: TileColor): string {
	const chars = result.padEnd(5, 'B').split('');
	chars[index] = color;
	return chars.join('');
}

export function cycleTile(result: string, index: number): string {
	return setTile(result, index, cycleColor(getTileColor(result, index)));
}

export interface Step {
	/** Subtree to use for the next submission. */
	next: SolutionTree;
	/** Next suggested word (lowercase, as stored in the tree); empty when there is none. */
	word: string;
	/** True when no further submission is possible. */
	done: boolean;
	/** True when the submitted result is all green. */
	won: boolean;
	/** Error to show; when non-empty the submission is not recorded. */
	error: string;
}

/** Advance the solver by one submitted result. Pure: never mutates `tree`. */
export function step(tree: SolutionTree, result: string): Step {
	if (!isValidResult(result)) {
		return { next: tree, word: '', done: false, won: false, error: INVALID_RESULT_MESSAGE };
	}
	if (result === WIN_RESULT) {
		return { next: {}, word: '', done: true, won: true, error: '' };
	}
	const node = tree[result];
	if (node === undefined) {
		// Not terminal: the user most likely mis-clicked a tile and can fix it and resubmit.
		return { next: tree, word: '', done: false, won: false, error: NO_MATCH_MESSAGE };
	}
	if (Array.isArray(node.subtree)) {
		return { next: {}, word: node.word, done: true, won: false, error: '' };
	}
	return { next: node.subtree, word: node.word, done: false, won: false, error: '' };
}

export interface Undo {
	/** Tree to restore as the current one. */
	tree: SolutionTree;
	/** Remaining stack of trees visited before each remaining history row. */
	visited: SolutionTree[];
	history: Attempt[];
	/** The removed row, restored as the editable input row. */
	attempt: Attempt;
}

/**
 * Remove the last accepted row. `visited[i]` is the tree that was current when
 * `history[i]` was submitted. Returns null when there is nothing to undo.
 */
export function undoLast(visited: SolutionTree[], history: Attempt[]): Undo | null {
	if (history.length === 0 || visited.length !== history.length) return null;
	return {
		tree: visited[visited.length - 1],
		visited: visited.slice(0, -1),
		history: history.slice(0, -1),
		attempt: { ...history[history.length - 1] }
	};
}
