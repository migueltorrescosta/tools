// ── Enums & Union Types ──

export type Faction =
	| 'empire'
	| 'bretonnia'
	| 'chaos'
	| 'orcs-and-goblins'
	| 'dwarfs'
	| 'wood-elves'
	| 'high-elves'
	| 'beastmen'
	| 'tomb-kings'
	| 'vampire-counts'
	| 'skaven'
	| 'dark-elves'
	| 'lizardmen';

export type MarkOfChaos = 'undivided' | 'khorne' | 'nurgle' | 'tzeentch' | 'slaanesh';

export type WeaponType =
	| 'hand-weapon'
	| 'great-weapon'
	| 'flail'
	| 'halberd'
	| 'lance'
	| 'additional-hand-weapon'
	| 'spear';

export type ArmourType = 'none' | 'light' | 'heavy' | 'full-plate';

export type ShieldType = 'none' | 'shield';

export type RerollSource = 'always' | 'single-use';

// ── Core Models ──

export interface WeaponStats {
	type: WeaponType;
	name: string;
	attacks: number; // bonus attacks (0 for most)
	strengthBonus: number;
	ap: number; // armour penetration (0, -1, -2, etc.)
	twoHanded: boolean;
	special: string[];
}

export interface ArmourStats {
	type: ArmourType;
	name: string;
	save: number; // 7 = no save, 6 = 6+, 5 = 5+, etc.
}

export interface ShieldStats {
	type: ShieldType;
	name: string;
	saveBonus: number; // typically +1
	parryBonus: number; // additional +1 when paired with hand weapon in melee
}

export interface Character {
	name: string;
	/** Matters only as the target of Hatred (e.g. 'hatred-of-high-elves'). */
	faction: Faction;
	/** Flavour only: Marks of Chaos are not simulated. */
	mark?: MarkOfChaos;
	ws: number;
	s: number;
	t: number;
	a: number;
	i: number;
	wounds: number;
	wardSave: number; // 2 through 7, or 0 = no ward save
	weapon: WeaponType;
	armour: ArmourType;
	shield: ShieldType;
	traits: string[];
	/**
	 * Special rule ids. Only the ids accepted by isModelledSpecialRule (rules.ts)
	 * affect the duel: 'hatred-all', 'hatred-of-<faction>' and 'murderous-prowess'.
	 */
	specialRules: string[];
}

export interface CharacterPreset {
	name: string;
	faction: Faction;
	mark?: MarkOfChaos;
	ws: number;
	s: number;
	t: number;
	a: number;
	i: number;
	wounds: number;
	armourType: ArmourType;
	wardSave: number;
	weapon: WeaponType;
	shield: ShieldType;
	traits: string[];
	specialRules: string[];
	description: string;
}

// ── Combat ──

export type Winner = 'A' | 'B' | 'mutual' | 'draw';

/** Which side charged into the duel, if any. */
export type Charger = 'A' | 'B' | 'none';

export interface CombatResult {
	winner: Winner;
	rounds: number;
	damageDealtA: number;
	damageDealtB: number;
	remainingWoundsA: number;
	remainingWoundsB: number;
	/** Round in which A was slain, or null if A survived the combat. */
	deathRoundA: number | null;
	deathRoundB: number | null;
	abilityActivations: Record<string, number>;
}

export interface CombatState {
	charAWounds: number;
	charBWounds: number;
	roundNumber: number;
}

// ── Simulation ──

export interface SimulationResults {
	totalRuns: number;
	winRateA: number;
	winRateB: number;
	mutualKillRate: number;
	drawRate: number;
	avgRounds: number;
	roundDistribution: number[]; // indexed by round-1, values = count
	maxRounds: number;
	avgDamageA: number;
	avgDamageB: number;
	/** damageHistogramA[d] = number of combats in which A dealt exactly d wounds. */
	damageHistogramA: number[];
	damageHistogramB: number[];
	remainingWoundsA: number[];
	remainingWoundsB: number[];
	/** survivalA[r] = fraction of combats in which A is still alive after round r (r = 0..maxRounds). */
	survivalA: number[];
	survivalB: number[];
	abilityFrequencies: Record<string, number>;
	seedUsed: number;
}

export interface SimulationJob {
	charA: Character;
	charB: Character;
	totalSimulations: number;
	seed: number;
	charger: Charger;
}

export interface SimulationProgress {
	type: 'progress';
	progress: number; // 0.0 to 1.0
	elapsedMs: number;
}

export interface SimulationComplete {
	type: 'complete';
	results: SimulationResults;
}

export type WorkerMessage = SimulationProgress | SimulationComplete;

// ── Ability / Trait / Gift ──

export interface TraitDef {
	id: string;
	name: string;
	description: string;
	cost: number; // in gift points, 0 for traits
	category: 'trait' | 'gift' | 'item';
	factions?: Faction[]; // restricted to specific factions, undefined = all
}
