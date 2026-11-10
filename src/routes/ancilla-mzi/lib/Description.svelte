<details class="how" data-testid="how">
	<summary>How it works</summary>
	<p>
		Does an ancilla really beat a Mach-Zehnder interferometer under noise? Build a scheme, count it
		fairly, and see. Everything runs in your browser.
	</p>
	<p>
		Pick a preset, or change it under Customise setup, then press Run. The optimiser finds the best
		controls for the ancilla scheme and for a plain Mach-Zehnder interferometer (MZI), with the same
		particles, noise and hold time. R is the ancilla scheme's quantum Fisher information over the
		best MZI's, so an R above 1 means the ancilla helps. δR is the numerical uncertainty, and a gain
		counts as significant when R is at least 1 + max(0.01, 3 δR).
	</p>
	<p>
		The line above the results says whether all four fairness rules hold; open it for each rule.
		Advanced holds the noise on each register, the accounting overrides (each breaks one rule on
		purpose) and the optimiser's precision and speed: Strang steps M per hold, rounds and iterations
		per seed, see-saw iterations for the MZI's input, the number of workers and the first seed.
	</p>
	<p>
		The model, the rules and the metrics are in the
		<a href="https://github.com/migueltorrescosta/tools/blob/main/docs/ancilla-mzi.md">docs</a>.
	</p>
</details>
