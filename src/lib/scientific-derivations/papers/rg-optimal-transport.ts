import type { Paper } from '../types';

// TeX and prose are raw strings, so backslashes need no escaping.
const t = String.raw;

export const rgOptimalTransport: Paper = {
	id: 'rg-optimal-transport',
	title: 'Renormalization group flow as optimal transport',
	authors: 'J. Cotler and S. Rezchikov',
	venue: 'Phys. Rev. D 108, 025003 (2023)',
	url: 'https://doi.org/10.1103/PhysRevD.108.025003',
	numbering:
		'Equation numbers follow the published version, which numbers per section, e.g. Eq. (3.7); arXiv:2202.11737v3 numbers identically. Units with ħ = 1; t = −log Λ runs towards the IR.',
	derivations: [
		{
			id: 'polchinski',
			title: "Polchinski's equation",
			section: 'Sec. II A 1',
			summary: t`Demanding that correlators below a scale $\Lambda_R$ do not change as the cutoff $\Lambda$ is lowered fixes how the interaction must flow: Polchinski's equation. For the normalised $P_\Lambda = e^{-S_\Lambda}/Z_\Lambda$ it is a functional convection–diffusion equation.`,
			nodes: [
				{
					id: 'partition',
					title: 'Cut-off partition function',
					kind: 'assumption',
					tex: t`Z_\Lambda[J] = \int[d\phi]\,\exp\Big(-\tfrac12\int\!\frac{d^dp}{(2\pi)^d}\Big[\frac{p^2+m^2}{K_\Lambda(p^2)}\,\phi(p)\phi(-p) + J(p)\phi(-p)\Big] - S_{\text{int},\Lambda}[\phi]\Big)`,
					detail: t`$K_\Lambda(p^2)$ is a soft cutoff: about 1 for $p^2 \lesssim \Lambda^2$ and close to, but never exactly, 0 above. The mass $m$ and the couplings in $S_{\text{int},\Lambda}$ are bare. The source vanishes above a scale $\Lambda_R < \Lambda$, and $|m^2| \ll \Lambda_R^2$.`,
					ref: 'Eq. (2.1)'
				},
				{
					id: 'demand',
					title: 'Low-energy physics fixed',
					kind: 'assumption',
					tex: t`-\Lambda\frac{d}{d\Lambda}Z_\Lambda[J] = C_\Lambda\,Z_\Lambda[J]`,
					detail: t`$C_\Lambda$ does not depend on $J$, so every correlator below $\Lambda_R$, a $J$-derivative of $\log Z_\Lambda$, stays the same as $\Lambda$ moves.`,
					ref: 'Eq. (2.2)'
				},
				{
					id: 'expand',
					title: 'Differentiate in Λ',
					kind: 'step',
					tex: t`-\Lambda\frac{dZ_\Lambda}{d\Lambda} = \int[d\phi]\Big(\tfrac12\int\!\frac{d^dp}{(2\pi)^d}\,(p^2+m^2)\,\Lambda\partial_\Lambda K_\Lambda^{-1}\,\phi(p)\phi(-p) + \Lambda\partial_\Lambda S_{\text{int},\Lambda}\Big)\,e^{-S_\Lambda[\phi,J]}`,
					ref: 'Eq. (2.3)'
				},
				{
					id: 'polchinski-eq',
					title: "Polchinski's equation",
					kind: 'result',
					tex: t`-\Lambda\partial_\Lambda S_{\text{int},\Lambda} = \tfrac12\int d^dp\,(2\pi)^d\,\frac{\Lambda\partial_\Lambda K_\Lambda(p^2)}{p^2+m^2}\Big[\frac{\delta^2 S_{\text{int},\Lambda}}{\delta\phi(p)\,\delta\phi(-p)} - \frac{\delta S_{\text{int},\Lambda}}{\delta\phi(p)}\frac{\delta S_{\text{int},\Lambda}}{\delta\phi(-p)}\Big]`,
					detail: t`$\Lambda\partial_\Lambda K_\Lambda$ is peaked at $p^2 \approx \Lambda^2$, so only modes near the cutoff change the interaction: a smearing over distances $\sim 1/\Lambda$. Other choices also satisfy (2.2); they are other RG schemes (derivation 2).`,
					ref: 'Eq. (2.4)'
				},
				{
					id: 'heat',
					title: 'Heat-equation form',
					kind: 'result',
					tex: t`-\Lambda\partial_\Lambda\,e^{-S_{\text{int},\Lambda}} = \tfrac12\int d^dp\,(2\pi)^d\,\frac{\Lambda\partial_\Lambda K_\Lambda(p^2)}{p^2+m^2}\,\frac{\delta^2}{\delta\phi(p)\,\delta\phi(-p)}\,e^{-S_{\text{int},\Lambda}}`,
					ref: 'Eq. (2.5)'
				},
				{
					id: 'constant',
					title: 'Only a constant changes',
					kind: 'result',
					tex: t`-\Lambda\frac{dZ_\Lambda[J]}{d\Lambda} = \Big(-\tfrac12\,\delta^d(0)\int d^dp\,\Lambda\partial_\Lambda\log K_\Lambda(p^2)\Big)\,Z_\Lambda[J]`,
					detail: t`This has the form (2.2). $\delta^d(0)$ is the volume of space, a momentum-space contact term that is finite on a torus. For the free theory, $\log Z_\Lambda = \tfrac12\,\delta^d(0)\int d^dp\,\log K_\Lambda + \text{const}$, which agrees.`,
					ref: 'Eq. (2.6)'
				},
				{
					id: 'prob',
					title: 'Probability functional',
					kind: 'assumption',
					tex: t`P_\Lambda[\phi] = \frac{e^{-S_\Lambda[\phi]}}{Z_\Lambda},\qquad S_\Lambda = S_{\text{free},\Lambda} + S_{\text{int},\Lambda}`,
					ref: 'Sec. II A 1'
				},
				{
					id: 'convection',
					title: 'Convection–diffusion for P',
					kind: 'result',
					tex: t`-\Lambda\frac{dP_\Lambda}{d\Lambda} = \tfrac12\int d^dp\,(2\pi)^d\,\frac{\Lambda\partial_\Lambda K_\Lambda}{p^2+m^2}\,\frac{\delta^2 P_\Lambda}{\delta\phi(p)\,\delta\phi(-p)} \qquad + \int d^dp\,\Lambda\partial_\Lambda\log K_\Lambda\,\frac{\delta}{\delta\phi(p)}\big(\phi(p)\,P_\Lambda\big)`,
					detail: t`Diffusion plus a drift that pulls the modes near the cutoff towards zero. It has the form of $\partial_t p = \partial_i\partial^i p + \partial_i(v^i p)$, Eq. (2.9), with $t = -\log\Lambda$; Eq. (2.8) writes the drift with the same prefactor as the diffusion.`,
					ref: 'Eqs. (2.7)–(2.8)'
				},
				{
					id: 'free',
					title: 'Free solution',
					kind: 'result',
					tex: t`P^{\text{free}}_\Lambda = \frac1{Z_\Lambda}\exp\Big(-\tfrac12\int\frac{d^dp}{(2\pi)^d}\,\frac{p^2+m^2}{K_\Lambda(p^2)}\,\phi(p)\phi(-p)\Big)`,
					detail: t`Each mode is Gaussian with variance proportional to $K_\Lambda(p^2)/(p^2+m^2)$, which shrinks as $\Lambda$ falls: the modes above the cutoff freeze.`,
					ref: 'Sec. II A 1, after Eq. (2.9)'
				}
			],
			edges: [
				{ from: 'partition', to: 'expand', label: 'differentiate in Λ' },
				{
					from: 'expand',
					to: 'polchinski-eq',
					label: 'make the integrand a total derivative',
					detail: t`Choose $\Lambda\partial_\Lambda S_{\text{int}}$ so that the integrand of (2.3) becomes a total functional derivative plus a field-independent term.`
				},
				{ from: 'demand', to: 'polchinski-eq', label: "Polchinski's sufficient choice" },
				{
					from: 'polchinski-eq',
					to: 'heat',
					label: t`multiply by $-e^{-S_{\text{int}}}$`,
					detail: t`$\delta^2 e^{-S}/\delta\phi\,\delta\phi = (-\delta^2 S + \delta S\,\delta S)\,e^{-S}$: a functional heat equation.`
				},
				{
					from: 'polchinski-eq',
					to: 'constant',
					label: 'insert (2.4), integrate by parts',
					detail: t`The total derivatives integrate to zero, and the source terms drop because $J$ vanishes where $\Lambda\partial_\Lambda K_\Lambda \neq 0$. A field-independent contact term remains.`
				},
				{ from: 'polchinski-eq', to: 'convection', label: t`rewrite for $P_\Lambda$` },
				{
					from: 'prob',
					to: 'convection',
					label: t`normalise by $Z_\Lambda$`,
					detail: t`The explicit $\Lambda$-dependence of the kinetic term gives the drift, and $-\Lambda\,d\log Z_\Lambda/d\Lambda$ from (2.6) cancels the contact term.`
				},
				{
					from: 'convection',
					to: 'free',
					label: t`$S_{\text{int}} = 0$ solves it`,
					detail: t`A vanishing interaction solves (2.4) trivially.`
				}
			]
		},
		{
			id: 'wegner-morris',
			title: 'Wegner–Morris flow and the Polchinski choice',
			section: 'Sec. II A 2',
			summary: t`Exact RG schemes with a soft cutoff are field reparametrizations: the Wegner–Morris equation moves probability along a field-space velocity $\Psi_\Lambda$, here the gradient of $\Sigma_\Lambda = S_\Lambda - 2\hat S_\Lambda$. One choice of kernel and seed action gives Polchinski's equation.`,
			nodes: [
				{
					id: 'wm',
					title: 'Wegner–Morris equation',
					kind: 'assumption',
					tex: t`-\Lambda\frac{d}{d\Lambda}P_\Lambda[\phi] = \int d^dx\,\frac{\delta}{\delta\phi(x)}\big(\Psi_\Lambda[\phi,x]\,P_\Lambda[\phi]\big)`,
					detail: t`$\Psi_\Lambda$, the reparametrization kernel, may depend on $P_\Lambda$ itself. The paper's version allows $-\Lambda\,dZ_\Lambda/d\Lambda = C_\Lambda Z_\Lambda$ instead of 0.`,
					ref: 'Eq. (2.10)'
				},
				{
					id: 'conserve',
					title: 'Probability conserved',
					kind: 'result',
					tex: t`-\Lambda\frac{d}{d\Lambda}\int[d\phi]\,P_\Lambda[\phi] = 0`,
					ref: 'Sec. II A 2'
				},
				{
					id: 'reparam',
					title: 'A field reparametrization',
					kind: 'result',
					tex: t`\phi'(x) = \phi(x) + \frac{\delta\Lambda}{\Lambda}\,\Psi_\Lambda[\phi,x]`,
					detail: t`The flow only relabels field configurations, so positivity and normalisation are kept. Such a map can be inverted: exact RG in the continuum runs backwards, but the inversion is ill-conditioned, like dividing by a Gaussian in Fourier space.`,
					ref: 'Eq. (2.13)'
				},
				{
					id: 'kernel',
					title: 'Gradient kernel',
					kind: 'assumption',
					tex: t`\Psi_\Lambda[\phi,x] = -\tfrac12\int d^dy\,\dot C_\Lambda(x-y)\,\frac{\delta\Sigma_\Lambda[\phi]}{\delta\phi(y)},\qquad \Sigma_\Lambda = S_\Lambda - 2\hat S_\Lambda`,
					detail: t`$\dot C_\Lambda$ is the ERG kernel, positive semidefinite, with the opposite sign to the usual literature. $\hat S_\Lambda$ is the seed action; the 2 is conventional.`,
					ref: 'Eqs. (2.14)–(2.15)'
				},
				{
					id: 'gradient',
					title: 'A potential flow',
					kind: 'result',
					tex: t`-\Lambda\frac{dP_\Lambda}{d\Lambda} = -\tfrac12\int d^dx\,d^dy\,\frac{\delta}{\delta\phi(x)}\Big(\dot C_\Lambda(x-y)\,\frac{\delta\Sigma_\Lambda}{\delta\phi(y)}\,P_\Lambda\Big)`,
					detail: t`The velocity is the gradient of $\Sigma_\Lambda$, with $\tfrac12\dot C_\Lambda$ as inverse metric: the field-space analogue of $\partial_t p + \partial_i(\partial^i W\,p) = 0$, Eq. (2.12).`,
					ref: 'Eqs. (2.11)–(2.12)'
				},
				{
					id: 'split',
					title: 'Diffusion plus drift',
					kind: 'step',
					added: true,
					tex: t`\Psi_\Lambda P_\Lambda = \tfrac12\int d^dy\,\dot C_\Lambda(x-y)\Big(\frac{\delta P_\Lambda}{\delta\phi(y)} + 2\,\frac{\delta\hat S_\Lambda}{\delta\phi(y)}\,P_\Lambda\Big)`,
					detail: t`Use $P_\Lambda\,\delta S_\Lambda/\delta\phi = -\delta P_\Lambda/\delta\phi$.`
				},
				{
					id: 'choice',
					title: "Polchinski's kernel and seed",
					kind: 'assumption',
					tex: t`\dot C_\Lambda(p^2) = (2\pi)^d\,\frac{\Lambda\partial_\Lambda K_\Lambda(p^2)}{p^2+m^2},\qquad \hat S_\Lambda = \tfrac12\int\frac{d^dp}{(2\pi)^d}\,\frac{p^2+m^2}{K_\Lambda(p^2)}\,\phi(p)\phi(-p)`,
					detail: t`The seed action is the free action with the bare mass. $\dot C_\Lambda(p^2) \ge 0$ because $K_\Lambda$ grows with $\Lambda$.`,
					ref: 'Eqs. (2.16)–(2.17)',
					correction: t`The paper says Bochner's theorem makes $\dot C_\Lambda(x-y) \ge 0$ pointwise. Bochner's theorem gives positive semidefiniteness as a kernel, $\int f(x)\,\dot C_\Lambda(x-y)\,f(y) \ge 0$, which is what the metric (3.1) and the Fisher term need. Pointwise positivity does not follow: a shell such as $\Lambda\partial_\Lambda K_\Lambda$ has an oscillating Fourier transform.`
				},
				{
					id: 'recover',
					title: 'Polchinski recovered',
					kind: 'result',
					tex: t`-\Lambda\frac{dP_\Lambda}{d\Lambda} = \tfrac12\int d^dp\,(2\pi)^d\,\frac{\Lambda\partial_\Lambda K_\Lambda}{p^2+m^2}\,\frac{\delta^2 P_\Lambda}{\delta\phi(p)\,\delta\phi(-p)} \qquad + \int d^dp\,\Lambda\partial_\Lambda\log K_\Lambda\,\frac{\delta}{\delta\phi(p)}\big(\phi(p)\,P_\Lambda\big)`,
					detail: t`Eq. (2.7) of derivation 1.`,
					ref: 'Sec. II A 2'
				}
			],
			edges: [
				{
					from: 'wm',
					to: 'conserve',
					label: 'integrate over φ',
					detail: t`The right side is a total derivative, and $\Psi_\Lambda P_\Lambda \to 0$ at large $\phi$.`
				},
				{
					from: 'wm',
					to: 'reparam',
					label: 'a continuity equation',
					detail: t`(2.10) is a continuity equation in field space, with velocity $\Psi_\Lambda$ per step $\delta\Lambda/\Lambda$.`
				},
				{ from: 'wm', to: 'gradient', label: 'insert the kernel' },
				{ from: 'kernel', to: 'gradient', label: t`$\Psi \propto \delta\Sigma/\delta\phi$` },
				{ from: 'kernel', to: 'split', label: t`use $P = e^{-S}/Z$` },
				{ from: 'split', to: 'recover', label: 'insert into (2.10)' },
				{ from: 'wm', to: 'recover', label: 'Wegner–Morris' },
				{
					from: 'choice',
					to: 'recover',
					label: 'insert the choices',
					detail: t`In momentum space $\dot C_\Lambda\,\delta\hat S_\Lambda/\delta\phi(p) = \Lambda\partial_\Lambda\log K_\Lambda\,\phi(-p)$: the drift of (2.7). The $\delta P/\delta\phi$ term gives the diffusion.`
				}
			]
		},
		{
			id: 'otto',
			title: 'Otto calculus: heat flow as a gradient flow',
			section: 'Sec. II B 3',
			summary: t`Heat flow is the steepest descent of the Dirichlet energy for the flat $L^2$ metric on densities, and the steepest ascent of the entropy for the Wasserstein-2 metric (Otto). The second picture is the template for the RG result.`,
			nodes: [
				{
					id: 'grad-def',
					title: 'Gradient',
					kind: 'assumption',
					tex: t`\frac{d}{dt}F(x(t))\Big|_{t=0} = \big\langle\nabla F(x_0),\,\dot x(0)\big\rangle\quad\text{for every curve through } x_0`,
					ref: 'Eq. (2.25)'
				},
				{
					id: 'dens',
					title: 'Space of densities',
					kind: 'assumption',
					tex: t`\operatorname{dens}(M) = \Big\{p \ge 0,\ \int dV\,p = 1\Big\},\qquad T_p\operatorname{dens}(M) = \Big\{\eta : \int dV\,\eta = 0\Big\}`,
					ref: 'Eqs. (2.26)–(2.27)'
				},
				{
					id: 'l2',
					title: 'Flat metric, Dirichlet energy',
					kind: 'assumption',
					tex: t`\langle\eta_1,\eta_2\rangle_{L^2} = \int dV\,\eta_1\eta_2,\qquad \mathcal E[p] = \tfrac12\int dV\,|\nabla p|^2`,
					ref: 'Eqs. (2.28)–(2.29)'
				},
				{
					id: 'dirichlet',
					title: 'Gradient of the energy',
					kind: 'step',
					tex: t`\frac{d}{dt}\mathcal E[\rho(t)] = \big\langle -\Delta\rho,\ \partial_t\rho\big\rangle_{L^2}\ \Rightarrow\ \nabla_{L^2}\mathcal E = -\Delta p`,
					ref: 'Eqs. (2.30)–(2.31)'
				},
				{
					id: 'heat-l2',
					title: 'Heat flow, flat picture',
					kind: 'result',
					tex: t`\partial_t p = -\nabla_{L^2}\mathcal E[p] = \Delta p`,
					detail: t`So the Dirichlet energy decreases along heat flow.`,
					ref: 'Eq. (2.32)'
				},
				{
					id: 'w2dist',
					title: 'Wasserstein-2 distance',
					kind: 'assumption',
					tex: t`\mathcal W_2(p_1,p_2)^2 = \inf_{\pi\in\Gamma(p_1,p_2)}\int dx\,dy\,\pi(x,y)\,|x-y|^2`,
					detail: t`$\Gamma(p_1,p_2)$ are the couplings: joint distributions with marginals $p_1$ and $p_2$. The optimum is the cheapest way to move mass $p_1$ into $p_2$.`,
					ref: 'Eq. (2.24)'
				},
				{
					id: 'dual',
					title: 'Potential of a tangent vector',
					kind: 'assumption',
					tex: t`\nabla\cdot(p\,\nabla\bar\eta) = \eta`,
					detail: t`Unique up to a constant, so it identifies tangent vectors $\eta$ with potentials $\bar\eta$.`,
					ref: 'Eqs. (2.34)–(2.35)'
				},
				{
					id: 'w2',
					title: 'Wasserstein metric',
					kind: 'step',
					tex: t`\langle\eta_1,\eta_2\rangle_{\mathcal W_2} = \int dV\,p\,\nabla\bar\eta_1\cdot\nabla\bar\eta_2 = -\int dV\,\eta_1\bar\eta_2`,
					detail: t`The infinitesimal form of $\mathcal W_2$: Otto and Westdickenberg, Lemma 4.3; derivation 10 sketches why. The second form follows by integrating by parts.`,
					ref: 'Eq. (2.36)'
				},
				{
					id: 'entropy',
					title: 'Differential entropy',
					kind: 'assumption',
					tex: t`S[p] = -\int dV\,p\log p`,
					ref: 'Eq. (2.33)'
				},
				{
					id: 'entropy-grad',
					title: 'Gradient of the entropy',
					kind: 'step',
					tex: t`\frac{d}{dt}S[\rho] = \int dV\,\nabla\bar\eta\cdot\nabla p = \langle\Delta p,\eta\rangle_{\mathcal W_2}\ \Rightarrow\ \nabla_{\mathcal W_2}S = \Delta p`,
					ref: 'Eqs. (2.37)–(2.38)'
				},
				{
					id: 'heat-w2',
					title: 'Heat flow, Wasserstein picture',
					kind: 'result',
					tex: t`\partial_t p = \nabla_{\mathcal W_2}S[p]`,
					detail: t`Heat flow is completely determined by the entropy: it climbs the entropy as steeply as the Wasserstein geometry allows.`,
					ref: 'Eq. (2.39)'
				}
			],
			edges: [
				{ from: 'grad-def', to: 'dirichlet', label: 'differentiate along a path' },
				{
					from: 'l2',
					to: 'dirichlet',
					label: 'integrate by parts',
					detail: t`$\int\nabla\rho\cdot\nabla\partial_t\rho = -\int\Delta\rho\,\partial_t\rho$.`
				},
				{ from: 'dens', to: 'dirichlet', label: 'paths of densities' },
				{ from: 'dirichlet', to: 'heat-l2', label: 'steepest descent' },
				{ from: 'dual', to: 'w2', label: 'pair the potentials' },
				{ from: 'w2dist', to: 'w2', label: 'infinitesimal form' },
				{ from: 'dens', to: 'w2', label: 'tangent vectors' },
				{ from: 'grad-def', to: 'entropy-grad', label: 'definition of the gradient' },
				{
					from: 'entropy',
					to: 'entropy-grad',
					label: t`vary: $-\int\eta\,(\log p + 1)$`,
					detail: t`The $+1$ drops because $\int\eta = 0$.`
				},
				{
					from: 'w2',
					to: 'entropy-grad',
					label: 'substitute η, integrate by parts',
					detail: t`$-\int\nabla\cdot(p\nabla\bar\eta)\log p = \int\nabla\bar\eta\cdot\nabla p = -\int\bar\eta\,\Delta p$, which is $\langle\Delta p,\eta\rangle_{\mathcal W_2}$ by (2.36).`
				},
				{ from: 'entropy-grad', to: 'heat-w2', label: 'steepest ascent' }
			]
		},
		{
			id: 'gradient-flow',
			title: 'RG flow as a Wasserstein gradient flow',
			section: 'Sec. III A',
			summary: t`The field-space version of Otto's construction. With a Wasserstein metric built from the ERG kernel $\dot C_\Lambda$ and the reference $Q_\Lambda = e^{-2\hat S_\Lambda}/Z_{Q,\Lambda}$, the Wegner–Morris equation, and Polchinski's as a special case, is the steepest descent of the relative entropy $S(P_\Lambda\|Q_\Lambda)$.`,
			nodes: [
				{
					id: 'wm',
					title: 'Wegner–Morris flow',
					kind: 'assumption',
					from: 'wegner-morris',
					tex: t`-\Lambda\frac{dP_\Lambda}{d\Lambda} = \int d^dx\,\frac{\delta(\Psi_\Lambda P_\Lambda)}{\delta\phi(x)},\qquad \Psi_\Lambda = -\tfrac12\int d^dy\,\dot C_\Lambda(x-y)\,\frac{\delta\Sigma_\Lambda}{\delta\phi(y)},\qquad \Sigma_\Lambda = S_\Lambda - 2\hat S_\Lambda`,
					detail: t`Derivation 2, with $\dot C_\Lambda$ positive semidefinite.`
				},
				{
					id: 'metric',
					title: 'Field-space Wasserstein metric',
					kind: 'assumption',
					tex: t`\langle\delta P_1,\delta P_2\rangle_{\mathcal W_2} = \tfrac12\int[d\phi]\,P\int d^dx\,d^dy\,\dot C_\Lambda(x-y)\,\frac{\delta\Phi_1}{\delta\phi(x)}\frac{\delta\Phi_2}{\delta\phi(y)},\qquad \delta P_i = \tfrac12\int d^dx\,d^dy\,\dot C_\Lambda(x-y)\,\frac{\delta}{\delta\phi(x)}\Big(P\,\frac{\delta\Phi_i}{\delta\phi(y)}\Big)`,
					detail: t`The field-space analogue of (2.34)–(2.36): $\Phi_i$ is the potential of the tangent vector $\delta P_i$, fixed up to a constant. The norm is non-negative because $\dot C_\Lambda$ is positive semidefinite.`,
					ref: 'Eqs. (3.1)–(3.2)'
				},
				{
					id: 'compact',
					title: 'Compact form',
					kind: 'step',
					tex: t`\langle\delta P_1,\delta P_2\rangle_{\mathcal W_2} = -\int[d\phi]\,\delta P_1\,\Phi_2 = -\int[d\phi]\,\Phi_1\,\delta P_2`,
					ref: 'Eq. (3.3)'
				},
				{
					id: 'distance',
					title: 'Field-space distance',
					kind: 'result',
					tex: t`\mathcal W_2(P_1,P_2)^2 = \inf_{\Pi\in\Gamma(P_1,P_2)} 2\int[d\phi_1][d\phi_2]\,\Pi\int d^dx\,d^dy\,\dot C_\Lambda^{-1}(x,y)\,\delta\phi(x)\,\delta\phi(y),\qquad \delta\phi = \phi_1 - \phi_2`,
					detail: t`The cost of moving probability is an $L^2$ penalty on rearranging field modes, weighted towards the cutoff scale by $\dot C_\Lambda^{-1}$. The 2 is the inverse of the $\tfrac12$ in (3.1). $\Gamma(P_1,P_2)$ are the couplings with marginals $P_1$ and $P_2$.`,
					ref: 'Eq. (3.4)'
				},
				{
					id: 'reference',
					title: 'Reference and relative entropy',
					kind: 'assumption',
					tex: t`Q_\Lambda = \frac{e^{-2\hat S_\Lambda}}{Z_{Q,\Lambda}},\qquad S(P\|Q) = \int[d\phi]\,P\log\frac PQ`,
					ref: 'Eqs. (3.5)–(3.6)'
				},
				{
					id: 'grad-def',
					title: 'Gradient on probability functionals',
					kind: 'assumption',
					tex: t`\big\langle\nabla_{\mathcal W_2}\mathcal F[P],\,\delta P\big\rangle_{\mathcal W_2} = \int[d\phi]\,\frac{\delta\mathcal F}{\delta P}\,\delta P`,
					detail: t`$\delta\mathcal F/\delta P$ is a derivative with respect to the functional $P[\phi]$ itself.`,
					ref: 'Eq. (3.8)'
				},
				{
					id: 'first-variation',
					title: 'First variation',
					kind: 'step',
					tex: t`\int[d\phi]\,\big(\log P_\Lambda + 1 - \log Q_\Lambda\big)\,\delta P = -\int[d\phi]\,\Sigma_\Lambda\,\delta P`,
					detail: t`$\log P_\Lambda - \log Q_\Lambda = -S_\Lambda + 2\hat S_\Lambda + \text{const} = -\Sigma_\Lambda + \text{const}$, and constants drop because $\int\delta P = 0$.`,
					ref: 'Eq. (3.9)'
				},
				{
					id: 'insert-phi',
					title: 'Write δP by its potential',
					kind: 'step',
					tex: t`-\tfrac12\int[d\phi]\,\Sigma_\Lambda\int d^dx\,d^dy\,\dot C_\Lambda(x-y)\,\frac{\delta}{\delta\phi(x)}\Big(P_\Lambda\,\frac{\delta\Phi}{\delta\phi(y)}\Big)`,
					ref: 'Eq. (3.10)'
				},
				{
					id: 'ibp',
					title: 'Integrate by parts twice',
					kind: 'step',
					tex: t`\int[d\phi]\int d^dx\,\frac{\delta(\Psi_\Lambda P_\Lambda)}{\delta\phi(x)}\,\Phi = \Big\langle -\int d^dx\,\frac{\delta(\Psi_\Lambda P_\Lambda)}{\delta\phi(x)},\ \delta P\Big\rangle_{\mathcal W_2}`,
					ref: 'Eq. (3.11)'
				},
				{
					id: 'neg-grad',
					title: 'Minus the gradient',
					kind: 'step',
					tex: t`-\nabla_{\mathcal W_2}S(P_\Lambda\|Q_\Lambda) = \int d^dx\,\frac{\delta}{\delta\phi(x)}\big(\Psi_\Lambda P_\Lambda\big)`,
					ref: 'Eq. (3.12)'
				},
				{
					id: 'main',
					title: 'RG is a gradient flow',
					kind: 'result',
					tex: t`-\Lambda\frac{d}{d\Lambda}P_\Lambda = -\nabla_{\mathcal W_2}S(P_\Lambda\|Q_\Lambda)`,
					detail: t`The flow towards the IR is the steepest descent of the relative entropy. At fixed $Q$, $S(P\|Q)$ falls along it at the rate $\|\nabla_{\mathcal W_2}S\|^2$, the relative Fisher information; derivation 6 uses this. The metric and $Q_\Lambda$ together are the choice of RG scheme.`,
					ref: 'Eq. (3.7)'
				}
			],
			edges: [
				{ from: 'metric', to: 'compact', label: 'integrate by parts' },
				{ from: 'metric', to: 'distance', label: 'infinitesimal form (App. A)' },
				{ from: 'grad-def', to: 'first-variation', label: t`take $\mathcal F = S(P\|Q)$` },
				{ from: 'reference', to: 'first-variation', label: t`vary $P\log(P/Q)$` },
				{ from: 'wm', to: 'first-variation', label: t`$\Sigma = S - 2\hat S$` },
				{ from: 'first-variation', to: 'insert-phi', label: t`write $\delta P$ by (3.2)` },
				{ from: 'metric', to: 'insert-phi', label: 'potential Φ of δP' },
				{ from: 'insert-phi', to: 'ibp', label: 'move both derivatives' },
				{
					from: 'wm',
					to: 'ibp',
					label: t`$\Psi = -\tfrac12\dot C\,\delta\Sigma/\delta\phi$`
				},
				{ from: 'compact', to: 'ibp', label: 'read as a metric product' },
				{ from: 'ibp', to: 'neg-grad', label: 'compare with (3.8)' },
				{ from: 'neg-grad', to: 'main', label: 'equals the Wegner–Morris right side' },
				{ from: 'wm', to: 'main', label: 'Wegner–Morris' }
			]
		},
		{
			id: 'free-field-seed',
			title: 'Free field, seed action and Σ',
			section: 'Sec. III B',
			summary: t`For the free field the reference is the square of the distribution itself, so the flow is driven by the entropy alone. The sign is the opposite of the paper's: the free field runs down its entropy towards the IR, as its modes freeze. The same rewriting shows that $\Sigma_\Lambda$ is minus a log-likelihood ratio.`,
			nodes: [
				{
					id: 'main',
					title: 'RG is a gradient flow',
					kind: 'assumption',
					from: 'gradient-flow',
					tex: t`-\Lambda\frac{d}{d\Lambda}P_\Lambda = -\nabla_{\mathcal W_2}S(P_\Lambda\|Q_\Lambda)`
				},
				{
					id: 'free',
					title: 'Free field',
					kind: 'assumption',
					tex: t`S_\Lambda = \hat S_\Lambda = S_{\text{free},\Lambda}:\qquad P^{\text{free}}_\Lambda = \frac{e^{-S_{\text{free},\Lambda}}}{Z_{P,\Lambda}},\qquad Q^{\text{free}}_\Lambda = \frac{e^{-2S_{\text{free},\Lambda}}}{Z_{Q,\Lambda}}`,
					detail: t`Polchinski's scheme applied to the free field. Note the 2 in the exponent of $Q$.`,
					ref: 'Eq. (3.14)'
				},
				{
					id: 'square',
					title: 'Reference is P squared',
					kind: 'step',
					added: true,
					tex: t`Q^{\text{free}}_\Lambda = \frac{Z_{P,\Lambda}^2}{Z_{Q,\Lambda}}\,\big(P^{\text{free}}_\Lambda\big)^2`,
					ref: 'Eq. (3.15)'
				},
				{
					id: 'same-gradient',
					title: 'Same gradient as the entropy',
					kind: 'step',
					tex: t`\frac{\delta S(P\|Q)}{\delta P}\Big|_{P^{\text{free}}} = -\log P^{\text{free}} + \text{const} = \frac{\delta S(P)}{\delta P}\Big|_{P^{\text{free}}} + \text{const}`,
					detail: t`$Q$ is held fixed, as in (3.8). Constants have zero gradient because $\int\delta P = 0$. Here $S(P) = -\int[d\phi]\,P\log P$.`,
					ref: 'Eq. (3.15)',
					correction: t`The paper's (3.15) ends in $+\nabla_{\mathcal W_2}S(P^{\text{free}})$. Since $S(P\|Q)$ and $S(P)$ have the same first variation here, $-\nabla S(P\|Q) = -\nabla S(P)$. Equivalently, $S(P\|P^2) = -\int P\log P = +S(P)$.`
				},
				{
					id: 'free-flow',
					title: 'Free field descends its entropy',
					kind: 'result',
					tex: t`-\Lambda\frac{d}{d\Lambda}P^{\text{free}}_\Lambda = -\nabla_{\mathcal W_2}S\big(P^{\text{free}}_\Lambda\big)`,
					detail: t`Backward heat flow in $t = -\log\Lambda$, the opposite of Otto's picture (derivation 3).`,
					ref: 'Eq. (3.16)',
					correction: t`The paper has $+\nabla_{\mathcal W_2}S$ and says that the free field flows according to its entropy. Checked on one mode: the Wegner–Morris right-hand side is $-\tfrac12\dot C\,p''$. It matches $-\nabla_{\mathcal W_2}S$ to $7\times10^{-7}$ and differs from $+\nabla_{\mathcal W_2}S$ by $0.2$.`
				},
				{
					id: 'entropy-falls',
					title: 'Entropy falls towards the IR',
					kind: 'result',
					added: true,
					tex: t`-\Lambda\frac{d}{d\Lambda}S\big(P^{\text{free}}_\Lambda\big) = -\big\|\nabla_{\mathcal W_2}S\big\|^2_{\mathcal W_2} \le 0`,
					detail: t`Directly: each mode is Gaussian with variance proportional to $K_\Lambda(p^2)/(p^2+m^2)$, which shrinks as $\Lambda$ falls, so its entropy $\tfrac12\log(2\pi e\,\sigma^2)$ falls. The paper reads the descent of $S(P\|Q)$ as a proxy for maximising entropy; for the free field, where $S(P\|Q) = S(P) + \text{const}$, it lowers the entropy instead.`
				},
				{
					id: 'defs',
					title: 'Definitions',
					kind: 'assumption',
					tex: t`P_\Lambda = \frac{e^{-S_\Lambda}}{Z_{P,\Lambda}},\qquad Q_\Lambda = \frac{e^{-2\hat S_\Lambda}}{Z_{Q,\Lambda}},\qquad \Sigma_\Lambda = S_\Lambda - 2\hat S_\Lambda`,
					ref: 'Eqs. (2.15), (3.5)'
				},
				{
					id: 'sigma2',
					title: 'Σ through P and Q',
					kind: 'step',
					tex: t`\Sigma_\Lambda = -\log P_\Lambda + \log Q_\Lambda - \log Z_{P,\Lambda} + \log Z_{Q,\Lambda}`,
					ref: 'Eq. (3.17)'
				},
				{
					id: 'sigma-tilde',
					title: 'Minus a log-likelihood ratio',
					kind: 'result',
					tex: t`\widetilde\Sigma_\Lambda = -\log\frac{P_\Lambda}{Q_\Lambda},\qquad S(P_\Lambda\|Q_\Lambda) = -\int[d\phi]\,P_\Lambda\,\widetilde\Sigma_\Lambda`,
					detail: t`The seed action's only role is to fix the reference $Q_\Lambda$. It has a prescribed $\Lambda$-dependence and satisfies no flow equation.`,
					ref: 'Eqs. (3.18)–(3.19)'
				}
			],
			edges: [
				{ from: 'free', to: 'square', label: t`$e^{-2S} = (e^{-S})^2$` },
				{ from: 'square', to: 'same-gradient', label: 'take logs' },
				{ from: 'same-gradient', to: 'free-flow', label: 'equal gradients' },
				{ from: 'main', to: 'free-flow', label: 'insert' },
				{
					from: 'free-flow',
					to: 'entropy-falls',
					label: 'chain rule along the flow',
					detail: t`$-\Lambda\,dS/d\Lambda = \langle\nabla S,\ -\Lambda\,dP/d\Lambda\rangle_{\mathcal W_2}$.`
				},
				{ from: 'defs', to: 'sigma2', label: 'take logs' },
				{
					from: 'sigma2',
					to: 'sigma-tilde',
					label: 'drop φ-independent terms',
					detail: t`Only $\delta\Sigma/\delta\phi$ enters the flow, so the constants can go.`
				}
			]
		},
		{
			id: 'monotonicity',
			title: 'Is the relative entropy an RG monotone?',
			section: 'Sec. IV A',
			summary: t`The paper proposes $M_\Lambda = S(P_\Lambda\|Q_\Lambda) - \log Z_{Q,\Lambda}$ as a non-perturbative RG monotone. Redone, the flow lowers $M$ by the relative Fisher information while the moving reference raises it. So $-\Lambda\,dM/d\Lambda$ has no definite sign: it is positive for the free field and at weak coupling, but turns negative at strong coupling.`,
			nodes: [
				{
					id: 'main',
					title: 'RG is a gradient flow',
					kind: 'assumption',
					from: 'gradient-flow',
					tex: t`-\Lambda\frac{dP_\Lambda}{d\Lambda} = -\nabla_{\mathcal W_2}S(P_\Lambda\|Q_\Lambda) = \int d^dx\,\frac{\delta(\Psi_\Lambda P_\Lambda)}{\delta\phi(x)}`
				},
				{
					id: 'seed',
					title: 'Quadratic seed action',
					kind: 'assumption',
					tex: t`Q_\Lambda = \frac{e^{-S_{Q,\Lambda}}}{Z_{Q,\Lambda}},\qquad S_{Q,\Lambda} = 2\hat S_\Lambda = C\int\frac{d^dp}{(2\pi)^d}\,\frac{\phi(p)\phi(-p)}{\widehat K_\Lambda(p^2)\,G(p^2)}`,
					detail: t`$C > 0$; $\widehat K_\Lambda$ is a cutoff that need not equal $K_\Lambda$; $G$ is the Green's function of a positive elliptic operator, e.g. $1/(p^2+m^2)$. Polchinski's scheme is a case.`,
					ref: 'Eq. (4.2)'
				},
				{
					id: 'monotone',
					title: 'Candidate monotone',
					kind: 'assumption',
					tex: t`M_\Lambda = S(P_\Lambda\|Q_\Lambda) - \log Z_{Q,\Lambda} = \int[d\phi]\,P_\Lambda\big(\log P_\Lambda + S_{Q,\Lambda}\big)`,
					detail: t`Without the $-\log Z_{Q,\Lambda}$ the derivative would gain $-\Lambda\partial_\Lambda\log Z_{Q,\Lambda} \le 0$, Eq. (4.8): with a soft cutoff $Z_{Q,\Lambda}$ grows with $\Lambda$ as modes open up.`,
					ref: 'Eq. (4.1)'
				},
				{
					id: 'diff',
					title: 'Differentiate under the integral',
					kind: 'step',
					tex: t`-\Lambda\frac{dM_\Lambda}{d\Lambda} = -\int[d\phi]\,\Lambda\partial_\Lambda P_\Lambda\,\big(\log P_\Lambda + S_{Q,\Lambda}\big) - \int[d\phi]\,P_\Lambda\,\Lambda\partial_\Lambda S_{Q,\Lambda}`,
					detail: t`The derivative of $\log P_\Lambda$ contributes $\int\Lambda\partial_\Lambda P_\Lambda = 0$. Derivation 7 shows that differentiating under the integral is legitimate.`,
					ref: 'Eq. (4.3)'
				},
				{
					id: 'ibp',
					title: 'Insert the flow, integrate by parts',
					kind: 'step',
					tex: t`-\Lambda\frac{dM_\Lambda}{d\Lambda} = -\tfrac12\int[d\phi]\,P_\Lambda\int d^dx\,d^dy\,\dot C_\Lambda(x-y)\,\frac{\delta\Sigma_\Lambda}{\delta\phi(x)}\frac{\delta\Sigma_\Lambda}{\delta\phi(y)} - \int[d\phi]\,P_\Lambda\,\Lambda\partial_\Lambda S_{Q,\Lambda}`,
					ref: 'Eqs. (4.4)–(4.5)',
					correction: t`The paper's (4.5) has $+\tfrac12$. Integrating (4.4) by parts gives $-\int\Psi_\Lambda P_\Lambda\,\delta(\log P_\Lambda + S_{Q,\Lambda})/\delta\phi = \int\Psi_\Lambda P_\Lambda\,\delta\Sigma_\Lambda/\delta\phi$, and with $\Psi_\Lambda = -\tfrac12\dot C_\Lambda\,\delta\Sigma_\Lambda/\delta\phi$ that is minus the Fisher term. A gradient flow must do this: at fixed $Q$ it lowers $S(P\|Q)$ at the rate $\|\nabla S\|^2$. A one-mode flow evolved numerically gives a $dM/dt$ that matches this sign to 5 digits.`
				},
				{
					id: 'fisher',
					title: 'Relative Fisher information',
					kind: 'step',
					tex: t`I_\Lambda = \tfrac12\int[d\phi]\,P_\Lambda\int d^dx\,d^dy\,\dot C_\Lambda(x-y)\,\frac{\delta\Sigma_\Lambda}{\delta\phi(x)}\frac{\delta\Sigma_\Lambda}{\delta\phi(y)} = \big\|\nabla_{\mathcal W_2}S(P_\Lambda\|Q_\Lambda)\big\|^2 \ge 0`,
					detail: t`Non-negative because $\dot C_\Lambda$ is positive semidefinite. The paper names it in a footnote.`,
					ref: 'Sec. IV A, footnote'
				},
				{
					id: 'cutoff-term',
					title: 'Moving-reference term',
					kind: 'step',
					tex: t`-\int[d\phi]\,P_\Lambda\,\Lambda\partial_\Lambda S_{Q,\Lambda} = -C\int\frac{d^dp}{(2\pi)^d}\,\frac{\Lambda\partial_\Lambda\widehat K_\Lambda^{-1}(p^2)}{G(p^2)}\,\langle\phi(p)\phi(-p)\rangle_{P_\Lambda} \ge 0`,
					detail: t`$\widehat K_\Lambda^{-1}$ grows as $\Lambda$ falls, and $\langle\phi(p)\phi(-p)\rangle \ge 0$.`,
					ref: 'Eq. (4.6)'
				},
				{
					id: 'balance',
					title: 'Two competing terms',
					kind: 'result',
					tex: t`-\Lambda\frac{dM_\Lambda}{d\Lambda} = -I_\Lambda + \Big(-\big\langle\Lambda\partial_\Lambda S_{Q,\Lambda}\big\rangle_{P_\Lambda}\Big)`,
					ref: 'Eq. (4.7)',
					correction: t`The paper adds two non-negative terms and concludes $-\Lambda\,dM_\Lambda/d\Lambda \ge 0$. With the sign fixed the terms compete, and the bound needs the moving-reference term to win.`
				},
				{
					id: 'weak',
					title: 'Positive at weak coupling',
					kind: 'result',
					added: true,
					tex: t`-\Lambda\frac{dM_\Lambda}{d\Lambda} = \delta^d(0)\Big(\tfrac12 f_0 + \tfrac14\lambda f_1 + O(\lambda^2)\Big) \ge 0`,
					detail: t`Polchinski's scheme: the free field gives $\tfrac12 f_0 \ge 0$ (derivation 7) and $\phi^4$ adds $\tfrac14\lambda f_1$ and $O(\lambda^2)$ (derivation 8).`
				},
				{
					id: 'strong',
					title: 'Negative at strong coupling',
					kind: 'result',
					added: true,
					tex: t`S = \frac{x^2}{2v} + \frac{\lambda x^4}{24}:\qquad \frac{dM}{dt} = +0.05\ (\lambda = 10),\qquad \frac{dM}{dt} = -0.12\ (\lambda = 20)`,
					detail: t`A counterexample with one mode ($v = 1$, $\dot C = 0.4$, $t = -\log\Lambda$), evolved numerically by the flow. The Fisher term grows like $\sqrt\lambda$ while the moving-reference term shrinks with $\langle x^2\rangle$, so $M$ stops being monotone between $\lambda = 10$ and $20$.`
				}
			],
			edges: [
				{ from: 'monotone', to: 'diff', label: 'differentiate in Λ' },
				{ from: 'seed', to: 'diff', label: t`$S_Q$ moves with Λ` },
				{ from: 'diff', to: 'ibp', label: 'insert the flow' },
				{ from: 'main', to: 'ibp', label: 'Wegner–Morris form' },
				{
					from: 'seed',
					to: 'ibp',
					label: t`$\delta(\log P + S_Q) = -\delta\Sigma$`,
					detail: t`$\log P_\Lambda + S_{Q,\Lambda} = -S_\Lambda + 2\hat S_\Lambda + \text{const}$.`
				},
				{ from: 'ibp', to: 'fisher', label: 'first term' },
				{ from: 'ibp', to: 'cutoff-term', label: 'second term' },
				{ from: 'seed', to: 'cutoff-term', label: t`quadratic $S_Q$` },
				{ from: 'fisher', to: 'balance', label: 'lowers M' },
				{ from: 'cutoff-term', to: 'balance', label: 'raises M' },
				{ from: 'balance', to: 'weak', label: 'free field and small λ' },
				{ from: 'balance', to: 'strong', label: 'large λ' }
			]
		},
		{
			id: 'free-monotone',
			title: 'Order of limits and the free monotone',
			section: 'Secs. IV B, V A',
			summary: t`For the free field, the paper finds that differentiating $\langle S_{\text{free}}\rangle$ under the functional integral disagrees with differentiating it outside, and redefines $M_\Lambda$ as an antiderivative to fix the order. The disagreement is a factor-2 slip in one expectation value, and the two orders agree. The free monotone is $-\tfrac12\delta^d(0)\int\log(K_\Lambda/K_{\Lambda_0})$, a third of the paper's.`,
			nodes: [
				{
					id: 'monotone',
					title: 'Candidate monotone',
					kind: 'assumption',
					from: 'monotonicity',
					tex: t`M_\Lambda = S(P_\Lambda\|Q_\Lambda) - \log Z_{Q,\Lambda}`
				},
				{
					id: 'free',
					title: 'Free field',
					kind: 'assumption',
					tex: t`S_{\text{free},\Lambda} = \tfrac12\int\frac{d^dp}{(2\pi)^d}\,\frac{p^2+m^2}{K_\Lambda(p^2)}\,\phi(p)\phi(-p),\qquad \langle\phi(p)\phi(-p)\rangle = (2\pi)^d\,\delta^d(0)\,\frac{K_\Lambda(p^2)}{p^2+m^2}`,
					detail: t`The free solution of Polchinski's equation, with $Q^{\text{free}}_\Lambda \propto e^{-2S_{\text{free},\Lambda}}$.`,
					ref: 'Sec. IV B 1'
				},
				{
					id: 'equipartition',
					title: 'One half per mode',
					kind: 'step',
					tex: t`\langle S_{\text{free},\Lambda}\rangle = \tfrac12\,\delta^d(0)\int d^dp`,
					detail: t`As in finite dimensions, $\langle\tfrac12\,x\cdot A\cdot x\rangle = \tfrac n2$; here the number of modes is $\delta^d(0)\int d^dp$.`,
					ref: 'Eq. (4.12)'
				},
				{
					id: 'outside',
					title: 'Derivative outside',
					kind: 'result',
					tex: t`-\Lambda\frac{d}{d\Lambda}\langle S_{\text{free},\Lambda}\rangle = 0`,
					ref: 'Eq. (4.13)'
				},
				{
					id: 'first-term',
					title: 'Differentiate P',
					kind: 'step',
					tex: t`-\int[d\phi]\,\Lambda\partial_\Lambda P^{\text{free}}_\Lambda\,S_{\text{free},\Lambda} = -\tfrac12\,\delta^d(0)\int d^dp\,\Lambda\partial_\Lambda\log K_\Lambda`,
					detail: t`Uses $\int\Lambda\partial_\Lambda P = 0$, i.e. $\Lambda\partial_\Lambda\log Z_{P,\Lambda} = \tfrac12\,\delta^d(0)\int d^dp\,\Lambda\partial_\Lambda\log K_\Lambda$, Eq. (4.18), which cancels the $\delta^d(0)^2$ terms.`,
					ref: 'Eqs. (4.15)–(4.19)'
				},
				{
					id: 'second-term',
					title: 'Differentiate S',
					kind: 'step',
					tex: t`-\int[d\phi]\,P^{\text{free}}_\Lambda\,\Lambda\partial_\Lambda S_{\text{free},\Lambda} = \tfrac12\,\delta^d(0)\int d^dp\,\Lambda\partial_\Lambda\log K_\Lambda`,
					ref: 'Eq. (4.20)',
					correction: t`The paper's (4.20) has no $\tfrac12$. $-\Lambda\partial_\Lambda S_{\text{free}} = \tfrac12\int\frac{d^dp}{(2\pi)^d}\,(p^2+m^2)\,\frac{\Lambda\partial_\Lambda K_\Lambda}{K_\Lambda^2}\,\phi(p)\phi(-p)$, and the two-point function turns each mode into $\tfrac12\Lambda\partial_\Lambda\log K_\Lambda$. For one mode: $\langle x^2\rangle\,\Lambda\partial_\Lambda v/(2v^2) = \tfrac12\Lambda\partial_\Lambda\log v$.`
				},
				{
					id: 'inside',
					title: 'Derivative inside agrees',
					kind: 'result',
					tex: t`-\int[d\phi]\,\Lambda\partial_\Lambda\big(P^{\text{free}}_\Lambda S_{\text{free},\Lambda}\big) = 0 = -\Lambda\frac{d}{d\Lambda}\langle S_{\text{free},\Lambda}\rangle`,
					ref: 'Eqs. (4.14), (4.21)–(4.22)',
					correction: t`The paper gets $\tfrac12\,\delta^d(0)\int d^dp\,\Lambda\partial_\Lambda\log K_\Lambda$ here and concludes, in (4.22), that the derivative does not commute with the functional integral. With (4.20) corrected the two terms cancel and the orders agree, as they must for a regulated, finite-mode integral.`
				},
				{
					id: 'definition',
					title: 'Monotone as an antiderivative',
					kind: 'step',
					tex: t`M_\Lambda = -\int_{\log\Lambda}^{\log\Lambda_0}d\log\Lambda'\,\Big[\int[d\phi]\,\Lambda'\partial_{\Lambda'}\Big(P_{\Lambda'}\log\frac{P_{\Lambda'}}{Q_{\Lambda'}}\Big) - \Lambda'\partial_{\Lambda'}\log Z_{Q,\Lambda'}\Big]`,
					detail: t`Normalised so that $M_{\Lambda_0} = 0$, with $\Lambda \le \Lambda_0$.`,
					ref: 'Eqs. (4.23)–(4.24)',
					correction: t`The paper adopts this as the true definition of $M_\Lambda$, to fix the order of limits. With the orders agreeing it equals $M_\Lambda - M_{\Lambda_0}$ from (4.1).`
				},
				{
					id: 'free-M',
					title: 'Free monotone',
					kind: 'result',
					tex: t`M^{\text{free}}_\Lambda = -\tfrac12\,\delta^d(0)\int d^dp\,\log\frac{K_\Lambda(p^2)}{K_{\Lambda_0}(p^2)} \ \ge 0`,
					detail: t`Non-negative for $\Lambda \le \Lambda_0$, since $K_\Lambda \le K_{\Lambda_0}$.`,
					ref: 'Eq. (5.1)',
					correction: t`The paper has $-\tfrac32$. With $S_Q = 2S_{\text{free}}$, $M^{\text{free}}_\Lambda = -S(P^{\text{free}}_\Lambda) + \delta^d(0)\int d^dp$, and each mode's entropy is $\tfrac12\log(2\pi e\,\sigma^2)$ with $\sigma^2 \propto K_\Lambda$. The paper's $\tfrac32$ comes from the sign slip in (4.5) (derivation 6). For one mode evolved numerically, $dM/dt = 0.200 = \tfrac12\dot C/v$, against $0.600$ from the paper's formula.`
				},
				{
					id: 'free-dM',
					title: 'Its derivative',
					kind: 'result',
					tex: t`-\Lambda\frac{d}{d\Lambda}M^{\text{free}}_\Lambda = \tfrac12\,\delta^d(0)\int d^dp\,\Lambda\partial_\Lambda\log K_\Lambda(p^2) = \tfrac12\,\delta^d(0)\,f_0 \ge 0`,
					detail: t`The $\delta^d(0)$ is the volume, so $\tfrac12 f_0$ is a finite monotone density when $f_0$ converges, which needs a suitable cutoff (derivation 11).`,
					ref: 'Eq. (5.2)',
					correction: t`The paper has $\tfrac32$, and drops the factor $\Lambda$ inside the integral.`
				}
			],
			edges: [
				{ from: 'free', to: 'equipartition', label: 'Gaussian average' },
				{ from: 'equipartition', to: 'outside', label: 'independent of Λ' },
				{ from: 'free', to: 'first-term', label: 'differentiate P' },
				{ from: 'free', to: 'second-term', label: 'differentiate S' },
				{ from: 'first-term', to: 'inside', label: 'add' },
				{ from: 'second-term', to: 'inside', label: 'add' },
				{ from: 'outside', to: 'inside', label: 'compare' },
				{ from: 'inside', to: 'definition', label: 'either order' },
				{ from: 'monotone', to: 'definition', label: 'integrate its derivative' },
				{ from: 'definition', to: 'free-M', label: 'evaluate for the free field' },
				{ from: 'free', to: 'free-M', label: 'entropy per mode' },
				{ from: 'free-M', to: 'free-dM', label: 'differentiate' }
			]
		},
		{
			id: 'phi4-monotone',
			title: 'The φ⁴ monotone to second order',
			section: 'Sec. V B',
			summary: t`Expand the derivative of the candidate monotone at the start of the flow in the quartic coupling. Schwinger–Dyson identities make the cross term exact, and propagator corrections the paper leaves out bring two new loop integrals. With the sign of derivation 6, $-\Lambda\,dM/d\Lambda = \delta^d(0)\big(\tfrac12 f_0 + \tfrac14\lambda f_1 - \lambda^2(\tfrac16 f_2 + \tfrac18 f_3 + \tfrac14 f_4)\big)$.`,
			nodes: [
				{
					id: 'action',
					title: 'φ⁴ theory',
					kind: 'assumption',
					tex: t`S_{\Lambda_0} = \tfrac12\int\frac{d^dp}{(2\pi)^d}\,\frac{\phi(p)\phi(-p)}{\widetilde K_{\Lambda_0}(p)} + \frac{\lambda}{4!}\int\frac{d^dp_1\cdots d^dp_4}{(2\pi)^{3d}}\,\phi(p_1)\cdots\phi(p_4)\,\delta^d\Big(\sum_i p_i\Big),\qquad \widetilde K_\Lambda(p) = \frac{K_\Lambda(p^2)}{p^2+m^2}`,
					detail: t`Polchinski's scheme: $\dot C_\Lambda = (2\pi)^d\,\Lambda\partial_\Lambda\widetilde K_\Lambda$, and $\hat S_\Lambda$ is the free part.`,
					ref: 'Eqs. (5.3)–(5.4), (5.7)'
				},
				{
					id: 'balance',
					title: 'Two competing terms',
					kind: 'assumption',
					from: 'monotonicity',
					tex: t`-\Lambda\frac{dM_\Lambda}{d\Lambda} = -\tfrac12\Big\langle\int d^dp\,(2\pi)^d\,\Lambda\partial_\Lambda\widetilde K\,\frac{\delta\Sigma}{\delta\phi(p)}\frac{\delta\Sigma}{\delta\phi(-p)}\Big\rangle - 2\big\langle\Lambda\partial_\Lambda\hat S\big\rangle`,
					ref: 'Eqs. (5.5)–(5.6)',
					correction: t`The paper's (5.5)–(5.6) have $+\tfrac12$, carried over from its (4.5) (derivation 6).`
				},
				{
					id: 'paper-integrals',
					title: "The paper's loop integrals",
					kind: 'assumption',
					tex: t`f_0 = \int d^dp\,\Lambda\partial_\Lambda\log\widetilde K,\qquad f_1 = \int d^dp\,\Lambda\partial_\Lambda\widetilde K(p)\,T_1,\qquad f_2 = \int d^dp\,\Lambda\partial_\Lambda\widetilde K(p)\int\frac{d^dq_1\,d^dq_2}{(2\pi)^{2d}}\,\widetilde K(p-q_1-q_2)\,\widetilde K(q_1)\,\widetilde K(q_2)`,
					detail: t`$f_1$ is a tadpole and $f_2$ the sunset. All are finite for suitable cutoffs (derivation 11).`,
					ref: 'Eqs. (5.8)–(5.10)'
				},
				{
					id: 'new-integrals',
					title: 'Two more loop integrals',
					kind: 'assumption',
					added: true,
					tex: t`T_n = \int\frac{d^dq}{(2\pi)^d}\,\widetilde K(q)^n,\qquad f_3 = f_1\,T_2,\qquad f_4 = T_1^2\int d^dp\,\Lambda\partial_\Lambda\widetilde K(p)\,\widetilde K(p)`,
					detail: t`Double tadpoles: $f_3$ puts the second tadpole on the loop, $f_4$ on the external line.`
				},
				{
					id: 'propagator',
					title: 'Propagator to second order',
					kind: 'step',
					added: true,
					tex: t`G = \widetilde K - \frac\lambda2\,\widetilde K^2\,T_1 + \lambda^2\,\widetilde K^2\Big(\frac{T_1T_2}{4} + \frac{\widetilde K\,T_1^2}{4} + \frac{\Sigma_{\text{sun}}}{6}\Big) + O(\lambda^3)`,
					detail: t`$\langle\phi(p)\phi(q)\rangle = (2\pi)^d\,\delta^d(p+q)\,G(p)$, and $\Sigma_{\text{sun}}(p)$ is the double integral in $f_2$. The paper's $\langle\phi\phi\rangle$ keeps only the sunset.`
				},
				{
					id: 'sd',
					title: 'Schwinger–Dyson',
					kind: 'assumption',
					added: true,
					tex: t`\Big\langle\frac{\delta S}{\delta\phi(p)}\,F\Big\rangle = \Big\langle\frac{\delta F}{\delta\phi(p)}\Big\rangle`,
					detail: t`Integrate the total derivative $\delta(F e^{-S})/\delta\phi$ over fields.`
				},
				{
					id: 'line1',
					title: 'Seed-action term',
					kind: 'step',
					tex: t`\big\langle -2\Lambda\partial_\Lambda\hat S\big\rangle = \delta^d(0)\Big(f_0 - \frac\lambda2 f_1 + \lambda^2\Big(\frac{f_2}{6} + \frac{f_3}{4} + \frac{f_4}{4}\Big)\Big)`,
					detail: t`Equals $\delta^d(0)\int d^dp\,\Lambda\partial_\Lambda\log\widetilde K\,G/\widetilde K$.`,
					ref: 'Eq. (5.11)',
					correction: t`The paper has $f_0 + \tfrac{\lambda^2}{6}f_2$: it drops the tadpole and double-tadpole corrections to $\langle\phi\phi\rangle$. Checked term by term on a 3-site lattice.`
				},
				{
					id: 'line2',
					title: 'Seed–seed term',
					kind: 'step',
					tex: t`2\Big\langle\int d^dp\,(2\pi)^d\,\Lambda\partial_\Lambda\widetilde K\,\frac{\delta\hat S}{\delta\phi(p)}\frac{\delta\hat S}{\delta\phi(-p)}\Big\rangle = 2\,\big\langle -2\Lambda\partial_\Lambda\hat S\big\rangle`,
					ref: 'Eq. (5.12)',
					correction: t`The paper has $2f_0 + \tfrac{\lambda^2}{3}f_2$, with the same omission.`
				},
				{
					id: 'line3',
					title: 'Cross term, exact',
					kind: 'step',
					tex: t`-2\Big\langle\int d^dp\,(2\pi)^d\,\Lambda\partial_\Lambda\widetilde K\,\frac{\delta S}{\delta\phi(p)}\frac{\delta\hat S}{\delta\phi(-p)}\Big\rangle = -2\,\delta^d(0)\,f_0`,
					ref: 'Eq. (5.13)',
					correction: t`The paper adds $-\lambda f_1 - \tfrac{2\lambda^2}{3}f_2$. With $F = \delta\hat S/\delta\phi(-p)$, which is linear in $\phi$, Schwinger–Dyson gives the field-independent $\delta^2\hat S/\delta\phi(p)\,\delta\phi(-p)$ at every order. Checked in 0-d: $\langle S'\hat S'\rangle = 1/v$ exactly for $\lambda = 0$, $0.1$ and $0.5$.`
				},
				{
					id: 'line4',
					title: 'Action–action term',
					kind: 'step',
					tex: t`\tfrac12\Big\langle\int d^dp\,(2\pi)^d\,\Lambda\partial_\Lambda\widetilde K\,\frac{\delta S}{\delta\phi(p)}\frac{\delta S}{\delta\phi(-p)}\Big\rangle = \delta^d(0)\Big(\frac{f_0}{2} + \frac\lambda4 f_1 - \frac{\lambda^2}{8}f_3\Big)`,
					ref: 'Eq. (5.14)',
					correction: t`The paper has $\tfrac12 f_0 + \tfrac\lambda2 f_1 + \tfrac{11\lambda^2}{24}f_2$. Schwinger–Dyson turns the term into $\tfrac12\langle\delta^2 S/\delta\phi(p)\,\delta\phi(-p)\rangle$, which sees $\langle\phi\phi\rangle$ only inside the tadpole loop, so no sunset appears.`
				},
				{
					id: 'exact',
					title: 'All orders',
					kind: 'step',
					added: true,
					tex: t`-\Lambda\frac{dM_\Lambda}{d\Lambda} = \delta^d(0)\Big(\frac32 f_0 - \int d^dp\,\Lambda\partial_\Lambda\log\widetilde K\,\frac{G(p)}{\widetilde K(p)} - \frac\lambda4\int d^dp\,\Lambda\partial_\Lambda\widetilde K(p)\int\frac{d^dq}{(2\pi)^d}\,G(q)\Big)`,
					detail: t`$(5.11) - (5.12) - (5.13) - (5.14)$, exact in $\lambda$ given the full propagator $G$. At strong coupling the last term wins and the derivative turns negative (derivation 6).`
				},
				{
					id: 'result',
					title: 'Second-order result',
					kind: 'result',
					tex: t`-\Lambda\frac{dM_\Lambda}{d\Lambda}\Big|_{\Lambda_0} = \delta^d(0)\Big(\frac12 f_0 + \frac\lambda4 f_1 - \lambda^2\Big(\frac{f_2}{6} + \frac{f_3}{8} + \frac{f_4}{4}\Big) + O(\lambda^3)\Big)`,
					detail: t`Positive at weak coupling.`,
					ref: 'Eq. (5.15)',
					correction: t`The paper has $\tfrac32 f_0 - \tfrac12\lambda f_1 + \tfrac{7}{24}\lambda^2 f_2$, the plain sum of its four lines. Checked on a 3-site lattice by brute-force integration: the fitted coefficients agree with these to 6 digits (for $\lambda$: $0.257156$ against $0.257156$).`
				}
			],
			edges: [
				{ from: 'action', to: 'propagator', label: 'perturbation theory' },
				{ from: 'propagator', to: 'line1', label: t`$\langle\phi\phi\rangle = G$` },
				{ from: 'line1', to: 'line2', label: 'same integrand, twice' },
				{ from: 'sd', to: 'line3', label: t`$F = \delta\hat S/\delta\phi$` },
				{ from: 'sd', to: 'line4', label: t`$F = \delta S/\delta\phi$` },
				{ from: 'propagator', to: 'line4', label: 'G inside the loop' },
				{
					from: 'balance',
					to: 'exact',
					label: t`expand $\Sigma = S - 2\hat S$`,
					detail: t`$-\tfrac12\langle\dot C(\delta\Sigma)^2\rangle$ splits into minus (5.12), (5.13) and (5.14); $-2\langle\Lambda\partial_\Lambda\hat S\rangle$ is (5.11).`
				},
				{ from: 'line1', to: 'exact', label: '+ (5.11)' },
				{ from: 'line2', to: 'exact', label: '− (5.12)' },
				{ from: 'line3', to: 'exact', label: '− (5.13)' },
				{ from: 'line4', to: 'exact', label: '− (5.14)' },
				{ from: 'exact', to: 'result', label: 'insert G' },
				{ from: 'propagator', to: 'result', label: 'to second order' },
				{ from: 'paper-integrals', to: 'result', label: 'name the integrals' },
				{ from: 'new-integrals', to: 'result', label: 'name the integrals' }
			]
		},
		{
			id: 'variational',
			title: 'Variational RG: a JKO scheme',
			section: 'Sec. VI',
			summary: t`Gradient flows can be approximated by implicit Euler steps, each a minimisation: the JKO scheme. For RG, each step minimises a Wasserstein penalty plus the relative entropy. Optimising over transport maps removes the inner infimum, and changing variables writes the objective as an expectation over the initial distribution, so samples and stochastic gradient descent suffice, e.g. with convolutional networks.`,
			nodes: [
				{
					id: 'flow',
					title: 'Gradient flow',
					kind: 'assumption',
					tex: t`\frac{dX}{dt} = -\nabla F(X)`,
					ref: 'Eq. (6.1)'
				},
				{
					id: 'euler',
					title: 'Implicit Euler as a minimisation',
					kind: 'step',
					tex: t`\frac{X_{(n+1)\tau} - X_{n\tau}}{\tau} = -\nabla F(X_{(n+1)\tau})\ \Leftrightarrow\ X_{(n+1)\tau} = \operatorname*{arg\,min}_X\Big(\frac{|X - X_{n\tau}|^2}{2\tau} + F(X)\Big)`,
					detail: t`The stationarity condition of the minimisation is the implicit step.`,
					ref: 'Eqs. (6.2)–(6.3)'
				},
				{
					id: 'jko',
					title: 'JKO scheme',
					kind: 'result',
					tex: t`X_{(n+1)\tau} = \operatorname*{arg\,min}_X\Big(\frac{d(X,X_{n\tau})^2}{2\tau} + F(X)\Big),\qquad \sup_{n\le T/\tau}d\big(X_{n\tau},X(n\tau)\big)\to0`,
					detail: t`Converges in many cases (Ambrosio, Gigli and Savaré). For the entropy on Wasserstein space it reproduces the heat equation (Jordan, Kinderlehrer and Otto).`,
					ref: 'Eqs. (6.4)–(6.5)'
				},
				{
					id: 'main',
					title: 'RG is a gradient flow',
					kind: 'assumption',
					from: 'gradient-flow',
					tex: t`-\Lambda\frac{d}{d\Lambda}P_\Lambda = -\nabla_{\mathcal W_2}S(P_\Lambda\|Q_\Lambda)`
				},
				{
					id: 'reparam',
					title: 'Reparametrized distribution',
					kind: 'assumption',
					tex: t`P^{\mathcal R}_{\Lambda_0}[\phi] = \Big|\frac{\delta\mathcal R[\phi]}{\delta\phi}\Big|\,P_{\Lambda_0}\big[\mathcal R[\phi]\big] = \mathcal R^{-1}_{*}P_{\Lambda_0}`,
					detail: t`Wegner–Morris flow is a reparametrization (derivation 2), so flowed distributions have this form.`,
					ref: 'Eqs. (6.6)–(6.7)'
				},
				{
					id: 'rg-jko',
					title: 'One RG step',
					kind: 'step',
					tex: t`P_{\Lambda_0e^{-\tau}}\approx P^{\mathcal R_\tau}_{\Lambda_0},\qquad \mathcal R_\tau = \operatorname*{arg\,min}_{\mathcal R}\Big(\frac{\mathcal W_2\big(P^{\mathcal R}_{\Lambda_0},P_{\Lambda_0}\big)^2}{2\tau} + S\big(P^{\mathcal R}_{\Lambda_0}\big\|Q_{\Lambda_0}\big)\Big)`,
					detail: t`A JKO step in field space. It is not unique, since many $\mathcal R$ give the same distribution; this is harmless because only $P^{\mathcal R}$ matters. Iterating with $Q_{\Lambda_0e^{-n\tau}}$ gives (6.10)–(6.12).`,
					ref: 'Eqs. (6.8)–(6.9)',
					correction: t`The paper writes $P_{\Lambda_0-\tau}$. The flow (3.7) runs in $t = -\log\Lambda$, so a step $\tau$ reaches $\Lambda_0e^{-\tau}\approx\Lambda_0(1-\tau)$.`
				},
				{
					id: 'w2',
					title: 'Field-space distance',
					kind: 'assumption',
					from: 'gradient-flow',
					tex: t`\mathcal W_2(P_1,P_2)^2 = \inf_{\Pi\in\Gamma(P_1,P_2)} 2\int[d\phi_1][d\phi_2]\,\Pi\int d^dx\,d^dy\,\dot C_\Lambda^{-1}(x,y)\,\delta\phi(x)\,\delta\phi(y)`
				},
				{
					id: 'monge',
					title: 'Monge form',
					kind: 'step',
					tex: t`\mathcal W_2\big(P^{\mathcal R}_{\Lambda_0},P_{\Lambda_0}\big)^2 = \inf_{\mathcal F_*P_{\Lambda_0} = P^{\mathcal R}_{\Lambda_0}}\mathsf M_{P_{\Lambda_0}}[\mathcal F],\qquad \mathsf M_P[\mathcal F] = 2\int[d\phi]\,P\int d^dx\,d^dy\,\dot C^{-1}_\Lambda(x,y)\,\big(\phi - \mathcal F[\phi]\big)(x)\,\big(\phi - \mathcal F[\phi]\big)(y)`,
					detail: t`Assumes the optimal coupling is a map, as Brenier's theorem guarantees in finite dimensions for smooth densities.`,
					ref: 'Eq. (6.14)'
				},
				{
					id: 'merge',
					title: 'Nested minimisation',
					kind: 'step',
					tex: t`\mathcal R_\tau = \operatorname*{arg\,min}_{\mathcal R}\ \inf_{\mathcal F_*P_{\Lambda_0} = P^{\mathcal R}_{\Lambda_0}}\Big(\frac{\mathsf M_{P_{\Lambda_0}}[\mathcal F]}{2\tau} + S\big(\mathcal F_*P_{\Lambda_0}\big\|Q_{\Lambda_0}\big)\Big)`,
					ref: 'Eqs. (6.15)–(6.16)'
				},
				{
					id: 'single',
					title: 'One minimisation over maps',
					kind: 'result',
					tex: t`P_{\Lambda_0e^{-\tau}}\approx\mathcal F_{\tau*}P_{\Lambda_0},\qquad \mathcal F_\tau = \operatorname*{arg\,min}_{\mathcal F}\Big(\frac{\mathsf M_{P_{\Lambda_0}}[\mathcal F]}{2\tau} + S\big(\mathcal F_*P_{\Lambda_0}\big\|Q_{\Lambda_0}\big)\Big)`,
					detail: t`One minimisation does the reparametrization and the transport at once.`,
					ref: 'Eqs. (6.17)–(6.18)'
				},
				{
					id: 'compose',
					title: 'Step after step',
					kind: 'step',
					tex: t`\mathcal F_{(n+1)\tau} = \operatorname*{arg\,min}_{\mathcal F}\Big(\frac{\mathsf M_{\widetilde{\mathcal F}_{n\tau*}P_{\Lambda_0}}[\mathcal F]}{2\tau} + S\big((\mathcal F\circ\widetilde{\mathcal F}_{n\tau})_*P_{\Lambda_0}\big\|Q_{\Lambda_n}\big)\Big),\qquad \widetilde{\mathcal F}_{n\tau} = \mathcal F_{n\tau}\circ\cdots\circ\mathcal F_\tau`,
					detail: t`$\Lambda_n = \Lambda_0e^{-n\tau}$. The new map acts on the distribution already flowed $n$ steps.`,
					ref: 'Eqs. (6.19)–(6.21)',
					correction: t`The paper defines $\widetilde{\mathcal F}_{n\tau} = \mathcal F_\tau\circ\cdots\circ\mathcal F_{n\tau}$ in (6.19) and composes in that order in Algorithm 1, which applies the last step's map first. Its (6.20)–(6.22) apply $\mathcal F_\tau$ first, as the step-by-step construction requires; the pullback in (6.23) follows the same order.`
				},
				{
					id: 'expect',
					title: 'Expectations over the start',
					kind: 'step',
					tex: t`\mathsf M = \mathbb E_{P_{\Lambda_0}}\Big[2\int d^dx\,d^dy\,\dot C^{-1}_\Lambda(x,y)\,\Delta(x)\,\Delta(y)\Big],\qquad \Delta = \widetilde{\mathcal F}_{n\tau}[\phi] - \mathcal F\circ\widetilde{\mathcal F}_{n\tau}[\phi],\qquad S = \mathbb E_{P_{\Lambda_0}}\Big[\log\frac{P_{\Lambda_0}}{Q^{\mathcal F\circ\widetilde{\mathcal F}_{n\tau}}_{\Lambda_n}}\Big]`,
					detail: t`Change variables through the maps. Relative entropy is invariant under them: $S(f_*p\|q) = S(p\|f^{-1}_*q)$, and $Q^{g} = |\delta g/\delta\phi|\,Q[g[\phi]]$ is the pullback.`,
					ref: 'Eqs. (6.22)–(6.23)'
				},
				{
					id: 'loss',
					title: 'A loss over samples',
					kind: 'result',
					tex: t`\mathcal F_{(n+1)\tau} = \operatorname*{arg\,min}_{\mathcal F}\ \mathbb E_{P_{\Lambda_0}}\,\mathsf{Loss}\big[\mathcal F,\widetilde{\mathcal F}_{n\tau},P_{\Lambda_0},Q_{\Lambda_n}\big]`,
					detail: t`An expectation over the initial distribution, so with Monte Carlo samples of $P_{\Lambda_0}$ (on a finite lattice) the gradient in the network parameters can be estimated sample by sample (Algorithm 2). The natural ansatz is a translation-equivariant, local convolutional network in ResNet form, $\mathrm{Id} + \mathcal F_\theta$, which keeps the Jacobian invertible.`,
					ref: 'Eqs. (6.24)–(6.26)'
				}
			],
			edges: [
				{ from: 'flow', to: 'euler', label: 'implicit Euler' },
				{ from: 'euler', to: 'jko', label: 'replace |X − Y| by a distance' },
				{ from: 'jko', to: 'rg-jko', label: 'apply in field space' },
				{ from: 'main', to: 'rg-jko', label: t`$F = S(P\|Q)$, $d = \mathcal W_2$` },
				{ from: 'reparam', to: 'rg-jko', label: 'search over reparametrizations' },
				{ from: 'w2', to: 'monge', label: 'optimal coupling is a map' },
				{ from: 'rg-jko', to: 'merge', label: 'insert (6.14)' },
				{ from: 'monge', to: 'merge', label: 'Monge form' },
				{
					from: 'merge',
					to: 'single',
					label: 'optimise over maps directly',
					detail: t`For fixed $\mathcal R$ the infimum picks an $\mathcal F$ with $\mathcal F_*P_{\Lambda_0} = P^{\mathcal R}_{\Lambda_0}$. Only the flowed distribution matters, so $\mathcal R$ can go.`
				},
				{ from: 'single', to: 'compose', label: 'iterate' },
				{ from: 'compose', to: 'expect', label: 'change variables' },
				{ from: 'expect', to: 'loss', label: 'collect into one expectation' }
			]
		},
		{
			id: 'w2-infinitesimal',
			title: 'Why the metric is infinitesimal W₂',
			section: 'App. A',
			summary: t`Why $\int p\,A^{ij}\,\partial_i\bar\eta_1\,\partial_j\bar\eta_2$ is the infinitesimal Wasserstein-2 distance with cost $A_{ij}$. The energy of a path of densities bounds the transport cost of the flow map that the path generates, so half the squared distance is at most the least path energy. Equality takes more work and is cited.`,
			nodes: [
				{
					id: 'heat',
					title: 'Anisotropic heat flow',
					kind: 'assumption',
					tex: t`\partial_t p = A^{ij}\,\partial_i\partial_j p,\qquad A_{ij}A^{jk} = \delta_i^k`,
					detail: t`$A^{ij}$ positive definite.`,
					ref: 'Eq. (A.1)'
				},
				{
					id: 'metric',
					title: 'Metric with A',
					kind: 'assumption',
					tex: t`A^{ij}\,\partial_i\big(p\,\partial_j\bar\eta\big) = \eta,\qquad \langle\eta_1,\eta_2\rangle_{\mathcal W_2} = \int dx\,p\,A^{ij}\,\partial_i\bar\eta_1\,\partial_j\bar\eta_2`,
					ref: 'Eqs. (A.2)–(A.4)'
				},
				{
					id: 'grad',
					title: 'Heat flow climbs the entropy',
					kind: 'result',
					tex: t`\partial_t p = \nabla_{\mathcal W_2}S[p],\qquad \nabla_{\mathcal W_2}S = A^{ij}\,\partial_i\partial_j p`,
					ref: 'Eq. (A.5)'
				},
				{
					id: 'w2',
					title: 'Distance with cost A',
					kind: 'assumption',
					tex: t`\mathcal W_2(p_0,p_1)^2 = \inf_{\pi\in\Gamma(p_0,p_1)}\int dx\,dy\,\pi(x,y)\,A_{ij}\,(x-y)^i(x-y)^j`,
					ref: 'App. A'
				},
				{
					id: 'energy',
					title: 'Length and energy',
					kind: 'assumption',
					tex: t`L[x] = \int_0^1du\,\sqrt{A_{ij}\,\dot x^i\dot x^j},\qquad E[x] = \tfrac12\int_0^1du\,A_{ij}\,\dot x^i\dot x^j,\qquad L^2 \le 2E`,
					detail: t`Cauchy–Schwarz, with equality at constant speed, so $\inf L^2 = \inf 2E$ over paths with fixed ends.`,
					ref: 'Eqs. (A.6)–(A.9)'
				},
				{
					id: 'path',
					title: 'Path of densities',
					kind: 'assumption',
					tex: t`\partial_u p(u) = A^{ij}\,\partial_i\big(p(u)\,\partial_j\phi\big),\qquad E_{\mathcal W_2}[p(u)] = \tfrac12\int_0^1du\int dx\,p\,A^{ij}\,\partial_i\phi\,\partial_j\phi`,
					detail: t`$u$ runs along the path from $p_0$ to $p_1$; it is not the time of the heat flow.`,
					ref: 'Eqs. (A.10)–(A.11)'
				},
				{
					id: 'flowmap',
					title: 'The path is a pushforward',
					kind: 'step',
					tex: t`V^i = -A^{ij}\,\partial_j\phi,\qquad \partial_u\Phi_u = V(\Phi_u,u),\quad \Phi_0 = \mathrm{Id}\ \Rightarrow\ p(u) = \Phi_{u*}p_0`,
					detail: t`One step: $p(\Phi_{-du}(x),u)\,|\det\partial\Phi_{-du}| = p + du\,A^{ij}\,\partial_i(p\,\partial_j\phi)$, which is $p(u+du)$.`,
					ref: 'Eqs. (A.12)–(A.20)'
				},
				{
					id: 'pointwise',
					title: 'Each point moves at most its path energy',
					kind: 'step',
					tex: t`A_{ij}\,\big(x - \Phi_1(x)\big)^i\big(x - \Phi_1(x)\big)^j \le \int_0^1du\,A_{ij}\,\partial_u\Phi_u^i\,\partial_u\Phi_u^j`,
					detail: t`The distance between a curve's ends is at most its length, and $L^2 \le 2E$.`,
					ref: 'Eq. (A.21)'
				},
				{
					id: 'plan',
					title: 'Try the flow map as a coupling',
					kind: 'step',
					tex: t`\tfrac12\,\mathcal W_2(p_0,p_1)^2 \le \tfrac12\int dx\,p_0\,A_{ij}\,\big(x - \Phi_1(x)\big)^i\big(x - \Phi_1(x)\big)^j`,
					detail: t`Take $\pi(x,y) = p_0(x)\,\delta(y - \Phi_1(x))$, which need not be optimal.`,
					ref: 'Eq. (A.22)'
				},
				{
					id: 'bound',
					title: 'Distance bounded by energy',
					kind: 'result',
					tex: t`\tfrac12\,\mathcal W_2(p_0,p_1)^2 \le E_{\mathcal W_2}[p(u)]`,
					detail: t`Average the pointwise bound over $p_0$ and change variables to $p(u) = \Phi_{u*}p_0$.`,
					ref: 'Eqs. (A.23)–(A.26)'
				},
				{
					id: 'equality',
					title: 'Geodesic distance',
					kind: 'result',
					tex: t`\tfrac12\,\mathcal W_2(p_0,p_1)^2 = \inf_{p(u)}E_{\mathcal W_2}[p(u)],\qquad \mathcal W_2(p_0,p_1) = \inf_{p(u)}\int_0^1du\,\Big(\int dx\,p\,A^{ij}\,\partial_i\phi\,\partial_j\phi\Big)^{1/2}`,
					detail: t`The reverse inequality is the hard part (Benamou–Brenier; Otto and Westdickenberg, Lemma 4.3) and is cited, not proven. So $\mathcal W_2$ is the geodesic distance of the metric (A.4).`,
					ref: 'Eqs. (A.27)–(A.29)',
					correction: t`The paper's length (A.28) puts the square root inside the $x$-integral. The length of a path of densities is $\int du\,\|\partial_u p\|_{\mathcal W_2}$, with the root outside.`
				}
			],
			edges: [
				{ from: 'heat', to: 'grad', label: 'as in derivation 3' },
				{ from: 'metric', to: 'grad', label: 'gradient of the entropy' },
				{ from: 'path', to: 'flowmap', label: 'integrate the velocity' },
				{ from: 'flowmap', to: 'pointwise', label: 'follow one point' },
				{ from: 'energy', to: 'pointwise', label: t`$L^2 \le 2E$` },
				{ from: 'w2', to: 'plan', label: 'any coupling bounds the infimum' },
				{ from: 'flowmap', to: 'plan', label: t`$\Phi_1$ pushes $p_0$ to $p_1$` },
				{ from: 'plan', to: 'bound', label: 'chain the bounds' },
				{ from: 'pointwise', to: 'bound', label: t`average over $p_0$` },
				{ from: 'path', to: 'bound', label: 'path energy' },
				{ from: 'bound', to: 'equality', label: 'plus the reverse inequality' },
				{ from: 'energy', to: 'equality', label: 'length vs energy' }
			]
		},
		{
			id: 'cutoff-functions',
			title: 'Cutoffs that keep the monotone finite',
			section: 'App. B',
			summary: t`The derivative of the free monotone is finite only if $\int d^dp\,\Lambda\partial_\Lambda\log K_\Lambda$ converges. The usual Fermi-type cutoff fails, because lowering $\Lambda$ suppresses high modes by a factor that grows with $p^2$. Cutoffs that change only in a thin shell $\Lambda^2 \le p^2 \le \Lambda^2+\varepsilon$, built from a bump function, pass.`,
			nodes: [
				{
					id: 'need',
					title: 'Free monotone derivative',
					kind: 'assumption',
					from: 'free-monotone',
					tex: t`-\Lambda\frac{d}{d\Lambda}M^{\text{free}}_\Lambda = \tfrac12\,\delta^d(0)\int d^dp\,\Lambda\partial_\Lambda\log K_\Lambda(p^2)`
				},
				{
					id: 'condition',
					title: 'Finiteness condition',
					kind: 'step',
					tex: t`\int d^dp\,\Lambda\partial_\Lambda\log K_\Lambda(p^2) < \infty`,
					detail: t`Also needed for $f_0, \dots, f_4$ in derivation 8.`,
					ref: 'Eq. (B.1)'
				},
				{
					id: 'fermi',
					title: 'Fermi-type cutoff',
					kind: 'assumption',
					tex: t`K(p^2/\Lambda^2) = \frac{1 + e^{-a}}{1 + e^{a((p/\Lambda)^2 - 1)}},\qquad a \gg 1`,
					ref: 'Eq. (B.2)'
				},
				{
					id: 'fails',
					title: 'It diverges',
					kind: 'result',
					tex: t`\Lambda\partial_\Lambda\log K \to \frac{2a\,p^2}{\Lambda^2}\quad(p\to\infty)\ \Rightarrow\ \int d^dp\,\Lambda\partial_\Lambda\log K = \infty`,
					detail: t`Every high mode is suppressed further as $\Lambda$ falls, by a factor that grows with $p^2$. The paper states the weaker bound $1/|p|^d$.`,
					ref: 'App. B'
				},
				{
					id: 'requirements',
					title: 'Requirements',
					kind: 'assumption',
					tex: t`K_\Lambda = 1\ (p^2 \le \Lambda^2);\quad K_\Lambda \text{ decreasing } (p^2 \ge \Lambda^2);\quad K_\Lambda \le \varepsilon\ (p^2 \ge \Lambda^2 + \varepsilon);\quad \text{(B.1)}`,
					ref: 'Eq. (B.3)'
				},
				{
					id: 'bump',
					title: 'Bump function',
					kind: 'assumption',
					tex: t`B(x) = \exp\Big(1 - \frac1{1-x^2}\Big)\ \ (|x| \le 1),\qquad B(x) = 0\ \ (|x| > 1)`,
					detail: t`Smooth, with $B(0) = 1$ and every derivative vanishing at $|x| = 1$.`,
					ref: 'Eq. (B.4)'
				},
				{
					id: 'construction',
					title: 'Shell cutoff',
					kind: 'step',
					tex: t`K_\Lambda(p^2) = \begin{cases} 1 & p^2 \le \Lambda^2 \\ (1-\varepsilon)\,B\big(\tfrac{p^2-\Lambda^2}{\varepsilon}\big) + \varepsilon & \Lambda^2 \le p^2 \le \Lambda^2+\varepsilon \\ \varepsilon & \Lambda^2+\varepsilon \le p^2 \le \Lambda_{\max}^2+\varepsilon \\ \varepsilon\,e^{-(p^2-\Lambda_{\max}^2-\varepsilon)} & p^2 > \Lambda_{\max}^2+\varepsilon \end{cases}`,
					detail: t`Shown for $\Lambda \le \Lambda_{\max}$, Eq. (B.6). (B.5) is the case $\Lambda = \Lambda_{\max}$, and (B.7) sharpens the shell above $\Lambda_{\max}$ to meet the same exponential tail.`,
					ref: 'Eqs. (B.5)–(B.7)'
				},
				{
					id: 'shell',
					title: 'Only the shell moves',
					kind: 'step',
					tex: t`\Lambda\partial_\Lambda K_\Lambda(p^2) = 0\quad\text{outside}\quad \Lambda^2 \le p^2 \le \Lambda^2+\varepsilon`,
					ref: 'App. B'
				},
				{
					id: 'passes',
					title: 'It converges',
					kind: 'result',
					tex: t`\int d^dp\,\Lambda\partial_\Lambda\log K_\Lambda(p^2) < \infty`,
					detail: t`The integrand is continuous and compactly supported. The tail above $\Lambda_{\max}$ is not suppressed further as $\Lambda$ falls; $\Lambda$-dependent tails could add that. $K_\Lambda$ has a kink at the start of the tail, which is harmless because the flows never differentiate $K_\Lambda$ in $p$.`,
					ref: 'App. B'
				}
			],
			edges: [
				{ from: 'need', to: 'condition', label: 'finite only if' },
				{ from: 'condition', to: 'fails', label: 'test' },
				{ from: 'fermi', to: 'fails', label: 'large-p behaviour' },
				{ from: 'requirements', to: 'construction', label: 'satisfy 1–3' },
				{ from: 'bump', to: 'construction', label: 'smooth step' },
				{ from: 'construction', to: 'shell', label: 'differentiate in Λ' },
				{ from: 'shell', to: 'passes', label: 'compact support' },
				{ from: 'condition', to: 'passes', label: 'test' }
			]
		}
	]
};
