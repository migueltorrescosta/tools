# Tool Maker Guide

You're a toolmaker. Follow this guide for any tool creation.

## Quick Start

1. Create the route: `src/routes/[tool-name]/+page.svelte`
2. Add to homepage routes array in `src/routes/+page.svelte`
3. Implement using the patterns below

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

---

## Required Imports

```typescript
import { onMount } from 'svelte';
// Common imports for client-side tools:
// - Data files: import data from './data/file.json' or '$lib/data'
// - Utility modules: import { helperFn } from '$lib/utils'
// - SvelteKit state: import { page } from '$app/state'
// - External libraries: use with care, prefer native APIs
```

---

## Page Template

```svelte
<script lang="ts">
	import { onMount } from 'svelte';

	// State
	let input = $state('');
	let result = $state('');

	// Constants
	const options = ['Option1', 'Option2'];

	// Functions
	function processInput() {
		if (!input.trim()) {
			result = '';
			return;
		}
		// Logic here
		result = input.toUpperCase();
	}

	function copyToClipboard(text: string) {
		navigator.clipboard.writeText(text);
	}

	// Reactive effects
	$effect(() => {
		processInput();
	});

	// Initialize with sample data
	onMount(() => {
		input = 'Sample data';
	});
</script>

<svelte:head>
	<title>My Tool</title>
</svelte:head>

<div class="container">
	<header>
		<h1>MY TOOL</h1>
		<p class="subtitle">One-line description</p>
	</header>

	<!-- UI sections -->
</div>
```

---

## Styling Standards

### CSS Classes from shared.css

| Element          | Classes                                                     |
| ---------------- | ----------------------------------------------------------- |
| Page container   | `.container`                                                |
| Section          | `.section-header`, `.label`, `.hint`                        |
| Text inputs      | `.content-input`, `.token-input`, `.key-input`              |
| Textareas        | `.panel-textarea`                                           |
| Buttons          | `.format-btn`, `.process-btn`, `.encode-btn`                |
| Button with glow | `.btn-glow` (span inside button)                            |
| Panels           | `.panel`, `.panel-header`, `.panel-content`, `.panel-title` |
| Panel dots       | `.dot.red`, `.dot.yellow`, `.dot.green`                     |
| Copy button      | `.copy-btn`                                                 |
| Labels           | `.input-label`                                              |
| Select dropdowns | `.algorithm-select`                                         |
| Results          | `.result`, `.result.valid`, `.result.invalid`               |
| Error messages   | `.error`, `.error-small`                                    |
| Grid layouts     | `.panels` (3-col grid), `.key-row` (2-col grid)             |

### Component Patterns

**Panel with macOS-style header:**

```html
<div class="panel">
	<div class="panel-header">
		<span class="dot red"></span>
		<span class="dot yellow"></span>
		<span class="dot green"></span>
		<span class="panel-title">TITLE</span>
		<button class="copy-btn" onclick="{()" ="">copyToClipboard(text)}>COPY</button>
	</div>
	<div class="panel-content">
		<!-- content -->
	</div>
</div>
```

**Format/Algorithm selector buttons:**

```html
<div class="format-buttons">
	{#each options as opt (opt)}
	<button class="format-btn" class:active="{selected" ="" ="" ="opt}" onclick="{()" ="">
		selected = opt}> {opt}
	</button>
	{/each}
</div>
```

**Primary action button:**

```html
<button class="process-btn" onclick="{handleAction}">
	<span class="btn-text">ACTION</span>
	<span class="btn-glow"></span>
</button>
```

**Textarea input:**

```html
<textarea
	class="content-input"
	bind:value="{input}"
	placeholder="Enter text..."
	spellcheck="false"
></textarea>
```

### CSS Custom Properties (Theme)

```css
:root {
	--futuristic-bg: #0f0f18;
	--futuristic-surface: #1a1a28;
	--futuristic-border: rgba(0, 255, 255, 0.35);
	--futuristic-cyan: #00f5ff;
	--futuristic-magenta: #ff00ff;
	--futuristic-text: #f0f4f8;
	--futuristic-text-dim: #c8d4de;
}
```

---

## Testing Patterns

### E2E Tests (Playwright)

Location: `src/routes/[tool-name]/e2e/test.e2e.ts`

```typescript
import { expect, test } from '@playwright/test';

test('Tool name - basic functionality', async ({ page }) => {
	await page.goto('/my-tool');
	await expect(page.locator('h1')).toHaveText('MY TOOL');

	// Interact with the UI
	await page.fill('input[placeholder="Input"]', 'test');
	await page.click('button:has-text("Process")');

	// Assert results
	await expect(page.locator('.result')).toBeVisible();
});
```

Run E2E tests: `npm run test:e2e`

---

## TypeScript Conventions

### Type Definitions

```typescript
// Use interfaces for complex types
interface ValidationResult {
	valid: boolean;
	message: string;
}

// Use inline types for simple state
let result = $state<{ valid: boolean; message: string } | null>(null);
```

### Error Handling

```typescript
function processInput() {
	try {
		// logic
	} catch (e) {
		const error = e as Error;
		errorMessage = error.message;
	}
}
```

---

## Common Patterns

### Validation Pattern

```typescript
function validateInput(text: string): { valid: boolean; message: string } {
	if (!text.trim()) {
		return { valid: false, message: 'Input cannot be empty' };
	}
	try {
		// validation logic
		return { valid: true, message: 'Valid input' };
	} catch (e) {
		const error = e as Error;
		return { valid: false, message: error.message };
	}
}
```

### Clipboard Copy

```typescript
function copyToClipboard(text: string) {
	navigator.clipboard.writeText(text);
}
```

### Reactive Processing

```typescript
$effect(() => {
	if (input.trim()) {
		process();
	} else {
		result = null;
	}
});
```

---

## Naming Conventions

| Item            | Convention | Example                |
| --------------- | ---------- | ---------------------- |
| Route directory | kebab-case | `my-tool/`             |
| Svelte files    | kebab-case | `my-tool/+page.svelte` |
| Functions       | camelCase  | `processInput()`       |
| Constants       | camelCase  | `algorithms = [...]`   |
| CSS classes     | kebab-case | `.content-input`       |
| State variables | camelCase  | `inputValue`           |

---

## Prettier Configuration

```json
{
	"useTabs": true,
	"singleQuote": true,
	"trailingComma": "none",
	"printWidth": 100,
	"plugins": ["prettier-plugin-svelte", "prettier-plugin-tailwindcss"],
	"overrides": [
		{
			"files": "*.svelte",
			"options": {
				"parser": "svelte"
			}
		}
	]
}
```

---

# Implementation flow

## 1. Think Before Coding

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

---

## Final Checklist

- [ ] Created route file at `src/routes/[tool-name]/+page.svelte`
- [ ] Added tool to homepage routes array
- [ ] Uses Svelte 5 runes (`$state`, `$derived`, `$effect`)
- [ ] Imports `shared.css` via layout (automatic)
- [ ] Uses existing CSS classes from shared.css
- [ ] Has proper page title in `<svelte:head>`
- [ ] Has responsive design (mobile-friendly)
- [ ] Includes sample data in `onMount` (optional but recommended)
- [ ] E2E tests added at `src/routes/[tool-name]/e2e/test.e2e.ts` (optional but recommended)

---

## Shared Utilities Location

Put reusable functions in `src/lib/`:

- Unit testable logic
- Crypto utilities
- Validation helpers

Example: `src/lib/crypto.ts` with corresponding `src/lib/crypto.spec.ts`

---

## File: src/routes/+page.svelte

To add a new tool, update the routes array:

```typescript
const routes = [
	{
		path: '/my-tool',
		name: 'My Tool',
		description: 'Description of the tool.'
	}
];
```

---

## Quick reference

```bash
npm run storybook    # Run dev only storybook UI
pnpm run dev --open  # Run dev server
npm run test:e2e     # Execute E2E tests
```
