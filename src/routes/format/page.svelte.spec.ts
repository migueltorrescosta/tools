import { page, userEvent } from 'vitest/browser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import FormatPage from './+page.svelte';

function ui() {
	return {
		content: page.getByRole('textbox', { name: 'CONTENT' }),
		status: page.getByRole('status', { name: 'VALIDATION RESULT' }),
		copy: page.getByRole('button', { name: /^(COPY INPUT|COPIED|COPY FAILED)$/ }),
		format: (name: string) => page.getByRole('button', { name, exact: true })
	};
}

afterEach(() => vi.restoreAllMocks());

describe('/format page', () => {
	it('shows the placeholder, not an error, for whitespace-only content', async () => {
		render(FormatPage);
		const u = ui();
		await expect.element(u.status).toHaveTextContent('Valid JSON');
		await u.content.fill('   \n\t  ');
		await expect.element(u.status).toHaveTextContent('Enter content above to validate');
		await expect.element(u.status).not.toHaveTextContent(/empty|Invalid/);
	});

	it('labels the textarea and announces results in a polite live region', async () => {
		render(FormatPage);
		const u = ui();
		await expect.element(u.content).toBeVisible();
		await expect.element(u.status).toHaveAttribute('aria-live', 'polite');
		await u.content.fill('{"a":1,}');
		await expect
			.element(u.status)
			.toHaveTextContent("Invalid JSON at line 1, column 8: Trailing comma before '}'");
	});

	it('exposes the selected format with aria-pressed', async () => {
		render(FormatPage);
		const u = ui();
		await expect.element(u.format('JSON')).toHaveAttribute('aria-pressed', 'true');
		await expect.element(u.format('YAML')).toHaveAttribute('aria-pressed', 'false');
		await u.format('YAML').click();
		await expect.element(u.format('YAML')).toHaveAttribute('aria-pressed', 'true');
		await expect.element(u.format('JSON')).toHaveAttribute('aria-pressed', 'false');
	});

	it('copies the input and confirms it', async () => {
		const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
		render(FormatPage);
		const u = ui();
		await u.content.fill('key: value');
		await expect.element(u.copy).toHaveTextContent('COPY INPUT');
		await u.copy.click();
		expect(writeText).toHaveBeenCalledWith('key: value');
		await expect.element(u.copy).toHaveTextContent('COPIED');
	});

	it('reports a failed copy instead of an unhandled rejection', async () => {
		vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new DOMException('denied'));
		render(FormatPage);
		const u = ui();
		await expect.element(u.status).toHaveTextContent('Valid JSON');
		await u.copy.click();
		await expect.element(u.copy).toHaveTextContent('COPY FAILED');
	});

	it('disables copy when there is nothing to copy', async () => {
		render(FormatPage);
		const u = ui();
		await expect.element(u.status).toHaveTextContent('Valid JSON');
		await userEvent.clear(u.content);
		await expect.element(u.copy).toBeDisabled();
	});
});
