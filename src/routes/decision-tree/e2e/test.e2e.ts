import { expect, test, type Page } from '@playwright/test';

/** Load `url` and wait until the page has hydrated, so clicks are not lost. */
async function open(page: Page, url = '/decision-tree') {
	await page.goto(url);
	await expect(page.locator('.container[data-hydrated]')).toBeVisible();
}

/** Click the answer labelled `label` in the answer row at `depth` (0 = root question). */
async function answer(page: Page, depth: number, label: string) {
	await answerRows(page).nth(depth).getByRole('button', { name: label, exact: true }).click();
}

/** Show every answer of the answered question at `depth` again. */
async function change(page: Page, depth: number) {
	await answerRows(page).nth(depth).getByRole('button', { name: 'Change', exact: true }).click();
}

/** The answer groups, one per question shown (0 = root question). */
function answerRows(page: Page) {
	return page.getByTestId('answers');
}

function questions(page: Page) {
	return page.getByRole('main').getByRole('heading', { level: 2 });
}

function result(page: Page) {
	return page.getByTestId('result');
}

test.describe('Decision Tree E2E', () => {
	test.beforeEach(async ({ page }) => {
		await open(page);
		await expect(page.getByRole('heading', { level: 1 })).toHaveText('Decision Tree');
		await expect(page).toHaveTitle('Decision Tree');
		await expect(questions(page).first()).toHaveText('Pick a guide');
	});

	test('valid traversal renders alternating rows and reaches a result', async ({ page }) => {
		await answer(page, 0, 'Which car to buy');
		await expect(questions(page)).toHaveCount(2);
		await expect(questions(page).nth(1)).toHaveText('What matters most?');

		await answer(page, 1, 'Low running cost or emissions');
		await expect(questions(page)).toHaveCount(3);
		await expect(questions(page).nth(2)).toHaveText('Can you charge at home?');

		await answer(page, 2, 'Yes');
		await expect(result(page)).toHaveText('Battery EV');
		await expect(answerRows(page)).toHaveCount(3);
	});

	test('changing a previous answer removes downstream rows', async ({ page }) => {
		await answer(page, 0, 'Which car to buy');
		await answer(page, 1, 'Low running cost or emissions');
		await answer(page, 2, 'Yes');
		await expect(result(page)).toHaveText('Battery EV');

		await change(page, 2);
		await answer(page, 2, 'No');
		await expect(result(page)).toHaveText('Hybrid or Plug-in Hybrid');

		await change(page, 1);
		await answer(page, 1, 'Family practicality');
		await expect(result(page)).toHaveCount(0);
		await expect(questions(page)).toHaveCount(3);
		await expect(questions(page).last()).toHaveText('Need 3 rows?');
	});

	test('answered questions show only the chosen answer until Change', async ({ page }) => {
		await expect(page.getByRole('heading', { level: 2 })).toHaveText(['Pick a guide']);
		await expect(answerRows(page).first().getByRole('button')).toHaveText([
			'Which car to buy',
			'Which religion fits you',
			'Which unit to measure in'
		]);

		await answer(page, 0, 'Which car to buy');
		await answer(page, 1, 'Adventure / utility');
		await answer(page, 2, 'Yes');
		await expect(result(page)).toHaveText('Body-on-frame Truck');
		// Each answered question keeps its heading, its chosen answer and a Change link
		for (const [depth, chosen] of ['Which car to buy', 'Adventure / utility', 'Yes'].entries()) {
			await expect(answerRows(page).nth(depth).getByRole('button')).toHaveText([chosen, 'Change']);
		}

		await change(page, 1);
		const reopened = answerRows(page).nth(1);
		await expect(reopened.getByRole('button')).toHaveCount(5);
		await expect(reopened.getByRole('button', { name: 'Change' })).toHaveCount(0);
		await expect(reopened.getByRole('button', { pressed: true })).toBeFocused();
		await expect(result(page)).toHaveText('Body-on-frame Truck');

		// Picking the same answer again folds the question and keeps the rest of the path
		await answer(page, 1, 'Adventure / utility');
		await expect(reopened.getByRole('button')).toHaveText(['Adventure / utility', 'Change']);
		await expect(result(page)).toHaveText('Body-on-frame Truck');
	});

	test('state persists after page refresh', async ({ page }) => {
		await answer(page, 0, 'Which car to buy');
		await answer(page, 1, 'Family practicality');
		await expect(questions(page).last()).toHaveText('Need 3 rows?');

		await page.reload();
		await expect(page.locator('.container[data-hydrated]')).toBeVisible();

		await expect(questions(page)).toHaveCount(3);
		await expect(questions(page).nth(1)).toHaveText('What matters most?');
		await expect(questions(page).last()).toHaveText('Need 3 rows?');
	});

	test('state restores from localStorage when visiting without ?p', async ({ page }) => {
		await answer(page, 0, 'Which car to buy');
		await answer(page, 1, 'Family practicality');
		await expect(page).toHaveURL(/\?p=/);

		await open(page);

		await expect(questions(page)).toHaveCount(3);
		await expect(questions(page).last()).toHaveText('Need 3 rows?');
		await expect(page).toHaveURL(/\?p=/);
	});

	test('shareable URL restores traversal state in a fresh context', async ({ page, browser }) => {
		await answer(page, 0, 'Which car to buy');
		await answer(page, 1, 'Low running cost or emissions');
		await answer(page, 2, 'Yes');
		await expect(result(page)).toHaveText('Battery EV');
		// Answer positions per step: readable, and immune to commas in labels
		await expect(page).toHaveURL(/\?p=\d+(\.\d+){2}$/);

		// A new context has empty localStorage, so only ?p can restore the path
		const context = await browser.newContext();
		const shared = await context.newPage();
		await open(shared, page.url());
		await expect(result(shared)).toHaveText('Battery EV');
		await context.close();
	});

	test('only one answer selected per question', async ({ page }) => {
		const selected = answerRows(page).first().getByRole('button', { pressed: true });
		await answer(page, 0, 'Which car to buy');
		await expect(selected).toHaveCount(1);
		await expect(selected).toHaveText('Which car to buy');

		await change(page, 0);
		await answer(page, 0, 'Which religion fits you');
		await expect(selected).toHaveCount(1);
		await expect(selected).toHaveText('Which religion fits you');
	});

	test('interface works on mobile viewport with answer wrapping', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await answer(page, 0, 'Which car to buy');

		const carAnswers = answerRows(page).nth(1).getByRole('button');
		await expect(carAnswers).toHaveCount(5);
		for (const button of await carAnswers.all()) {
			await expect(button).toBeInViewport();
		}
	});

	test('long trees preserve all rows without collapsing', async ({ page }) => {
		await answer(page, 0, 'Which religion fits you');
		await answer(page, 1, 'Bible');
		await answer(page, 2, 'Yes');
		await answer(page, 3, 'Pope of Rome');

		await expect(result(page)).toHaveText('Roman Catholic');
		await expect(questions(page)).toHaveText([
			'Pick a guide',
			'Which book contains the final word of God?',
			'Is Jesus God?',
			"Who leads Christ's church?"
		]);
	});

	test('switching trees at root replaces all downstream', async ({ page }) => {
		await answer(page, 0, 'Which car to buy');
		await answer(page, 1, 'Fun / Performance');
		await answer(page, 2, 'Yes');
		await expect(result(page)).toHaveText('Lightweight Sports Car');

		await change(page, 0);
		await answer(page, 0, 'Which religion fits you');
		await expect(questions(page)).toHaveText([
			'Pick a guide',
			'Which book contains the final word of God?'
		]);
		await expect(result(page)).toHaveCount(0);
	});

	test('Start over returns to the root question and clears ?p', async ({ page }) => {
		await answer(page, 0, 'Which car to buy');
		await answer(page, 1, 'Low running cost or emissions');
		await answer(page, 2, 'Yes');
		await expect(result(page)).toHaveText('Battery EV');
		await expect(page).toHaveURL(/\?p=/);

		await page.getByRole('button', { name: 'Start over' }).click();

		await expect(questions(page)).toHaveText(['Pick a guide']);
		await expect(result(page)).toHaveCount(0);
		await expect(answerRows(page).getByRole('button', { pressed: true })).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Which car to buy', exact: true })).toBeFocused();
		await expect(page).not.toHaveURL(/\?p=/);
		await expect(page.getByRole('button', { name: 'Start over' })).toHaveCount(0);

		// The cleared path is what persists
		await page.reload();
		await expect(page.locator('.container[data-hydrated]')).toBeVisible();
		await expect(questions(page)).toHaveCount(1);
	});
});

test.describe('Decision Tree units', () => {
	test.beforeEach(async ({ page }) => {
		await open(page);
		await answer(page, 0, 'Which unit to measure in');
		await expect(questions(page).nth(1)).toHaveText('What are you measuring?');
	});

	// One path per quantity: [answers after "Which unit to measure in", expected result]
	const paths: [string[], string][] = [
		[['Temperature', 'A physics formula, light colour or space'], 'Kelvin (K)'],
		[['Temperature', 'Everyday use in the US'], 'Degrees Fahrenheit (°F)'],
		[['Length or area', 'An everyday length', 'Roads in the US or UK'], 'Miles (mi)'],
		[['Length or area', 'Aircraft or ships', 'Altitude'], 'Feet (ft)'],
		[['Length or area', 'Area', 'Land elsewhere'], 'Hectares (ha)'],
		[['Mass or volume', "A person's weight", 'United Kingdom'], 'Stones and pounds (st, lb)'],
		[['Mass or volume', 'Fuel or drinks', 'Draught beer in the UK or Ireland'], 'Pints (pt)'],
		[
			['Speed, pressure, energy or power', 'Speed', 'Roads elsewhere'],
			'Kilometres per hour (km/h)'
		],
		[
			['Speed, pressure, energy or power', 'Energy', 'Electricity or gas bills'],
			'Kilowatt-hours (kWh)'
		],
		[['Time, current, substance or light', 'Light', 'How bright a lamp is'], 'Lumens (lm)'],
		[['Time, current, substance or light', 'Amount of substance'], 'Moles (mol)']
	];
	for (const [answers, expected] of paths) {
		test(`${answers.join(' → ')} gives ${expected}`, async ({ page }) => {
			for (const [i, label] of answers.entries()) await answer(page, i + 1, label);
			await expect(result(page)).toHaveText(expected);
		});
	}
});
