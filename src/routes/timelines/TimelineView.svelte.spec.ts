import { page, userEvent } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import TimelineView from './TimelineView.svelte';
import { buildTimelineRows, type TimelineEvent } from './timelines';

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
	return render(TimelineView, { rows: buildTimelineRows(plain, false), rich: false, now });
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

	it('does not give cards the tooltip role', async () => {
		renderPlain();
		expect(page.getByRole('tooltip').elements()).toHaveLength(0);
		expect(page.getByRole('group').elements()).toHaveLength(2);
	});

	it('marks past events, linked titles included', async () => {
		const { container } = renderPlain();
		const cards = container.querySelectorAll('.event-card');
		expect(cards[0].classList.contains('past')).toBe(true);
		expect(cards[1].classList.contains('past')).toBe(false);
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
		const { container } = render(TimelineView, {
			rows: buildTimelineRows(rich, true),
			rich: true,
			now
		});
		const cards = container.querySelectorAll('.rich-event-card');
		expect(cards).toHaveLength(2);
		expect(cards[0].querySelector('.rich-card-value-add')?.textContent).toBe('✦ Parallel training');
		expect(cards[1].querySelector('.rich-card-value-add')).toBeNull();
		expect(cards[1].querySelector('a')).toBeNull();
		expect(cards[1].querySelector('.rich-card-title')?.textContent).toBe('Unlinked');
		await expect.element(page.getByRole('link', { name: 'Transformer' })).toBeVisible();
		expect(cards[1].querySelector('.rich-card-description')?.textContent).toBe(
			'Only a description'
		);
	});

	it('marks past rich events', async () => {
		const { container } = render(TimelineView, {
			rows: buildTimelineRows(rich, true),
			rich: true,
			now
		});
		const cards = container.querySelectorAll('.rich-event-card');
		expect(cards[0].classList.contains('past')).toBe(true);
		expect(cards[1].classList.contains('past')).toBe(false);
	});
});
