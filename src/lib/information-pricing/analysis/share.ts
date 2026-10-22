/**
 * Profit share of an input: the share of the recommended decision's reward
 * variance it explains, Var(E[R_{d*} | X]) / Var(R_{d*}). The conditional
 * expectation is estimated per quantile group of X (the groups of
 * `optimalDecisionPerGroup`), and the between-group share η̂² is
 * bias-corrected with Kelley's ε² (Kelley 1935), so an input with no effect
 * scores about zero instead of the noise its group means pick up.
 */

/**
 * Profit share of the rows grouped by `codes` (group of each row, `count`
 * groups) on the `reward` column: Kelley's ε² = max(0, 1 − (1 − η̂²)(N − 1)/(N − K)),
 * K the non-empty groups, η̂² = SSB/SST. In [0, 1].
 */
export function profitShare(codes: Uint8Array, count: number, reward: Float64Array): number {
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
	if (!(sst > 0) || n <= groups) return 0;
	const eta2 = Math.min(1, ssb / sst);
	return Math.max(0, 1 - ((1 - eta2) * (n - 1)) / (n - groups));
}
