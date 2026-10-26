import { createRawSnippet } from 'svelte';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ScrollEdges from './ScrollEdges.svelte';

const box = (width: number) =>
	createRawSnippet(() => ({ render: () => `<div style="width: ${width}px">content</div>` }));
const hint = createRawSnippet(() => ({ render: () => '<p>Scroll sideways</p>' }));
const edges = (container: HTMLElement) => container.querySelector('.ui-scroll-edges')!.classList;

describe('ScrollEdges', () => {
	it('shadows the right edge while there is more to the right', async () => {
		const { container } = render(ScrollEdges, { children: box(5000) });
		await expect.poll(() => edges(container).contains('more-right')).toBe(true);
		expect(edges(container).contains('more-left')).toBe(false);
	});

	it('can open at the right end, with the shadow on the left and the hint shown', async () => {
		const { container } = render(ScrollEdges, { children: box(5000), startAtEnd: true, hint });
		await expect.poll(() => edges(container).contains('more-left')).toBe(true);
		expect(edges(container).contains('more-right')).toBe(false);
		expect(container.textContent).toContain('Scroll sideways');
	});

	it('shows no hint and no shadow when the content fits', async () => {
		const { container } = render(ScrollEdges, { children: box(10), hint });
		await expect.poll(() => container.textContent).toContain('content');
		expect(container.textContent).not.toContain('Scroll sideways');
		expect(edges(container).contains('more-right')).toBe(false);
	});

	it('fades only the right edge', async () => {
		const { container } = render(ScrollEdges, {
			children: box(5000),
			fade: true,
			startAtEnd: true
		});
		await expect.poll(() => edges(container).contains('fade')).toBe(true);
		expect(edges(container).contains('more-left')).toBe(false);
	});
});
