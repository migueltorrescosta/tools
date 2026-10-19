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
- CI (`.github/workflows/ci.yml`) runs these four on every pull request, plus `pnpm run build` for the Worker bundle. Its final `ci` job is the single check the ruleset requires. CI does not deploy.
- `test:e2e` runs Playwright against `pnpm dev` on port 5173. Every route has a suite in `src/routes/<route>/e2e/`; the index has one in `src/routes/e2e/`. Set `CI=1` so Playwright starts its own server instead of reusing whatever already listens on 5173.

## Structure

- `src/routes/` — SvelteKit pages (format, verb-conjugator, warhammer-simulator, split, wordle, decision-tree, timelines, rank-vote, jwt, volt, cipher, company-trends, symbolic-regression, ancilla-mzi)
- `src/lib/` — tool logic lives in `src/lib/<tool>/` or `src/lib/<tool>.ts`; a route may keep route-only helpers in `src/routes/<tool>/lib/`; specs sit next to the module they test. Bundled data is in `src/lib/data/`.
- `static/` — static assets
- Math: TeX rendered with KaTeX through `renderTex` (`src/lib/tex.ts`) inside `Tex` (`src/lib/ui`). Ancilla vs MZI renders its TeX (`src/routes/ancilla-mzi/lib/equations.ts`) while the page prerenders (`+page.server.ts` load), so it ships KaTeX CSS and fonts but no KaTeX JS; Symbolic Regression renders at runtime.

## Conventions

- Work tracking: GitHub issues on the Epics project (https://github.com/users/migueltorrescosta/projects/3). An issue never results in more than one PR; each PR closes its issue with a closing keyword (`Closes migueltorrescosta/tools#N`).
- Package manager: **pnpm** only. Never use npm. The repo tracks `pnpm-lock.yaml`.
- Node version pinned in `.nvmrc`.
- No D3 for new visualizations: hand-rolled SVG with Svelte 5 declarative rendering.
- UI: build pages from `src/lib/ui` (`PageHeader`, `Panel`, `Button`, `Field`, …) and the tokens in `src/lib/styles/tokens.css`; no hard-coded colours (charts use `--data-1..12`). Every route is listed in `ROUTES` in `src/routes/e2e/a11y.e2e.ts` (axe in light and dark, 390px reflow).
- No commits on main. Branch or worktree only.
