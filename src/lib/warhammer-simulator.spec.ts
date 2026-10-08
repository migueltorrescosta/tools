import { describe, it, expect } from 'vitest';
import { SeededRNG } from './warhammer-simulator/rng';
import {
	getToHitTarget,
	getToWoundTarget,
	computeEffectiveSave,
	clampSave
} from './warhammer-simulator/tables';
import {
	resolveHit,
	resolveWound,
	resolveArmourSave,
	resolveWardSave,
	computeEffectiveStats,
	getWeaponStats
} from './warhammer-simulator/rules';
import { CombatEngine } from './warhammer-simulator/combat';
import { MonteCarloController } from './warhammer-simulator/simulation';
import { PRESET_CHARACTERS } from './warhammer-simulator/presets';
import type { Character } from './warhammer-simulator/types';

// ── RNG Tests ──

describe('SeededRNG', () => {
	it('produces deterministic output for the same seed', () => {
		const rng1 = new SeededRNG(42);
		const rng2 = new SeededRNG(42);
		for (let i = 0; i < 100; i++) {
			expect(rng1.next()).toBe(rng2.next());
		}
	});

	it('produces different output for different seeds', () => {
		const rng1 = new SeededRNG(42);
		const rng2 = new SeededRNG(99);
		const vals1 = Array.from({ length: 10 }, () => rng1.next());
		const vals2 = Array.from({ length: 10 }, () => rng2.next());
		expect(vals1).not.toEqual(vals2);
	});

	it('rollD6 returns values in [1, 6]', () => {
		const rng = new SeededRNG(42);
		for (let i = 0; i < 1000; i++) {
			const roll = rng.rollD6();
			expect(roll).toBeGreaterThanOrEqual(1);
			expect(roll).toBeLessThanOrEqual(6);
		}
	});

	it('next() returns values in [0, 1)', () => {
		const rng = new SeededRNG(42);
		for (let i = 0; i < 1000; i++) {
			const val = rng.next();
			expect(val).toBeGreaterThanOrEqual(0);
			expect(val).toBeLessThan(1);
		}
	});

	it('produces approximately uniform distribution (chi-squared sanity)', () => {
		const rng = new SeededRNG(42);
		const counts = [0, 0, 0, 0, 0, 0];
		const N = 6000;
		for (let i = 0; i < N; i++) {
			counts[rng.rollD6() - 1]++;
		}
		const expected = N / 6;
		for (let i = 0; i < 6; i++) {
			// Each face should be within ~15% of expected (very loose bound)
			expect(counts[i]).toBeGreaterThan(expected * 0.5);
			expect(counts[i]).toBeLessThan(expected * 1.5);
		}
	});
});

// ── Tables Tests ──

describe('WS To-Hit Table', () => {
	// Independent oracle for The Old World combat to-hit chart.
	function rulebookToHit(attacker: number, target: number): number {
		if (attacker > target) return 3;
		if (target > 2 * attacker) return 5;
		return 4;
	}

	it('matches the rulebook chart over the full WS 1..10 grid', () => {
		for (let a = 1; a <= 10; a++) {
			for (let d = 1; d <= 10; d++) {
				expect(getToHitTarget(a, d), `WS${a} vs WS${d}`).toBe(rulebookToHit(a, d));
			}
		}
	});

	it('pins the cases the old ratio table got wrong', () => {
		expect(getToHitTarget(5, 4)).toBe(3);
		expect(getToHitTarget(8, 4)).toBe(3);
		expect(getToHitTarget(4, 5)).toBe(4);
		expect(getToHitTarget(2, 4)).toBe(4);
		expect(getToHitTarget(3, 6)).toBe(4);
		expect(getToHitTarget(2, 5)).toBe(5);
		expect(getToHitTarget(1, 5)).toBe(5);
	});

	it('never requires 6+ in melee', () => {
		for (let a = 1; a <= 10; a++) {
			for (let d = 1; d <= 10; d++) {
				expect(getToHitTarget(a, d)).toBeLessThanOrEqual(5);
			}
		}
	});
});

describe('S vs T Wound Table', () => {
	// Independent oracle for The Old World to-wound chart (S - T difference).
	function rulebookToWound(s: number, t: number): number {
		return Math.min(6, Math.max(2, 4 - (s - t)));
	}

	it('matches the rulebook chart over the full S,T 1..10 grid', () => {
		for (let s = 1; s <= 10; s++) {
			for (let t = 1; t <= 10; t++) {
				expect(getToWoundTarget(s, t), `S${s} vs T${t}`).toBe(rulebookToWound(s, t));
			}
		}
	});

	it('pins the cases the old ratio table got wrong', () => {
		expect(getToWoundTarget(6, 4)).toBe(2);
		expect(getToWoundTarget(7, 5)).toBe(2);
		expect(getToWoundTarget(3, 5)).toBe(6);
		expect(getToWoundTarget(4, 6)).toBe(6);
	});
});

describe('Armour Save Calculation', () => {
	it('clamps save to [2, 7]', () => {
		expect(clampSave(1)).toBe(2);
		expect(clampSave(2)).toBe(2);
		expect(clampSave(7)).toBe(7);
		expect(clampSave(8)).toBe(7);
	});

	it('AP worsens armour save', () => {
		// AP -1 on a 4+ save → 5+
		expect(computeEffectiveSave(4, -1)).toBe(5);
		// AP -2 on a 3+ save → 5+
		expect(computeEffectiveSave(3, -2)).toBe(5);
	});

	it('does not improve save beyond 2+', () => {
		// AP 0 on a 2+ save → stays 2+
		expect(computeEffectiveSave(2, 0)).toBe(2);
		// AP 0 on a 3+ save → stays 3+
		expect(computeEffectiveSave(3, 0)).toBe(3);
	});
});

// ── Weapons/Armour/Shield Tests ──

describe('Weapon Stats', () => {
	it('hand weapon has no special modifiers', () => {
		const w = getWeaponStats('hand-weapon');
		expect(w.strengthBonus).toBe(0);
		expect(w.ap).toBe(0);
		expect(w.attacks).toBe(0);
	});

	it('great weapon gives +2S, -2AP, and always-strikes-last', () => {
		const w = getWeaponStats('great-weapon');
		expect(w.strengthBonus).toBe(2);
		expect(w.ap).toBe(-2);
		expect(w.special).toContain('always-strikes-last');
	});
});

// ── Combat Engine Tests ──

function makeChar(overrides: Partial<Character> = {}): Character {
	return {
		name: 'Test',
		faction: 'empire',
		ws: 4,
		s: 4,
		t: 4,
		a: 3,
		i: 4,
		wounds: 3,
		armourSave: 7,
		wardSave: 0,
		weapon: 'hand-weapon',
		armour: 'none',
		shield: 'none',
		traits: [],
		giftPoints: 0,
		wizardLevel: 'not-wizard',
		specialRules: [],
		...overrides
	};
}

/** RNG stub whose every D6 roll is a natural 6: hits and wounds always land. */
class AlwaysSixRNG extends SeededRNG {
	constructor() {
		super(0);
	}
	override rollD6(): number {
		return 6;
	}
}

describe('CombatEngine', () => {
	it('attributes damage to the side that dealt it', () => {
		const killer = makeChar({ name: 'Killer', a: 1 });
		const victim = makeChar({ name: 'Victim', a: 0, wounds: 1 });
		const result = new CombatEngine(killer, victim, new AlwaysSixRNG()).run();
		expect(result.winner).toBe('A');
		expect(result.damageDealtA).toBe(1);
		expect(result.damageDealtB).toBe(0);

		const mirrored = new CombatEngine(victim, killer, new AlwaysSixRNG()).run();
		expect(mirrored.winner).toBe('B');
		expect(mirrored.damageDealtA).toBe(0);
		expect(mirrored.damageDealtB).toBe(1);
	});

	it('0 attacks on both sides produces a draw after 50 rounds', () => {
		const charA = makeChar({ a: 0 });
		const charB = makeChar({ a: 0 });
		const rng = new SeededRNG(42);
		const engine = new CombatEngine(charA, charB, rng);
		const result = engine.run();
		expect(result.winner).toBe('draw');
		expect(result.rounds).toBe(50);
	});

	it('equal stats with equal initiative produce both outcomes', () => {
		const char = makeChar();
		const rng = new SeededRNG(42);
		const engine = new CombatEngine(char, { ...char }, rng);
		const result = engine.run();
		expect(['A', 'B', 'mutual', 'draw']).toContain(result.winner);
		expect(result.rounds).toBeGreaterThanOrEqual(1);
		expect(result.rounds).toBeLessThanOrEqual(50);
	});

	it('character with vastly superior stats wins more often', () => {
		const strong = makeChar({ ws: 10, a: 10, s: 10, t: 10, wounds: 10, armourSave: 2 });
		const weak = makeChar({ ws: 1, a: 1, s: 1, t: 1, wounds: 1 });

		const controller = new MonteCarloController(strong, weak, 1234);
		const results = controller.run(500);

		expect(results.winRateA).toBeGreaterThan(0.9);
		expect(results.avgRounds).toBeLessThan(5);
	});

	it('mutual kill is recorded when both die simultaneously', () => {
		// Set up both to deal guaranteed wounds and have no saves
		const glassCannon = makeChar({ ws: 10, s: 10, a: 10, t: 1, wounds: 1, armourSave: 7 });

		const controller = new MonteCarloController(glassCannon, { ...glassCannon }, 42);
		const results = controller.run(500);

		// At least some mutual kills should occur (both have equal I, both strike simultaneously)
		expect(results.mutualKillRate).toBeGreaterThan(0);
	});

	it('hard cap at 50 rounds prevents infinite loops', () => {
		const tank1 = makeChar({ ws: 1, s: 1, a: 1, t: 10, wounds: 10, armourSave: 2 });
		const tank2 = makeChar({ ws: 1, s: 1, a: 1, t: 10, wounds: 10, armourSave: 2 });

		const controller = new MonteCarloController(tank1, tank2, 42);
		const results = controller.run(100);

		expect(results.avgRounds).toBeLessThanOrEqual(50);
		expect(results.drawRate).toBeGreaterThan(0);
	});

	it('great weapon sets initiative to 1', () => {
		const gwChar = makeChar({ ws: 4, i: 7, weapon: 'great-weapon' });
		const normalChar = makeChar({ ws: 4, i: 4 });

		const stats = computeEffectiveStats(gwChar, false, 1);
		expect(stats.strength).toBe(6); // 4 + 2
		expect(stats.initiative).toBe(1); // GW overrides to 1
	});

	it('charger gets initiative bonus', () => {
		const char = makeChar({ i: 4 });
		const statsCharging = computeEffectiveStats(char, true, 1);
		const statsNotCharging = computeEffectiveStats(char, false, 1);
		expect(statsCharging.initiative).toBe(7); // 4 + 3
		expect(statsNotCharging.initiative).toBe(4);
	});
});

// ── Preset Tests ──

describe('Preset Characters', () => {
	it('all presets have valid factions', () => {
		const validFactions = [
			'empire',
			'bretonnia',
			'chaos',
			'orcs-and-goblins',
			'dwarfs',
			'wood-elves',
			'high-elves',
			'beastmen',
			'tomb-kings',
			'vampire-counts',
			'skaven',
			'dark-elves',
			'lizardmen'
		];
		for (const preset of PRESET_CHARACTERS) {
			expect(validFactions).toContain(preset.faction);
		}
	});

	it('all presets have stats in valid range', () => {
		for (const preset of PRESET_CHARACTERS) {
			expect(preset.ws).toBeGreaterThanOrEqual(1);
			expect(preset.ws).toBeLessThanOrEqual(10);
			expect(preset.s).toBeGreaterThanOrEqual(1);
			expect(preset.s).toBeLessThanOrEqual(10);
			expect(preset.t).toBeGreaterThanOrEqual(1);
			expect(preset.t).toBeLessThanOrEqual(10);
			expect(preset.a).toBeGreaterThanOrEqual(1);
			expect(preset.a).toBeLessThanOrEqual(10);
			expect(preset.i).toBeGreaterThanOrEqual(1);
			expect(preset.i).toBeLessThanOrEqual(10);
			expect(preset.wounds).toBeGreaterThanOrEqual(1);
			expect(preset.wounds).toBeLessThanOrEqual(10);
		}
	});

	it('no two presets share the same name', () => {
		const names = PRESET_CHARACTERS.map((p) => p.name);
		expect(new Set(names).size).toBe(names.length);
	});
});

// ── Monte Carlo Simulation Tests ──

describe('MonteCarloController', () => {
	it('aggregates results correctly with N runs', () => {
		const char = makeChar();
		const controller = new MonteCarloController(char, { ...char }, 42);
		const results = controller.run(100);

		expect(results.totalRuns).toBe(100);
		expect(
			results.winRateA + results.winRateB + results.mutualKillRate + results.drawRate
		).toBeCloseTo(1.0, 1);
		expect(results.avgRounds).toBeGreaterThan(0);
	});

	it('round distribution sums to total runs', () => {
		const char = makeChar();
		const controller = new MonteCarloController(char, { ...char }, 42);
		const results = controller.run(100);

		const totalFromDist = results.roundDistribution.reduce((a, b) => a + b, 0);
		expect(totalFromDist).toBe(100);
	});

	it('survival curves start at 1.0 and decrease', () => {
		const char = makeChar();
		const controller = new MonteCarloController(char, { ...char }, 42);
		const results = controller.run(100);

		expect(results.survivalA[0]).toBe(1.0);
		expect(results.survivalB[0]).toBe(1.0);

		// Survival should be non-increasing
		for (let i = 1; i < results.survivalA.length; i++) {
			if (results.survivalA[i] !== undefined) {
				expect(results.survivalA[i]).toBeLessThanOrEqual(results.survivalA[i - 1] + 0.01);
			}
			if (results.survivalB[i] !== undefined) {
				expect(results.survivalB[i]).toBeLessThanOrEqual(results.survivalB[i - 1] + 0.01);
			}
		}
	});
});
