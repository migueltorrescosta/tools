<script lang="ts" module>
	export type Column<R> = {
		key: keyof R & string;
		label: string;
		/** Right-align numbers so digits line up. */
		align?: 'left' | 'right';
		format?: (value: R[keyof R], row: R) => string;
	};
</script>

<script lang="ts" generics="Row extends Record<string, unknown>">
	let {
		caption,
		hideCaption = false,
		columns,
		rows,
		rowKey
	}: {
		caption: string;
		hideCaption?: boolean;
		columns: readonly Column<Row>[];
		rows: readonly Row[];
		rowKey: (row: Row) => string | number;
	} = $props();
</script>

<div class="ui-table-wrap">
	<table>
		<caption class:sr-only={hideCaption}>{caption}</caption>
		<thead>
			<tr>
				{#each columns as column (column.key)}
					<th scope="col" class:right={column.align === 'right'}>{column.label}</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each rows as row (rowKey(row))}
				<tr>
					{#each columns as column (column.key)}
						<td class:right={column.align === 'right'}>
							{column.format ? column.format(row[column.key], row) : String(row[column.key] ?? '')}
						</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<style>
	.ui-table-wrap {
		overflow-x: auto;
		border: 1px solid var(--border);
		border-radius: var(--radius);
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--text-sm);
	}

	caption {
		padding: var(--sp-2) var(--sp-3);
		text-align: left;
		font-weight: 600;
	}

	th,
	td {
		height: 32px;
		padding: var(--sp-1) var(--sp-3);
		text-align: left;
		border-bottom: 1px solid var(--border);
	}

	th {
		position: sticky;
		top: 0;
		background: var(--surface-2);
		font-weight: 600;
		color: var(--text-muted);
	}

	tbody tr:last-child td {
		border-bottom: 0;
	}

	tbody tr:hover {
		background: var(--surface-2);
	}

	.right {
		text-align: right;
	}
</style>
