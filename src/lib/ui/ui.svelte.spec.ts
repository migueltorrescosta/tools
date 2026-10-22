import { page, userEvent } from 'vitest/browser';
import { createRawSnippet } from 'svelte';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Alert from './Alert.svelte';
import Button from './Button.svelte';
import DataTable from './DataTable.svelte';
import Maximizable from './Maximizable.svelte';
import Output from './Output.svelte';
import Panel from './Panel.svelte';
import SegmentedControl from './SegmentedControl.svelte';
import Select from './Select.svelte';

const text = (t: string) => createRawSnippet(() => ({ render: () => `<span>${t}</span>` }));

describe('Button', () => {
	it('exposes toggle state through aria-pressed', async () => {
		render(Button, { pressed: true, children: text('Bold') });
		await expect
			.element(page.getByRole('button', { name: 'Bold' }))
			.toHaveAttribute('aria-pressed', 'true');
	});

	it('renders a link when given href', async () => {
		render(Button, { href: '/jwt', children: text('Open') });
		await expect.element(page.getByRole('link', { name: 'Open' })).toHaveAttribute('href', '/jwt');
	});
});

describe('Select', () => {
	it('labels the select and binds the chosen value', async () => {
		const options = [
			{ value: 'a', label: 'Alpha' },
			{ value: 'b', label: 'Beta' }
		] as const;
		render(Select<'a' | 'b'>, { label: 'Letter', options, value: 'a' });
		const select = page.getByRole('combobox', { name: 'Letter' });
		await select.selectOptions('b');
		await expect.element(select).toHaveValue('b');
	});
});

describe('SegmentedControl', () => {
	it('is a named group of radios', async () => {
		const options = [
			{ value: 'x', label: 'X' },
			{ value: 'y', label: 'Y' }
		] as const;
		render(SegmentedControl<'x' | 'y'>, { legend: 'Axis', options, value: 'x' });
		await expect.element(page.getByRole('group', { name: 'Axis' })).toBeInTheDocument();
		await expect.element(page.getByRole('radio', { name: 'X' })).toBeChecked();
		await page.getByRole('radio', { name: 'Y' }).click();
		await expect.element(page.getByRole('radio', { name: 'Y' })).toBeChecked();
	});

	it('keeps a decorative icon out of the accessible name', async () => {
		const options = [{ value: 'it', label: 'Italiano', icon: '🇮🇹' }] as const;
		render(SegmentedControl<'it'>, { legend: 'Language', options, value: 'it' });
		await expect.element(page.getByRole('radio', { name: 'Italiano', exact: true })).toBeChecked();
	});
});

describe('Panel', () => {
	it('titles its section with a heading at the given level', async () => {
		render(Panel, { title: 'Payload', level: 3, children: text('body') });
		await expect.element(page.getByRole('heading', { name: 'Payload', level: 3 })).toBeVisible();
	});
});

describe('DataTable', () => {
	it('has a caption and column headers', async () => {
		render(DataTable<{ name: string; n: number }>, {
			caption: 'Scores',
			columns: [
				{ key: 'name', label: 'Name' },
				{ key: 'n', label: 'Score', align: 'right' }
			],
			rows: [{ name: 'Ada', n: 3 }],
			rowKey: (r) => r.name
		});
		await expect.element(page.getByRole('table', { name: 'Scores' })).toBeVisible();
		await expect.element(page.getByRole('columnheader', { name: 'Score' })).toBeVisible();
		await expect.element(page.getByRole('cell', { name: '3' })).toBeVisible();
	});
});

describe('Output', () => {
	it('announces its value politely and disables Copy when empty', async () => {
		render(Output, { label: 'Result', value: '' });
		const output = page.getByRole('status', { name: 'Result' });
		await expect.element(output).toHaveAttribute('aria-live', 'polite');
		await expect.element(page.getByRole('button', { name: 'Copy' })).toBeDisabled();
	});
});

describe('Alert', () => {
	it('uses role=alert for danger and status otherwise', async () => {
		render(Alert, { tone: 'danger', children: text('Bad token') });
		await expect.element(page.getByRole('alert')).toHaveTextContent('Bad token');
		render(Alert, { tone: 'success', children: text('Valid') });
		await expect.element(page.getByRole('status')).toHaveTextContent('Valid');
	});
});

describe('Maximizable', () => {
	const plot = createRawSnippet((maximized: () => boolean) => ({
		render: () => `<p data-testid="plot">${maximized() ? 'big' : 'small'}</p>`
	}));

	it('opens the plot in a modal dialog; Esc and ✕ close it and focus returns', async () => {
		render(Maximizable, { title: 'Chart', plot });
		const open = page.getByRole('button', { name: 'Maximize Chart' });
		const dialog = page.getByRole('dialog', { name: 'Chart' });
		await expect.element(page.getByTestId('plot')).toHaveTextContent('small');
		// The dialog's copy renders only while open
		expect(document.querySelectorAll('[data-testid="plot"]')).toHaveLength(1);

		await open.click();
		await expect.element(dialog).toBeVisible();
		await expect.element(dialog.getByTestId('plot')).toHaveTextContent('big');
		expect(dialog.element().contains(document.activeElement)).toBe(true);
		await userEvent.keyboard('{Escape}');
		await expect.element(dialog).not.toBeInTheDocument();
		await expect.element(open).toHaveFocus();
		expect(document.querySelectorAll('[data-testid="plot"]')).toHaveLength(1);

		await open.click();
		await page.getByRole('button', { name: 'Close Chart' }).click();
		await expect.element(dialog).not.toBeInTheDocument();
		await expect.element(open).toHaveFocus();
	});

	it('disables the button while the plot is pending', async () => {
		render(Maximizable, { title: 'Tree', plot, disabled: true });
		await expect.element(page.getByRole('button', { name: 'Maximize Tree' })).toBeDisabled();
	});
});
