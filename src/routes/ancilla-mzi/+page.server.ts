import { renderTex } from '$lib/tex';
import { EQUATIONS, type EquationId } from './lib/equations';
import type { PageServerLoad } from './$types';

// The route prerenders (src/routes/+layout.js), so KaTeX runs at build time only
export const load: PageServerLoad = () => ({
	tex: Object.fromEntries(
		Object.entries(EQUATIONS).map(([id, tex]) => [id, renderTex(tex)])
	) as Record<EquationId, string>
});
