# Deconvolution: how it works

The details behind `/deconvolution`. The page's "How it works" gives the short version.

## Model

We observe $Z = X + Y$, where the signal $X$ and the noise $Y$ are independent. The density of what we see is the convolution $f_Z = f_X * f_Y$, and in Fourier space the characteristic functions multiply: $\varphi_Z = \varphi_X \varphi_Y$. Deconvolution runs this backwards: from a sample of $Z$, estimate $X$ (and, where possible, $Y$).

The page computes $f_Z$ on a grid. Both distributions become cell masses on one step size, with point masses split between the two nearest nodes, and they are convolved by FFT (`zDensityOnGrid` in `src/lib/deconvolution/grid.ts`). When both are discrete, $Z$ is too and its point masses are summed exactly (`zAtoms`). A sample's likelihood interpolates $f_Z$ at each point (`logLikelihood`).

The noise never has a free location. Its location parameter is held at 0, and a continuous noise without one (exponential, gamma, lognormal) is shifted to mean 0, so the location of $Z$ is carried by $X$ alone (`makeDist` in `dist.ts`). Discrete noise keeps its natural support: Poisson noise counts from 0. Mixtures are signal-only.

## Families

The catalogue is in `families.ts`. The fringe pattern is the interferometric case, $f(x) \propto (1 + V\cos(k(x-\mu)+\phi))\,e^{-(x-\mu)^2/2w^2}$ with visibility $0 \le V \le 1$. A bare $\sin(x)$ times a Gaussian goes negative, so it isn't a density. Waiting and stopping times are exponential or gamma, and counts are Poisson, binomial or geometric. A mixture combines 2–3 families of the same kind (all continuous or all discrete).

## Identifiability

From one sample of $Z$ you can't recover both $X$ and $Y$ in general. If both are normal, the data only fix $\sigma_X^2 + \sigma_Y^2$. The literature adds information in one of four ways:

1. **The noise's family is known, its parameters are fitted.** This tool does this. It works when $X$ is "rougher" than $Y$ (Butucea & Matias 2005; Matias 2002), but under normal noise the error shrinks only like $1/\log n$.
2. **Repeated measurements** $Z_j = X + Y_j$ of the same $X$ identify both nonparametrically through Kotlarski's lemma (Li & Vuong 1998).
3. **A symmetric noise of unknown shape**: the phase $\varphi_Z/|\varphi_Z|$ equals that of $X$ (Delaigle & Hall 2016).
4. **In two or more dimensions**, a signal with dependent coordinates and a noise with independent ones (Gassiat, Le Corff & Lehéricy 2022).

Some pairs are unidentifiable even with both families named. Two normals only show $\sigma_X^2+\sigma_Y^2$. A fringe pattern blurred by normal noise is a fringe pattern again: the envelope widens to $\sqrt{w^2+\sigma^2}$, while the frequency becomes $kw^2/(w^2+\sigma^2)$ and the visibility drops by $e^{-k^2w^2\sigma^2/2(w^2+\sigma^2)}$. So for the interferometric case the noise's $\sigma$ must be known.

The parametric fit checks this numerically. It computes the observed information (the Hessian of the negative log-likelihood on the fit's transformed scale), scaled to a unit diagonal so the parameters' units don't matter. When its condition number exceeds $10^6$ (`IDENTIFIABILITY_LIMIT` in `mle.ts`), the page names the parameters along the flattest direction. A flat direction often runs into the edge of a parameter's range (a visibility of 1, a noise scale of 0), where the curvature no longer shows it. So the page also flags fitted parameters that end within $10^{-3}$ of 0 or 1, or below $10^{-3}$ of the data's standard deviation.

Only the parametric fit estimates the noise. Without a family for $X$, the likelihood grows without bound as $\sigma_Y \to 0$: a signal with a point mass on every data point explains the sample perfectly. So the nonparametric methods use the noise either as you entered it or as the parametric fit found it ("Noise used by the other methods").

## Estimators

**Parametric MLE** (`mle.ts`) fits every free parameter of the chosen families jointly. It maximises $\sum_i \log f_Z(z_i)$ with Nelder–Mead from several starts, on a log scale for positive parameters and a logit scale for those in $(0, 1)$. Whole-number parameters (binomial $n$) are held fixed. The 95% intervals come from the inverse observed information, mapped back from the transformed scale, so a positive parameter's interval stays positive. AIC is $2k - 2\ell$ and BIC is $k \ln n - 2\ell$. "Compare families" refits every signal family with the same noise and ranks them by BIC.

**NPMLE** (`npmle.ts`; Kiefer & Wolfowitz 1956, Koenker & Mizera 2014) maximises the likelihood over every distribution of $X$ on a 300-point grid over the data. It runs EM with SQUAREM acceleration, and stops when the Kiefer–Wolfowitz condition $\max_j \frac{1}{n}\sum_i f_Y(z_i - a_j)/\hat f_Z(z_i) \le 1 + 10^{-3}$ holds, which certifies the optimum. The answer is a few point masses, so the chart draws it as stems. Above 5,000 points the data are binned into 2,000 bins, here and in g-modeling.

**g-modeling** (`gmodel.ts`; Efron 2016, Narasimhan & Efron 2020) restricts $X$ on the grid to $g_j \propto e^{Q_j \alpha}$, with $Q$ a natural-spline basis (5 degrees of freedom by default). It maximises $\ell(\alpha) - c_0\lVert\alpha\rVert$ (default $c_0 = 1$), giving a smooth signal; a larger $c_0$ is smoother.

**Kernel deconvolution** (`kernel.ts`; Stefanski & Carroll 1990) inverts the Fourier relation directly:

$\hat f_X(x) = \frac{1}{\pi}\int_0^{1/h} \mathrm{Re}\big[e^{-itx}\varphi_K(th)\hat\varphi_Z(t)/\varphi_Y(t)\big]\,dt$, with $\varphi_K(s) = (1-s^2)^3$ on $[-1, 1]$.

It needs $\varphi_Y \ne 0$, so it is off for uniform noise and other noises whose characteristic function has zeros. The default bandwidth is the normal-reference $1.06\,\hat\sigma_X n^{-1/5}$, with $\hat\sigma_X^2 = \mathrm{Var}(Z) - \mathrm{Var}(Y)$. Under normal noise it is at least $\sigma_Y\sqrt{2/\ln n}$, since Fan (1991) shows that "supersmooth" noise only allows $(\ln n)^{-1/2}$ bandwidths. Negative parts of the estimate are clipped and the page reports their share.

**Gaussian mixture** (`gmm.ts`; Bovy, Hogg & Roweis 2011) models $X$ as 1–6 normals and fits them by the Extreme Deconvolution EM under known normal noise, picking the number of components by BIC. It needs normal noise.

## Comparing estimates

All grid methods share one grid, so their estimates compare directly. On simulated data, the table shows each estimate's distance to the true signal on that grid:

- $W_1 = h\sum_j |\hat F_j - F_j|$, the Wasserstein-1 distance;
- $L_1 = \sum_j |\hat m_j - m_j|$, on cell masses, so it also works when the truth is discrete.

Log-likelihoods of grid methods treat $X$ as the point masses on the grid.

**Bootstrap bands** refit one method on $B$ resamples (with replacement) of the data, with the same noise and grid, and shade the pointwise 5–95% range of the density. NPMLE bands are spiky, since its point masses move between resamples.

## Two dimensions

The 1D/2D switch moves the whole page to $X, Y \in \mathbb{R}^2$. Uploading two columns switches to 2D on its own.

The 2D signals are a correlated Gaussian ($\mu_x, \mu_y, \sigma_x, \sigma_y, \rho$), a mixture of 2–3 of them, independent axes (any two 1D families), and a fringe pattern $(1 + V\cos(\mathbf k\cdot(\mathbf x-\boldsymbol\mu)+\phi))\,\mathcal N(\boldsymbol\mu, \Sigma)$ (`dist2.ts`). The noise is a centred correlated Gaussian or independent continuous axes, so $Z$ always has a density. On the grid, Gaussians are filled by a recurrence along each row: the exponent is quadratic in the column, so each node is two multiplications from its neighbour.

$f_Z$ comes from one circular 2D FFT, as in 1D (`zDensityOnGrid2` in `grid2.ts`), and data points interpolate it bilinearly. Three methods run in 2D:

- **Parametric MLE** (`mle2.ts`) uses the same fitting core as 1D (`fitcore.ts`). It searches on a grid of at most 32 nodes per axis, then polishes and measures the curvature on one of at most 128. Correlations are fitted on an atanh scale. Gaussian + Gaussian is flagged: only the summed covariance is determined.
- **NPMLE** (`npmle2.ts`) solves the same convex problem on a 64 × 64 support with the 1D solver (`solveNpmle`); peaks of the gradient are found among each point's 8 neighbours.
- **Gaussian mixture** (`gmm2.ts`) runs Extreme Deconvolution with full 2 × 2 covariances under Gaussian noise, $K$ by BIC over 1–6.

g-modeling and kernel deconvolution stay 1D-only. Samples above 1,000 points are binned into 40 × 40 cells for the NPMLE and the mixture.

Estimates are compared with the true signal on the 64 × 64 grid by $L_1$ on cell masses and by the sliced Wasserstein-1 distance: the mean, over 32 directions, of the 1D $W_1$ between the two distributions projected on that direction (`metrics2.ts`). Bootstrap bands refit the mixture on resamples and shade its marginals.

## Privacy

Uploaded data stays in the browser and isn't saved. Local storage and the share link hold only the settings.
