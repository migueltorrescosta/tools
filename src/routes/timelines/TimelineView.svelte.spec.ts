import { page, userEvent } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import TimelineView from './TimelineView.svelte';
import { groupByYear, type TimelineEvent } from './timelines';

const now = new Date(2026, 5, 15, 12, 0);

const plain: TimelineEvent[] = [
	{
		id: 1,
		emoji: '🇫🇮',
		date: '2024-02-11',
		title: 'Finland Presidential',
		description: 'Stubb beats Haavisto in the runoff',
		url: 'https://example.com/fi'
	},
	{
		id: 2,
		emoji: '🇵🇹',
		date: '2027-03-10',
		title: 'Portugal Legislative',
		description: 'Scheduled legislative election'
	}
];

function renderPlain() {
	return render(TimelineView, { groups: groupByYear(plain), rich: false, now });
}

describe('TimelineView grid descriptions', () => {
	it('shows the description as a linked tooltip when a card is focused', async () => {
		renderPlain();
		const info = page.getByRole('button', { name: /Portugal Legislative/ });
		(info.element() as HTMLElement).focus();
		await expect.element(info).toHaveFocus();
		const tooltip = page.getByRole('tooltip');
		await expect.element(tooltip).toHaveTextContent('Scheduled legislative election');
		await expect.element(info).toHaveAccessibleDescription('Scheduled legislative election');
	});

	it('keeps the tooltip while tabbing from the info button to the title link', async () => {
		renderPlain();
		(page.getByRole('button', { name: /11 Feb/ }).element() as HTMLElement).focus();
		await userEvent.tab();
		const link = page.getByRole('link', { name: 'Finland Presidential' });
		await expect.element(link).toHaveFocus();
		await expect
			.element(page.getByRole('tooltip'))
			.toHaveTextContent('Stubb beats Haavisto in the runoff');
	});

	it('shows the description on tap and links it from the title link', async () => {
		renderPlain();
		await userEvent.click(page.getByRole('button', { name: /11 Feb/ }));
		await expect
			.element(page.getByRole('tooltip'))
			.toHaveTextContent('Stubb beats Haavisto in the runoff');
		await expect
			.element(page.getByRole('link', { name: 'Finland Presidential' }))
			.toHaveAccessibleDescription('Stubb beats Haavisto in the runoff');
	});

	it('closes the tooltip on Escape and on scroll', async () => {
		renderPlain();
		const info = page.getByRole('button', { name: /Portugal Legislative/ });
		await userEvent.click(info);
		await expect.element(page.getByRole('tooltip')).toBeInTheDocument();
		await userEvent.keyboard('{Escape}');
		await expect.element(page.getByRole('tooltip')).not.toBeInTheDocument();

		await userEvent.click(info);
		await expect.element(page.getByRole('tooltip')).toBeInTheDocument();
		window.dispatchEvent(new Event('scroll'));
		await expect.element(page.getByRole('tooltip')).not.toBeInTheDocument();
	});

	it('does not give rows the tooltip role', async () => {
		renderPlain();
		expect(page.getByRole('tooltip').elements()).toHaveLength(0);
		expect(page.getByTestId('timeline-event').elements()).toHaveLength(2);
	});

	it('lists events under year headings, with the description inline', async () => {
		renderPlain();
		const years = page.getByRole('heading', { level: 2 }).elements();
		expect(years.map((h) => h.textContent)).toEqual(['2024', '2027']);
		await expect
			.element(page.getByTestId('timeline-event').nth(1))
			.toHaveTextContent('Scheduled legislative election');
	});

	it('marks past events, linked titles included, and puts Today before the first upcoming', async () => {
		renderPlain();
		const rows = page.getByTestId('timeline-event').elements();
		expect(rows[0].classList.contains('past')).toBe(true);
		expect(rows[1].classList.contains('past')).toBe(false);
		const today = page.getByTestId('timeline-today').element();
		expect(today.textContent).toBe('Today');
		expect(today.nextElementSibling).toBe(rows[1]);
	});

	it('has no Today row or muted rows when every event is past', async () => {
		render(TimelineView, { groups: groupByYear(plain.slice(0, 1)), rich: false, now });
		expect(page.getByTestId('timeline-today').elements()).toHaveLength(0);
		expect(page.getByTestId('timeline-event').element().classList.contains('past')).toBe(false);
	});
});

describe('TimelineView rich cards', () => {
	const rich: TimelineEvent[] = [
		{
			id: 10,
			emoji: '🧠',
			date: '2017-06-12',
			title: 'Transformer',
			description: 'Attention is all you need',
			url: 'https://arxiv.org/abs/1706.03762',
			conceptDescription: 'Self-attention replaces recurrence',
			valueAdd: 'Parallel training'
		},
		{
			id: 11,
			emoji: '🧠',
			date: '2030-01-10',
			title: 'Unlinked',
			description: 'Only a description'
		}
	];

	it('omits missing value-adds and renders unlinked titles as text', async () => {
		render(TimelineView, { groups: groupByYear(rich), rich: true, now });
		const cards = page.getByTestId('timeline-event');
		expect(cards.elements()).toHaveLength(2);
		await expect.element(cards.nth(0).getByText(/^✦/)).toHaveTextContent('✦ Parallel training');
		expect(cards.nth(1).getByText(/^✦/).elements()).toHaveLength(0);
		expect(cards.nth(1).getByRole('link').elements()).toHaveLength(0);
		await expect.element(cards.nth(1).getByText('Unlinked', { exact: true })).toBeVisible();
		await expect.element(page.getByRole('link', { name: 'Transformer' })).toBeVisible();
		await expect.element(cards.nth(0)).toHaveTextContent('Self-attention replaces recurrence');
		await expect.element(cards.nth(1)).toHaveTextContent('Only a description');
		expect(page.getByRole('button').elements()).toHaveLength(0);
	});

	it('marks past rich events', async () => {
		render(TimelineView, { groups: groupByYear(rich), rich: true, now });
		const cards = page.getByTestId('timeline-event').elements();
		expect(cards[0].classList.contains('past')).toBe(true);
		expect(cards[1].classList.contains('past')).toBe(false);
		expect(page.getByTestId('timeline-today').element().nextElementSibling).toBe(cards[1]);
	});
});

describe('TimelineView long timelines', () => {
	// 2025 is all past; 2026 holds today's split; 2027 is all upcoming.
	const long: TimelineEvent[] = [2025, 2026, 2027].flatMap((year) =>
		Array.from({ length: 80 }, (_, i) => ({
			id: year * 1000 + i,
			emoji: '🎉',
			date: `${year}-${String((i % 12) + 1).padStart(2, '0')}-01`,
			title: `Holiday ${year}-${i}`,
			description: ''
		}))
	);

	it('opens only the year of the next event and shows the others on request', async () => {
		render(TimelineView, { groups: groupByYear(long), rich: false, now });
		const years = page.getByRole('heading', { level: 2 }).elements();
		expect(years.map((h) => h.textContent)).toEqual(['2025', '2026', '2027']);
		expect(page.getByTestId('timeline-event').elements()).toHaveLength(80);
		await expect.element(page.getByText('Holiday 2026-0', { exact: true })).toBeVisible();

		await userEvent.click(page.getByRole('button', { name: 'Show 80 events' }).first());
		expect(page.getByTestId('timeline-event').elements()).toHaveLength(160);
		await expect.element(page.getByText('Holiday 2025-0', { exact: true })).toBeVisible();
		expect(page.getByRole('button', { name: 'Show 80 events' }).elements()).toHaveLength(1);
	});
});
