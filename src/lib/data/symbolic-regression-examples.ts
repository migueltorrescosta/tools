/** Bundled example datasets for the symbolic regression tool. */

import { Prng } from '$lib/prng';
import type { OperatorName } from '$lib/symbolic-regression/types';

export interface Example {
	id: string;
	name: string;
	description: string;
	csv: string;
	target: string;
	/** Numeric inputs. */
	inputs: string[];
	/** Categorical inputs. */
	categorical?: string[];
	operators?: OperatorName[];
}

/** Orbital elements of bodies orbiting the Sun (JPL, about 4 significant figures). */
const KEPLER_CSV = `body,a_AU,T_years,e
Mercury,0.3871,0.2408,0.2056
Venus,0.7233,0.6152,0.0068
Earth,1.000,1.000,0.0167
Mars,1.524,1.881,0.0934
Jupiter,5.203,11.86,0.0484
Saturn,9.537,29.46,0.0539
Uranus,19.19,84.01,0.0473
Neptune,30.07,164.8,0.0086
Ceres,2.767,4.603,0.0785
Pluto,39.48,247.9,0.2488
Haumea,43.12,283.2,0.1912
Makemake,45.43,306.2,0.1610
Eris,67.86,559.1,0.4407
Vesta,2.362,3.630,0.0887
Pallas,2.773,4.617,0.2306
Juno,2.669,4.361,0.2563
Hygiea,3.142,5.570,0.1125
Halley,17.83,75.32,0.9671
Encke,2.215,3.301,0.8483
Swift-Tuttle,26.09,133.3,0.9632
Churyumov-Gerasimenko,3.463,6.444,0.6410
`;

/** G in the example's units: 6.674e-11 · (1e24 kg)² / (1e9 m)² / 1e18 N. */
export const NEWTON_G = 66.74;

/**
 * Noisy samples of F = G·m1·m2/r² with 1.5% multiplicative Gaussian noise and
 * an unrelated `temperature_K` column.
 */
export function generateNewtonCsv(rows = 300, seed = 2026): string {
	const prng = new Prng(seed);
	const uniform = (lo: number, hi: number) => lo + (hi - lo) * prng.next();
	const lines = ['m1,m2,r,temperature_K,F'];
	for (let i = 0; i < rows; i++) {
		const m1 = uniform(1, 50);
		const m2 = uniform(1, 20);
		const r = uniform(1, 5);
		const temperature = uniform(150, 400);
		const F = ((NEWTON_G * m1 * m2) / (r * r)) * (1 + 0.015 * prng.normal());
		lines.push(
			[m1, m2, r, temperature, F].map((v) => Number(v.toPrecision(5)).toString()).join(',')
		);
	}
	return lines.join('\n') + '\n';
}

/** Delivery zones; island and remote ones carry a surcharge. */
export const ZONES = ['city', 'suburb', 'rural', 'island', 'remote'] as const;
export const SURCHARGE_ZONES: readonly string[] = ['island', 'remote'];

/**
 * Noisy parcel prices: cost = 4 + 0.8·weight + 6·1[zone ∈ {island, remote}],
 * with 2% multiplicative noise and an unrelated `carrier` column.
 */
export function generateShippingCsv(rows = 300, seed = 2026): string {
	const prng = new Prng(seed);
	const carriers = ['north', 'south', 'east'];
	const lines = ['weight_kg,zone,carrier,cost'];
	for (let i = 0; i < rows; i++) {
		const weight = 0.5 + 19.5 * prng.next();
		const zone = ZONES[prng.int(ZONES.length)];
		const carrier = carriers[prng.int(carriers.length)];
		const cost =
			(4 + 0.8 * weight + (SURCHARGE_ZONES.includes(zone) ? 6 : 0)) * (1 + 0.02 * prng.normal());
		lines.push(
			[Number(weight.toPrecision(4)), zone, carrier, Number(cost.toPrecision(5))].join(',')
		);
	}
	return lines.join('\n') + '\n';
}

export const EXAMPLES: Example[] = [
	{
		id: 'kepler',
		name: "Kepler's third law",
		description:
			'Semi-major axis a (AU), sidereal orbital period T (years) and eccentricity e of 21 bodies orbiting the Sun: the eight planets, dwarf planets, large asteroids and comets. Expect T ≈ a^1.5; e can be ticked as a distractor.',
		csv: KEPLER_CSV,
		target: 'T_years',
		inputs: ['a_AU'],
		operators: ['add', 'sub', 'mul', 'div', 'sqrt', 'pow']
	},
	{
		id: 'newton-gravity',
		name: "Newton's gravity (noisy)",
		description:
			'300 synthetic pairs of bodies: masses m1, m2 in 10²⁴ kg, distance r in 10⁹ m, force F in 10¹⁸ N, with 1.5% noise. Expect F ≈ 66.74·m1·m2/r²; temperature_K is a distractor.',
		csv: generateNewtonCsv(),
		target: 'F',
		inputs: ['m1', 'm2', 'r', 'temperature_K']
	},
	{
		id: 'shipping',
		name: 'Parcel prices (categorical)',
		description:
			'300 synthetic parcels: weight in kg, delivery zone and carrier, price with 2% noise. Expect cost ≈ 4 + 0.8·weight + 6·1[zone ∈ {island, remote}]; carrier is a distractor.',
		csv: generateShippingCsv(),
		target: 'cost',
		inputs: ['weight_kg'],
		categorical: ['zone', 'carrier']
	}
];
