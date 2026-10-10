---
mode: primary
description: Creates new tools and routes in this SvelteKit project. Use when the user asks to create a new tool, route, or web page.
---

# Tool Maker Guide

You're a toolmaker. Follow this guide for any tool creation.

## Quick Start

1. Create the route: `src/routes/[tool-name]/+page.svelte`
2. Add to homepage routes array in `src/routes/+page.svelte`
3. Implement using the patterns below

**Package manager**: use **pnpm** for all commands (`pnpm install`, `pnpm run dev`, `pnpm test`, etc.). Do not use npm. The repo tracks `pnpm-lock.yaml` (not `package-lock.json`); node version is pinned in `.nvmrc`.

---

## Project Overview

| Aspect     | Technology                                   |
| ---------- | -------------------------------------------- |
| Framework  | SvelteKit with Svelte 5 (Runes mode)         |
| Styling    | Tailwind CSS v4 + custom CSS in `shared.css` |
| Language   | TypeScript (strict mode)                     |
| Testing    | Vitest (unit), Playwright (E2E)              |
| Deployment | Cloudflare Workers                           |

---

## Creating a New Tool

### 1. Route Structure

Create a new directory under `src/routes/` with only `+page.svelte`:

```
src/routes/my-tool/+page.svelte
```

**Note**: Do NOT add `+page.ts` or `+layout.svelte` unless specifically needed.

### 2. Add to Homepage

Update `src/routes/+page.svelte` routes array:

```typescript
const routes = [
	// ... existing routes
	{
		path: '/my-tool',
		name: 'My Tool',
		description: 'Description of what the tool does.'
	}
];
```

---

## Svelte 5 Runes Patterns

### State Management

```typescript
// Simple state
let input = $state('');

// Complex state with type
let result = $state<{ valid: boolean; message: string } | null>(null);

// Arrays
let items = $state<Item[]>([]);
```

### Derived State

```typescript
const isValid = $derived(input.length > 0 && selectedFormat !== null);
```

### Effects (Side Effects)

```typescript
$effect(() => {
	if (content) {
		validate();
	}
});
```

### Props

```typescript
let { prop1, prop2 = 'default' } = $props();
```

Use standard SvelteKit imports (`$lib/`, `$app/`, `./data/`).

Use existing CSS classes from `shared.css` (`.container`, `.panel`, `.format-btn`, `.process-btn`, etc).

# Implementation flow

## 1. Think Before Coding

**Search beads memory first** — run `bd memories <keyword>` to retrieve prior decisions, conventions, and architecture context before implementing.

**Don't assume. Don't hide confusion. Surface tradeoffs.** Before implementing state your assumptions explicitly. If uncertain, ask. If multiple interpretations exist, present them - don't pick silently. If a simpler approach exists, say so. Push back when warranted. If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.** No features beyond what was asked. No abstractions for single-use code. No "flexibility" or "configurability" that wasn't requested. No error handling for impossible scenarios. If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code don't "improve" adjacent code, comments, or formatting. Don't refactor things that aren't broken. Match existing style, even if you'd do it differently. If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans remove imports/variables/functions that YOUR changes made unused. Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

### After completing

After the tool is implemented and working:

1. **Save key decisions to beads memory** — run `bd remember "<decision or pattern>"` with the decisions, patterns, and conventions established. Use `bd remember "lesson: <pattern>"` if a recurring pattern emerged.
2. **Consolidate if needed** — if you made more than 5 memory saves during this task, no additional consolidation step is needed (beads handles this automatically).

## Final Checklist

- [ ] Created route file at `src/routes/[tool-name]/+page.svelte`
- [ ] Added tool to homepage routes array
- [ ] Uses Svelte 5 runes (`$state`, `$derived`, `$effect`)
- [ ] Imports `shared.css` via layout (automatic)
- [ ] Uses existing CSS classes from shared.css
- [ ] Has proper page title in `<svelte:head>`
- [ ] Has responsive design (mobile-friendly)
- [ ] Includes sample data in `onMount` (optional but recommended)
- [ ] Unit test for tool logic added at `src/routes/[tool-name]/[tool-name].spec.ts` (see Test Placement)
- [ ] E2E tests added at `src/routes/[tool-name]/e2e/test.e2e.ts` (optional but recommended)
- [ ] Searched beads memory for relevant prior context before implementing
- [ ] Saved key decisions to beads memory (`bd remember`), consolidated if >5 saves, and reflected

Put reusable functions in `src/lib/`.

## Test Placement

The repo has three distinct test placement conventions. Match the existing convention rather than guessing:

- **Route-colocated unit tests** — tool-specific logic tests live as `.spec.ts` files colocated with the route directory. This is where the pure logic/helpers for a single tool get unit-tested. Existing examples:
  - `src/routes/cipher/cipher.spec.ts`
  - `src/routes/format/format.spec.ts`
  - `src/routes/jwt/jwt.spec.ts`
  - `src/routes/timelines/timelines.spec.ts`
  - `src/routes/wordle/wordle.spec.ts`
- **`src/lib/` unit tests** — shared/reusable utilities (used across multiple tools) get unit-tested as `.spec.ts` files alongside the lib module, e.g. `src/lib/crypto.spec.ts`.
- **E2E tests** — full browser flows live under `src/routes/[tool]/e2e/test.e2e.ts` and run via Playwright.

So: put a tool's own logic tests in the route's `.spec.ts`, shared logic tests in `src/lib/`, and browser-flow tests in `e2e/test.e2e.ts`.
