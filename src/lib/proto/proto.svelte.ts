/**
 * Review prototype (branch redesign-proto2, never merged): each option the owner
 * is still validating is an axis on <html> as data-<axis>, read by proto.css and,
 * for layouts, by the tool itself through `proto`. The first value of each axis
 * is the owner's own pick; the others are the challenges proposed against it.
 */
export const AXES = {
	glass: {
		label: 'Boxes, light theme',
		values: {
			g50b: '50% opaque, blurred (your pick)',
			g40: '40% opaque, no blur',
			g20: '20% opaque, no blur',
			g40b4: '40% opaque, light blur (proposal)'
		}
	},
	night: {
		label: 'Boxes, dark theme',
		values: {
			frostb: 'Frosted, blurred (your pick)',
			d40: '40% opaque, no blur',
			d20: '20% opaque, no blur',
			d40b4: '40% opaque, light blur (proposal)'
		}
	},
	home: {
		label: 'Homepage',
		values: {
			c: 'Find box beside the list (your pick)',
			cplus: 'Same, plus the groups as links (proposal)'
		}
	},
	ip: {
		label: 'Information Pricing',
		values: { today: 'As today (your pick)', flat: 'As today, flattened (proposal)' }
	},
	rv: {
		label: 'Rank Vote',
		values: { today: 'As today (your pick)', flat: 'As today, flattened (proposal)' }
	},
	split: {
		label: 'Asset Splitting',
		values: { today: 'As today (your pick)', flat: 'As today, flattened (proposal)' }
	},
	sreq: {
		label: 'Symbolic Regression equations',
		values: { s100: 'Today’s size', s125: '1.25×', s150: '1.5×', s175: '1.75×' }
	},
	wordle: {
		label: 'Wordle help',
		values: {
			none: 'No help, NYT link (your pick)',
			hint: 'NYT link plus one hint line (proposal)'
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
