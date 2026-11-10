# tools

Collection of interactive utility web apps built with SvelteKit, deployed to Cloudflare. TypeScript, Svelte 5, Vite.

## Quality Gates

Run all before committing:

```bash
pnpm test:unit
pnpm run check
pnpm run lint
pnpm test:e2e
```

- `check` runs svelte-check (TypeScript type checking, strict mode).
- `lint` runs Prettier and ESLint.
- CI (`.github/workflows/ci.yml`) runs these four on every pull request, drafts included, and on every push, plus `pnpm run build` for the Worker bundle (about 12 minutes). Push to a PR branch only once the gates pass locally on that commit; marking a draft ready starts nothing. Its final `ci` job is the single check the ruleset requires. CI does not deploy.
- `test:e2e` runs Playwright against `pnpm dev` on port 5173. Every route has a suite in `src/routes/<route>/e2e/`; the index has one in `src/routes/e2e/`. Set `CI=1` so Playwright starts its own server instead of reusing whatever already listens on 5173.

## Structure

- `src/routes/` — SvelteKit pages (format, verb-conjugator, split, wordle, decision-tree, timelines, rank-vote, jwt, volt, cipher, company-trends, symbolic-regression, ancilla-mzi, scientific-derivations, information-pricing, deconvolution, chaos-game)
- `src/lib/` — tool logic lives in `src/lib/<tool>/` or `src/lib/<tool>.ts`; a route may keep route-only helpers in `src/routes/<tool>/lib/`; specs sit next to the module they test. Bundled data is in `src/lib/data/`.
- `static/` — static assets
- Math: TeX rendered with KaTeX through `renderTex` (`src/lib/tex.ts`) inside `Tex` (`src/lib/ui`). Ancilla vs MZI renders its TeX (`src/routes/ancilla-mzi/lib/equations.ts`) while the page prerenders (`+page.server.ts` load), so it ships KaTeX CSS and fonts but no KaTeX JS; Symbolic Regression, Scientific Derivations and Information Pricing render at runtime.

## Conventions

- Work tracking: beads, as described in ~/projects/CLAUDE.md (PR bodies name the bead ids).
- Package manager: **pnpm** only. Never use npm. The repo tracks `pnpm-lock.yaml`.
- Node version pinned in `.nvmrc`.
- No D3 for new visualizations: hand-rolled SVG with Svelte 5 declarative rendering. The one exception is Chaos Game's density image (millions of hits), drawn on a `<canvas>` with its handles in SVG.
- UI: build pages from `src/lib/ui` (`PageHeader`, `Panel`, `Button`, `Field`, …) and the tokens in `src/lib/styles/tokens.css`; no hard-coded colours (charts use `--data-1..12`). Every route is listed in `ROUTES` in `src/routes/e2e/a11y.e2e.ts` (axe in light and dark, 390px reflow).
- Security headers: the `csp` option (hash mode) of `sveltekit()` in `vite.config.ts` ships as a `<meta>` tag on the prerendered pages; `_headers` (project root, as adapter-cloudflare requires) adds frame-ancestors, nosniff and Referrer-Policy, and gives each worker its own policy; `src/hooks.server.ts` adds the same headers to responses the worker renders (404s). Pages get no `'unsafe-eval'` and no external origins; only the Information Pricing simulation worker may `new Function`. A new inline script in `app.html` is hashed there automatically; a new worker that evals needs its own `_headers` entry.
- `/ancilla-mzi` is a public TypeScript port of a private interferometry engine. Never cite or link the underlying paper or bundle its stored results (the rules panel only). Cross-check fixtures come from the Python engine; the generator script is not committed.
- `/information-pricing` is likewise a public port of a private engine: link the blog post (https://blog.mptc.uk/posts/Pricing-Information), never the private engine's repo.
- `/decision-tree`: at most 5 answers per question (`validateGraph` enforces `MAX_ANSWERS`), no `?` explanation tooltips, and as few levels as possible. Group answers by outcome (for example "Roads in the US or UK") to cut width and depth, and put nuance in `docs/decision-tree.md`. The "Pick a unit" branch ranks unit popularity with Google Books Ngram JSON (`books.google.com/ngrams/json`, corpus `en`, 2015-2019), counting `<numeral> <unit>` bigrams to drop non-unit senses; it undercounts SI units written as symbols.
- `/scientific-derivations` draws each paper's key derivations as graphs. Derivations are corrected: tag nodes `added` (not in the paper) or `corrected` (differs; the note explains). To add a paper, write a typed module in `src/lib/scientific-derivations/papers/` and list it in `PAPERS` (`index.ts`); `papers.spec.ts` checks ids, acyclicity, premises and KaTeX. Equation refs must match a named version. Read the paper from its arXiv TeX source and derive equation numbers with a script (`\numberwithin`, `align` lines without `\nonumber`, skip comment blocks), then compare against the PDF. Verify corrections numerically with an uncommitted scratch script. When a correction changes the paper's main claim, stop and ask the owner how to present it, with the evidence.
