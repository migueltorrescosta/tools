const FOCUSABLE =
	'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Svelte action for a modal dialog element: moves focus into it on open (to an
 * [autofocus] descendant, else the dialog itself), closes it on Escape wherever
 * focus is, keeps Tab cycling inside it, and returns focus to the element that
 * opened it on close.
 */
export function modal(node: HTMLElement, onclose: () => void) {
	let close = onclose;
	const opener = document.activeElement as HTMLElement | null;
	(node.querySelector<HTMLElement>('[autofocus]') ?? node).focus();

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.preventDefault();
			close();
			return;
		}
		if (e.key !== 'Tab') return;
		const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE));
		if (items.length === 0) {
			e.preventDefault();
			node.focus();
			return;
		}
		const first = items[0];
		const last = items[items.length - 1];
		const active = document.activeElement;
		const inside = active instanceof Node && node.contains(active);
		if (e.shiftKey && (active === first || active === node || !inside)) {
			e.preventDefault();
			last.focus();
		} else if (!e.shiftKey && (active === last || !inside)) {
			e.preventDefault();
			first.focus();
		}
	}

	document.addEventListener('keydown', onKeydown);
	return {
		update(next: () => void) {
			close = next;
		},
		destroy() {
			document.removeEventListener('keydown', onKeydown);
			if (opener?.isConnected) opener.focus({ preventScroll: true });
		}
	};
}
