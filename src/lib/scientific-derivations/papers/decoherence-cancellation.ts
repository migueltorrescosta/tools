import type { Paper } from '../types';

// TeX and prose are raw strings, so backslashes need no escaping.
const t = String.raw;

/** M[O]ρ, written once for the details that define it. */
const DISSIPATOR = t`$\mathbb M[O]\rho = O\rho O^\dagger - \tfrac12\{O^\dagger O,\rho\}$`;

export const decoherenceCancellation: Paper = {
	id: 'decoherence-cancellation',
	title: 'Decoherence Cancellation through Noise Interference',
	authors: "G. D'Auria, G. Morigi, F. Anselmi, F. Benatti",
	venue: 'Phys. Rev. Lett. 136, 040201 (2026)',
	url: 'https://arxiv.org/abs/2408.04418',
	numbering:
		'Equation numbers follow arXiv:2408.04418v2, numbered continuously into the Supplementary Material (SM).',
	derivations: [
		{
			id: 'gksl-from-stochastic',
			title: 'GKSL master equation from stochastic processes',
			section: 'SM, Sec. I',
			summary: t`Averaging a Schrödinger equation driven by correlated white noise over the noise gives a master equation of GKSL (Lindblad) form, whose Kossakowski matrix is the noise correlation matrix $\Lambda$.`,
			nodes: [
				{
					id: 'hamiltonian',
					title: 'Noisy Hamiltonian',
					kind: 'assumption',
					tex: t`H(t) = H_0 + \sum_{i=1}^n w_i(t)\,A_i,\qquad A_i = A_i^\dagger,\ \ [A_i, A_j] = 0`,
					detail: t`A fixed Hamiltonian $H_0$ plus classical noises $w_i(t)$ coupled to commuting, self-adjoint operators $A_i$.`,
					ref: 'Eq. (15)'
				},
				{
					id: 'noise',
					title: 'Correlated white noise',
					kind: 'assumption',
					tex: t`\langle\!\langle w_i(t)\rangle\!\rangle = 0,\qquad \langle\!\langle w_i(t)\,w_j(s)\rangle\!\rangle = \Lambda_{ij}\,\delta(t-s),\qquad \Lambda \succeq 0`,
					detail: t`Zero-mean, delta-correlated noises. $\Lambda$ is a covariance matrix, so it is positive semi-definite. $\langle\!\langle\cdot\rangle\!\rangle$ is the average over noise realisations.`,
					ref: 'Eq. (16)',
					correction: t`We also take the noise to be Gaussian. The paper uses this implicitly when it drops the terms with more than two noise integrals.`
				},
				{
					id: 'sse',
					title: 'Stochastic Schrödinger equation',
					kind: 'step',
					tex: t`i\,\partial_t|\psi_w(t)\rangle = \big[H_0 + \mathbf w(t)\cdot\mathbf A\big]\,|\psi_w(t)\rangle`,
					detail: t`One equation per noise realisation $\mathbf w$, read in the Stratonovich sense.`,
					ref: 'Eqs. (17)–(18)'
				},
				{
					id: 'average',
					title: 'Noise-averaged state',
					kind: 'step',
					tex: t`\rho(t) = \langle\!\langle\, |\psi_w(t)\rangle\langle\psi_w(t)|\,\rangle\!\rangle`,
					detail: t`The observed state is the average of the pure trajectories.`,
					ref: 'Eq. (19)'
				},
				{
					id: 'propagator',
					title: 'Short-time propagator',
					kind: 'step',
					tex: t`U(t+\epsilon, t) = 1 - iH_0\epsilon - iW_1 - \tfrac12 W_1^2 + o(\epsilon),\qquad W_1 = \int_t^{t+\epsilon}\!\mathbf w(\tau)\cdot\mathbf A\,d\tau`,
					detail: t`$W_1$ is of order $\sqrt\epsilon$ for white noise, so $W_1^2$ is first order in $\epsilon$ and must be kept, while products such as $H_0 W_1$ are $O(\epsilon^{3/2})$.`,
					ref: 'Eqs. (20)–(22)',
					correction: t`The paper writes the second-order term as a separate double integral $W_2$. Because the $A_i$ commute, the time-ordered double integral is exactly $\tfrac12 W_1^2$.`
				},
				{
					id: 'independent',
					title: 'First-order terms vanish',
					kind: 'step',
					tex: t`\langle\!\langle\, W_1\,|\psi_w(t)\rangle\langle\psi_w(t)|\,\rangle\!\rangle = \langle\!\langle W_1\rangle\!\rangle\,\rho(t) = 0`,
					detail: t`$|\psi_w(t)\rangle$ depends on the noise only up to time $t$, and white noise on $(t, t+\epsilon]$ is independent of it. The paper reaches the same conclusion with the Furutsu–Novikov–Donsker relation: the functional derivative $\delta|\psi_w(t)\rangle/\delta w_i(\tau)$ vanishes for $\tau > t$.`,
					ref: 'Eqs. (24)–(26)',
					correction: t`In Eq. (24) the prefactor should be the correlation matrix, $\langle\!\langle w_i(s)F[w]\rangle\!\rangle = \sum_j \Lambda_{ij}\langle\!\langle \delta F/\delta w_j(s)\rangle\!\rangle$, not a single $\lambda$.`
				},
				{
					id: 'second-moments',
					title: 'Second moments',
					kind: 'step',
					tex: t`\langle\!\langle W_1\,\rho\,W_1\rangle\!\rangle = \epsilon\sum_{ij}\Lambda_{ij}\,A_i\rho A_j,\qquad \langle\!\langle W_1^2\rangle\!\rangle\rho = \epsilon\sum_{ij}\Lambda_{ij}\,A_iA_j\rho`,
					detail: t`By independence the noise integrals factor out of the trajectory, and $\langle\!\langle \int w_i \int w_j\rangle\!\rangle = \Lambda_{ij}\,\epsilon$ over an interval of length $\epsilon$.`,
					ref: 'Eqs. (27)–(29)',
					correction: t`Eqs. (27)–(29) write lower-case $\lambda_{ij}$ and Eq. (28) has a stray index; both mean $\Lambda_{ij}$.`
				},
				{
					id: 'expansion',
					title: 'First order in ε',
					kind: 'step',
					tex: t`\rho(t+\epsilon) = \rho - i\epsilon[H_0,\rho] + \epsilon\sum_{ij}\Lambda_{ij}\big(A_i\rho A_j - \tfrac12\{A_iA_j,\rho\}\big) + o(\epsilon)`,
					detail: t`Insert the propagator into $U\,|\psi_w\rangle\langle\psi_w|\,U^\dagger$, average, and keep the terms of order $\epsilon$.`,
					ref: 'Eq. (23)'
				},
				{
					id: 'gksl',
					title: 'GKSL master equation',
					kind: 'result',
					tex: t`\dot\rho = -i[H_0,\rho] + \sum_{i,j=1}^n\Lambda_{ij}\Big(A_i\rho A_j - \tfrac12\{A_jA_i,\rho\}\Big)`,
					detail: t`The noise correlation matrix $\Lambda$ is the Kossakowski matrix of the generator.`,
					ref: 'Eq. (30)'
				},
				{
					id: 'lindblad',
					title: 'Diagonal (Lindblad) form',
					kind: 'result',
					added: true,
					tex: t`\Lambda = \sum_k \mu_k\,\mathbf v_k\mathbf v_k^{\top}\ \Rightarrow\ \dot\rho = -i[H_0,\rho] + \sum_k \mathbb M[L_k]\rho,\qquad L_k = \sqrt{\mu_k}\sum_i v_{k,i}A_i`,
					detail: t`With ${DISSIPATOR}. Every eigenvalue $\mu_k \ge 0$, so the generator is completely positive. A rank-one $\Lambda$ (one noise source) gives a single jump operator; derivations 2 and 5 use this.`
				}
			],
			edges: [
				{
					from: 'hamiltonian',
					to: 'sse',
					label: 'Stratonovich calculus',
					detail: t`White noise is the limit of smooth noise with a vanishing correlation time (Wong–Zakai), so the Schrödinger equation keeps its ordinary form and ordinary calculus applies.`
				},
				{
					from: 'sse',
					to: 'average',
					label: 'average over noise',
					detail: t`Each realisation gives a pure state; the ensemble gives a density matrix.`
				},
				{
					from: 'sse',
					to: 'propagator',
					label: 'Dyson series to 2nd order',
					detail: t`Expand the time-ordered exponential of Eq. (18) over $[t, t+\epsilon]$.`
				},
				{
					from: 'propagator',
					to: 'independent',
					label: 'independent increments',
					detail: t`$W_1$ involves the noise on $(t, t+\epsilon]$ only, which is independent of the state at time $t$.`
				},
				{
					from: 'noise',
					to: 'independent',
					label: 'zero mean',
					detail: t`$\langle\!\langle W_1\rangle\!\rangle = 0$ because each $w_i$ has zero mean.`
				},
				{
					from: 'propagator',
					to: 'second-moments',
					label: 'factorise the averages',
					detail: t`The same independence lets the average of $W_1\,|\psi\rangle\langle\psi|\,W_1$ split into a noise average times $\rho(t)$.`
				},
				{
					from: 'noise',
					to: 'second-moments',
					label: 'δ-correlation',
					detail: t`$\int_t^{t+\epsilon}\!\int_t^{t+\epsilon}\Lambda_{ij}\,\delta(\tau-\tau')\,d\tau\,d\tau' = \Lambda_{ij}\,\epsilon$.`
				},
				{
					from: 'average',
					to: 'expansion',
					label: 'propagate one step',
					detail: t`$\rho(t+\epsilon) = \langle\!\langle U\,|\psi_w(t)\rangle\langle\psi_w(t)|\,U^\dagger\rangle\!\rangle$.`
				},
				{
					from: 'independent',
					to: 'expansion',
					label: t`drop terms linear in $W_1$`,
					detail: t`Every term with a single $W_1$ averages to zero.`
				},
				{
					from: 'second-moments',
					to: 'expansion',
					label: t`keep $O(\epsilon)$; higher moments are $o(\epsilon)$`,
					detail: t`$-\tfrac12 W_1^2$ on each side gives the anticommutator, $W_1\rho W_1$ the sandwich term. Terms with three or more noise integrals are $o(\epsilon)$ for Gaussian noise.`
				},
				{
					from: 'expansion',
					to: 'gksl',
					label: t`divide by $\epsilon$, let $\epsilon \to 0$`,
					detail: t`Since the $A_i$ commute, $A_iA_j = A_jA_i$ and the order inside the anticommutator does not matter.`
				},
				{
					from: 'gksl',
					to: 'lindblad',
					label: 'diagonalise Λ',
					detail: t`Write $\Lambda$ in its eigenbasis and collect $\sum_{ij}$ into one dissipator per eigenvector.`
				},
				{
					from: 'noise',
					to: 'lindblad',
					label: t`$\Lambda \succeq 0$`,
					detail: t`A covariance matrix has non-negative eigenvalues, so the rates $\mu_k$ are non-negative.`
				}
			]
		},
		{
			id: 'master-equation',
			title: 'Derivation of the master equation',
			section: 'Main text Eqs. (4)–(9); SM, Sec. II',
			summary: t`A system $S$ and an ancilla $A$ share one noise on $J^z_S$, $J^z_A$ and their coupling. The correlation matrix has rank one, so the averaged dynamics has a single jump operator. The paper's split into $\hat O_1, \hat O_2, \hat O_\pm$ misses one term.`,
			nodes: [
				{
					id: 'h0',
					title: 'System, ancilla and coupling',
					kind: 'assumption',
					tex: t`H_0 = H_S\otimes\mathbb I_A + \mathbb I_S\otimes H_A + \alpha\,J^z_S\otimes J^z_A`,
					detail: t`$H_S = \eta_S(J^z_S)^2 - \gamma_S J^x_S - \Delta_S J^z_S$ and $H_A = \eta_A (J^z_A)^2 - \Delta_A J^z_A$, with $J^{x,y,z}$ spin-$(d-1)/2$ operators.`,
					ref: 'Eqs. (1), (4)'
				},
				{
					id: 'stoch',
					title: 'One common noise',
					kind: 'assumption',
					tex: t`H_{\rm stoch}(t) = w(t)\,\big(J^z_S\otimes\mathbb I_A + \mathbb I_S\otimes J^z_A + \alpha\,J^z_S\otimes J^z_A\big),\qquad \langle\!\langle w(t)w(s)\rangle\!\rangle = \lambda\,\delta(t-s)`,
					detail: t`Fluctuations of $\Delta_S$, of $\Delta_A$ and of the coupling $\alpha$ are driven by the same noise. Energies are in units of the noise amplitude on $\Delta_S$, which makes $\alpha$ dimensionless.`,
					ref: 'Eqs. (5)–(6)',
					correction: t`The paper writes three noises $w_S, w_A, w_{SA}$ with the coupling noise $\alpha w_{SA}$, and gives Eq. (6) as their correlation matrix. Eq. (6) is only consistent as the covariance of the coefficients $(w_S, w_A, \alpha w_{SA})$; otherwise $\alpha$ is counted twice. It then means $w_S = w_A = w_{SA} = w$.`
				},
				{
					id: 'gksl-import',
					title: 'GKSL from stochastic Hamiltonians',
					kind: 'assumption',
					from: 'gksl-from-stochastic',
					tex: t`\dot\rho = -i[H_0,\rho] + \sum_{ij}\Lambda_{ij}\Big(A_i\rho A_j - \tfrac12\{A_jA_i,\rho\}\Big)`,
					detail: t`The result of derivation 1, for noises $w_i$ on commuting operators $A_i$.`,
					ref: 'Eq. (30)'
				},
				{
					id: 'operators',
					title: 'Operators and correlation matrix',
					kind: 'step',
					tex: t`A_1 = J^z_S\otimes\mathbb I_A,\ \ A_2 = \mathbb I_S\otimes J^z_A,\ \ A_3 = J^z_S\otimes J^z_A,\qquad \Lambda = \lambda\begin{pmatrix}1&1&\alpha\\1&1&\alpha\\\alpha&\alpha&\alpha^2\end{pmatrix}`,
					detail: t`The $A_i$ are diagonal in the product $J^z$ basis, so they commute as derivation 1 requires.`,
					ref: 'Eqs. (6), (31)'
				},
				{
					id: 'nine-terms',
					title: 'Nine generator terms',
					kind: 'step',
					tex: t`\mathbb L = \sum_{i,j=1}^3\mathbb L_{ij},\qquad \mathbb L_{ij}\rho = \Lambda_{ij}\Big(A_i\rho A_j - \tfrac12\{A_jA_i,\rho\}\Big)`,
					ref: 'Eqs. (7), (32)–(40)'
				},
				{
					id: 'single-jump',
					title: 'Single jump operator',
					kind: 'result',
					added: true,
					tex: t`\partial_t\rho_{SA} = -i[H_0,\rho_{SA}] + \mathbb M[L]\rho_{SA},\qquad L = \sqrt\lambda\,\big(A_1 + A_2 + \alpha A_3\big)`,
					detail: t`With ${DISSIPATOR}. This is the whole dissipative part, and the form the later derivations use.`
				},
				{
					id: 'paper-split',
					title: "The paper's split, corrected",
					kind: 'result',
					tex: t`\mathbb M[L] = \mathbb M[\hat O_1] + \mathbb M[\hat O_2] + \mathbb M[\hat O_+] - \mathbb M[\hat O_-] - \lambda\alpha^2\,\mathbb M[J^z_S\otimes J^z_A]`,
					detail: t`$\hat O_1 = \sqrt\lambda\,J^z_S\otimes(\mathbb I + \alpha J^z_A)$, $\hat O_2 = \sqrt\lambda\,(\mathbb I + \alpha J^z_S)\otimes J^z_A$, $\hat O_\pm = \sqrt{\lambda/2}\,(A_1 \pm A_2)$. Checked numerically on random states.`,
					ref: 'Eq. (8)',
					correction: t`Eq. (8) and the sentence after Eq. (40) omit the last term. $\hat O_1 = \sqrt\lambda(A_1 + \alpha A_3)$ and $\hat O_2 = \sqrt\lambda(A_2 + \alpha A_3)$ both contain $A_3$, so $\mathbb M[\hat O_1] + \mathbb M[\hat O_2]$ counts $\mathbb L_{33}$ twice.`
				},
				{
					id: 'shift',
					title: 'Shift invariance',
					kind: 'assumption',
					added: true,
					tex: t`\mathbb M[X + c\,\mathbb I] = \mathbb M[X],\qquad c\in\mathbb R,\ X = X^\dagger`,
					detail: t`A lemma. Expanding, the terms linear in $c$ are $c(X\rho + \rho X) - c\{X,\rho\} = 0$, and the $c^2$ terms cancel.`
				},
				{
					id: 'uncoupled',
					title: 'Uncoupled limit',
					kind: 'result',
					tex: t`\alpha = 0:\qquad \partial_t\rho_S = -i[H_S,\rho_S] + \lambda\,\mathbb M[J^z_S]\,\rho_S`,
					detail: t`For an ancilla state diagonal in $J^z_A$, the system alone dephases at rate $\lambda$, which is the starting point of the paper.`,
					ref: 'Eq. (2)'
				}
			],
			edges: [
				{
					from: 'stoch',
					to: 'operators',
					label: 'read off the coefficients',
					detail: t`The coefficient vector of $(A_1, A_2, A_3)$ is $w(t)\,(1, 1, \alpha)$, so $\Lambda = \lambda\,\mathbf v\mathbf v^\top$ with $\mathbf v = (1, 1, \alpha)$.`
				},
				{
					from: 'gksl-import',
					to: 'nine-terms',
					label: t`apply with $n = 3$`,
					detail: t`Each pair $(i, j)$ gives one term $\mathbb L_{ij}$.`
				},
				{
					from: 'operators',
					to: 'nine-terms',
					label: t`insert $A_i$ and $\Lambda$`,
					detail: t`Eqs. (32)–(40) write out the nine terms explicitly.`
				},
				{
					from: 'nine-terms',
					to: 'single-jump',
					label: 'Λ has rank one',
					detail: t`$\sum_{ij} v_iv_j\big(A_i\rho A_j - \tfrac12\{A_jA_i,\rho\}\big) = \mathbb M\big[\sum_i v_iA_i\big]\rho$ for real $v$ and self-adjoint, commuting $A_i$.`
				},
				{
					from: 'h0',
					to: 'single-jump',
					label: 'coherent part',
					detail: t`The deterministic Hamiltonian gives $-i[H_0, \rho_{SA}]$.`
				},
				{
					from: 'single-jump',
					to: 'paper-split',
					label: 'regroup the nine terms',
					detail: t`$\mathbb M[\hat O_1] = \mathbb L_{11} + \mathbb L_{13} + \mathbb L_{31} + \mathbb L_{33}$, $\mathbb M[\hat O_2] = \mathbb L_{22} + \mathbb L_{23} + \mathbb L_{32} + \mathbb L_{33}$ and $\mathbb M[\hat O_+] - \mathbb M[\hat O_-] = \mathbb L_{12} + \mathbb L_{21}$; one $\mathbb L_{33} = \lambda\alpha^2\mathbb M[A_3]$ is left over.`
				},
				{
					from: 'single-jump',
					to: 'uncoupled',
					label: t`block $|m\rangle$: $L \to \sqrt\lambda(J^z_S + m)$`,
					detail: t`With $\alpha = 0$ the ancilla populations are conserved. On the block $|m\rangle\langle m|$ the jump operator acts as $\sqrt\lambda\,(J^z_S + m)$.`
				},
				{
					from: 'shift',
					to: 'uncoupled',
					label: 'drop the constant m',
					detail: t`$\mathbb M[J^z_S + m] = \mathbb M[J^z_S]$, the same in every block, so tracing out $A$ leaves rate $\lambda$.`
				}
			]
		},
		{
			id: 'dark-state',
			title: 'Dark-state cancellation',
			section: 'Main text, Eqs. (9)–(14)',
			summary: t`With the ancilla in a $J^z_A$ eigenstate $|\ell\rangle$, the noise on the coupling cancels the noise on the system when $\alpha = -1/\ell$, and the system evolves unitarily. Two routes: the master equation, and single noise trajectories.`,
			nodes: [
				{
					id: 'master',
					title: 'S+A master equation',
					kind: 'assumption',
					from: 'master-equation',
					tex: t`\partial_t\rho_{SA} = -i[H_0,\rho_{SA}] + \mathbb M[L]\rho_{SA},\qquad L = \sqrt\lambda\,\big(J^z_S\otimes\mathbb I + \mathbb I\otimes J^z_A + \alpha\,J^z_S\otimes J^z_A\big)`,
					detail: t`The single-jump form from derivation 2.`
				},
				{
					id: 'fock',
					title: 'Ancilla in a Fock state',
					kind: 'assumption',
					tex: t`\rho_{SA} = \rho_S\otimes P^\ell_A,\qquad P^\ell_A = |\ell\rangle\langle\ell|,\qquad J^z_A P^\ell_A = P^\ell_A J^z_A = \ell\,P^\ell_A`,
					detail: t`In the double-well picture, $|\ell\rangle$ has a fixed number of bosons in each well. Any $\ell \neq 0$ works.`,
					ref: 'Eq. (10)'
				},
				{
					id: 'conserved',
					title: 'Ancilla populations conserved',
					kind: 'assumption',
					added: true,
					tex: t`[H_0,\ \mathbb I_S\otimes J^z_A] = 0`,
					detail: t`True for $H_A$ of Eq. (4), which has no $J^x_A$ term (no ancilla tunnelling). It keeps $\rho_S\otimes P^\ell_A$ in the same block at all times.`
				},
				{
					id: 'shift',
					title: 'Shift invariance',
					kind: 'assumption',
					from: 'master-equation',
					tex: t`\mathbb M[X + c\,\mathbb I] = \mathbb M[X],\qquad c\in\mathbb R`
				},
				{
					id: 'block-jump',
					title: 'Jump operator on the block',
					kind: 'step',
					added: true,
					tex: t`L\,(\rho_S\otimes P^\ell_A) = (L_\ell\,\rho_S)\otimes P^\ell_A,\qquad L_\ell = \sqrt\lambda\,\big[(1 + \alpha\ell)\,J^z_S + \ell\big]`
				},
				{
					id: 'rate',
					title: 'Residual dephasing for any α',
					kind: 'result',
					added: true,
					tex: t`\mathbb M[L]\,(\rho_S\otimes P^\ell_A) = \lambda\,(1 + \alpha\ell)^2\ \mathbb M[J^z_S]\,\rho_S\otimes P^\ell_A`,
					detail: t`The system dephases at rate $\lambda(1+\alpha\ell)^2$, quadratic in the detuning of $\alpha$ from its optimum. This is why the fidelity peaks in the paper's Fig. 3 are smooth and robust. Checked numerically.`
				},
				{
					id: 'tune',
					title: 'Tune the coupling',
					kind: 'step',
					tex: t`\alpha_c = -\frac1\ell`,
					detail: t`The rate vanishes. The coupling has to match the ancilla state, or equivalently the ancilla state the coupling.`,
					ref: 'Text before Eq. (10)'
				},
				{
					id: 'coherent',
					title: 'Coherent part on the block',
					kind: 'step',
					tex: t`-i[H_0,\ \rho_S\otimes P^\ell_A] = -i\big[H_S + \alpha\ell\,J^z_S,\ \rho_S\big]\otimes P^\ell_A`,
					detail: t`The coupling becomes a shift $\alpha\ell J^z_S$ of the system's detuning; $H_A$ commutes with $P^\ell_A$.`,
					ref: 'Eq. (10)'
				},
				{
					id: 'unitary',
					title: 'Unitary system dynamics',
					kind: 'result',
					tex: t`e^{t\mathbb L}(\rho_S\otimes P^\ell_A) = e^{-itH^{\rm eff}_S}\rho_S\,e^{itH^{\rm eff}_S}\otimes P^\ell_A,\qquad H^{\rm eff}_S = H_S - J^z_S`,
					detail: t`For every initial system state. The extra $-J^z_S$ is a known detuning and can be compensated through $\Delta_S$.`,
					ref: 'Eqs. (13)–(14)',
					correction: t`Eq. (13) writes $H_0 - J^z_S$; it is $H_S - J^z_S$, as in Eq. (14). Eq. (11) states that $\mathbb M[\hat O_2]$ vanishes on this state; it equals $\lambda\,\mathbb M[J^z_S]\rho_S\otimes P^\ell_A$ and is cancelled by the $-\lambda\alpha^2\,\mathbb M[J^z_S\otimes J^z_A]$ missing from Eq. (8) (derivation 2).`
				},
				{
					id: 'three-noises',
					title: 'Noisy Hamiltonian, any statistics',
					kind: 'assumption',
					tex: t`H_{\rm stoch}(t) = w_S(t)\,J^z_S\otimes\mathbb I + w_A(t)\,\mathbb I\otimes J^z_A + \alpha\,w_{SA}(t)\,J^z_S\otimes J^z_A`,
					detail: t`No assumption on the noise statistics here: Markovian or not.`,
					ref: 'Eq. (5)'
				},
				{
					id: 'trajectory',
					title: 'One trajectory',
					kind: 'step',
					tex: t`H_{\rm stoch}(t)\,|\psi\rangle|\ell\rangle = \Big(\big[w_S(t) + \alpha\ell\,w_{SA}(t)\big]J^z_S + \ell\,w_A(t)\Big)|\psi\rangle|\ell\rangle`,
					ref: 'Text after Eq. (5)'
				},
				{
					id: 'global-phase',
					title: 'Noise is a global phase',
					kind: 'step',
					tex: t`w_{SA} = w_S,\ \ \alpha = -\frac1\ell:\qquad H_{\rm stoch}(t)\,|\psi\rangle|\ell\rangle = \ell\,w_A(t)\,|\psi\rangle|\ell\rangle`,
					detail: t`What remains multiplies the whole state, so it is a global phase and has no effect on any density matrix. $w_A$ never matters.`,
					ref: 'Text after Eq. (5)'
				}
			],
			edges: [
				{
					from: 'master',
					to: 'block-jump',
					label: 'act on the block',
					detail: t`Apply each term of $L$ to $\rho_S\otimes P^\ell_A$.`
				},
				{
					from: 'fock',
					to: 'block-jump',
					label: t`$J^z_A \to \ell$`,
					detail: t`$J^z_A P^\ell_A = \ell P^\ell_A$, so $J^z_S\otimes J^z_A \to \ell\,J^z_S$ and $\mathbb I\otimes J^z_A \to \ell$.`
				},
				{
					from: 'block-jump',
					to: 'rate',
					label: t`expand $\mathbb M[L]$`,
					detail: t`$\mathbb M[L](\rho_S\otimes P^\ell_A) = \mathbb M[L_\ell]\rho_S\otimes P^\ell_A$, since $P^\ell_A$ is a projector and $L$ commutes with it.`
				},
				{
					from: 'shift',
					to: 'rate',
					label: t`drop the constant $\ell$`,
					detail: t`$\mathbb M[(1+\alpha\ell)J^z_S + \ell] = (1+\alpha\ell)^2\,\mathbb M[J^z_S]$.`
				},
				{
					from: 'rate',
					to: 'tune',
					label: 'set the rate to zero',
					detail: t`$1 + \alpha\ell = 0$.`
				},
				{
					from: 'fock',
					to: 'coherent',
					label: t`$J^z_A \to \ell$`,
					detail: t`$\alpha J^z_S\otimes J^z_A$ acts as $\alpha\ell J^z_S$ on the block.`
				},
				{
					from: 'conserved',
					to: 'coherent',
					label: t`$[H_A, P^\ell_A] = 0$`,
					detail: t`The ancilla Hamiltonian only gives a phase on $|\ell\rangle$.`
				},
				{
					from: 'tune',
					to: 'unitary',
					label: 'no dissipator',
					detail: t`At $\alpha_c$ the generator on the block is purely Hamiltonian.`
				},
				{
					from: 'coherent',
					to: 'unitary',
					label: t`$\alpha\ell = -1$`,
					detail: t`$H_S + \alpha_c\ell\,J^z_S = H_S - J^z_S$.`
				},
				{
					from: 'conserved',
					to: 'unitary',
					label: 'block is invariant',
					detail: t`The state stays of the form $\rho_S(t)\otimes P^\ell_A$, so the block generator applies at all times.`
				},
				{
					from: 'three-noises',
					to: 'trajectory',
					label: t`act on $|\psi\rangle|\ell\rangle$`,
					detail: t`Pure-state version of the same calculation, before any averaging.`
				},
				{
					from: 'fock',
					to: 'trajectory',
					label: t`$J^z_A|\ell\rangle = \ell|\ell\rangle$`
				},
				{
					from: 'trajectory',
					to: 'global-phase',
					label: 'perfectly correlated noise',
					detail: t`If the coupling noise follows the system noise, the $J^z_S$ coefficient vanishes at every instant. The paper allows $w_{SA} = c_{SA}w_S$, which moves the optimum to $\alpha = -1/(\ell c_{SA})$.`
				},
				{
					from: 'global-phase',
					to: 'unitary',
					label: 'holds for every realisation',
					detail: t`Each trajectory evolves with $H_S - J^z_S$ up to a phase, so the result does not depend on the noise spectrum: white, coloured or $1/f$ (derivation 8).`
				}
			]
		},
		{
			id: 'physical-implementation',
			title: 'Physical implementation: a Bose–Hubbard plaquette',
			section: 'SM, Sec. III',
			summary: t`Two double wells with cavity-mediated long-range interaction map, through Schwinger bosons, onto the spin Hamiltonian of the protocol. Noise on the chemical potentials and on the interaction gives the required noise terms, plus an extra one, $K_{SA}$, treated in derivation 5.`,
			nodes: [
				{
					id: 'ebh',
					title: 'Extended Bose–Hubbard model',
					kind: 'assumption',
					tex: t`H = -t\sum_{\langle e,o\rangle}\big(b^\dagger_eb_o + {\rm h.c.}\big) + \frac{U_s}2\sum_i n_i(n_i-1) - \frac{U_1}K\Big(\sum_e n_e - \sum_o n_o\Big)^2 - \sum_i\mu_in_i`,
					detail: t`Bosons in a lattice inside an optical cavity: tunnelling $t$, on-site repulsion $U_s$, a cavity-mediated infinite-range interaction $U_1$ between even ($e$) and odd ($o$) sites, and site energies $\mu_i$. $K$ is the number of sites.`,
					ref: 'Eq. (41)'
				},
				{
					id: 'plaquette',
					title: 'Four-site plaquette',
					kind: 'step',
					tex: t`K = 4:\ \ \text{sites } SL, SR, AL, AR;\qquad N \text{ bosons in each double well};\qquad t_A = 0`,
					detail: t`One double well is the system, the other the ancilla. Left sites are even, right sites odd. Ancilla tunnelling is switched off, as the protocol needs.`,
					ref: 'Eq. (42), Fig. 4'
				},
				{
					id: 'schwinger',
					title: 'Schwinger bosons',
					kind: 'step',
					tex: t`n_{iL} = \tfrac N2 - J^z_i,\quad n_{iR} = \tfrac N2 + J^z_i,\quad J^x_i = \tfrac12\big(b^\dagger_{iR}b_{iL} + b^\dagger_{iL}b_{iR}\big)`,
					detail: t`Each double well with $N$ bosons is a spin $N/2$. $|\ell\rangle$ has $N/2 - \ell$ bosons on the left and $N/2 + \ell$ on the right.`,
					ref: 'After Eq. (42)'
				},
				{
					id: 'tunnelling',
					title: 'Tunnelling',
					kind: 'step',
					tex: t`-t_i\big(b^\dagger_{iR}b_{iL} + {\rm h.c.}\big) = -\gamma_i\,J^x_i,\qquad \gamma_i = 2t_i`
				},
				{
					id: 'onsite',
					title: 'On-site interaction',
					kind: 'step',
					tex: t`\tfrac{U_s}2\big[n_{iL}(n_{iL}-1) + n_{iR}(n_{iR}-1)\big] = U_s\,(J^z_i)^2 + \text{const}`,
					detail: t`$n_L^2 + n_R^2 = N^2/2 + 2(J^z)^2$ and $n_L + n_R = N$.`
				},
				{
					id: 'chemical',
					title: 'Site energies',
					kind: 'step',
					tex: t`-\big(\mu_{iL}n_{iL} + \mu_{iR}n_{iR}\big) = -\Delta_i\,J^z_i + \text{const},\qquad \Delta_i = \mu_{iR} - \mu_{iL}`
				},
				{
					id: 'long-range',
					title: 'Cavity-mediated interaction',
					kind: 'step',
					tex: t`-\frac{U_1}4\big(n_{SR} + n_{AR} - n_{SL} - n_{AL}\big)^2 = -U_1\,\big(J^z_S + J^z_A\big)^2`,
					detail: t`The population imbalance of the plaquette is $2(J^z_S + J^z_A)$.`,
					correction: t`Eq. (42) has $+U_1/4$, which contradicts Eq. (41) and the definition $\alpha = -2U_1$ used to reach Eq. (43). The sign here follows Eq. (41).`
				},
				{
					id: 'spin-h',
					title: 'Spin Hamiltonian',
					kind: 'result',
					tex: t`H_{SA} = \sum_{i=S,A}\Big[-\gamma_iJ^x_i - \Delta_iJ^z_i + \big(\eta + \tfrac\alpha2\big)(J^z_i)^2\Big] + \alpha\,J^z_S J^z_A,\qquad \eta = U_s,\ \alpha = -2U_1`,
					detail: t`The protocol's $H_0$, plus an extra $\tfrac\alpha2(J^z_i)^2$ from the long-range term.`,
					ref: 'Eq. (43)'
				},
				{
					id: 'noise',
					title: 'Noisy site energies and coupling',
					kind: 'assumption',
					tex: t`\mu_{iR}\to\mu_{iR} - \tfrac{w_i}2,\quad \mu_{iL}\to\mu_{iL} + \tfrac{w_i}2,\qquad \alpha\to\alpha\,\big(1 + w_{SA}\big)`,
					detail: t`So $\Delta_i \to \Delta_i - w_i$, which adds $+w_iJ^z_i$ to the Hamiltonian, as in Eq. (5).`,
					ref: 'Eqs. (44)–(46)',
					correction: t`Eq. (44) uses the opposite signs, which gives $-w_iJ^z_i$ while Eq. (47) writes $+w_iJ^z_i$. Only the relative sign of $w_S$ and $w_{SA}$ matters: with the paper's signs, cancellation needs $w_{SA} = -w_S$.`
				},
				{
					id: 'noisy-h',
					title: 'Noisy plaquette Hamiltonian',
					kind: 'result',
					tex: t`H_{SA}(t) = H_{SA} + w_SJ^z_S + w_AJ^z_A + \alpha\,w_{SA}\Big[J^z_SJ^z_A + \tfrac12\big((J^z_S)^2 + (J^z_A)^2\big)\Big]`,
					ref: 'Eq. (47)'
				},
				{
					id: 'square',
					title: 'Coupling noise is a perfect square',
					kind: 'result',
					added: true,
					tex: t`\alpha\,w_{SA}\Big[J^z_SJ^z_A + \tfrac12\big((J^z_S)^2 + (J^z_A)^2\big)\Big] = \frac\alpha2\,w_{SA}\,\big(J^z_S + J^z_A\big)^2`,
					detail: t`The coupling noise is the noise of $-U_1(J^z_S + J^z_A)^2$. The extra part beyond $\alpha w_{SA}J^z_SJ^z_A$ is the paper's $K_{SA}$ (derivation 5).`
				}
			],
			edges: [
				{
					from: 'ebh',
					to: 'plaquette',
					label: 'restrict to two double wells',
					detail: t`$U_1/K = U_1/4$.`
				},
				{
					from: 'plaquette',
					to: 'schwinger',
					label: 'fixed N per double well',
					detail: t`Tunnelling only within each double well conserves $N$ in each, so each is an $\mathfrak{su}(2)$ spin.`
				},
				{
					from: 'schwinger',
					to: 'tunnelling',
					label: t`$J^x = \tfrac12(b^\dagger_R b_L + {\rm h.c.})$`
				},
				{ from: 'schwinger', to: 'onsite', label: t`$n_{L,R} = N/2 \mp J^z$` },
				{ from: 'schwinger', to: 'chemical', label: t`$n_{L,R} = N/2 \mp J^z$` },
				{
					from: 'schwinger',
					to: 'long-range',
					label: t`$n_R - n_L = 2J^z$`,
					detail: t`$n_{SR} + n_{AR} - n_{SL} - n_{AL} = 2J^z_S + 2J^z_A$.`
				},
				{ from: 'tunnelling', to: 'spin-h', label: 'collect' },
				{ from: 'onsite', to: 'spin-h', label: t`$\eta = U_s$` },
				{ from: 'chemical', to: 'spin-h', label: 'collect' },
				{
					from: 'long-range',
					to: 'spin-h',
					label: 'expand the square',
					detail: t`$-U_1(J^z_S + J^z_A)^2 = -U_1\big((J^z_S)^2 + (J^z_A)^2\big) - 2U_1 J^z_SJ^z_A$; with $\alpha = -2U_1$ this is $\tfrac\alpha2\big((J^z_S)^2 + (J^z_A)^2\big) + \alpha J^z_SJ^z_A$.`
				},
				{
					from: 'spin-h',
					to: 'noisy-h',
					label: 'perturb the parameters',
					detail: t`$\alpha$ appears in both the $J^z_SJ^z_A$ and the $(J^z_i)^2$ terms, so its noise multiplies both.`
				},
				{
					from: 'noise',
					to: 'noisy-h',
					label: t`$\Delta_i \to \Delta_i - w_i$`,
					detail: t`From Eqs. (44)–(46).`,
					ref: 'Eq. (45)'
				},
				{
					from: 'noisy-h',
					to: 'square',
					label: 'complete the square',
					detail: t`$J^z_SJ^z_A + \tfrac12\big((J^z_S)^2 + (J^z_A)^2\big) = \tfrac12(J^z_S + J^z_A)^2$.`
				}
			]
		},
		{
			id: 'case-study',
			title: 'Case study: residual dissipation from K_SA',
			section: 'SM, Sec. III.1',
			summary: t`In the plaquette, the coupling noise also multiplies $(J^z_S)^2 + (J^z_A)^2$. At $\alpha = -1/\ell$ this leaves a residual dephasing $\tfrac{\lambda}{4\ell^2}\mathbb M[(J^z_S)^2]$, which spares NOON states and every qubit state.`,
			nodes: [
				{
					id: 'noisy-h',
					title: 'Noisy plaquette Hamiltonian',
					kind: 'assumption',
					from: 'physical-implementation',
					tex: t`H_{SA}(t) = H_{SA} + w_SJ^z_S + w_AJ^z_A + \frac\alpha2\,w_{SA}\big(J^z_S + J^z_A\big)^2`,
					detail: t`From derivation 4, with $\gamma_A = 0$.`,
					ref: 'Eqs. (47)–(49)'
				},
				{
					id: 'common',
					title: 'Common white noise',
					kind: 'assumption',
					tex: t`w_S = w_A = w_{SA} = w,\qquad \langle\!\langle w(t)w(s)\rangle\!\rangle = \lambda\,\delta(t-s)`,
					detail: t`The noise correlations of Eq. (6).`
				},
				{
					id: 'jump',
					title: 'Single jump operator',
					kind: 'step',
					tex: t`L = \sqrt\lambda\,\Big[X + \frac\alpha2X^2\Big],\qquad X = J^z_S\otimes\mathbb I_A + \mathbb I_S\otimes J^z_A`,
					ref: 'Eqs. (49)–(52)',
					correction: t`The paper keeps $\hat O_1, \hat O_2$ and adds a separate $\mathbb M[\hat O_3]$ for $K_{SA}$; Eqs. (50)–(52) have mislabelled operators (the second line repeats $K_{SA}J^z_S$ where $J^z_A$ belongs). The single jump operator here is exact.`
				},
				{
					id: 'fock',
					title: 'Ancilla in a Fock state',
					kind: 'assumption',
					tex: t`\rho_{SA} = \rho_S\otimes P^\ell_A,\qquad J^z_AP^\ell_A = \ell\,P^\ell_A`
				},
				{
					id: 'shift',
					title: 'Shift invariance',
					kind: 'assumption',
					from: 'master-equation',
					tex: t`\mathbb M[X + c\,\mathbb I] = \mathbb M[X],\qquad c\in\mathbb R`
				},
				{
					id: 'block',
					title: 'Jump operator on the block',
					kind: 'step',
					added: true,
					tex: t`L_\ell = \sqrt\lambda\,\Big[(1 + \alpha\ell)\,J^z_S + \frac\alpha2(J^z_S)^2 + \ell + \frac\alpha2\ell^2\Big]`,
					detail: t`$X \to J^z_S + \ell$ on the block.`
				},
				{
					id: 'residual',
					title: 'Residual dephasing',
					kind: 'result',
					added: true,
					tex: t`\alpha = -\frac1\ell:\qquad \mathbb M[L]\,(\rho_S\otimes P^\ell_A) = \frac{\lambda}{4\ell^2}\,\mathbb M\big[(J^z_S)^2\big]\rho_S\otimes P^\ell_A`,
					detail: t`The linear noise cancels, the quadratic one does not. $\mathbb M[(J^z_S)^2]$ damps coherences between $|m\rangle$ and $|m'\rangle$ at rate $\tfrac{\lambda}{8\ell^2}(m^2 - m'^2)^2$, so states with equal $|m|$ keep their coherence. Checked numerically.`,
					correction: t`The paper only states that $\mathbb M[\hat O_3]$ does not vanish; this is its exact value.`
				},
				{
					id: 'noon',
					title: 'NOON states are spared',
					kind: 'result',
					tex: t`(J^z_S)^2\,|\Psi^\pm_S\rangle = \frac{N^2}4\,|\Psi^\pm_S\rangle\ \Rightarrow\ \mathbb M\big[(J^z_S)^2\big]\,|\Psi^\pm_S\rangle\langle\Psi^\pm_S| = 0`,
					detail: t`$|\Psi^\pm_S\rangle = (|N,0\rangle \pm |0,N\rangle)/\sqrt2$ lives in $m = \pm N/2$. Tunnelling ($\gamma_S \neq 0$) moves population out of $|m| = N/2$, where the residual term acts; with $\gamma_S = 0$ the protection is exact.`,
					ref: 'Text after Eq. (52)'
				},
				{
					id: 'qubit',
					title: 'Qubits: every state is spared',
					kind: 'result',
					tex: t`N = 1:\qquad (J^z_S)^2 = \tfrac14\,\mathbb I\ \Rightarrow\ \mathbb M\big[(J^z_S)^2\big] = 0`,
					ref: 'Text after Eq. (52)'
				},
				{
					id: 'heff',
					title: 'Effective Hamiltonian',
					kind: 'result',
					added: true,
					tex: t`H^{\rm eff}_S = -\gamma_SJ^x_S - (\Delta_S + 1)\,J^z_S + \Big(\eta - \frac1{2\ell}\Big)(J^z_S)^2`,
					detail: t`$H_{SA}$ on the block at $\alpha = -1/\ell$, up to a constant. $\Delta_S = -1$ removes the linear term, which is the paper's choice in Fig. 2.`
				}
			],
			edges: [
				{
					from: 'noisy-h',
					to: 'jump',
					label: 'one noise source (derivation 1)',
					detail: t`All noise terms share $w$, so $\Lambda$ has rank one and $L$ is $\sqrt\lambda$ times the operator multiplying $w$.`
				},
				{ from: 'common', to: 'jump', label: 'rank-one Λ' },
				{ from: 'jump', to: 'block', label: t`$X \to J^z_S + \ell$` },
				{ from: 'fock', to: 'block', label: t`$J^z_A \to \ell$` },
				{
					from: 'block',
					to: 'residual',
					label: t`$1 + \alpha\ell = 0$`,
					detail: t`What is left is $\sqrt\lambda\big[-\tfrac1{2\ell}(J^z_S)^2 + \text{const}\big]$.`
				},
				{ from: 'shift', to: 'residual', label: 'drop the constant' },
				{
					from: 'residual',
					to: 'noon',
					label: 'equal |m| on both branches',
					detail: t`$|N,0\rangle$ and $|0,N\rangle$ have $m = \mp N/2$, the same $(J^z_S)^2$.`
				},
				{
					from: 'residual',
					to: 'qubit',
					label: 'spin ½',
					detail: t`$\mathbb M[c\,\mathbb I] = 0$.`
				},
				{
					from: 'noisy-h',
					to: 'heff',
					label: 'deterministic part on the block',
					detail: t`$\alpha J^z_SJ^z_A \to \alpha\ell J^z_S = -J^z_S$ and $(\eta + \tfrac\alpha2)(J^z_S)^2$ with $\alpha = -1/\ell$.`
				},
				{ from: 'fock', to: 'heff', label: t`$J^z_A \to \ell$` }
			]
		},
		{
			id: 'laser-noise',
			title: 'Laser-induced noise and the correlation matrix Λ',
			section: 'SM, Sec. III.2',
			summary: t`Intensity noise of one pump laser drives both the site energies and the cavity-mediated coupling, so all noise terms share one source and $\Lambda$ has rank one. The derivation needs unequal light shifts on the two sites of a double well, which the paper does not say.`,
			nodes: [
				{
					id: 'pump',
					title: 'Noisy pump',
					kind: 'assumption',
					tex: t`\Omega(t) = \Omega_0\,\big[1 + \xi(t)\big]\,e^{i\phi_0},\qquad |\xi| \ll 1,\qquad \langle\!\langle \xi(t)\xi(s)\rangle\!\rangle = \lambda\,f(t,s)`,
					detail: t`Intensity fluctuations $\xi$ with any time profile $f$: white ($f = \delta$), coloured, or $1/f$.`,
					ref: 'Eq. (53)'
				},
				{
					id: 'dispersive',
					title: 'Far-detuned parameters',
					kind: 'assumption',
					tex: t`\mu_i \propto \frac{|\Omega_i|^2}{\Delta_a},\qquad U_1 \propto \frac{\eta_p^2}{\Delta_c},\qquad \eta_p = \frac{g\,\Omega}{\Delta_a}`,
					detail: t`$\Delta_a$ is the atomic detuning, $\Delta_c$ the cavity detuning, $g$ the atom–cavity coupling. The light shift and the cavity-mediated interaction are both proportional to the pump intensity $|\Omega|^2$.`,
					ref: 'Eqs. (54)–(55)',
					correction: t`Eq. (54) sets $U_1 = g\Omega/\Delta$, the pump-to-cavity scattering amplitude $\eta_p$. The interaction it mediates is second order in $\eta_p$ (Ritsch et al., Rev. Mod. Phys. 85, 553 (2013)). We write $\Delta_a$ for the atomic detuning to avoid a clash with $\Delta_S$, $\Delta_A$.`
				},
				{
					id: 'imbalance',
					title: 'Unequal light shifts',
					kind: 'assumption',
					added: true,
					tex: t`\delta_i = \frac{|\Omega_{iR}|^2 - |\Omega_{iL}|^2}{\Delta_a} \neq 0`,
					detail: t`$\delta_i$ is the part of the asymmetry $\Delta_i$ that comes from the pump, e.g. with the two sites at different positions in the pump's standing wave.`,
					correction: t`Eqs. (55)–(56) give every site the same light shift, so $\delta\mu_{iR} = \delta\mu_{iL}$ and the asymmetry $\Delta_i = \mu_{iR} - \mu_{iL}$ does not fluctuate: a uniform pump produces no $J^z$ noise at all.`
				},
				{
					id: 'linearise',
					title: 'Linearise in ξ',
					kind: 'step',
					tex: t`\Delta_i \to \Delta_i + 2\,\delta_i\,\xi(t),\qquad \alpha \to \alpha\,\big[1 + 2\,\xi(t)\big]`,
					detail: t`Both are proportional to $|\Omega|^2 \to |\Omega|^2(1 + 2\xi)$, so they share the factor $2\xi$.`,
					ref: 'Eqs. (56)–(57)',
					correction: t`Eq. (57) drops a factor $\Omega_0$: to first order, $U_1 = g\Omega/\Delta$ would give $\delta U_1 = (g\Omega_0/\Delta)\,\xi\,e^{i\phi_0}$.`
				},
				{
					id: 'rank-one',
					title: 'Rank-one correlation matrix',
					kind: 'result',
					tex: t`\Lambda(t,s) = 4\lambda\,f(t,s)\ \mathbf u\mathbf u^{\top},\qquad \mathbf u = \big(-\delta_S,\ -\delta_A,\ \alpha\big)`,
					detail: t`$\mathbf u$ holds the coefficients of $(J^z_S, J^z_A, J^z_SJ^z_A)$ per unit $2\xi$. One noise source makes $\Lambda$ positive semi-definite automatically. The paper's Eq. (6) is the case $-\delta_S = -\delta_A = 1$ in its energy units.`,
					ref: 'Eqs. (58)–(61)',
					correction: t`Eq. (60) defines $\alpha$ as a ratio of noise amplitudes, while elsewhere $\alpha = -2U_1$ is the coupling. Here $\alpha$ is always the coupling, and its noise follows from $U_1 \propto |\Omega|^2$.`
				},
				{
					id: 'dark',
					title: 'Dark condition',
					kind: 'result',
					added: true,
					tex: t`\delta_S = \alpha\,\ell`,
					detail: t`On the block $|\ell\rangle$ the noise on $J^z_S$ is $2\xi(-\delta_S + \alpha\ell)$ (derivation 3). It reduces to $\alpha = -1/\ell$ when $\delta_S = -1$.`
				},
				{
					id: 'compensated',
					title: 'Laser shifts compensate',
					kind: 'result',
					added: true,
					tex: t`H^{\rm eff}_S \ni -\Delta_SJ^z_S + \alpha\ell\,J^z_S = -\big(\Delta_S - \delta_S\big)J^z_S`,
					detail: t`At the dark point, the pump's light-shift asymmetry and the coupling shift cancel, leaving only the asymmetry not caused by the pump. Everything proportional to $|\Omega|^2$ drops out of the $J^z_S$ terms, in the mean and in the noise alike.`
				}
			],
			edges: [
				{ from: 'pump', to: 'linearise', label: t`$|\Omega|^2 \to |\Omega|^2(1 + 2\xi)$` },
				{ from: 'dispersive', to: 'linearise', label: t`$\mu_i, U_1 \propto |\Omega|^2$` },
				{
					from: 'imbalance',
					to: 'linearise',
					label: t`$\Delta_i$ fluctuates through $\delta_i$`,
					detail: t`$\delta\Delta_i = \delta\mu_{iR} - \delta\mu_{iL} = 2\,\delta_i\,\xi$.`
				},
				{
					from: 'linearise',
					to: 'rank-one',
					label: 'one noise source',
					detail: t`The Hamiltonian $-\Delta_iJ^z_i + \alpha J^z_SJ^z_A$ gains $2\xi\,(-\delta_SJ^z_S - \delta_AJ^z_A + \alpha J^z_SJ^z_A)$.`
				},
				{
					from: 'pump',
					to: 'rank-one',
					label: t`$\langle\!\langle\xi\xi\rangle\!\rangle = \lambda f$`
				},
				{
					from: 'rank-one',
					to: 'dark',
					label: t`block $|\ell\rangle$: $J^z_A \to \ell$`,
					detail: t`The $J^z_S$ coefficient becomes $-\delta_S + \alpha\ell$.`
				},
				{ from: 'dark', to: 'compensated', label: t`$\alpha\ell = \delta_S$` }
			]
		},
		{
			id: 'imperfect-ancilla',
			title: 'Robustness to imperfect ancilla preparation',
			section: 'SM, Sec. IV',
			summary: t`An ancilla prepared in a mixture of $J^z_A$ eigenstates gives the system an average dephasing rate $\lambda(\delta^2+\sigma^2)/\ell^2$, as the paper finds. It also spreads the system's precession frequency, an inhomogeneous dephasing the paper leaves out; reading out the ancilla removes it.`,
			nodes: [
				{
					id: 'mixture',
					title: 'Mixed ancilla',
					kind: 'assumption',
					tex: t`\rho_A = \sum_m p_m\,|m\rangle\langle m|,\qquad \sum_m p_m\,m = \ell + \delta,\qquad \sum_m p_m\,(m - \ell - \delta)^2 = \sigma^2`,
					detail: t`Any distribution over $J^z_A$ eigenstates; only its mean and variance enter the average rate.`,
					ref: 'Eqs. (62)–(63)',
					correction: t`The paper indexes the mixture by $n \ge 0$ while $J^z_A$ eigenvalues run from $-N/2$ to $N/2$, and calls the mean $\mu$, which clashes with the chemical potentials. Here $m$ is the $J^z_A$ eigenvalue.`
				},
				{
					id: 'master',
					title: 'S+A master equation',
					kind: 'assumption',
					from: 'master-equation',
					tex: t`\partial_t\rho_{SA} = -i[H_0,\rho_{SA}] + \mathbb M[L]\rho_{SA},\qquad [H_0,\ \mathbb I\otimes J^z_A] = 0`
				},
				{
					id: 'block-rate',
					title: 'Dynamics on one block',
					kind: 'assumption',
					from: 'dark-state',
					tex: t`\partial_t\rho^{(m)}_S = -i\big[H_S + \alpha m\,J^z_S,\ \rho^{(m)}_S\big] + \lambda\,(1 + \alpha m)^2\ \mathbb M[J^z_S]\,\rho^{(m)}_S`,
					detail: t`Derivation 3 with $\ell$ replaced by $m$.`
				},
				{
					id: 'blocks',
					title: 'Blocks evolve independently',
					kind: 'step',
					added: true,
					tex: t`\rho_{SA}(t) = \sum_m p_m\,\rho^{(m)}_S(t)\otimes|m\rangle\langle m|,\qquad \rho_S(t) = \sum_m p_m\,\rho^{(m)}_S(t)`,
					detail: t`Exact: the generator never mixes ancilla blocks. The reduced state is a mixture of block evolutions, not the solution of one master equation.`
				},
				{
					id: 'average-rate',
					title: 'Average residual rate',
					kind: 'result',
					tex: t`\alpha = -\frac1\ell:\qquad \overline\Gamma = \lambda\sum_m p_m\Big(1 - \frac m\ell\Big)^2 = \lambda\,\frac{\delta^2 + \sigma^2}{\ell^2}`,
					detail: t`Short-time (first-order) dephasing rate of $\rho_S$.`,
					ref: 'Eqs. (67)–(68)',
					correction: t`Eqs. (65)–(66) give block contributions $(1 - \mu/\ell)^2$ and $(\mu^2 + \sigma^2)/\ell^2$ whose sum is not Eq. (68). Eq. (68) is right as the average of the block rates.`
				},
				{
					id: 'coherence',
					title: 'Coherences (γ_S = 0)',
					kind: 'step',
					added: true,
					tex: t`\rho_{kk'}(t) = \rho_{kk'}(0)\,e^{-i\omega_{kk'}t}\sum_m p_m\ e^{-i\alpha m(k-k')t}\ e^{-\frac\lambda2(1+\alpha m)^2(k-k')^2t}`,
					detail: t`For $H_S$ diagonal in $J^z_S$, with $k, k'$ its eigenvalues. Each block shifts the frequency by $\alpha m(k-k')$.`
				},
				{
					id: 'inhomogeneous',
					title: 'Inhomogeneous dephasing',
					kind: 'result',
					added: true,
					tex: t`|\rho_{kk'}(t)| \approx |\rho_{kk'}(0)|\ \exp\!\Big[-\frac{\sigma^2}{2\ell^2}(k-k')^2\,t^2\Big]\ \exp\!\Big[-\frac{\overline\Gamma}2(k-k')^2\,t\Big]`,
					detail: t`For a Gaussian $p_m$ at $\alpha = -1/\ell$, to leading order in $\sigma$; $t$ in the energy units of derivation 2. Since $J^z_A$ is conserved, measuring the ancilla at the end tells which block occurred and removes this term.`,
					correction: t`Not in the paper, whose effective master equation (67) keeps only $\overline\Gamma$. It outgrows the $\overline\Gamma$ term after $t \approx \lambda(\delta^2 + \sigma^2)/\sigma^2$, so for long storage times it is the main loss.`
				},
				{
					id: 'estimate',
					title: 'Tweezer estimate',
					kind: 'result',
					tex: t`\ell = \tfrac12,\ \lambda = 0.1\,{\rm s^{-1}},\ \delta = 0.01,\ \sigma^2 = 1.5\times10^{-4}:\qquad \overline\Gamma = 1.0\times10^{-4}\,{\rm s^{-1}},\quad 1/\overline\Gamma \approx 2.8\,{\rm h}`,
					ref: 'Eqs. (69)–(70)',
					correction: t`The paper gets $8\times10^{-5}\,{\rm s^{-1}}$ and $3.5$ h, but $0.1\times(10^{-4} + 1.5\times10^{-4})/0.25 = 1.0\times10^{-4}\,{\rm s^{-1}}$. It also defines $\tau = 1/(\varepsilon\,\Gamma)$ but evaluates $1/\Gamma$.`
				}
			],
			edges: [
				{
					from: 'mixture',
					to: 'blocks',
					label: t`$\rho_A$ diagonal`,
					detail: t`Each term $p_m\,\rho_S\otimes|m\rangle\langle m|$ evolves on its own.`
				},
				{ from: 'master', to: 'blocks', label: t`$J^z_A$ conserved` },
				{ from: 'block-rate', to: 'blocks', label: 'evolve each block' },
				{
					from: 'blocks',
					to: 'average-rate',
					label: 'average the block rates',
					detail: t`$\sum_m p_m(1 - m/\ell)^2 = \big[(\ell - \bar m)^2 + \sigma^2\big]/\ell^2$ with $\bar m = \ell + \delta$.`
				},
				{
					from: 'mixture',
					to: 'average-rate',
					label: t`mean $\ell + \delta$, variance $\sigma^2$`
				},
				{
					from: 'blocks',
					to: 'coherence',
					label: 'solve each block',
					detail: t`$\mathbb M[J^z_S]$ damps $\rho_{kk'}$ at rate $\tfrac12(k-k')^2$; the Hamiltonian adds a phase.`
				},
				{
					from: 'coherence',
					to: 'inhomogeneous',
					label: 'Gaussian average of the phases',
					detail: t`$\sum_m p_m e^{-i\alpha m x} \approx e^{-i\alpha\bar m x}e^{-\alpha^2\sigma^2x^2/2}$ with $x = (k-k')t$ and $\alpha^2 = 1/\ell^2$.`
				},
				{ from: 'average-rate', to: 'inhomogeneous', label: 'slow part' },
				{ from: 'average-rate', to: 'estimate', label: 'insert numbers' }
			]
		},
		{
			id: 'generic-noise',
			title: 'Decoherence cancellation for generic noise',
			section: 'SM, Sec. V',
			summary: t`For noise with any time profile, the system feels only the combination $\nu_\ell = w_S + \ell\,w_3$. The paper's second-order condition makes its variance zero, which makes $\nu_\ell$ vanish outright: cancellation is exact at all orders, not only at weak coupling.`,
			nodes: [
				{
					id: 'hamiltonian',
					title: 'Three noises, any statistics',
					kind: 'assumption',
					tex: t`H_{SA}(t) = H_0 + w_S(t)\,J^z_S\otimes\mathbb I + w_A(t)\,\mathbb I\otimes J^z_A + w_3(t)\,J^z_S\otimes J^z_A`,
					detail: t`$w_3 = \alpha\,w_{SA}$ is the noise on the coupling.`,
					ref: 'Eq. (5)'
				},
				{
					id: 'fock',
					title: 'Ancilla in a Fock state',
					kind: 'assumption',
					tex: t`J^z_A|\ell\rangle = \ell|\ell\rangle,\qquad [H_0,\ \mathbb I\otimes J^z_A] = 0`
				},
				{
					id: 'block',
					title: 'Action on the block',
					kind: 'step',
					tex: t`H_{SA}(t)\,|\psi\rangle|\ell\rangle = \Big(\big[H^{(\ell)}_S + \nu_\ell(t)\,J^z_S + \ell\,w_A(t)\big]|\psi\rangle\Big)|\ell\rangle,\qquad \nu_\ell = w_S + \ell\,w_3`,
					detail: t`$H^{(\ell)}_S = H_S + \alpha\ell J^z_S$ up to a constant. Every ancilla-only noise is a global phase.`,
					ref: 'Text before Eq. (71)'
				},
				{
					id: 'exact',
					title: 'Exact system dynamics',
					kind: 'step',
					added: true,
					tex: t`i\,\partial_t|\psi(t)\rangle = \big[H^{(\ell)}_S + \nu_\ell(t)\,J^z_S\big]\,|\psi(t)\rangle`,
					detail: t`Up to a global phase, for every noise realisation. The system dephases only through $\nu_\ell$.`
				},
				{
					id: 'second-order',
					title: 'Second-order generator',
					kind: 'step',
					tex: t`\langle\!\langle[H_{SA}(t),[H_{SA}(t'),\rho_{SA}]]\rangle\!\rangle = [H_0,[H_0,\rho_{SA}]] + C_\ell(t,t')\,[J^z_S,[J^z_S,\rho_S]]\otimes P^\ell_A`,
					detail: t`The weak-coupling (second-order cumulant) treatment used by the paper.`,
					ref: 'Eqs. (71)–(72)'
				},
				{
					id: 'correlator',
					title: 'Correlator',
					kind: 'step',
					tex: t`C_\ell(t,t') = \langle\!\langle \nu_\ell(t)\,\nu_\ell(t')\rangle\!\rangle`,
					ref: 'Eq. (72)'
				},
				{
					id: 'profile',
					title: 'Common time profile',
					kind: 'assumption',
					tex: t`\langle\!\langle w_a(t)\,w_b(t')\rangle\!\rangle = \lambda_{ab}\,f(t,t'),\qquad a, b \in \{S, 3\}`,
					detail: t`All correlations share one function $f$, which can be white, coloured or $1/f$.`,
					ref: 'Eqs. (73)–(75)'
				},
				{
					id: 'condition',
					title: 'Cancellation condition',
					kind: 'result',
					tex: t`\lambda_S + 2\ell\,\lambda_{S3} + \ell^2\,\lambda_{33} = 0`,
					detail: t`Then $C_\ell \equiv 0$. Since $\lambda_{ab}$ is positive semi-definite, this needs $w_S$ and $w_3$ perfectly correlated, with $(1, \ell)$ in the kernel of $\lambda_{ab}$.`,
					ref: 'Eq. (76)'
				},
				{
					id: 'rank-one',
					title: 'The protocol’s noise',
					kind: 'result',
					tex: t`\lambda_S = \lambda,\ \ \lambda_{S3} = \lambda\alpha,\ \ \lambda_{33} = \lambda\alpha^2:\qquad \lambda\,(1 + \alpha\ell)^2 = 0\ \Leftrightarrow\ \alpha = -\frac1\ell`,
					ref: 'Text after Eq. (76)'
				},
				{
					id: 'vanishes',
					title: 'Zero variance, zero noise',
					kind: 'result',
					added: true,
					tex: t`C_\ell(t,t) = \langle\!\langle \nu_\ell(t)^2\rangle\!\rangle = 0\ \Rightarrow\ \nu_\ell(t) = 0\ \text{almost surely}`,
					detail: t`A real random variable with zero second moment is zero.`
				},
				{
					id: 'cancelled',
					title: 'Exact cancellation',
					kind: 'result',
					tex: t`i\,\partial_t|\psi(t)\rangle = H^{(\ell)}_S\,|\psi(t)\rangle`,
					detail: t`For any noise statistics and spectrum, Gaussian or not, at all orders.`,
					correction: t`The paper derives the condition at lowest order in the weak-coupling regime only. Because it forces $\nu_\ell = 0$, the cancellation is exact.`
				}
			],
			edges: [
				{ from: 'hamiltonian', to: 'block', label: t`act on $|\psi\rangle|\ell\rangle$` },
				{ from: 'fock', to: 'block', label: t`$J^z_A \to \ell$` },
				{
					from: 'block',
					to: 'exact',
					label: t`drop the global phase $\ell w_A$`,
					detail: t`And the block is invariant because $J^z_A$ is conserved.`
				},
				{ from: 'block', to: 'second-order', label: 'expand to 2nd order' },
				{ from: 'second-order', to: 'correlator', label: t`only $\nu_\ell$ survives` },
				{ from: 'correlator', to: 'condition', label: t`$C_\ell = 0$ for all $t, t'$` },
				{
					from: 'profile',
					to: 'condition',
					label: t`$C_\ell = (\lambda_S + 2\ell\lambda_{S3} + \ell^2\lambda_{33})\,f$`
				},
				{ from: 'condition', to: 'rank-one', label: 'insert Eq. (6)' },
				{
					from: 'condition',
					to: 'vanishes',
					label: t`$f(t,t) > 0$`,
					detail: t`At equal times $C_\ell(t,t) = (\lambda_S + 2\ell\lambda_{S3} + \ell^2\lambda_{33})\,f(t,t)$.`
				},
				{ from: 'vanishes', to: 'cancelled', label: t`$\nu_\ell \equiv 0$` },
				{ from: 'exact', to: 'cancelled', label: 'remove the noise term' }
			]
		}
	]
};
