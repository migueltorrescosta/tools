<script lang="ts">
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

	let items = $state<Item[]>([]);
	let newItem = $state<Item>({ id: 0, description: '', price: 0 });
	let people = $state<Person[]>([]);
	let newPerson = $state<Person>({ id: 0, name: '' });
	let initialized = $state(false);
	let individualPrices = $state<number[][]>([]);
	let iterations = $state(0);
	let groups = $state<number[][]>([]);
	let personSelections = $state<(number | null)[]>([]);

	function addItem(e: Event) {
		e.preventDefault();
		if (newItem.price > 0 && newItem.description.trim()) {
			items = [...items, { ...newItem }];
			newItem = { id: newItem.id + 1, description: '', price: 0 };
		}
	}

	function deleteItem(id: number) {
		items = items.filter((i) => i.id !== id);
	}
	function deletePerson(id: number) {
		people = people.filter((p) => p.id !== id);
	}

	function addPerson(e: Event) {
		e.preventDefault();
		if (newPerson.name.trim()) {
			people = [...people, { ...newPerson }];
			newPerson = { id: newPerson.id + 1, name: '' };
		}
	}

	function startAlgorithm() {
		if (people.length < 2 || items.length === 0) return;
		initialized = true;
		const prices = items.map((x) => x.price);
		individualPrices = people
			.map(() => [...prices])
			.map((row) => row.map((v) => v + Math.random() - 0.5));
		personSelections = people.map(() => null);
		setupExperiment();
	}

	function setupExperiment() {
		const n = people.length;
		if (!n || !items.length) {
			groups = [];
			return;
		}
		const vals = Array(n).fill(0);
		groups = Array.from({ length: n }, () => [] as number[]);
		const sorted = [...items].sort((a, b) => b.price - a.price);
		for (const item of sorted) {
			let min = 0;
			for (let g = 1; g < n; g++) if (vals[g] < vals[min]) min = g;
			groups[min].push(item.id);
			vals[min] += item.price;
		}
	}

	function handleSelectionChange(idx: number, gIdx: number) {
		personSelections = personSelections.map((s, i) => (i === idx ? gIdx : s));
	}

	function completeRound() {
		const factor = 1 + 1 / (0.1 * iterations + 10);
		let indPrices = individualPrices.map((r) => [...r]);
		for (let p = 0; p < people.length; p++) {
			const sel = personSelections[p];
			if (sel === null) continue;
			for (let i = 0; i < items.length; i++) {
				indPrices[p][i] *= groups[sel].includes(items[i].id) ? factor : 1 / factor;
			}
		}
		for (let p = 0; p < indPrices.length; p++) {
			for (let i = 0; i < items.length; i++)
				indPrices[p][i] = (indPrices[p][i] + individualPrices[p][i]) / 2;
		}
		items = items.map((item, i) => ({
			...item,
			price: indPrices.reduce((s, r) => s + r[i], 0) / people.length
		}));
		iterations++;
		individualPrices = indPrices;
		personSelections = people.map(() => null);
		setupExperiment();
	}

	function getGroupValue(gIdx: number): number {
		return groups[gIdx].reduce((s, id) => s + (items.find((i) => i.id === id)?.price || 0), 0);
	}

	function getGroupDelta(gIdx: number): number {
		const totalValue = items.reduce((s, i) => s + i.price, 0);
		const avg = totalValue / people.length;
		return getGroupValue(gIdx) - avg;
	}

	function getGroupDesc(gIdx: number): string {
		if (!groups[gIdx]?.length) return '(empty)';
		return groups[gIdx]
			.map((id) => items.find((i) => i.id === id)?.description)
			.filter(Boolean)
			.join(', ');
	}

	// Derived values
	const itemFavs = $derived(
		initialized && items.length > 0
			? items.map((_, col) => {
					let maxIdx = 0,
						maxVal = -Infinity;
					for (let row = 0; row < individualPrices.length; row++) {
						if (individualPrices[row]?.[col] > maxVal) {
							maxVal = individualPrices[row][col];
							maxIdx = row;
						}
					}
					return maxIdx;
				})
			: []
	);

	const allSelected = $derived(
		initialized && personSelections.length > 0 && personSelections.every((s) => s !== null)
	);

	const allocationDeltas = $derived(
		initialized && items.length > 0 && people.length > 0
			? people.map((_, idx) => {
					const avg = items.reduce((a, b) => a + b.price, 0) / people.length;
					const my = itemFavs.map((f, i) => (f === idx ? i : -1)).filter((i) => i >= 0);
					let d = -avg + (my.length ? my.map((i) => items[i].price).reduce((a, b) => a + b, 0) : 0);
					return (d > 0 ? 'Pay ' : 'Get ') + formatter.format(Math.round(Math.abs(d)));
				})
			: []
	);

	const suggestedAlloc = $derived(
		initialized && items.length > 0 && people.length > 0
			? people.map((p, idx) => {
					const avg = items.reduce((a, b) => a + b.price, 0) / people.length;
					const my = itemFavs.map((f, i) => (f === idx ? i : -1)).filter((i) => i >= 0);
					let d = -avg + (my.length ? my.map((i) => items[i].price).reduce((a, b) => a + b, 0) : 0);
					let s = (d > 0 ? 'Pay ' : 'Get ') + formatter.format(Math.round(Math.abs(d)));
					if (my.length) s = my.map((i) => items[i].description).reduce((a, b) => a + ', ' + b, s);
					return { name: p.name, items: s };
				})
			: []
	);
</script>

<svelte:head><title>Asset Splitting</title></svelte:head>

<div class="container">
	<header>
		<h1>ASSET SPLITTING</h1>
		<p class="subtitle">Fair Division Tool</p>
	</header>

	{#if !initialized}
		<div class="section">
			<div class="section-header"><span class="label">People</span></div>
			<div class="split-flex">
				{#each people as p}<div class="split-person-item">
						<button class="split-delete-btn" onclick={() => deletePerson(p.id)}>Del</button>{p.name}
					</div>{/each}
				<form class="split-add-person-form" onsubmit={addPerson}>
					<input type="submit" value="Add" /><input
						type="text"
						bind:value={newPerson.name}
						placeholder="Name"
					/>
				</form>
			</div>
		</div>

		<div class="section">
			<div class="section-header"><span class="label">Items</span></div>
			<div class="result-panel">
				<table class="split-table">
					<thead><tr><th>Description</th><th>Estimated Price</th><th>Action</th></tr></thead>
					<tbody>
						{#each items as item}
							<tr
								><td>{item.description}</td><td>{formatter.format(Math.round(item.price))}</td><td
									><button class="split-delete-btn" onclick={() => deleteItem(item.id)}
										>Delete</button
									></td
								></tr
							>
						{/each}
						<tr class="add-item-row"
							><td
								><input
									type="text"
									class="split-input"
									bind:value={newItem.description}
									placeholder="Description"
								/></td
							><td
								><input
									type="number"
									class="split-input"
									bind:value={newItem.price}
									placeholder="Price"
								/></td
							><td><button class="split-add-btn" onclick={addItem}>Add Item</button></td></tr
						>
					</tbody>
				</table>
			</div>
		</div>

		<div class="process-btn-container">
			<button type="button" id="start-algorithm" class="process-btn" onclick={startAlgorithm}
				><span class="btn-text">START</span><span class="btn-glow"></span></button
			>
		</div>
	{/if}

	{#if initialized}
		<div class="split-row-sections">
			<div class="section">
				<div class="section-header"><span class="label">People</span></div>
				<div class="split-flex">
					{#each people as p}<div class="split-person-item">
							<button class="split-delete-btn" onclick={() => deletePerson(p.id)}>Del</button
							>{p.name}
						</div>{/each}
				</div>
			</div>

			<div class="section">
				<div class="section-header"><span class="label">Items</span></div>
				<div class="result-panel">
					<table class="split-table">
						<thead><tr><th>Description</th><th>Estimated Price</th><th>Action</th></tr></thead>
						<tbody>
							{#each items as item}
								<tr
									><td>{item.description}</td><td>{formatter.format(Math.round(item.price))}</td><td
										><button class="split-delete-btn" onclick={() => deleteItem(item.id)}
											>Delete</button
										></td
									></tr
								>
							{/each}
						</tbody>
					</table>
				</div>
			</div>

			<div class="section">
				<div class="section-header"><span class="label">Suggested Split</span></div>
				<div class="result-panel">
					<table class="split-table">
						<thead><tr><th class="w-30">Person</th><th>Items</th></tr></thead><tbody
							>{#each suggestedAlloc as a}<tr><td>{a.name}</td><td>{a.items}</td></tr>{/each}</tbody
						>
					</table>
				</div>
			</div>
		</div>

		<div class="result-panel">
			<div class="panel-header">
				<span class="dot red"></span><span class="dot yellow"></span><span class="dot green"
				></span><span class="panel-title">ROUND {iterations}</span>
			</div>
			<div class="panel-content split-experiment-content">
				<div class="groups-row">
					{#each groups as g, gi}
						<div class="group-col">
							<div class="group-title">Group {gi + 1}</div>
							<div class="group-items">
								{#each g as itemId}
									{@const item = items.find((i) => i.id === itemId)}
									{#if item}<div class="group-item">{item.description}</div>{/if}
								{/each}
								{#if g.length === 0}<div class="group-item empty">(empty)</div>{/if}
							</div>
							<div class="group-value">{formatter.format(-Math.round(getGroupDelta(gi)))}</div>
						</div>
					{/each}
				</div>
				<p class="hint" style="margin-bottom:1rem">
					Select your preferred group. Each person chooses independently.
				</p>
				<div class="selection-row-horizontal">
					{#each people as p, pi}<div class="selection-col">
							<span class="selection-name">{p.name}</span><select
								class="algorithm-select"
								value={personSelections[pi] ?? ''}
								onchange={(e) =>
									handleSelectionChange(pi, parseInt((e.target as HTMLSelectElement).value))}
								><option value="" disabled>Select group...</option>{#each groups as g, gi}<option
										value={gi}>Group {gi + 1}</option
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
			</div>
		</div>
	{/if}
</div>
