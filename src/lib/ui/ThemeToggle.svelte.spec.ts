import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ThemeToggle from './ThemeToggle.svelte';
import { THEME_KEY } from '$lib/theme.svelte';

const systemTheme = () => (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
const opposite = (t: string) => (t === 'dark' ? 'light' : 'dark');

describe('ThemeToggle', () => {
	beforeEach(() => {
		localStorage.removeItem(THEME_KEY);
		document.documentElement.style.colorScheme = '';
	});

	it('follows the OS until toggled, then saves the opposite for good', async () => {
		render(ThemeToggle);
		const os = systemTheme();
		const button = page.getByRole('button', { name: `Switch to ${opposite(os)} theme` });
		await expect.element(button).toBeVisible();
		expect(localStorage.getItem(THEME_KEY)).toBeNull();

		await button.click();
		expect(localStorage.getItem(THEME_KEY)).toBe(opposite(os));
		expect(document.documentElement.style.colorScheme).toBe(opposite(os));
		await expect.element(page.getByRole('button', { name: `Switch to ${os} theme` })).toBeVisible();
	});

	it('keeps a saved choice on the next visit', async () => {
		localStorage.setItem(THEME_KEY, 'light');
		render(ThemeToggle);
		await expect.element(page.getByRole('button', { name: 'Switch to dark theme' })).toBeVisible();
	});
});
