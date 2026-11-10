import type { Snippet } from 'svelte';

/**
 * The current page's own actions (Share and Clear), drawn in the top bar by
 * +layout.svelte rather than in a row above the tool. PageHeader sets it.
 */
export const headerActions = $state<{ snippet: Snippet | undefined }>({ snippet: undefined });
