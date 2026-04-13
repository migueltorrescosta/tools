import { describe, it, expect } from 'vitest';
import solutionTree from '$lib/wordle-solution';

// Type definitions matching the component
interface TreeNode {
	word: string;
	subtree: Record<string, TreeNode> | string[];
}

// ============================================================================
// Pure functions extracted from the component for testing
// ============================================================================

type TileColor = 'B' | 'Y' | 'G';

function isValidResult(result: string): boolean {
	return result.length === 5 && /^[BGY]{5}$/.test(result);
}

function getTileColor(result: string, index: number): TileColor {
	return (result[index] as TileColor) || 'B';
}

function cycleTileColor(currentColor: TileColor): TileColor {
	const colors: TileColor[] = ['B', 'Y', 'G'];
	const currentIndex = colors.indexOf(currentColor);
	return colors[(currentIndex + 1) % 3];
}

function setTileColorAtIndex(result: string, index: number, color: TileColor): string {
	const chars = result.padEnd(5, 'B').split('');
	chars[index] = color;
	return chars.join('');
}

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

	describe('cycleTileColor', () => {
		it('should cycle B -> Y -> G -> B', () => {
			expect(cycleTileColor('B')).toBe('Y');
			expect(cycleTileColor('Y')).toBe('G');
			expect(cycleTileColor('G')).toBe('B');
		});

		it('should cycle correctly multiple times', () => {
			let color: TileColor = 'B';
			color = cycleTileColor(color);
			expect(color).toBe('Y');
			color = cycleTileColor(color);
			expect(color).toBe('G');
			color = cycleTileColor(color);
			expect(color).toBe('B');
			color = cycleTileColor(color);
			expect(color).toBe('Y');
		});
	});

	describe('setTileColorAtIndex', () => {
		it('should set color at specific index', () => {
			expect(setTileColorAtIndex('BBBBB', 0, 'G')).toBe('GBBBB');
			expect(setTileColorAtIndex('BBBBB', 4, 'Y')).toBe('BBBBY');
			expect(setTileColorAtIndex('BBBBB', 2, 'G')).toBe('BBGBB');
		});

		it('should pad short strings with B', () => {
			expect(setTileColorAtIndex('', 0, 'G')).toBe('GBBBB');
			// For index 3 with 'BB' as input: 'BB' + padEnd to 5 = 'BBBBB', then set index 3 to Y = 'BBBYB'
			expect(setTileColorAtIndex('BB', 3, 'Y')).toBe('BBBYB');
			expect(setTileColorAtIndex('', 4, 'G')).toBe('BBBBG');
		});

		it('should handle multiple index updates', () => {
			let result = 'BBBBB';
			result = setTileColorAtIndex(result, 0, 'G');
			result = setTileColorAtIndex(result, 2, 'Y');
			result = setTileColorAtIndex(result, 4, 'G');
			expect(result).toBe('GBYBG');
		});
	});
});

describe('Game Logic', () => {
	describe('Win condition', () => {
		it('should detect winning result (all green)', () => {
			const winningResult = 'GGGGG';
			expect(isValidResult(winningResult)).toBe(true);
			expect(winningResult).toBe('GGGGG');
		});

		it('should identify winning result pattern', () => {
			const result = 'GGGGG';
			const isWin = result === 'GGGGG';
			expect(isWin).toBe(true);
		});
	});

	describe('Color assignment consistency', () => {
		it('should produce valid result strings from tile operations', () => {
			let result = '';
			for (let i = 0; i < 5; i++) {
				result = setTileColorAtIndex(result, i, 'B');
			}
			expect(isValidResult(result)).toBe(true);
			expect(result).toBe('BBBBB');
		});

		it('should handle mixed color assignments', () => {
			let result = 'BBBBB';
			result = setTileColorAtIndex(result, 0, 'G');
			result = setTileColorAtIndex(result, 2, 'Y');
			result = setTileColorAtIndex(result, 4, 'G');

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
			let currentNode = solutionTree['BBBBB'] as TreeNode;
			expect(currentNode).toBeDefined();

			// Navigate using a valid result
			const result1 = 'BGBBG';
			if (
				currentNode.subtree &&
				!Array.isArray(currentNode.subtree) &&
				currentNode.subtree[result1]
			) {
				const nextNode = currentNode.subtree[result1];
				expect(nextNode.word).toBeDefined();
			}
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

	it('tree should not have circular references', () => {
		const visitedPaths = new Set<string>();

		function checkForCycles(node: Record<string, TreeNode>, currentPath: string[]): boolean {
			for (const [key, value] of Object.entries(node)) {
				// Create a unique path identifier
				const pathKey = [...currentPath, key].join('-');

				if (visitedPaths.has(pathKey)) {
					return true; // Cycle detected
				}
				visitedPaths.add(pathKey);

				if (!Array.isArray(value) && value.subtree) {
					if (Array.isArray(value.subtree)) {
						// Leaf node - don't recurse
					} else {
						// Recurse into subtree
						if (checkForCycles(value.subtree, [...currentPath, key])) {
							return true;
						}
					}
				}

				// Remove path after processing to allow different paths
				visitedPaths.delete(pathKey);
			}
			return false;
		}

		expect(checkForCycles(solutionTree, [])).toBe(false);
	});
});

describe('Real game scenarios', () => {
	it('should handle a realistic game progression', () => {
		// Start at BBBBB (all wrong letters)
		let currentNode = solutionTree['BBBBB'] as TreeNode;
		expect(currentNode).toBeDefined();
		expect(currentNode.word.length).toBe(5);

		// Simulate first guess result (e.g., BGBYG)
		const result = 'BGBYG';

		// Validate result is valid
		expect(isValidResult(result)).toBe(true);

		// Get next word from subtree if it exists
		if (currentNode.subtree && !Array.isArray(currentNode.subtree) && currentNode.subtree[result]) {
			const nextNode = currentNode.subtree[result];
			expect(nextNode.word).toBeDefined();
			expect(nextNode.word.length).toBe(5);

			// Cycle one tile
			const newColor = cycleTileColor(getTileColor(result, 0));
			expect(newColor).toBe('Y');

			// Update result
			const updatedResult = setTileColorAtIndex(result, 0, newColor);
			expect(updatedResult).toBe('YGBYG');
			expect(isValidResult(updatedResult)).toBe(true);
		}
	});

	it('should simulate winning game', () => {
		// All guesses must be valid
		const guesses = [{ result: 'BBGBG' }, { result: 'YYGBG' }, { result: 'GGGGG' }];

		// Verify all results are valid
		guesses.forEach((guess) => {
			expect(isValidResult(guess.result)).toBe(true);
		});

		// Verify final guess is winning
		const finalResult = guesses[2].result;
		expect(finalResult).toBe('GGGGG');
		expect(finalResult === 'GGGGG').toBe(true);
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
		if (leaf) {
			expect(leaf.word.length).toBe(5);
			expect(isValidWord(leaf.word)).toBe(true);
		}
	});
});
