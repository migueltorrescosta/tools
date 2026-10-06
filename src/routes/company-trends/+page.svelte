<script lang="ts">
	import datasetJson from './data/companies.json';
	import { loadDataset, type Company } from '$lib/company-trends/schema';
	import { companyTypes } from '$lib/company-trends/filter';

	const { dataset, errors } = loadDataset(datasetJson);
	const companies = errors.length === 0 ? dataset.companies : [];
	const types = companyTypes(companies);

	function pointRange(company: Company): string {
		const first = company.points[0];
		const last = company.points[company.points.length - 1];
		return first.quarter === last.quarter ? first.quarter : `${first.quarter} → ${last.quarter}`;
	}
</script>

<svelte:head>
	<title>Company Trends</title>
</svelte:head>

<div class="container">
	<header>
		<h1>COMPANY TRENDS</h1>
		<p class="subtitle">
			Revenue vs operating expenses as log-log trajectories, 2000 → last reported quarter,
			normalized to EUR
		</p>
	</header>

	{#if errors.length > 0}
		<div class="panel" role="alert">
			<span class="label">DATASET VALIDATION ERRORS</span>
			<ul>
				{#each errors as error (error)}
					<li class="hint">{error}</li>
				{/each}
			</ul>
		</div>
	{:else if companies.length === 0}
		<div class="panel">
			<span class="label">EMPTY DATASET</span>
			<p class="hint">Company curation is in progress. Nothing to chart yet.</p>
		</div>
	{:else}
		<div class="panel">
			<span class="label">COMPANIES ({companies.length} · {types.length} TYPES)</span>
			<ul>
				{#each companies as company (company.id)}
					<li>
						<strong>{company.name}</strong>
						<span class="hint">
							{company.type} · {company.country} · {company.reportingCurrency} ·
							{company.points.length} quarters · {pointRange(company)}
						</span>
					</li>
				{/each}
			</ul>
		</div>
		<p class="hint">Units: {dataset.meta.units}</p>
	{/if}

	{#if errors.length === 0}
		<p class="hint">
			{dataset.meta.fxMethodology}
			(<a href={dataset.meta.fxSource} target="_blank" rel="noreferrer">FX source</a>)
		</p>
	{/if}
</div>
