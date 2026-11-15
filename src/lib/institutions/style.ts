/**
 * How the diagram encodes kinds: each institution kind has a shape and a colour, and each
 * relation family has a colour and a dash pattern, so neither relies on colour alone.
 */
import type { InstitutionKind, RelationKind } from './types';

export type Shape =
	'rect' | 'double' | 'pill' | 'octagon' | 'hexagon' | 'rounded' | 'slant' | 'notch';

export interface KindStyle {
	label: string;
	shape: Shape;
	/** A `--data-n` token. */
	colour: string;
	dashed?: boolean;
}

/** In legend order: public power first, then money, then the private sector. */
export const KIND_STYLE: Record<InstitutionKind, KindStyle> = {
	state: { label: 'State', shape: 'double', colour: '--data-8' },
	supranational: { label: 'Supranational body', shape: 'octagon', colour: '--data-2' },
	intergovernmental: { label: 'Intergovernmental body', shape: 'octagon', colour: '--data-7' },
	legislature: { label: 'Legislature', shape: 'pill', colour: '--data-1' },
	executive: { label: 'Executive', shape: 'rect', colour: '--data-5' },
	court: { label: 'Court', shape: 'hexagon', colour: '--data-6' },
	agency: { label: 'Agency or regulator', shape: 'rounded', colour: '--data-10' },
	programme: { label: 'Programme or fund', shape: 'slant', colour: '--data-3' },
	investor: { label: 'Investor', shape: 'slant', colour: '--data-11' },
	company: { label: 'Company', shape: 'notch', colour: '--data-12' },
	nonprofit: { label: 'Nonprofit', shape: 'rounded', colour: '--data-9', dashed: true },
	'standards-body': {
		label: 'Standards or safety body',
		shape: 'rounded',
		colour: '--data-4',
		dashed: true
	}
};

export type Family = 'accountability' | 'money' | 'legal' | 'ties';

export const FAMILY_STYLE: Record<Family, { label: string; colour: string; dash?: string }> = {
	accountability: { label: 'Oversees, appoints, regulates', colour: '--data-4' },
	money: { label: 'Funds, invests', colour: '--data-3', dash: '7 4' },
	legal: { label: 'Appeals and complaints', colour: '--data-6', dash: '2 3' },
	ties: { label: 'Member, part, supplies, partners', colour: '--border-strong', dash: '10 3 2 3' }
};

export const FAMILY: Record<RelationKind, Family> = {
	oversees: 'accountability',
	appoints: 'accountability',
	regulates: 'accountability',
	funds: 'money',
	'invests-in': 'money',
	'appeals-to': 'legal',
	'member-of': 'ties',
	'part-of': 'ties',
	implements: 'ties',
	supplies: 'ties',
	partners: 'ties',
	competes: 'ties'
};

/**
 * Relations whose target is the larger or higher body (a member points at its union, a lower
 * court at the court it appeals to). The layout runs them backwards so that body sits above.
 */
export const UPWARD = new Set<RelationKind>(['member-of', 'part-of', 'appeals-to', 'implements']);

/** Relations with no direction, drawn without an arrowhead. */
export const SYMMETRIC = new Set<RelationKind>(['partners', 'competes']);

/** An SVG path outlining a shape centred on (x, y). */
export function shapePath(shape: Shape, x: number, y: number, w: number, h: number): string {
	const l = x - w / 2;
	const r = x + w / 2;
	const t = y - h / 2;
	const b = y + h / 2;
	const rect = (l: number, t: number, r: number, b: number, k = 0) =>
		k === 0
			? `M${l},${t}H${r}V${b}H${l}Z`
			: `M${l + k},${t}H${r - k}Q${r},${t} ${r},${t + k}V${b - k}Q${r},${b} ${r - k},${b}` +
				`H${l + k}Q${l},${b} ${l},${b - k}V${t + k}Q${l},${t} ${l + k},${t}Z`;
	switch (shape) {
		case 'rect':
			return rect(l, t, r, b);
		case 'double':
			return rect(l, t, r, b) + rect(l + 3, t + 3, r - 3, b - 3);
		case 'rounded':
			return rect(l, t, r, b, 8);
		case 'pill':
			return rect(l, t, r, b, h / 2);
		case 'octagon': {
			const k = Math.min(10, h / 3);
			return `M${l + k},${t}H${r - k}L${r},${t + k}V${b - k}L${r - k},${b}H${l + k}L${l},${b - k}V${t + k}Z`;
		}
		case 'hexagon': {
			const k = h / 2;
			return `M${l + k / 2},${t}H${r - k / 2}L${r},${y}L${r - k / 2},${b}H${l + k / 2}L${l},${y}Z`;
		}
		case 'slant': {
			const k = 10;
			return `M${l + k},${t}H${r}L${r - k},${b}H${l}Z`;
		}
		case 'notch': {
			const k = 10;
			return `M${l},${t}H${r - k}L${r},${t + k}V${b}H${l}Z`;
		}
	}
}
