# Chaos Game: how it works

The definitions behind `/chaos-game`. The page's "How it works" gives the short version; it grew out of the 2021 post [Strange Attractors](https://blog.mptc.uk/posts/Strange-Attractors). The engine is `src/lib/chaos-game/engine.ts`.

## The game

Each point $p_k$ defines a map $f_k(x) = p_k + M_k (x - p_k)$ that keeps $p_k$ fixed. A jump picks a point and moves the current position $x$ to $f_k(x)$. With a jump ratio $r$ the linear part is $M_k = (1 - r) R(\theta_k)$, where $R(\theta_k)$ turns by the point's rotation (0 by default), so a plain jump goes the fraction $r$ of the way to the point. Setting a matrix replaces $M_k$ directly, which covers every affine map: $A x + t$ is the point $p = (I - A)^{-1} t$ with $M = A$ (`fixedPoint`). The Barnsley fern preset is built that way.

When every map shrinks distances, the positions settle onto the maps' attractor whatever the start (Barnsley 1988), so the first `BURN_IN` (32) jumps are not plotted. A setup that runs off to infinity is reported instead of drawn (`bounds`).

## Picking the next point

Each point is picked in proportion to its weight (default 1). A rule forbids offsets from the last point's index, modulo the number of points $n$: "Never twice" forbids 0, "No neighbour" forbids 1 and $n - 1$, and "Custom" takes any list. Offsets follow the points' order in the table, so the polygon builder lists vertices anticlockwise, each edge midpoint after its first vertex, and the centre last. `compile` turns the weights and the rule into one table per last point; `validate` rejects a rule that leaves some point with nothing to pick.

## The "copies touch" ratio

For a regular $n$-gon the copies of the attractor just touch at contraction $s = 1 / \left(2 \left(1 + \sum_{k=1}^{\lfloor n/4 \rfloor} \cos(2\pi k / n)\right)\right)$ (Wikipedia, "Chaos game"), so the button sets $r = 1 - s$ (`optimalRatio`): $1/2$ for triangles and squares, $0.618$ for pentagons, $2/3$ for hexagons.

## Drawing

A Web Worker (`chaos.worker.ts`, logic in `worker-engine.ts`) counts hits per canvas pixel in chunks of 250,000 jumps, up to 10 million, and posts a frame at most every 100 ms. The canvas is the one exception to the repo's SVG-only rule: SVG can't hold millions of marks. The handles and the step-through walk stay in SVG.

Each pixel's opacity is $\left(\log(1 + c) / \log(1 + c_{\max})\right)^{1/\gamma}$ for $c$ hits, above a small floor so single hits show, the log-density mapping of fractal flames (Draves and Reckase 2008). The Contrast slider sets $\gamma$. "By point" colours each pixel by the average colour of the points whose jumps landed there (`--data-1` to `--data-12`, cycled). The background stays transparent, so both themes work; colours are read from the tokens and the run restarts when the theme changes.

While a point is dragged the view stays fixed and each move runs a 300,000-jump preview; releasing refits the view and runs in full.

## Challenges

`presets.ts` holds the blog post's ten patterns, rebuilt from its images: the points are the images' black dots, normalised to $[-1, 1]$ across, and each ratio was fitted by rendering ratios from 0.30 to 0.95 and keeping the one whose dilated hits best overlap the image's pixels (overlap 0.81 to 0.95). The post's Plotly axes weren't to scale, so its "Octagon" is a stretched one and the triangle's best ratio is 0.53, not 0.5. Ten more patterns follow: the carpet, the Vicsek fractal, the pentagon and hexagon at their touching ratios, three rule-based ones, a turned triangle and the fern.

The match compares shapes, not positions: each image's hit pixels are boxed, the box is scaled to a 48 × 48 grid with its aspect kept (`shapeGrid`), and the score is the grids' intersection over union (`similarity`). A match of 90% counts as solved; every preset's answer reaches it from another seed (`presets.spec.ts`). The faint target in the plot is drawn into the same box, so what you see is what is scored.

## Share links

`state.ts` encodes the points as `x_y_weight_ratio_rotation_a_b_c_d` joined by `*`, with blank fields for defaults, plus the ratio (`r`), forbidden offsets (`f`), seed (`s`), colour mode (`c`), contrast (`g`) and the challenge (`ch`). The same string is saved in localStorage under `chaos-game:state`.
