import { page, userEvent } from 'vitest/browser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import FormatPage from './+page.svelte';

function ui() {
	return {
		content: page.getByRole('textbox', { name: 'Content' }),
		status: page.getByRole('status', { name: 'Validation result' }),
		copy: page.getByRole('button', { name: /^(Copy input|Copied|Copy failed)$/ }),
		format: (name: string) => page.getByRole('radio', { name, exact: true }),
		example: page.getByRole('button', { name: 'Try an example' })
	};
}

afterEach(() => vi.restoreAllMocks());

describe('/format page', () => {
	it('opens empty, with the placeholder and an example link', async () => {
		render(FormatPage);
		const u = ui();
		await expect.element(u.content).toHaveValue('');
		await expect.element(u.content).toHaveAttribute('placeholder', 'Paste your JSON here...');
		await expect.element(u.status).toHaveTextContent('Enter content above to validate');
		await expect.element(u.example).toBeVisible();
		await expect.element(u.copy).toBeDisabled();
	});

	it('fills the JSON example, switching to JSON, and hides the link', async () => {
		render(FormatPage);
		const u = ui();
		await u.format('YAML').click();
		await u.example.click();
		await expect.element(u.format('JSON')).toBeChecked();
		await expect.element(u.content).toHaveValue('{\n  "name": "example",\n  "value": 123\n}');
		await expect.element(u.status).toHaveTextContent('Valid JSON');
		await expect.element(u.example).not.toBeInTheDocument();
	});

	it('names the Text format plainly in its placeholder', async () => {
		render(FormatPage);
		const u = ui();
		await u.format('Text').click();
		await expect.element(u.content).toHaveAttribute('placeholder', 'Paste your text here...');
	});

	it('shows the placeholder, not an error, for whitespace-only content', async () => {
		render(FormatPage);
		const u = ui();
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

	it('exposes the selected format as a checked radio', async () => {
		render(FormatPage);
		const u = ui();
		await expect.element(u.format('JSON')).toBeChecked();
		await expect.element(u.format('YAML')).not.toBeChecked();
		await u.format('YAML').click();
		await expect.element(u.format('YAML')).toBeChecked();
		await expect.element(u.format('JSON')).not.toBeChecked();
	});

	it('copies the input and confirms it', async () => {
		const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
		render(FormatPage);
		const u = ui();
		await u.content.fill('key: value');
		await expect.element(u.copy).toHaveTextContent('Copy input');
		await u.copy.click();
		expect(writeText).toHaveBeenCalledWith('key: value');
		await expect.element(u.copy).toHaveTextContent('Copied');
	});

	it('reports a failed copy instead of an unhandled rejection', async () => {
		vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new DOMException('denied'));
		render(FormatPage);
		const u = ui();
		await u.content.fill('{}');
		await u.copy.click();
		await expect.element(u.copy).toHaveTextContent('Copy failed');
	});

	it('disables copy when there is nothing to copy', async () => {
		render(FormatPage);
		const u = ui();
		await u.content.fill('{}');
		await expect.element(u.status).toHaveTextContent('Valid JSON');
		await expect.element(u.copy).toBeEnabled();
		await userEvent.clear(u.content);
		await expect.element(u.copy).toBeDisabled();
	});
});
