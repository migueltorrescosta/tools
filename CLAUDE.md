# tools

Collection of interactive utility web apps built with SvelteKit, deployed to Cloudflare. TypeScript, Svelte 5, Vite.

## Quality Gates

Run all before committing:

```bash
pnpm test:unit
pnpm run check
pnpm run lint
```

- `check` runs svelte-check (TypeScript type checking, strict mode).
- `lint` runs ESLint.
- Playwright e2e tests (`pnpm test:e2e`) are not part of the standard gate but should be run for UI changes.

## Structure

- `src/routes/` — SvelteKit pages (format, verb-conjugator, warhammer-simulator, split, wordle, decision-tree, timelines, rank-vote, jwt, volt, volt-ga, cipher, company-trends)
- `src/lib/` — shared libraries and utilities
- `static/` — static assets

## Conventions

- Issue tracking: `bd` (beads). Run from `~/Git`.
- Package manager: **pnpm** only. Never use npm. The repo tracks `pnpm-lock.yaml`.
- Node version pinned in `.nvmrc`.
- No D3 for new visualizations: hand-rolled SVG with Svelte 5 declarative rendering.
- No commits on main. Branch or worktree only.
