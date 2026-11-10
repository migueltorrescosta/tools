/**
 * Look prototype (branch redesign-proto2, never merged): each open look question
 * is an axis on <html> as data-<axis>; proto.css switches on it. The first value
 * of each axis is only where the panel starts, not a suggestion.
 */
export const AXES = {
	glass: {
		label: 'Boxes, light theme',
		values: {
			solid: 'Solid white (today)',
			g80: 'Glass, 80% opaque',
			g65: 'Glass, 65% opaque',
			g50: 'Glass, 50% opaque'
		}
	},
	night: {
		label: 'Boxes, dark theme',
		values: {
			wells: 'Solid ink wells (today)',
			smoked: 'Smoked glass (darker, see-through)',
			frosted: 'Frosted glass (lighter, white-tinted)'
		}
	},
	grid: {
		label: 'Paper',
		values: {
			mm: 'Millimetre: 8px and 40px (today)',
			half: '5 mm squares: 20px',
			cm: '1 cm squares: 40px',
			cmhalf: '1 cm squares with faint 5 mm'
		}
	}
} as const;
export type Axis = keyof typeof AXES;
export type Proto = { [A in Axis]: keyof (typeof AXES)[A]['values'] };
const KEY = 'proto2';
const first = () =>
	Object.fromEntries(Object.entries(AXES).map(([a, d]) => [a, Object.keys(d.values)[0]])) as Proto;
function initial(): Proto {
	const start = first();
	try {
		const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}');
		for (const axis of Object.keys(AXES) as Axis[])
			if (saved[axis] in AXES[axis].values) (start as Record<Axis, string>)[axis] = saved[axis];
	} catch {
		// No storage.
	}
	return start;
}
export const proto = $state<Proto>(typeof localStorage === 'undefined' ? first() : initial());
export function applyProto(): void {
	for (const [axis, value] of Object.entries(proto)) document.documentElement.dataset[axis] = value;
	try {
		localStorage.setItem(KEY, JSON.stringify(proto));
	} catch {
		// Storage blocked.
	}
}
