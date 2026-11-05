import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import DecisionTree from './DecisionTree.svelte';
import { buildGraph } from './graph';

describe('DecisionTree selection state and restart', () => {
	const twoStep = buildGraph({
		nodes: [
			{ id: 'root', type: 'question', content: 'Hot or cold?' },
			{ id: 'q1', type: 'question', content: 'Milk?' },
			{ id: 'r1', type: 'result', content: 'Latte' },
			{ id: 'r2', type: 'result', content: 'Iced tea' }
		],
		edges: [
			{ sourceId: 'root', targetId: 'q1', label: 'Hot' },
			{ sourceId: 'root', targetId: 'r2', label: 'Cold' },
			{ sourceId: 'q1', targetId: 'r1', label: 'Yes' }
		]
	});

	it('exposes the chosen answer with aria-pressed', async () => {
		render(DecisionTree, { graph: twoStep });
		const hot = page.getByRole('button', { name: 'Hot', exact: true });
		const cold = page.getByRole('button', { name: 'Cold', exact: true });
		await expect.element(hot).toHaveAttribute('aria-pressed', 'false');
		await hot.click();
		await expect.element(hot).toHaveAttribute('aria-pressed', 'true');
		await expect.element(cold).toHaveAttribute('aria-pressed', 'false');
	});

	it('announces the newly revealed question and the result', async () => {
		render(DecisionTree, { graph: twoStep });
		const status = page.getByRole('status');
		await expect.element(status).toHaveTextContent('Hot or cold?');
		await page.getByRole('button', { name: 'Hot', exact: true }).click();
		await expect.element(status).toHaveTextContent('Milk?');
		await page.getByRole('button', { name: 'Yes', exact: true }).click();
		await expect.element(status).toHaveTextContent('Result: Latte');
	});

	it('Start over clears the path and focuses the first answer', async () => {
		render(DecisionTree, { graph: twoStep, path: ['root|Hot', 'q1|Yes'] });
		await expect.element(page.getByText('Latte', { exact: true })).toBeVisible();
		await page.getByRole('button', { name: 'Start over' }).click();
		await expect.element(page.getByText('Latte', { exact: true })).not.toBeInTheDocument();
		await expect.element(page.getByText('Milk?')).not.toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: 'Hot', exact: true })).toHaveFocus();
		await expect.element(page.getByRole('button', { name: 'Start over' })).not.toBeInTheDocument();
	});
});
