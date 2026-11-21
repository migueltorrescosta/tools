<script lang="ts">
	import { Alert, Button, Field } from '#lib/ui/index.js';
	import { categoryErrors, contentId, MAX_ITEMS } from '#lib/implicit-association/storage.js';
	import type { Category, Comparison, Stimulus } from '#lib/implicit-association/types.js';
	import { toDataUrl } from './resize.js';

	let { oncreate, oncancel }: { oncreate: (c: Comparison) => void; oncancel: () => void } =
		$props();

	interface Draft {
		role: string;
		label: string;
		words: string;
		images: Stimulus[];
	}
	let drafts: Draft[] = $state([
		{ role: 'First group', label: '', words: '', images: [] },
		{ role: 'Second group', label: '', words: '', images: [] },
		{ role: 'First attribute', label: '', words: '', images: [] },
		{ role: 'Second attribute', label: '', words: '', images: [] }
	]);
	let tried = $state(false);

	const toCategory = (d: Draft): Category => ({
		label: d.label.trim(),
		items: [
			...d.words
				.split(/[\n,]/)
				.map((w) => w.trim())
				.filter(Boolean)
				.map((text): Stimulus => ({ kind: 'word', text })),
			...d.images
		]
	});
	const errors = $derived(drafts.flatMap((d) => categoryErrors(toCategory(d))));

	async function addImages(d: Draft, files: FileList | null) {
		for (const file of files ?? []) {
			if (d.images.length >= MAX_ITEMS) break;
			d.images.push({
				kind: 'image',
				src: await toDataUrl(file),
				alt: `${d.label || d.role} image`
			});
		}
	}

	function create() {
		tried = true;
		if (errors.length) return;
		const cats = drafts.map(toCategory);
		const body = { targets: [cats[0], cats[1]], attributes: [cats[2], cats[3]] } as Pick<
			Comparison,
			'targets' | 'attributes'
		>;
		oncreate({ ...body, id: contentId(body), custom: true });
	}
</script>

<form
	class="builder"
	onsubmit={(e) => {
		e.preventDefault();
		create();
	}}
>
	<p class="lead">
		Name two groups and two attributes, each with 4 to 8 words or images. The first attribute shares
		a key with each group in turn.
	</p>
	<div class="grid">
		{#each drafts as d (d.role)}
			<fieldset>
				<legend>{d.role}</legend>
				<Field label="Name">
					{#snippet children(props)}
						<input class="control" maxlength="40" bind:value={d.label} {...props} />
					{/snippet}
				</Field>
				<Field label="Words" hint="One per line or separated by commas">
					{#snippet children(props)}
						<textarea class="control" rows="3" bind:value={d.words} {...props}></textarea>
					{/snippet}
				</Field>
				{#if d.images.length}
					<ul class="thumbs">
						{#each d.images as img, i (i)}
							{#if img.kind === 'image'}
								<li>
									<img src={img.src} alt={img.alt} />
									<button
										type="button"
										class="remove"
										aria-label="Remove image {i + 1}"
										onclick={() => d.images.splice(i, 1)}>✕</button
									>
								</li>
							{/if}
						{/each}
					</ul>
				{/if}
				<label class="upload">
					<span>Add images</span>
					<input
						type="file"
						accept="image/*"
						multiple
						onchange={(e) => addImages(d, e.currentTarget.files)}
					/>
				</label>
			</fieldset>
		{/each}
	</div>
	{#if tried && errors.length}
		<Alert tone="danger">{errors[0]}</Alert>
	{/if}
	<div class="actions">
		<Button variant="primary" type="submit">Save comparison</Button>
		<Button variant="link" tone="muted" onclick={oncancel}>Cancel</Button>
	</div>
</form>

<style>
	.builder {
		display: grid;
		gap: var(--sp-3);
	}
	.lead {
		color: var(--text-muted);
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: var(--sp-3);
	}
	fieldset {
		display: grid;
		gap: var(--sp-2);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: var(--sp-3);
		min-width: 0;
	}
	legend {
		font-weight: 600;
		padding: 0 var(--sp-1);
	}
	textarea {
		resize: vertical;
	}
	.thumbs {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-1);
		padding: 0;
		list-style: none;
	}
	.thumbs li {
		position: relative;
	}
	.thumbs img {
		width: 48px;
		height: 48px;
		object-fit: cover;
		border-radius: var(--radius-sm);
	}
	.remove {
		position: absolute;
		top: -6px;
		right: -6px;
		width: 24px;
		height: 24px;
		border: 1px solid var(--border-strong);
		border-radius: 50%;
		background: var(--surface);
		color: var(--text);
		font-size: var(--text-xs);
	}
	.upload {
		font-size: var(--text-sm);
		color: var(--text-muted);
		display: grid;
		gap: var(--sp-1);
	}
	.actions {
		display: flex;
		align-items: center;
		gap: var(--sp-3);
	}
</style>
