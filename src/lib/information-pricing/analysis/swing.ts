/**
 * Profit swing of an input: how far the expected reward of the recommended
 * decision moves with the input, √Var(E[R_{d*} | X]). The conditional
 * expectation is estimated per quantile group of X (the groups of
 * `optimalDecisionPerGroup`), and the between-group share of the variance is
 * bias-corrected with Kelley's ε² (Kelley 1935), so an input with no effect
 * scores about zero instead of the noise its group means pick up.
 */

export interface ProfitSwing {
	/** √(ε² · Var(R_{d*})), native units: one standard deviation of E[R_{d*} | X]. */
	sd: number;
	/** η̂²: between-group sum of squares over the total. */
	eta2: number;
	/** Kelley's ε² = max(0, 1 − (1 − η̂²)(N − 1)/(N − K)), K the non-empty groups. */
	epsilon2: number;
}

/**
 * Profit swing of the rows grouped by `codes` (group of each row, `count`
 * groups) on the `reward` column. Var(R) uses N − 1 in the denominator.
 */
export function profitSwing(codes: Uint8Array, count: number, reward: Float64Array): ProfitSwing {
	const n = reward.length;
	const sums = new Float64Array(count);
	const counts = new Float64Array(count);
	let total = 0;
	for (let i = 0; i < n; i++) {
		const c = codes[i];
		sums[c] += reward[i];
		counts[c]++;
		total += reward[i];
	}
	const mean = total / n;
	let sst = 0;
	for (let i = 0; i < n; i++) sst += (reward[i] - mean) ** 2;
	let ssb = 0;
	let groups = 0;
	for (let k = 0; k < count; k++) {
		if (counts[k] === 0) continue;
		groups++;
		ssb += counts[k] * (sums[k] / counts[k] - mean) ** 2;
	}
	if (!(sst > 0) || n <= groups) return { sd: 0, eta2: 0, epsilon2: 0 };
	const eta2 = Math.min(1, ssb / sst);
	const epsilon2 = Math.max(0, 1 - ((1 - eta2) * (n - 1)) / (n - groups));
	return { sd: Math.sqrt((epsilon2 * sst) / (n - 1)), eta2, epsilon2 };
}
