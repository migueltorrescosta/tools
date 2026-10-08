import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { modal } from './modal';

class FakeNode {}

class FakeEl extends FakeNode {
	isConnected = true;
	children: FakeEl[] = [];
	focus = vi.fn(() => {
		doc.activeElement = this;
	});
	constructor(private autofocus = false) {
		super();
	}
	contains(n: unknown) {
		return n === this || this.children.includes(n as FakeEl);
	}
	querySelector(sel: string) {
		return sel === '[autofocus]' ? (this.children.find((c) => c.autofocus) ?? null) : null;
	}
	querySelectorAll() {
		return this.children;
	}
}

type Listener = (e: KeyboardEvent) => void;
let listeners: Set<Listener>;
let doc: { activeElement: unknown; addEventListener: unknown; removeEventListener: unknown };

beforeEach(() => {
	listeners = new Set();
	doc = {
		activeElement: null,
		addEventListener: (_: string, l: Listener) => listeners.add(l),
		removeEventListener: (_: string, l: Listener) => listeners.delete(l)
	};
	vi.stubGlobal('document', doc);
	vi.stubGlobal('Node', FakeNode);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

function press(key: string, shiftKey = false) {
	const e = { key, shiftKey, preventDefault: vi.fn() } as unknown as KeyboardEvent;
	for (const l of listeners) l(e);
	return e;
}

function setup(autofocusChild = false) {
	const opener = new FakeEl();
	doc.activeElement = opener;
	const node = new FakeEl();
	const a = new FakeEl(autofocusChild);
	const b = new FakeEl();
	node.children = [a, b];
	const onclose = vi.fn();
	const action = modal(node as unknown as HTMLElement, onclose);
	return { opener, node, a, b, onclose, action };
}

describe('modal action', () => {
	it('moves focus into the dialog on open, preferring an [autofocus] child', () => {
		expect(setup().node.focus).toHaveBeenCalled();
		const { a, node } = setup(true);
		expect(a.focus).toHaveBeenCalled();
		expect(node.focus).not.toHaveBeenCalled();
	});

	it('closes on Escape even when focus is outside the dialog', () => {
		const { onclose } = setup();
		doc.activeElement = null;
		press('Escape');
		expect(onclose).toHaveBeenCalledOnce();
	});

	it('uses the latest close callback after update', () => {
		const { onclose, action } = setup();
		const next = vi.fn();
		action.update(next);
		press('Escape');
		expect(next).toHaveBeenCalledOnce();
		expect(onclose).not.toHaveBeenCalled();
	});

	it('wraps Tab and Shift+Tab inside the dialog', () => {
		const { a, b } = setup();
		b.focus();
		expect(press('Tab').preventDefault).toHaveBeenCalled();
		expect(doc.activeElement).toBe(a);
		press('Tab', true);
		expect(doc.activeElement).toBe(b);
		a.focus();
		expect(press('Tab').preventDefault).not.toHaveBeenCalled();
	});

	it('returns focus to the opener and stops listening on destroy', () => {
		const { opener, onclose, action } = setup();
		action.destroy();
		expect(opener.focus).toHaveBeenCalledWith({ preventScroll: true });
		press('Escape');
		expect(onclose).not.toHaveBeenCalled();
	});
});
