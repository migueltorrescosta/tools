<script lang="ts">
	import { onMount } from 'svelte';
	import { Alert, Button, DataTable, Field, PageHeader, Panel, type Column } from '$lib/ui';
	import {
		STABLE_ROUNDS,
		balances,
		completeRound as runRound,
		groupDelta,
		groupValue,
		initialValuations,
		itemError,
		itemFavourites,
		itemsOf,
		lptGroups,
		nextStableCount,
		paymentLabel,
		personError,
		roundedBalances,
		startError
	} from '$lib/split';

	interface Item {
		id: number;
		description: string;
		price: number;
	}
	interface Person {
		id: number;
		name: string;
	}

	const formatter = new Intl.NumberFormat('pt-PT', {
		style: 'currency',
		currency: 'EUR',
		maximumFractionDigits: 0
	});
	const fmt = (n: number) => formatter.format(n);

	let hydrated = $state(false);
	onMount(() => (hydrated = true));

	let items = $state<Item[]>([]);
	let newItem = $state<Item>({ id: 0, description: '', price: 0 });
	let people = $state<Person[]>([]);
	let newPerson = $state<Person>({ id: 0, name: '' });
	let itemMsg = $state<string | null>(null);
	let personMsg = $state<string | null>(null);
	let initialized = $state(false);
	let individualPrices = $state<number[][]>([]);
	let iterations = $state(0);
	let groups = $state<number[][]>([]);
	let personSelections = $state<(number | null)[]>([]);
	/** Prices as entered before START; their sum is the estate value every round conserves. */
	let enteredPrices = $state<number[]>([]);
	/** Allocation after the previous completed round (null before the first). */
	let lastFavs = $state<number[] | null>(null);
	/** Consecutive completed rounds with an unchanged allocation. */
	let stableFor = $state(0);

	function addItem(e: Event) {
		e.preventDefault();
		itemMsg = itemError(newItem.description, newItem.price);
		if (itemMsg) return;
		items = [...items, { ...newItem, description: newItem.description.trim() }];
		newItem = { id: newItem.id + 1, description: '', price: 0 };
	}

	function deleteItem(id: number) {
		items = items.filter((i) => i.id !== id);
	}
	function deletePerson(id: number) {
		people = people.filter((p) => p.id !== id);
	}

	function addPerson(e: Event) {
		e.preventDefault();
		personMsg = personError(newPerson.name);
		if (personMsg) return;
		people = [...people, { ...newPerson, name: newPerson.name.trim() }];
		newPerson = { id: newPerson.id + 1, name: '' };
	}

	const startMsg = $derived(startError(people.length, items.length));

	function startAlgorithm() {
		if (startMsg) return;
		initialized = true;
		enteredPrices = items.map((x) => x.price);
		individualPrices = initialValuations(enteredPrices, people.length, Math.random);
		personSelections = people.map(() => null);
		lastFavs = null;
		stableFor = 0;
		setupExperiment();
	}

	/** Leave the round view, discarding round history and restoring the entered prices. */
	function backToSetup() {
		items = items.map((item, i) => ({ ...item, price: enteredPrices[i] ?? item.price }));
		initialized = false;
		iterations = 0;
		individualPrices = [];
		groups = [];
		personSelections = [];
		lastFavs = null;
		stableFor = 0;
	}

	function setupExperiment() {
		groups = lptGroups(items, people.length);
	}

	function handleSelectionChange(idx: number, gIdx: number) {
		personSelections = personSelections.map((s, i) => (i === idx ? gIdx : s));
	}

	function completeRound() {
		const result = runRound(
			individualPrices,
			items.map((i) => i.id),
			groups,
			personSelections,
			iterations,
			enteredPrices.reduce((a, b) => a + b, 0)
		);
		items = items.map((item, i) => ({ ...item, price: result.prices[i] }));
		iterations++;
		individualPrices = result.valuations;
		const favs = itemFavourites(result.valuations, items.length);
		stableFor = nextStableCount(lastFavs, favs, stableFor);
		lastFavs = favs;
		personSelections = people.map(() => null);
		setupExperiment();
	}

	// Derived values
	const itemFavs = $derived(
		initialized && items.length > 0 ? itemFavourites(individualPrices, items.length) : []
	);

	const allSelected = $derived(
		initialized && personSelections.length > 0 && personSelections.every((s) => s !== null)
	);

	const settled = $derived(stableFor >= STABLE_ROUNDS);

	const suggestedAlloc = $derived.by(() => {
		if (!initialized || items.length === 0 || people.length === 0) return [];
		const owed = roundedBalances(
			balances(
				items.map((i) => i.price),
				itemFavs,
				people.length
			)
		);
		return people.map((p, idx) => ({
			idx,
			name: p.name,
			items:
				itemsOf(itemFavs, idx)
					.map((i) => items[i].description)
					.join(', ') || '(none)',
			payment: paymentLabel(owed[idx], fmt)
		}));
	});

	type Alloc = (typeof suggestedAlloc)[number];
	const allocColumns: Column<Alloc>[] = [
		{ key: 'name', label: 'Person' },
		{ key: 'items', label: 'Items' },
		{ key: 'payment', label: 'Settlement', align: 'right' }
	];

	const priceRows = $derived(
		items.map((item) => ({
			id: item.id,
			description: item.description,
			price: fmt(Math.round(item.price))
		}))
	);
	const priceColumns: Column<(typeof priceRows)[number]>[] = [
		{ key: 'description', label: 'Description' },
		{ key: 'price', label: 'Estimated price', align: 'right' }
	];
</script>

<div class="container" data-hydrated={hydrated || undefined}>
	<PageHeader path="/split">
		<a href="https://blog.mptc.uk/posts/Asset-Division" target="_blank" rel="noreferrer"
			>First written up on the blog</a
		>
	</PageHeader>

	{#if !initialized}
		<div class="split-view">
			<Panel title="People">
				<div class="stack">
					{#if people.length > 0}
						<ul class="chips" aria-label="People">
							{#each people as p (p.id)}
								<li class="chip">
									{p.name}
									<Button
										size="sm"
										variant="ghost"
										aria-label="Delete {p.name}"
										onclick={() => deletePerson(p.id)}>Delete</Button
									>
								</li>
							{/each}
						</ul>
					{:else}
						<p class="note">No people yet.</p>
					{/if}
					<form class="add-form" onsubmit={addPerson} novalidate>
						<Field label="Person name">
							{#snippet children(props)}
								<input
									class="control"
									type="text"
									{...props}
									bind:value={newPerson.name}
									placeholder="Name"
									aria-invalid={personMsg ? 'true' : undefined}
									aria-describedby={personMsg ? 'person-error' : undefined}
								/>
							{/snippet}
						</Field>
						<Button type="submit">Add person</Button>
					</form>
					{#if personMsg}
						<div id="person-error"><Alert tone="danger">{personMsg}</Alert></div>
					{/if}
				</div>
			</Panel>

			<Panel title="Items">
				<div class="stack">
					{#if items.length > 0}
						<div class="table-wrap">
							<table>
								<caption class="sr-only">Items</caption>
								<thead>
									<tr>
										<th scope="col">Description</th>
										<th scope="col" class="num">Estimated price</th>
										<th scope="col"><span class="sr-only">Actions</span></th>
									</tr>
								</thead>
								<tbody>
									{#each items as item (item.id)}
										<tr>
											<td>{item.description}</td>
											<td class="num">{fmt(Math.round(item.price))}</td>
											<td class="actions">
												<Button
													size="sm"
													variant="ghost"
													aria-label="Delete {item.description}"
													onclick={() => deleteItem(item.id)}>Delete</Button
												>
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{:else}
						<p class="note">No items yet.</p>
					{/if}
					<form class="add-form" onsubmit={addItem} novalidate>
						<Field label="Item description">
							{#snippet children(props)}
								<input
									class="control"
									type="text"
									{...props}
									bind:value={newItem.description}
									placeholder="Description"
									aria-invalid={itemMsg ? 'true' : undefined}
									aria-describedby={itemMsg ? 'item-error' : undefined}
								/>
							{/snippet}
						</Field>
						<div class="price">
							<Field label="Item price (€)">
								{#snippet children(props)}
									<input
										class="control"
										type="number"
										min="0"
										step="any"
										{...props}
										bind:value={newItem.price}
										placeholder="Price"
										aria-invalid={itemMsg ? 'true' : undefined}
										aria-describedby={itemMsg ? 'item-error' : undefined}
									/>
								{/snippet}
							</Field>
						</div>
						<Button type="submit">Add item</Button>
					</form>
					{#if itemMsg}
						<div id="item-error"><Alert tone="danger">{itemMsg}</Alert></div>
					{/if}
				</div>
			</Panel>
		</div>

		<div class="cluster start">
			<Button
				variant="primary"
				disabled={startMsg !== null}
				aria-describedby={startMsg ? 'start-error' : undefined}
				onclick={startAlgorithm}>Start</Button
			>
			{#if startMsg}<p id="start-error" class="note">{startMsg}</p>{/if}
		</div>
	{:else}
		<div class="split-view">
			<Panel title="Round {iterations}">
				<div class="stack">
					<div class="groups">
						{#each groups as g, gi (gi)}
							<section class="group" data-testid="split-group">
								<h3>Group {gi + 1}</h3>
								<ul>
									{#each g as itemId (itemId)}
										{@const item = items.find((i) => i.id === itemId)}
										{#if item}<li>{item.description}</li>{/if}
									{/each}
									{#if g.length === 0}<li class="note">(empty)</li>{/if}
								</ul>
								<p class="worth">Worth {fmt(Math.round(groupValue(g, items)))}</p>
								<p class="note">
									Taker: {paymentLabel(groupDelta(g, items, people.length), fmt)}
								</p>
							</section>
						{/each}
					</div>
					<p class="note">Select your preferred group. Each person chooses independently.</p>
					<div class="choices">
						{#each people as p, pi (p.id)}
							<Field label={p.name}>
								{#snippet children(props)}
									<select
										class="control"
										{...props}
										aria-label="{p.name}'s group choice"
										value={personSelections[pi] ?? ''}
										onchange={(e) =>
											handleSelectionChange(pi, parseInt((e.target as HTMLSelectElement).value))}
									>
										<option value="" disabled>Select group…</option>
										{#each groups as _g, gi (gi)}<option value={gi}>Group {gi + 1}</option>{/each}
									</select>
								{/snippet}
							</Field>
						{/each}
					</div>
					<div class="cluster">
						<Button variant="primary" disabled={!allSelected} onclick={completeRound}
							>Complete round</Button
						>
						<Button onclick={backToSetup}>Back to setup</Button>
					</div>
					<p class="note">Going back discards all rounds and restores the entered prices.</p>
				</div>
			</Panel>

			<div class="stack">
				<Panel title="Suggested split">
					{#if iterations === 0}
						<p class="note">Complete a round to see a suggested split.</p>
					{:else}
						<div class="stack">
							<div data-testid="split-stability">
								{#if settled}
									<Alert tone="success">Allocation stable for {stableFor} rounds.</Alert>
								{:else}
									<Alert tone="info"
										>Provisional: allocation stable for {stableFor} of {STABLE_ROUNDS} rounds.</Alert
									>
								{/if}
							</div>
							<DataTable
								caption="Suggested split"
								hideCaption
								columns={allocColumns}
								rows={suggestedAlloc}
								rowKey={(a) => a.idx}
							/>
						</div>
					{/if}
				</Panel>

				<Panel title="Items">
					<DataTable
						caption="Items"
						hideCaption
						columns={priceColumns}
						rows={priceRows}
						rowKey={(r) => r.id}
					/>
				</Panel>
			</div>
		</div>
	{/if}
</div>

<style>
	.note {
		margin: 0;
		font-size: var(--text-sm);
		color: var(--text-muted);
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-1);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.chip {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-1);
		padding-left: var(--sp-2);
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: var(--radius);
	}

	.add-form {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: var(--sp-2);
	}

	.add-form > :global(.ui-field) {
		flex: 1 1 10rem;
	}

	.price {
		flex: 0 1 8rem;
	}

	.table-wrap {
		overflow-x: auto;
		border: 1px solid var(--border);
		border-radius: var(--radius);
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--text-sm);
	}

	th,
	td {
		height: 32px;
		padding: var(--sp-1) var(--sp-3);
		text-align: left;
		border-bottom: 1px solid var(--border);
	}

	th {
		background: var(--surface-2);
		font-weight: 600;
		color: var(--text-muted);
	}

	tbody tr:last-child td {
		border-bottom: 0;
	}

	.num {
		text-align: right;
	}

	td.actions {
		width: 1%;
		padding: 0 var(--sp-1);
	}

	.start {
		margin-top: var(--sp-3);
	}

	.groups {
		display: grid;
		gap: var(--sp-2);
		grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr));
	}

	.group {
		padding: var(--sp-2) var(--sp-3);
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: var(--radius);
	}

	.group ul {
		margin: var(--sp-1) 0;
		padding-left: var(--sp-4);
	}

	.worth {
		margin: 0;
		font-weight: 600;
	}

	.choices {
		display: grid;
		gap: var(--sp-2);
		grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr));
	}
</style>
