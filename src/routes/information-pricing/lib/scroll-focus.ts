/**
 * Svelte action for a box that may scroll sideways (a wide table, formula or
 * diagram): while it overflows it becomes a keyboard-focusable named region,
 * so keyboard users can scroll it (axe `scrollable-region-focusable`).
 */
export function scrollFocus(node: HTMLElement, label: string) {
	let name = label;
	const update = () => {
		if (node.scrollWidth > node.clientWidth + 1) {
			node.tabIndex = 0;
			node.setAttribute('role', 'region');
			node.setAttribute('aria-label', name);
		} else {
			node.removeAttribute('tabindex');
			node.removeAttribute('role');
			node.removeAttribute('aria-label');
		}
	};
	const observer = new ResizeObserver(update);
	observer.observe(node);
	for (const child of Array.from(node.children)) observer.observe(child);
	const mutations = new MutationObserver(update);
	mutations.observe(node, { childList: true, subtree: true, characterData: true });
	update();
	return {
		update(next: string) {
			name = next;
			update();
		},
		destroy() {
			observer.disconnect();
			mutations.disconnect();
		}
	};
}
