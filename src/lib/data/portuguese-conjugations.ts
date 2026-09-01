import type { LanguageModule, ConjugationMap } from './language-registry';

// ─── Portuguese Data (European Portuguese) ─────────────────────────────────────

const ALL_PERSONS = ['eu', 'tu', 'ele/ela/você', 'nós', 'vós', 'eles/elas/vocês'] as const;

const ALL_TENSES = [
	'presente do indicativo',
	'pretérito perfeito do indicativo',
	'pretérito imperfeito do indicativo',
	'pretérito mais-que-perfeito do indicativo',
	'futuro do indicativo',
	'condicional',
	'presente do conjuntivo',
	'pretérito imperfeito do conjuntivo',
	'futuro do conjuntivo',
	'imperativo afirmativo',
	'imperativo negativo',
	'infinitivo pessoal',
	'infinitivo impessoal',
	'gerúndio',
	'particípio passado'
] as const;

const ALL_VERBS = [
	'ser',
	'estar',
	'ter',
	'haver',
	'fazer',
	'ir',
	'vir',
	'dizer',
	'poder',
	'querer',
	'saber',
	'ver',
	'dar',
	'falar',
	'chegar',
	'passar',
	'dever',
	'ficar',
	'deixar',
	'encontrar',
	'pensar',
	'levar',
	'começar',
	'parecer',
	'usar',
	'trabalhar',
	'gostar',
	'precisar',
	'chamar',
	'pôr'
] as const;

// ─── Gerunds and Past Participles ─────────────────────────────────────────────

const GERUND: Record<string, string> = {
	ser: 'sendo',
	estar: 'estando',
	ter: 'tendo',
	haver: 'havendo',
	fazer: 'fazendo',
	ir: 'indo',
	vir: 'vindo',
	dizer: 'dizendo',
	poder: 'podendo',
	querer: 'querendo',
	saber: 'sabendo',
	ver: 'vendo',
	dar: 'dando',
	falar: 'falando',
	chegar: 'chegando',
	passar: 'passando',
	dever: 'devendo',
	ficar: 'ficando',
	deixar: 'deixando',
	encontrar: 'encontrando',
	pensar: 'pensando',
	levar: 'levando',
	começar: 'começando',
	parecer: 'parecendo',
	usar: 'usando',
	trabalhar: 'trabalhando',
	gostar: 'gostando',
	precisar: 'precisando',
	chamar: 'chamando',
	pôr: 'pondo'
};

const PAST_PARTICIPLE: Record<string, string> = {
	ser: 'sido',
	estar: 'estado',
	ter: 'tido',
	haver: 'havido',
	fazer: 'feito',
	ir: 'ido',
	vir: 'vindo',
	dizer: 'dito',
	poder: 'podido',
	querer: 'querido',
	saber: 'sabido',
	ver: 'visto',
	dar: 'dado',
	falar: 'falado',
	chegar: 'chegado',
	passar: 'passado',
	dever: 'devido',
	ficar: 'ficado',
	deixar: 'deixado',
	encontrar: 'encontrado',
	pensar: 'pensado',
	levar: 'levado',
	começar: 'começado',
	parecer: 'parecido',
	usar: 'usado',
	trabalhar: 'trabalhado',
	gostar: 'gostado',
	precisar: 'precisado',
	chamar: 'chamado',
	pôr: 'posto'
};

// ─── Regular Verb Conjugation Generator ───────────────────────────────────────

type VerbEnding = 'ar' | 'er' | 'ir';
type SpellChange = 'none' | 'car' | 'gar' | 'çar';

/**
 * Generate all conjugation forms for a regular Portuguese verb.
 * Handles spelling changes for -car / -gar / -çar verbs in the subjunctive.
 */
function generateConjugations(
	verb: string,
	ending: VerbEnding,
	spellChange: SpellChange = 'none'
): Record<string, Record<string, string[]>> {
	const stem = verb.slice(0, -2);

	// Subjunctive stem adjusts for spelling changes before 'e' endings
	let subjStem = stem;
	if (spellChange === 'car') subjStem = stem.replace(/c$/, 'qu');
	else if (spellChange === 'gar') subjStem = stem.replace(/g$/, 'gu');
	else if (spellChange === 'çar') subjStem = stem.replace(/ç$/, 'c');

	const t: Record<string, string[]> = {};

	if (ending === 'ar') {
		t['presente do indicativo'] = [
			stem + 'o',
			stem + 'as',
			stem + 'a',
			stem + 'amos',
			stem + 'ais',
			stem + 'am'
		];
		t['pretérito perfeito do indicativo'] = [
			stem + 'ei',
			stem + 'aste',
			stem + 'ou',
			stem + 'ámos',
			stem + 'astes',
			stem + 'aram'
		];
		t['pretérito imperfeito do indicativo'] = [
			stem + 'ava',
			stem + 'avas',
			stem + 'ava',
			stem + 'ávamos',
			stem + 'áveis',
			stem + 'avam'
		];
		t['pretérito mais-que-perfeito do indicativo'] = [
			stem + 'ara',
			stem + 'aras',
			stem + 'ara',
			stem + 'áramos',
			stem + 'áreis',
			stem + 'aram'
		];
		t['futuro do indicativo'] = [
			verb + 'ei',
			verb + 'ás',
			verb + 'á',
			verb + 'emos',
			verb + 'eis',
			verb + 'ão'
		];
		t['condicional'] = [
			verb + 'ia',
			verb + 'ias',
			verb + 'ia',
			verb + 'íamos',
			verb + 'íeis',
			verb + 'iam'
		];
		t['presente do conjuntivo'] = [
			subjStem + 'e',
			subjStem + 'es',
			subjStem + 'e',
			subjStem + 'emos',
			subjStem + 'eis',
			subjStem + 'em'
		];
		t['pretérito imperfeito do conjuntivo'] = [
			stem + 'asse',
			stem + 'asses',
			stem + 'asse',
			stem + 'ássemos',
			stem + 'ásseis',
			stem + 'assem'
		];
		t['futuro do conjuntivo'] = [
			stem + 'ar',
			stem + 'ares',
			stem + 'ar',
			stem + 'armos',
			stem + 'ardes',
			stem + 'arem'
		];
		t['imperativo afirmativo'] = [
			'',
			stem + 'a',
			subjStem + 'e',
			subjStem + 'emos',
			stem + 'ai',
			subjStem + 'em'
		];
		t['imperativo negativo'] = [
			'',
			subjStem + 'es',
			subjStem + 'e',
			subjStem + 'emos',
			subjStem + 'eis',
			subjStem + 'em'
		];
		t['infinitivo pessoal'] = [
			stem + 'ar',
			stem + 'ares',
			stem + 'ar',
			stem + 'armos',
			stem + 'ardes',
			stem + 'arem'
		];
	} else if (ending === 'er') {
		t['presente do indicativo'] = [
			stem + 'o',
			stem + 'es',
			stem + 'e',
			stem + 'emos',
			stem + 'eis',
			stem + 'em'
		];
		t['pretérito perfeito do indicativo'] = [
			stem + 'i',
			stem + 'este',
			stem + 'eu',
			stem + 'emos',
			stem + 'estes',
			stem + 'eram'
		];
		t['pretérito imperfeito do indicativo'] = [
			stem + 'ia',
			stem + 'ias',
			stem + 'ia',
			stem + 'íamos',
			stem + 'íeis',
			stem + 'iam'
		];
		t['pretérito mais-que-perfeito do indicativo'] = [
			stem + 'era',
			stem + 'eras',
			stem + 'era',
			stem + 'êramos',
			stem + 'êreis',
			stem + 'eram'
		];
		t['futuro do indicativo'] = [
			verb + 'ei',
			verb + 'ás',
			verb + 'á',
			verb + 'emos',
			verb + 'eis',
			verb + 'ão'
		];
		t['condicional'] = [
			verb + 'ia',
			verb + 'ias',
			verb + 'ia',
			verb + 'íamos',
			verb + 'íeis',
			verb + 'iam'
		];
		t['presente do conjuntivo'] = [
			stem + 'a',
			stem + 'as',
			stem + 'a',
			stem + 'amos',
			stem + 'ais',
			stem + 'am'
		];
		t['pretérito imperfeito do conjuntivo'] = [
			stem + 'esse',
			stem + 'esses',
			stem + 'esse',
			stem + 'êssemos',
			stem + 'êsseis',
			stem + 'essem'
		];
		t['futuro do conjuntivo'] = [
			stem + 'er',
			stem + 'eres',
			stem + 'er',
			stem + 'ermos',
			stem + 'erdes',
			stem + 'erem'
		];
		t['imperativo afirmativo'] = [
			'',
			stem + 'e',
			stem + 'a',
			stem + 'amos',
			stem + 'ei',
			stem + 'am'
		];
		t['imperativo negativo'] = [
			'',
			stem + 'as',
			stem + 'a',
			stem + 'amos',
			stem + 'ais',
			stem + 'am'
		];
		t['infinitivo pessoal'] = [
			stem + 'er',
			stem + 'eres',
			stem + 'er',
			stem + 'ermos',
			stem + 'erdes',
			stem + 'erem'
		];
	}
	// -ir verbs not used in regular generation for this dataset;
	// future-proof: could be added here.

	return { [verb]: t };
}

// ─── Conjugation tables ──────────────────────────────────────────────────────

type ConjTable = Record<string, Record<string, string[]>>;

const CONJUGATIONS: ConjTable = {
	// ─── Regular -ar verbs (generated) ─────────────────────────────────────
	...generateConjugations('falar', 'ar'),
	...generateConjugations('passar', 'ar'),
	...generateConjugations('deixar', 'ar'),
	...generateConjugations('encontrar', 'ar'),
	...generateConjugations('pensar', 'ar'),
	...generateConjugations('levar', 'ar'),
	...generateConjugations('usar', 'ar'),
	...generateConjugations('trabalhar', 'ar'),
	...generateConjugations('gostar', 'ar'),
	...generateConjugations('precisar', 'ar'),
	...generateConjugations('chamar', 'ar'),

	// ─── Regular -ar with spelling changes ────────────────────────────────
	...generateConjugations('chegar', 'ar', 'gar'),
	...generateConjugations('ficar', 'ar', 'car'),
	...generateConjugations('começar', 'ar', 'çar'),

	// ─── Regular -er ─────────────────────────────────────────────────────
	...generateConjugations('dever', 'er'),

	// ═══════════════════════════════════════════════════════════════════════
	// ─── IRREGULAR VERBS ───────────────────────────────────────────────────
	// ═══════════════════════════════════════════════════════════════════════

	// ─── SER (to be) ──────────────────────────────────────────────────────────
	ser: {
		'presente do indicativo': ['sou', 'és', 'é', 'somos', 'sois', 'são'],
		'pretérito perfeito do indicativo': ['fui', 'foste', 'foi', 'fomos', 'fostes', 'foram'],
		'pretérito imperfeito do indicativo': ['era', 'eras', 'era', 'éramos', 'éreis', 'eram'],
		'pretérito mais-que-perfeito do indicativo': [
			'fora',
			'foras',
			'fora',
			'fôramos',
			'fôreis',
			'foram'
		],
		'futuro do indicativo': ['serei', 'serás', 'será', 'seremos', 'sereis', 'serão'],
		condicional: ['seria', 'serias', 'seria', 'seríamos', 'seríeis', 'seriam'],
		'presente do conjuntivo': ['seja', 'sejas', 'seja', 'sejamos', 'sejais', 'sejam'],
		'pretérito imperfeito do conjuntivo': [
			'fosse',
			'fosses',
			'fosse',
			'fôssemos',
			'fôsseis',
			'fossem'
		],
		'futuro do conjuntivo': ['for', 'fores', 'for', 'formos', 'fordes', 'forem'],
		'imperativo afirmativo': ['', 'sê', 'seja', 'sejamos', 'sede', 'sejam'],
		'imperativo negativo': ['', 'sejas', 'seja', 'sejamos', 'sejais', 'sejam'],
		'infinitivo pessoal': ['ser', 'seres', 'ser', 'sermos', 'serdes', 'serem']
	},

	// ─── ESTAR (to be) ────────────────────────────────────────────────────────
	estar: {
		'presente do indicativo': ['estou', 'estás', 'está', 'estamos', 'estais', 'estão'],
		'pretérito perfeito do indicativo': [
			'estive',
			'estiveste',
			'esteve',
			'estivemos',
			'estivestes',
			'estiveram'
		],
		'pretérito imperfeito do indicativo': [
			'estava',
			'estavas',
			'estava',
			'estávamos',
			'estáveis',
			'estavam'
		],
		'pretérito mais-que-perfeito do indicativo': [
			'estivera',
			'estiveras',
			'estivera',
			'estivéramos',
			'estivéreis',
			'estiveram'
		],
		'futuro do indicativo': ['estarei', 'estarás', 'estará', 'estaremos', 'estareis', 'estarão'],
		condicional: ['estaria', 'estarias', 'estaria', 'estaríamos', 'estaríeis', 'estariam'],
		'presente do conjuntivo': ['esteja', 'estejas', 'esteja', 'estejamos', 'estejais', 'estejam'],
		'pretérito imperfeito do conjuntivo': [
			'estivesse',
			'estivesses',
			'estivesse',
			'estivéssemos',
			'estivésseis',
			'estivessem'
		],
		'futuro do conjuntivo': [
			'estiver',
			'estiveres',
			'estiver',
			'estivermos',
			'estiverdes',
			'estiverem'
		],
		'imperativo afirmativo': ['', 'está', 'esteja', 'estejamos', 'estai', 'estejam'],
		'imperativo negativo': ['', 'estejas', 'esteja', 'estejamos', 'estejais', 'estejam'],
		'infinitivo pessoal': ['estar', 'estares', 'estar', 'estarmos', 'estardes', 'estarem']
	},

	// ─── TER (to have) ────────────────────────────────────────────────────────
	ter: {
		'presente do indicativo': ['tenho', 'tens', 'tem', 'temos', 'tendes', 'têm'],
		'pretérito perfeito do indicativo': [
			'tive',
			'tiveste',
			'teve',
			'tivemos',
			'tivestes',
			'tiveram'
		],
		'pretérito imperfeito do indicativo': [
			'tinha',
			'tinhas',
			'tinha',
			'tínhamos',
			'tínheis',
			'tinham'
		],
		'pretérito mais-que-perfeito do indicativo': [
			'tivera',
			'tiveras',
			'tivera',
			'tivéramos',
			'tivéreis',
			'tiveram'
		],
		'futuro do indicativo': ['terei', 'terás', 'terá', 'teremos', 'tereis', 'terão'],
		condicional: ['teria', 'terias', 'teria', 'teríamos', 'teríeis', 'teriam'],
		'presente do conjuntivo': ['tenha', 'tenhas', 'tenha', 'tenhamos', 'tenhais', 'tenham'],
		'pretérito imperfeito do conjuntivo': [
			'tivesse',
			'tivesses',
			'tivesse',
			'tivéssemos',
			'tivésseis',
			'tivessem'
		],
		'futuro do conjuntivo': ['tiver', 'tiveres', 'tiver', 'tivermos', 'tiverdes', 'tiverem'],
		'imperativo afirmativo': ['', 'tem', 'tenha', 'tenhamos', 'tende', 'tenham'],
		'imperativo negativo': ['', 'tenhas', 'tenha', 'tenhamos', 'tenhais', 'tenham'],
		'infinitivo pessoal': ['ter', 'teres', 'ter', 'termos', 'terdes', 'terem']
	},

	// ─── HAVER (to have / there to be) ─────────────────────────────────────────
	haver: {
		'presente do indicativo': ['hei', 'hás', 'há', 'havemos', 'haveis', 'hão'],
		'pretérito perfeito do indicativo': [
			'houve',
			'houveste',
			'houve',
			'houvemos',
			'houvestes',
			'houveram'
		],
		'pretérito imperfeito do indicativo': [
			'havia',
			'havias',
			'havia',
			'havíamos',
			'havíeis',
			'haviam'
		],
		'pretérito mais-que-perfeito do indicativo': [
			'houvera',
			'houveras',
			'houvera',
			'houvéramos',
			'houvéreis',
			'houveram'
		],
		'futuro do indicativo': ['haverei', 'haverás', 'haverá', 'haveremos', 'havereis', 'haverão'],
		condicional: ['haveria', 'haverias', 'haveria', 'haveríamos', 'haveríeis', 'haveriam'],
		'presente do conjuntivo': ['haja', 'hajas', 'haja', 'hajamos', 'hajais', 'hajam'],
		'pretérito imperfeito do conjuntivo': [
			'houvesse',
			'houvesses',
			'houvesse',
			'houvéssemos',
			'houvésseis',
			'houvessem'
		],
		'futuro do conjuntivo': ['houver', 'houveres', 'houver', 'houvermos', 'houverdes', 'houverem'],
		'imperativo afirmativo': ['', 'há', 'haja', 'hajamos', 'havei', 'hajam'],
		'imperativo negativo': ['', 'hajas', 'haja', 'hajamos', 'hajais', 'hajam'],
		'infinitivo pessoal': ['haver', 'haveres', 'haver', 'havermos', 'haverdes', 'haverem']
	},

	// ─── FAZER (to do/make) ───────────────────────────────────────────────────
	fazer: {
		'presente do indicativo': ['faço', 'fazes', 'faz', 'fazemos', 'fazeis', 'fazem'],
		'pretérito perfeito do indicativo': ['fiz', 'fizeste', 'fez', 'fizemos', 'fizestes', 'fizeram'],
		'pretérito imperfeito do indicativo': [
			'fazia',
			'fazias',
			'fazia',
			'fazíamos',
			'fazíeis',
			'faziam'
		],
		'pretérito mais-que-perfeito do indicativo': [
			'fizera',
			'fizeras',
			'fizera',
			'fizéramos',
			'fizéreis',
			'fizeram'
		],
		'futuro do indicativo': ['farei', 'farás', 'fará', 'faremos', 'fareis', 'farão'],
		condicional: ['faria', 'farias', 'faria', 'faríamos', 'faríeis', 'fariam'],
		'presente do conjuntivo': ['faça', 'faças', 'faça', 'façamos', 'façais', 'façam'],
		'pretérito imperfeito do conjuntivo': [
			'fizesse',
			'fizesses',
			'fizesse',
			'fizéssemos',
			'fizésseis',
			'fizessem'
		],
		'futuro do conjuntivo': ['fizer', 'fizeres', 'fizer', 'fizermos', 'fizerdes', 'fizerem'],
		'imperativo afirmativo': ['', 'faz', 'faça', 'façamos', 'fazei', 'façam'],
		'imperativo negativo': ['', 'faças', 'faça', 'façamos', 'façais', 'façam'],
		'infinitivo pessoal': ['fazer', 'fazeres', 'fazer', 'fazermos', 'fazerdes', 'fazerem']
	},

	// ─── IR (to go) ───────────────────────────────────────────────────────────
	ir: {
		'presente do indicativo': ['vou', 'vais', 'vai', 'vamos', 'ides', 'vão'],
		'pretérito perfeito do indicativo': ['fui', 'foste', 'foi', 'fomos', 'fostes', 'foram'],
		'pretérito imperfeito do indicativo': ['ia', 'ias', 'ia', 'íamos', 'íeis', 'iam'],
		'pretérito mais-que-perfeito do indicativo': [
			'fora',
			'foras',
			'fora',
			'fôramos',
			'fôreis',
			'foram'
		],
		'futuro do indicativo': ['irei', 'irás', 'irá', 'iremos', 'ireis', 'irão'],
		condicional: ['iria', 'irias', 'iria', 'iríamos', 'iríeis', 'iriam'],
		'presente do conjuntivo': ['vá', 'vás', 'vá', 'vamos', 'vades', 'vão'],
		'pretérito imperfeito do conjuntivo': [
			'fosse',
			'fosses',
			'fosse',
			'fôssemos',
			'fôsseis',
			'fossem'
		],
		'futuro do conjuntivo': ['for', 'fores', 'for', 'formos', 'fordes', 'forem'],
		'imperativo afirmativo': ['', 'vai', 'vá', 'vamos', 'ide', 'vão'],
		'imperativo negativo': ['', 'vás', 'vá', 'vamos', 'vades', 'vão'],
		'infinitivo pessoal': ['ir', 'ires', 'ir', 'irmos', 'irdes', 'irem']
	},

	// ─── VIR (to come) ────────────────────────────────────────────────────────
	vir: {
		'presente do indicativo': ['venho', 'vens', 'vem', 'vimos', 'vindes', 'vêm'],
		'pretérito perfeito do indicativo': ['vim', 'vieste', 'veio', 'viemos', 'viestes', 'vieram'],
		'pretérito imperfeito do indicativo': [
			'vinha',
			'vinhas',
			'vinha',
			'vínhamos',
			'vínheis',
			'vinham'
		],
		'pretérito mais-que-perfeito do indicativo': [
			'viera',
			'vieras',
			'viera',
			'viéramos',
			'viéreis',
			'vieram'
		],
		'futuro do indicativo': ['virei', 'virás', 'virá', 'viremos', 'vireis', 'virão'],
		condicional: ['viria', 'virias', 'viria', 'viríamos', 'viríeis', 'viriam'],
		'presente do conjuntivo': ['venha', 'venhas', 'venha', 'venhamos', 'venhais', 'venham'],
		'pretérito imperfeito do conjuntivo': [
			'viesse',
			'viesses',
			'viesse',
			'viéssemos',
			'viésseis',
			'viessem'
		],
		'futuro do conjuntivo': ['vier', 'vieres', 'vier', 'viermos', 'vierdes', 'vierem'],
		'imperativo afirmativo': ['', 'vem', 'venha', 'venhamos', 'vinde', 'venham'],
		'imperativo negativo': ['', 'venhas', 'venha', 'venhamos', 'venhais', 'venham'],
		'infinitivo pessoal': ['vir', 'vires', 'vir', 'virmos', 'virdes', 'virem']
	},

	// ─── DIZER (to say) ───────────────────────────────────────────────────────
	dizer: {
		'presente do indicativo': ['digo', 'dizes', 'diz', 'dizemos', 'dizeis', 'dizem'],
		'pretérito perfeito do indicativo': [
			'disse',
			'disseste',
			'disse',
			'dissemos',
			'dissestes',
			'disseram'
		],
		'pretérito imperfeito do indicativo': [
			'dizia',
			'dizias',
			'dizia',
			'dizíamos',
			'dizíeis',
			'diziam'
		],
		'pretérito mais-que-perfeito do indicativo': [
			'dissera',
			'disseras',
			'dissera',
			'disséramos',
			'disséreis',
			'disseram'
		],
		'futuro do indicativo': ['direi', 'dirás', 'dirá', 'diremos', 'direis', 'dirão'],
		condicional: ['diria', 'dirias', 'diria', 'diríamos', 'diríeis', 'diriam'],
		'presente do conjuntivo': ['diga', 'digas', 'diga', 'digamos', 'digais', 'digam'],
		'pretérito imperfeito do conjuntivo': [
			'dissesse',
			'dissesses',
			'dissesse',
			'disséssemos',
			'dissésseis',
			'dissessem'
		],
		'futuro do conjuntivo': ['disser', 'disseres', 'disser', 'dissermos', 'disserdes', 'disserem'],
		'imperativo afirmativo': ['', 'diz', 'diga', 'digamos', 'dizei', 'digam'],
		'imperativo negativo': ['', 'digas', 'diga', 'digamos', 'digais', 'digam'],
		'infinitivo pessoal': ['dizer', 'dizeres', 'dizer', 'dizermos', 'dizerdes', 'dizerem']
	},

	// ─── PODER (to be able) ───────────────────────────────────────────────────
	poder: {
		'presente do indicativo': ['posso', 'podes', 'pode', 'podemos', 'podeis', 'podem'],
		'pretérito perfeito do indicativo': [
			'pude',
			'pudeste',
			'pôde',
			'pudemos',
			'pudestes',
			'puderam'
		],
		'pretérito imperfeito do indicativo': [
			'podia',
			'podias',
			'podia',
			'podíamos',
			'podíeis',
			'podiam'
		],
		'pretérito mais-que-perfeito do indicativo': [
			'pudera',
			'puderas',
			'pudera',
			'pudéramos',
			'pudéreis',
			'puderam'
		],
		'futuro do indicativo': ['poderei', 'poderás', 'poderá', 'poderemos', 'podereis', 'poderão'],
		condicional: ['poderia', 'poderias', 'poderia', 'poderíamos', 'poderíeis', 'poderiam'],
		'presente do conjuntivo': ['possa', 'possas', 'possa', 'possamos', 'possais', 'possam'],
		'pretérito imperfeito do conjuntivo': [
			'pudesse',
			'pudesses',
			'pudesse',
			'pudéssemos',
			'pudésseis',
			'pudessem'
		],
		'futuro do conjuntivo': ['puder', 'puderes', 'puder', 'pudermos', 'puderdes', 'puderem'],
		'imperativo afirmativo': ['', 'pode', 'possa', 'possamos', 'podei', 'possam'],
		'imperativo negativo': ['', 'possas', 'possa', 'possamos', 'possais', 'possam'],
		'infinitivo pessoal': ['poder', 'poderes', 'poder', 'podermos', 'poderdes', 'poderem']
	},

	// ─── QUERER (to want) ─────────────────────────────────────────────────────
	querer: {
		'presente do indicativo': ['quero', 'queres', 'quer', 'queremos', 'quereis', 'querem'],
		'pretérito perfeito do indicativo': [
			'quis',
			'quiseste',
			'quis',
			'quisemos',
			'quisestes',
			'quiseram'
		],
		'pretérito imperfeito do indicativo': [
			'queria',
			'querias',
			'queria',
			'queríamos',
			'queríeis',
			'queriam'
		],
		'pretérito mais-que-perfeito do indicativo': [
			'quisera',
			'quiseras',
			'quisera',
			'quiséramos',
			'quiséreis',
			'quiseram'
		],
		'futuro do indicativo': [
			'quererei',
			'quererás',
			'quererá',
			'quereremos',
			'querereis',
			'quererão'
		],
		condicional: ['quereria', 'quererias', 'quereria', 'quereríamos', 'quereríeis', 'quereriam'],
		'presente do conjuntivo': ['queira', 'queiras', 'queira', 'queiramos', 'queirais', 'queiram'],
		'pretérito imperfeito do conjuntivo': [
			'quisesse',
			'quisesses',
			'quisesse',
			'quiséssemos',
			'quisésseis',
			'quisessem'
		],
		'futuro do conjuntivo': ['quiser', 'quiseres', 'quiser', 'quisermos', 'quiserdes', 'quiserem'],
		'imperativo afirmativo': ['', 'quer', 'queira', 'queiramos', 'querei', 'queiram'],
		'imperativo negativo': ['', 'queiras', 'queira', 'queiramos', 'queirais', 'queiram'],
		'infinitivo pessoal': ['querer', 'quereres', 'querer', 'querermos', 'quererdes', 'quererem']
	},

	// ─── SABER (to know) ──────────────────────────────────────────────────────
	saber: {
		'presente do indicativo': ['sei', 'sabes', 'sabe', 'sabemos', 'sabeis', 'sabem'],
		'pretérito perfeito do indicativo': [
			'soube',
			'soubeste',
			'soube',
			'soubemos',
			'soubestes',
			'souberam'
		],
		'pretérito imperfeito do indicativo': [
			'sabia',
			'sabias',
			'sabia',
			'sabíamos',
			'sabíeis',
			'sabiam'
		],
		'pretérito mais-que-perfeito do indicativo': [
			'soubera',
			'souberas',
			'soubera',
			'soubéramos',
			'soubéreis',
			'souberam'
		],
		'futuro do indicativo': ['saberei', 'saberás', 'saberá', 'saberemos', 'sabereis', 'saberão'],
		condicional: ['saberia', 'saberias', 'saberia', 'saberíamos', 'saberíeis', 'saberiam'],
		'presente do conjuntivo': ['saiba', 'saibas', 'saiba', 'saibamos', 'saibais', 'saibam'],
		'pretérito imperfeito do conjuntivo': [
			'soubesse',
			'soubesses',
			'soubesse',
			'soubéssemos',
			'soubésseis',
			'soubessem'
		],
		'futuro do conjuntivo': ['souber', 'souberes', 'souber', 'soubermos', 'souberdes', 'souberem'],
		'imperativo afirmativo': ['', 'sabe', 'saiba', 'saibamos', 'sabei', 'saibam'],
		'imperativo negativo': ['', 'saibas', 'saiba', 'saibamos', 'saibais', 'saibam'],
		'infinitivo pessoal': ['saber', 'saberes', 'saber', 'sabermos', 'saberdes', 'saberem']
	},

	// ─── VER (to see) ─────────────────────────────────────────────────────────
	ver: {
		'presente do indicativo': ['vejo', 'vês', 'vê', 'vemos', 'vedes', 'veem'],
		'pretérito perfeito do indicativo': ['vi', 'viste', 'viu', 'vimos', 'vistes', 'viram'],
		'pretérito imperfeito do indicativo': ['via', 'vias', 'via', 'víamos', 'víeis', 'viam'],
		'pretérito mais-que-perfeito do indicativo': [
			'vira',
			'viras',
			'vira',
			'víramos',
			'víreis',
			'viram'
		],
		'futuro do indicativo': ['verei', 'verás', 'verá', 'veremos', 'vereis', 'verão'],
		condicional: ['veria', 'verias', 'veria', 'veríamos', 'veríeis', 'veriam'],
		'presente do conjuntivo': ['veja', 'vejas', 'veja', 'vejamos', 'vejais', 'vejam'],
		'pretérito imperfeito do conjuntivo': [
			'visse',
			'visses',
			'visse',
			'víssemos',
			'vísseis',
			'vissem'
		],
		'futuro do conjuntivo': ['vir', 'vires', 'vir', 'virmos', 'virdes', 'virem'],
		'imperativo afirmativo': ['', 'vê', 'veja', 'vejamos', 'vede', 'vejam'],
		'imperativo negativo': ['', 'vejas', 'veja', 'vejamos', 'vejais', 'vejam'],
		'infinitivo pessoal': ['ver', 'veres', 'ver', 'vermos', 'verdes', 'verem']
	},

	// ─── DAR (to give) ────────────────────────────────────────────────────────
	dar: {
		'presente do indicativo': ['dou', 'dás', 'dá', 'damos', 'dais', 'dão'],
		'pretérito perfeito do indicativo': ['dei', 'deste', 'deu', 'demos', 'destes', 'deram'],
		'pretérito imperfeito do indicativo': ['dava', 'davas', 'dava', 'dávamos', 'dáveis', 'davam'],
		'pretérito mais-que-perfeito do indicativo': [
			'dera',
			'deras',
			'dera',
			'déramos',
			'déreis',
			'deram'
		],
		'futuro do indicativo': ['darei', 'darás', 'dará', 'daremos', 'dareis', 'darão'],
		condicional: ['daria', 'darias', 'daria', 'daríamos', 'daríeis', 'dariam'],
		'presente do conjuntivo': ['dê', 'dês', 'dê', 'demos', 'deis', 'deem'],
		'pretérito imperfeito do conjuntivo': [
			'desse',
			'desses',
			'desse',
			'déssemos',
			'désseis',
			'dessem'
		],
		'futuro do conjuntivo': ['der', 'deres', 'der', 'dermos', 'derdes', 'derem'],
		'imperativo afirmativo': ['', 'dá', 'dê', 'demos', 'dai', 'deem'],
		'imperativo negativo': ['', 'dês', 'dê', 'demos', 'deis', 'deem'],
		'infinitivo pessoal': ['dar', 'dares', 'dar', 'darmos', 'dardes', 'darem']
	},

	// ─── PARECER (to seem) ────────────────────────────────────────────────────
	parecer: {
		'presente do indicativo': ['pareço', 'pareces', 'parece', 'parecemos', 'pareceis', 'parecem'],
		'pretérito perfeito do indicativo': [
			'pareci',
			'pareceste',
			'pareceu',
			'parecemos',
			'parecestes',
			'pareceram'
		],
		'pretérito imperfeito do indicativo': [
			'parecia',
			'parecias',
			'parecia',
			'parecíamos',
			'parecíeis',
			'pareciam'
		],
		'pretérito mais-que-perfeito do indicativo': [
			'parecera',
			'pareceras',
			'parecera',
			'parecêramos',
			'parecêreis',
			'pareceram'
		],
		'futuro do indicativo': [
			'parecerei',
			'parecerás',
			'parecerá',
			'pareceremos',
			'parecereis',
			'parecerão'
		],
		condicional: [
			'pareceria',
			'parecerias',
			'pareceria',
			'pareceríamos',
			'pareceríeis',
			'pareceriam'
		],
		'presente do conjuntivo': ['pareça', 'pareças', 'pareça', 'pareçamos', 'pareçais', 'pareçam'],
		'pretérito imperfeito do conjuntivo': [
			'parecesse',
			'parecesses',
			'parecesse',
			'parecêssemos',
			'parecêsseis',
			'parecessem'
		],
		'futuro do conjuntivo': [
			'parecer',
			'pareceres',
			'parecer',
			'parecermos',
			'parecerdes',
			'parecerem'
		],
		'imperativo afirmativo': ['', 'parece', 'pareça', 'pareçamos', 'parecei', 'pareçam'],
		'imperativo negativo': ['', 'pareças', 'pareça', 'pareçamos', 'pareçais', 'pareçam'],
		'infinitivo pessoal': [
			'parecer',
			'pareceres',
			'parecer',
			'parecermos',
			'parecerdes',
			'parecerem'
		]
	},

	// ─── PÔR (to put) ─────────────────────────────────────────────────────────
	pôr: {
		'presente do indicativo': ['ponho', 'pões', 'põe', 'pomos', 'pondes', 'põem'],
		'pretérito perfeito do indicativo': ['pus', 'puseste', 'pôs', 'pusemos', 'pusestes', 'puseram'],
		'pretérito imperfeito do indicativo': [
			'punha',
			'punhas',
			'punha',
			'púnhamos',
			'púnheis',
			'punham'
		],
		'pretérito mais-que-perfeito do indicativo': [
			'pusera',
			'puseras',
			'pusera',
			'puséramos',
			'puséreis',
			'puseram'
		],
		'futuro do indicativo': ['porei', 'porás', 'porá', 'poremos', 'poreis', 'porão'],
		condicional: ['poria', 'porias', 'poria', 'poríamos', 'poríeis', 'poriam'],
		'presente do conjuntivo': ['ponha', 'ponhas', 'ponha', 'ponhamos', 'ponhais', 'ponham'],
		'pretérito imperfeito do conjuntivo': [
			'pusesse',
			'pusesses',
			'pusesse',
			'puséssemos',
			'pusésseis',
			'pusessem'
		],
		'futuro do conjuntivo': ['puser', 'puseres', 'puser', 'pusermos', 'puserdes', 'puserem'],
		'imperativo afirmativo': ['', 'põe', 'ponha', 'ponhamos', 'ponde', 'ponham'],
		'imperativo negativo': ['', 'ponhas', 'ponha', 'ponhamos', 'ponhais', 'ponham'],
		'infinitivo pessoal': ['pôr', 'pores', 'pôr', 'pormos', 'pordes', 'porem']
	}
};

// ─── English translations ─────────────────────────────────────────────────────

interface EnVerbInfo {
	base: string;
	past: string;
	pp: string;
	third: string;
	ing: string;
}

const EN_VERB_INFO: Record<string, EnVerbInfo> = {
	ser: { base: 'be', past: 'was/were', pp: 'been', third: 'is', ing: 'being' },
	estar: { base: 'be', past: 'was/were', pp: 'been', third: 'is', ing: 'being' },
	ter: { base: 'have', past: 'had', pp: 'had', third: 'has', ing: 'having' },
	haver: { base: 'have', past: 'had', pp: 'had', third: 'has', ing: 'having' },
	fazer: {
		base: 'do/make',
		past: 'did/made',
		pp: 'done/made',
		third: 'does/makes',
		ing: 'doing/making'
	},
	ir: { base: 'go', past: 'went', pp: 'gone', third: 'goes', ing: 'going' },
	vir: { base: 'come', past: 'came', pp: 'come', third: 'comes', ing: 'coming' },
	dizer: { base: 'say', past: 'said', pp: 'said', third: 'says', ing: 'saying' },
	poder: { base: 'be able', past: 'could', pp: 'been able', third: 'can', ing: 'being able' },
	querer: { base: 'want', past: 'wanted', pp: 'wanted', third: 'wants', ing: 'wanting' },
	saber: { base: 'know', past: 'knew', pp: 'known', third: 'knows', ing: 'knowing' },
	ver: { base: 'see', past: 'saw', pp: 'seen', third: 'sees', ing: 'seeing' },
	dar: { base: 'give', past: 'gave', pp: 'given', third: 'gives', ing: 'giving' },
	falar: { base: 'speak', past: 'spoke', pp: 'spoken', third: 'speaks', ing: 'speaking' },
	chegar: { base: 'arrive', past: 'arrived', pp: 'arrived', third: 'arrives', ing: 'arriving' },
	passar: { base: 'pass', past: 'passed', pp: 'passed', third: 'passes', ing: 'passing' },
	dever: { base: 'must/have to', past: 'had to', pp: 'had to', third: 'must', ing: 'having to' },
	ficar: { base: 'stay', past: 'stayed', pp: 'stayed', third: 'stays', ing: 'staying' },
	deixar: { base: 'leave/let', past: 'left', pp: 'left', third: 'leaves', ing: 'leaving' },
	encontrar: { base: 'find', past: 'found', pp: 'found', third: 'finds', ing: 'finding' },
	pensar: { base: 'think', past: 'thought', pp: 'thought', third: 'thinks', ing: 'thinking' },
	levar: { base: 'take/carry', past: 'took', pp: 'taken', third: 'takes', ing: 'taking' },
	começar: {
		base: 'start/begin',
		past: 'started',
		pp: 'started',
		third: 'starts',
		ing: 'starting'
	},
	parecer: { base: 'seem', past: 'seemed', pp: 'seemed', third: 'seems', ing: 'seeming' },
	usar: { base: 'use', past: 'used', pp: 'used', third: 'uses', ing: 'using' },
	trabalhar: { base: 'work', past: 'worked', pp: 'worked', third: 'works', ing: 'working' },
	gostar: { base: 'like', past: 'liked', pp: 'liked', third: 'likes', ing: 'liking' },
	precisar: { base: 'need', past: 'needed', pp: 'needed', third: 'needs', ing: 'needing' },
	chamar: { base: 'call', past: 'called', pp: 'called', third: 'calls', ing: 'calling' },
	pôr: { base: 'put', past: 'put', pp: 'put', third: 'puts', ing: 'putting' }
};

const EN_PRONOUN: Record<string, string> = {
	eu: 'I',
	tu: 'you',
	'ele/ela/você': 'he/she/you',
	nós: 'we',
	vós: 'you all',
	'eles/elas/vocês': 'they/you all'
};

function enTranslate(verb: string, tense: string, person: string): string {
	const pro = EN_PRONOUN[person] || person;
	const info = EN_VERB_INFO[verb];

	// Distinguish ser vs estar
	const verbTag = verb === 'ser' ? '(ser)' : verb === 'estar' ? '(estar)' : '';

	switch (tense) {
		case 'presente do indicativo': {
			if (verb === 'ser' || verb === 'estar') {
				if (person === 'eu') return `I am ${verbTag}`.trim();
				if (person === 'tu') return `you are ${verbTag}`.trim();
				if (person === 'ele/ela/você') return `he/she is ${verbTag}`.trim();
				if (person === 'nós') return `we are ${verbTag}`.trim();
				if (person === 'vós') return `you all are ${verbTag}`.trim();
				return `they/you all are ${verbTag}`.trim();
			}
			return `${pro} ${info.base}`;
		}
		case 'pretérito perfeito do indicativo':
			return `${pro} ${info.past}`;
		case 'pretérito imperfeito do indicativo': {
			if (verb === 'ser' || verb === 'estar') {
				if (person === 'eu') return `I was ${verbTag}`.trim();
				if (person === 'ele/ela/você') return `he/she was ${verbTag}`.trim();
				return `${pro} were ${verbTag}`.trim();
			}
			return `${pro} used to ${info.base}`;
		}
		case 'pretérito mais-que-perfeito do indicativo':
			return `${pro} had ${info.pp}`;
		case 'futuro do indicativo':
			return `${pro} will ${info.base}`;
		case 'condicional':
			return `${pro} would ${info.base}`;
		case 'presente do conjuntivo':
			return `(that) ${pro} ${info.base}`;
		case 'pretérito imperfeito do conjuntivo':
			return `(that) ${pro} ${info.past}`;
		case 'futuro do conjuntivo':
			return `(if) ${pro} ${info.base}`;
		case 'imperativo afirmativo': {
			if (person === 'eu') return `(I) —`;
			if (person === 'tu') return `(${pro}) ${info.base}!`;
			if (person === 'ele/ela/você') return `(he/she/you) ${info.base}!`;
			if (person === 'nós') return `let's ${info.base}!`;
			if (person === 'vós') return `(you all) ${info.base}!`;
			return `(they/you all) ${info.base}!`;
		}
		case 'imperativo negativo': {
			if (person === 'eu') return `(I) —`;
			return `don't ${info.base}!`;
		}
		case 'infinitivo pessoal':
			return `(personal) to ${info.base}`;
		case 'infinitivo impessoal':
			return `to ${info.base}`;
		case 'gerúndio':
			return `${info.ing}`;
		case 'particípio passado':
			return `${info.pp}`;
	}
	return `${pro} ${info.base}`;
}

// ─── Build conjugation map ───────────────────────────────────────────────────

export function buildConjugationMap(): ConjugationMap {
	const map: ConjugationMap = new Map();

	for (const verb of ALL_VERBS) {
		for (const tense of ALL_TENSES) {
			for (let pIdx = 0; pIdx < ALL_PERSONS.length; pIdx++) {
				const person = ALL_PERSONS[pIdx];
				let conjugation: string;

				if (tense === 'infinitivo impessoal') {
					conjugation = verb;
				} else if (tense === 'gerúndio') {
					conjugation = GERUND[verb] || '';
				} else if (tense === 'particípio passado') {
					conjugation = PAST_PARTICIPLE[verb] || '';
				} else {
					const verbTense = CONJUGATIONS[verb]?.[tense];
					conjugation = verbTense?.[pIdx] ?? '';
				}

				const translation = enTranslate(verb, tense, person);
				const key = `${verb}:${tense}:${person}`;

				map.set(key, {
					verb,
					tense,
					person,
					conjugation,
					translation
				});
			}
		}
	}

	return map;
}

export const conjugationMap: ConjugationMap = buildConjugationMap();

// ─── Portuguese extractConjugation ────────────────────────────────────────────

/**
 * Extract conjugation from user input for Portuguese.
 * Handles slash variants like:
 * - "ele/ela/você" → accepts "ele", "ela", "você", "ele/ela/você", etc.
 * - "eles/elas/vocês" → accepts "eles", "elas", "vocês", etc.
 */
function portugueseExtractConjugation(input: string, expectedPersonLabel: string): string | null {
	const normalized = input.trim().toLowerCase();
	const label = expectedPersonLabel.toLowerCase();

	// Try exact label match first
	if (normalized.startsWith(label + ' ')) {
		return normalized.slice(label.length).trim();
	}
	if (normalized === label) {
		return '';
	}

	// Handle variants with "/"
	if (label.includes('/')) {
		const variants = label.split('/');

		// Try each variant individually
		for (const variant of variants) {
			const v = variant.trim();
			if (normalized.startsWith(v + ' ')) {
				return normalized.slice(v.length).trim();
			}
			if (normalized === v) {
				return '';
			}
		}

		// Try variants joined with space
		const spaceJoined = variants.join(' ');
		if (normalized.startsWith(spaceJoined + ' ')) {
			return normalized.slice(spaceJoined.length).trim();
		}
		if (normalized === spaceJoined) {
			return '';
		}

		// Try variants joined with space but only first two (for 3-way splits)
		if (variants.length === 3) {
			const firstTwo = variants.slice(0, 2).join(' ');
			if (normalized.startsWith(firstTwo + ' ')) {
				return normalized.slice(firstTwo.length).trim();
			}
			if (normalized === firstTwo) {
				return '';
			}
		}
	}

	return null;
}

// ─── Default selections ──────────────────────────────────────────────────────

const DEFAULT_VERBS_PT: string[] = [
	'ser',
	'estar',
	'ter',
	'haver',
	'fazer',
	'ir',
	'vir',
	'dizer',
	'poder',
	'querer',
	'saber',
	'ver',
	'dar',
	'falar',
	'chegar',
	'passar',
	'dever',
	'ficar',
	'deixar',
	'encontrar',
	'pensar',
	'levar',
	'começar',
	'parecer',
	'usar'
];

const DEFAULT_TENSES_PT: string[] = [
	'presente do indicativo',
	'pretérito perfeito do indicativo',
	'pretérito imperfeito do indicativo',
	'futuro do indicativo',
	'presente do conjuntivo'
];

// ─── Portuguese LanguageModule ───────────────────────────────────────────────

export const portugueseModule: LanguageModule = {
	id: 'portuguese',
	flag: '🇵🇹',
	name: 'Portuguese',
	displayName: 'Português',
	VERB_LIST: ALL_VERBS,
	TENSE_LIST: ALL_TENSES,
	PERSON_LABELS: ALL_PERSONS,
	conjugationMap,
	DEFAULT_VERBS: DEFAULT_VERBS_PT,
	DEFAULT_TENSES: DEFAULT_TENSES_PT,
	ui: {
		coverage: 'Cobertura',
		accuracy: 'Precisão',
		conjugation: 'Conjugação',
		history: 'Histórico',
		verb: 'Verbos',
		tense: 'Tempos'
	},
	extractConjugation: portugueseExtractConjugation
};
