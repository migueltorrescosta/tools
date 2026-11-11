import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ThemeSwitch from './ThemeSwitch.svelte';
import { THEME_KEY } from '#lib/theme.svelte.js';

describe('ThemeSwitch', () => {
	beforeEach(async () => {
		// Desktop width: phones get the one-button form (tested below).
		await page.viewport(1024, 768);
		localStorage.removeItem(THEME_KEY);
		document.documentElement.style.colorScheme = '';
	});

	it('matches the device until a theme is picked, and can match it again', async () => {
		render(ThemeSwitch);
		const device = page.getByRole('button', { name: 'Match device theme' });
		await expect.element(device).toHaveAttribute('aria-pressed', 'true');

		await page.getByRole('button', { name: 'Dark theme' }).click();
		expect(localStorage.getItem(THEME_KEY)).toBe('dark');
		expect(document.documentElement.style.colorScheme).toBe('dark');
		await expect.element(device).toHaveAttribute('aria-pressed', 'false');

		await device.click();
		expect(localStorage.getItem(THEME_KEY)).toBeNull();
		expect(document.documentElement.style.colorScheme).toBe('');
	});

	it('shows a saved choice on the next visit', async () => {
		localStorage.setItem(THEME_KEY, 'light');
		render(ThemeSwitch);
		await expect
			.element(page.getByRole('button', { name: 'Light theme' }))
			.toHaveAttribute('aria-pressed', 'true');
	});

	it('on a phone, one button opens the three choices and closes after a pick', async () => {
		await page.viewport(390, 800);
		render(ThemeSwitch);
		const toggle = page.getByRole('button', { name: 'Theme: Match device' });
		await toggle.click();
		await page.getByRole('button', { name: 'Dark' }).click();
		expect(localStorage.getItem(THEME_KEY)).toBe('dark');
		await expect.element(page.getByRole('button', { name: 'Theme: Dark' })).toBeVisible();
		await expect
			.element(page.getByRole('button', { name: 'Light', exact: true }))
			.not.toBeInTheDocument();
	});
});
