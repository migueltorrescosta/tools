// Typeset the Ancilla vs MZI equations (equations.ts) to inline SVG with
// MathJax. Runs only while the page prerenders (+page.server.ts), so the
// page ships finished SVG and no MathJax runtime.
import { mathjax } from '@mathjax/src/js/mathjax.js';
import '@mathjax/src/js/util/asyncLoad/esm.js';
import { TeX } from '@mathjax/src/js/input/tex.js';
import { SVG } from '@mathjax/src/js/output/svg.js';
import { liteAdaptor } from '@mathjax/src/js/adaptors/liteAdaptor.js';
import type { LiteElement } from '@mathjax/src/js/adaptors/lite/Element.js';
import { RegisterHTMLHandler } from '@mathjax/src/js/handlers/html.js';
import { AssistiveMmlHandler } from '@mathjax/src/js/a11y/assistive-mml.js';
import '@mathjax/src/js/input/tex/base/BaseConfiguration.js';
import '@mathjax/src/js/input/tex/ams/AmsConfiguration.js';
import '@mathjax/src/js/input/tex/boldsymbol/BoldsymbolConfiguration.js';
import { EQUATIONS, type EquationId } from './equations';

/** Attributes MathJax adds for its own explorer and menu; the static page doesn't need them. */
const STRIP = / (?:data-latex|data-mml-node|data-c|data-mjx-texclass|unselectable)="[^"]*"/g;

interface Typeset {
	/** One hidden SVG holding every glyph path; render it once on the page. */
	defs: string;
	/** Each equation as inline SVG (in currentColor) followed by hidden MathML for screen readers. */
	equations: Record<EquationId, string>;
}

export async function typesetAll(): Promise<Typeset> {
	const adaptor = liteAdaptor();
	const handler = RegisterHTMLHandler(adaptor);
	AssistiveMmlHandler(handler);
	const tex = new TeX({ packages: ['base', 'ams', 'boldsymbol'] });
	// One SVG per equation (no line breaks); glyph paths shared by all equations
	const svg = new SVG({ fontCache: 'global', linebreaks: { inline: false } });
	const doc = mathjax.document('', { InputJax: tex, OutputJax: svg });
	// Load every font range up front so convert() never needs a retry
	await svg.font.loadDynamicFiles();
	svg.fontCache.clearCache();
	const equations = {} as Record<EquationId, string>;
	for (const id of Object.keys(EQUATIONS) as EquationId[]) {
		const node = doc.convert(EQUATIONS[id], { display: false });
		equations[id] = adaptor.outerHTML(node).replace(STRIP, '');
	}
	const defs = `<svg xmlns="http://www.w3.org/2000/svg" style="display: none" aria-hidden="true">${adaptor.outerHTML(svg.fontCache.getCache() as LiteElement)}</svg>`;
	mathjax.handlers.unregister(handler);
	return { defs, equations };
}
