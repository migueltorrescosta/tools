import { aiIndustry } from './contexts/ai-industry';
import { euInternational } from './contexts/eu-international';
import { portugal } from './contexts/portugal';
import type { Context } from './types';

export type { Context, Relation } from './types';
export { relationId } from './types';

/** Every context the tool offers, in dropdown order. */
export const CONTEXTS: Context[] = [euInternational, portugal, aiIndustry];

/** The other contexts that also draw this institution. */
export function alsoIn(id: string, except: string): Context[] {
	return CONTEXTS.filter((c) => c.id !== except && c.institutions.some((i) => i.id === id));
}
