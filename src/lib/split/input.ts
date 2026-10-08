/** Why a new item cannot be added, or null if it is valid. */
export function itemError(description: string, price: number | null | undefined): string | null {
	if (!description.trim()) return 'Enter a description.';
	if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0)
		return 'Enter a price greater than 0.';
	return null;
}

/** Why a new person cannot be added, or null if the name is valid. */
export function personError(name: string): string | null {
	return name.trim() ? null : 'Enter a name.';
}

/** Why the split cannot start yet, or null if it can. */
export function startError(people: number, items: number): string | null {
	if (people < 2) return 'Add at least 2 people to start.';
	if (items < 1) return 'Add at least 1 item to start.';
	return null;
}
