import type { Paper } from '../types';

// TeX and prose are raw strings, so backslashes need no escaping.
const t = String.raw;

export const shannonCommunication: Paper = {
	id: 'shannon-communication',
	title: 'A Mathematical Theory of Communication',
	authors: 'C. E. Shannon',
	venue: 'Bell System Technical Journal 27, 379–423 and 623–656 (1948)',
	url: 'https://doi.org/10.1002/j.1538-7305.1948.tb01338.x',
	numbering:
		'Shannon numbers few equations, so references are to his sections, theorems and appendices. Logarithms are base 2 (bits) unless stated.',
	derivations: [
		{
			id: 'noiseless-capacity',
			title: 'Capacity of a discrete noiseless channel',
			section: 'Sec. 1, Theorem 1, Appendix 1',
			summary: t`Counting the signals a channel allows: the number of signals of duration $t$ grows like $X_0^t$, so the capacity is $\log X_0$. For the telegraph this gives $0.539$ bits per unit time.`,
			nodes: [
				{
					id: 'definition',
					title: 'Capacity by counting',
					kind: 'assumption',
					tex: t`C = \lim_{T\to\infty}\frac{\log N(T)}{T}`,
					detail: t`$N(T)$ is the number of allowed signals of duration $T$. For a teletype with 32 equally long symbols, any order allowed, this gives 5 bits per symbol time.`,
					ref: 'Sec. 1, Definition',
					correction: t`The limit need not exist in general; Shannon says it does "in most cases of interest". Using $\limsup$ makes the definition always meaningful, and the limit exists for the finite-state channels below.`
				},
				{
					id: 'symbols',
					title: 'Symbols with durations',
					kind: 'assumption',
					tex: t`S_1, \dots, S_n \text{ with durations } t_1, \dots, t_n`,
					detail: t`At first, any sequence of symbols is allowed.`,
					ref: 'Sec. 1'
				},
				{
					id: 'recursion',
					title: 'Count by the last symbol',
					kind: 'step',
					tex: t`N(t) = N(t - t_1) + N(t - t_2) + \dots + N(t - t_n)`,
					detail: t`Every signal of duration $t$ ends in exactly one of the $S_i$, preceded by an allowed signal of duration $t - t_i$.`,
					ref: 'Sec. 1'
				},
				{
					id: 'growth',
					title: 'Exponential growth',
					kind: 'step',
					tex: t`N(t) \sim A\,X_0^{\,t},\qquad X_0^{-t_1} + X_0^{-t_2} + \dots + X_0^{-t_n} = 1`,
					detail: t`A linear recurrence grows like the power of its largest real characteristic root. The left side is decreasing in $X$, so the root $X_0 > 1$ is unique.`,
					ref: 'Sec. 1'
				},
				{
					id: 'capacity',
					title: 'Capacity',
					kind: 'result',
					tex: t`C = \log X_0`,
					ref: 'Sec. 1'
				},
				{
					id: 'states',
					title: 'Constraints as states',
					kind: 'assumption',
					tex: t`b^{(s)}_{ij} = \text{duration of the } s\text{-th symbol allowed in state } i \text{, leading to state } j`,
					detail: t`Rules such as "no two spaces in a row" are a finite-state graph: each state allows some symbols and each symbol moves to a new state.`,
					ref: 'Sec. 1, Fig. 2'
				},
				{
					id: 'theorem1',
					title: 'Theorem 1',
					kind: 'result',
					tex: t`C = \log W,\qquad W = \text{largest real root of }\ \Big|\sum_s W^{-b^{(s)}_{ij}} - \delta_{ij}\Big| = 0`,
					detail: t`Count signals by the state they end in: $N_j(t) = \sum_{i,s} N_i(t - b^{(s)}_{ij})$. Trying $N_j = A_j W^t$ gives a linear system with a non-zero solution only when the determinant vanishes.`,
					ref: 'Theorem 1, Appendix 1'
				},
				{
					id: 'telegraph',
					title: 'Telegraph',
					kind: 'result',
					tex: t`1 = X^{-2} + X^{-4} + X^{-5} + X^{-7} + X^{-8} + X^{-10}\ \Rightarrow\ C = \log X_0 = 0.539`,
					detail: t`Dot 2 units, dash 4, letter space 3, word space 6, and no two spaces in a row: a space is always followed by a dot or a dash, which gives the durations $2, 4$ and $3{+}2, 3{+}4, 6{+}2, 6{+}4$. Checked numerically: $0.5389$ bits per unit time.`,
					ref: 'Sec. 1'
				}
			],
			edges: [
				{ from: 'symbols', to: 'recursion', label: 'condition on the last symbol' },
				{
					from: 'recursion',
					to: 'growth',
					label: 'theory of finite differences',
					detail: t`Insert $N(t) = X^t$ into the recursion and divide by $X^t$.`
				},
				{ from: 'growth', to: 'capacity', label: 'log of the growth rate' },
				{
					from: 'definition',
					to: 'capacity',
					label: t`$\log N(T)/T \to \log X_0$`,
					detail: t`$\log(A X_0^T)/T = \log X_0 + \log A / T$.`
				},
				{
					from: 'states',
					to: 'theorem1',
					label: 'count per end state',
					detail: t`One recursion per state, coupled through the allowed transitions.`
				},
				{
					from: 'capacity',
					to: 'theorem1',
					label: 'one state is the special case',
					detail: t`With one state the determinant condition reduces to $\sum_s W^{-t_s} = 1$.`
				},
				{
					from: 'theorem1',
					to: 'telegraph',
					label: 'two states: after a space or not',
					detail: t`Counting by the last or second-to-last symbol gives $N(t) = N(t-2) + N(t-4) + N(t-5) + N(t-7) + N(t-8) + N(t-10)$, whose characteristic equation is shown.`
				}
			]
		},
		{
			id: 'entropy-uniqueness',
			title: 'Uniqueness of the entropy formula',
			section: 'Sec. 6, Theorem 2, Appendix 2',
			summary: t`Three reasonable demands on a measure of choice (continuity, growth with the number of equal options, and consistency when a choice is split into steps) force $H = -K\sum_i p_i\log p_i$.`,
			nodes: [
				{
					id: 'axioms',
					title: 'Three requirements',
					kind: 'assumption',
					tex: t`\text{(1) } H \text{ continuous in } p_i;\quad \text{(2) } A(n) = H\big(\tfrac1n, \dots, \tfrac1n\big) \text{ increasing in } n;\quad \text{(3) grouping}`,
					detail: t`(3): if a choice is broken into two successive choices, the original $H$ is the weighted sum of the parts, e.g. $H(\tfrac12, \tfrac13, \tfrac16) = H(\tfrac12, \tfrac12) + \tfrac12 H(\tfrac23, \tfrac13)$.`,
					ref: 'Sec. 6',
					correction: t`The proof uses (3) in a general form, for any split of the outcomes into groups, which is stronger than the example given. Faddeev (1956) gave a precise version: symmetry, continuity on two outcomes, $H(\tfrac12, \tfrac12) > 0$ and grouping.`
				},
				{
					id: 'power',
					title: 'Powers add',
					kind: 'step',
					tex: t`A(s^m) = m\,A(s)`,
					detail: t`A choice among $s^m$ equal options is $m$ successive choices among $s$.`,
					ref: 'Appendix 2'
				},
				{
					id: 'sandwich',
					title: 'Sandwich',
					kind: 'step',
					tex: t`s^m \le t^n < s^{m+1}\ \Rightarrow\ \Big|\frac mn - \frac{\log t}{\log s}\Big| < \frac1n,\qquad \Big|\frac mn - \frac{A(t)}{A(s)}\Big| < \frac1n`,
					detail: t`For any $n$ pick $m$ so that the powers bracket each other. Taking logarithms gives the first bound; applying the increasing $A$ and $A(s^m) = mA(s)$ gives the second.`,
					ref: 'Appendix 2'
				},
				{
					id: 'log',
					title: 'Equal options',
					kind: 'step',
					tex: t`A(t) = K\log t,\qquad K > 0`,
					detail: t`Both ratios are within $1/n$ of $m/n$ for every $n$, so $A(t)/A(s) = \log t/\log s$.`,
					ref: 'Appendix 2'
				},
				{
					id: 'rational',
					title: 'Rational probabilities',
					kind: 'step',
					tex: t`p_i = \frac{n_i}{\sum_j n_j}:\qquad K\log\sum_j n_j = H(p_1, \dots, p_n) + K\sum_i p_i\log n_i`,
					detail: t`Choose among $\sum_j n_j$ equal options either directly, or first which group $i$, then one of its $n_i$ options.`,
					ref: 'Appendix 2'
				},
				{
					id: 'formula',
					title: 'Theorem 2',
					kind: 'result',
					tex: t`H = -K\sum_{i=1}^n p_i\log p_i`,
					detail: t`$K$ only sets the unit: $K = 1$ with base-2 logarithms gives bits.`,
					ref: 'Theorem 2'
				}
			],
			edges: [
				{ from: 'axioms', to: 'power', label: 'grouping (3)' },
				{
					from: 'power',
					to: 'sandwich',
					label: 'monotonicity (2)',
					detail: t`$A(s^m) \le A(t^n) \le A(s^{m+1})$, i.e. $mA(s) \le nA(t) \le (m+1)A(s)$.`
				},
				{
					from: 'sandwich',
					to: 'log',
					label: t`$n \to \infty$`,
					detail: t`$|A(t)/A(s) - \log t/\log s| < 2/n$ for every $n$. $K > 0$ because $A$ increases.`
				},
				{ from: 'axioms', to: 'rational', label: 'grouping (3)' },
				{ from: 'log', to: 'rational', label: t`$A(n_i) = K\log n_i$` },
				{
					from: 'rational',
					to: 'formula',
					label: 'solve for H',
					detail: t`$H = K\big[\log\sum_j n_j - \sum_i p_i\log n_i\big] = -K\sum_i p_i\log\frac{n_i}{\sum_j n_j}$.`
				},
				{
					from: 'axioms',
					to: 'formula',
					label: 'continuity (1)',
					detail: t`Irrational probabilities are limits of rational ones.`
				}
			]
		},
		{
			id: 'typical-sequences',
			title: 'Typical sequences',
			section: 'Sec. 7, Theorems 3–4, Appendix 3',
			summary: t`For long messages, almost all probability sits on about $2^{NH}$ sequences, each of probability about $2^{-NH}$. Shown here for independent symbols, where it is the law of large numbers.`,
			nodes: [
				{
					id: 'source',
					title: 'Independent symbols',
					kind: 'assumption',
					tex: t`p(x_1 x_2 \cdots x_N) = \prod_{k=1}^N p(x_k),\qquad H = -\sum_i p_i\log p_i`,
					ref: 'Sec. 7',
					correction: t`Shannon states the theorem for ergodic finite-state (Markov) sources and sketches the proof in Appendix 3. For general stationary ergodic sources it is the Shannon–McMillan–Breiman theorem (McMillan 1953, Breiman 1957).`
				},
				{
					id: 'sum',
					title: 'Log-probability is a sum',
					kind: 'step',
					tex: t`-\frac1N\log p(x_1 \cdots x_N) = \frac1N\sum_{k=1}^N\big(-\log p(x_k)\big),\qquad \mathbb E\big[-\log p(x_k)\big] = H`
				},
				{
					id: 'lln',
					title: 'Law of large numbers',
					kind: 'assumption',
					tex: t`\frac1N\sum_{k=1}^N Y_k \to \mathbb E[Y] \ \text{ in probability, for i.i.d. } Y_k \text{ with finite mean}`
				},
				{
					id: 'theorem3',
					title: 'Theorem 3',
					kind: 'result',
					tex: t`\Pr\Big[\,\Big|\frac{\log p^{-1}}N - H\Big| < \delta\,\Big] > 1 - \epsilon\quad\text{for } N \ge N_0`,
					detail: t`Sequences split into an atypical set of probability below $\epsilon$, and typical ones with $2^{-N(H+\delta)} < p < 2^{-N(H-\delta)}$.`,
					ref: 'Theorem 3'
				},
				{
					id: 'count',
					title: 'Size of the typical set',
					kind: 'step',
					added: true,
					tex: t`(1 - \epsilon)\,2^{N(H-\delta)} \le |T_N| \le 2^{N(H+\delta)}`,
					detail: t`The typical set has probability between $1 - \epsilon$ and 1, and each member's probability lies between $2^{-N(H+\delta)}$ and $2^{-N(H-\delta)}$.`
				},
				{
					id: 'theorem4',
					title: 'Theorem 4',
					kind: 'result',
					tex: t`\lim_{N\to\infty}\frac{\log n(q)}N = H,\qquad 0 < q < 1`,
					detail: t`$n(q)$ is how many of the most probable sequences are needed to reach total probability $q$. For most purposes there are $2^{NH}$ sequences of probability $2^{-NH}$ each.`,
					ref: 'Theorem 4'
				}
			],
			edges: [
				{ from: 'source', to: 'sum', label: 'log of a product' },
				{
					from: 'sum',
					to: 'theorem3',
					label: t`$Y_k = -\log p(x_k)$`,
					detail: t`The average of i.i.d. terms converges to their mean $H$.`
				},
				{ from: 'lln', to: 'theorem3', label: 'apply' },
				{ from: 'theorem3', to: 'count', label: 'bound the probabilities' },
				{
					from: 'count',
					to: 'theorem4',
					label: t`$\delta \to 0$`,
					detail: t`Any set of probability $q$ needs about as many sequences as the typical set holds: fewer than $q\,2^{N(H-\delta)}$ sequences cannot reach probability $q$ once $N$ is large.`
				}
			]
		},
		{
			id: 'noiseless-coding',
			title: 'Fundamental theorem for a noiseless channel',
			section: 'Sec. 9, Theorems 5 and 9',
			summary: t`Messages can be coded into about $H$ binary digits per symbol and no fewer, so a channel of capacity $C$ carries $C/H$ source symbols per second. Shannon's second proof uses the code now called the Shannon code.`,
			nodes: [
				{
					id: 'blocks',
					title: 'Blocks of N symbols',
					kind: 'assumption',
					tex: t`p_1 \ge p_2 \ge \dots,\qquad P_s = \sum_{i<s}p_i,\qquad G_N = -\frac1N\sum_s p_s\log p_s`,
					detail: t`The messages of length $N$, sorted by probability, with their cumulative probabilities.`,
					ref: 'Sec. 9'
				},
				{
					id: 'lengths',
					title: 'Code lengths',
					kind: 'step',
					tex: t`\log_2\frac1{p_s} \le m_s < 1 + \log_2\frac1{p_s}`,
					detail: t`Message $s$ gets the first $m_s$ binary digits of $P_s$.`,
					ref: 'Sec. 9'
				},
				{
					id: 'prefix',
					title: 'Codes are distinct',
					kind: 'step',
					tex: t`P_{s'} - P_s \ge p_s \ge 2^{-m_s}\quad (s' > s)`,
					detail: t`Every later cumulative probability exceeds $P_s$ by at least $2^{-m_s}$, so its expansion differs within the first $m_s$ places. No codeword is the start of a later one, so a stream of codewords can be cut up uniquely.`,
					ref: 'Sec. 9'
				},
				{
					id: 'average',
					title: 'Average length',
					kind: 'step',
					tex: t`G_N \le \frac1N\sum_s m_sp_s < G_N + \frac1N`,
					ref: 'Sec. 9'
				},
				{
					id: 'theorem5',
					title: 'Block entropy converges',
					kind: 'assumption',
					tex: t`G_N \searrow H \quad (N \to \infty)`,
					detail: t`For independent symbols $G_N = H$ for every $N$.`,
					ref: 'Theorem 5'
				},
				{
					id: 'achievable',
					title: 'H digits per symbol',
					kind: 'step',
					tex: t`\frac1N\sum_s m_sp_s \to H`
				},
				{
					id: 'converse',
					title: 'No code does better',
					kind: 'step',
					tex: t`\sum_s 2^{-m_s} \le 1\ \Rightarrow\ \sum_s p_sm_s \ge -\sum_s p_s\log p_s`,
					detail: t`Every uniquely decodable code satisfies the Kraft–McMillan inequality, and then Gibbs' inequality bounds the average length.`,
					added: true,
					correction: t`Shannon argues the converse from the entropy of the channel input, which cannot exceed $C$ if the transmitter is non-singular. The Kraft–McMillan inequality (McMillan 1956) makes "non-singular" precise.`
				},
				{
					id: 'theorem9',
					title: 'Theorem 9',
					kind: 'result',
					tex: t`\text{rate} \to \frac CH - \epsilon \ \text{ symbols per second is achievable;}\quad \frac CH \text{ is not exceedable}`,
					ref: 'Theorem 9'
				}
			],
			edges: [
				{ from: 'blocks', to: 'lengths', label: 'expand Pₛ in binary' },
				{ from: 'lengths', to: 'prefix', label: t`$p_s \ge 2^{-m_s}$` },
				{
					from: 'lengths',
					to: 'average',
					label: t`multiply by $p_s$, sum`,
					detail: t`$\sum_s p_s\log(1/p_s) = NG_N$.`
				},
				{ from: 'average', to: 'achievable', label: t`$1/N \to 0$` },
				{ from: 'theorem5', to: 'achievable', label: t`$G_N \to H$` },
				{
					from: 'prefix',
					to: 'theorem9',
					label: 'decodable',
					detail: t`The receiver can recover the message.`
				},
				{
					from: 'achievable',
					to: 'theorem9',
					label: 'C binary digits per second',
					detail: t`A channel of capacity $C$ carries $C$ binary digits per second (Theorem 1), i.e. $C/H$ source symbols.`
				},
				{
					from: 'blocks',
					to: 'converse',
					label: 'any uniquely decodable code',
					detail: t`Not only the Shannon code: every code that can be decoded obeys Kraft–McMillan.`
				},
				{ from: 'converse', to: 'theorem9', label: 'upper bound' }
			]
		},
		{
			id: 'noisy-capacity',
			title: 'Equivocation and the capacity of a noisy channel',
			section: 'Secs. 12, 15–16',
			summary: t`The information that gets through is what was sent minus what the receiver is still unsure of: $R = H(x) - H_y(x)$. Its maximum over sources is the capacity. Shannon's example: 1000 binary symbols a second with 1% errors carry 919 bits a second, not 990.`,
			nodes: [
				{
					id: 'equivocation',
					title: 'Equivocation',
					kind: 'assumption',
					tex: t`H_y(x) = -\sum_{x,y}p(x,y)\log p_y(x)`,
					detail: t`The conditional entropy of what was sent given what was received: the receiver's remaining uncertainty.`,
					ref: 'Sec. 12'
				},
				{
					id: 'rate',
					title: 'Rate of transmission',
					kind: 'step',
					tex: t`R = H(x) - H_y(x)`,
					detail: t`Subtracting the expected number of errors instead would credit a channel with independent output with half the source rate.`,
					ref: 'Sec. 12'
				},
				{
					id: 'chain',
					title: 'Chain rule',
					kind: 'assumption',
					tex: t`H(x,y) = H(x) + H_x(y) = H(y) + H_y(x)`,
					ref: 'Sec. 6, property 4'
				},
				{
					id: 'symmetric-forms',
					title: 'Three forms',
					kind: 'step',
					tex: t`R = H(x) - H_y(x) = H(y) - H_x(y) = H(x) + H(y) - H(x,y)`,
					detail: t`Sent minus the uncertainty about it; received minus the part due to noise; the information the two share.`,
					ref: 'Sec. 12'
				},
				{
					id: 'capacity',
					title: 'Capacity',
					kind: 'result',
					tex: t`C = \max_{P(x)}\big(H(x) - H_y(x)\big)`,
					detail: t`The maximum over all sources used as input. For a noiseless channel $H_y(x) = 0$ and this agrees with Theorem 1.`,
					ref: 'Sec. 12'
				},
				{
					id: 'example',
					title: 'Shannon’s example',
					kind: 'result',
					tex: t`H_y(x) = -(0.99\log 0.99 + 0.01\log 0.01) = 0.081\ \Rightarrow\ R = 1000 - 81 = 919 \text{ bits/s}`,
					detail: t`1000 equiprobable binary symbols a second, each flipped with probability $0.01$. Checked numerically: $919.2$.`,
					ref: 'Sec. 12'
				},
				{
					id: 'symmetric',
					title: 'Symmetric channels',
					kind: 'step',
					tex: t`H_x(y) = -\sum_j p_j\log p_j \ \text{ for every input distribution}`,
					detail: t`When every input has the same set of transition probabilities $p_j$, and every output too.`,
					ref: 'Sec. 16'
				},
				{
					id: 'symmetric-capacity',
					title: 'Capacity of a symmetric channel',
					kind: 'result',
					tex: t`C = \log m + \sum_j p_j\log p_j\qquad\text{binary: } C = 1 + p\log p + q\log q`,
					detail: t`$m$ is the number of output symbols. Equally likely inputs make the outputs equally likely, which maximises $H(y)$.`,
					ref: 'Sec. 16',
					correction: t`Shannon finds the optimum in general from Lagrange conditions, which give stationary points and may give negative input probabilities. The stationary point is the maximum because $H(y) - H_x(y)$ is concave in the input distribution, and the solution must also be checked for $P_i \ge 0$.`
				}
			],
			edges: [
				{ from: 'equivocation', to: 'rate', label: 'subtract the missing information' },
				{ from: 'rate', to: 'symmetric-forms', label: 'rewrite' },
				{ from: 'chain', to: 'symmetric-forms', label: 'chain rule' },
				{ from: 'rate', to: 'capacity', label: 'match the source to the channel' },
				{
					from: 'rate',
					to: 'example',
					label: 'a posteriori 0.99 / 0.01',
					detail: t`Whichever symbol is received, it is right with probability $0.99$.`
				},
				{ from: 'symmetric-forms', to: 'symmetric', label: t`use $H(y) - H_x(y)$` },
				{
					from: 'symmetric',
					to: 'symmetric-capacity',
					label: t`$\max H(y) = \log m$`,
					detail: t`Only $H(y)$ depends on the input distribution.`
				},
				{ from: 'capacity', to: 'symmetric-capacity', label: 'maximise' },
				{
					from: 'symmetric-capacity',
					to: 'example',
					label: t`$1 + p\log p + q\log q = 0.919$`,
					detail: t`At $p = 0.01$ the uniform source of the example already achieves capacity.`
				}
			]
		},
		{
			id: 'noisy-coding',
			title: 'Fundamental theorem for a discrete channel with noise',
			section: 'Secs. 12–13, Theorems 10–11',
			summary: t`Below capacity, a code chosen at random makes errors arbitrarily rare, so a good code exists. Above capacity, the equivocation cannot fall below $H - C$.`,
			nodes: [
				{
					id: 'typical',
					title: 'Typical sequences',
					kind: 'assumption',
					from: 'typical-sequences',
					tex: t`\approx 2^{TH(x)} \text{ inputs},\quad \approx 2^{TH(y)} \text{ outputs},\quad \approx 2^{TH_y(x)} \text{ plausible inputs per output}`,
					detail: t`For a source $S_0$ achieving capacity, over a long time $T$ (Fig. 10 of the paper).`,
					ref: 'Sec. 13',
					correction: t`Shannon's "about" statements need joint typicality to be made precise. Rigorous proofs: Feinstein (1954), Shannon (1957); see Cover and Thomas, Elements of Information Theory, Ch. 7.`
				},
				{
					id: 'random-code',
					title: 'Random code',
					kind: 'step',
					tex: t`2^{TR} \text{ messages mapped at random onto typical inputs},\qquad R < C`,
					detail: t`Average the error frequency over every assignment of messages to inputs. If the average is small, some code is at least as good.`,
					ref: 'Sec. 13'
				},
				{
					id: 'collision',
					title: 'A wrong message in the fan',
					kind: 'step',
					tex: t`\Pr[\text{another message is a plausible cause}] \le 2^{TH_y(x)}\cdot 2^{T(R - H(x))}`,
					detail: t`Each typical input is a message with probability $2^{T(R - H(x))}$, and the fan of plausible causes of the received output has $2^{TH_y(x)}$ members.`,
					ref: 'Sec. 13',
					correction: t`Shannon computes $1 - (1 - 2^{T(R-H(x))})^{2^{TH_y(x)}}$; the union bound shown gives the same limit more directly.`
				},
				{
					id: 'vanishes',
					title: 'Errors vanish',
					kind: 'step',
					tex: t`R = H(x) - H_y(x) - \eta\ \Rightarrow\ \Pr[\text{error}] \le 2^{-T\eta} \to 0`,
					ref: 'Sec. 13'
				},
				{
					id: 'correction-channel',
					title: 'Correction channel',
					kind: 'assumption',
					tex: t`H_{yz}(x) \ge H_y(x) - H(z)`,
					detail: t`An observer who sees both ends sends correction data $z$. From $H_y(x,z) \ge H_y(x)$: the receiver's uncertainty stays positive unless the correction rate reaches the equivocation.`,
					ref: 'Theorem 10'
				},
				{
					id: 'converse',
					title: 'Above capacity',
					kind: 'step',
					tex: t`H > C\ \Rightarrow\ H_y(x) \ge H - C`,
					ref: 'Theorem 11',
					correction: t`Shannon's converse bounds the equivocation. A converse for the error probability needs Fano's inequality, $H_y(x) \le h(P_e) + P_e\log(M - 1)$ (Fano 1952).`
				},
				{
					id: 'theorem11',
					title: 'Theorem 11',
					kind: 'result',
					tex: t`H \le C:\ \text{arbitrarily few errors are possible};\qquad H > C:\ \min H_y(x) = H - C`,
					detail: t`Above capacity, the equivocation $H - C + \epsilon$ is achievable and $H - C$ is the limit.`,
					ref: 'Theorem 11'
				}
			],
			edges: [
				{ from: 'typical', to: 'random-code', label: 'use only typical inputs' },
				{
					from: 'random-code',
					to: 'collision',
					label: 'union bound over the fan',
					detail: t`Messages land independently and uniformly on the $2^{TH(x)}$ typical inputs.`
				},
				{ from: 'typical', to: 'collision', label: t`fan of $2^{TH_y(x)}$ causes` },
				{
					from: 'collision',
					to: 'vanishes',
					label: t`$R < C$`,
					detail: t`The exponent is $T(R - H(x) + H_y(x)) = -T\eta$.`
				},
				{
					from: 'vanishes',
					to: 'theorem11',
					label: 'average small ⇒ some code good',
					detail: t`At least one code in the ensemble does as well as the average.`
				},
				{
					from: 'correction-channel',
					to: 'converse',
					label: t`$z$ = what would correct the output`,
					detail: t`Anything beyond capacity must be made up by side information of rate at least $H - C$.`
				},
				{ from: 'converse', to: 'theorem11', label: 'converse' }
			]
		},
		{
			id: 'gaussian-max-entropy',
			title: 'Maximum entropy at fixed power: the Gaussian',
			section: 'Sec. 20, property 5',
			summary: t`Among distributions with a given variance, the Gaussian has the largest entropy, $\log\sqrt{2\pi e}\,\sigma$. Shannon finds it by the calculus of variations; Gibbs' inequality proves it is the maximum.`,
			nodes: [
				{
					id: 'continuous',
					title: 'Continuous entropy',
					kind: 'assumption',
					tex: t`H(x) = -\int p(x)\log p(x)\,dx`,
					detail: t`Unlike the discrete case it can be negative and changes under a change of variables; differences such as $H(y) - H(n)$ do not.`,
					ref: 'Sec. 20'
				},
				{
					id: 'constraints',
					title: 'Fixed variance',
					kind: 'assumption',
					tex: t`\int p(x)\,dx = 1,\qquad \int x^2p(x)\,dx = \sigma^2`,
					ref: 'Sec. 20'
				},
				{
					id: 'stationary',
					title: 'Stationary point',
					kind: 'step',
					tex: t`-1 - \log p(x) + \lambda x^2 + \mu = 0\ \Rightarrow\ p(x) = \frac1{\sqrt{2\pi}\,\sigma}\,e^{-x^2/2\sigma^2}`,
					detail: t`Calculus of variations with Lagrange multipliers for both constraints, then fix $\lambda, \mu$ by the constraints.`,
					ref: 'Sec. 20'
				},
				{
					id: 'gibbs',
					title: 'Gibbs’ inequality',
					kind: 'assumption',
					added: true,
					tex: t`\int p\log\frac pg \ge 0,\ \text{ with equality iff } p = g`
				},
				{
					id: 'bound',
					title: 'Any p is bounded by the Gaussian',
					kind: 'step',
					added: true,
					tex: t`H(p) \le -\int p\log g = \log\sqrt{2\pi}\,\sigma + \frac{\log e}{2\sigma^2}\int x^2 p = H(g)`,
					detail: t`$-\log g$ is quadratic in $x$, so its average depends on $p$ only through the variance, which is the same for $p$ and $g$.`,
					correction: t`A stationary point of the variational problem need not be a maximum; this step shows it is.`
				},
				{
					id: 'entropy',
					title: 'Gaussian entropy',
					kind: 'result',
					tex: t`H_{\max} = \log\sqrt{2\pi e}\,\sigma`,
					detail: t`In $n$ dimensions with covariance matrix $A$: $\log\big((2\pi e)^{n/2}|A|^{1/2}\big)$. This defines the entropy power used for noise.`,
					ref: 'Sec. 20'
				}
			],
			edges: [
				{ from: 'continuous', to: 'stationary', label: 'maximise H' },
				{ from: 'constraints', to: 'stationary', label: 'Lagrange multipliers' },
				{ from: 'stationary', to: 'bound', label: t`take $g$ = this Gaussian` },
				{ from: 'gibbs', to: 'bound', label: t`$D(p\,\|\,g) \ge 0$` },
				{ from: 'constraints', to: 'bound', label: 'same variance' },
				{
					from: 'bound',
					to: 'entropy',
					label: 'evaluate',
					detail: t`$\int x^2 g = \sigma^2$ gives $\log\sqrt{2\pi}\,\sigma + \tfrac12\log e$.`
				}
			]
		},
		{
			id: 'awgn-capacity',
			title: 'Capacity with an average power limit',
			section: 'Secs. 19, 24–25, Theorems 13, 16–17',
			summary: t`A band-limited signal is $2W$ numbers a second. With independent additive noise the rate is $H(y) - H(n)$, and with a power limit the Gaussian maximises $H(y)$, giving $C = W\log(1 + P/N)$.`,
			nodes: [
				{
					id: 'sampling',
					title: 'Sampling theorem',
					kind: 'assumption',
					tex: t`f(t) = \sum_n f\Big(\frac n{2W}\Big)\,\frac{\sin\pi(2Wt - n)}{\pi(2Wt - n)}`,
					detail: t`A signal with no frequencies above $W$ is fixed by samples $1/2W$ apart. Over a time $T$ that is $2TW$ numbers.`,
					ref: 'Theorem 13',
					correction: t`No non-zero signal is both band-limited and time-limited, so "$2TW$ coordinates" is approximate. Landau, Pollak and Slepian (1961–62) showed that about $2TW$ dimensions suffice, which is what the capacity argument needs.`
				},
				{
					id: 'additive',
					title: 'Additive independent noise',
					kind: 'assumption',
					tex: t`y = x + n,\qquad x,\ n \text{ independent}`,
					ref: 'Theorem 16'
				},
				{
					id: 'rate',
					title: 'Rate is output minus noise entropy',
					kind: 'step',
					tex: t`H(x,y) = H(x,n)\ \Rightarrow\ R = H(x) - H_y(x) = H(y) - H(n)`,
					detail: t`$(x, y)$ and $(x, n)$ are related by a shift with unit Jacobian. Expanding both sides: $H(y) + H_y(x) = H(x) + H(n)$.`,
					ref: 'Theorem 16'
				},
				{
					id: 'power',
					title: 'Power limit',
					kind: 'assumption',
					tex: t`\overline{x^2} \le P,\qquad \text{white thermal noise of power } N`,
					ref: 'Sec. 25'
				},
				{
					id: 'max-entropy',
					title: 'Gaussian has maximum entropy',
					kind: 'assumption',
					from: 'gaussian-max-entropy',
					tex: t`H \le \log\sqrt{2\pi e}\,\sigma \ \text{ per sample}`
				},
				{
					id: 'entropies',
					title: 'Entropies per second',
					kind: 'step',
					tex: t`H(y) \le W\log 2\pi e(P + N),\qquad H(n) = W\log 2\pi eN`,
					detail: t`$2W$ samples a second, each with entropy at most $\tfrac12\log 2\pi e\,\sigma^2$. The received power is $P + N$ since signal and noise are independent; equality holds when $x$ is white Gaussian noise of power $P$.`,
					ref: 'Sec. 25'
				},
				{
					id: 'theorem17',
					title: 'Theorem 17',
					kind: 'result',
					tex: t`C = W\log\frac{P + N}N = W\log\Big(1 + \frac PN\Big)`,
					detail: t`For example $W = 3$ kHz at a signal-to-noise ratio of $1000$ (30 dB) gives about $29.9$ kbit/s.`,
					ref: 'Theorem 17'
				}
			],
			edges: [
				{
					from: 'additive',
					to: 'rate',
					label: 'shift by x',
					detail: t`Knowing $x$, the uncertainty in $y$ is the uncertainty in $n$.`
				},
				{ from: 'rate', to: 'entropies', label: t`maximise $H(y)$` },
				{ from: 'power', to: 'entropies', label: t`received power $P + N$` },
				{ from: 'sampling', to: 'entropies', label: t`$2W$ samples per second` },
				{ from: 'max-entropy', to: 'entropies', label: 'Gaussian bound' },
				{
					from: 'entropies',
					to: 'theorem17',
					label: 'subtract',
					detail: t`$W\log 2\pi e(P+N) - W\log 2\pi eN$. Theorem 11 carried over to continuous channels makes this rate achievable with vanishing errors.`
				}
			]
		}
	]
};
