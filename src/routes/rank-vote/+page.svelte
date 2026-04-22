<script lang="ts">
	import { onMount } from 'svelte';
	import QRCode from 'qrcode';
	import {
		MIN_CHOICES,
		MAX_CHOICES,
		cb32Encode,
		cb32Decode,
		cb32Normalize,
		codeWidth,
		CB32_CHAR_CLASS,
		computeChecksum,
		encodeElection,
		decodeElection,
		isValidCode,
		colorStyle,
		permToInt,
		intToPerm,
		tallyResults,
		tallyFPTP,
		tallyIRV,
		tallyCondorcet,
		type Election,
		type Vote,
		type TallyResult
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
	let qrModalOpen = $state(false);
	let qrModalText = $state('');
	let qrDataUrl = $state('');

	// --- Toast ---
	function showToast(message: string) {
		toastMessage = message;
		toastVisible = true;
		setTimeout(() => {
			toastVisible = false;
		}, 2000);
	}

	// --- Clipboard ---
	async function copyToClipboard(text: string, successMsg: string) {
		try {
			await navigator.clipboard.writeText(text);
			showToast(successMsg);
		} catch {
			showToast('Could not copy — check clipboard permissions');
		}
	}

	// --- Ballot validation ---
	function isBallotValid(): boolean {
		return (
			title.trim().length > 0 && choices.length >= MIN_CHOICES && choices.every((c) => c.trim())
		);
	}

	// --- Get vote URL ---
	function getVoteURL(): string {
		return window.location.origin + window.location.pathname + '#vote=' + encodedBallot;
	}

	// --- QR Modal ---
	async function openQRModal(text: string) {
		qrModalText = text;
		try {
			qrDataUrl = await QRCode.toDataURL(text, {
				width: 200,
				margin: 2,
				color: {
					dark: '#ffffff',
					light: '#000000'
				}
			});
		} catch {
			qrDataUrl = '';
		}
		qrModalOpen = true;
	}

	function closeQRModal() {
		qrModalOpen = false;
	}

	function handleQRKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			closeQRModal();
		}
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
		if (!trimmedTitle || trimmedChoices.length < MIN_CHOICES || trimmedChoices.some((c) => !c))
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
			const code = cb32Encode(permToInt(ranking), codeWidth(election.choices.length));
			copyToClipboard(code, 'Vote code copied');
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
		const code = cb32Normalize(voteCodeInput);
		const numChoices = election.choices.length;
		const width = codeWidth(numChoices);

		if (!name || code.length !== width || !isValidCode(code, numChoices)) {
			voteFormInvalid = true;
			return;
		}

		// Check for duplicate name
		const dupIndex = votes.findIndex((v) => v.name === name);
		if (dupIndex !== -1) {
			votes = votes.filter((_, i) => i !== dupIndex);
			showToast(`Replaced previous vote from ${name}`);
		}

		votes = [...votes, { name, code }];
		voteNameInput = '';
		voteCodeInput = '';
		voteFormInvalid = false;
	}

	function removeVote(index: number) {
		votes = votes.filter((_, i) => i !== index);
	}

	// --- Expandable vote details ---
	let expandedVotes = $state<Set<number>>(new Set());

	function toggleVote(index: number) {
		const newSet = new Set(expandedVotes);
		if (newSet.has(index)) {
			newSet.delete(index);
		} else {
			newSet.add(index);
		}
		expandedVotes = newSet;
	}

	function handleVoteKeydown(e: KeyboardEvent, index: number) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			toggleVote(index);
		}
	}

	// --- Computed values ---
	let currentVoteCode = $derived(
		election && ranking.length > 0
			? cb32Encode(permToInt(ranking), codeWidth(election.choices.length))
			: ''
	);

	let voteCodeWidth = $derived(election ? codeWidth(election.choices.length) : 0);

	// Results for each voting mechanism
	let resultsFPTP = $derived(
		election ? tallyFPTP(election.choices, votes) : { results: [], valid: 0 }
	);
	let resultsIRV = $derived(
		election ? tallyIRV(election.choices, votes) : { results: [], valid: 0 }
	);
	let resultsBorda = $derived(
		election ? tallyResults(election.choices, votes) : { results: [], valid: 0 }
	);
	let resultsCondorcet = $derived(
		election ? tallyCondorcet(election.choices, votes) : { results: [], valid: 0 }
	);

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
					votes = [];
				}
			});
		}

		handleHashChange();
		window.addEventListener('hashchange', handleHashChange);
		return () => window.removeEventListener('hashchange', handleHashChange);
	});
</script>

<svelte:head>
	<title
		>{election && (mode === 'vote' || mode === 'tally')
			? `${election.title} — Rank Vote`
			: 'Rank Vote'}</title
	>
</svelte:head>

<!-- Toast notification -->
{#if toastVisible}
	<div class="rank-toast">{toastMessage}</div>
{/if}

<!-- QR Modal -->
{#if qrModalOpen}
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		class="qr-backdrop"
		onclick={closeQRModal}
		onkeydown={handleQRKeydown}
		role="dialog"
		aria-modal="true"
		tabindex="-1"
	>
		<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="qr-modal" onclick={(e) => e.stopPropagation()}>
			<button class="qr-close" onclick={closeQRModal} aria-label="Close">×</button>
			<h3>Scan to vote</h3>
			{#if qrDataUrl}
				<div class="qr-image-container">
					<img src={qrDataUrl} alt="QR Code" class="qr-image" />
				</div>
			{:else}
				<div class="qr-placeholder">
					<p class="qr-hint">QR Code</p>
					<p class="qr-subhint">(QR generation failed)</p>
				</div>
			{/if}
		</div>
	</div>
{/if}

<div class="container">
	<header>
		<h1>RANK VOTE</h1>
		<p class="subtitle">Ranked Choice Voting</p>
	</header>

	{#if mode === 'create'}
		<!-- Instructions row -->
		<div class="instructions-row">
			<div class="instruction">
				<span class="instruction-num">1</span>
				<span class="instruction-text">Create a ballot with choices</span>
			</div>
			<div class="instruction">
				<span class="instruction-num">2</span>
				<span class="instruction-text">Share the link to collect votes</span>
			</div>
			<div class="instruction">
				<span class="instruction-num">3</span>
				<span class="instruction-text">Enter vote codes to tally</span>
			</div>
		</div>

		<div class="card">
			<div class="field-group">
				<label class="field-label" for="ballot-title">Title</label>
				<input
					id="ballot-title"
					type="text"
					class="rank-input"
					bind:value={title}
					placeholder="What are we voting on?"
				/>
			</div>
			<div class="field-group">
				<span class="field-label">Choices</span>
				{#each choices as choice, i}
					<div class="choice-input-row">
						<input
							type="text"
							class="rank-input"
							bind:value={choices[i]}
							placeholder="Choice {i + 1}"
						/>
						{#if choices.length > MIN_CHOICES}
							<button class="remove-btn" onclick={() => removeChoice(i)} aria-label="Remove choice"
								>×</button
							>
						{/if}
					</div>
				{/each}
				{#if choices.length < MAX_CHOICES}
					<button class="btn-secondary" onclick={addChoice}>+ Add choice</button>
				{/if}
			</div>
			<button class="btn-primary-full" disabled={!isBallotValid()} onclick={createBallot}>
				Create ballot
			</button>
		</div>
	{/if}

	{#if mode === 'vote' && election}
		<div class="vote-header-row">
			<a href={'#tally=' + encodedBallot} class="back-link">← Tally</a>
			<h2 class="vote-title">{election.title}</h2>
		</div>
		<p class="hint">Rank the choices in your preferred order.</p>

		<div class="rank-choices">
			{#each ranking as choiceIdx, r}
				<div class="choice-slot">
					<span class="choice-rank-num">{r + 1}.</span>
					<div class="choice-row" style={colorStyle(choiceIdx)}>
						<span class="choice-text">{election.choices[choiceIdx]}</span>
						<div class="arrows">
							<button
								class="arrow-btn"
								disabled={r === 0}
								onclick={() => moveUp(r)}
								aria-label="Move up"
							>
								↑
							</button>
							<button
								class="arrow-btn"
								disabled={r === election.choices.length - 1}
								onclick={() => moveDown(r)}
								aria-label="Move down"
							>
								↓
							</button>
						</div>
					</div>
				</div>
			{/each}
		</div>

		<div class="card vote-code-card">
			<div class="vote-code-line">
				Code: <span class="vote-code-display">{currentVoteCode}</span>
			</div>
			<button class="btn-primary-full" onclick={copyCode}>Copy vote code</button>
		</div>
	{/if}

	{#if mode === 'tally' && election}
		<h2 class="vote-title">{election.title}</h2>

		<!-- Instructions row -->
		<div class="instructions-row">
			<div class="instruction">
				<span class="instruction-num">1</span>
				<span class="instruction-text">Share the link with voters</span>
			</div>
			<div class="instruction">
				<span class="instruction-num">2</span>
				<span class="instruction-text">Collect vote codes</span>
			</div>
			<div class="instruction">
				<span class="instruction-num">3</span>
				<span class="instruction-text">Enter codes to see results</span>
			</div>
		</div>

		<!-- Two column layout -->
		<div class="tally-columns">
			<!-- Column 1: Share + Results -->
			<div class="tally-col">
				<!-- Share section -->
				<div class="card section">
					<div class="section-title">Share</div>
					<div class="share-row">
						<input type="text" class="rank-input share-input" value={getVoteURL()} readonly />
					</div>
					<div class="share-buttons">
						<button
							class="btn-secondary"
							onclick={() => copyToClipboard(getVoteURL(), 'Link copied')}>Copy</button
						>
						<button class="btn-secondary" onclick={() => openQRModal(getVoteURL())}
							>QR</button
						>
					</div>
					<a href={getVoteURL()} target="_blank" rel="noopener" class="btn-secondary-full vote-link"
						>Vote yourself</a
					>
				</div>

				<!-- Results - 4 columns -->
				<div class="card section results-card">
					<div class="section-title">Results</div>
					<p class="hint">{resultsBorda.valid} vote{resultsBorda.valid > 1 ? 's' : ''}</p>
					{#if resultsBorda.valid > 0}
						<div class="methods-grid">
							<div class="method-col">
								<div class="method-header">First Past The Post</div>
								{#each resultsFPTP.results as result}
									<div class="method-row" style={colorStyle(result.index)}>
										<span class="method-rank">#{result.rank}</span>
										<span class="method-text">{result.text}</span>
										<span class="method-score">{result.score}</span>
									</div>
								{/each}
							</div>
							<div class="method-col">
								<div class="method-header">Instant Runoff</div>
								{#each resultsIRV.results as result}
									<div class="method-row" style={colorStyle(result.index)}>
										<span class="method-rank">#{result.rank}</span>
										<span class="method-text">{result.text}</span>
										<span class="method-score">{result.score}</span>
									</div>
								{/each}
							</div>
							<div class="method-col">
								<div class="method-header">Borda Count</div>
								{#each resultsBorda.results as result}
									<div class="method-row" style={colorStyle(result.index)}>
										<span class="method-rank">#{result.rank}</span>
										<span class="method-text">{result.text}</span>
										<span class="method-score">{result.score}</span>
									</div>
								{/each}
							</div>
							<div class="method-col">
								<div class="method-header">Condorcet Method</div>
								{#each resultsCondorcet.results as result}
									<div class="method-row" style={colorStyle(result.index)}>
										<span class="method-rank">#{result.rank}</span>
										<span class="method-text">{result.text}</span>
										<span class="method-score">{result.score}</span>
									</div>
								{/each}
							</div>
						</div>
					{:else}
						<p class="empty-state">Add votes</p>
					{/if}
				</div>
			</div>

			<!-- Column 2: Enter votes -->
			<div class="tally-col">
				<div class="card section">
					<div class="section-title">Enter votes</div>
					<form class="vote-form" onsubmit={handleVoteSubmit}>
						<input
							type="text"
							class="rank-input"
							placeholder="Name"
							bind:value={voteNameInput}
							required
						/>
						<input
							type="text"
							class="rank-input code-input"
							placeholder="Code"
							bind:value={voteCodeInput}
							required
							minlength={voteCodeWidth}
							maxlength={voteCodeWidth}
							pattern={voteCodePattern}
							autocapitalize="characters"
							autocorrect="off"
							spellcheck="false"
						/>
						<button type="submit" class="btn-primary">Add</button>
					</form>
					{#if votes.length === 0}
						<p class="empty-state">No votes yet</p>
					{:else}
						<div class="votes-list">
							{#each votes as vote, i}
								<div class="vote-entry">
									<!-- svelte-ignore a11y_click_events_have_key_events -->
									<div
										class="vote-entry-header"
										onclick={() => toggleVote(i)}
										onkeydown={(e) => handleVoteKeydown(e, i)}
										role="button"
										tabindex="0"
										aria-expanded={expandedVotes.has(i)}
									>
										<span class="vote-name">{vote.name}</span>
										<span class="vote-code-chip">{vote.code}</span>
										<span class="vote-toggle" class:open={expandedVotes.has(i)}>▼</span>
										<button
											class="remove-vote"
											onclick={(e) => {
												e.stopPropagation();
												removeVote(i);
											}}
											aria-label="Remove vote">×</button
										>
									</div>
									{#if expandedVotes.has(i)}
										<div class="vote-detail">
											{#if isValidCode(vote.code, election.choices.length)}
												{@const decoded = cb32Decode(vote.code)}
												{#if decoded !== null}
													{@const perm = intToPerm(decoded, election.choices.length)}
													{#each perm as choiceIdx, r}
														<div class="vote-detail-row" style={colorStyle(choiceIdx)}>
															<span class="vote-detail-rank">{r + 1}.</span>
															<span class="vote-detail-text">{election.choices[choiceIdx]}</span>
														</div>
													{/each}
												{/if}
											{/if}
										</div>
									{/if}
								</div>
							{/each}
						</div>
					{/if}
				</div>
			</div>
		</div>
	{/if}

	{#if mode === 'error'}
		<div class="error-msg">
			<strong>Invalid ballot link</strong>
			<p>This link appears to be corrupted or invalid.</p>
		</div>
		<button class="btn-primary-full" onclick={() => goto('#create')}>Create a new ballot</button>
	{/if}

	<footer class="tool-footer">
		<p>
			Tool forked from <a
				href="https://tools.jonathandemirgian.com/rank-vote.html"
				target="_blank"
				rel="noopener">https://tools.jonathandemirgian.com/rank-vote.html</a
			>
		</p>
	</footer>
</div>

<style>
	/* Additional styles for rank-vote specific elements */
	.vote-header-row {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-bottom: 0.5rem;
	}

	.back-link {
		color: var(--futuristic-cyan);
		text-decoration: none;
		font-size: 0.85rem;
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
		transition: background 0.15s;
		white-space: nowrap;
	}

	.back-link:hover {
		background: rgba(0, 245, 255, 0.1);
	}

	.vote-title {
		font-family: 'Orbitron', sans-serif;
		font-size: 1.5rem;
		color: var(--futuristic-text);
		margin-bottom: 0.5rem;
	}

	.rank-choices {
		margin-bottom: 1.5rem;
	}

	.choice-slot {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: 0.625rem;
	}

	.choice-rank-num {
		font-size: 1.1rem;
		font-weight: 700;
		color: var(--futuristic-text-dim);
		min-width: 28px;
		text-align: right;
		flex-shrink: 0;
	}

	.choice-row {
		display: flex;
		align-items: center;
		border-radius: 10px;
		padding: 0.75rem 1rem;
		border-left: 5px solid;
		gap: 0.75rem;
		flex: 1;
		min-width: 0;
	}

	.choice-text {
		flex: 1;
		font-weight: 500;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.arrows {
		display: flex;
		gap: 4px;
	}

	.arrow-btn {
		width: 44px;
		height: 44px;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 8px;
		background: rgba(255, 255, 255, 0.1);
		cursor: pointer;
		font-size: 1.2rem;
		color: var(--futuristic-text-dim);
		transition: all 0.15s;
	}

	.arrow-btn:hover:not(:disabled) {
		background: rgba(255, 255, 255, 0.2);
		border-color: var(--futuristic-cyan);
		color: var(--futuristic-cyan);
	}

	.arrow-btn:disabled {
		opacity: 0.25;
		cursor: not-allowed;
	}

	.vote-code-card {
		text-align: center;
	}

	.vote-code-line {
		font-size: 1.5rem;
		font-weight: 500;
		margin-bottom: 1rem;
	}

	.vote-code-display {
		font-family: 'SF Mono', Menlo, Monaco, 'Courier New', monospace;
		font-size: 1.5rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		background: var(--futuristic-bg);
		padding: 4px 14px;
		border-radius: 8px;
	}

	/* Instructions row */
	.instructions-row {
		display: flex;
		justify-content: center;
		gap: 2rem;
		margin-bottom: 1rem;
		padding: 0.75rem;
		background: var(--futuristic-surface);
		border: 1px solid var(--futuristic-border);
		border-radius: 12px;
	}

	.instruction {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.instruction-num {
		width: 24px;
		height: 24px;
		border-radius: 50%;
		background: var(--futuristic-cyan);
		color: var(--futuristic-bg);
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 700;
		font-size: 0.8rem;
	}

	.instruction-text {
		color: var(--futuristic-text-dim);
		font-size: 0.9rem;
	}

	/* Tally columns - 2 columns */
	.tally-columns {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
	}

	.tally-col {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.share-row {
		margin-bottom: 0.5rem;
	}

	.share-input {
		font-family: monospace;
		font-size: 0.75rem;
	}

	.share-buttons {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
	}

	.share-buttons .btn-secondary {
		flex: 1;
	}

	.vote-link {
		margin-top: auto;
		font-size: 0.75rem;
		padding: 0.5rem;
	}

	.vote-form {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-bottom: 0.75rem;
	}

	.code-input {
		text-transform: uppercase;
		font-family: monospace;
		letter-spacing: 0.1em;
	}

	.votes-list {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		overflow-y: auto;
		max-height: 250px;
	}

	.vote-entry {
		background: var(--futuristic-bg);
		border-radius: 8px;
	}

	.vote-entry-header {
		display: flex;
		align-items: center;
		padding: 0.5rem 0.75rem;
		gap: 0.5rem;
		cursor: pointer;
		transition: background 0.15s;
	}

	.vote-entry-header:hover {
		background: rgba(255, 255, 255, 0.02);
	}

	.vote-entry-header:focus {
		outline: 1px solid var(--futuristic-cyan);
		outline-offset: -1px;
	}

	.vote-name {
		flex: 1;
		font-weight: 500;
		font-size: 0.9rem;
	}

	.vote-code-chip {
		font-family: 'SF Mono', Menlo, monospace;
		font-size: 0.75rem;
		background: var(--futuristic-surface);
		padding: 2px 6px;
		border-radius: 4px;
		letter-spacing: 0.05em;
		white-space: nowrap;
	}

	.vote-toggle {
		border: none;
		background: none;
		color: var(--futuristic-text-dim);
		cursor: pointer;
		font-size: 0.75rem;
		transition: transform 0.15s;
		padding: 4px;
	}

	.vote-toggle.open {
		transform: rotate(180deg);
	}

	.remove-vote {
		border: none;
		background: none;
		color: #ff6666;
		cursor: pointer;
		font-size: 1rem;
		padding: 2px 6px;
		border-radius: 4px;
		transition: background 0.15s;
	}

	.remove-vote:hover {
		background: rgba(255, 68, 68, 0.2);
	}

	.vote-detail {
		padding: 0.25rem 0.5rem 0.5rem;
	}

	.vote-detail-row {
		display: flex;
		align-items: center;
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
		margin-bottom: 0.125rem;
		border-left: 3px solid;
		gap: 0.375rem;
		font-size: 0.8rem;
		min-width: 0;
	}

	.vote-detail-rank {
		color: var(--futuristic-text-dim);
		min-width: 18px;
		flex-shrink: 0;
		font-weight: 600;
	}

	.vote-detail-text {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		min-width: 0;
	}

	/* Results grid - 4 columns */
	.results-card {
		padding: 1rem;
	}

	.methods-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 0.75rem;
	}

	.method-col {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.method-header {
		font-size: 0.65rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		color: var(--futuristic-text-dim);
		text-align: center;
		padding-bottom: 0.375rem;
		border-bottom: 1px solid var(--futuristic-border);
		margin-bottom: 0.25rem;
	}

	.method-row {
		display: flex;
		align-items: center;
		padding: 0.35rem 0.5rem;
		border-radius: 6px;
		border-left: 3px solid;
		gap: 0.375rem;
		font-size: 0.75rem;
	}

	.method-rank {
		font-weight: 700;
		min-width: 20px;
		color: var(--futuristic-text-dim);
	}

	.method-text {
		flex: 1;
		font-weight: 500;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.method-score {
		color: var(--futuristic-cyan);
		font-weight: 600;
		white-space: nowrap;
	}

	.empty-state {
		color: var(--futuristic-text-dim);
		text-align: center;
		padding: 0.75rem;
		font-size: 0.85rem;
	}

	/* Toast */
	.rank-toast {
		position: fixed;
		bottom: 24px;
		left: 50%;
		transform: translateX(-50%);
		background: var(--futuristic-surface);
		border: 1px solid var(--futuristic-border);
		color: var(--futuristic-text);
		padding: 10px 24px;
		border-radius: 8px;
		z-index: 2000;
		font-size: 0.9rem;
		white-space: nowrap;
	}

	/* QR Modal */
	.qr-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.7);
		z-index: 1999;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.qr-modal {
		border: none;
		border-radius: 16px;
		padding: 24px;
		text-align: center;
		max-width: 320px;
		width: 90%;
		z-index: 2000;
		background: var(--futuristic-surface);
		border: 1px solid var(--futuristic-border);
	}

	.qr-modal h3 {
		margin: 0 0 16px;
		font-size: 1rem;
		color: var(--futuristic-text-dim);
	}

	.qr-close {
		position: absolute;
		top: 8px;
		right: 12px;
		border: none;
		background: none;
		font-size: 1.5rem;
		cursor: pointer;
		color: var(--futuristic-text-dim);
		padding: 4px;
	}

	.qr-close:hover {
		color: var(--futuristic-text);
	}

	.qr-image-container {
		padding: 1rem;
		background: var(--futuristic-bg);
		border-radius: 8px;
		display: inline-block;
	}

	.qr-image {
		display: block;
		max-width: 200px;
		height: auto;
	}

	.qr-placeholder {
		padding: 2rem;
		background: var(--futuristic-bg);
		border-radius: 8px;
	}

	.qr-hint {
		color: var(--futuristic-text-dim);
		margin: 0;
	}

	.qr-subhint {
		color: var(--futuristic-text-dim);
		font-size: 0.8rem;
		margin: 0.5rem 0 0;
		opacity: 0.7;
	}

	/* Responsive */
	@media (max-width: 700px) {
		.tally-columns {
			grid-template-columns: 1fr;
		}

		.instructions-row {
			flex-direction: column;
			gap: 0.5rem;
			text-align: center;
		}

		.instruction {
			justify-content: center;
		}

		.methods-grid {
			grid-template-columns: repeat(2, 1fr);
		}

		.method-header {
			font-size: 0.6rem;
		}
	}

	@media (max-width: 480px) {
		.methods-grid {
			grid-template-columns: 1fr;
		}

		.method-col {
			padding-bottom: 0.5rem;
			border-bottom: 1px solid rgba(255, 255, 255, 0.1);
		}

		.method-col:last-child {
			border-bottom: none;
		}
	}

	@media (max-width: 600px) {
		.vote-code-line {
			font-size: 1.3rem;
		}

		.vote-code-display {
			font-size: 1.3rem;
		}
	}

	.tool-footer {
		margin-top: 2rem;
		padding-top: 1rem;
		border-top: 1px solid var(--futuristic-border);
		text-align: center;
	}

	.tool-footer p {
		color: var(--futuristic-text-dim);
		font-size: 0.75rem;
		margin: 0;
	}

	.tool-footer a {
		color: var(--futuristic-cyan);
		text-decoration: none;
	}

	.tool-footer a:hover {
		text-decoration: underline;
	}
</style>
