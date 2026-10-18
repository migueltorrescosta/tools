<script lang="ts">
	import { onMount } from 'svelte';
	import QRCode from 'qrcode';
	import { copyToClipboard as copyToClipboardLib } from '$lib/clipboard';
	import { Alert, Button, DataTable, Field, PageHeader, Panel, type Column } from '$lib/ui';
	import {
		MIN_CHOICES,
		MAX_CHOICES,
		cb32Normalize,
		computeChecksum,
		encodeElection,
		decodeElection,
		decodeVote,
		encodeVote,
		hasDuplicateChoices,
		parseStoredVotes,
		voteCodeWidth as codeLength,
		votesStorageKey,
		colorStyle,
		tallyResults,
		tallyFPTP,
		tallyIRV,
		tallyCondorcet,
		type Election,
		type Vote,
		type TallyResult,
		type IRVResult
	} from '$lib/rank-vote';

	// --- State ---
	type Mode = 'create' | 'vote' | 'tally' | 'error';
	let mode = $state<Mode>('create');
	let title = $state('');
	let choices = $state<string[]>(['', '']);
	let election = $state<Election | null>(null);
	let encodedBallot = $state('');
	let ranking = $state<number[]>([]);
	let votes = $state<Vote[]>([]);
	let toastMessage = $state('');
	let toastVisible = $state(false);
	let qrDialog = $state<HTMLDialogElement>();
	let qrDataUrl = $state('');
	// Set once onMount has run, so e2e tests do not click before hydration
	let hydrated = $state(false);

	// --- Toast ---
	let toastTimer: ReturnType<typeof setTimeout> | undefined;
	function showToast(message: string) {
		clearTimeout(toastTimer);
		toastMessage = message;
		toastVisible = true;
		toastTimer = setTimeout(() => {
			toastVisible = false;
		}, 2000);
	}

	// --- Clipboard ---
	async function copyToClipboard(text: string, successMsg: string) {
		try {
			await copyToClipboardLib(text);
			showToast(successMsg);
		} catch {
			showToast('Could not copy — check clipboard permissions');
		}
	}

	// --- Ballot validation ---
	let duplicateChoices = $derived(
		choices.filter((c) => c.trim()).length > 1 &&
			hasDuplicateChoices(choices.filter((c) => c.trim()))
	);

	function isBallotValid(): boolean {
		return (
			title.trim().length > 0 &&
			choices.length >= MIN_CHOICES &&
			choices.every((c) => c.trim()) &&
			!hasDuplicateChoices(choices)
		);
	}

	// --- Get vote URL ---
	function getVoteURL(): string {
		return window.location.origin + window.location.pathname + '#vote=' + encodedBallot;
	}

	// --- QR dialog ---
	// QRCode's default colours (black modules on white) in both themes, so it stays scannable.
	async function openQRDialog(text: string) {
		try {
			qrDataUrl = await QRCode.toDataURL(text, { width: 200, margin: 2 });
		} catch {
			qrDataUrl = '';
		}
		// showModal moves focus into the dialog and restores it to the trigger on close
		qrDialog?.showModal();
	}

	// --- Actions ---
	function addChoice() {
		if (choices.length < MAX_CHOICES) {
			choices = [...choices, ''];
		}
	}

	function removeChoice(index: number) {
		if (choices.length > MIN_CHOICES) {
			choices = choices.filter((_, i) => i !== index);
		}
	}

	async function createBallot() {
		const trimmedTitle = title.trim();
		const trimmedChoices = choices.map((c) => c.trim());
		if (
			!trimmedTitle ||
			trimmedChoices.length < MIN_CHOICES ||
			trimmedChoices.some((c) => !c) ||
			hasDuplicateChoices(trimmedChoices)
		)
			return;

		const cs = await computeChecksum(trimmedTitle, trimmedChoices);
		const encoded = encodeElection(trimmedTitle, trimmedChoices, cs);

		mode = 'tally';
		election = { v: 1, title: trimmedTitle, choices: trimmedChoices, cs };
		encodedBallot = encoded;
		votes = [];
		window.location.hash = '#tally=' + encoded;
	}

	function moveUp(rank: number) {
		if (rank > 0) {
			[ranking[rank], ranking[rank - 1]] = [ranking[rank - 1], ranking[rank]];
			ranking = [...ranking];
		}
	}

	function moveDown(rank: number) {
		if (rank < ranking.length - 1) {
			[ranking[rank], ranking[rank + 1]] = [ranking[rank + 1], ranking[rank]];
			ranking = [...ranking];
		}
	}

	function copyCode() {
		if (election) {
			copyToClipboard(encodeVote(ranking, election.cs), 'Vote code copied');
		}
	}

	// --- Vote entry form ---
	let voteNameInput = $state('');
	let voteCodeInput = $state('');
	let voteFormInvalid = $state(false);

	function handleVoteSubmit(e: Event) {
		e.preventDefault();
		if (!election) return;

		const name = voteNameInput.trim();
		const code = cb32Normalize(voteCodeInput.trim());

		if (!name || !decodeVote(code, election.choices.length, election.cs)) {
			voteFormInvalid = true;
			return;
		}

		// Check for duplicate name
		if (votes.some((v) => v.name === name)) {
			votes = votes.filter((v) => v.name !== name);
			showToast(`Replaced previous vote from ${name}`);
		}

		votes = [...votes, { name, code }];
		saveVotes();
		voteNameInput = '';
		voteCodeInput = '';
		voteFormInvalid = false;
	}

	function removeVote(name: string) {
		votes = votes.filter((v) => v.name !== name);
		saveVotes();
		if (expandedVotes.has(name)) toggleVote(name);
	}

	// --- Saved votes (per election, so a reload or vote-page visit keeps them) ---
	function saveVotes() {
		if (!election) return;
		try {
			localStorage.setItem(votesStorageKey(election.cs), JSON.stringify(votes));
		} catch {
			// Storage unavailable (private mode, quota): votes stay in memory only
		}
	}

	function loadVotes(e: { cs: string; choices: string[] }): Vote[] {
		try {
			return parseStoredVotes(localStorage.getItem(votesStorageKey(e.cs)), e.choices.length, e.cs);
		} catch {
			return [];
		}
	}

	// --- Expandable vote details (keyed by voter name, unique in the list) ---
	let expandedVotes = $state<Set<string>>(new Set());

	function toggleVote(name: string) {
		const newSet = new Set(expandedVotes);
		if (newSet.has(name)) {
			newSet.delete(name);
		} else {
			newSet.add(name);
		}
		expandedVotes = newSet;
	}

	// --- Computed values ---
	let currentVoteCode = $derived(
		election && ranking.length > 0 ? encodeVote(ranking, election.cs) : ''
	);

	let voteCodeWidth = $derived(election ? codeLength(election.choices.length) : 0);

	// Results for each voting mechanism
	let resultsFPTP = $derived<TallyResult>(
		election ? tallyFPTP(election.choices, votes, election.cs) : { results: [], valid: 0 }
	);
	let resultsIRV = $derived<IRVResult>(
		election
			? tallyIRV(election.choices, votes, election.cs)
			: { results: [], valid: 0, rounds: [] }
	);
	let resultsBorda = $derived(
		election ? tallyResults(election.choices, votes, election.cs) : { results: [], valid: 0 }
	);
	let resultsCondorcet = $derived(
		election
			? tallyCondorcet(election.choices, votes, election.cs)
			: { results: [], valid: 0, condorcetWinner: null, cycle: false }
	);

	// --- Results tables ---
	type ResultRow = { index: number; rank: string; text: string; score: string };
	const resultColumns: Column<ResultRow>[] = [
		{ key: 'rank', label: 'Rank', align: 'right' },
		{ key: 'text', label: 'Choice' },
		{ key: 'score', label: 'Score', align: 'right' }
	];
	const toRows = (results: TallyResult['results']): ResultRow[] =>
		results.map((r) => ({
			index: r.index,
			rank: String(r.rank),
			text: r.text,
			score: String(r.score)
		}));

	let fptpRows = $derived(toRows(resultsFPTP.results));
	let bordaRows = $derived(toRows(resultsBorda.results));
	let copelandRows = $derived(toRows(resultsCondorcet.results));
	// IRV: a candidate knocked out shows the round instead of a final-round count
	let irvRows = $derived(
		resultsIRV.results.map((r) => ({
			index: r.index,
			rank: String(r.rank),
			text: r.text,
			score: r.eliminatedRound ? `out R${r.eliminatedRound} (${r.score})` : String(r.score)
		}))
	);

	type RoundRow = Record<string, string | number>;
	let roundColumns = $derived<Column<RoundRow>[]>([
		{ key: 'choice', label: 'Choice' },
		...resultsIRV.rounds.map((_, r) => ({
			key: `r${r}`,
			label: `R${r + 1}`,
			align: 'right' as const
		}))
	]);
	let roundRows = $derived<RoundRow[]>(
		(election?.choices ?? []).map((choice, c) => {
			const row: RoundRow = { index: c, choice };
			resultsIRV.rounds.forEach((round, r) => {
				const out = resultsIRV.rounds.slice(0, r).some((prev) => prev.eliminated.includes(c));
				row[`r${r}`] = out
					? ''
					: `${round.counts[c]}${round.eliminated.includes(c) ? ' (out)' : ''}`;
			});
			return row;
		})
	);

	/** Choices ranked first by Borda count, for the results announcement. */
	let bordaLeaders = $derived(resultsBorda.results.filter((r) => r.rank === 1).map((r) => r.text));

	// --- Init ---
	onMount(() => {
		function handleHashChange() {
			const hash = window.location.hash;

			if (!hash || hash === '#' || hash === '#create') {
				mode = 'create';
				title = '';
				choices = ['', ''];
				return;
			}

			const match = hash.match(/^#(vote|tally)=(.+)$/);
			if (!match) {
				mode = 'error';
				return;
			}

			const [, hashMode, encoded] = match;
			const decodedElection = decodeElection(encoded);
			if (!decodedElection) {
				mode = 'error';
				return;
			}

			// Verify checksum
			computeChecksum(decodedElection.title, decodedElection.choices).then((cs) => {
				if (cs !== decodedElection.cs) {
					mode = 'error';
					return;
				}

				election = decodedElection;
				encodedBallot = encoded;

				if (hashMode === 'vote') {
					mode = 'vote';
					ranking = [...Array(decodedElection.choices.length).keys()];
				} else {
					mode = 'tally';
					votes = loadVotes(decodedElection);
					expandedVotes = new Set();
				}
			});
		}

		handleHashChange();
		window.addEventListener('hashchange', handleHashChange);
		hydrated = true;
		return () => window.removeEventListener('hashchange', handleHashChange);
	});
</script>

<!-- Before PageHeader, so the ballot title wins over its plain "Rank Vote" title -->
<svelte:head>
	<title
		>{election && (mode === 'vote' || mode === 'tally')
			? `${election.title} — Rank Vote`
			: 'Rank Vote'}</title
	>
</svelte:head>

<div class="rv-toast" class:shown={toastVisible} role="status">
	{toastVisible ? toastMessage : ''}
</div>

<dialog bind:this={qrDialog} class="rv-qr" aria-labelledby="rv-qr-title" closedby="any">
	<h2 id="rv-qr-title">Scan to vote</h2>
	{#if qrDataUrl}
		<img src={qrDataUrl} alt="QR code of the vote link" width="200" height="200" />
	{:else}
		<p class="rv-muted">QR generation failed. Copy the link instead.</p>
	{/if}
	<form method="dialog">
		<Button type="submit">Close</Button>
	</form>
</dialog>

<div class="container" data-hydrated={hydrated || undefined}>
	<PageHeader path="/rank-vote">Ranked-choice voting</PageHeader>

	{#if mode === 'create'}
		<div class="rv-create">
			<Panel title="New ballot">
				<div class="stack">
					<Field label="Title">
						{#snippet children(props)}
							<input
								class="control"
								type="text"
								{...props}
								bind:value={title}
								placeholder="What are we voting on?"
							/>
						{/snippet}
					</Field>
					<fieldset class="rv-choices">
						<legend>Choices</legend>
						{#each choices as _, i (i)}
							<div class="rv-choice-input">
								<Field label="Choice {i + 1}" hideLabel>
									{#snippet children(props)}
										<input
											class="control"
											type="text"
											{...props}
											bind:value={choices[i]}
											placeholder="Choice {i + 1}"
										/>
									{/snippet}
								</Field>
								{#if choices.length > MIN_CHOICES}
									<Button
										variant="ghost"
										aria-label="Remove choice {i + 1}"
										onclick={() => removeChoice(i)}>×</Button
									>
								{/if}
							</div>
						{/each}
						{#if duplicateChoices}
							<Alert tone="danger">Choices must all be different.</Alert>
						{/if}
						{#if choices.length < MAX_CHOICES}
							<div>
								<Button size="sm" onclick={addChoice}>+ Add choice</Button>
							</div>
						{/if}
					</fieldset>
					<div>
						<Button variant="primary" disabled={!isBallotValid()} onclick={createBallot}>
							Create ballot
						</Button>
					</div>
				</div>
			</Panel>
		</div>
	{/if}

	{#if mode === 'vote' && election}
		<div class="rv-vote stack">
			<div class="rv-title-row">
				<Button href={'#tally=' + encodedBallot} variant="ghost" size="sm">← Tally</Button>
				<h2>{election.title}</h2>
			</div>
			<p class="rv-muted">Rank the choices in your preferred order.</p>

			<ol class="rv-ranking" aria-label="Your ranking">
				{#each ranking as choiceIdx, r (choiceIdx)}
					<li class="rv-rank-row">
						<span class="rv-rank-num" aria-hidden="true">{r + 1}.</span>
						<div class="rv-swatch-row" style={colorStyle(choiceIdx)}>
							<span class="rv-choice-text" data-testid="ranked-choice"
								>{election.choices[choiceIdx]}</span
							>
							<Button
								size="sm"
								variant="ghost"
								class="rv-arrow"
								disabled={r === 0}
								aria-label="Move up: {election.choices[choiceIdx]}"
								onclick={() => moveUp(r)}>↑</Button
							>
							<Button
								size="sm"
								variant="ghost"
								class="rv-arrow"
								disabled={r === election.choices.length - 1}
								aria-label="Move down: {election.choices[choiceIdx]}"
								onclick={() => moveDown(r)}>↓</Button
							>
						</div>
					</li>
				{/each}
			</ol>

			<div class="rv-code-row">
				<span>Your vote code:</span>
				<output class="rv-code" data-testid="vote-code" aria-label="Your vote code"
					>{currentVoteCode}</output
				>
				<Button variant="primary" onclick={copyCode}>Copy vote code</Button>
			</div>
		</div>
	{/if}

	{#if mode === 'tally' && election}
		<div class="stack">
			<h2 class="rv-ballot-title">{election.title}</h2>

			<div class="split-view rv-tally-top">
				<Panel title="Share" level={3}>
					<div class="stack">
						<Field label="Vote link" hint="Send this to voters; each sends back a vote code.">
							{#snippet children(props)}
								<input
									class="control rv-mono"
									type="text"
									readonly
									value={getVoteURL()}
									{...props}
								/>
							{/snippet}
						</Field>
						<div class="cluster">
							<Button onclick={() => copyToClipboard(getVoteURL(), 'Link copied')}>Copy</Button>
							<Button onclick={() => openQRDialog(getVoteURL())}>QR code</Button>
							<Button href={getVoteURL()} target="_blank" rel="noopener">Vote yourself</Button>
						</div>
					</div>
				</Panel>

				<Panel title="Enter votes" level={3}>
					<div class="stack">
						<form class="rv-vote-form" onsubmit={handleVoteSubmit}>
							<Field label="Name">
								{#snippet children(props)}
									<input
										class="control"
										type="text"
										{...props}
										bind:value={voteNameInput}
										required
									/>
								{/snippet}
							</Field>
							<Field label="Vote code">
								{#snippet children(props)}
									<input
										class="control rv-mono rv-code-input"
										type="text"
										{...props}
										aria-invalid={voteFormInvalid}
										bind:value={voteCodeInput}
										oninput={() => (voteFormInvalid = false)}
										required
										minlength={voteCodeWidth}
										maxlength={voteCodeWidth}
										autocapitalize="characters"
										autocorrect="off"
										spellcheck="false"
									/>
								{/snippet}
							</Field>
							<Button type="submit" variant="primary">Add</Button>
						</form>
						{#if voteFormInvalid}
							<Alert tone="danger">
								Invalid code for this ballot. Check for typos: codes are {voteCodeWidth} characters.
							</Alert>
						{/if}
						{#if votes.length === 0}
							<p class="rv-muted">No votes yet</p>
						{:else}
							<ul class="rv-votes" aria-label="Entered votes">
								{#each votes as vote (vote.name)}
									{@const expanded = expandedVotes.has(vote.name)}
									<li class="rv-vote-entry">
										<div class="rv-vote-head">
											<button
												type="button"
												class="rv-vote-toggle"
												onclick={() => toggleVote(vote.name)}
												aria-expanded={expanded}
											>
												<span class="rv-vote-name" data-testid="vote-name">{vote.name}</span>
												<span class="rv-mono rv-chip">{vote.code}</span>
												<span class="rv-caret" class:open={expanded} aria-hidden="true">▾</span>
											</button>
											<Button
												size="sm"
												variant="ghost"
												aria-label="Remove vote from {vote.name}"
												onclick={() => removeVote(vote.name)}>×</Button
											>
										</div>
										{#if expanded}
											{@const perm = decodeVote(vote.code, election.choices.length, election.cs)}
											<ol class="rv-vote-detail">
												{#each perm ?? [] as choiceIdx, r (choiceIdx)}
													<li class="rv-swatch-row" style={colorStyle(choiceIdx)}>
														<span class="rv-detail-rank">{r + 1}.</span>
														<span class="rv-choice-text">{election.choices[choiceIdx]}</span>
													</li>
												{/each}
											</ol>
										{/if}
									</li>
								{/each}
							</ul>
						{/if}
					</div>
				</Panel>
			</div>

			<Panel title="Results" level={3}>
				<div class="stack">
					<p class="rv-muted" role="status">
						<span data-testid="vote-count"
							>{resultsBorda.valid} vote{resultsBorda.valid === 1 ? '' : 's'}</span
						>{#if resultsBorda.valid > 0}<span class="sr-only"
								>. Borda count leader: {bordaLeaders.join(', ')}</span
							>{/if}
					</p>
					{#if resultsBorda.valid > 0}
						<div class="rv-methods">
							<div class="stack">
								<DataTable
									caption="First Past The Post"
									columns={resultColumns}
									rows={fptpRows}
									rowKey={(r) => r.index}
								/>
							</div>
							<div class="stack">
								<DataTable
									caption="Instant Runoff"
									columns={resultColumns}
									rows={irvRows}
									rowKey={(r) => r.index}
								/>
								{#if resultsIRV.rounds.length > 1}
									<details class="rv-rounds">
										<summary>Rounds</summary>
										<DataTable
											caption="Instant Runoff votes per round"
											hideCaption
											columns={roundColumns}
											rows={roundRows}
											rowKey={(r) => r.index}
										/>
									</details>
								{/if}
								{#if resultsIRV.tie}
									<p class="rv-note">
										Tie: {resultsIRV.tie.map((i) => election?.choices[i]).join(', ')}. An
										elimination tie could not be broken and the winner depends on how it is
										resolved.
									</p>
								{/if}
							</div>
							<div class="stack">
								<DataTable
									caption="Borda Count"
									columns={resultColumns}
									rows={bordaRows}
									rowKey={(r) => r.index}
								/>
							</div>
							<div class="stack">
								<DataTable
									caption="Copeland (pairwise)"
									columns={resultColumns}
									rows={copelandRows}
									rowKey={(r) => r.index}
								/>
								<p class="rv-note">
									{#if resultsCondorcet.condorcetWinner !== null}
										Condorcet winner: {election?.choices[resultsCondorcet.condorcetWinner]}
									{:else if resultsCondorcet.cycle}
										No Condorcet winner (cycle)
									{:else}
										No Condorcet winner (pairwise tie)
									{/if}
								</p>
							</div>
						</div>
					{:else}
						<p class="rv-muted">Add votes to see results.</p>
					{/if}
				</div>
			</Panel>
		</div>
	{/if}

	{#if mode === 'error'}
		<div class="stack rv-error">
			<Alert tone="danger">
				<strong>Invalid ballot link</strong>
				<p>This link appears to be corrupted or invalid.</p>
			</Alert>
			<div>
				<Button href="#create" variant="primary">Create a new ballot</Button>
			</div>
		</div>
	{/if}

	<details class="how">
		<summary>How it works</summary>
		<ol>
			<li>Create a ballot with a title and its choices.</li>
			<li>
				Share the vote link. Each voter ranks the choices and sends you the short vote code it gives
				them.
			</li>
			<li>
				Enter each name and code on the tally page to see the results under four counting methods:
				First Past The Post, Instant Runoff, Borda count and Copeland.
			</li>
		</ol>
		<p>
			The ballot lives in the link itself; entered votes are saved in this browser only. Score is
			first-choice votes for First Past The Post, votes in the final round for Instant Runoff, Borda
			points, and pairwise wins for Copeland.
		</p>
	</details>

	<p class="rv-credit">
		Tool forked from <a
			href="https://tools.jonathandemirgian.com/rank-vote.html"
			target="_blank"
			rel="noopener">tools.jonathandemirgian.com/rank-vote.html</a
		>
	</p>
</div>

<style>
	h2 {
		font-size: var(--text-lg);
		margin: 0;
	}

	.rv-muted,
	.rv-note {
		margin: 0;
		font-size: var(--text-sm);
		color: var(--text-muted);
	}

	.rv-note {
		font-size: var(--text-xs);
	}

	.rv-mono {
		font-family: var(--font-mono);
	}

	/* Create */
	.rv-create {
		max-width: 36rem;
	}

	.rv-choices {
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
		margin: 0;
		padding: 0;
		border: none;
		min-width: 0;
	}

	.rv-choices legend {
		padding: 0;
		margin-bottom: var(--sp-1);
		font-size: var(--text-sm);
		font-weight: 500;
	}

	.rv-choice-input {
		display: flex;
		align-items: center;
		gap: var(--sp-1);
	}

	.rv-choice-input > :global(.ui-field) {
		flex: 1;
	}

	/* Vote */
	.rv-vote {
		max-width: 36rem;
	}

	.rv-title-row {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
	}

	.rv-ranking,
	.rv-vote-detail,
	.rv-votes {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
	}

	.rv-ranking {
		gap: var(--sp-1);
	}

	.rv-rank-row {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
	}

	.rv-rank-num {
		min-width: 2ch;
		text-align: right;
		font-weight: 600;
		color: var(--text-muted);
	}

	/* A choice with its colour as a left line (the colour never carries meaning alone) */
	.rv-swatch-row {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
		flex: 1;
		min-width: 0;
		min-height: var(--control-h);
		padding: 0 var(--sp-1) 0 var(--sp-3);
		background: var(--surface);
		border: 1px solid var(--border);
		border-left: 4px var(--choice-line, solid) var(--choice-color);
		border-radius: var(--radius);
	}

	.rv-choice-text {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.rv-swatch-row :global(.rv-arrow) {
		min-width: var(--control-h-sm);
		font-size: var(--text-lg);
	}

	.rv-tally-top {
		align-items: start;
	}

	.rv-code-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--sp-2);
	}

	.rv-code {
		font-family: var(--font-mono);
		font-size: var(--text-lg);
		font-weight: 700;
		letter-spacing: 0.1em;
		padding: var(--sp-1) var(--sp-2);
		background: var(--sunken);
		border: 1px solid var(--border);
		border-radius: var(--radius);
	}

	/* Tally */
	.rv-ballot-title {
		font-size: var(--text-xl);
	}

	.rv-vote-form {
		display: grid;
		grid-template-columns: 1fr 8rem auto;
		align-items: end;
		gap: var(--sp-2);
	}

	.rv-code-input {
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}

	.rv-votes {
		gap: var(--sp-1);
		max-height: 250px;
		overflow-y: auto;
	}

	.rv-vote-entry {
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface-2);
	}

	.rv-vote-head {
		display: flex;
		align-items: center;
		padding-right: var(--sp-1);
	}

	.rv-vote-toggle {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: center;
		gap: var(--sp-2);
		min-height: var(--control-h);
		padding: 0 var(--sp-3);
		border: none;
		background: none;
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
		border-radius: var(--radius);
	}

	.rv-vote-name {
		flex: 1;
		font-weight: 500;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.rv-chip {
		font-size: var(--text-xs);
		padding: var(--sp-0) var(--sp-1);
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		letter-spacing: 0.05em;
	}

	.rv-caret {
		color: var(--text-muted);
	}

	.rv-caret.open {
		transform: rotate(180deg);
	}

	.rv-vote-detail {
		gap: var(--sp-0);
		padding: 0 var(--sp-2) var(--sp-2);
		font-size: var(--text-sm);
	}

	.rv-vote-detail .rv-swatch-row {
		min-height: 0;
		padding: var(--sp-0) var(--sp-2);
	}

	.rv-detail-rank {
		min-width: 2ch;
		font-weight: 600;
		color: var(--text-muted);
	}

	.rv-methods {
		display: grid;
		gap: var(--sp-3);
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr));
		align-items: start;
	}

	.rv-rounds {
		font-size: var(--text-sm);
	}

	.rv-rounds summary {
		cursor: pointer;
		color: var(--text-muted);
		margin-bottom: var(--sp-1);
	}

	/* Error */
	.rv-error {
		max-width: 36rem;
	}

	.rv-error p {
		margin: 0;
	}

	/* Toast: always in the DOM so screen readers announce it */
	.rv-toast {
		position: fixed;
		bottom: var(--sp-5);
		left: 50%;
		transform: translateX(-50%);
		z-index: 2000;
		padding: var(--sp-2) var(--sp-4);
		background: var(--surface);
		color: var(--text);
		border: 1px solid var(--border-strong);
		border-radius: var(--radius);
		font-size: var(--text-sm);
		white-space: nowrap;
		visibility: hidden;
	}

	.rv-toast.shown {
		visibility: visible;
	}

	/* QR dialog */
	.rv-qr {
		padding: var(--sp-4);
		background: var(--surface);
		color: var(--text);
		border: 1px solid var(--border-strong);
		border-radius: var(--radius);
		text-align: center;
	}

	.rv-qr::backdrop {
		background: color-mix(in srgb, var(--bg) 80%, transparent);
	}

	.rv-qr h2 {
		margin-bottom: var(--sp-3);
	}

	.rv-qr img {
		display: block;
		margin: 0 auto var(--sp-3);
		border: 1px solid var(--border);
	}

	.rv-credit {
		margin: var(--sp-4) 0 0;
		font-size: var(--text-xs);
		color: var(--text-muted);
	}

	@media (max-width: 480px) {
		.rv-vote-form {
			grid-template-columns: 1fr 1fr;
		}

		.rv-vote-form > :global(.ui-btn) {
			grid-column: 1 / -1;
			justify-self: start;
		}
	}
</style>
