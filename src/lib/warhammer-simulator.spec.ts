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
	getWeaponStats,
	resolveSingleAttack
} from './warhammer-simulator/rules';
import { CombatEngine } from './warhammer-simulator/combat';
import {
	MonteCarloController,
	aggregateResults,
	addToHistogram
} from './warhammer-simulator/simulation';
import { PRESET_CHARACTERS } from './warhammer-simulator/presets';
import type { Character, CombatResult } from './warhammer-simulator/types';

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
	it('reports exactly one round for a combat decided in round 1', () => {
		const killer = makeChar({ a: 1 });
		const victim = makeChar({ a: 0, wounds: 1 });
		expect(new CombatEngine(killer, victim, new AlwaysSixRNG()).run().rounds).toBe(1);
	});

	it('reports k rounds for a combat decided in round k', () => {
		// One guaranteed wound per round against 3 wounds: dies in round 3.
		const killer = makeChar({ a: 1 });
		const victim = makeChar({ a: 0, wounds: 3 });
		const result = new CombatEngine(killer, victim, new AlwaysSixRNG()).run();
		expect(result.winner).toBe('A');
		expect(result.rounds).toBe(3);
	});

	it('round distribution puts guaranteed round-1 kills in the first bin', () => {
		const killer = makeChar({ ws: 10, s: 10, a: 10 });
		const victim = makeChar({ ws: 1, t: 1, a: 0, wounds: 1 });
		const results = new MonteCarloController(killer, victim, 7).run(200);
		expect(results.avgRounds).toBe(1);
		expect(results.roundDistribution).toEqual([200]);
	});

	it('derives the armour save from armour and shield (full plate + shield + parry = 2+)', () => {
		const tank = makeChar({ armour: 'full-plate', shield: 'shield' });
		expect(computeEffectiveStats(tank, false, 1).armourSave).toBe(2);
		expect(computeEffectiveStats(makeChar(), false, 1).armourSave).toBe(7);
	});

	it('armour from equipment blocks wounds in the engine', () => {
		// Every roll is a 6: every attack hits and wounds, and every 2+ save passes.
		const attacker = makeChar({ a: 3 });
		const tank = makeChar({ a: 0, wounds: 1, armour: 'full-plate', shield: 'shield' });
		const result = new CombatEngine(attacker, tank, new AlwaysSixRNG()).run();
		expect(result.winner).toBe('draw');
		expect(result.damageDealtA).toBe(0);
	});

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

	it('the same seed reproduces the same combat exactly', () => {
		const char = makeChar();
		const run = () => new CombatEngine(char, { ...char }, new SeededRNG(42)).run();
		expect(run()).toEqual(run());
	});

	it('mirror-image fighters win equally often (within 4 sigma)', () => {
		const char = makeChar();
		const N = 4000;
		const r = new MonteCarloController(char, { ...char }, 42).run(N);
		const sigma = Math.sqrt((r.winRateA + r.winRateB) / N);
		expect(Math.abs(r.winRateA - r.winRateB)).toBeLessThan(4 * sigma);
		expect(r.winRateA).toBeGreaterThan(0.2);
		expect(r.mutualKillRate).toBeGreaterThan(0);
	});

	it('3 attacks at 4+/4+ with no save average 0.75 wounds (MC vs analytic, 3 sigma)', () => {
		const attacker = makeChar({ a: 3 });
		const stats = computeEffectiveStats(attacker, false, 1);
		const rng = new SeededRNG(77);
		const N = 50_000;
		let total = 0;
		for (let i = 0; i < N; i++) {
			for (let k = 0; k < stats.attacks; k++) {
				total += resolveSingleAttack(rng, attacker, attacker, stats, stats);
			}
		}
		// Binomial(3, 1/4): mean 0.75, variance 3 * 1/4 * 3/4 = 0.5625.
		const sigmaMean = Math.sqrt(0.5625 / N);
		expect(Math.abs(total / N - 0.75)).toBeLessThan(3 * sigmaMean);
	});

	it('character with vastly superior stats wins more often', () => {
		const strong = makeChar({
			ws: 10,
			a: 10,
			s: 10,
			t: 10,
			wounds: 10,
			armour: 'full-plate',
			shield: 'shield'
		});
		const weak = makeChar({ ws: 1, a: 1, s: 1, t: 1, wounds: 1 });

		const controller = new MonteCarloController(strong, weak, 1234);
		const results = controller.run(500);

		expect(results.winRateA).toBeGreaterThan(0.9);
		expect(results.avgRounds).toBeLessThan(5);
	});

	it('mutual kill is recorded when both die simultaneously', () => {
		// Set up both to deal guaranteed wounds and have no saves
		const glassCannon = makeChar({ ws: 10, s: 10, a: 10, t: 1, wounds: 1 });

		const controller = new MonteCarloController(glassCannon, { ...glassCannon }, 42);
		const results = controller.run(500);

		// At least some mutual kills should occur (both have equal I, both strike simultaneously)
		expect(results.mutualKillRate).toBeGreaterThan(0);
	});

	it('hard cap at 50 rounds prevents infinite loops', () => {
		const tank1 = makeChar({
			ws: 1,
			s: 1,
			a: 1,
			t: 10,
			wounds: 10,
			armour: 'full-plate',
			shield: 'shield'
		});
		const tank2 = makeChar({
			ws: 1,
			s: 1,
			a: 1,
			t: 10,
			wounds: 10,
			armour: 'full-plate',
			shield: 'shield'
		});

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

	it('computeEffectiveStats adds no hidden charge Initiative bonus', () => {
		const char = makeChar({ i: 4 });
		expect(computeEffectiveStats(char, true, 1).initiative).toBe(4);
		expect(computeEffectiveStats(char, false, 1).initiative).toBe(4);
	});

	it('flail Strength bonus applies only while charging', () => {
		const flail = makeChar({ s: 4, weapon: 'flail' });
		expect(computeEffectiveStats(flail, true, 1).strength).toBe(6);
		expect(computeEffectiveStats(flail, false, 1).strength).toBe(4);
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
		const counts = [
			results.winRateA,
			results.winRateB,
			results.mutualKillRate,
			results.drawRate
		].map((rate) => Math.round(rate * 100));
		expect(counts.reduce((a, b) => a + b, 0)).toBe(100);
		expect(results.avgRounds).toBeGreaterThanOrEqual(1);
	});

	it('aggregateResults computes exact statistics from known results', () => {
		const base = { remainingWoundsA: 1, remainingWoundsB: 1, abilityActivations: {} };
		const results: CombatResult[] = [
			{ ...base, winner: 'A', rounds: 1, damageDealtA: 3, damageDealtB: 0, remainingWoundsB: 0 },
			{ ...base, winner: 'B', rounds: 2, damageDealtA: 1, damageDealtB: 3, remainingWoundsA: 0 },
			{
				...base,
				winner: 'mutual',
				rounds: 3,
				damageDealtA: 3,
				damageDealtB: 3,
				remainingWoundsA: 0,
				remainingWoundsB: 0,
				abilityActivations: { 'killing-blow': 2 }
			},
			{ ...base, winner: 'draw', rounds: 50, damageDealtA: 0, damageDealtB: 0 }
		];
		const agg = aggregateResults(results, 4, 9);
		expect([agg.winRateA, agg.winRateB, agg.mutualKillRate, agg.drawRate]).toEqual([
			0.25, 0.25, 0.25, 0.25
		]);
		expect(agg.avgRounds).toBe(56 / 4);
		expect(agg.maxRounds).toBe(50);
		expect(agg.roundDistribution[0]).toBe(1);
		expect(agg.roundDistribution[1]).toBe(1);
		expect(agg.roundDistribution[2]).toBe(1);
		expect(agg.roundDistribution[49]).toBe(1);
		expect(agg.roundDistribution.reduce((a, b) => a + b, 0)).toBe(4);
		expect(agg.avgDamageA).toBe(7 / 4);
		expect(agg.avgDamageB).toBe(6 / 4);
		expect(agg.damageHistogramA).toEqual([1, 1, 0, 2]);
		expect(agg.damageHistogramB).toEqual([2, 0, 0, 2]);
		// Frequency counts combats in which the ability fired, not activations.
		expect(agg.abilityFrequencies).toEqual({ 'killing-blow': 1 });
		expect(agg.seedUsed).toBe(9);
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

		// Survival must be non-increasing, with no tolerance.
		for (let i = 1; i < results.survivalA.length; i++) {
			expect(results.survivalA[i]).toBeLessThanOrEqual(results.survivalA[i - 1]);
			expect(results.survivalB[i]).toBeLessThanOrEqual(results.survivalB[i - 1]);
		}
	});
});

describe('Charge', () => {
	// Fragile duellists: whoever strikes first usually wins.
	const duellist = makeChar({ ws: 4, s: 4, t: 3, a: 2, i: 4, wounds: 1 });
	const N = 4000;
	const winA = (charger: 'A' | 'B' | 'none', bonus: number, a = duellist, b = duellist) =>
		new MonteCarloController(a, { ...b }, 11, false, bonus, charger).run(N).winRateA;

	it('no charger gives a symmetric duel', () => {
		const r = new MonteCarloController(duellist, { ...duellist }, 11, false, 3, 'none').run(N);
		expect(Math.abs(r.winRateA - r.winRateB)).toBeLessThan(0.05);
	});

	it('charging raises the charger win rate', () => {
		const run = (charger: 'A' | 'B' | 'none') =>
			new MonteCarloController(duellist, { ...duellist }, 11, false, 1, charger).run(N);
		const none = run('none');
		expect(run('A').winRateA).toBeGreaterThan(none.winRateA + 0.1);
		expect(run('B').winRateB).toBeGreaterThan(none.winRateB + 0.1);
	});

	it('the charge bonus size changes the outcome when it flips strike order', () => {
		const slow = { ...duellist, i: 3 };
		const fast = { ...duellist, i: 5 };
		// +1: I4 vs I5, B still strikes first. +3: I6 vs I5, A strikes first.
		expect(winA('A', 3, slow, fast)).toBeGreaterThan(winA('A', 1, slow, fast) + 0.1);
	});

	it('charge only lasts round 1 unless chargePersists', () => {
		const a = makeChar({ a: 1, wounds: 2, i: 3 });
		const b = makeChar({ a: 1, wounds: 2, i: 4 });
		// Every roll is a 6: each strike lands one wound. A charges with +3 (I6 vs I4).
		// Round 1: A strikes first -> B 1 wound left; B strikes -> A 1 wound left.
		// Round 2 without persist: B (I4) strikes first and kills A.
		const once = new CombatEngine(a, b, new AlwaysSixRNG(), false, 3, 'A').run();
		expect(once.winner).toBe('B');
		// With persist: A (I6) strikes first in round 2 and kills B.
		const persist = new CombatEngine(a, b, new AlwaysSixRNG(), true, 3, 'A').run();
		expect(persist.winner).toBe('A');
	});
});

describe('Traits, gifts and items', () => {
	// Baseline: WS4 v WS4 hits on 4+, S4 v T4 wounds on 4+, no save -> p = 1/4.
	const N = 120_000;
	const tol = (p: number) => 4 * Math.sqrt((p * (1 - p)) / N);

	/** Monte Carlo per-attack probability that an attack inflicts damage. */
	function damageRate(attacker: Character, defender: Character, round = 1): number {
		const rng = new SeededRNG(2024);
		const aStats = computeEffectiveStats(attacker, false, round);
		const dStats = computeEffectiveStats(defender, false, round);
		let hits = 0;
		for (let i = 0; i < N; i++) {
			if (resolveSingleAttack(rng, attacker, defender, aStats, dStats) > 0) hits++;
		}
		return hits / N;
	}

	function expectRate(attacker: Character, defender: Character, p: number, round = 1) {
		expect(Math.abs(damageRate(attacker, defender, round) - p)).toBeLessThan(tol(p));
	}

	const plain = makeChar();
	const plated = makeChar({ armour: 'full-plate', shield: 'shield' }); // 2+ save

	it('baseline matches the analytic 1/4', () => {
		expectRate(plain, plain, 1 / 4);
	});

	it('Poisoned Attacks: natural 6 to hit auto-wounds (1/6 + 2/6 * 1/2 = 1/3)', () => {
		expectRate(makeChar({ traits: ['poisoned-attacks'] }), plain, 1 / 3);
	});

	it('Killing Blow: natural 6 to wound ignores armour (1/2 * (1/6 + 2/6 * 1/6) = 1/9)', () => {
		expectRate(plated, plated, 1 / 24);
		expectRate(makeChar({ traits: ['killing-blow'] }), plated, 1 / 9);
	});

	it('Killing Blow slays a multi-wound target outright', () => {
		const kb = makeChar({ a: 1, traits: ['killing-blow'] });
		const victim = makeChar({ a: 0, wounds: 5, armour: 'full-plate', shield: 'shield' });
		const result = new CombatEngine(kb, victim, new AlwaysSixRNG()).run();
		expect(result.rounds).toBe(1);
		expect(result.damageDealtA).toBe(5);
		expect(result.abilityActivations['killing-blow']).toBe(1);
	});

	it('Blasted Standard ignores armour saves (2+ save -> 1/4)', () => {
		expectRate(makeChar({ traits: ['blasted-standard'] }), plated, 1 / 4);
	});

	it('Helm of Confusion rerolls failed hits in round 1 only (3/4 * 1/2 = 3/8)', () => {
		const helm = makeChar({ traits: ['reroll-hits'] });
		expectRate(helm, plain, 3 / 8, 1);
		expectRate(helm, plain, 1 / 4, 2);
	});

	it('Potion of Strength rerolls failed wounds in round 1 only (1/2 * 3/4 = 3/8)', () => {
		const potion = makeChar({ traits: ['reroll-wounds'] });
		expectRate(potion, plain, 3 / 8, 1);
		expectRate(potion, plain, 1 / 4, 2);
	});

	it('Strength Potion gives +1 S in round 1 only (1/2 * 2/3 = 1/3)', () => {
		const potion = makeChar({ traits: ['strength-boost'] });
		expectRate(potion, plain, 1 / 3, 1);
		expectRate(potion, plain, 1 / 4, 2);
	});

	it('Toughness Potion gives +1 T in round 1 only (1/2 * 1/3 = 1/6)', () => {
		const potion = makeChar({ traits: ['toughness-boost'] });
		expectRate(plain, potion, 1 / 6, 1);
		expectRate(plain, potion, 1 / 4, 2);
	});

	it('Potion of Speed gives +1 Attack in round 1 only', () => {
		const potion = makeChar({ a: 3, traits: ['attacks+1'] });
		expect(computeEffectiveStats(potion, false, 1).attacks).toBe(4);
		expect(computeEffectiveStats(potion, false, 2).attacks).toBe(3);
	});

	it('Daemonic Mount gives +1 Attack and +1 Toughness', () => {
		const mounted = computeEffectiveStats(makeChar({ traits: ['daemonic-mount'] }), false, 2);
		expect(mounted.attacks).toBe(4);
		expect(mounted.toughness).toBe(5);
		expectRate(plain, makeChar({ traits: ['daemonic-mount'] }), 1 / 6, 2);
	});

	it('Regeneration recovers a wound at the end of each round', () => {
		// Every roll is a 6: B wounds A once per round, A regenerates it back.
		const regen = makeChar({ a: 0, wounds: 2, traits: ['regeneration'] });
		const hitter = makeChar({ a: 1 });
		const withRegen = new CombatEngine(regen, hitter, new AlwaysSixRNG()).run();
		expect(withRegen.winner).toBe('draw');
		expect(withRegen.remainingWoundsA).toBe(2);
		expect(withRegen.abilityActivations['regeneration']).toBe(50);

		const without = new CombatEngine(
			makeChar({ a: 0, wounds: 2 }),
			hitter,
			new AlwaysSixRNG()
		).run();
		expect(without.winner).toBe('B');
		expect(without.rounds).toBe(2);
	});

	it('activation counters only fire when the trait actually triggers', () => {
		// Natural 6s: poison auto-wounds on every attack, so no Killing Blow roll exists.
		const both = makeChar({ a: 2, traits: ['poisoned-attacks', 'killing-blow'] });
		const target = makeChar({ a: 0, wounds: 10 });
		const result = new CombatEngine(both, target, new AlwaysSixRNG()).run();
		expect(result.abilityActivations['poisoned-attacks']).toBeGreaterThan(0);
		expect(result.abilityActivations['killing-blow']).toBeUndefined();
	});
});

describe('Damage histogram', () => {
	it('addToHistogram counts values by index', () => {
		const h: number[] = [];
		for (const v of [0, 2, 2, 5]) addToHistogram(h, v);
		expect(h).toEqual([1, 0, 2, 0, 0, 1]);
	});

	it('bins 200k results without spreading them (no stack overflow) and with exact counts', () => {
		const N = 200_000;
		const results: CombatResult[] = Array.from({ length: N }, (_, i) => ({
			winner: 'A',
			rounds: 1,
			damageDealtA: i % 4,
			damageDealtB: i % 2,
			remainingWoundsA: 1,
			remainingWoundsB: 0,
			abilityActivations: {}
		}));
		const agg = aggregateResults(results, N, 1);
		expect(agg.damageHistogramA).toEqual([N / 4, N / 4, N / 4, N / 4]);
		expect(agg.damageHistogramB).toEqual([N / 2, N / 2]);
		expect(Math.max(...agg.damageHistogramA)).toBe(N / 4);
	});

	it('MonteCarloController histograms sum to the run count', () => {
		const char = makeChar();
		const r = new MonteCarloController(char, { ...char }, 5).run(500);
		expect(r.damageHistogramA.reduce((a, b) => a + b, 0)).toBe(500);
		expect(r.damageHistogramB.reduce((a, b) => a + b, 0)).toBe(500);
		expect(r.damageHistogramA.length).toBeLessThanOrEqual(char.wounds + 1);
	});
});
