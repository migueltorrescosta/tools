import { aiIndustry } from './contexts/ai-industry';
import { euInternational } from './contexts/eu-international';
import { portugal } from './contexts/portugal';
import type { Context, Part } from './types';

export type { Context, Part, Relation, Route } from './types';
export { relationId } from './types';

/** Every context the tool offers, in dropdown order. */
export const CONTEXTS: Context[] = [euInternational, portugal, aiIndustry];

/** Whether the part holds every one of these institutions. */
export function holds(part: Part, ids: string[]): boolean {
	return ids.every((id) => part.ids.includes(id));
}

/** The first part that holds every one of these institutions. */
export function partOf(context: Context, ids: string[]): Part | undefined {
	return context.parts.find((p) => holds(p, ids));
}

/** The other contexts that also draw this institution. */
export function alsoIn(id: string, except: string): Context[] {
	return CONTEXTS.filter((c) => c.id !== except && c.institutions.some((i) => i.id === id));
}
