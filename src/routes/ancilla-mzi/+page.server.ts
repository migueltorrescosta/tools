import { typesetAll } from './lib/typeset';
import type { PageServerLoad } from './$types';

// The route prerenders (src/routes/+layout.js), so MathJax runs at build time only
export const load: PageServerLoad = async () => ({ tex: await typesetAll() });
