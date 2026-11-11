import { page } from 'vitest/browser';
import { createRawSnippet } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import RunControls from './RunControls.svelte';

const field = createRawSnippet(() => ({ render: () => '<label>Seed <input /></label>' }));

describe('RunControls', () => {
	it('shows only Run when the tool cannot stop or continue', async () => {
		const onrun = vi.fn();
		render(RunControls, { onrun });
		await expect.element(page.getByRole('heading', { name: 'Run' })).toBeInTheDocument();
		await page.getByRole('button', { name: 'Run' }).click();
		expect(onrun).toHaveBeenCalledOnce();
		await expect.element(page.getByRole('button', { name: 'Stop' })).not.toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: 'Continue' })).not.toBeInTheDocument();
	});

	it('turns Run into Stop while running, and offers Continue only after a stop', async () => {
		const onstop = vi.fn();
		const props = { onrun: () => {}, onstop, oncontinue: () => {} };
		const { rerender } = render(RunControls, { ...props, running: true });
		await expect.element(page.getByRole('button', { name: 'Run' })).not.toBeInTheDocument();
		await page.getByRole('button', { name: 'Stop' }).click();
		expect(onstop).toHaveBeenCalledOnce();
		await expect.element(page.getByRole('button', { name: 'Continue' })).not.toBeInTheDocument();

		await rerender({ ...props, running: false, canContinue: true });
		await expect.element(page.getByRole('button', { name: 'Run' })).toBeEnabled();
		await expect.element(page.getByRole('button', { name: 'Stop' })).not.toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: 'Continue' })).toBeEnabled();
	});

	it('keeps the settings behind a closed Advanced line that names them', async () => {
		render(RunControls, { onrun: () => {}, fields: field, summary: 'seed 7' });
		await expect.element(page.getByText('Advanced')).toBeVisible();
		await expect.element(page.getByText('· seed 7')).toBeVisible();
		await expect.element(page.getByLabelText('Seed')).not.toBeVisible();
		await page.getByText('Advanced').click();
		await expect.element(page.getByLabelText('Seed')).toBeVisible();
	});

	it('opens the Advanced line when advancedOpen is set', async () => {
		render(RunControls, { onrun: () => {}, fields: field, advancedOpen: true });
		await expect.element(page.getByLabelText('Seed')).toBeVisible();
	});
});
