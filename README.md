# tools

A collection of small browser tools built with SvelteKit 2, Svelte 5 and TypeScript, deployed as a Cloudflare Worker. Everything runs client-side; there is no backend or database.

## Tools

| Route                  | Tool                    | What it does                                                                      |
| ---------------------- | ----------------------- | --------------------------------------------------------------------------------- |
| `/jwt`                 | JWT Parser              | Decode, encode and verify JSON Web Tokens.                                        |
| `/format`              | Format Checker          | Validate JSON, YAML, XML, Markdown and plain text with located errors.            |
| `/cipher`              | Encrypter/Decrypter     | AES-GCM, AES-CBC, RSA-OAEP, Base64, Hex and ROT13.                                |
| `/wordle`              | Wordle Solver           | Suggest the next guess from the colour feedback.                                  |
| `/split`               | Asset Splitting         | Fair division of assets among several people.                                     |
| `/timelines`           | Timelines               | European elections and EU milestones on a timeline.                               |
| `/volt`                | Volt                    | Current and former elected representatives of Volt Europa.                        |
| `/volt-ga`             | Volt GA Bratislava 2026 | General Assembly schedule by room, with search and shareable favourites.          |
| `/rank-vote`           | Rank Vote               | Ranked-choice ballots for small groups, shared by link.                           |
| `/verb-conjugator`     | Verb Conjugator         | Italian, Spanish and Portuguese conjugation drills with spaced recall.            |
| `/decision-tree`       | Decision Tree           | Walk a question tree one answer at a time, with shareable paths.                  |
| `/company-trends`      | Company Trends          | Animated log-log revenue vs operating margin for 43 companies since 2000, in EUR. |
| `/warhammer-simulator` | Warhammer Simulator     | Monte Carlo duel odds for Warhammer: The Old World.                               |

The index page is generated from `src/lib/routes.ts`. Add new tools there.

## Setup

Requires the Node version in `.nvmrc` and pnpm. Use pnpm only; the repo tracks `pnpm-lock.yaml`.

```sh
pnpm install
pnpm exec playwright install chromium   # browser for component and e2e tests
pnpm dev                                # http://localhost:5173
```

## Quality gates

Run all of these before committing:

```sh
pnpm test:unit         # Vitest, runs once: node specs plus Svelte component specs in Chromium
pnpm run check         # svelte-check, strict TypeScript
pnpm run lint          # Prettier and ESLint
pnpm test:e2e          # Playwright, one suite per route under src/routes/<route>/e2e/
```

`pnpm test:unit:watch` reruns the unit specs on change. `pnpm test` runs the unit and e2e suites together. Set `CI=1` for e2e runs so Playwright starts its own dev server instead of reusing whatever already listens on port 5173.

## Layout

- `src/routes/<tool>/`: one SvelteKit page per tool, with its e2e suite in `e2e/`.
- `src/lib/`: tool logic lives in `src/lib/<tool>/` or `src/lib/<tool>.ts`; a route may keep route-only helpers in `src/routes/<tool>/lib/`; specs sit next to the module they test. Bundled data is in `src/lib/data/`.
- `static/`: static assets.

## Build and deploy

```sh
pnpm run build     # builds with @sveltejs/adapter-cloudflare
pnpm run preview   # builds, then serves the Worker locally with wrangler
pnpm run deploy    # builds and runs wrangler deploy
```

`wrangler.jsonc` holds the Worker configuration. `pnpm run gen` regenerates the Cloudflare binding types.
