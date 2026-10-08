<script lang="ts">
	import { onMount } from 'svelte';
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
			name: p.name,
			items: itemsOf(itemFavs, idx)
				.map((i) => items[i].description)
				.join(', '),
			payment: paymentLabel(owed[idx], fmt)
		}));
	});
</script>

<svelte:head><title>Asset Splitting</title></svelte:head>

<div class="container" data-hydrated={hydrated || undefined}>
	<header>
		<h1>ASSET SPLITTING</h1>
		<p class="subtitle">Fair Division Tool</p>
	</header>

	{#if !initialized}
		<div class="section">
			<div class="section-header"><span class="label" id="people-label">People</span></div>
			<ul class="split-flex split-list" aria-labelledby="people-label">
				{#each people as p (p.id)}<li class="split-person-item">
						<button
							class="split-delete-btn"
							aria-label="Delete {p.name}"
							onclick={() => deletePerson(p.id)}>Del</button
						>{p.name}
					</li>{/each}
			</ul>
			<form class="split-add-person-form" onsubmit={addPerson} novalidate>
				<input type="submit" value="Add" aria-label="Add person" /><input
					type="text"
					bind:value={newPerson.name}
					placeholder="Name"
					aria-label="Person name"
					aria-invalid={personMsg ? 'true' : undefined}
					aria-describedby={personMsg ? 'person-error' : undefined}
				/>
			</form>
			{#if personMsg}<p id="person-error" class="split-error" role="alert">{personMsg}</p>{/if}
		</div>

		<div class="section">
			<div class="section-header"><span class="label">Items</span></div>
			<div class="result-panel">
				<form id="add-item-form" onsubmit={addItem} novalidate></form>
				<table class="split-table">
					<thead
						><tr
							><th>Description</th><th>Estimated Price</th><th
								><span class="split-sr-only">Actions</span></th
							></tr
						></thead
					>
					<tbody>
						{#each items as item (item.id)}
							<tr
								><td>{item.description}</td><td>{fmt(Math.round(item.price))}</td><td
									><button
										class="split-delete-btn"
										aria-label="Delete {item.description}"
										onclick={() => deleteItem(item.id)}>Del</button
									></td
								></tr
							>
						{/each}
						<tr class="add-item-row"
							><td
								><input
									type="text"
									form="add-item-form"
									class="split-input"
									bind:value={newItem.description}
									placeholder="Description"
									aria-label="Item description"
									aria-invalid={itemMsg ? 'true' : undefined}
									aria-describedby={itemMsg ? 'item-error' : undefined}
								/></td
							><td
								><input
									type="number"
									form="add-item-form"
									class="split-input"
									min="0"
									step="any"
									bind:value={newItem.price}
									placeholder="Price"
									aria-label="Item price in euros"
									aria-invalid={itemMsg ? 'true' : undefined}
									aria-describedby={itemMsg ? 'item-error' : undefined}
								/></td
							><td
								><button type="submit" form="add-item-form" class="split-add-btn">Add Item</button
								></td
							></tr
						>
					</tbody>
				</table>
				{#if itemMsg}<p id="item-error" class="split-error" role="alert">{itemMsg}</p>{/if}
			</div>
		</div>

		<div class="process-btn-container">
			<button
				type="button"
				id="start-algorithm"
				class="process-btn"
				disabled={startMsg !== null}
				aria-describedby={startMsg ? 'start-error' : undefined}
				onclick={startAlgorithm}
				><span class="btn-text">START</span><span class="btn-glow"></span></button
			>
			{#if startMsg}<p id="start-error" class="hint">{startMsg}</p>{/if}
		</div>
	{/if}

	{#if initialized}
		<div class="split-row-sections">
			<div class="section">
				<div class="section-header"><span class="label">People</span></div>
				<div class="split-flex">
					{#each people as p (p.id)}<div class="split-person-item">{p.name}</div>{/each}
				</div>
			</div>

			<div class="section">
				<div class="section-header"><span class="label">Items</span></div>
				<div class="result-panel">
					<table class="split-table">
						<thead><tr><th>Description</th><th>Estimated Price</th></tr></thead>
						<tbody>
							{#each items as item (item.id)}
								<tr><td>{item.description}</td><td>{fmt(Math.round(item.price))}</td></tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>

			<div class="section">
				<div class="section-header">
					<span class="label" id="suggested-label">Suggested Split</span>
				</div>
				{#if iterations === 0}
					<p class="hint">Complete a round to see a suggested split.</p>
				{:else}
					<p class="hint" data-testid="split-stability">
						{#if settled}
							Allocation stable for {stableFor} rounds.
						{:else}
							Provisional: allocation stable for {stableFor} of {STABLE_ROUNDS} rounds.
						{/if}
					</p>
					<div class="result-panel" class:split-provisional={!settled}>
						<table class="split-table" aria-labelledby="suggested-label">
							<thead><tr><th class="w-30">Person</th><th>Items</th><th>Settlement</th></tr></thead
							><tbody
								>{#each suggestedAlloc as a, i (i)}<tr
										><td>{a.name}</td><td>{a.items || '(none)'}</td><td>{a.payment}</td></tr
									>{/each}</tbody
							>
						</table>
					</div>
				{/if}
			</div>
		</div>

		<div class="result-panel">
			<div class="panel-header">
				<span class="dot red"></span><span class="dot yellow"></span><span class="dot green"
				></span><span class="panel-title">ROUND {iterations}</span>
			</div>
			<div class="panel-content split-experiment-content">
				<div class="groups-row">
					{#each groups as g, gi (gi)}
						<div class="group-col" data-testid="split-group">
							<div class="group-title">Group {gi + 1}</div>
							<div class="group-items">
								{#each g as itemId (itemId)}
									{@const item = items.find((i) => i.id === itemId)}
									{#if item}<div class="group-item">{item.description}</div>{/if}
								{/each}
								{#if g.length === 0}<div class="group-item empty">(empty)</div>{/if}
							</div>
							<div class="group-value">Worth {fmt(Math.round(groupValue(g, items)))}</div>
							<div class="hint">
								Taker: {paymentLabel(groupDelta(g, items, people.length), fmt)}
							</div>
						</div>
					{/each}
				</div>
				<p class="hint" style="margin-bottom:1rem">
					Select your preferred group. Each person chooses independently.
				</p>
				<div class="selection-row-horizontal">
					{#each people as p, pi (p.id)}<div class="selection-col">
							<label class="selection-name" for="split-choice-{p.id}">{p.name}</label><select
								id="split-choice-{p.id}"
								class="algorithm-select"
								aria-label="{p.name}'s group choice"
								value={personSelections[pi] ?? ''}
								onchange={(e) =>
									handleSelectionChange(pi, parseInt((e.target as HTMLSelectElement).value))}
								><option value="" disabled>Select group...</option
								>{#each groups as _g, gi (gi)}<option value={gi}>Group {gi + 1}</option
									>{/each}</select
							>
						</div>{/each}
				</div>
				<button
					class="process-btn"
					disabled={!allSelected}
					onclick={completeRound}
					style="opacity:{allSelected ? 1 : 0.5};cursor:{allSelected ? 'pointer' : 'not-allowed'}"
					><span class="btn-text">COMPLETE ROUND</span><span class="btn-glow"></span></button
				>
				<button type="button" class="split-add-btn split-back-btn" onclick={backToSetup}
					>Back to setup</button
				>
				<p class="hint">Going back discards all rounds and restores the entered prices.</p>
			</div>
		</div>
	{/if}
</div>

<style>
	.split-list {
		list-style: none;
		margin: 0 0 0.5rem;
		padding: 0;
	}
	.split-error {
		color: #ff6b6b;
		font-size: 0.85rem;
		margin: 0.5rem 0 0;
	}
	.split-provisional {
		opacity: 0.6;
	}
	.split-back-btn {
		margin-top: 1rem;
	}
	.split-sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}
	#start-algorithm:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
