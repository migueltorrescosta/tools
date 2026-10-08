import { page, userEvent } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import DecisionTree from './DecisionTree.svelte';
import { buildGraph } from './graph';

// tree.json has no explanations, so the feature is exercised on a fixture
const graph = buildGraph({
	nodes: [
		{ id: 'root', type: 'question', content: 'Coffee or tea?' },
		{ id: 'r1', type: 'result', content: 'Espresso' },
		{ id: 'r2', type: 'result', content: 'Green tea' }
	],
	edges: [
		{ sourceId: 'root', targetId: 'r1', label: 'Coffee', explanation: 'More caffeine' },
		{ sourceId: 'root', targetId: 'r2', label: 'Tea' }
	]
});

describe('DecisionTree explanations', () => {
	it('links the tip to its answer and adds no toggle to answers without one', async () => {
		render(DecisionTree, { graph });
		const coffee = page.getByRole('button', { name: 'Coffee', exact: true });
		await expect.element(coffee).toHaveAccessibleDescription('More caffeine');
		await expect
			.element(page.getByRole('button', { name: 'Tea', exact: true }))
			.not.toHaveAttribute('aria-describedby');
		expect(page.getByRole('button', { name: /^Explain/ }).elements()).toHaveLength(1);
	});

	it('toggles the tip with the ? button without selecting the answer', async () => {
		render(DecisionTree, { graph });
		const tip = page.getByRole('tooltip', { includeHidden: true });
		const toggle = page.getByRole('button', { name: 'Explain "Coffee"' });
		await expect.element(tip).not.toBeVisible();

		// Move the pointer off after each tap so hover cannot be what shows the tip
		await toggle.click();
		await userEvent.unhover(toggle);
		await expect.element(tip).toBeVisible();
		await expect.element(toggle).toHaveAttribute('aria-expanded', 'true');
		await expect.element(page.getByText('Espresso', { exact: true })).not.toBeInTheDocument();

		await toggle.click();
		await userEvent.unhover(toggle);
		await expect.element(tip).not.toBeVisible();
		await expect.element(toggle).toHaveAttribute('aria-expanded', 'false');
	});

	it('shows the tip while an answer with an explanation is hovered', async () => {
		render(DecisionTree, { graph });
		const tip = page.getByRole('tooltip', { includeHidden: true });
		const coffee = page.getByRole('button', { name: 'Coffee', exact: true });
		await userEvent.hover(coffee);
		await expect.element(tip).toBeVisible();
		await userEvent.unhover(coffee);
		await expect.element(tip).not.toBeVisible();
	});

	it('shows the tip while the answer has keyboard focus', async () => {
		render(DecisionTree, { graph });
		const tip = page.getByRole('tooltip', { includeHidden: true });
		await expect.element(tip).not.toBeVisible();
		await userEvent.tab();
		await expect.element(page.getByRole('button', { name: 'Coffee', exact: true })).toHaveFocus();
		await expect.element(tip).toBeVisible();
	});

	it('selecting an answer advances the path and closes open tips', async () => {
		render(DecisionTree, { graph });
		await page.getByRole('button', { name: 'Explain "Coffee"' }).click();
		await page.getByRole('button', { name: 'Coffee', exact: true }).click();
		await expect.element(page.getByText('Espresso', { exact: true })).toBeVisible();
		await expect
			.element(page.getByRole('button', { name: 'Explain "Coffee"' }))
			.toHaveAttribute('aria-expanded', 'false');
	});
});

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
