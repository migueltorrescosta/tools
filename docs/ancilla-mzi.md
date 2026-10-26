# Ancilla vs MZI: how it works

The exact model, accounting rules and metrics behind `/ancilla-mzi`. The page's "How it works" gives the short version.

## The model

Take $N=N_S+N_A$ two-level particles: a system register S and an ancilla register A. The ancilla scheme evolves under $H=\omega\,(J_z^S+a\,J_z^A)+\sum_{ij}\alpha_{ij}J_i^SJ_j^A+\boldsymbol b\cdot\boldsymbol J^A+\boldsymbol c\cdot\boldsymbol J^S$ for a hold $t=1$, so every rate is in units of 1/t and every QFI in units of t². Its generator is $\partial H/\partial\omega=J_z^S+a\,J_z^A$: the ancilla weight $a$ is $a=0$ for a passive ancilla and $a=1$ for an active one.

Switch on any coupling entry $\alpha_{ij}$ (for example only $\alpha_{zz}$) and any field axis of $\boldsymbol b,\boldsymbol c$. The optimiser keeps $|\alpha_{ij}|,|b_i|,|c_i|\le B/t$, with B the control bound. Add up to $K\le4$ instantaneous pulses $e^{-i(\boldsymbol v_A\cdot\boldsymbol J^A+\boldsymbol v_S\cdot\boldsymbol J^S)}$ at times you pick (by default $t_m=mt/(K+1)$), on A, S or both, with $|v_i|\le2\pi$. The input is optimised over $\mathrm{Sym}(S)\otimes\mathrm{Sym}(A)$ or over all $2^N$ states.

The baseline is a Mach-Zehnder interferometer (MZI) with $H_{\rm MZI}=\omega\,J_z^T$. It gets the same particles and noise, its best input (see-saw over the full space and over Sym) and its best interrogation window $t'\le t$. When some noise isn't phase covariant (transverse dephasing, Lorentzian damping), the MZI may also add a bounded static bias: $H_{\rm MZI}=(\omega+\beta)\,J_z^T$.

## The four rules

1. **Equal particles.** The MZI gets all N particles, the ancilla counted.
2. **Bounded generator.** With the seminorm $\|X\|_s=\lambda_{\max}(X)-\lambda_{\min}(X)$, keep $\|\partial H/\partial\omega\|_s=N_S+a\,N_A\le N$. So $a>1$ breaks it.
3. **Equal time.** Both schemes hold for t.
4. **Equal noise on every particle.** The ancilla carries the system's noise. A clean ancilla breaks it.

Nobody measures or feeds back during the hold. The overrides under Accounting each break one rule on purpose, and the Rules panel says so.

## Metrics

- $R=\mathcal F_Q^{\rm anc}/F_{\rm MZI}^{\rm opt}$: the scheme's QFI over the MZI's best.
- $R_{\rm fixed}$: the same, but the MZI holds for the full $t'=t$.
- $R_{\rm std}$: against the MZI's best standard input (product, NOON, twin-Fock or one-axis twisted), each at its own window.
- $\delta R=\frac{|\mathcal F_{2M}-\mathcal F_M|}{\mathcal F_M}+\frac{\mathcal F_1-\mathcal F_2}{\mathcal F_1}$: the change when the best optimum is rerun at $2M$ Strang steps instead of $M$, plus the gap between the two best seeds. Call a gain real when $R\ge1+\max(0.01,\,3\,\delta R)$.
- $R_{\rm int}=\mathcal F^{\rm setup}/\mathcal F^{\rm companion}$: the same setup with $\alpha=0$, optimised alongside. Shown only when the setup has a coupling.
- Readouts: $F_{J_z}=|\partial_\omega\langle J_z\rangle|^2/\mathrm{Var}(J_z)$ on S, a weighted joint $J_z$ on both registers, and parity $\Pi=\prod_k\sigma_z^{(k)}$, each after its best final rotation. The tiles show the best readout ratio and the attained fraction $F_{\rm readout}/\mathcal F_Q$. These are simple collective readouts (one rotation per register), so they can fall far below the QFI for entangled optima.
- Bounds, drawn on the convergence plot: the noiseless $\mathcal F_Q\le\Big(\int_0^T\|\partial_\omega H\|_s\,dt\Big)^2$, and for $\sigma_z$ dephasing the parallel channel-extension bound $\max_{t'\le t}\,N\,t'^2\,\frac{\eta^2}{1-\eta^2}$ with $\eta=e^{-\gamma t'}$. It bounds parallel schemes only: controlled, sequential schemes like the ancilla's may exceed it.

## Noise

Pick any mix, each with its own rate $\gamma$, on each register. The Markovian channels add jump operators to $\dot\rho=-i[H,\rho]+\sum_k\big(L_k\rho L_k^\dagger-\tfrac12\{L_k^\dagger L_k,\rho\}\big)$, combined into one exact step per site per Strang step:

- Dephasing: $L=\sqrt{\gamma/2}\,\sigma_z$, coherence falls as $e^{-\gamma t}$.
- Amplitude damping: $L=\sqrt{\gamma(\bar n+1)}\,\sigma_-$; a thermal bath adds $L=\sqrt{\gamma\bar n}\,\sigma_+$.
- Depolarizing: $L_a=\sqrt{\gamma/4}\,\sigma_a,\ a=x,y,z$.
- Transverse dephasing: $L=\sqrt{\gamma/2}\,\sigma_x$. It isn't phase covariant.
- Lorentzian dephasing: $H_{\rm int}=\sqrt{\gamma\lambda}\,s_z(b+b^\dagger)$ with a pseudomode damped at $2\lambda$. Coherence falls as $e^{-\Gamma(t)}$ with $\Gamma(t)=\gamma\,[t-(1-e^{-\lambda t})/\lambda]$. That closed form holds while the dynamics commute with $s_z$; otherwise the tool runs explicit pseudomodes, only at $N_S=N_A=1$ and with a Fock cutoff $d\le3$.
- Lorentzian damping: $H_{\rm int}=\sqrt{\gamma\lambda/2}\,(\sigma_+b+\sigma_-b^\dagger)$, an exact pseudomode with $d=2$, only at $N_S=N_A=1$.

Use at most one Lorentzian bath per run. When the ancilla carries other noise, the MZI mirrors the split: $N_S$ of its particles get the system's noise and $N_A$ the ancilla's.

## Running

Press Run. The MZI baseline comes first, then seeds run on Web Workers until you press Stop: seed 0 starts with every control off, later seeds start at random. Continue picks up where you stopped. Everything runs in your browser; the share link carries the setup, never results.
