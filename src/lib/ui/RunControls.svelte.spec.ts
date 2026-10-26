import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import RunControls from './RunControls.svelte';

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

	it('enables Stop while running and Continue once stopped', async () => {
		const props = { onrun: () => {}, onstop: () => {}, oncontinue: () => {} };
		const { rerender } = render(RunControls, { ...props, running: true });
		await expect.element(page.getByRole('button', { name: 'Run' })).toBeDisabled();
		await expect.element(page.getByRole('button', { name: 'Stop' })).toBeEnabled();
		await expect.element(page.getByRole('button', { name: 'Continue' })).toBeDisabled();
		await rerender({ ...props, running: false, canContinue: true });
		await expect.element(page.getByRole('button', { name: 'Run' })).toBeEnabled();
		await expect.element(page.getByRole('button', { name: 'Stop' })).toBeDisabled();
		await expect.element(page.getByRole('button', { name: 'Continue' })).toBeEnabled();
	});
});
