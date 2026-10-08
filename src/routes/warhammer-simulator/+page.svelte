<script lang="ts">
	import { onMount } from 'svelte';
	import { PRESET_CHARACTERS } from '$lib/warhammer-simulator/presets';
	import type {
		Character,
		CharacterPreset,
		Charger,
		SimulationResults,
		SimulationJob,
		WorkerMessage,
		WeaponType,
		ArmourType,
		ShieldType,
		Faction,
		MarkOfChaos
	} from '$lib/warhammer-simulator/types';
	import { getWeaponStats, getArmourStats, getShieldStats } from '$lib/warhammer-simulator/rules';
	import armouryData from '$lib/warhammer-simulator/data/armoury.json';
	import factionsData from '$lib/warhammer-simulator/data/factions.json';
	import giftTraitsData from '$lib/warhammer-simulator/data/gift-traits.json';
	import {
		Chart,
		PieController,
		BarController,
		ArcElement,
		BarElement,
		CategoryScale,
		LinearScale,
		Tooltip,
		Legend
	} from 'chart.js';

	Chart.register(
		PieController,
		BarController,
		ArcElement,
		BarElement,
		CategoryScale,
		LinearScale,
		Tooltip,
		Legend
	);

	// ── Presets ──
	const presets = PRESET_CHARACTERS;
	const weaponsList = armouryData.weapons as Array<{ type: string; name: string }>;
	const armourList = armouryData.armour as Array<{ type: string; name: string }>;
	const shieldsList = armouryData.shields as Array<{ type: string; name: string }>;
	const factions = factionsData as Array<{ id: string; name: string; marks: string[] }>;
	const traitsList = giftTraitsData as Array<{
		id: string;
		name: string;
		description: string;
		category: string;
		cost: number;
	}>;
	const factionOptions = factions.map((f) => ({ value: f.id, label: f.name }));
	const weaponOptions = weaponsList.map((w) => ({ value: w.type, label: w.name }));
	const armourOptions = armourList.map((a) => ({ value: a.type, label: a.name }));
	const shieldOptions = shieldsList.map((s) => ({ value: s.type, label: s.name }));

	// ── Character state (A and B) ──
	function createDefaultChar(label: string): Character {
		return {
			name: `Character ${label}`,
			faction: 'empire',
			ws: 4,
			s: 4,
			t: 4,
			a: 3,
			i: 4,
			wounds: 3,
			wardSave: 0,
			weapon: 'hand-weapon',
			armour: 'none',
			shield: 'none',
			traits: [],
			giftPoints: 0,
			wizardLevel: 'not-wizard',
			specialRules: []
		};
	}

	let charA = $state<Character>(createDefaultChar('A'));
	let charB = $state<Character>(createDefaultChar('B'));

	// Derive display stats for each character
	function deriveDisplayStats(char: Character) {
		const weapon = getWeaponStats(char.weapon);
		const armour = getArmourStats(char.armour);
		const shield = getShieldStats(char.shield);

		let effectiveStr = char.s + weapon.strengthBonus;
		let effectiveAtt = char.a + weapon.attacks;
		let effectiveInit = char.i;
		let effectiveAp = weapon.ap;

		if (weapon.type === 'great-weapon') {
			effectiveInit = 1;
		}

		let armourVal = armour.save;
		if (char.shield === 'shield') {
			armourVal -= shield.saveBonus;
			if (char.weapon === 'hand-weapon') {
				armourVal -= shield.parryBonus;
			}
		}
		armourVal = Math.max(2, Math.min(7, Math.round(armourVal)));

		// Trait effects
		if (char.traits.includes('strength+1')) effectiveStr += 1;
		if (char.traits.includes('armour-boost')) armourVal = Math.max(2, armourVal - 1);

		const wardVal = char.traits.includes('ward-4')
			? 4
			: char.traits.includes('ward-5')
				? 5
				: char.wardSave;

		return {
			strength: effectiveStr,
			attacks: effectiveAtt,
			initiative: effectiveInit,
			ap: effectiveAp,
			armourSave: armourVal,
			wardSave: wardVal,
			hasRerollHits:
				char.traits.includes('immortal-fury') || char.specialRules.includes('hatred-all'),
			hasKillingBlow: char.traits.includes('killing-blow'),
			hasPoison: char.traits.includes('poisoned-attacks'),
			giftPoints: char.traits.reduce((sum, t) => {
				const found = traitsList.find((tr) => tr.id === t);
				return sum + (found?.cost || 0);
			}, 0)
		};
	}

	let statsA = $derived(deriveDisplayStats(charA));
	let statsB = $derived(deriveDisplayStats(charB));

	// ── Preset loading ──
	function loadPreset(target: 'A' | 'B', presetName: string) {
		const preset = presets.find((p) => p.name === presetName);
		if (!preset) return;

		const char: Character = {
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
			giftPoints: preset.giftPoints,
			wizardLevel: preset.wizardLevel,
			specialRules: [...preset.specialRules]
		};

		if (target === 'A') charA = char;
		else charB = char;
	}

	// ── Trait toggles ──
	const availableGiftTraits = traitsList.filter(
		(t) => t.category === 'gift' || t.category === 'item'
	);
	const traitNames = availableGiftTraits.map((t) => t.id);

	function toggleTrait(target: 'A' | 'B', traitId: string) {
		const char = target === 'A' ? charA : charB;
		const currentTraits = [...char.traits];
		const idx = currentTraits.indexOf(traitId);
		if (idx >= 0) {
			currentTraits.splice(idx, 1);
		} else {
			// Check trait limit (max 2 for traits category)
			const traitDef = traitsList.find((t) => t.id === traitId);
			if (traitDef?.category === 'gift') {
				// Gifts are limited by points, not count
			} else if (
				currentTraits.filter((t) => {
					const d = traitsList.find((td) => td.id === t);
					return d?.category !== 'gift';
				}).length >= 2
			) {
				return; // max 2 non-gift traits
			}
			currentTraits.push(traitId);
		}

		if (target === 'A') {
			charA = { ...charA, traits: currentTraits };
		} else {
			charB = { ...charB, traits: currentTraits };
		}
	}

	function totalGiftPoints(traits: string[]): number {
		return traits.reduce((sum, t) => {
			const found = traitsList.find((tr) => tr.id === t);
			return sum + (found?.cost || 0);
		}, 0);
	}

	// ── Simulation state ──
	let simCount = $state(100000);
	let charger = $state<Charger>('none');
	let chargePersists = $state(false);
	let chargeBonus = $state(3);
	let isRunning = $state(false);
	let progress = $state(0);
	let elapsedMs = $state(0);
	let results = $state<SimulationResults | null>(null);
	let errorMessage = $state('');
	let worker: Worker | null = null;

	// Chart refs
	let pieCanvas: HTMLCanvasElement | undefined = $state();
	let histCanvas: HTMLCanvasElement | undefined = $state();
	let dmgCanvas: HTMLCanvasElement | undefined = $state();
	let pieChart: Chart<'pie'> | null = null;
	let histChart: Chart<'bar'> | null = null;
	let dmgChart: Chart<'bar'> | null = null;

	function getFactionMarks(factionId: string): string[] {
		const faction = factions.find((f) => f.id === factionId);
		return faction?.marks || [];
	}

	function startSimulation() {
		if (isRunning) return;

		// Validate
		if (totalGiftPoints(charA.traits) > 50) {
			errorMessage = `Character A exceeds 50 gift points (${totalGiftPoints(charA.traits)})`;
			return;
		}
		if (totalGiftPoints(charB.traits) > 50) {
			errorMessage = `Character B exceeds 50 gift points (${totalGiftPoints(charB.traits)})`;
			return;
		}
		errorMessage = '';

		isRunning = true;
		progress = 0;
		elapsedMs = 0;
		results = null;

		worker = new Worker(new URL('$lib/warhammer-simulator/simulation.worker.ts', import.meta.url), {
			type: 'module'
		});

		worker.onmessage = (e: MessageEvent<WorkerMessage>) => {
			const data = e.data;
			if (data.type === 'progress') {
				progress = data.progress;
				elapsedMs = data.elapsedMs;
			} else if (data.type === 'complete') {
				results = data.results;
				isRunning = false;
				worker?.terminate();
				worker = null;
				// Render charts after results are available (next tick)
				requestAnimationFrame(() => renderCharts());
			}
		};

		worker.onerror = (err) => {
			errorMessage = `Worker error: ${err.message}`;
			isRunning = false;
			worker?.terminate();
			worker = null;
		};

		const job: SimulationJob = {
			charA: JSON.parse(JSON.stringify(charA)),
			charB: JSON.parse(JSON.stringify(charB)),
			totalSimulations: simCount,
			seed: Date.now(),
			charger,
			chargePersists,
			chargeBonus
		};

		worker.postMessage(job);
	}

	function renderCharts() {
		const r = results;
		if (!r || !pieCanvas || !histCanvas || !dmgCanvas) return;

		// Destroy old charts
		if (pieChart) {
			pieChart.destroy();
			pieChart = null;
		}
		if (histChart) {
			histChart.destroy();
			histChart = null;
		}
		if (dmgChart) {
			dmgChart.destroy();
			dmgChart = null;
		}

		// Pie chart
		const ctx = pieCanvas.getContext('2d');
		if (ctx) {
			pieChart = new Chart(ctx, {
				type: 'pie',
				data: {
					labels: [charA.name, charB.name, 'Mutual Kill / Draw'],
					datasets: [
						{
							data: [r.winRateA, r.winRateB, r.mutualKillRate + r.drawRate],
							backgroundColor: [
								'rgba(0, 245, 255, 0.8)',
								'rgba(255, 0, 255, 0.8)',
								'rgba(255, 200, 0, 0.8)'
							],
							borderColor: ['rgba(0, 245, 255, 1)', 'rgba(255, 0, 255, 1)', 'rgba(255, 200, 0, 1)'],
							borderWidth: 2
						}
					]
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					plugins: {
						legend: {
							labels: { color: '#f0f4f8', font: { size: 12 } }
						},
						tooltip: {
							callbacks: {
								label: (ctx) => {
									const val = ctx.parsed as number;
									return `${ctx.label}: ${(val * 100).toFixed(1)}%`;
								}
							}
						}
					}
				}
			});
		}

		// Histogram
		const hctx = histCanvas.getContext('2d');
		if (hctx) {
			const labels = r.roundDistribution.map((_, i) => `${i + 1}`);
			histChart = new Chart(hctx, {
				type: 'bar',
				data: {
					labels,
					datasets: [
						{
							label: 'Frequency',
							data: r.roundDistribution.map((c) => (c / r.totalRuns) * 100),
							backgroundColor: 'rgba(0, 245, 255, 0.6)',
							borderColor: 'rgba(0, 245, 255, 0.9)',
							borderWidth: 1
						}
					]
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					plugins: {
						legend: { display: false },
						tooltip: {
							callbacks: {
								label: (ctx) => {
									return `${(ctx.parsed as { y: number }).y.toFixed(1)}% of battles`;
								}
							}
						}
					},
					scales: {
						x: {
							title: { display: true, text: 'Rounds', color: '#f0f4f8' },
							ticks: { color: '#c8d4de' },
							grid: { color: 'rgba(0,245,255,0.1)' }
						},
						y: {
							title: { display: true, text: '% of Battles', color: '#f0f4f8' },
							ticks: { color: '#c8d4de' },
							grid: { color: 'rgba(0,245,255,0.1)' },
							beginAtZero: true
						}
					}
				}
			});
		}

		// Damage Distribution histogram
		const dctx = dmgCanvas.getContext('2d');
		if (dctx) {
			// Bin damage values: count how many simulations had each damage amount
			const maxDmg = Math.max(...r.damageDistributionA, ...r.damageDistributionB, 1);
			const bins = new Array(maxDmg + 1).fill(0).map((_, i) => i);
			const countsA = bins.map((d) => r.damageDistributionA.filter((v) => v === d).length);
			const countsB = bins.map((d) => r.damageDistributionB.filter((v) => v === d).length);

			dmgChart = new Chart(dctx, {
				type: 'bar',
				data: {
					labels: bins.map((d) => `${d}`),
					datasets: [
						{
							label: charA.name,
							data: countsA.map((c) => (c / r.totalRuns) * 100),
							backgroundColor: 'rgba(0, 245, 255, 0.6)',
							borderColor: 'rgba(0, 245, 255, 0.9)',
							borderWidth: 1
						},
						{
							label: charB.name,
							data: countsB.map((c) => (c / r.totalRuns) * 100),
							backgroundColor: 'rgba(255, 0, 255, 0.6)',
							borderColor: 'rgba(255, 0, 255, 0.9)',
							borderWidth: 1
						}
					]
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					plugins: {
						legend: {
							labels: { color: '#f0f4f8', font: { size: 11 } }
						},
						tooltip: {
							callbacks: {
								label: (ctx) => {
									return `${ctx.dataset.label}: ${(ctx.parsed as { y: number }).y.toFixed(1)}%`;
								}
							}
						}
					},
					scales: {
						x: {
							title: { display: true, text: 'Wounds Dealt', color: '#f0f4f8' },
							ticks: { color: '#c8d4de' },
							grid: { color: 'rgba(0,245,255,0.1)' }
						},
						y: {
							title: { display: true, text: '% of Battles', color: '#f0f4f8' },
							ticks: { color: '#c8d4de' },
							grid: { color: 'rgba(0,245,255,0.1)' },
							beginAtZero: true
						}
					}
				}
			});
		}
	}

	onMount(() => {
		return () => {
			worker?.terminate();
			if (pieChart) pieChart.destroy();
			if (histChart) histChart.destroy();
			if (dmgChart) dmgChart.destroy();
		};
	});
</script>

<svelte:head>
	<title>Warhammer Simulator</title>
</svelte:head>

<div class="container">
	<header>
		<h1>WARHAMMER SIMULATOR</h1>
		<p class="subtitle">
			Monte Carlo duel probability calculator for Warhammer: The Old World — 100 000 simulations by
			default
		</p>
	</header>

	<!-- Character Builder -->
	<div class="sim-builder-grid">
		<!-- Character A -->
		<div class="panel">
			<div class="panel-header">
				<span class="dot red"></span>
				<span class="dot yellow"></span>
				<span class="dot green"></span>
				<span class="panel-title">CHARACTER A</span>
			</div>
			<div class="panel-content sim-form">
				<div class="field-group">
					<label class="input-label" for="charA-preset">Preset</label>
					<select
						id="charA-preset"
						class="algorithm-select"
						onchange={(e) => loadPreset('A', (e.target as HTMLSelectElement).value)}
					>
						<option value="">-- Select Preset --</option>
						{#each presets as preset}
							<option value={preset.name}>{preset.name}</option>
						{/each}
					</select>
				</div>
				<div class="field-group">
					<label class="input-label" for="charA-name">Name</label>
					<input
						id="charA-name"
						class="key-input"
						type="text"
						bind:value={charA.name}
						placeholder="Character name"
					/>
				</div>
				<div class="sim-form-row">
					<div class="field-group">
						<label class="input-label" for="charA-faction">Faction</label>
						<select id="charA-faction" class="algorithm-select" bind:value={charA.faction}>
							{#each factionOptions as opt}
								<option value={opt.value}>{opt.label}</option>
							{/each}
						</select>
					</div>
					<div class="field-group">
						<label class="input-label" for="charA-mark">Mark</label>
						<select id="charA-mark" class="algorithm-select" bind:value={charA.mark}>
							<option value={undefined}>None</option>
							{#each getFactionMarks(charA.faction) as mark}
								<option value={mark}>{mark.charAt(0).toUpperCase() + mark.slice(1)}</option>
							{/each}
						</select>
					</div>
				</div>
				<div class="sim-form-row">
					<div class="field-group">
						<label class="input-label" for="charA-ws">WS</label><input
							id="charA-ws"
							class="key-input"
							type="number"
							min="1"
							max="10"
							bind:value={charA.ws}
						/>
					</div>
					<div class="field-group">
						<label class="input-label" for="charA-s">S</label><input
							id="charA-s"
							class="key-input"
							type="number"
							min="1"
							max="10"
							bind:value={charA.s}
						/>
					</div>
					<div class="field-group">
						<label class="input-label" for="charA-t">T</label><input
							id="charA-t"
							class="key-input"
							type="number"
							min="1"
							max="10"
							bind:value={charA.t}
						/>
					</div>
					<div class="field-group">
						<label class="input-label" for="charA-a">A</label><input
							id="charA-a"
							class="key-input"
							type="number"
							min="1"
							max="10"
							bind:value={charA.a}
						/>
					</div>
					<div class="field-group">
						<label class="input-label" for="charA-i">I</label><input
							id="charA-i"
							class="key-input"
							type="number"
							min="1"
							max="10"
							bind:value={charA.i}
						/>
					</div>
					<div class="field-group">
						<label class="input-label" for="charA-w">W</label><input
							id="charA-w"
							class="key-input"
							type="number"
							min="1"
							max="10"
							bind:value={charA.wounds}
						/>
					</div>
				</div>
				<div class="sim-form-row">
					<div class="field-group">
						<label class="input-label" for="charA-weapon">Weapon</label>
						<select id="charA-weapon" class="algorithm-select" bind:value={charA.weapon}>
							{#each weaponOptions as opt}
								<option value={opt.value}>{opt.label}</option>
							{/each}
						</select>
					</div>
					<div class="field-group">
						<label class="input-label" for="charA-armour">Armour</label>
						<select id="charA-armour" class="algorithm-select" bind:value={charA.armour}>
							{#each armourOptions as opt}
								<option value={opt.value}>{opt.label}</option>
							{/each}
						</select>
					</div>
					<div class="field-group">
						<label class="input-label" for="charA-shield">Shield</label>
						<select id="charA-shield" class="algorithm-select" bind:value={charA.shield}>
							{#each shieldOptions as opt}
								<option value={opt.value}>{opt.label}</option>
							{/each}
						</select>
					</div>
				</div>

				<!-- Traits & Gifts -->
				<div class="field-group">
					<span class="input-label">Traits & Gifts (max 50 pts)</span>
					<div class="trait-grid">
						{#each availableGiftTraits as trait}
							<button
								class="format-btn"
								class:active={charA.traits.includes(trait.id)}
								onclick={() => toggleTrait('A', trait.id)}
								title={trait.description}
							>
								{trait.name} ({trait.cost} pts)
							</button>
						{/each}
					</div>
					{#if totalGiftPoints(charA.traits) > 50}
						<p class="error-small">Exceeds 50 pts ({totalGiftPoints(charA.traits)} pts)</p>
					{/if}
				</div>

				<!-- Derived Stats -->
				<div class="derived-stats">
					<span class="input-label">Effective Stats</span>
					<div class="stats-grid">
						<span>S {statsA.strength}</span>
						<span>A {statsA.attacks}</span>
						<span>I {statsA.initiative}</span>
						<span>AP {statsA.ap}</span>
						<span>Armour {statsA.armourSave}+</span>
						<span>Ward {statsA.wardSave > 0 ? statsA.wardSave + '+' : 'None'}</span>
						<span>Rerolls {statsA.hasRerollHits ? 'Hits' : 'None'}</span>
						<span>Gift {statsA.giftPoints}pts</span>
					</div>
				</div>
			</div>
		</div>

		<!-- Character B -->
		<div class="panel">
			<div class="panel-header">
				<span class="dot red"></span>
				<span class="dot yellow"></span>
				<span class="dot green"></span>
				<span class="panel-title">CHARACTER B</span>
			</div>
			<div class="panel-content sim-form">
				<div class="field-group">
					<label class="input-label" for="charB-preset">Preset</label>
					<select
						id="charB-preset"
						class="algorithm-select"
						onchange={(e) => loadPreset('B', (e.target as HTMLSelectElement).value)}
					>
						<option value="">-- Select Preset --</option>
						{#each presets as preset}
							<option value={preset.name}>{preset.name}</option>
						{/each}
					</select>
				</div>
				<div class="field-group">
					<label class="input-label" for="charB-name">Name</label>
					<input
						id="charB-name"
						class="key-input"
						type="text"
						bind:value={charB.name}
						placeholder="Character name"
					/>
				</div>
				<div class="sim-form-row">
					<div class="field-group">
						<label class="input-label" for="charB-faction">Faction</label>
						<select id="charB-faction" class="algorithm-select" bind:value={charB.faction}>
							{#each factionOptions as opt}
								<option value={opt.value}>{opt.label}</option>
							{/each}
						</select>
					</div>
					<div class="field-group">
						<label class="input-label" for="charB-mark">Mark</label>
						<select id="charB-mark" class="algorithm-select" bind:value={charB.mark}>
							<option value={undefined}>None</option>
							{#each getFactionMarks(charB.faction) as mark}
								<option value={mark}>{mark.charAt(0).toUpperCase() + mark.slice(1)}</option>
							{/each}
						</select>
					</div>
				</div>
				<div class="sim-form-row">
					<div class="field-group">
						<label class="input-label" for="charB-ws">WS</label><input
							id="charB-ws"
							class="key-input"
							type="number"
							min="1"
							max="10"
							bind:value={charB.ws}
						/>
					</div>
					<div class="field-group">
						<label class="input-label" for="charB-s">S</label><input
							id="charB-s"
							class="key-input"
							type="number"
							min="1"
							max="10"
							bind:value={charB.s}
						/>
					</div>
					<div class="field-group">
						<label class="input-label" for="charB-t">T</label><input
							id="charB-t"
							class="key-input"
							type="number"
							min="1"
							max="10"
							bind:value={charB.t}
						/>
					</div>
					<div class="field-group">
						<label class="input-label" for="charB-a">A</label><input
							id="charB-a"
							class="key-input"
							type="number"
							min="1"
							max="10"
							bind:value={charB.a}
						/>
					</div>
					<div class="field-group">
						<label class="input-label" for="charB-i">I</label><input
							id="charB-i"
							class="key-input"
							type="number"
							min="1"
							max="10"
							bind:value={charB.i}
						/>
					</div>
					<div class="field-group">
						<label class="input-label" for="charB-w">W</label><input
							id="charB-w"
							class="key-input"
							type="number"
							min="1"
							max="10"
							bind:value={charB.wounds}
						/>
					</div>
				</div>
				<div class="sim-form-row">
					<div class="field-group">
						<label class="input-label" for="charB-weapon">Weapon</label>
						<select id="charB-weapon" class="algorithm-select" bind:value={charB.weapon}>
							{#each weaponOptions as opt}
								<option value={opt.value}>{opt.label}</option>
							{/each}
						</select>
					</div>
					<div class="field-group">
						<label class="input-label" for="charB-armour">Armour</label>
						<select id="charB-armour" class="algorithm-select" bind:value={charB.armour}>
							{#each armourOptions as opt}
								<option value={opt.value}>{opt.label}</option>
							{/each}
						</select>
					</div>
					<div class="field-group">
						<label class="input-label" for="charB-shield">Shield</label>
						<select id="charB-shield" class="algorithm-select" bind:value={charB.shield}>
							{#each shieldOptions as opt}
								<option value={opt.value}>{opt.label}</option>
							{/each}
						</select>
					</div>
				</div>

				<!-- Traits & Gifts -->
				<div class="field-group">
					<span class="input-label">Traits & Gifts (max 50 pts)</span>
					<div class="trait-grid">
						{#each availableGiftTraits as trait}
							<button
								class="format-btn"
								class:active={charB.traits.includes(trait.id)}
								onclick={() => toggleTrait('B', trait.id)}
								title={trait.description}
							>
								{trait.name} ({trait.cost} pts)
							</button>
						{/each}
					</div>
					{#if totalGiftPoints(charB.traits) > 50}
						<p class="error-small">Exceeds 50 pts ({totalGiftPoints(charB.traits)} pts)</p>
					{/if}
				</div>

				<!-- Derived Stats -->
				<div class="derived-stats">
					<span class="input-label">Effective Stats</span>
					<div class="stats-grid">
						<span>S {statsB.strength}</span>
						<span>A {statsB.attacks}</span>
						<span>I {statsB.initiative}</span>
						<span>AP {statsB.ap}</span>
						<span>Armour {statsB.armourSave}+</span>
						<span>Ward {statsB.wardSave > 0 ? statsB.wardSave + '+' : 'None'}</span>
						<span>Rerolls {statsB.hasRerollHits ? 'Hits' : 'None'}</span>
						<span>Gift {statsB.giftPoints}pts</span>
					</div>
				</div>
			</div>
		</div>
	</div>

	<!-- Simulation Controls -->
	<div class="panel sim-controls">
		<div class="panel-header">
			<span class="dot red"></span>
			<span class="dot yellow"></span>
			<span class="dot green"></span>
			<span class="panel-title">SIMULATION CONTROLS</span>
		</div>
		<div class="panel-content">
			<div class="sim-controls-row">
				<div class="field-group">
					<label class="input-label" for="sim-count">Simulations</label>
					<input
						id="sim-count"
						class="key-input sim-count-input"
						type="number"
						min="100"
						max="100000"
						bind:value={simCount}
					/>
				</div>
				<div class="field-group">
					<label class="input-label" for="charger">Charger</label>
					<select id="charger" class="algorithm-select" bind:value={charger}>
						<option value="none">No charge</option>
						<option value="A">{charA.name}</option>
						<option value="B">{charB.name}</option>
					</select>
				</div>
				<div class="field-group">
					<label class="input-label" for="charge-bonus">Charge Initiative Bonus</label>
					<select
						id="charge-bonus"
						class="algorithm-select"
						bind:value={chargeBonus}
						disabled={charger === 'none'}
					>
						<option value={1}>+1</option>
						<option value={2}>+2</option>
						<option value={3}>+3</option>
					</select>
				</div>
				<div class="field-group checkbox-group">
					<label class="input-label">
						<input type="checkbox" bind:checked={chargePersists} disabled={charger === 'none'} />
						Charge persists after round 1
					</label>
				</div>
				<div class="field-group sim-btn-wrap">
					<button class="process-btn" onclick={startSimulation} disabled={isRunning}>
						<span class="btn-text">{isRunning ? 'RUNNING...' : 'RUN SIMULATION'}</span>
						<span class="btn-glow"></span>
					</button>
				</div>
			</div>

			<!-- Progress Bar -->
			{#if isRunning || results}
				<div class="progress-container">
					<div class="progress-bar-bg">
						<div class="progress-bar-fill" style="width: {isRunning ? progress * 100 : 100}%"></div>
					</div>
					<span class="progress-text">
						{isRunning ? `${(progress * 100).toFixed(0)}%` : '100%'}
						({(elapsedMs / 1000).toFixed(1)}s)
					</span>
				</div>
			{/if}

			{#if errorMessage}
				<p class="error">{errorMessage}</p>
			{/if}
		</div>
	</div>

	<!-- Results -->
	{#if results}
		<div class="sim-results-grid">
			<!-- Winner Panel (pie chart + win rates + explanations) -->
			<div class="panel">
				<div class="panel-header">
					<span class="dot red"></span>
					<span class="dot yellow"></span>
					<span class="dot green"></span>
					<span class="panel-title">WINNER</span>
				</div>
				<div class="panel-content chart-panel-content">
					<canvas bind:this={pieCanvas}></canvas>
					<div class="winner-stats">
						<div class="winner-stat" class:highlight={results.winRateA >= results.winRateB}>
							<span class="winner-dot" style="background:rgba(0,245,255,0.9)"></span>
							<span class="winner-label">{charA.name}</span>
							<span class="winner-value">{(results.winRateA * 100).toFixed(1)}%</span>
						</div>
						<div class="winner-stat" class:highlight={results.winRateB >= results.winRateA}>
							<span class="winner-dot" style="background:rgba(255,0,255,0.9)"></span>
							<span class="winner-label">{charB.name}</span>
							<span class="winner-value">{(results.winRateB * 100).toFixed(1)}%</span>
						</div>
						<div class="winner-stat">
							<span class="winner-dot" style="background:rgba(255,200,0,0.9)"></span>
							<span class="winner-label">Mutual/Draw</span>
							<span class="winner-value"
								>{((results.mutualKillRate + results.drawRate) * 100).toFixed(1)}%</span
							>
						</div>
					</div>
					<div class="winner-note">
						<span class="hint"
							>Mutual Kill = both died same round. Draw = 50-round cap reached (shown combined).</span
						>
					</div>
				</div>
			</div>

			<!-- Round Distribution -->
			<div class="panel">
				<div class="panel-header">
					<span class="dot red"></span>
					<span class="dot yellow"></span>
					<span class="dot green"></span>
					<span class="panel-title">ROUND DISTRIBUTION</span>
				</div>
				<div class="panel-content chart-panel-content">
					<canvas bind:this={histCanvas}></canvas>
					<div class="chart-note">
						<span class="hint"
							>Percentage of total simulations that ended in each round number.</span
						>
					</div>
				</div>
			</div>

			<!-- Damage Distribution -->
			<div class="panel">
				<div class="panel-header">
					<span class="dot red"></span>
					<span class="dot yellow"></span>
					<span class="dot green"></span>
					<span class="panel-title">DAMAGE DISTRIBUTION</span>
				</div>
				<div class="panel-content chart-panel-content">
					<canvas bind:this={dmgCanvas}></canvas>
					<div class="chart-note">
						<span class="hint">How often each character dealt N wounds in a single combat.</span>
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	/* ── Builder Grid ── */
	.sim-builder-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
		margin-bottom: 1rem;
	}

	.sim-form {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		min-height: auto;
	}

	.field-group {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.sim-form-row {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(70px, 1fr));
		gap: 0.4rem;
	}

	.sim-form-row .field-group .key-input {
		width: 100%;
		padding: 0.4rem;
		font-size: 0.85rem;
	}

	.sim-form-row .field-group .algorithm-select {
		width: 100%;
		padding: 0.4rem;
		font-size: 0.85rem;
	}

	/* ── Traits Grid ── */
	.trait-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem;
	}

	.trait-grid .format-btn {
		font-size: 0.75rem;
		padding: 0.3rem 0.6rem;
	}

	/* ── Derived Stats ── */
	.derived-stats {
		margin-top: 0.25rem;
		padding: 0.5rem;
		background: rgba(0, 245, 255, 0.05);
		border: 1px solid rgba(0, 245, 255, 0.15);
		border-radius: 6px;
	}

	.stats-grid {
		display: grid;
		grid-template-columns: 1fr 1fr 1fr 1fr;
		gap: 0.25rem;
		font-size: 0.8rem;
		color: var(--futuristic-text-dim);
		font-family: 'JetBrains Mono', monospace;
	}

	/* ── Simulation Controls ── */
	.sim-controls {
		margin-bottom: 1rem;
	}

	.sim-controls-row {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: 1rem;
	}

	.sim-count-input {
		width: 120px;
	}

	.checkbox-group {
		justify-content: center;
	}

	.checkbox-group label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
		font-size: 0.85rem;
	}

	.checkbox-group input[type='checkbox'] {
		width: 18px;
		height: 18px;
		accent-color: var(--futuristic-cyan);
	}

	.sim-btn-wrap {
		flex: 1;
		min-width: 200px;
	}

	.sim-btn-wrap .process-btn {
		margin: 0;
	}

	/* ── Progress Bar ── */
	.progress-container {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-top: 0.75rem;
	}

	.progress-bar-bg {
		flex: 1;
		height: 12px;
		background: var(--futuristic-surface);
		border: 1px solid var(--futuristic-border);
		border-radius: 6px;
		overflow: hidden;
	}

	.progress-bar-fill {
		height: 100%;
		background: linear-gradient(90deg, var(--futuristic-cyan), var(--futuristic-magenta));
		transition: width 0.15s ease;
		border-radius: 6px;
	}

	.progress-text {
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.8rem;
		color: var(--futuristic-text-dim);
		white-space: nowrap;
	}

	/* ── Results Grid ── */
	.sim-results-grid {
		display: grid;
		grid-template-columns: 1fr 1fr 1fr;
		gap: 1rem;
		margin-bottom: 1.5rem;
	}

	.chart-panel-content {
		min-height: 250px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 0.5rem;
	}

	.chart-panel-content canvas {
		max-width: 100%;
		max-height: 280px;
	}

	/* ── Winner Stats (below pie chart) ── */
	.winner-stats {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.75rem;
		margin-top: 0.5rem;
	}

	.winner-stat {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.3rem 0.6rem;
		background: rgba(0, 0, 0, 0.2);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 6px;
	}

	.winner-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.winner-label {
		font-size: 0.75rem;
		color: var(--futuristic-text-dim);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.winner-value {
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.85rem;
		color: var(--futuristic-text);
		font-weight: 700;
	}

	.winner-stat.highlight .winner-value {
		color: var(--futuristic-cyan);
	}

	.winner-note {
		text-align: center;
		margin-top: 0.5rem;
		padding: 0.25rem 0.5rem;
		background: rgba(0, 0, 0, 0.15);
		border-radius: 4px;
	}

	.chart-note {
		text-align: center;
		margin-top: 0.4rem;
	}
</style>
