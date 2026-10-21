<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { browser } from '$app/environment';
	import { createPersistGate, readJson } from '$lib/persist-gate';
	import { Alert, Button, Field, InfoTip, PageHeader, Panel } from '$lib/ui';
	import {
		bestFallback,
		initState,
		isCertified,
		itemError,
		paymentLabel,
		propose,
		recordRound,
		roundCap,
		roundedBalances,
		startError,
		transfersFor,
		type Proposal,
		type SplitState
	} from '$lib/split';
	import {
		allocation,
		amountColour,
		bundlesFromOwners,
		chipsOn,
		demand,
		fallbackText,
		hitTest,
		holdersFromPicks,
		maxAbsRounded,
		itemOwners,
		moveAnnouncement,
		personColour,
		place,
		stepLabels,
		stepOf,
		type Phase,
		toPicks,
		whoPaysWhom
	} from './lib/board';
	import { SETUP_KEY, byPriceDesc, parseSetup, personNameError, priceTint } from './lib/setup';
	import { REFERENCES } from './lib/references';

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
	function getStorage(): Storage | null {
		if (!browser) return null;
		try {
			return localStorage;
		} catch {
			return null;
		}
	}
	const storage = getStorage();
	const persist = createPersistGate(storage);
	onMount(() => {
		const saved = parseSetup(readJson(storage, SETUP_KEY));
		if (saved) {
			people = saved.people;
			items = saved.items;
			newPerson = { id: saved.nextPersonId, name: '' };
			newItem = { id: saved.nextItemId, description: '', price: 0 };
		}
		persist.open();
		hydrated = true;
	});

	let items = $state<Item[]>([]);
	let newItem = $state<Item>({ id: 0, description: '', price: 0 });
	let people = $state<Person[]>([]);
	let newPerson = $state<Person>({ id: 0, name: '' });
	let itemMsg = $state<string | null>(null);
	let personMsg = $state<string | null>(null);
	let nameInput = $state<HTMLInputElement>();
	let descInput = $state<HTMLInputElement>();

	// Keep the setup across reloads (rounds are not saved).
	$effect(() => {
		persist.write(SETUP_KEY, JSON.stringify({ people, items }));
	});

	const itemPills = $derived.by(() => {
		const all = items.map((i) => i.price);
		return byPriceDesc(items).map((i) => ({ ...i, tint: priceTint(i.price, all) }));
	});

	function addItem(e: Event) {
		e.preventDefault();
		itemMsg = itemError(newItem.description, newItem.price);
		if (itemMsg) return;
		items = [...items, { ...newItem, description: newItem.description.trim() }];
		newItem = { id: newItem.id + 1, description: '', price: 0 };
		descInput?.focus();
	}

	function deleteItem(id: number) {
		items = items.filter((i) => i.id !== id);
	}
	function deletePerson(id: number) {
		people = people.filter((p) => p.id !== id);
	}

	function addPerson(e: Event) {
		e.preventDefault();
		personMsg = personNameError(
			newPerson.name,
			people.map((p) => p.name)
		);
		if (personMsg) return;
		people = [...people, { ...newPerson, name: newPerson.name.trim() }];
		newPerson = { id: newPerson.id + 1, name: '' };
		nameInput?.focus();
	}

	const startMsg = $derived(startError(people.length, items.length));

	// ---- Rounds -------------------------------------------------------------

	let phase = $state<Phase>('setup');
	/** Engine state and the proposal on the board; raw, since the engine owns their shape. */
	let engine = $state.raw<SplitState | null>(null);
	let proposal = $state.raw<Proposal | null>(null);
	let placements = $state<(number | null)[]>([]);
	/** Chip picked up by tap/click, waiting for a target. */
	let selected = $state<number | null>(null);
	/** Final screen: item pill picked up by tap/click, waiting for a person. */
	let selectedItem = $state<number | null>(null);
	let announcement = $state('');
	let busy = $state(false);
	/** Start screen: per item, the person everyone agrees wants it most, or −1 (Contested). */
	let startOwner = $state<number[]>([]);
	let contestedEl = $state<HTMLElement | null>(null);
	/** Round count at which the fallback offer was dismissed. */
	let dismissedAt = $state(-1);
	/** The agreed split: holder[g] = person taking group g. */
	let final = $state.raw<{ proposal: Proposal; holder: number[]; fallback: boolean } | null>(null);
	/** Final screen: owner per item, as edited by dragging pills between people. */
	let editOwner = $state<number[]>([]);

	const n = $derived(people.length);
	const prices = $derived(items.map((i) => i.price));
	const rounds = $derived(engine?.rounds ?? []);
	/** Fair share of the total, the reference for the settlement colour scale. */
	const fairShare = $derived(n > 0 ? prices.reduce((a, b) => a + b, 0) / n : 0);
	/** Item indices, highest entered price first: the one item order on every screen. */
	const itemOrder = $derived(
		byPriceDesc(items.map((item, k) => ({ k, price: item.price }))).map((x) => x.k)
	);
	const rank = $derived(
		Object.fromEntries(itemOrder.map((k, r) => [k, r])) as Record<number, number>
	);
	const byPrice = (list: readonly number[]) => [...list].sort((a, b) => rank[a] - rank[b]);
	const boardMax = $derived(proposal ? maxAbsRounded(proposal.transfers) : 0);
	const onGroup = $derived(chipsOn(placements, n));
	const unplaced = $derived(placements.flatMap((g, i) => (g === null ? [i] : [])));
	const groupDemand = $derived(demand(placements, n));
	const step = $derived(stepOf(phase));
	const stepNames = $derived(stepLabels(step, rounds.length + 1));
	const ready = $derived(toPicks(placements) !== null);
	const fallback = $derived(
		engine &&
			phase === 'round' &&
			rounds.length >= roundCap(items.length, n) &&
			dismissedAt !== rounds.length
			? bestFallback(engine)
			: null
	);

	/** Let the busy state paint before a heavy synchronous compute. */
	async function yieldToPaint() {
		await tick();
		await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
	}

	function showProposal(next: Proposal) {
		proposal = next;
		placements = Array(n).fill(null);
		selected = null;
		announcement = '';
		phase = 'round';
	}

	/** Setup → Start: every item begins in Contested. */
	function toStart() {
		if (startMsg) return;
		startOwner = items.map(() => -1);
		selectedItem = null;
		announcement = '';
		phase = 'start';
	}

	async function startAlgorithm() {
		if (busy) return;
		busy = true;
		await yieldToPaint();
		engine = initState(prices, n, undefined, [...startOwner]);
		dismissedAt = -1;
		final = null;
		showProposal(propose(engine));
		busy = false;
	}

	/** Back to setup, keeping people, items and prices; discards rounds. */
	function backToSetup() {
		phase = 'setup';
		engine = null;
		proposal = null;
		final = null;
		placements = [];
		selected = null;
	}

	async function completeRound() {
		const picks = toPicks(placements);
		if (!picks || !engine || !proposal || busy) return;
		if (isCertified(picks, n)) {
			finish(proposal, holdersFromPicks(picks), false);
			return;
		}
		busy = true;
		await yieldToPaint();
		engine = recordRound(engine, proposal, picks);
		showProposal(propose(engine));
		busy = false;
	}

	function finish(p: Proposal, holder: number[], isFallback: boolean) {
		final = { proposal: p, holder, fallback: isFallback };
		editOwner = itemOwners(allocation(p, holder).items, items.length);
		selected = null;
		selectedItem = null;
		phase = 'final';
	}

	function acceptFallback() {
		if (fallback) finish(fallback.proposal, [...fallback.proposal.owners], true);
	}

	async function recheck() {
		if (!engine || busy) return;
		busy = true;
		await yieldToPaint();
		const groups = bundlesFromOwners(editOwner, n);
		showProposal(
			transfersFor(
				engine,
				groups,
				groups.map((_, i) => i)
			)
		);
		busy = false;
	}

	// ---- Chip placement: drag, or the hidden tap/keyboard fallback ---------------

	function move(person: number, group: number | null) {
		placements = place(placements, person, group);
		announcement = moveAnnouncement(people[person].name, group);
		selected = null;
	}

	/** Tap/click/Enter on a chip or an item pill: select it, or unselect it. */
	function onPick(kind: Kind, idx: number) {
		if (suppressClick) {
			suppressClick = false;
			return;
		}
		if (kind === 'chip') selected = selected === idx ? null : idx;
		else selectedItem = selectedItem === idx ? null : idx;
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key !== 'Escape') return;
		if (drag) cancelDrag();
		else {
			selected = null;
			selectedItem = null;
		}
	}

	/** Final screen: give item k to person i. */
	function give(k: number, i: number) {
		editOwner[k] = i;
		announcement = `${items[k].description} goes to ${people[i].name}`;
		selectedItem = null;
	}

	/** Start screen: put item k on person i, or back in Contested (−1). */
	function seed(k: number, i: number) {
		startOwner[k] = i;
		announcement =
			i < 0
				? `${items[k].description} is back in contested`
				: `${items[k].description} goes to ${people[i].name}`;
		selectedItem = null;
	}

	function undoChanges() {
		if (final) editOwner = [...agreedOwner];
		selectedItem = null;
		announcement = 'Changes undone';
	}

	// Hand-rolled pointer drag: starts after the pointer moves a few px, for
	// mouse, pen and touch alike (chips have touch-action: none).
	const DRAG_THRESHOLD = 5;
	/**
	 * What is dragged: a person's chip onto a group (rounds), an item pill onto a
	 * person (final screen), or an item pill onto a person or Contested (start).
	 */
	type Kind = 'chip' | 'item' | 'seed';
	type Pending = { kind: Kind; idx: number; id: number; x0: number; y0: number; active: boolean };
	let pending: Pending | null = null;
	let suppressClick = false;
	let colEls = $state<HTMLElement[]>([]);
	let personEls = $state<HTMLElement[]>([]);
	/** The lifted chip or pill, its offset and the card under the pointer (null: none). */
	let drag = $state<{
		kind: Kind;
		idx: number;
		dx: number;
		dy: number;
		target: number | null;
	} | null>(null);
	const isLifted = (kind: Kind, idx: number) => drag?.kind === kind && drag.idx === idx;

	/** Index of the card under the point; on Start, index n is the Contested area. */
	function targetAt(kind: Kind, x: number, y: number): number | null {
		const els = (kind === 'chip' ? colEls : personEls).slice(0, n);
		if (kind === 'seed' && contestedEl) els.push(contestedEl);
		const hit = hitTest(
			x,
			y,
			els.map((el) => el.getBoundingClientRect())
		);
		return hit < 0 ? null : hit;
	}

	function onPointerDown(e: PointerEvent, kind: Kind, idx: number) {
		if (busy || pending || (e.pointerType === 'mouse' && e.button !== 0)) return;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		suppressClick = false;
		pending = { kind, idx, id: e.pointerId, x0: e.clientX, y0: e.clientY, active: false };
	}

	function onPointerMove(e: PointerEvent) {
		const p = pending;
		if (!p || e.pointerId !== p.id) return;
		if (!p.active) {
			if (Math.hypot(e.clientX - p.x0, e.clientY - p.y0) < DRAG_THRESHOLD) return;
			p.active = true;
			selected = null;
			selectedItem = null;
		}
		drag = {
			kind: p.kind,
			idx: p.idx,
			dx: e.clientX - p.x0,
			dy: e.clientY - p.y0,
			target: targetAt(p.kind, e.clientX, e.clientY)
		};
	}

	function onPointerUp(e: PointerEvent) {
		const p = pending;
		if (!p || e.pointerId !== p.id) return;
		if (p.active && drag) {
			// Swallow the click that may follow this pointerup, but no later one.
			suppressClick = true;
			setTimeout(() => (suppressClick = false));
			// A chip dropped outside every group card goes back to Unplaced; an
			// item dropped outside every person stays where it was.
			// On Start, an item dropped outside every person goes back to Contested.
			if (p.kind === 'chip') move(p.idx, drag.target);
			else if (p.kind === 'seed')
				seed(p.idx, drag.target === null || drag.target >= n ? -1 : drag.target);
			else if (drag.target !== null) give(p.idx, drag.target);
		}
		cancelDrag();
	}

	function cancelDrag() {
		pending = null;
		drag = null;
	}

	// ---- Final screen ---------------------------------------------------------

	/** The agreed split, computed once: items per person and rounded settlements (+ pays). */
	const agreed = $derived.by(() => {
		if (!final) return null;
		const { items: mine, owed } = allocation(final.proposal, final.holder);
		return { mine, balances: roundedBalances(owed) };
	});
	const agreedOwner = $derived(agreed ? itemOwners(agreed.mine, items.length) : []);
	/** Per person: whether their items differ from the agreed split. */
	const cardChanged = $derived(
		people.map((_, i) => editOwner.some((o, k) => (o === i) !== (agreedOwner[k] === i)))
	);
	const edited = $derived(cardChanged.some(Boolean));
	const payments = $derived(agreed ? whoPaysWhom(agreed.balances) : []);
	const finalMax = $derived(agreed ? maxAbsRounded(agreed.balances) : 0);
</script>

<svelte:window onkeydown={onKeydown} />

<div class="container" data-hydrated={hydrated || undefined}>
	<PageHeader path="/split">
		<a href="https://blog.mptc.uk/posts/Asset-Division" target="_blank" rel="noreferrer"
			>First written up on the blog</a
		>
	</PageHeader>

	<ol class="stepper" aria-label="Progress">
		{#each stepNames as label, i (i)}
			<li
				class="step"
				class:done={i < step}
				class:now={i === step}
				aria-current={i === step ? 'step' : undefined}
			>
				<span class="step-dot" aria-hidden="true">{i < step ? '✓' : i + 1}</span>
				<span
					>{label}{#if i < step}<span class="sr-only">&nbsp;(done)</span>{/if}</span
				>
			</li>
		{/each}
	</ol>

	{#if phase === 'setup'}
		<div class="split-view">
			<div class="tip-panel">
				<Panel title="People">
					{#snippet actions()}<InfoTip label="people">Everyone who shares the assets.</InfoTip
						>{/snippet}
					<div class="stack">
						{#if people.length > 0}
							<ul class="pills" aria-label="People">
								{#each people as p, i (p.id)}
									<li class="pill person-pill" style:--person={personColour(i)}>
										<span class="dot" aria-hidden="true"></span>
										<span class="pill-name">{p.name}</span>
										<button
											type="button"
											class="remove"
											aria-label="Remove {p.name}"
											title="Remove {p.name}"
											onclick={() => deletePerson(p.id)}>×</button
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
										bind:this={nameInput}
										bind:value={newPerson.name}
										placeholder="Name"
										aria-invalid={personMsg ? 'true' : undefined}
										aria-describedby={personMsg ? 'person-error' : undefined}
									/>
								{/snippet}
							</Field>
							<Button type="submit" class="add" aria-label="Add person" title="Add person">+</Button
							>
						</form>
						{#if personMsg}
							<div id="person-error"><Alert tone="danger">{personMsg}</Alert></div>
						{/if}
					</div>
				</Panel>
			</div>

			<div class="tip-panel">
				<Panel title="Items">
					{#snippet actions()}<InfoTip label="items"
							>Your best guess of each item's price. It only sets the starting split; people's picks
							decide the rest.</InfoTip
						>{/snippet}
					<div class="stack">
						{#if items.length > 0}
							<ul class="pills" aria-label="Items">
								{#each itemPills as item (item.id)}
									<li class="pill" style:border-color={item.tint}>
										<span class="pill-name">{item.description}</span>
										<span class="pill-value">{fmt(Math.round(item.price))}</span>
										<button
											type="button"
											class="remove"
											aria-label="Remove {item.description}"
											title="Remove {item.description}"
											onclick={() => deleteItem(item.id)}>×</button
										>
									</li>
								{/each}
							</ul>
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
										bind:this={descInput}
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
							<Button type="submit" class="add" aria-label="Add item" title="Add item">+</Button>
						</form>
						{#if itemMsg}
							<div id="item-error"><Alert tone="danger">{itemMsg}</Alert></div>
						{/if}
					</div>
				</Panel>
			</div>
		</div>

		<div class="cluster start">
			<Button
				variant="primary"
				disabled={startMsg !== null || busy}
				aria-describedby={startMsg ? 'start-error' : undefined}
				onclick={toStart}>Start</Button
			>
			{#if startMsg}<p id="start-error" class="note">{startMsg}</p>{/if}
		</div>
	{:else if phase === 'start'}
		<div class="tip-panel">
			<Panel title="Start">
				{#snippet actions()}<InfoTip label="the start"
						>Drag each item to whoever wants it most. Leave it in Contested if you disagree or
						aren't sure. This is a starting guess: the rounds can still move items.</InfoTip
					>{/snippet}
				<div class="stack" aria-busy={busy}>
					<div class="groups">
						{#each people as p, i (p.id)}
							<section
								class="group"
								class:targetable={selectedItem !== null || drag?.kind === 'seed'}
								class:drop-over={drag?.kind === 'seed' && drag.target === i}
								style:--person={personColour(i)}
								data-testid="start-person"
								aria-labelledby="start-{i}-heading"
								bind:this={personEls[i]}
							>
								{#if selectedItem !== null && startOwner[selectedItem] !== i}
									<!-- Tap/keyboard fallback for dragging (WCAG 2.5.7). -->
									<button
										type="button"
										class="card-target"
										aria-label="Give {items[selectedItem].description} to {p.name}"
										onclick={() => selectedItem !== null && seed(selectedItem, i)}
									></button>
								{/if}
								<h3 id="start-{i}-heading">
									<span class="dot" aria-hidden="true"></span>{p.name}
								</h3>
								<ul class="items">
									{#each itemOrder as k (items[k].id)}
										{#if startOwner[k] === i}<li>{@render seedPill(k)}</li>{/if}
									{/each}
									{#if !startOwner.includes(i)}<li class="note">Drop items here</li>{/if}
								</ul>
							</section>
						{/each}
					</div>

					<section
						class="contested"
						class:targetable={selectedItem !== null || drag?.kind === 'seed'}
						class:drop-over={drag?.kind === 'seed' && drag.target === n}
						data-testid="start-contested"
						aria-labelledby="contested-heading"
						bind:this={contestedEl}
					>
						{#if selectedItem !== null && startOwner[selectedItem] !== -1}
							<button
								type="button"
								class="card-target"
								aria-label="Move {items[selectedItem].description} back to contested"
								onclick={() => selectedItem !== null && seed(selectedItem, -1)}
							></button>
						{/if}
						<h3 id="contested-heading" class="unplaced-label">Contested</h3>
						<ul class="items centred">
							{#each itemOrder as k (items[k].id)}
								{#if startOwner[k] === -1}<li>{@render seedPill(k)}</li>{/if}
							{/each}
							{#if !startOwner.includes(-1)}<li class="note">Nothing contested.</li>{/if}
						</ul>
					</section>
					<p class="sr-only" aria-live="polite" data-testid="start-announce">{announcement}</p>

					<div class="cluster">
						<Button variant="primary" disabled={busy} onclick={startAlgorithm}
							>{busy ? 'Updating…' : 'Continue'}</Button
						>
						<Button onclick={backToSetup} disabled={busy}>Back to setup</Button>
					</div>
				</div>
			</Panel>
		</div>
	{:else if phase === 'round' && proposal}
		<div class="tip-panel">
			<Panel title="Round {rounds.length + 1}">
				{#snippet actions()}<InfoTip label="rounds"
						>Drag your chip to the group you'd take at these amounts. When everyone picks a
						different group, you're done. Back to setup discards all rounds.</InfoTip
					>{/snippet}
				<div class="stack" aria-busy={busy}>
					{#if fallback}
						<Alert tone="warning">
							<div class="stack">
								<div>{fallbackText(fallback)}</div>
								<div class="cluster">
									<Button size="sm" variant="primary" onclick={acceptFallback}
										>Accept this split</Button
									>
									<Button size="sm" onclick={() => (dismissedAt = rounds.length)}>Keep going</Button
									>
								</div>
							</div>
						</Alert>
					{/if}

					<div class="groups">
						{#each proposal.groups as g, gi (gi)}
							{@const tag = groupDemand[gi]}
							<section
								class="group"
								class:over={tag === 'over'}
								class:unclaimed={tag === 'unclaimed'}
								class:targetable={selected !== null || drag?.kind === 'chip'}
								class:drop-over={drag?.kind === 'chip' && drag.target === gi}
								data-testid="split-group"
								aria-labelledby="group-{gi}-heading"
								bind:this={colEls[gi]}
							>
								{#if selected !== null}
									<!-- Tap/keyboard fallback for dragging (WCAG 2.5.7): an invisible button over the card. -->
									<button
										type="button"
										class="card-target"
										aria-label="Place {people[selected].name} in group {gi + 1}"
										onclick={() => selected !== null && move(selected, gi)}
									></button>
								{/if}
								<div class="group-head">
									<h3 id="group-{gi}-heading">Group {gi + 1}</h3>
									{#if tag}<span class="tag {tag}"
											>{tag === 'over' ? 'Over-demanded' : 'Unclaimed'}</span
										>{/if}
								</div>
								<p
									class="settlement"
									style:color={amountColour(proposal.transfers[gi], fairShare, boardMax)}
								>
									{paymentLabel(proposal.transfers[gi], fmt)}
								</p>
								<ul class="items">
									{#each byPrice(g) as k (k)}<li class="pill">{items[k].description}</li>{/each}
									{#if g.length === 0}<li class="note">(empty)</li>{/if}
								</ul>
								<div class="drop">
									{#each onGroup[gi] ?? [] as i (people[i].id)}{@render personCard(i)}{/each}
								</div>
							</section>
						{/each}
					</div>

					<div class="unplaced" data-testid="split-unplaced">
						<p class="unplaced-label">Unplaced</p>
						<div class="drop centred">
							{#each unplaced as i (people[i].id)}{@render personCard(i)}{/each}
							{#if unplaced.length === 0}<p class="note">Everyone has picked.</p>{/if}
						</div>
					</div>

					<p class="sr-only" aria-live="polite" data-testid="split-announce">{announcement}</p>

					<div class="cluster">
						<Button variant="primary" disabled={!ready || busy} onclick={completeRound}
							>{busy ? 'Updating…' : 'Complete round'}</Button
						>
						<Button onclick={backToSetup} disabled={busy}>Back to setup</Button>
					</div>
				</div>
			</Panel>
		</div>
	{:else if phase === 'final' && final && agreed}
		<div class="tip-panel">
			<Panel title="Everyone keeps their own group">
				{#snippet actions()}<InfoTip label="the final split"
						>{final?.fallback
							? 'The best split found so far, so someone may still prefer another group.'
							: 'At these amounts, nobody would rather swap.'} Drag items between people to try a change,
						then check it with everyone again.</InfoTip
					>{/snippet}
				<div class="stack" aria-busy={busy}>
					{#if final.fallback}
						<p class="note">The best split found so far. It may not suit everyone.</p>
					{/if}
					<div class="groups">
						{#each people as p, i (p.id)}
							<section
								class="group"
								class:targetable={selectedItem !== null || drag?.kind === 'item'}
								class:drop-over={drag?.kind === 'item' && drag.target === i}
								style:--person={personColour(i)}
								data-testid="final-person"
								aria-labelledby="final-{i}-heading"
								bind:this={personEls[i]}
							>
								{#if selectedItem !== null && editOwner[selectedItem] !== i}
									<!-- Tap/keyboard fallback for dragging (WCAG 2.5.7). -->
									<button
										type="button"
										class="card-target"
										aria-label="Give {items[selectedItem].description} to {p.name}"
										onclick={() => selectedItem !== null && give(selectedItem, i)}
									></button>
								{/if}
								<h3 id="final-{i}-heading">
									<span class="dot" aria-hidden="true"></span>{p.name}
								</h3>
								{#if cardChanged[i]}
									<p class="settlement changed">Changed: check with everyone</p>
								{:else if edited}
									<p class="settlement changed">Re-check to update</p>
								{:else}
									<p
										class="settlement"
										style:color={amountColour(agreed.balances[i], fairShare, finalMax)}
									>
										{paymentLabel(agreed.balances[i], fmt)}
									</p>
								{/if}
								<ul class="items">
									{#each itemOrder as k (items[k].id)}
										{#if editOwner[k] === i}
											<li>
												<button
													type="button"
													class="pill draggable"
													class:lifted={isLifted('item', k)}
													style:transform={drag && isLifted('item', k)
														? `translate(${drag.dx}px, ${drag.dy}px)`
														: undefined}
													aria-pressed={selectedItem === k}
													aria-describedby={startOwner[k] === i ? 'start-legend' : undefined}
													disabled={busy}
													onclick={() => onPick('item', k)}
													onpointerdown={(e) => onPointerDown(e, 'item', k)}
													onpointermove={onPointerMove}
													onpointerup={onPointerUp}
													onpointercancel={cancelDrag}
													>{items[k].description}{#if startOwner[k] === i}<span
															class="start-mark"
															aria-hidden="true">S</span
														>{/if}</button
												>
											</li>
										{/if}
									{/each}
									{#if !editOwner.includes(i)}<li class="note">(none)</li>{/if}
								</ul>
							</section>
						{/each}
					</div>
					{#if editOwner.some((o, k) => o >= 0 && startOwner[k] === o)}
						<p id="start-legend" class="note">
							<span class="start-mark" aria-hidden="true">S</span> Stayed where it was placed at Start.
						</p>
					{/if}
					<p class="sr-only" aria-live="polite" data-testid="final-announce">{announcement}</p>
					{#if edited}
						<Alert tone="warning"
							>Changed: check with everyone. Amounts update after the re-check.</Alert
						>
					{:else}
						<section class="payments" aria-labelledby="payments-heading">
							<h3 id="payments-heading">Who pays whom</h3>
							{#if payments.length > 0}
								<ul>
									{#each payments as pay, i (i)}
										<li>{people[pay.from].name} pays {people[pay.to].name} {fmt(pay.amount)}</li>
									{/each}
								</ul>
							{:else}
								<p class="note">No payments needed.</p>
							{/if}
						</section>
					{/if}
					<div class="cluster">
						{#if edited}
							<Button variant="primary" disabled={busy} onclick={recheck}
								>{busy ? 'Updating…' : 'Re-check'}</Button
							>
							<Button disabled={busy} onclick={undoChanges}>Undo changes</Button>
						{/if}
						<Button disabled={busy} onclick={backToSetup}>Start over</Button>
					</div>
				</div>
			</Panel>
		</div>
	{/if}

	<section class="references" aria-labelledby="references-heading">
		<h2 id="references-heading">References</h2>
		<ol class="refs">
			{#each REFERENCES as ref (ref.href)}
				<li>
					{ref.cite} <a href={ref.href} target="_blank" rel="noreferrer">{ref.title}</a>
					{ref.venue}
					<span class="impact">{ref.impact}</span>
				</li>
			{/each}
		</ol>
	</section>
</div>

{#snippet seedPill(k: number)}
	<button
		type="button"
		class="pill draggable"
		class:lifted={isLifted('seed', k)}
		style:transform={drag && isLifted('seed', k)
			? `translate(${drag.dx}px, ${drag.dy}px)`
			: undefined}
		aria-pressed={selectedItem === k}
		disabled={busy}
		onclick={() => onPick('seed', k)}
		onpointerdown={(e) => onPointerDown(e, 'seed', k)}
		onpointermove={onPointerMove}
		onpointerup={onPointerUp}
		onpointercancel={cancelDrag}>{items[k].description}</button
	>
{/snippet}

{#snippet personCard(i: number)}
	<button
		type="button"
		class="chip-btn draggable"
		class:lifted={isLifted('chip', i)}
		style:--person={personColour(i)}
		style:transform={drag && isLifted('chip', i)
			? `translate(${drag.dx}px, ${drag.dy}px)`
			: undefined}
		aria-pressed={selected === i}
		disabled={busy}
		onclick={() => onPick('chip', i)}
		onpointerdown={(e) => onPointerDown(e, 'chip', i)}
		onpointermove={onPointerMove}
		onpointerup={onPointerUp}
		onpointercancel={cancelDrag}
		><span class="dot" aria-hidden="true"></span>{people[i].name}</button
	>
{/snippet}

<style>
	.note {
		margin: 0;
		font-size: var(--text-sm);
		color: var(--text-muted);
	}

	/* Info tip right next to the panel title, not pushed to the far right. */
	.tip-panel :global(.ui-panel-actions) {
		margin-left: 0;
	}

	.pills {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-1);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	/* One item-pill shape everywhere: setup, board and final screens. */
	.pill {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-1);
		min-height: 28px;
		padding: 0 var(--sp-2);
		background: var(--surface);
		color: var(--text);
		border: 2px solid var(--border);
		border-radius: 999px;
		font: inherit;
		font-size: var(--text-sm);
		line-height: 1.2;
	}

	/* Setup pills end in a × button, which brings its own spacing. */
	.pills .pill {
		padding-right: var(--sp-0);
	}

	.person-pill {
		border-color: var(--person);
	}

	.pill-name {
		font-weight: 600;
	}

	.pill-value {
		font-size: var(--text-xs);
		color: var(--text-muted);
	}

	.remove {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		align-self: center;
		width: 24px;
		height: 24px;
		padding: 0;
		background: transparent;
		border: 0;
		border-radius: 50%;
		color: var(--danger-text);
		font-size: var(--text-lg);
		line-height: 1;
		cursor: pointer;
	}

	.remove:hover {
		background: var(--danger-bg);
	}

	.add-form :global(.add) {
		min-width: var(--control-h);
		font-size: var(--text-lg);
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

	.start {
		margin-top: var(--sp-3);
	}

	.payments h3 {
		margin: 0 0 var(--sp-1);
		font-size: var(--text-md);
	}

	.payments ul {
		margin: 0;
		padding-left: var(--sp-4);
		font-size: var(--text-sm);
	}

	.groups {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-2);
	}

	.group {
		position: relative;
		display: flex;
		flex: 1 1 12rem;
		flex-direction: column;
		gap: var(--sp-1);
		min-width: 0;
		padding: var(--sp-2) var(--sp-3);
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		outline: 2px solid transparent;
		outline-offset: 1px;
		transition:
			outline-color 0.1s,
			background 0.1s;
	}

	.group h3 {
		margin: 0;
		font-size: var(--text-md);
	}

	.group-head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--sp-1);
	}

	.group.over {
		border-color: var(--warning);
		border-width: 2px;
	}

	.group.unclaimed {
		border-style: dashed;
		border-color: var(--border-strong);
	}

	.tag {
		padding: 0 var(--sp-1);
		border-radius: var(--radius-sm);
		font-size: var(--text-xs);
		font-weight: 600;
	}

	.tag.over {
		background: var(--warning-bg);
		color: var(--warning-text);
	}

	.tag.unclaimed {
		background: var(--surface);
		color: var(--text-muted);
		border: 1px dashed var(--border-strong);
	}

	.targetable {
		outline-color: var(--accent);
		outline-style: dashed;
		cursor: pointer;
	}

	.drop-over {
		outline-style: solid;
		outline-width: 3px;
		background: var(--accent-bg);
	}

	/* Invisible button over the whole card while a chip is selected (tap/keyboard placing). */
	.card-target {
		position: absolute;
		inset: 0;
		padding: 0;
		background: transparent;
		border: 0;
		border-radius: var(--radius);
		cursor: pointer;
	}

	.card-target:focus-visible {
		outline: 3px solid var(--focus-ring);
		outline-offset: 2px;
	}

	.settlement {
		margin: 0;
		font-size: var(--text-sm);
		font-weight: 600;
	}

	.settlement.changed {
		color: var(--warning-text);
	}

	.items {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-1);
		margin: 0;
		padding: 0;
		list-style: none;
		font-size: var(--text-sm);
	}

	.drop {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		gap: var(--sp-2);
		min-height: var(--control-h);
		margin-top: var(--sp-1);
	}

	.drop.centred {
		justify-content: center;
		margin-top: 0;
	}

	.unplaced {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--sp-1);
	}

	/* Final screen: an item still with the person it was placed on at Start. */
	.start-mark {
		display: inline-grid;
		place-items: center;
		width: 1.3em;
		height: 1.3em;
		border: 1px solid var(--border-strong);
		border-radius: 50%;
		color: var(--text-muted);
		font-size: var(--text-xs);
		font-weight: 700;
		line-height: 1;
	}

	.contested {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--sp-1);
		min-height: calc(var(--control-h) * 2);
		padding: var(--sp-2);
		border-radius: var(--radius);
		outline: 2px solid transparent;
		outline-offset: 1px;
	}

	.items.centred {
		justify-content: center;
	}

	.unplaced-label {
		margin: 0;
		font-size: var(--text-xs);
		font-weight: 600;
		color: var(--text-muted);
	}

	.chip-btn {
		align-self: flex-start;
		display: inline-flex;
		align-items: center;
		gap: var(--sp-1);
		min-height: var(--control-h);
		padding: 0 var(--sp-2);
		background: var(--surface);
		color: var(--text);
		border: 2px solid var(--person);
		border-radius: 999px;
		font-weight: 600;
	}

	/* Chips and item pills: dragged, or tapped then placed. Above the card's tap target. */
	.draggable {
		position: relative;
		z-index: 1;
		cursor: grab;
		touch-action: none;
		user-select: none;
	}

	.draggable[aria-pressed='true'] {
		background: var(--accent-bg);
		box-shadow: 0 0 0 2px var(--accent);
	}

	.draggable.lifted {
		z-index: 20;
		cursor: grabbing;
		box-shadow: 0 6px 16px color-mix(in srgb, var(--text) 30%, transparent);
		scale: 1.06;
	}

	.draggable:disabled {
		opacity: 0.6;
		cursor: progress;
	}

	.dot {
		display: inline-block;
		width: 0.7em;
		height: 0.7em;
		border-radius: 50%;
		background: var(--person);
	}

	.group h3 .dot {
		margin-right: var(--sp-1);
	}

	/* Progress stepper: numbered circles joined by a line. */
	.stepper {
		display: flex;
		align-items: flex-start;
		margin: 0 0 var(--sp-3);
		padding: 0;
		list-style: none;
	}

	.step {
		position: relative;
		display: flex;
		flex: 1 1 0;
		flex-direction: column;
		align-items: center;
		gap: var(--sp-1);
		min-width: 0;
		font-size: var(--text-xs);
		color: var(--text-muted);
		text-align: center;
	}

	.step + .step::before {
		content: '';
		position: absolute;
		top: 12px;
		left: -50%;
		right: 50%;
		height: 2px;
		background: var(--border);
	}

	.step.done::before,
	.step.now::before {
		background: var(--success);
	}

	.step-dot {
		position: relative;
		z-index: 1;
		display: grid;
		place-items: center;
		width: 26px;
		height: 26px;
		border: 2px solid var(--border);
		border-radius: 50%;
		background: var(--surface);
		font-weight: 700;
	}

	.step.done {
		color: var(--text);
	}

	.step.done .step-dot {
		background: var(--success);
		border-color: var(--success);
		color: var(--surface);
	}

	.step.now {
		color: var(--accent);
		font-weight: 600;
	}

	.step.now .step-dot {
		border-color: var(--accent);
		background: var(--accent-bg);
	}

	.references {
		margin-top: var(--sp-4);
	}

	.references h2 {
		margin: 0 0 var(--sp-1);
		font-size: var(--text-sm);
		font-weight: 600;
	}

	.refs {
		display: grid;
		gap: var(--sp-2);
		margin: 0;
		padding-left: var(--sp-5);
		font-size: var(--text-sm);
	}

	.impact {
		display: block;
		color: var(--text-muted);
	}

	@media (prefers-reduced-motion: reduce) {
		.group {
			transition: none;
		}
	}
</style>
