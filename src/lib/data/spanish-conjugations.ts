import type { LanguageModule, ConjugationMap, ConjugationEntry } from './language-registry';

// ─── Spanish Data ────────────────────────────────────────────────────────────

const ALL_PERSONS = [
	'yo',
	'tú',
	'él/ella',
	'nosotros/nosotras',
	'vosotros/vosotras',
	'ellos/ellas'
] as const;

const ALL_TENSES = [
	'presente',
	'pretérito perfecto',
	'imperfecto',
	'pretérito indefinido',
	'pretérito pluscuamperfecto',
	'pretérito anterior',
	'futuro simple',
	'futuro perfecto',
	'condicional simple',
	'condicional perfecto',
	'subjuntivo presente',
	'subjuntivo imperfecto',
	'subjuntivo pretérito perfecto',
	'subjuntivo pluscuamperfecto',
	'imperativo',
	'infinitivo simple',
	'infinitivo compuesto',
	'gerundio simple',
	'gerundio compuesto',
	'participio'
] as const;

const ALL_VERBS = [
	'ser',
	'estar',
	'tener',
	'hacer',
	'ir',
	'poder',
	'decir',
	'ver',
	'dar',
	'saber',
	'querer',
	'llegar',
	'pasar',
	'deber',
	'poner',
	'parecer',
	'quedar',
	'creer',
	'hablar',
	'llevar',
	'dejar',
	'seguir',
	'encontrar',
	'llamar',
	'venir',
	'pensar',
	'salir',
	'volver',
	'tomar',
	'conocer'
] as const;

// ─── Past participles ────────────────────────────────────────────────────────

const PAST_PARTICIPLE: Record<string, string> = {
	ser: 'sido',
	estar: 'estado',
	tener: 'tenido',
	hacer: 'hecho',
	ir: 'ido',
	poder: 'podido',
	decir: 'dicho',
	ver: 'visto',
	dar: 'dado',
	saber: 'sabido',
	querer: 'querido',
	llegar: 'llegado',
	pasar: 'pasado',
	deber: 'debido',
	poner: 'puesto',
	parecer: 'parecido',
	quedar: 'quedado',
	creer: 'creído',
	hablar: 'hablado',
	llevar: 'llevado',
	dejar: 'dejado',
	seguir: 'seguido',
	encontrar: 'encontrado',
	llamar: 'llamado',
	venir: 'venido',
	pensar: 'pensado',
	salir: 'salido',
	volver: 'vuelto',
	tomar: 'tomado',
	conocer: 'conocido'
};

// ─── Gerunds ─────────────────────────────────────────────────────────────────

const GERUNDIO: Record<string, string> = {
	ser: 'siendo',
	estar: 'estando',
	tener: 'teniendo',
	hacer: 'haciendo',
	ir: 'yendo',
	poder: 'pudiendo',
	decir: 'diciendo',
	ver: 'viendo',
	dar: 'dando',
	saber: 'sabiendo',
	querer: 'queriendo',
	llegar: 'llegando',
	pasar: 'pasando',
	deber: 'debiendo',
	poner: 'poniendo',
	parecer: 'pareciendo',
	quedar: 'quedando',
	creer: 'creyendo',
	hablar: 'hablando',
	llevar: 'llevando',
	dejar: 'dejando',
	seguir: 'siguiendo',
	encontrar: 'encontrando',
	llamar: 'llamando',
	venir: 'viniendo',
	pensar: 'pensando',
	salir: 'saliendo',
	volver: 'volviendo',
	tomar: 'tomando',
	conocer: 'conociendo'
};

// ─── Haber (auxiliary) in every needed tense ─────────────────────────────────

const HABER: Record<string, string[]> = {
	presente: ['he', 'has', 'ha', 'hemos', 'habéis', 'han'],
	imperfecto: ['había', 'habías', 'había', 'habíamos', 'habíais', 'habían'],
	'pretérito indefinido': ['hube', 'hubiste', 'hubo', 'hubimos', 'hubisteis', 'hubieron'],
	'futuro simple': ['habré', 'habrás', 'habrá', 'habremos', 'habréis', 'habrán'],
	'condicional simple': ['habría', 'habrías', 'habría', 'habríamos', 'habríais', 'habrían'],
	'subjuntivo presente': ['haya', 'hayas', 'haya', 'hayamos', 'hayáis', 'hayan'],
	'subjuntivo imperfecto': ['hubiera', 'hubieras', 'hubiera', 'hubiéramos', 'hubierais', 'hubieran']
};

// Compound tenses map: tense → haber auxiliary tense
const COMPOUND_TENSE: Record<string, string> = {
	'pretérito perfecto': 'presente',
	'pretérito pluscuamperfecto': 'imperfecto',
	'pretérito anterior': 'pretérito indefinido',
	'futuro perfecto': 'futuro simple',
	'condicional perfecto': 'condicional simple',
	'subjuntivo pretérito perfecto': 'subjuntivo presente',
	'subjuntivo pluscuamperfecto': 'subjuntivo imperfecto'
};

// Non-personal forms that use the same value for all 6 persons
const NON_PERSONAL: Set<string> = new Set([
	'infinitivo simple',
	'infinitivo compuesto',
	'gerundio simple',
	'gerundio compuesto',
	'participio'
]);

// ─── Conjugation tables by verb ──────────────────────────────────────────────

interface ConjTable {
	[verb: string]: {
		[tense: string]: string[]; // indexed by person index 0-5
	};
}

const CONJUGATIONS: ConjTable = {
	// ─── SER ─────────────────────────────────────────────────────────────────
	ser: {
		presente: ['soy', 'eres', 'es', 'somos', 'sois', 'son'],
		imperfecto: ['era', 'eras', 'era', 'éramos', 'erais', 'eran'],
		'pretérito indefinido': ['fui', 'fuiste', 'fue', 'fuimos', 'fuisteis', 'fueron'],
		'futuro simple': ['seré', 'serás', 'será', 'seremos', 'seréis', 'serán'],
		'condicional simple': ['sería', 'serías', 'sería', 'seríamos', 'seríais', 'serían'],
		'subjuntivo presente': ['sea', 'seas', 'sea', 'seamos', 'seáis', 'sean'],
		'subjuntivo imperfecto': ['fuera', 'fueras', 'fuera', 'fuéramos', 'fuerais', 'fueran'],
		imperativo: ['', 'sé', 'sea', 'seamos', 'sed', 'sean']
	},

	// ─── ESTAR ───────────────────────────────────────────────────────────────
	estar: {
		presente: ['estoy', 'estás', 'está', 'estamos', 'estáis', 'están'],
		imperfecto: ['estaba', 'estabas', 'estaba', 'estábamos', 'estabais', 'estaban'],
		'pretérito indefinido': [
			'estuve',
			'estuviste',
			'estuvo',
			'estuvimos',
			'estuvisteis',
			'estuvieron'
		],
		'futuro simple': ['estaré', 'estarás', 'estará', 'estaremos', 'estaréis', 'estarán'],
		'condicional simple': ['estaría', 'estarías', 'estaría', 'estaríamos', 'estaríais', 'estarían'],
		'subjuntivo presente': ['esté', 'estés', 'esté', 'estemos', 'estéis', 'estén'],
		'subjuntivo imperfecto': [
			'estuviera',
			'estuvieras',
			'estuviera',
			'estuviéramos',
			'estuvierais',
			'estuvieran'
		],
		imperativo: ['', 'está', 'esté', 'estemos', 'estad', 'estén']
	},

	// ─── TENER ───────────────────────────────────────────────────────────────
	tener: {
		presente: ['tengo', 'tienes', 'tiene', 'tenemos', 'tenéis', 'tienen'],
		imperfecto: ['tenía', 'tenías', 'tenía', 'teníamos', 'teníais', 'tenían'],
		'pretérito indefinido': ['tuve', 'tuviste', 'tuvo', 'tuvimos', 'tuvisteis', 'tuvieron'],
		'futuro simple': ['tendré', 'tendrás', 'tendrá', 'tendremos', 'tendréis', 'tendrán'],
		'condicional simple': ['tendría', 'tendrías', 'tendría', 'tendríamos', 'tendríais', 'tendrían'],
		'subjuntivo presente': ['tenga', 'tengas', 'tenga', 'tengamos', 'tengáis', 'tengan'],
		'subjuntivo imperfecto': [
			'tuviera',
			'tuvieras',
			'tuviera',
			'tuviéramos',
			'tuvierais',
			'tuvieran'
		],
		imperativo: ['', 'ten', 'tenga', 'tengamos', 'tened', 'tengan']
	},

	// ─── HACER ───────────────────────────────────────────────────────────────
	hacer: {
		presente: ['hago', 'haces', 'hace', 'hacemos', 'hacéis', 'hacen'],
		imperfecto: ['hacía', 'hacías', 'hacía', 'hacíamos', 'hacíais', 'hacían'],
		'pretérito indefinido': ['hice', 'hiciste', 'hizo', 'hicimos', 'hicisteis', 'hicieron'],
		'futuro simple': ['haré', 'harás', 'hará', 'haremos', 'haréis', 'harán'],
		'condicional simple': ['haría', 'harías', 'haría', 'haríamos', 'haríais', 'harían'],
		'subjuntivo presente': ['haga', 'hagas', 'haga', 'hagamos', 'hagáis', 'hagan'],
		'subjuntivo imperfecto': [
			'hiciera',
			'hicieras',
			'hiciera',
			'hiciéramos',
			'hicierais',
			'hicieran'
		],
		imperativo: ['', 'haz', 'haga', 'hagamos', 'haced', 'hagan']
	},

	// ─── IR ──────────────────────────────────────────────────────────────────
	ir: {
		presente: ['voy', 'vas', 'va', 'vamos', 'vais', 'van'],
		imperfecto: ['iba', 'ibas', 'iba', 'íbamos', 'ibais', 'iban'],
		'pretérito indefinido': ['fui', 'fuiste', 'fue', 'fuimos', 'fuisteis', 'fueron'],
		'futuro simple': ['iré', 'irás', 'irá', 'iremos', 'iréis', 'irán'],
		'condicional simple': ['iría', 'irías', 'iría', 'iríamos', 'iríais', 'irían'],
		'subjuntivo presente': ['vaya', 'vayas', 'vaya', 'vayamos', 'vayáis', 'vayan'],
		'subjuntivo imperfecto': ['fuera', 'fueras', 'fuera', 'fuéramos', 'fuerais', 'fueran'],
		imperativo: ['', 've', 'vaya', 'vayamos', 'id', 'vayan']
	},

	// ─── PODER ───────────────────────────────────────────────────────────────
	poder: {
		presente: ['puedo', 'puedes', 'puede', 'podemos', 'podéis', 'pueden'],
		imperfecto: ['podía', 'podías', 'podía', 'podíamos', 'podíais', 'podían'],
		'pretérito indefinido': ['pude', 'pudiste', 'pudo', 'pudimos', 'pudisteis', 'pudieron'],
		'futuro simple': ['podré', 'podrás', 'podrá', 'podremos', 'podréis', 'podrán'],
		'condicional simple': ['podría', 'podrías', 'podría', 'podríamos', 'podríais', 'podrían'],
		'subjuntivo presente': ['pueda', 'puedas', 'pueda', 'podamos', 'podáis', 'puedan'],
		'subjuntivo imperfecto': [
			'pudiera',
			'pudieras',
			'pudiera',
			'pudiéramos',
			'pudierais',
			'pudieran'
		],
		imperativo: ['', 'puede', 'pueda', 'podamos', 'poded', 'puedan']
	},

	// ─── DECIR ───────────────────────────────────────────────────────────────
	decir: {
		presente: ['digo', 'dices', 'dice', 'decimos', 'decís', 'dicen'],
		imperfecto: ['decía', 'decías', 'decía', 'decíamos', 'decíais', 'decían'],
		'pretérito indefinido': ['dije', 'dijiste', 'dijo', 'dijimos', 'dijisteis', 'dijeron'],
		'futuro simple': ['diré', 'dirás', 'dirá', 'diremos', 'diréis', 'dirán'],
		'condicional simple': ['diría', 'dirías', 'diría', 'diríamos', 'diríais', 'dirían'],
		'subjuntivo presente': ['diga', 'digas', 'diga', 'digamos', 'digáis', 'digan'],
		'subjuntivo imperfecto': ['dijera', 'dijeras', 'dijera', 'dijéramos', 'dijerais', 'dijeran'],
		imperativo: ['', 'di', 'diga', 'digamos', 'decid', 'digan']
	},

	// ─── VER ─────────────────────────────────────────────────────────────────
	ver: {
		presente: ['veo', 'ves', 've', 'vemos', 'veis', 'ven'],
		imperfecto: ['veía', 'veías', 'veía', 'veíamos', 'veíais', 'veían'],
		'pretérito indefinido': ['vi', 'viste', 'vio', 'vimos', 'visteis', 'vieron'],
		'futuro simple': ['veré', 'verás', 'verá', 'veremos', 'veréis', 'verán'],
		'condicional simple': ['vería', 'verías', 'vería', 'veríamos', 'veríais', 'verían'],
		'subjuntivo presente': ['vea', 'veas', 'vea', 'veamos', 'veáis', 'vean'],
		'subjuntivo imperfecto': ['viera', 'vieras', 'viera', 'viéramos', 'vierais', 'vieran'],
		imperativo: ['', 've', 'vea', 'veamos', 'ved', 'vean']
	},

	// ─── DAR ─────────────────────────────────────────────────────────────────
	dar: {
		presente: ['doy', 'das', 'da', 'damos', 'dais', 'dan'],
		imperfecto: ['daba', 'dabas', 'daba', 'dábamos', 'dabais', 'daban'],
		'pretérito indefinido': ['di', 'diste', 'dio', 'dimos', 'disteis', 'dieron'],
		'futuro simple': ['daré', 'darás', 'dará', 'daremos', 'daréis', 'darán'],
		'condicional simple': ['daría', 'darías', 'daría', 'daríamos', 'daríais', 'darían'],
		'subjuntivo presente': ['dé', 'des', 'dé', 'demos', 'deis', 'den'],
		'subjuntivo imperfecto': ['diera', 'dieras', 'diera', 'diéramos', 'dierais', 'dieran'],
		imperativo: ['', 'da', 'dé', 'demos', 'dad', 'den']
	},

	// ─── SABER ───────────────────────────────────────────────────────────────
	saber: {
		presente: ['sé', 'sabes', 'sabe', 'sabemos', 'sabéis', 'saben'],
		imperfecto: ['sabía', 'sabías', 'sabía', 'sabíamos', 'sabíais', 'sabían'],
		'pretérito indefinido': ['supe', 'supiste', 'supo', 'supimos', 'supisteis', 'supieron'],
		'futuro simple': ['sabré', 'sabrás', 'sabrá', 'sabremos', 'sabréis', 'sabrán'],
		'condicional simple': ['sabría', 'sabrías', 'sabría', 'sabríamos', 'sabríais', 'sabrían'],
		'subjuntivo presente': ['sepa', 'sepas', 'sepa', 'sepamos', 'sepáis', 'sepan'],
		'subjuntivo imperfecto': [
			'supiera',
			'supieras',
			'supiera',
			'supiéramos',
			'supierais',
			'supieran'
		],
		imperativo: ['', 'sabe', 'sepa', 'sepamos', 'sabed', 'sepan']
	},

	// ─── QUERER ──────────────────────────────────────────────────────────────
	querer: {
		presente: ['quiero', 'quieres', 'quiere', 'queremos', 'queréis', 'quieren'],
		imperfecto: ['quería', 'querías', 'quería', 'queríamos', 'queríais', 'querían'],
		'pretérito indefinido': ['quise', 'quisiste', 'quiso', 'quisimos', 'quisisteis', 'quisieron'],
		'futuro simple': ['querré', 'querrás', 'querrá', 'querremos', 'querréis', 'querrán'],
		'condicional simple': ['querría', 'querrías', 'querría', 'querríamos', 'querríais', 'querrían'],
		'subjuntivo presente': ['quiera', 'quieras', 'quiera', 'queramos', 'queráis', 'quieran'],
		'subjuntivo imperfecto': [
			'quisiera',
			'quisieras',
			'quisiera',
			'quisiéramos',
			'quisierais',
			'quisieran'
		],
		imperativo: ['', 'quiere', 'quiera', 'queramos', 'quered', 'quieran']
	},

	// ─── LLEGAR ──────────────────────────────────────────────────────────────
	llegar: {
		presente: ['llego', 'llegas', 'llega', 'llegamos', 'llegáis', 'llegan'],
		imperfecto: ['llegaba', 'llegabas', 'llegaba', 'llegábamos', 'llegabais', 'llegaban'],
		'pretérito indefinido': ['llegué', 'llegaste', 'llegó', 'llegamos', 'llegasteis', 'llegaron'],
		'futuro simple': ['llegaré', 'llegarás', 'llegará', 'llegaremos', 'llegaréis', 'llegarán'],
		'condicional simple': [
			'llegaría',
			'llegarías',
			'llegaría',
			'llegaríamos',
			'llegaríais',
			'llegarían'
		],
		'subjuntivo presente': ['llegue', 'llegues', 'llegue', 'lleguemos', 'lleguéis', 'lleguen'],
		'subjuntivo imperfecto': [
			'llegara',
			'llegaras',
			'llegara',
			'llegáramos',
			'llegarais',
			'llegaran'
		],
		imperativo: ['', 'llega', 'llegue', 'lleguemos', 'llegad', 'lleguen']
	},

	// ─── PASAR ───────────────────────────────────────────────────────────────
	pasar: {
		presente: ['paso', 'pasas', 'pasa', 'pasamos', 'pasáis', 'pasan'],
		imperfecto: ['pasaba', 'pasabas', 'pasaba', 'pasábamos', 'pasabais', 'pasaban'],
		'pretérito indefinido': ['pasé', 'pasaste', 'pasó', 'pasamos', 'pasasteis', 'pasaron'],
		'futuro simple': ['pasaré', 'pasarás', 'pasará', 'pasaremos', 'pasaréis', 'pasarán'],
		'condicional simple': ['pasaría', 'pasarías', 'pasaría', 'pasaríamos', 'pasaríais', 'pasarían'],
		'subjuntivo presente': ['pase', 'pases', 'pase', 'pasemos', 'paséis', 'pasen'],
		'subjuntivo imperfecto': ['pasara', 'pasaras', 'pasara', 'pasáramos', 'pasarais', 'pasaran'],
		imperativo: ['', 'pasa', 'pase', 'pasemos', 'pasad', 'pasen']
	},

	// ─── DEBER ───────────────────────────────────────────────────────────────
	deber: {
		presente: ['debo', 'debes', 'debe', 'debemos', 'debéis', 'deben'],
		imperfecto: ['debía', 'debías', 'debía', 'debíamos', 'debíais', 'debían'],
		'pretérito indefinido': ['debí', 'debiste', 'debió', 'debimos', 'debisteis', 'debieron'],
		'futuro simple': ['deberé', 'deberás', 'deberá', 'deberemos', 'deberéis', 'deberán'],
		'condicional simple': ['debería', 'deberías', 'debería', 'deberíamos', 'deberíais', 'deberían'],
		'subjuntivo presente': ['deba', 'debas', 'deba', 'debamos', 'debáis', 'deban'],
		'subjuntivo imperfecto': [
			'debiera',
			'debieras',
			'debiera',
			'debiéramos',
			'debierais',
			'debieran'
		],
		imperativo: ['', 'debe', 'deba', 'debamos', 'debed', 'deban']
	},

	// ─── PONER ───────────────────────────────────────────────────────────────
	poner: {
		presente: ['pongo', 'pones', 'pone', 'ponemos', 'ponéis', 'ponen'],
		imperfecto: ['ponía', 'ponías', 'ponía', 'poníamos', 'poníais', 'ponían'],
		'pretérito indefinido': ['puse', 'pusiste', 'puso', 'pusimos', 'pusisteis', 'pusieron'],
		'futuro simple': ['pondré', 'pondrás', 'pondrá', 'pondremos', 'pondréis', 'pondrán'],
		'condicional simple': ['pondría', 'pondrías', 'pondría', 'pondríamos', 'pondríais', 'pondrían'],
		'subjuntivo presente': ['ponga', 'pongas', 'ponga', 'pongamos', 'pongáis', 'pongan'],
		'subjuntivo imperfecto': [
			'pusiera',
			'pusieras',
			'pusiera',
			'pusiéramos',
			'pusierais',
			'pusieran'
		],
		imperativo: ['', 'pon', 'ponga', 'pongamos', 'poned', 'pongan']
	},

	// ─── PARECER ─────────────────────────────────────────────────────────────
	parecer: {
		presente: ['parezco', 'pareces', 'parece', 'parecemos', 'parecéis', 'parecen'],
		imperfecto: ['parecía', 'parecías', 'parecía', 'parecíamos', 'parecíais', 'parecían'],
		'pretérito indefinido': [
			'parecí',
			'pareciste',
			'pareció',
			'parecimos',
			'parecisteis',
			'parecieron'
		],
		'futuro simple': [
			'pareceré',
			'parecerás',
			'parecerá',
			'pareceremos',
			'pareceréis',
			'parecerán'
		],
		'condicional simple': [
			'parecería',
			'parecerías',
			'parecería',
			'pareceríamos',
			'pareceríais',
			'parecerían'
		],
		'subjuntivo presente': [
			'parezca',
			'parezcas',
			'parezca',
			'parezcamos',
			'parezcáis',
			'parezcan'
		],
		'subjuntivo imperfecto': [
			'pareciera',
			'parecieras',
			'pareciera',
			'pareciéramos',
			'parecierais',
			'parecieran'
		],
		imperativo: ['', 'parece', 'parezca', 'parezcamos', 'pareced', 'parezcan']
	},

	// ─── QUEDAR ──────────────────────────────────────────────────────────────
	quedar: {
		presente: ['quedo', 'quedas', 'queda', 'quedamos', 'quedáis', 'quedan'],
		imperfecto: ['quedaba', 'quedabas', 'quedaba', 'quedábamos', 'quedabais', 'quedaban'],
		'pretérito indefinido': ['quedé', 'quedaste', 'quedó', 'quedamos', 'quedasteis', 'quedaron'],
		'futuro simple': ['quedaré', 'quedarás', 'quedará', 'quedaremos', 'quedaréis', 'quedarán'],
		'condicional simple': [
			'quedaría',
			'quedarías',
			'quedaría',
			'quedaríamos',
			'quedaríais',
			'quedarían'
		],
		'subjuntivo presente': ['quede', 'quedes', 'quede', 'quedemos', 'quedéis', 'queden'],
		'subjuntivo imperfecto': [
			'quedara',
			'quedaras',
			'quedara',
			'quedáramos',
			'quedarais',
			'quedaran'
		],
		imperativo: ['', 'queda', 'quede', 'quedemos', 'quedad', 'queden']
	},

	// ─── CREER ───────────────────────────────────────────────────────────────
	creer: {
		presente: ['creo', 'crees', 'cree', 'creemos', 'creéis', 'creen'],
		imperfecto: ['creía', 'creías', 'creía', 'creíamos', 'creíais', 'creían'],
		'pretérito indefinido': ['creí', 'creíste', 'creyó', 'creímos', 'creísteis', 'creyeron'],
		'futuro simple': ['creeré', 'creerás', 'creerá', 'creeremos', 'creeréis', 'creerán'],
		'condicional simple': ['creería', 'creerías', 'creería', 'creeríamos', 'creeríais', 'creerían'],
		'subjuntivo presente': ['crea', 'creas', 'crea', 'creamos', 'creáis', 'crean'],
		'subjuntivo imperfecto': [
			'creyera',
			'creyeras',
			'creyera',
			'creyéramos',
			'creyerais',
			'creyeran'
		],
		imperativo: ['', 'cree', 'crea', 'creamos', 'creed', 'crean']
	},

	// ─── HABLAR ──────────────────────────────────────────────────────────────
	hablar: {
		presente: ['hablo', 'hablas', 'habla', 'hablamos', 'habláis', 'hablan'],
		imperfecto: ['hablaba', 'hablabas', 'hablaba', 'hablábamos', 'hablabais', 'hablaban'],
		'pretérito indefinido': ['hablé', 'hablaste', 'habló', 'hablamos', 'hablasteis', 'hablaron'],
		'futuro simple': ['hablaré', 'hablarás', 'hablará', 'hablaremos', 'hablaréis', 'hablarán'],
		'condicional simple': [
			'hablaría',
			'hablarías',
			'hablaría',
			'hablaríamos',
			'hablaríais',
			'hablarían'
		],
		'subjuntivo presente': ['hable', 'hables', 'hable', 'hablemos', 'habléis', 'hablen'],
		'subjuntivo imperfecto': [
			'hablara',
			'hablaras',
			'hablara',
			'habláramos',
			'hablarais',
			'hablaran'
		],
		imperativo: ['', 'habla', 'hable', 'hablemos', 'hablad', 'hablen']
	},

	// ─── LLEVAR ──────────────────────────────────────────────────────────────
	llevar: {
		presente: ['llevo', 'llevas', 'lleva', 'llevamos', 'lleváis', 'llevan'],
		imperfecto: ['llevaba', 'llevabas', 'llevaba', 'llevábamos', 'llevabais', 'llevaban'],
		'pretérito indefinido': ['llevé', 'llevaste', 'llevó', 'llevamos', 'llevasteis', 'llevaron'],
		'futuro simple': ['llevaré', 'llevarás', 'llevará', 'llevaremos', 'llevaréis', 'llevarán'],
		'condicional simple': [
			'llevaría',
			'llevarías',
			'llevaría',
			'llevaríamos',
			'llevaríais',
			'llevarían'
		],
		'subjuntivo presente': ['lleve', 'lleves', 'lleve', 'llevemos', 'llevéis', 'lleven'],
		'subjuntivo imperfecto': [
			'llevara',
			'llevaras',
			'llevara',
			'lleváramos',
			'llevarais',
			'llevaran'
		],
		imperativo: ['', 'lleva', 'lleve', 'llevemos', 'llevad', 'lleven']
	},

	// ─── DEJAR ───────────────────────────────────────────────────────────────
	dejar: {
		presente: ['dejo', 'dejas', 'deja', 'dejamos', 'dejáis', 'dejan'],
		imperfecto: ['dejaba', 'dejabas', 'dejaba', 'dejábamos', 'dejabais', 'dejaban'],
		'pretérito indefinido': ['dejé', 'dejaste', 'dejó', 'dejamos', 'dejasteis', 'dejaron'],
		'futuro simple': ['dejaré', 'dejarás', 'dejará', 'dejaremos', 'dejaréis', 'dejarán'],
		'condicional simple': ['dejaría', 'dejarías', 'dejaría', 'dejaríamos', 'dejaríais', 'dejarían'],
		'subjuntivo presente': ['deje', 'dejes', 'deje', 'dejemos', 'dejéis', 'dejen'],
		'subjuntivo imperfecto': ['dejara', 'dejaras', 'dejara', 'dejáramos', 'dejarais', 'dejaran'],
		imperativo: ['', 'deja', 'deje', 'dejemos', 'dejad', 'dejen']
	},

	// ─── SEGUIR ──────────────────────────────────────────────────────────────
	seguir: {
		presente: ['sigo', 'sigues', 'sigue', 'seguimos', 'seguís', 'siguen'],
		imperfecto: ['seguía', 'seguías', 'seguía', 'seguíamos', 'seguíais', 'seguían'],
		'pretérito indefinido': ['seguí', 'seguiste', 'siguió', 'seguimos', 'seguisteis', 'siguieron'],
		'futuro simple': ['seguiré', 'seguirás', 'seguirá', 'seguiremos', 'seguiréis', 'seguirán'],
		'condicional simple': [
			'seguiría',
			'seguirías',
			'seguiría',
			'seguiríamos',
			'seguiríais',
			'seguirían'
		],
		'subjuntivo presente': ['siga', 'sigas', 'siga', 'sigamos', 'sigáis', 'sigan'],
		'subjuntivo imperfecto': [
			'siguiera',
			'siguieras',
			'siguiera',
			'siguiéramos',
			'siguierais',
			'siguieran'
		],
		imperativo: ['', 'sigue', 'siga', 'sigamos', 'seguid', 'sigan']
	},

	// ─── ENCONTRAR ───────────────────────────────────────────────────────────
	encontrar: {
		presente: ['encuentro', 'encuentras', 'encuentra', 'encontramos', 'encontráis', 'encuentran'],
		imperfecto: [
			'encontraba',
			'encontrabas',
			'encontraba',
			'encontrábamos',
			'encontrabais',
			'encontraban'
		],
		'pretérito indefinido': [
			'encontré',
			'encontraste',
			'encontró',
			'encontramos',
			'encontrasteis',
			'encontraron'
		],
		'futuro simple': [
			'encontraré',
			'encontrarás',
			'encontrará',
			'encontraremos',
			'encontraréis',
			'encontrarán'
		],
		'condicional simple': [
			'encontraría',
			'encontrarías',
			'encontraría',
			'encontraríamos',
			'encontraríais',
			'encontrarían'
		],
		'subjuntivo presente': [
			'encuentre',
			'encuentres',
			'encuentre',
			'encontremos',
			'encontréis',
			'encuentren'
		],
		'subjuntivo imperfecto': [
			'encontrara',
			'encontraras',
			'encontrara',
			'encontráramos',
			'encontrarais',
			'encontraran'
		],
		imperativo: ['', 'encuentra', 'encuentre', 'encontremos', 'encontrad', 'encuentren']
	},

	// ─── LLAMAR ──────────────────────────────────────────────────────────────
	llamar: {
		presente: ['llamo', 'llamas', 'llama', 'llamamos', 'llamáis', 'llaman'],
		imperfecto: ['llamaba', 'llamabas', 'llamaba', 'llamábamos', 'llamabais', 'llamaban'],
		'pretérito indefinido': ['llamé', 'llamaste', 'llamó', 'llamamos', 'llamasteis', 'llamaron'],
		'futuro simple': ['llamaré', 'llamarás', 'llamará', 'llamaremos', 'llamaréis', 'llamarán'],
		'condicional simple': [
			'llamaría',
			'llamarías',
			'llamaría',
			'llamaríamos',
			'llamaríais',
			'llamarían'
		],
		'subjuntivo presente': ['llame', 'llames', 'llame', 'llamemos', 'llaméis', 'llamen'],
		'subjuntivo imperfecto': [
			'llamara',
			'llamaras',
			'llamara',
			'llamáramos',
			'llamarais',
			'llamaran'
		],
		imperativo: ['', 'llama', 'llame', 'llamemos', 'llamad', 'llamen']
	},

	// ─── VENIR ───────────────────────────────────────────────────────────────
	venir: {
		presente: ['vengo', 'vienes', 'viene', 'venimos', 'venís', 'vienen'],
		imperfecto: ['venía', 'venías', 'venía', 'veníamos', 'veníais', 'venían'],
		'pretérito indefinido': ['vine', 'viniste', 'vino', 'vinimos', 'vinisteis', 'vinieron'],
		'futuro simple': ['vendré', 'vendrás', 'vendrá', 'vendremos', 'vendréis', 'vendrán'],
		'condicional simple': ['vendría', 'vendrías', 'vendría', 'vendríamos', 'vendríais', 'vendrían'],
		'subjuntivo presente': ['venga', 'vengas', 'venga', 'vengamos', 'vengáis', 'vengan'],
		'subjuntivo imperfecto': [
			'viniera',
			'vinieras',
			'viniera',
			'viniéramos',
			'vinierais',
			'vinieran'
		],
		imperativo: ['', 'ven', 'venga', 'vengamos', 'venid', 'vengan']
	},

	// ─── PENSAR ──────────────────────────────────────────────────────────────
	pensar: {
		presente: ['pienso', 'piensas', 'piensa', 'pensamos', 'pensáis', 'piensan'],
		imperfecto: ['pensaba', 'pensabas', 'pensaba', 'pensábamos', 'pensabais', 'pensaban'],
		'pretérito indefinido': ['pensé', 'pensaste', 'pensó', 'pensamos', 'pensasteis', 'pensaron'],
		'futuro simple': ['pensaré', 'pensarás', 'pensará', 'pensaremos', 'pensaréis', 'pensarán'],
		'condicional simple': [
			'pensaría',
			'pensarías',
			'pensaría',
			'pensaríamos',
			'pensaríais',
			'pensarían'
		],
		'subjuntivo presente': ['piense', 'pienses', 'piense', 'pensemos', 'penséis', 'piensen'],
		'subjuntivo imperfecto': [
			'pensara',
			'pensaras',
			'pensara',
			'pensáramos',
			'pensarais',
			'pensaran'
		],
		imperativo: ['', 'piensa', 'piense', 'pensemos', 'pensad', 'piensen']
	},

	// ─── SALIR ───────────────────────────────────────────────────────────────
	salir: {
		presente: ['salgo', 'sales', 'sale', 'salimos', 'salís', 'salen'],
		imperfecto: ['salía', 'salías', 'salía', 'salíamos', 'salíais', 'salían'],
		'pretérito indefinido': ['salí', 'saliste', 'salió', 'salimos', 'salisteis', 'salieron'],
		'futuro simple': ['saldré', 'saldrás', 'saldrá', 'saldremos', 'saldréis', 'saldrán'],
		'condicional simple': ['saldría', 'saldrías', 'saldría', 'saldríamos', 'saldríais', 'saldrían'],
		'subjuntivo presente': ['salga', 'salgas', 'salga', 'salgamos', 'salgáis', 'salgan'],
		'subjuntivo imperfecto': [
			'saliera',
			'salieras',
			'saliera',
			'saliéramos',
			'salierais',
			'salieran'
		],
		imperativo: ['', 'sal', 'salga', 'salgamos', 'salid', 'salgan']
	},

	// ─── VOLVER ──────────────────────────────────────────────────────────────
	volver: {
		presente: ['vuelvo', 'vuelves', 'vuelve', 'volvemos', 'volvéis', 'vuelven'],
		imperfecto: ['volvía', 'volvías', 'volvía', 'volvíamos', 'volvíais', 'volvían'],
		'pretérito indefinido': ['volví', 'volviste', 'volvió', 'volvimos', 'volvisteis', 'volvieron'],
		'futuro simple': ['volveré', 'volverás', 'volverá', 'volveremos', 'volveréis', 'volverán'],
		'condicional simple': [
			'volvería',
			'volverías',
			'volvería',
			'volveríamos',
			'volveríais',
			'volverían'
		],
		'subjuntivo presente': ['vuelva', 'vuelvas', 'vuelva', 'volvamos', 'volváis', 'vuelvan'],
		'subjuntivo imperfecto': [
			'volviera',
			'volvieras',
			'volviera',
			'volviéramos',
			'volvierais',
			'volvieran'
		],
		imperativo: ['', 'vuelve', 'vuelva', 'volvamos', 'volved', 'vuelvan']
	},

	// ─── TOMAR ───────────────────────────────────────────────────────────────
	tomar: {
		presente: ['tomo', 'tomas', 'toma', 'tomamos', 'tomáis', 'toman'],
		imperfecto: ['tomaba', 'tomabas', 'tomaba', 'tomábamos', 'tomabais', 'tomaban'],
		'pretérito indefinido': ['tomé', 'tomaste', 'tomó', 'tomamos', 'tomasteis', 'tomaron'],
		'futuro simple': ['tomaré', 'tomarás', 'tomará', 'tomaremos', 'tomaréis', 'tomarán'],
		'condicional simple': ['tomaría', 'tomarías', 'tomaría', 'tomaríamos', 'tomaríais', 'tomarían'],
		'subjuntivo presente': ['tome', 'tomes', 'tome', 'tomemos', 'toméis', 'tomen'],
		'subjuntivo imperfecto': ['tomara', 'tomaras', 'tomara', 'tomáramos', 'tomarais', 'tomaran'],
		imperativo: ['', 'toma', 'tome', 'tomemos', 'tomad', 'tomen']
	},

	// ─── CONOCER ─────────────────────────────────────────────────────────────
	conocer: {
		presente: ['conozco', 'conoces', 'conoce', 'conocemos', 'conocéis', 'conocen'],
		imperfecto: ['conocía', 'conocías', 'conocía', 'conocíamos', 'conocíais', 'conocían'],
		'pretérito indefinido': [
			'conocí',
			'conociste',
			'conoció',
			'conocimos',
			'conocisteis',
			'conocieron'
		],
		'futuro simple': [
			'conoceré',
			'conocerás',
			'conocerá',
			'conoceremos',
			'conoceréis',
			'conocerán'
		],
		'condicional simple': [
			'conocería',
			'conocerías',
			'conocería',
			'conoceríamos',
			'conoceríais',
			'conocerían'
		],
		'subjuntivo presente': [
			'conozca',
			'conozcas',
			'conozca',
			'conozcamos',
			'conozcáis',
			'conozcan'
		],
		'subjuntivo imperfecto': [
			'conociera',
			'conocieras',
			'conociera',
			'conociéramos',
			'conocierais',
			'conocieran'
		],
		imperativo: ['', 'conoce', 'conozca', 'conozcamos', 'conoced', 'conozcan']
	}
};

// ─── English translations ────────────────────────────────────────────────────

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
	tener: { base: 'have', past: 'had', pp: 'had', third: 'has', ing: 'having' },
	hacer: { base: 'do', past: 'did', pp: 'done', third: 'does', ing: 'doing' },
	ir: { base: 'go', past: 'went', pp: 'gone', third: 'goes', ing: 'going' },
	poder: { base: 'be able', past: 'could', pp: 'been able', third: 'can', ing: 'being able' },
	decir: { base: 'say', past: 'said', pp: 'said', third: 'says', ing: 'saying' },
	ver: { base: 'see', past: 'saw', pp: 'seen', third: 'sees', ing: 'seeing' },
	dar: { base: 'give', past: 'gave', pp: 'given', third: 'gives', ing: 'giving' },
	saber: { base: 'know', past: 'knew', pp: 'known', third: 'knows', ing: 'knowing' },
	querer: { base: 'want', past: 'wanted', pp: 'wanted', third: 'wants', ing: 'wanting' },
	llegar: { base: 'arrive', past: 'arrived', pp: 'arrived', third: 'arrives', ing: 'arriving' },
	pasar: { base: 'pass', past: 'passed', pp: 'passed', third: 'passes', ing: 'passing' },
	deber: { base: 'have to', past: 'had to', pp: 'had to', third: 'must', ing: 'having to' },
	poner: { base: 'put', past: 'put', pp: 'put', third: 'puts', ing: 'putting' },
	parecer: { base: 'seem', past: 'seemed', pp: 'seemed', third: 'seems', ing: 'seeming' },
	quedar: { base: 'stay', past: 'stayed', pp: 'stayed', third: 'stays', ing: 'staying' },
	creer: { base: 'believe', past: 'believed', pp: 'believed', third: 'believes', ing: 'believing' },
	hablar: { base: 'speak', past: 'spoke', pp: 'spoken', third: 'speaks', ing: 'speaking' },
	llevar: { base: 'carry', past: 'carried', pp: 'carried', third: 'carries', ing: 'carrying' },
	dejar: { base: 'leave', past: 'left', pp: 'left', third: 'leaves', ing: 'leaving' },
	seguir: { base: 'follow', past: 'followed', pp: 'followed', third: 'follows', ing: 'following' },
	encontrar: { base: 'find', past: 'found', pp: 'found', third: 'finds', ing: 'finding' },
	llamar: { base: 'call', past: 'called', pp: 'called', third: 'calls', ing: 'calling' },
	venir: { base: 'come', past: 'came', pp: 'come', third: 'comes', ing: 'coming' },
	pensar: { base: 'think', past: 'thought', pp: 'thought', third: 'thinks', ing: 'thinking' },
	salir: { base: 'leave', past: 'left', pp: 'left', third: 'leaves', ing: 'leaving' },
	volver: { base: 'return', past: 'returned', pp: 'returned', third: 'returns', ing: 'returning' },
	tomar: { base: 'take', past: 'took', pp: 'taken', third: 'takes', ing: 'taking' },
	conocer: { base: 'know', past: 'knew', pp: 'known', third: 'knows', ing: 'knowing' }
};

const EN_PRONOUN: Record<string, string> = {
	yo: 'I',
	tú: 'you',
	'él/ella': 'he/she',
	'nosotros/nosotras': 'we',
	'vosotros/vosotras': 'you all',
	'ellos/ellas': 'they'
};

// Generate English translation
function enTranslate(verb: string, tense: string, person: string): string {
	const pro = EN_PRONOUN[person] || person;
	const info = EN_VERB_INFO[verb];

	// Special handling for ser/estar distinction
	const verbName = verb === 'ser' ? '(ser)' : verb === 'estar' ? '(estar)' : '';

	switch (tense) {
		// ── Indicative ──
		case 'presente': {
			if (verb === 'ser' || verb === 'estar') {
				if (person === 'yo') return `I am ${verbName}`.trim();
				if (person === 'tú') return `you are ${verbName}`.trim();
				if (person === 'él/ella') return `he/she is ${verbName}`.trim();
				if (person === 'nosotros/nosotras') return `we are ${verbName}`.trim();
				if (person === 'vosotros/vosotras') return `you all are ${verbName}`.trim();
				return `they are ${verbName}`.trim();
			}
			// Use configured third-person form instead of base + "s"
			if (person === 'él/ella') return `he/she ${info.third}`;
			// Handle verbs like "poder" where the present tense differs from base across all persons
			if (verb === 'poder') return `${pro} can`;
			return `${pro} ${info.base}`;
		}
		case 'pretérito perfecto':
			return `${pro} ${person === 'él/ella' ? 'has' : 'have'} ${info.pp}`;
		case 'imperfecto': {
			if (verb === 'ser' || verb === 'estar') {
				if (person === 'yo' || person === 'él/ella') return `${pro} was ${verbName}`.trim();
				return `${pro} were ${verbName}`.trim();
			}
			return `${pro} used to ${info.base}`;
		}
		case 'pretérito indefinido':
			return `${pro} ${info.past}`;
		case 'pretérito pluscuamperfecto':
			return `${pro} had ${info.pp}`;
		case 'pretérito anterior':
			return `${pro} had ${info.pp} (past anterior)`;
		case 'futuro simple':
			return `${pro} will ${info.base}`;
		case 'futuro perfecto':
			return `${pro} will have ${info.pp}`;
		case 'condicional simple':
			return `${pro} would ${info.base}`;
		case 'condicional perfecto':
			return `${pro} would have ${info.pp}`;

		// ── Subjunctive ──
		case 'subjuntivo presente':
			return `(that) ${pro} ${info.base}`;
		case 'subjuntivo imperfecto':
			return `(that) ${pro} ${info.past}`;
		case 'subjuntivo pretérito perfecto':
			return `(that) ${pro} have ${info.pp}`;
		case 'subjuntivo pluscuamperfecto':
			return `(that) ${pro} had ${info.pp}`;

		// ── Imperative ──
		case 'imperativo': {
			if (person === 'yo') return `(I) —`;
			if (person === 'tú') return `(${pro}) ${info.base}!`;
			if (person === 'él/ella') return `(he/she) ${info.base}!`;
			if (person === 'nosotros/nosotras') return `let's ${info.base}!`;
			if (person === 'vosotros/vosotras') return `(you all) ${info.base}!`;
			return `(they) ${info.base}!`;
		}

		// ── Non-personal ──
		case 'infinitivo simple':
			return `to ${info.base}`;
		case 'infinitivo compuesto':
			return `to have ${info.pp}`;
		case 'gerundio simple':
			return `${info.ing}`;
		case 'gerundio compuesto':
			return `having ${info.pp}`;
		case 'participio':
			return `${info.pp}`;
	}
	return `${pro} ${info.base}`;
}

// ─── Build conjugation map ───────────────────────────────────────────────────

function buildConjugationMap(): ConjugationMap {
	const map: ConjugationMap = new Map();

	for (const verb of ALL_VERBS) {
		for (const tense of ALL_TENSES) {
			for (let pIdx = 0; pIdx < ALL_PERSONS.length; pIdx++) {
				const person = ALL_PERSONS[pIdx];
				let conjugation: string;

				// Compound tenses: haber + past participle
				if (COMPOUND_TENSE[tense]) {
					const haberTense = COMPOUND_TENSE[tense];
					const haberForm = HABER[haberTense]?.[pIdx] || '';
					conjugation = `${haberForm} ${PAST_PARTICIPLE[verb]}`;
				}
				// Non-personal forms with same value for all persons
				else if (tense === 'infinitivo simple') {
					conjugation = verb;
				} else if (tense === 'infinitivo compuesto') {
					conjugation = `haber ${PAST_PARTICIPLE[verb]}`;
				} else if (tense === 'gerundio simple') {
					conjugation = GERUNDIO[verb] || '';
				} else if (tense === 'gerundio compuesto') {
					conjugation = `habiendo ${PAST_PARTICIPLE[verb]}`;
				} else if (tense === 'participio') {
					conjugation = PAST_PARTICIPLE[verb] || '';
				}
				// Simple tenses from conjugation table
				else {
					const verbTense = CONJUGATIONS[verb]?.[tense];
					conjugation = verbTense?.[pIdx] || '';
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

// ─── Spanish extractConjugation ─────────────────────────────────────────────

/**
 * Extract conjugation from user input for Spanish.
 * Handles slash variants like:
 * - "él/ella" → accepts "él", "ella", "él/ella", "él ella"
 * - "nosotros/nosotras" → accepts "nosotros", "nosotras", "nosotros/nosotras"
 * etc.
 */
function spanishExtractConjugation(input: string, expectedPersonLabel: string): string | null {
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

		// Try variants joined with space (e.g. "él ella" for "él/ella")
		const spaceJoined = variants.join(' ');
		if (normalized.startsWith(spaceJoined + ' ')) {
			return normalized.slice(spaceJoined.length).trim();
		}
		if (normalized === spaceJoined) {
			return '';
		}
	}

	return null;
}

// ─── Default selections ──────────────────────────────────────────────────────

const DEFAULT_VERBS_ES: string[] = [
	'ser',
	'estar',
	'tener',
	'hacer',
	'ir',
	'poder',
	'decir',
	'ver',
	'dar',
	'saber',
	'querer',
	'llegar',
	'pasar',
	'deber',
	'poner',
	'parecer',
	'quedar',
	'creer',
	'hablar',
	'llevar',
	'dejar',
	'seguir',
	'encontrar',
	'llamar',
	'venir'
];

const DEFAULT_TENSES_ES: string[] = [
	'presente',
	'pretérito perfecto',
	'pretérito indefinido',
	'imperfecto',
	'futuro simple'
];

// ─── Spanish LanguageModule ─────────────────────────────────────────────────

export const spanishModule: LanguageModule = {
	id: 'spanish',
	flag: '🇪🇸',
	name: 'Spanish',
	displayName: 'Español',
	VERB_LIST: ALL_VERBS,
	TENSE_LIST: ALL_TENSES,
	PERSON_LABELS: ALL_PERSONS,
	conjugationMap,
	DEFAULT_VERBS: DEFAULT_VERBS_ES,
	DEFAULT_TENSES: DEFAULT_TENSES_ES,
	ui: {
		coverage: 'Cobertura',
		accuracy: 'Precisión',
		conjugation: 'Conjugación',
		history: 'Historial',
		verb: 'Verbos',
		tense: 'Tiempos'
	},
	extractConjugation: spanishExtractConjugation
};
