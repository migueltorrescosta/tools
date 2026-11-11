import { page, userEvent } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import TimelineView from './TimelineView.svelte';
import { groupByYear, sortEventsByDate, type TimelineEvent } from './timelines';

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

describe('TimelineView rows', () => {
	it('shows each description in full, after its title', async () => {
		renderPlain();
		await userEvent.click(page.getByRole('button', { name: 'Show 1 earlier event (2024)' }));
		const rows = page.getByTestId('timeline-event');
		await expect.element(rows.nth(0)).toHaveTextContent('Stubb beats Haavisto in the runoff');
		await expect.element(rows.nth(1)).toHaveTextContent('Scheduled legislative election');
		expect(page.getByRole('tooltip').elements()).toHaveLength(0);
	});

	it('marks linked titles with ↗, kept out of the link name', async () => {
		renderPlain();
		await userEvent.click(page.getByRole('button', { name: /earlier event/ }));
		const link = page.getByRole('link', { name: 'Finland Presidential', exact: true });
		await expect.element(link).toHaveTextContent('Finland Presidential↗');
		await expect.element(link).toHaveAttribute('target', '_blank');
		await expect
			.element(page.getByText('Portugal Legislative', { exact: true }))
			.not.toHaveAttribute('href');
	});

	it('leaves out a missing description', async () => {
		render(TimelineView, {
			groups: groupByYear([{ ...plain[1], description: undefined }]),
			rich: false,
			now
		});
		await expect
			.element(page.getByTestId('timeline-event'))
			.toHaveTextContent(/^\s*🇵🇹\s*10 Mar\s*Portugal Legislative\s*$/);
	});
});

describe('TimelineView earlier events', () => {
	it('folds past events into one button and opens on Today and the next event', async () => {
		renderPlain();
		const rows = page.getByTestId('timeline-event');
		expect(rows.elements()).toHaveLength(1);
		await expect.element(rows.first()).toHaveTextContent('Portugal Legislative');
		expect(
			page
				.getByRole('heading', { level: 2 })
				.elements()
				.map((h) => h.textContent)
		).toEqual(['2027']);
		const today = page.getByTestId('timeline-today').element();
		expect(today.nextElementSibling).toBe(rows.first().element());
	});

	it('names the count and the years of the folded events', async () => {
		const events: TimelineEvent[] = ['2024-02-11', '2025-05-01', '2026-01-02', '2026-09-01'].map(
			(date, i) => ({ id: i, emoji: '🗳️', date, title: `Event ${i}`, description: 'd' })
		);
		render(TimelineView, { groups: groupByYear(events), rich: false, now });
		await expect
			.element(page.getByRole('button', { name: 'Show 3 earlier events (2024–2026)' }))
			.toBeVisible();
		// The year of Today keeps only its upcoming events while the past is folded.
		expect(
			page
				.getByRole('heading', { level: 2 })
				.elements()
				.map((h) => h.textContent)
		).toEqual(['2026']);
	});

	it('shows the earlier events, muted, on request and moves focus to the first', async () => {
		renderPlain();
		await userEvent.click(page.getByRole('button', { name: 'Show 1 earlier event (2024)' }));
		const rows = page.getByTestId('timeline-event').elements();
		expect(rows).toHaveLength(2);
		expect(rows[0].classList.contains('past')).toBe(true);
		expect(rows[1].classList.contains('past')).toBe(false);
		expect(document.activeElement).toBe(rows[0]);
		expect(page.getByRole('button').elements()).toHaveLength(0);
		const years = page.getByRole('heading', { level: 2 }).elements();
		expect(years.map((h) => h.textContent)).toEqual(['2024', '2027']);
		expect(page.getByTestId('timeline-today').element().nextElementSibling).toBe(rows[1]);
	});

	it('has no Today row, fold or muted rows when every event is past', async () => {
		render(TimelineView, { groups: groupByYear(plain.slice(0, 1)), rich: false, now });
		expect(page.getByTestId('timeline-today').elements()).toHaveLength(0);
		expect(page.getByRole('button').elements()).toHaveLength(0);
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
		await userEvent.click(page.getByRole('button', { name: /earlier event/ }));
		const cards = page.getByTestId('timeline-event');
		expect(cards.elements()).toHaveLength(2);
		await expect.element(cards.nth(0).getByText(/^✦/)).toHaveTextContent('✦ Parallel training');
		expect(cards.nth(1).getByText(/^✦/).elements()).toHaveLength(0);
		expect(cards.nth(1).getByRole('link').elements()).toHaveLength(0);
		await expect.element(cards.nth(1).getByText('Unlinked', { exact: true })).toBeVisible();
		await expect
			.element(page.getByRole('link', { name: 'Transformer', exact: true }))
			.toBeVisible();
		await expect.element(cards.nth(0)).toHaveTextContent('Self-attention replaces recurrence');
		await expect.element(cards.nth(1)).toHaveTextContent('Only a description');
		expect(page.getByRole('button').elements()).toHaveLength(0);
	});

	it('marks past rich events', async () => {
		render(TimelineView, { groups: groupByYear(rich), rich: true, now });
		await userEvent.click(page.getByRole('button', { name: 'Show 1 earlier event (2017)' }));
		const cards = page.getByTestId('timeline-event').elements();
		expect(cards[0].classList.contains('past')).toBe(true);
		expect(cards[1].classList.contains('past')).toBe(false);
		expect(page.getByTestId('timeline-today').element().nextElementSibling).toBe(cards[1]);
	});
});

describe('TimelineView long timelines', () => {
	// 2025 is all past; 2026 holds today's split (42 past, 38 upcoming); 2027 is all upcoming.
	const long: TimelineEvent[] = sortEventsByDate(
		[2025, 2026, 2027].flatMap((year) =>
			Array.from({ length: 80 }, (_, i) => ({
				id: year * 1000 + i,
				emoji: '🎉',
				date: `${year}-${String((i % 12) + 1).padStart(2, '0')}-01`,
				title: `Holiday ${year}-${i}`
			}))
		)
	);

	it('opens only the year of the next event and shows the others on request', async () => {
		render(TimelineView, { groups: groupByYear(long), rich: false, now });
		const headings = () =>
			page
				.getByRole('heading', { level: 2 })
				.elements()
				.map((h) => h.textContent);
		expect(headings()).toEqual(['2026', '2027']);
		expect(page.getByTestId('timeline-event').elements()).toHaveLength(38);
		await expect.element(page.getByText('Holiday 2026-6', { exact: true })).toBeVisible();

		await userEvent.click(
			page.getByRole('button', { name: 'Show 122 earlier events (2025–2026)' })
		);
		expect(headings()).toEqual(['2025', '2026', '2027']);
		expect(page.getByTestId('timeline-event').elements()).toHaveLength(80);

		await userEvent.click(page.getByRole('button', { name: 'Show 80 events' }).first());
		expect(page.getByTestId('timeline-event').elements()).toHaveLength(160);
		await expect.element(page.getByText('Holiday 2025-0', { exact: true })).toBeVisible();
		expect(page.getByRole('button', { name: 'Show 80 events' }).elements()).toHaveLength(1);
	});
});
