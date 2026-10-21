/**
 * Balances rounded to whole euros so that they still sum to exactly zero.
 * Largest-remainder (Hamilton) rounding: take the floor of each balance, then
 * give the leftover euros one each to the largest fractional parts, ties to
 * the lowest person index. Assumes the raw balances sum to zero.
 */
export function roundedBalances(raw: readonly number[]): number[] {
	// Snap float noise (e.g. 24.999999999) onto the integer it represents.
	const floors = raw.map((d) => Math.floor(d + 1e-9));
	const leftover = Math.round(-floors.reduce((a, b) => a + b, 0));
	const order = raw
		.map((d, i) => ({ i, rem: d - floors[i] }))
		// Remainders equal up to float noise count as tied.
		.sort((a, b) => (Math.abs(b.rem - a.rem) > 1e-9 ? b.rem - a.rem : a.i - b.i));
	const out = [...floors];
	for (let k = 0; k < leftover && k < order.length; k++) out[order[k].i] += 1;
	return out.map((v) => v + 0); // normalise -0
}

/**
 * Human-readable settlement for a signed amount (positive = owes money):
 * "Pay X", "Receive X", or "No payment" when it rounds to zero. Rounds to
 * whole units first, so values in (-0.5, 0.5) never render as "-0".
 */
export function paymentLabel(amount: number, format: (n: number) => string): string {
	const r = Math.round(amount) + 0;
	if (r > 0) return `Pay ${format(r)}`;
	if (r < 0) return `Receive ${format(-r)}`;
	return 'No payment';
}
