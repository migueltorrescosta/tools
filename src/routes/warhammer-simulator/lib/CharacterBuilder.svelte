<script lang="ts">
	import { PRESET_CHARACTERS } from '$lib/warhammer-simulator/presets';
	import type { Character } from '$lib/warhammer-simulator/types';
	import { computeEffectiveStats, isModelledSpecialRule } from '$lib/warhammer-simulator/rules';
	import { MAX_STAT, MIN_STAT, isValidStat } from '$lib/warhammer-simulator/simulation';
	import armouryData from '$lib/warhammer-simulator/data/armoury.json';
	import factionsData from '$lib/warhammer-simulator/data/factions.json';
	import { Button, Field, Panel } from '$lib/ui';
	import {
		GIFT_POINT_LIMIT,
		MAX_ITEMS,
		giftTraits,
		isTraitLocked,
		itemCount,
		totalGiftPoints
	} from './traits';

	let {
		char = $bindable(),
		opponent,
		side
	}: {
		char: Character;
		opponent: Character;
		side: 'A' | 'B';
	} = $props();

	const prefix = $derived(`char${side}`);
	const factions = factionsData as Array<{ id: string; name: string; marks: string[] }>;
	const weapons = armouryData.weapons as Array<{ type: string; name: string }>;
	const armour = armouryData.armour as Array<{ type: string; name: string }>;
	const shields = armouryData.shields as Array<{ type: string; name: string }>;

	const STATS = [
		{ key: 'ws', label: 'WS', title: 'Weapon Skill' },
		{ key: 's', label: 'S', title: 'Strength' },
		{ key: 't', label: 'T', title: 'Toughness' },
		{ key: 'a', label: 'A', title: 'Attacks' },
		{ key: 'i', label: 'I', title: 'Initiative' },
		{ key: 'wounds', label: 'W', title: 'Wounds' }
	] as const;

	const marks = $derived(factions.find((f) => f.id === char.faction)?.marks ?? []);
	const points = $derived(totalGiftPoints(char.traits));
	const itemLimitReached = $derived(itemCount(char.traits) >= MAX_ITEMS);

	// Round 1, not charging, against the other character: the engine's own rules,
	// so the panel always matches the simulation.
	const stats = $derived(computeEffectiveStats(char, false, 1, opponent));

	/** "murderous-prowess" -> "Murderous Prowess", "hatred-of-high-elves" -> "Hatred (High Elves)". */
	function ruleLabel(id: string): string {
		const title = (str: string) =>
			str.replace(/(^|-)(\w)/g, (_, sep, c) => (sep ? ' ' : '') + c.toUpperCase());
		if (id === 'hatred-all') return 'Hatred';
		if (id.startsWith('hatred-of-')) return `Hatred (${title(id.slice('hatred-of-'.length))})`;
		return title(id);
	}
	const rules = $derived(
		char.specialRules.filter(isModelledSpecialRule).map(ruleLabel).join(', ') || 'None'
	);

	function loadPreset(name: string) {
		const preset = PRESET_CHARACTERS.find((p) => p.name === name);
		if (!preset) return;
		char = {
			name: preset.name,
			faction: preset.faction,
			mark: preset.mark,
			ws: preset.ws,
			s: preset.s,
			t: preset.t,
			a: preset.a,
			i: preset.i,
			wounds: preset.wounds,
			wardSave: preset.wardSave,
			weapon: preset.weapon,
			armour: preset.armourType,
			shield: preset.shield,
			traits: [...preset.traits],
			specialRules: [...preset.specialRules]
		};
	}

	function toggleTrait(id: string) {
		if (char.traits.includes(id)) {
			char = { ...char, traits: char.traits.filter((t) => t !== id) };
		} else if (!isTraitLocked(char.traits, id)) {
			char = { ...char, traits: [...char.traits, id] };
		}
	}
</script>

<div data-testid="builder-{side}">
	<Panel title="Character {side}">
		<div class="wh-builder">
			<div class="wh-row wh-row-2">
				<Field label="Preset" id="{prefix}-preset">
					{#snippet children(props)}
						<select
							class="control"
							{...props}
							onchange={(e) => loadPreset((e.target as HTMLSelectElement).value)}
						>
							<option value="">Select a preset</option>
							{#each PRESET_CHARACTERS as preset (preset.name)}
								<option value={preset.name}>{preset.name}</option>
							{/each}
						</select>
					{/snippet}
				</Field>
				<Field label="Name" id="{prefix}-name">
					{#snippet children(props)}
						<input class="control" type="text" {...props} bind:value={char.name} />
					{/snippet}
				</Field>
			</div>
			<div class="wh-row wh-row-2">
				<Field label="Faction" id="{prefix}-faction">
					{#snippet children(props)}
						<select class="control" {...props} bind:value={char.faction}>
							{#each factions as f (f.id)}
								<option value={f.id}>{f.name}</option>
							{/each}
						</select>
					{/snippet}
				</Field>
				<Field label="Mark (flavour only)" id="{prefix}-mark">
					{#snippet children(props)}
						<select class="control" {...props} bind:value={char.mark}>
							<option value={undefined}>None</option>
							{#each marks as mark (mark)}
								<option value={mark}>{mark.charAt(0).toUpperCase() + mark.slice(1)}</option>
							{/each}
						</select>
					{/snippet}
				</Field>
			</div>
			<div class="wh-row wh-stats">
				{#each STATS as stat (stat.key)}
					<Field
						label={stat.label}
						id="{prefix}-{stat.key === 'wounds' ? 'w' : stat.key}"
						error={isValidStat(char, stat.key) ? undefined : `${MIN_STAT}–${MAX_STAT}`}
					>
						{#snippet children(props)}
							<input
								class="control wh-num"
								type="number"
								min={MIN_STAT}
								max={MAX_STAT}
								title={stat.title}
								{...props}
								bind:value={char[stat.key]}
							/>
						{/snippet}
					</Field>
				{/each}
			</div>
			<div class="wh-row wh-row-3">
				<Field label="Weapon" id="{prefix}-weapon">
					{#snippet children(props)}
						<select class="control" {...props} bind:value={char.weapon}>
							{#each weapons as w (w.type)}
								<option value={w.type}>{w.name}</option>
							{/each}
						</select>
					{/snippet}
				</Field>
				<Field label="Armour" id="{prefix}-armour">
					{#snippet children(props)}
						<select class="control" {...props} bind:value={char.armour}>
							{#each armour as a (a.type)}
								<option value={a.type}>{a.name}</option>
							{/each}
						</select>
					{/snippet}
				</Field>
				<Field label="Shield" id="{prefix}-shield">
					{#snippet children(props)}
						<select class="control" {...props} bind:value={char.shield}>
							{#each shields as s (s.type)}
								<option value={s.type}>{s.name}</option>
							{/each}
						</select>
					{/snippet}
				</Field>
			</div>

			<div role="group" aria-labelledby="{prefix}-traits">
				<p id="{prefix}-traits" class="wh-group-label">
					Traits and gifts <span class="wh-muted"
						>{points} of {GIFT_POINT_LIMIT} pts, max {MAX_ITEMS} items</span
					>
				</p>
				<div class="wh-chips">
					{#each giftTraits as trait (trait.id)}
						{@const locked = isTraitLocked(char.traits, trait.id)}
						<Button
							size="sm"
							pressed={char.traits.includes(trait.id)}
							disabled={locked}
							title={locked
								? `Item limit reached (max ${MAX_ITEMS}): remove an item first`
								: trait.description}
							onclick={() => toggleTrait(trait.id)}
							>{trait.name} <span class="wh-cost">({trait.cost} pts)</span></Button
						>
					{/each}
				</div>
				{#if itemLimitReached}
					<p class="wh-note">Item limit reached ({MAX_ITEMS}). Gifts are limited only by points.</p>
				{/if}
				{#if points > GIFT_POINT_LIMIT}
					<p class="wh-over">Exceeds {GIFT_POINT_LIMIT} pts ({points} pts)</p>
				{/if}
			</div>

			<div>
				<h3 class="wh-group-label">Effective stats <span class="wh-muted">(round 1)</span></h3>
				<dl class="wh-effective">
					<div>
						<dt>S</dt>
						<dd>{stats.strength}</dd>
					</div>
					<div>
						<dt>T</dt>
						<dd>{stats.toughness}</dd>
					</div>
					<div>
						<dt>A</dt>
						<dd>{stats.attacks}</dd>
					</div>
					<div>
						<dt>I</dt>
						<dd>{stats.initiative}{stats.strikesLast ? ' (Strikes Last)' : ''}</dd>
					</div>
					<div>
						<dt>AP</dt>
						<dd>{stats.ap}</dd>
					</div>
					<div>
						<dt>Armour</dt>
						<dd>{stats.armourSave}+</dd>
					</div>
					<div>
						<dt>Ward</dt>
						<dd>{stats.wardSave > 0 ? `${stats.wardSave}+` : 'None'}</dd>
					</div>
					{#if stats.regenerationSave > 0}
						<div>
							<dt>Regen</dt>
							<dd>{stats.regenerationSave}+</dd>
						</div>
					{/if}
					<div>
						<dt>Rerolls</dt>
						<dd>
							{[stats.hasRerollHits && 'Hits', stats.hasRerollWounds && 'Wounds']
								.filter(Boolean)
								.join(', ') || 'None'}
						</dd>
					</div>
					<div>
						<dt>Rules</dt>
						<dd>{rules}</dd>
					</div>
				</dl>
			</div>
		</div>
	</Panel>
</div>

<style>
	.wh-builder {
		display: flex;
		flex-direction: column;
		gap: var(--sp-3);
	}
	.wh-row {
		display: grid;
		gap: var(--sp-2);
	}
	.wh-row-2 {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}
	.wh-row-3 {
		grid-template-columns: repeat(3, minmax(0, 1fr));
	}
	.wh-stats {
		grid-template-columns: repeat(6, minmax(0, 1fr));
	}
	.wh-num {
		font-family: var(--font-mono);
		text-align: center;
		padding-inline: var(--sp-1);
	}
	@media (max-width: 420px) {
		.wh-row-3 {
			grid-template-columns: 1fr;
		}
	}
	.wh-group-label {
		margin: 0 0 var(--sp-1);
		font-size: var(--text-sm);
		font-weight: 500;
	}
	.wh-muted,
	.wh-cost {
		color: var(--text-muted);
		font-weight: 400;
	}
	.wh-chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-1);
	}
	.wh-chips :global([aria-pressed='true'] .wh-cost) {
		color: inherit;
	}
	.wh-note,
	.wh-over {
		margin: var(--sp-1) 0 0;
		font-size: var(--text-xs);
		color: var(--text-muted);
	}
	.wh-over {
		color: var(--danger-text);
	}
	.wh-effective {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-1) var(--sp-3);
		margin: 0;
		font-size: var(--text-xs);
		font-family: var(--font-mono);
	}
	.wh-effective div {
		display: flex;
		gap: var(--sp-1);
	}
	.wh-effective dt {
		color: var(--text-muted);
	}
	.wh-effective dd {
		margin: 0;
	}
</style>
