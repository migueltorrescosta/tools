<script lang="ts">
	import T from './Tex.svelte';
</script>

<details class="how" data-testid="how">
	<summary>How it works</summary>
	<div class="body">
		<h3>The model</h3>
		<p>
			Take <T id="N" /> two-level particles: a system register S and an ancilla register A. The ancilla
			scheme evolves under <T id="H" /> for a hold <T id="hold" />, so every rate is in units of 1/t
			and every QFI in units of t². Its generator is <T id="gen" />: the ancilla weight
			<T id="a" /> is <T id="a0" /> for a passive ancilla and <T id="a1" /> for an active one.
		</p>
		<p>
			Switch on any coupling entry <T id="alpha" /> (for example only <T id="alphaZz" />) and any
			field axis of <T id="fields" />. The optimiser keeps <T id="controlBound" />, with B the
			control bound. Add up to <T id="K" /> instantaneous pulses <T id="pulse" /> at times you pick (by
			default
			<T id="pulseTimes" />), on A, S or both, with <T id="pulseBound" />. The input is optimised
			over
			<T id="sym" /> or over all <T id="full" /> states.
		</p>
		<p>
			The baseline is a Mach-Zehnder interferometer (MZI) with <T id="mzi" />. It gets the same
			particles and noise, its best input (see-saw over the full space and over Sym) and its best
			interrogation window <T id="window" />. When some noise isn't phase covariant (transverse
			dephasing, Lorentzian damping), the MZI may also add a bounded static bias: <T id="bias" />.
		</p>

		<h3>The four rules</h3>
		<ol>
			<li>
				<strong>Equal particles.</strong> The MZI gets all N particles, the ancilla counted.
			</li>
			<li>
				<strong>Bounded generator.</strong> With the seminorm <T id="seminorm" />, keep
				<T id="rule2" />. So <T id="aBig" /> breaks it.
			</li>
			<li><strong>Equal time.</strong> Both schemes hold for t.</li>
			<li>
				<strong>Equal noise on every particle.</strong> The ancilla carries the system's noise. A clean
				ancilla breaks it.
			</li>
		</ol>
		<p>
			Nobody measures or feeds back during the hold. The overrides under Accounting each break one
			rule on purpose, and the Rules panel says so.
		</p>

		<h3>Metrics</h3>
		<ul>
			<li><T id="R" />: the scheme's QFI over the MZI's best.</li>
			<li><T id="Rfixed" />: the same, but the MZI holds for the full <T id="windowFull" />.</li>
			<li>
				<T id="Rstd" />: against the MZI's best standard input (product, NOON, twin-Fock or one-axis
				twisted), each at its own window.
			</li>
			<li>
				<T id="deltaR" />: the change when the best optimum is rerun at <T id="twoM" /> Strang steps instead
				of <T id="steps" />, plus the gap between the two best seeds. Call a gain real when <T
					id="significance"
				/>.
			</li>
			<li>
				<T id="Rint" />: the same setup with <T id="alphaZero" />, optimised alongside. Shown only
				when the setup has a coupling.
			</li>
			<li>
				Readouts: <T id="errorProp" /> on S, a weighted joint <T id="Jz" /> on both registers, and parity
				<T id="parity" />, each after its best final rotation. The tiles show the best readout ratio
				and the attained fraction <T id="attained" />.
			</li>
			<li>
				Bounds, drawn on the convergence plot: the noiseless <T id="seminormBound" />, and for <T
					id="sigmaZ"
				/> dephasing the parallel channel-extension bound <T id="extensionBound" /> with
				<T id="eta" />.
			</li>
		</ul>

		<h3>Noise</h3>
		<p>
			Pick any mix, each with its own rate <T id="gamma" />, on each register. The Markovian
			channels add jump operators to <T id="lindblad" />, combined into one exact step per site per
			Strang step:
		</p>
		<ul>
			<li>Dephasing: <T id="dephasing" />, coherence falls as <T id="decay" />.</li>
			<li>
				Amplitude damping: <T id="damping" />; a thermal bath adds <T id="thermal" />.
			</li>
			<li>Depolarizing: <T id="depolarizing" />.</li>
			<li>Transverse dephasing: <T id="transverse" />. It isn't phase covariant.</li>
			<li>
				Lorentzian dephasing: <T id="lorentzDephasing" /> with a pseudomode damped at
				<T id="modeDamping" />. Coherence falls as <T id="coherence" /> with <T id="Gamma" />. That
				closed form holds while the dynamics commute with <T id="sz" />; otherwise the tool runs
				explicit pseudomodes, only at <T id="pseudomodeSize" /> and with a Fock cutoff
				<T id="cutoff" />.
			</li>
			<li>
				Lorentzian damping: <T id="lorentzDamping" />, an exact pseudomode with <T id="cutoffAd" />,
				only at <T id="pseudomodeSize" />.
			</li>
		</ul>
		<p>
			Use at most one Lorentzian bath per run. When the ancilla carries other noise, the MZI mirrors
			the split: <T id="NS" /> of its particles get the system's noise and <T id="NA" /> the ancilla's.
		</p>

		<h3>Running</h3>
		<p>
			Press Start. The MZI baseline comes first, then seeds run on Web Workers until you press Stop:
			seed 0 starts with every control off, later seeds start at random. Continue picks up where you
			stopped. Everything runs in your browser; the share link carries the setup, never results.
		</p>
	</div>
</details>

<style>
	.body {
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
		line-height: 1.7;
	}
	h3 {
		margin: var(--sp-2) 0 0;
		color: var(--text);
		font-size: var(--text-md);
	}
	p,
	ul,
	ol {
		margin: 0;
	}
	ul,
	ol {
		padding-left: var(--sp-5);
		display: flex;
		flex-direction: column;
		gap: var(--sp-1);
	}
</style>
