import { describe, it, expect } from 'vitest';
import rawSolutionTree from '$lib/wordle-solution';

import {
	cycleColor,
	cycleTile,
	EMPTY_RESULT,
	getTileColor,
	INVALID_RESULT_MESSAGE,
	isValidResult,
	newAttempt,
	NO_MATCH_MESSAGE,
	setTile,
	step,
	undoLast,
	type Attempt,
	type SolutionTree,
	type TileColor,
	type TreeNode
} from '$lib/wordle';

const solutionTree: SolutionTree = rawSolutionTree;

// ============================================================================
// Solution tree validation helpers
// ============================================================================

function isValidWord(word: string): boolean {
	// A valid Wordle word is 5 letters, all letters A-Z (case-insensitive)
	return /^[a-zA-Z]{5}$/.test(word);
}

// ============================================================================
// Tests
// ============================================================================

describe('Wordle Solution Tree', () => {
	describe('Structure', () => {
		it('should export a non-null solution tree', () => {
			expect(solutionTree).toBeDefined();
			expect(solutionTree).not.toBeNull();
		});

		it('should have the expected structure (keys are result patterns)', () => {
			const keys = Object.keys(solutionTree);
			expect(keys.length).toBeGreaterThan(0);

			// All keys should be 5-character strings of B, G, Y
			keys.forEach((key) => {
				expect(key).toMatch(/^[BGY]{5}$/);
			});
		});

		it('should have first word at BBBBB result pattern', () => {
			// When all letters are wrong (BBBBB), we get the first word in the tree
			const firstNode = solutionTree['BBBBB'];
			expect(firstNode).toBeDefined();
			expect(firstNode.word).toBeDefined();
			expect(typeof firstNode.word).toBe('string');
			expect(firstNode.word.length).toBe(5);
		});
	});

	describe('Content validation', () => {
		it('should contain only valid 5-letter words', () => {
			// Collect all words from the tree by traversing each root node's path
			const allWords: string[] = [];

			for (const rootKey of Object.keys(solutionTree)) {
				const rootNode = solutionTree[rootKey as keyof typeof solutionTree];
				if (rootNode && typeof rootNode === 'object' && 'word' in rootNode) {
					allWords.push(rootNode.word);

					// Recursively collect from subtree
					function collectFromNode(node: TreeNode) {
						if (Array.isArray(node.subtree)) {
							allWords.push(...node.subtree);
						} else if (node.subtree) {
							for (const subNode of Object.values(node.subtree)) {
								if ('word' in subNode) {
									allWords.push(subNode.word);
									if (subNode.subtree) {
										collectFromNode(subNode);
									}
								}
							}
						}
					}

					if (rootNode.subtree) {
						collectFromNode(rootNode);
					}
				}
			}

			expect(allWords.length).toBeGreaterThan(0);

			allWords.forEach((word) => {
				expect(isValidWord(word)).toBe(true);
				expect(word.length).toBe(5);
			});
		});

		it('should have valid tree structure for all nodes', () => {
			// Verify each node has the correct structure
			for (const rootKey of Object.keys(solutionTree)) {
				const node = solutionTree[rootKey as keyof typeof solutionTree];
				if (node && typeof node === 'object' && 'word' in node) {
					expect(isValidWord(node.word)).toBe(true);

					// Validate recursively
					function validateNode(subtree: Record<string, TreeNode> | string[]): boolean {
						if (Array.isArray(subtree)) {
							return subtree.every((w) => isValidWord(w));
						}
						for (const child of Object.values(subtree)) {
							if (!isValidWord(child.word)) return false;
							if (child.subtree && !validateNode(child.subtree as Record<string, TreeNode>)) {
								return false;
							}
						}
						return true;
					}

					if (node.subtree) {
						expect(validateNode(node.subtree)).toBe(true);
					}
				}
			}
		});

		it('should have at least 100 words in the solution tree', () => {
			let totalWords = 0;

			for (const rootKey of Object.keys(solutionTree)) {
				const rootNode = solutionTree[rootKey as keyof typeof solutionTree];
				if (rootNode && typeof rootNode === 'object' && 'word' in rootNode) {
					totalWords += 1; // Count root word

					// Recursively count from subtree
					function countFromNode(subtree: Record<string, TreeNode> | string[]): number {
						if (Array.isArray(subtree)) {
							return subtree.length;
						}
						let count = 0;
						for (const child of Object.values(subtree)) {
							count += 1; // The word
							if (child.subtree) {
								count += countFromNode(child.subtree as Record<string, TreeNode>);
							}
						}
						return count;
					}

					if (rootNode.subtree) {
						totalWords += countFromNode(rootNode.subtree);
					}
				}
			}

			expect(totalWords).toBeGreaterThanOrEqual(100);
		});
	});
});

describe('Result Validation', () => {
	describe('isValidResult', () => {
		it('should accept valid 5-character results with B, G, Y only', () => {
			expect(isValidResult('BBBBB')).toBe(true);
			expect(isValidResult('GGGGG')).toBe(true);
			expect(isValidResult('YYYYY')).toBe(true);
			expect(isValidResult('BGBYG')).toBe(true);
			expect(isValidResult('GYBYG')).toBe(true);
		});

		it('should reject results that are too short', () => {
			expect(isValidResult('BBBB')).toBe(false);
			expect(isValidResult('BG')).toBe(false);
			expect(isValidResult('')).toBe(false);
		});

		it('should reject results that are too long', () => {
			expect(isValidResult('BBBBBB')).toBe(false);
			expect(isValidResult('BBBBBBBB')).toBe(false);
		});

		it('should reject results with invalid characters', () => {
			expect(isValidResult('BBBRB')).toBe(false); // R is invalid
			expect(isValidResult('BBBBB ')).toBe(false); // Space is invalid
			expect(isValidResult('12345')).toBe(false); // Numbers are invalid
			expect(isValidResult('!@#$%')).toBe(false); // Symbols are invalid
			expect(isValidResult('AAAAA')).toBe(false); // A is invalid
		});

		it('should reject lowercase letters', () => {
			expect(isValidResult('bbbbb')).toBe(false);
			expect(isValidResult('BgYgb')).toBe(false);
		});
	});
});

describe('Tile Color Functions', () => {
	describe('getTileColor', () => {
		it('should return the correct color at a given index', () => {
			expect(getTileColor('BBBBB', 0)).toBe('B');
			expect(getTileColor('BBBBB', 4)).toBe('B');
			expect(getTileColor('GGGGG', 0)).toBe('G');
			expect(getTileColor('GGGGG', 4)).toBe('G');
			expect(getTileColor('BGBYG', 0)).toBe('B');
			expect(getTileColor('BGBYG', 1)).toBe('G');
			expect(getTileColor('BGBYG', 2)).toBe('B');
			expect(getTileColor('BGBYG', 3)).toBe('Y');
			expect(getTileColor('BGBYG', 4)).toBe('G');
		});

		it('should return B for out of bounds indices', () => {
			expect(getTileColor('BBBBB', -1)).toBe('B');
			expect(getTileColor('BBBBB', 5)).toBe('B');
			expect(getTileColor('BBBBB', 100)).toBe('B');
		});

		it('should return B for empty string', () => {
			expect(getTileColor('', 0)).toBe('B');
			expect(getTileColor('', 4)).toBe('B');
		});

		it('should return B for short strings', () => {
			expect(getTileColor('BB', 3)).toBe('B');
			expect(getTileColor('BG', 4)).toBe('B');
		});
	});

	describe('cycleColor', () => {
		it('should cycle B -> Y -> G -> B', () => {
			expect(cycleColor('B')).toBe('Y');
			expect(cycleColor('Y')).toBe('G');
			expect(cycleColor('G')).toBe('B');
		});

		it('should cycle correctly multiple times', () => {
			let color: TileColor = 'B';
			color = cycleColor(color);
			expect(color).toBe('Y');
			color = cycleColor(color);
			expect(color).toBe('G');
			color = cycleColor(color);
			expect(color).toBe('B');
			color = cycleColor(color);
			expect(color).toBe('Y');
		});
	});

	describe('setTile', () => {
		it('should set color at specific index', () => {
			expect(setTile('BBBBB', 0, 'G')).toBe('GBBBB');
			expect(setTile('BBBBB', 4, 'Y')).toBe('BBBBY');
			expect(setTile('BBBBB', 2, 'G')).toBe('BBGBB');
		});

		it('should pad short strings with B', () => {
			expect(setTile('', 0, 'G')).toBe('GBBBB');
			// For index 3 with 'BB' as input: 'BB' + padEnd to 5 = 'BBBBB', then set index 3 to Y = 'BBBYB'
			expect(setTile('BB', 3, 'Y')).toBe('BBBYB');
			expect(setTile('', 4, 'G')).toBe('BBBBG');
		});

		it('should handle multiple index updates', () => {
			let result = 'BBBBB';
			result = setTile(result, 0, 'G');
			result = setTile(result, 2, 'Y');
			result = setTile(result, 4, 'G');
			expect(result).toBe('GBYBG');
		});
	});
});

describe('Game Logic', () => {
	describe('Color assignment consistency', () => {
		it('should produce valid result strings from tile operations', () => {
			let result = '';
			for (let i = 0; i < 5; i++) {
				result = setTile(result, i, 'B');
			}
			expect(isValidResult(result)).toBe(true);
			expect(result).toBe('BBBBB');
		});

		it('should handle mixed color assignments', () => {
			let result = 'BBBBB';
			result = setTile(result, 0, 'G');
			result = setTile(result, 2, 'Y');
			result = setTile(result, 4, 'G');

			expect(isValidResult(result)).toBe(true);
			expect(getTileColor(result, 0)).toBe('G');
			expect(getTileColor(result, 1)).toBe('B');
			expect(getTileColor(result, 2)).toBe('Y');
			expect(getTileColor(result, 3)).toBe('B');
			expect(getTileColor(result, 4)).toBe('G');
		});
	});

	describe('Solution tree navigation', () => {
		it('should find subtree for valid result pattern', () => {
			// BBGBG is a valid result pattern
			const result = 'BBGBG';
			const subtree = solutionTree[result as keyof typeof solutionTree];
			expect(subtree).toBeDefined();
		});

		it('should return undefined for invalid result pattern', () => {
			const invalidResult = 'XXXXX';
			const subtree = solutionTree[invalidResult as keyof typeof solutionTree];
			expect(subtree).toBeUndefined();
		});

		it('should have word property on subtree', () => {
			const result = 'BBBBB';
			const subtree = solutionTree[result as keyof typeof solutionTree] as TreeNode;
			expect(subtree).toBeDefined();
			expect(subtree.word).toBeDefined();
			expect(typeof subtree.word).toBe('string');
			expect(subtree.word.length).toBe(5);
		});

		it('should navigate through tree based on result patterns', () => {
			// Start at root with BBBBB result
			const currentNode = solutionTree['BBBBB'] as TreeNode;
			expect(currentNode).toBeDefined();

			// Navigate using a result known to sit under BBBBB
			const result1 = 'BGBBG';
			expect(currentNode.subtree).toHaveProperty(result1);
			const nextNode = (currentNode.subtree as Record<string, TreeNode>)[result1];
			expect(nextNode.word).toBe('quoth');
		});
	});
});

describe('Edge Cases', () => {
	it('should handle empty inputs gracefully', () => {
		expect(isValidResult('')).toBe(false);
	});

	it('should handle special characters', () => {
		expect(isValidResult('!@#$%')).toBe(false);
		expect(isValidResult('     ')).toBe(false);
	});

	it('should handle unicode characters', () => {
		expect(isValidResult('🎉🎉🎉🎉🎉')).toBe(false);
	});

	it('should handle mixed case input', () => {
		// The isValidResult function is case-sensitive
		expect(isValidResult('bbbbb')).toBe(false);
		expect(isValidResult('BgYgb')).toBe(false);
		expect(isValidResult('BGYgb')).toBe(false);
	});
});

describe('Real game scenarios', () => {
	it('should handle a realistic game progression', () => {
		// Start at BBBBB (all wrong letters)
		const currentNode = solutionTree['BBBBB'] as TreeNode;
		expect(currentNode).toBeDefined();
		expect(currentNode.word.length).toBe(5);

		// Simulate the result of the second guess (mulch): BYYBB
		const result = 'BYYBB';

		// Validate result is valid
		expect(isValidResult(result)).toBe(true);

		// The result must lead to a further guess, not a leaf
		expect(currentNode.subtree).toHaveProperty(result);
		const nextNode = (currentNode.subtree as Record<string, TreeNode>)[result];
		expect(nextNode.word).toBe('flunk');
		expect(Array.isArray(nextNode.subtree)).toBe(false);

		// Cycle one tile
		const newColor = cycleColor(getTileColor(result, 0));
		expect(newColor).toBe('Y');

		// Update result
		const updatedResult = setTile(result, 0, newColor);
		expect(updatedResult).toBe('YYYBB');
		expect(isValidResult(updatedResult)).toBe(true);
	});

	it('should simulate game over (no valid words)', () => {
		// Invalid result should not be in tree
		const invalidResult = 'XXXXX';
		expect(isValidResult(invalidResult)).toBe(false);
		expect(solutionTree[invalidResult as keyof typeof solutionTree]).toBeUndefined();
	});

	it('should navigate to leaf nodes correctly', () => {
		// Find a leaf node (where subtree is an array)
		function findLeafNode(node: Record<string, TreeNode>): { path: string[]; word: string } | null {
			for (const [key, value] of Object.entries(node)) {
				if (Array.isArray(value.subtree)) {
					return { path: [key], word: value.word };
				}
				const deeper = findLeafNode(value.subtree as Record<string, TreeNode>);
				if (deeper) {
					return { path: [key, ...deeper.path], word: deeper.word };
				}
			}
			return null;
		}

		const leaf = findLeafNode(solutionTree);
		expect(leaf).not.toBeNull();
		expect(leaf!.word.length).toBe(5);
		expect(isValidWord(leaf!.word)).toBe(true);
	});
});

describe('cycleTile', () => {
	it('cycles the tile at the index and pads the rest with B', () => {
		expect(cycleTile('', 0)).toBe('YBBBB');
		expect(cycleTile('YBBBB', 0)).toBe('GBBBB');
		expect(cycleTile('GBBBB', 0)).toBe('BBBBB');
		expect(cycleTile('BGBYG', 3)).toBe('BGBGG');
	});
});

describe('step', () => {
	const fixture: SolutionTree = {
		BBBBB: {
			word: 'mulch',
			subtree: {
				BBBBG: { word: 'pinch', subtree: ['pinch'] }
			}
		},
		YBBBB: { word: 'other', subtree: ['other'] }
	};

	it('rejects an invalid result without advancing or ending the game', () => {
		expect(step(fixture, 'BBBB')).toEqual({
			next: fixture,
			word: '',
			done: false,
			won: false,
			error: INVALID_RESULT_MESSAGE
		});
	});

	it('ends the game as won on GGGGG', () => {
		const s = step(fixture, 'GGGGG');
		expect(s.won).toBe(true);
		expect(s.done).toBe(true);
		expect(s.error).toBe('');
	});

	it('reports an unknown pattern as an error and keeps the current tree', () => {
		const s = step(fixture, 'GBBBB');
		expect(s.error).toBe(NO_MATCH_MESSAGE);
		expect(s.next).toBe(fixture);
		expect(s.won).toBe(false);
	});

	it('does not end the game on an unknown pattern, so the row can be corrected', () => {
		expect(step(fixture, 'GBBBB').done).toBe(false);
		// Correcting the mis-clicked tile and resubmitting from the same tree works.
		expect(step(fixture, 'BBBBB').word).toBe('mulch');
	});

	it('advances into an internal node and suggests its word', () => {
		const s = step(fixture, 'BBBBB');
		expect(s).toEqual({
			next: (fixture.BBBBB as TreeNode).subtree,
			word: 'mulch',
			done: false,
			won: false,
			error: ''
		});
	});

	it('suggests the answer when the pattern leads to a leaf', () => {
		const s = step(fixture, 'YBBBB');
		expect(s.word).toBe('other');
		expect(s.next).toEqual({});
		expect(s.error).toBe('');
	});

	it('does not mutate the tree it is given', () => {
		const before = JSON.stringify(fixture);
		step(fixture, 'BBBBB');
		step(fixture, 'GBBBB');
		expect(JSON.stringify(fixture)).toBe(before);
	});

	it('follows the real tree: RAISE scored BBBBB suggests MULCH', () => {
		const s = step(solutionTree, 'BBBBB');
		expect(s.error).toBe('');
		expect(s.word).toBe('mulch');
		expect(s.next).toBe(solutionTree.BBBBB.subtree);
	});
});

describe('newAttempt', () => {
	it('starts with the result the untouched (all-black) tiles show', () => {
		const attempt = newAttempt('RAISE');
		expect(attempt).toEqual({ word: 'RAISE', result: EMPTY_RESULT });
		for (let i = 0; i < 5; i++) {
			expect(getTileColor(attempt.result, i)).toBe(attempt.result[i]);
		}
	});

	it('submitting an untouched row is accepted: RAISE scored all black suggests MULCH', () => {
		const s = step(solutionTree, newAttempt('RAISE').result);
		expect(s.error).toBe('');
		expect(s.word).toBe('mulch');
	});
});

describe('undoLast', () => {
	const root: SolutionTree = solutionTree;
	const afterFirst = step(root, 'BBBBB').next;

	it('returns null when there is nothing to undo', () => {
		expect(undoLast([], [])).toBeNull();
	});

	it('restores the previous tree and makes the removed row editable again', () => {
		const history: Attempt[] = [{ word: 'RAISE', result: 'BBBBB' }];
		const undone = undoLast([root], history);
		expect(undone).not.toBeNull();
		expect(undone!.tree).toBe(root);
		expect(undone!.visited).toEqual([]);
		expect(undone!.history).toEqual([]);
		expect(undone!.attempt).toEqual({ word: 'RAISE', result: 'BBBBB' });
		expect(undone!.attempt).not.toBe(history[0]);
	});

	it('only removes the last of several rows', () => {
		const history: Attempt[] = [
			{ word: 'RAISE', result: 'BBBBB' },
			{ word: 'MULCH', result: 'GGGGG' }
		];
		const visited = [root, afterFirst];
		const undone = undoLast(visited, history)!;
		expect(undone.tree).toBe(afterFirst);
		expect(undone.visited).toEqual([root]);
		expect(undone.history).toEqual([history[0]]);
		expect(history).toHaveLength(2);
		expect(visited).toHaveLength(2);
	});
});
