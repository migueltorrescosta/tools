export interface ConjugationEntry {
	verb: string;
	tense: string;
	person: string;
	conjugation: string;
	translation: string;
}

export type ConjugationMap = Map<string, ConjugationEntry>;

// ─── Enums ──────────────────────────────────────────────────────────────────

const ALL_VERBS = [
	'essere', 'avere', 'fare', 'dire', 'andare',
	'potere', 'volere', 'dovere', 'vedere', 'sapere',
	'stare', 'dare', 'parlare', 'mangiare', 'bere',
	'prendere', 'mettere', 'venire', 'uscire', 'entrare',
	'capire', 'credere', 'trovare', 'lasciare', 'sembrare',
	'tornare', 'vivere', 'sentire', 'guardare', 'lavorare'
] as const;

const ALL_TENSES = [
	'indicativo presente', 'passato prossimo', 'imperfetto', 'trapassato prossimo',
	'passato remoto', 'trapassato remoto', 'futuro semplice', 'futuro anteriore',
	'congiuntivo presente', 'congiuntivo passato', 'congiuntivo imperfetto', 'congiuntivo trapassato',
	'condizionale presente', 'condizionale passato', 'imperativo',
	'infinito presente', 'infinito passato', 'participio presente', 'participio passato',
	'gerundio presente', 'gerundio passato'
] as const;

const ALL_PERSONS = ['io', 'tu', 'lui/lei', 'noi', 'voi', 'loro'] as const;

type Verb = (typeof ALL_VERBS)[number];
type Tense = (typeof ALL_TENSES)[number];
type Person = (typeof ALL_PERSONS)[number];

export const VERB_LIST = ALL_VERBS;
export const TENSE_LIST = ALL_TENSES;
export const PERSON_LABELS = ALL_PERSONS;

// ─── Verb metadata ──────────────────────────────────────────────────────────

/** Verb type determines regular conjugation endings */
type VerbClass =
	| 'are'       // parlare, trovare, entrare, tornare, guardare, lavorare, sembrare
	| 'are-ciare' // mangiare (orthographic changes)
	| 'are-sciare' // lasciare (orthographic changes)
	| 'are-irreg' // dare, stare (mostly regular but with short stems + special forms)
	| 'ere'       // credere, prendere (passato remoto irregular), mettere (passato remoto irregular)
	| 'ire'       // sentire, venire, uscire
	| 'ire-isco'  // capire
	| 'irregular' // essere, avere, fare, dire, andare, potere, volere, dovere, vedere, sapere, bere, vivere
	;

interface VerbInfo {
	stem: string;
	class: VerbClass;
	aux: 'avere' | 'essere';
	pp: string;
	/** English translation base forms */
	en: { base: string; past: string; pp: string; ing: string; third: string };
}

const VERB_INFO: Record<Verb, VerbInfo> = {
	essere:       { stem: '',       class: 'irregular',   aux: 'essere', pp: 'stato',     en: { base: 'be',       past: 'was',     pp: 'been',      ing: 'being',     third: 'is' } },
	avere:        { stem: '',       class: 'irregular',   aux: 'avere',  pp: 'avuto',     en: { base: 'have',     past: 'had',     pp: 'had',       ing: 'having',    third: 'has' } },
	fare:         { stem: '',       class: 'irregular',   aux: 'avere',  pp: 'fatto',     en: { base: 'do',       past: 'did',     pp: 'done',      ing: 'doing',     third: 'does' } },
	dire:         { stem: '',       class: 'irregular',   aux: 'avere',  pp: 'detto',     en: { base: 'say',      past: 'said',    pp: 'said',      ing: 'saying',    third: 'says' } },
	andare:       { stem: '',       class: 'irregular',   aux: 'essere', pp: 'andato',    en: { base: 'go',       past: 'went',    pp: 'gone',      ing: 'going',     third: 'goes' } },
	potere:       { stem: '',       class: 'irregular',   aux: 'avere',  pp: 'potuto',    en: { base: 'be able',  past: 'could',   pp: 'been able', ing: 'being able', third: 'can' } },
	volere:       { stem: '',       class: 'irregular',   aux: 'avere',  pp: 'voluto',    en: { base: 'want',     past: 'wanted',  pp: 'wanted',    ing: 'wanting',   third: 'wants' } },
	dovere:       { stem: '',       class: 'irregular',   aux: 'avere',  pp: 'dovuto',    en: { base: 'have to',  past: 'had to',  pp: 'had to',    ing: 'having to', third: 'must' } },
	vedere:       { stem: '',       class: 'irregular',   aux: 'avere',  pp: 'visto',     en: { base: 'see',      past: 'saw',     pp: 'seen',      ing: 'seeing',    third: 'sees' } },
	sapere:       { stem: '',       class: 'irregular',   aux: 'avere',  pp: 'saputo',    en: { base: 'know',     past: 'knew',    pp: 'known',     ing: 'knowing',   third: 'knows' } },
	stare:        { stem: 'st',     class: 'are-irreg',   aux: 'essere', pp: 'stato',     en: { base: 'stay',     past: 'stayed',  pp: 'stayed',    ing: 'staying',   third: 'stays' } },
	dare:         { stem: 'd',      class: 'are-irreg',   aux: 'avere',  pp: 'dato',      en: { base: 'give',     past: 'gave',    pp: 'given',     ing: 'giving',    third: 'gives' } },
	parlare:      { stem: 'parl',   class: 'are',         aux: 'avere',  pp: 'parlato',   en: { base: 'speak',    past: 'spoke',   pp: 'spoken',    ing: 'speaking',  third: 'speaks' } },
	mangiare:     { stem: 'mangi',  class: 'are-ciare',   aux: 'avere',  pp: 'mangiato',  en: { base: 'eat',      past: 'ate',     pp: 'eaten',     ing: 'eating',    third: 'eats' } },
	bere:         { stem: '',       class: 'irregular',   aux: 'avere',  pp: 'bevuto',    en: { base: 'drink',    past: 'drank',   pp: 'drunk',     ing: 'drinking',  third: 'drinks' } },
	prendere:     { stem: 'prend',  class: 'ere',         aux: 'avere',  pp: 'preso',     en: { base: 'take',     past: 'took',    pp: 'taken',     ing: 'taking',    third: 'takes' } },
	mettere:      { stem: '',       class: 'irregular',   aux: 'avere',  pp: 'messo',     en: { base: 'put',      past: 'put',     pp: 'put',       ing: 'putting',   third: 'puts' } },
	venire:       { stem: '',       class: 'irregular',   aux: 'essere', pp: 'venuto',    en: { base: 'come',     past: 'came',    pp: 'come',      ing: 'coming',    third: 'comes' } },
	uscire:       { stem: '',       class: 'irregular',   aux: 'essere', pp: 'uscito',    en: { base: 'go out',   past: 'went out', pp: 'gone out', ing: 'going out', third: 'goes out' } },
	entrare:      { stem: 'entr',   class: 'are',         aux: 'essere', pp: 'entrato',   en: { base: 'enter',    past: 'entered', pp: 'entered',   ing: 'entering',  third: 'enters' } },
	capire:       { stem: 'cap',    class: 'ire-isco',    aux: 'avere',  pp: 'capito',    en: { base: 'understand', past: 'understood', pp: 'understood', ing: 'understanding', third: 'understands' } },
	credere:      { stem: 'cred',   class: 'ere',         aux: 'avere',  pp: 'creduto',   en: { base: 'believe',  past: 'believed', pp: 'believed',  ing: 'believing', third: 'believes' } },
	trovare:      { stem: 'trov',   class: 'are',         aux: 'avere',  pp: 'trovato',   en: { base: 'find',     past: 'found',   pp: 'found',     ing: 'finding',   third: 'finds' } },
	lasciare:     { stem: 'lasci',  class: 'are-sciare',  aux: 'avere',  pp: 'lasciato',  en: { base: 'leave',    past: 'left',    pp: 'left',      ing: 'leaving',   third: 'leaves' } },
	sembrare:     { stem: 'sembr',  class: 'are',         aux: 'essere', pp: 'sembrato',  en: { base: 'seem',     past: 'seemed',  pp: 'seemed',    ing: 'seeming',   third: 'seems' } },
	tornare:      { stem: 'torn',   class: 'are',         aux: 'essere', pp: 'tornato',   en: { base: 'return',   past: 'returned', pp: 'returned', ing: 'returning', third: 'returns' } },
	vivere:       { stem: '',       class: 'irregular',   aux: 'avere',  pp: 'vissuto',   en: { base: 'live',     past: 'lived',   pp: 'lived',     ing: 'living',    third: 'lives' } },
	sentire:      { stem: 'sent',   class: 'ire',         aux: 'avere',  pp: 'sentito',   en: { base: 'feel',     past: 'felt',    pp: 'felt',      ing: 'feeling',   third: 'feels' } },
	guardare:     { stem: 'guard',  class: 'are',         aux: 'avere',  pp: 'guardato',  en: { base: 'watch',    past: 'watched', pp: 'watched',   ing: 'watching',  third: 'watches' } },
	lavorare:     { stem: 'lavor',  class: 'are',         aux: 'avere',  pp: 'lavorato',  en: { base: 'work',     past: 'worked',  pp: 'worked',    ing: 'working',   third: 'works' } },
};

// ─── Conjugation endings for regular verbs ──────────────────────────────────

interface Endings { [person: string]: string }

type EndingsTable = Partial<Record<Tense, Endings>>;

/** Canonical person order */
const P = ALL_PERSONS;

/** Regular -ARE endings */
const ARE: EndingsTable = {
	'indicativo presente':           { [P[0]]: 'o',    [P[1]]: 'i',    [P[2]]: 'a',    [P[3]]: 'iamo', [P[4]]: 'ate', [P[5]]: 'ano' },
	'imperfetto':                    { [P[0]]: 'avo',  [P[1]]: 'avi',  [P[2]]: 'ava',  [P[3]]: 'avamo',[P[4]]: 'avate',[P[5]]: 'avano' },
	'passato remoto':                { [P[0]]: 'ai',   [P[1]]: 'asti', [P[2]]: 'ò',    [P[3]]: 'ammo', [P[4]]: 'aste',[P[5]]: 'arono' },
	'futuro semplice':               { [P[0]]: 'erò',  [P[1]]: 'erai', [P[2]]: 'erà',  [P[3]]: 'eremo',[P[4]]: 'erete',[P[5]]: 'eranno' },
	'congiuntivo presente':          { [P[0]]: 'i',    [P[1]]: 'i',    [P[2]]: 'i',    [P[3]]: 'iamo', [P[4]]: 'iate',[P[5]]: 'ino' },
	'congiuntivo imperfetto':        { [P[0]]: 'assi', [P[1]]: 'assi', [P[2]]: 'asse', [P[3]]: 'assimo',[P[4]]: 'aste',[P[5]]: 'assero' },
	'condizionale presente':         { [P[0]]: 'erei', [P[1]]: 'eresti',[P[2]]: 'erebbe',[P[3]]: 'eremmo',[P[4]]: 'ereste',[P[5]]: 'erebbero' },
	'imperativo':                    { [P[1]]: 'a',    [P[2]]: 'i',    [P[3]]: 'iamo', [P[4]]: 'ate',  [P[5]]: 'ino' },
};

/** Regular -ERE endings */
const ERE: EndingsTable = {
	'indicativo presente':           { [P[0]]: 'o',    [P[1]]: 'i',    [P[2]]: 'e',    [P[3]]: 'iamo', [P[4]]: 'ete', [P[5]]: 'ono' },
	'imperfetto':                    { [P[0]]: 'evo',  [P[1]]: 'evi',  [P[2]]: 'eva',  [P[3]]: 'evamo',[P[4]]: 'evate',[P[5]]: 'evano' },
	'passato remoto':                { [P[0]]: 'ei',   [P[1]]: 'esti', [P[2]]: 'é',    [P[3]]: 'emmo', [P[4]]: 'este',[P[5]]: 'erono' },
	'futuro semplice':               { [P[0]]: 'erò',  [P[1]]: 'erai', [P[2]]: 'erà',  [P[3]]: 'eremo',[P[4]]: 'erete',[P[5]]: 'eranno' },
	'congiuntivo presente':          { [P[0]]: 'a',    [P[1]]: 'a',    [P[2]]: 'a',    [P[3]]: 'iamo', [P[4]]: 'iate',[P[5]]: 'ano' },
	'congiuntivo imperfetto':        { [P[0]]: 'essi', [P[1]]: 'essi', [P[2]]: 'esse', [P[3]]: 'essimo',[P[4]]: 'este',[P[5]]: 'essero' },
	'condizionale presente':         { [P[0]]: 'erei', [P[1]]: 'eresti',[P[2]]: 'erebbe',[P[3]]: 'eremmo',[P[4]]: 'ereste',[P[5]]: 'erebbero' },
	'imperativo':                    { [P[1]]: 'i',    [P[2]]: 'a',    [P[3]]: 'iamo', [P[4]]: 'ete',  [P[5]]: 'ano' },
};

/** Regular -IRE endings (non-isco type, e.g. sentire) */
const IRE: EndingsTable = {
	'indicativo presente':           { [P[0]]: 'o',    [P[1]]: 'i',    [P[2]]: 'e',    [P[3]]: 'iamo', [P[4]]: 'ite', [P[5]]: 'ono' },
	'imperfetto':                    { [P[0]]: 'ivo',  [P[1]]: 'ivi',  [P[2]]: 'iva',  [P[3]]: 'ivamo',[P[4]]: 'ivate',[P[5]]: 'ivano' },
	'passato remoto':                { [P[0]]: 'ii',   [P[1]]: 'isti', [P[2]]: 'ì',    [P[3]]: 'immo', [P[4]]: 'iste',[P[5]]: 'irono' },
	'futuro semplice':               { [P[0]]: 'irò',  [P[1]]: 'irai', [P[2]]: 'irà',  [P[3]]: 'iremo',[P[4]]: 'irete',[P[5]]: 'iranno' },
	'congiuntivo presente':          { [P[0]]: 'a',    [P[1]]: 'a',    [P[2]]: 'a',    [P[3]]: 'iamo', [P[4]]: 'iate',[P[5]]: 'ano' },
	'congiuntivo imperfetto':        { [P[0]]: 'issi', [P[1]]: 'issi', [P[2]]: 'isse', [P[3]]: 'issimo',[P[4]]: 'iste',[P[5]]: 'issero' },
	'condizionale presente':         { [P[0]]: 'irei', [P[1]]: 'iresti',[P[2]]: 'irebbe',[P[3]]: 'iremmo',[P[4]]: 'ireste',[P[5]]: 'irebbero' },
	'imperativo':                    { [P[1]]: 'i',    [P[2]]: 'a',    [P[3]]: 'iamo', [P[4]]: 'ite',  [P[5]]: 'ano' },
};

/** Regular -IRE endings (isco type, e.g. capire) */
const IRE_ISCO: EndingsTable = {
	'indicativo presente':           { [P[0]]: 'isco', [P[1]]: 'isci', [P[2]]: 'isce', [P[3]]: 'iamo', [P[4]]: 'ite', [P[5]]: 'iscono' },
	'imperfetto':                    { [P[0]]: 'ivo',  [P[1]]: 'ivi',  [P[2]]: 'iva',  [P[3]]: 'ivamo',[P[4]]: 'ivate',[P[5]]: 'ivano' },
	'passato remoto':                { [P[0]]: 'ii',   [P[1]]: 'isti', [P[2]]: 'ì',    [P[3]]: 'immo', [P[4]]: 'iste',[P[5]]: 'irono' },
	'futuro semplice':               { [P[0]]: 'irò',  [P[1]]: 'irai', [P[2]]: 'irà',  [P[3]]: 'iremo',[P[4]]: 'irete',[P[5]]: 'iranno' },
	'congiuntivo presente':          { [P[0]]: 'isca', [P[1]]: 'isca', [P[2]]: 'isca', [P[3]]: 'iamo', [P[4]]: 'iate',[P[5]]: 'iscano' },
	'congiuntivo imperfetto':        { [P[0]]: 'issi', [P[1]]: 'issi', [P[2]]: 'isse', [P[3]]: 'issimo',[P[4]]: 'iste',[P[5]]: 'issero' },
	'condizionale presente':         { [P[0]]: 'irei', [P[1]]: 'iresti',[P[2]]: 'irebbe',[P[3]]: 'iremmo',[P[4]]: 'ireste',[P[5]]: 'irebbero' },
	'imperativo':                    { [P[1]]: 'isci', [P[2]]: 'isca', [P[3]]: 'iamo', [P[4]]: 'ite',  [P[5]]: 'iscano' },
};

/** -ciare/-giare variants: drop stem's i before i-initial endings */
const CIARE_PRESENTE: Endings = {
	[P[0]]: 'o', [P[1]]: 'i',   [P[2]]: 'a', [P[3]]: 'iamo', [P[4]]: 'ate', [P[5]]: 'ano'
};
const CIARE_CONG_PRES: Endings = {
	[P[0]]: 'i', [P[1]]: 'i', [P[2]]: 'i', [P[3]]: 'iamo', [P[4]]: 'iate', [P[5]]: 'ino'
};

const SCIARE_PRESENTE: Endings = {
	[P[0]]: 'o', [P[1]]: 'i',   [P[2]]: 'a', [P[3]]: 'iamo', [P[4]]: 'ate', [P[5]]: 'ano'
};
const SCIARE_CONG_PRES: Endings = {
	[P[0]]: 'i', [P[1]]: 'i', [P[2]]: 'i', [P[3]]: 'iamo', [P[4]]: 'iate', [P[5]]: 'ino'
};

// ─── Auxiliary conjugation tables (avere / essere in every tense) ───────────

/** Conjugation entries for auxiliary verbs in all tenses */
const AUX: Record<'avere' | 'essere', Record<Tense, Record<string, string>>> = {
	avere: {
		'indicativo presente': { io: 'ho', tu: 'hai', 'lui/lei': 'ha', noi: 'abbiamo', voi: 'avete', loro: 'hanno' },
		'passato prossimo': { io: 'ho avuto', tu: 'hai avuto', 'lui/lei': 'ha avuto', noi: 'abbiamo avuto', voi: 'avete avuto', loro: 'hanno avuto' },
		'imperfetto': { io: 'avevo', tu: 'avevi', 'lui/lei': 'aveva', noi: 'avevamo', voi: 'avevate', loro: 'avevano' },
		'trapassato prossimo': { io: 'avevo avuto', tu: 'avevi avuto', 'lui/lei': 'aveva avuto', noi: 'avevamo avuto', voi: 'avevate avuto', loro: 'avevano avuto' },
		'passato remoto': { io: 'ebbi', tu: 'avesti', 'lui/lei': 'ebbe', noi: 'avemmo', voi: 'aveste', loro: 'ebbero' },
		'trapassato remoto': { io: 'ebbi avuto', tu: 'avesti avuto', 'lui/lei': 'ebbe avuto', noi: 'avemmo avuto', voi: 'aveste avuto', loro: 'ebbero avuto' },
		'futuro semplice': { io: 'avrò', tu: 'avrai', 'lui/lei': 'avrà', noi: 'avremo', voi: 'avrete', loro: 'avranno' },
		'futuro anteriore': { io: 'avrò avuto', tu: 'avrai avuto', 'lui/lei': 'avrà avuto', noi: 'avremo avuto', voi: 'avrete avuto', loro: 'avranno avuto' },
		'congiuntivo presente': { io: 'abbia', tu: 'abbia', 'lui/lei': 'abbia', noi: 'abbiamo', voi: 'abbiate', loro: 'abbiano' },
		'congiuntivo passato': { io: 'abbia avuto', tu: 'abbia avuto', 'lui/lei': 'abbia avuto', noi: 'abbiamo avuto', voi: 'abbiate avuto', loro: 'abbiano avuto' },
		'congiuntivo imperfetto': { io: 'avessi', tu: 'avessi', 'lui/lei': 'avesse', noi: 'avessimo', voi: 'aveste', loro: 'avessero' },
		'congiuntivo trapassato': { io: 'avessi avuto', tu: 'avessi avuto', 'lui/lei': 'avesse avuto', noi: 'avessimo avuto', voi: 'aveste avuto', loro: 'avessero avuto' },
		'condizionale presente': { io: 'avrei', tu: 'avresti', 'lui/lei': 'avrebbe', noi: 'avremmo', voi: 'avreste', loro: 'avrebbero' },
		'condizionale passato': { io: 'avrei avuto', tu: 'avresti avuto', 'lui/lei': 'avrebbe avuto', noi: 'avremmo avuto', voi: 'avreste avuto', loro: 'avrebbero avuto' },
		'imperativo': { tu: 'abbi', 'lui/lei': 'abbia', noi: 'abbiamo', voi: 'abbiate', loro: 'abbiano' },
		'infinito presente': { io: 'avere' },
		'infinito passato': { io: 'avere avuto' },
		'participio presente': { io: 'avente' },
		'participio passato': { io: 'avuto' },
		'gerundio presente': { io: 'avendo' },
		'gerundio passato': { io: 'avendo avuto' },
	},
	essere: {
		'indicativo presente': { io: 'sono', tu: 'sei', 'lui/lei': 'è', noi: 'siamo', voi: 'siete', loro: 'sono' },
		'passato prossimo': { io: 'sono stato', tu: 'sei stato', 'lui/lei': 'è stato', noi: 'siamo stati', voi: 'siete stati', loro: 'sono stati' },
		'imperfetto': { io: 'ero', tu: 'eri', 'lui/lei': 'era', noi: 'eravamo', voi: 'eravate', loro: 'erano' },
		'trapassato prossimo': { io: 'ero stato', tu: 'eri stato', 'lui/lei': 'era stato', noi: 'eravamo stati', voi: 'eravate stati', loro: 'erano stati' },
		'passato remoto': { io: 'fui', tu: 'fosti', 'lui/lei': 'fu', noi: 'fummo', voi: 'foste', loro: 'furono' },
		'trapassato remoto': { io: 'fui stato', tu: 'fosti stato', 'lui/lei': 'fu stato', noi: 'fummo stati', voi: 'foste stati', loro: 'furono stati' },
		'futuro semplice': { io: 'sarò', tu: 'sarai', 'lui/lei': 'sarà', noi: 'saremo', voi: 'sarete', loro: 'saranno' },
		'futuro anteriore': { io: 'sarò stato', tu: 'sarai stato', 'lui/lei': 'sarà stato', noi: 'saremo stati', voi: 'sarete stati', loro: 'saranno stati' },
		'congiuntivo presente': { io: 'sia', tu: 'sia', 'lui/lei': 'sia', noi: 'siamo', voi: 'siate', loro: 'siano' },
		'congiuntivo passato': { io: 'sia stato', tu: 'sia stato', 'lui/lei': 'sia stato', noi: 'siamo stati', voi: 'siate stati', loro: 'siano stati' },
		'congiuntivo imperfetto': { io: 'fossi', tu: 'fossi', 'lui/lei': 'fosse', noi: 'fossimo', voi: 'foste', loro: 'fossero' },
		'congiuntivo trapassato': { io: 'fossi stato', tu: 'fossi stato', 'lui/lei': 'fosse stato', noi: 'fossimo stati', voi: 'foste stati', loro: 'fossero stati' },
		'condizionale presente': { io: 'sarei', tu: 'saresti', 'lui/lei': 'sarebbe', noi: 'saremmo', voi: 'sareste', loro: 'sarebbero' },
		'condizionale passato': { io: 'sarei stato', tu: 'saresti stato', 'lui/lei': 'sarebbe stato', noi: 'saremmo stati', voi: 'sareste stati', loro: 'sarebbero stati' },
		'imperativo': { tu: 'sii', 'lui/lei': 'sia', noi: 'siamo', voi: 'siate', loro: 'siano' },
		'infinito presente': { io: 'essere' },
		'infinito passato': { io: 'essere stato' },
		'participio presente': { io: 'ente' },
		'participio passato': { io: 'stato' },
		'gerundio presente': { io: 'essendo' },
		'gerundio passato': { io: 'essendo stato' },
	}
};

/** Tenses whose conjugation is a single word (simple tenses) */
const SIMPLE_TENSES: Tense[] = [
	'indicativo presente', 'imperfetto', 'passato remoto', 'futuro semplice',
	'congiuntivo presente', 'congiuntivo imperfetto', 'condizionale presente',
	'imperativo', 'infinito presente', 'participio presente', 'participio passato', 'gerundio presente'
];

/** Compound tenses: auxiliary in tense T + past participle.
 *  Defined as [auxiliaryTense, pastParticipleSuffix] */
const COMPOUND_TENSE_MAP: Record<Tense, { auxTense: Tense } | null> = {
	'indicativo presente': null,
	'passato prossimo': { auxTense: 'indicativo presente' },
	'imperfetto': null,
	'trapassato prossimo': { auxTense: 'imperfetto' },
	'passato remoto': null,
	'trapassato remoto': { auxTense: 'passato remoto' },
	'futuro semplice': null,
	'futuro anteriore': { auxTense: 'futuro semplice' },
	'congiuntivo presente': null,
	'congiuntivo passato': { auxTense: 'congiuntivo presente' },
	'congiuntivo imperfetto': null,
	'congiuntivo trapassato': { auxTense: 'congiuntivo imperfetto' },
	'condizionale presente': null,
	'condizionale passato': { auxTense: 'condizionale presente' },
	'imperativo': null,
	'infinito presente': null,
	'infinito passato': { auxTense: 'infinito presente' },
	'participio presente': null,
	'participio passato': null,
	'gerundio presente': null,
	'gerundio passato': { auxTense: 'gerundio presente' },
};

// ─── Irregular conjugation overrides ────────────────────────────────────────

type TenseData = Record<string, Partial<Record<Person, string>>>;

const IRREGULAR: Record<string, TenseData> = {
	// ── ESSERE ───────────────────────────────────────────────────────────────
	essere: {
		'indicativo presente':  { io: 'sono', tu: 'sei', 'lui/lei': 'è', noi: 'siamo', voi: 'siete', loro: 'sono' },
		'imperfetto':           { io: 'ero', tu: 'eri', 'lui/lei': 'era', noi: 'eravamo', voi: 'eravate', loro: 'erano' },
		'passato remoto':       { io: 'fui', tu: 'fosti', 'lui/lei': 'fu', noi: 'fummo', voi: 'foste', loro: 'furono' },
		'futuro semplice':      { io: 'sarò', tu: 'sarai', 'lui/lei': 'sarà', noi: 'saremo', voi: 'sarete', loro: 'saranno' },
		'congiuntivo presente': { io: 'sia', tu: 'sia', 'lui/lei': 'sia', noi: 'siamo', voi: 'siate', loro: 'siano' },
		'congiuntivo imperfetto': { io: 'fossi', tu: 'fossi', 'lui/lei': 'fosse', noi: 'fossimo', voi: 'foste', loro: 'fossero' },
		'condizionale presente': { io: 'sarei', tu: 'saresti', 'lui/lei': 'sarebbe', noi: 'saremmo', voi: 'sareste', loro: 'sarebbero' },
		'imperativo':           { tu: 'sii', 'lui/lei': 'sia', noi: 'siamo', voi: 'siate', loro: 'siano' },
		'infinito presente':    { io: 'essere' },
		'participio presente':  { io: 'ente' },
		'participio passato':   { io: 'stato' },
		'gerundio presente':    { io: 'essendo' },
	},
	// ── AVERE ────────────────────────────────────────────────────────────────
	avere: {
		'indicativo presente':  { io: 'ho', tu: 'hai', 'lui/lei': 'ha', noi: 'abbiamo', voi: 'avete', loro: 'hanno' },
		'imperfetto':           { io: 'avevo', tu: 'avevi', 'lui/lei': 'aveva', noi: 'avevamo', voi: 'avevate', loro: 'avevano' },
		'passato remoto':       { io: 'ebbi', tu: 'avesti', 'lui/lei': 'ebbe', noi: 'avemmo', voi: 'aveste', loro: 'ebbero' },
		'futuro semplice':      { io: 'avrò', tu: 'avrai', 'lui/lei': 'avrà', noi: 'avremo', voi: 'avrete', loro: 'avranno' },
		'congiuntivo presente': { io: 'abbia', tu: 'abbia', 'lui/lei': 'abbia', noi: 'abbiamo', voi: 'abbiate', loro: 'abbiano' },
		'congiuntivo imperfetto': { io: 'avessi', tu: 'avessi', 'lui/lei': 'avesse', noi: 'avessimo', voi: 'aveste', loro: 'avessero' },
		'condizionale presente': { io: 'avrei', tu: 'avresti', 'lui/lei': 'avrebbe', noi: 'avremmo', voi: 'avreste', loro: 'avrebbero' },
		'imperativo':           { tu: 'abbi', 'lui/lei': 'abbia', noi: 'abbiamo', voi: 'abbiate', loro: 'abbiano' },
		'infinito presente':    { io: 'avere' },
		'participio presente':  { io: 'avente' },
		'participio passato':   { io: 'avuto' },
		'gerundio presente':    { io: 'avendo' },
	},
	// ── FARE ─────────────────────────────────────────────────────────────────
	fare: {
		'indicativo presente':  { io: 'faccio', tu: 'fai', 'lui/lei': 'fa', noi: 'facciamo', voi: 'fate', loro: 'fanno' },
		'imperfetto':           { io: 'facevo', tu: 'facevi', 'lui/lei': 'faceva', noi: 'facevamo', voi: 'facevate', loro: 'facevano' },
		'passato remoto':       { io: 'feci', tu: 'facesti', 'lui/lei': 'fece', noi: 'facemmo', voi: 'faceste', loro: 'fecero' },
		'futuro semplice':      { io: 'farò', tu: 'farai', 'lui/lei': 'farà', noi: 'faremo', voi: 'farete', loro: 'faranno' },
		'congiuntivo presente': { io: 'faccia', tu: 'faccia', 'lui/lei': 'faccia', noi: 'facciamo', voi: 'facciate', loro: 'facciano' },
		'congiuntivo imperfetto': { io: 'facessi', tu: 'facessi', 'lui/lei': 'facesse', noi: 'facessimo', voi: 'faceste', loro: 'facessero' },
		'condizionale presente': { io: 'farei', tu: 'faresti', 'lui/lei': 'farebbe', noi: 'faremmo', voi: 'fareste', loro: 'farebbero' },
		'imperativo':           { tu: 'fa\'', 'lui/lei': 'faccia', noi: 'facciamo', voi: 'fate', loro: 'facciano' },
		'infinito presente':    { io: 'fare' },
		'participio presente':  { io: 'facente' },
		'participio passato':   { io: 'fatto' },
		'gerundio presente':    { io: 'facendo' },
	},
	// ── DIRE ─────────────────────────────────────────────────────────────────
	dire: {
		'indicativo presente':  { io: 'dico', tu: 'dici', 'lui/lei': 'dice', noi: 'diciamo', voi: 'dite', loro: 'dicono' },
		'imperfetto':           { io: 'dicevo', tu: 'dicevi', 'lui/lei': 'diceva', noi: 'dicevamo', voi: 'dicevate', loro: 'dicevano' },
		'passato remoto':       { io: 'dissi', tu: 'dicesti', 'lui/lei': 'disse', noi: 'dicemmo', voi: 'diceste', loro: 'dissero' },
		'futuro semplice':      { io: 'dirò', tu: 'dirai', 'lui/lei': 'dirà', noi: 'diremo', voi: 'direte', loro: 'diranno' },
		'congiuntivo presente': { io: 'dica', tu: 'dica', 'lui/lei': 'dica', noi: 'diciamo', voi: 'diciate', loro: 'dicano' },
		'congiuntivo imperfetto': { io: 'dicessi', tu: 'dicessi', 'lui/lei': 'dicesse', noi: 'dicessimo', voi: 'diceste', loro: 'dicessero' },
		'condizionale presente': { io: 'direi', tu: 'diresti', 'lui/lei': 'direbbe', noi: 'diremmo', voi: 'direste', loro: 'direbbero' },
		'imperativo':           { tu: 'di\'', 'lui/lei': 'dica', noi: 'diciamo', voi: 'dite', loro: 'dicano' },
		'infinito presente':    { io: 'dire' },
		'participio presente':  { io: 'dicente' },
		'participio passato':   { io: 'detto' },
		'gerundio presente':    { io: 'dicendo' },
	},
	// ── ANDARE ───────────────────────────────────────────────────────────────
	andare: {
		'indicativo presente':  { io: 'vado', tu: 'vai', 'lui/lei': 'va', noi: 'andiamo', voi: 'andate', loro: 'vanno' },
		'imperfetto':           { io: 'andavo', tu: 'andavi', 'lui/lei': 'andava', noi: 'andavamo', voi: 'andavate', loro: 'andavano' },
		'passato remoto':       { io: 'andai', tu: 'andasti', 'lui/lei': 'andò', noi: 'andammo', voi: 'andaste', loro: 'andarono' },
		'futuro semplice':      { io: 'andrò', tu: 'andrai', 'lui/lei': 'andrà', noi: 'andremo', voi: 'andrete', loro: 'andranno' },
		'congiuntivo presente': { io: 'vada', tu: 'vada', 'lui/lei': 'vada', noi: 'andiamo', voi: 'andiate', loro: 'vadano' },
		'congiuntivo imperfetto': { io: 'andassi', tu: 'andassi', 'lui/lei': 'andasse', noi: 'andassimo', voi: 'andaste', loro: 'andassero' },
		'condizionale presente': { io: 'andrei', tu: 'andresti', 'lui/lei': 'andrebbe', noi: 'andremmo', voi: 'andreste', loro: 'andrebbero' },
		'imperativo':           { tu: 'va\'', 'lui/lei': 'vada', noi: 'andiamo', voi: 'andate', loro: 'vadano' },
		'infinito presente':    { io: 'andare' },
		'participio presente':  { io: 'andante' },
		'participio passato':   { io: 'andato' },
		'gerundio presente':    { io: 'andando' },
	},
	// ── POTERE ───────────────────────────────────────────────────────────────
	potere: {
		'indicativo presente':  { io: 'posso', tu: 'puoi', 'lui/lei': 'può', noi: 'possiamo', voi: 'potete', loro: 'possono' },
		'imperfetto':           { io: 'potevo', tu: 'potevi', 'lui/lei': 'poteva', noi: 'potevamo', voi: 'potevate', loro: 'potevano' },
		'passato remoto':       { io: 'potei', tu: 'potesti', 'lui/lei': 'poté', noi: 'potemmo', voi: 'poteste', loro: 'poterono' },
		'futuro semplice':      { io: 'potrò', tu: 'potrai', 'lui/lei': 'potrà', noi: 'potremo', voi: 'potrete', loro: 'potranno' },
		'congiuntivo presente': { io: 'possa', tu: 'possa', 'lui/lei': 'possa', noi: 'possiamo', voi: 'possiate', loro: 'possano' },
		'congiuntivo imperfetto': { io: 'potessi', tu: 'potessi', 'lui/lei': 'potesse', noi: 'potessimo', voi: 'poteste', loro: 'potessero' },
		'condizionale presente': { io: 'potrei', tu: 'potresti', 'lui/lei': 'potrebbe', noi: 'potremmo', voi: 'potreste', loro: 'potrebbero' },
		'imperativo':           { tu: 'possi', 'lui/lei': 'possa', noi: 'possiamo', voi: 'possiate', loro: 'possano' },
		'infinito presente':    { io: 'potere' },
		'participio presente':  { io: 'potente' },
		'participio passato':   { io: 'potuto' },
		'gerundio presente':    { io: 'potendo' },
	},
	// ── VOLERE ───────────────────────────────────────────────────────────────
	volere: {
		'indicativo presente':  { io: 'voglio', tu: 'vuoi', 'lui/lei': 'vuole', noi: 'vogliamo', voi: 'volete', loro: 'vogliono' },
		'imperfetto':           { io: 'volevo', tu: 'volevi', 'lui/lei': 'voleva', noi: 'volevamo', voi: 'volevate', loro: 'volevano' },
		'passato remoto':       { io: 'volli', tu: 'volesti', 'lui/lei': 'volle', noi: 'volemmo', voi: 'voleste', loro: 'vollero' },
		'futuro semplice':      { io: 'vorrò', tu: 'vorrai', 'lui/lei': 'vorrà', noi: 'vorremo', voi: 'vorrete', loro: 'vorranno' },
		'congiuntivo presente': { io: 'voglia', tu: 'voglia', 'lui/lei': 'voglia', noi: 'vogliamo', voi: 'vogliate', loro: 'vogliano' },
		'congiuntivo imperfetto': { io: 'volessi', tu: 'volessi', 'lui/lei': 'volesse', noi: 'volessimo', voi: 'voleste', loro: 'volessero' },
		'condizionale presente': { io: 'vorrei', tu: 'vorresti', 'lui/lei': 'vorrebbe', noi: 'vorremmo', voi: 'vorreste', loro: 'vorrebbero' },
		'imperativo':           { tu: 'vogli', 'lui/lei': 'voglia', noi: 'vogliamo', voi: 'vogliate', loro: 'vogliano' },
		'infinito presente':    { io: 'volere' },
		'participio presente':  { io: 'volente' },
		'participio passato':   { io: 'voluto' },
		'gerundio presente':    { io: 'volendo' },
	},
	// ── DOVERE ───────────────────────────────────────────────────────────────
	dovere: {
		'indicativo presente':  { io: 'devo', tu: 'devi', 'lui/lei': 'deve', noi: 'dobbiamo', voi: 'dovete', loro: 'devono' },
		'imperfetto':           { io: 'dovevo', tu: 'dovevi', 'lui/lei': 'doveva', noi: 'dovevamo', voi: 'dovevate', loro: 'dovevano' },
		'passato remoto':       { io: 'dovei', tu: 'dovesti', 'lui/lei': 'dovette', noi: 'dovemmo', voi: 'doveste', loro: 'dovettero' },
		'futuro semplice':      { io: 'dovrò', tu: 'dovrai', 'lui/lei': 'dovrà', noi: 'dovremo', voi: 'dovrete', loro: 'dovranno' },
		'congiuntivo presente': { io: 'debba', tu: 'debba', 'lui/lei': 'debba', noi: 'dobbiamo', voi: 'dobbiate', loro: 'debbano' },
		'congiuntivo imperfetto': { io: 'dovessi', tu: 'dovessi', 'lui/lei': 'dovesse', noi: 'dovessimo', voi: 'doveste', loro: 'dovessero' },
		'condizionale presente': { io: 'dovrei', tu: 'dovresti', 'lui/lei': 'dovrebbe', noi: 'dovremmo', voi: 'dovreste', loro: 'dovrebbero' },
		'imperativo':           { tu: 'devi', 'lui/lei': 'debba', noi: 'dobbiamo', voi: 'dovete', loro: 'debbano' },
		'infinito presente':    { io: 'dovere' },
		'participio presente':  { io: 'dovente' },
		'participio passato':   { io: 'dovuto' },
		'gerundio presente':    { io: 'dovendo' },
	},
	// ── VEDERE ───────────────────────────────────────────────────────────────
	vedere: {
		'indicativo presente':  { io: 'vedo', tu: 'vedi', 'lui/lei': 'vede', noi: 'vediamo', voi: 'vedete', loro: 'vedono' },
		'imperfetto':           { io: 'vedevo', tu: 'vedevi', 'lui/lei': 'vedeva', noi: 'vedevamo', voi: 'vedevate', loro: 'vedevano' },
		'passato remoto':       { io: 'vidi', tu: 'vedesti', 'lui/lei': 'vide', noi: 'vedemmo', voi: 'vedeste', loro: 'videro' },
		'futuro semplice':      { io: 'vedrò', tu: 'vedrai', 'lui/lei': 'vedrà', noi: 'vedremo', voi: 'vedrete', loro: 'vedranno' },
		'congiuntivo presente': { io: 'veda', tu: 'veda', 'lui/lei': 'veda', noi: 'vediamo', voi: 'vediate', loro: 'vedano' },
		'congiuntivo imperfetto': { io: 'vedessi', tu: 'vedessi', 'lui/lei': 'vedesse', noi: 'vedessimo', voi: 'vedeste', loro: 'vedessero' },
		'condizionale presente': { io: 'vedrei', tu: 'vedresti', 'lui/lei': 'vedrebbe', noi: 'vedremmo', voi: 'vedreste', loro: 'vedrebbero' },
		'imperativo':           { tu: 'vedi', 'lui/lei': 'veda', noi: 'vediamo', voi: 'vedete', loro: 'vedano' },
		'infinito presente':    { io: 'vedere' },
		'participio presente':  { io: 'vedente' },
		'participio passato':   { io: 'visto' },
		'gerundio presente':    { io: 'vedendo' },
	},
	// ── SAPERE ───────────────────────────────────────────────────────────────
	sapere: {
		'indicativo presente':  { io: 'so', tu: 'sai', 'lui/lei': 'sa', noi: 'sappiamo', voi: 'sapete', loro: 'sanno' },
		'imperfetto':           { io: 'sapevo', tu: 'sapevi', 'lui/lei': 'sapeva', noi: 'sapevamo', voi: 'sapevate', loro: 'sapevano' },
		'passato remoto':       { io: 'seppi', tu: 'sapesti', 'lui/lei': 'seppe', noi: 'sapemmo', voi: 'sapeste', loro: 'seppero' },
		'futuro semplice':      { io: 'saprò', tu: 'saprai', 'lui/lei': 'saprà', noi: 'sapremo', voi: 'saprete', loro: 'sapranno' },
		'congiuntivo presente': { io: 'sappia', tu: 'sappia', 'lui/lei': 'sappia', noi: 'sappiamo', voi: 'sappiate', loro: 'sappiano' },
		'congiuntivo imperfetto': { io: 'sapessi', tu: 'sapessi', 'lui/lei': 'sapesse', noi: 'sapessimo', voi: 'sapeste', loro: 'sapessero' },
		'condizionale presente': { io: 'saprei', tu: 'sapresti', 'lui/lei': 'saprebbe', noi: 'sapremmo', voi: 'sapreste', loro: 'saprebbero' },
		'imperativo':           { tu: 'sappi', 'lui/lei': 'sappia', noi: 'sappiamo', voi: 'sappiate', loro: 'sappiano' },
		'infinito presente':    { io: 'sapere' },
		'participio presente':  { io: 'sapiente' },
		'participio passato':   { io: 'saputo' },
		'gerundio presente':    { io: 'sapendo' },
	},
	// ── STARE ─────────────────────────────────────────────────────────────────
	stare: {
		'indicativo presente':  { io: 'sto', tu: 'stai', 'lui/lei': 'sta', noi: 'stiamo', voi: 'state', loro: 'stanno' },
		'imperfetto':           { io: 'stavo', tu: 'stavi', 'lui/lei': 'stava', noi: 'stavamo', voi: 'stavate', loro: 'stavano' },
		'passato remoto':       { io: 'stetti', tu: 'stesti', 'lui/lei': 'stette', noi: 'stemmo', voi: 'steste', loro: 'stettero' },
		'futuro semplice':      { io: 'starò', tu: 'starai', 'lui/lei': 'starà', noi: 'staremo', voi: 'starete', loro: 'staranno' },
		'congiuntivo presente': { io: 'stia', tu: 'stia', 'lui/lei': 'stia', noi: 'stiamo', voi: 'stiate', loro: 'stiano' },
		'congiuntivo imperfetto': { io: 'stessi', tu: 'stessi', 'lui/lei': 'stesse', noi: 'stessimo', voi: 'steste', loro: 'stessero' },
		'condizionale presente': { io: 'starei', tu: 'staresti', 'lui/lei': 'starebbe', noi: 'staremmo', voi: 'stareste', loro: 'starebbero' },
		'imperativo':           { tu: 'sta\'', 'lui/lei': 'stia', noi: 'stiamo', voi: 'state', loro: 'stiano' },
		'infinito presente':    { io: 'stare' },
		'participio presente':  { io: 'stante' },
		'participio passato':   { io: 'stato' },
		'gerundio presente':    { io: 'stando' },
	},
	// ── DARE ──────────────────────────────────────────────────────────────────
	dare: {
		'indicativo presente':  { io: 'do', tu: 'dai', 'lui/lei': 'dà', noi: 'diamo', voi: 'date', loro: 'danno' },
		'imperfetto':           { io: 'davo', tu: 'davi', 'lui/lei': 'dava', noi: 'davamo', voi: 'davate', loro: 'davano' },
		'passato remoto':       { io: 'diedi', tu: 'desti', 'lui/lei': 'diede', noi: 'demmo', voi: 'deste', loro: 'diedero' },
		'futuro semplice':      { io: 'darò', tu: 'darai', 'lui/lei': 'darà', noi: 'daremo', voi: 'darete', loro: 'daranno' },
		'congiuntivo presente': { io: 'dia', tu: 'dia', 'lui/lei': 'dia', noi: 'diamo', voi: 'diate', loro: 'diano' },
		'congiuntivo imperfetto': { io: 'dessi', tu: 'dessi', 'lui/lei': 'desse', noi: 'dessimo', voi: 'deste', loro: 'dessero' },
		'condizionale presente': { io: 'darei', tu: 'daresti', 'lui/lei': 'darebbe', noi: 'daremmo', voi: 'dareste', loro: 'darebbero' },
		'imperativo':           { tu: 'da\'', 'lui/lei': 'dia', noi: 'diamo', voi: 'date', loro: 'diano' },
		'infinito presente':    { io: 'dare' },
		'participio presente':  { io: 'dante' },
		'participio passato':   { io: 'dato' },
		'gerundio presente':    { io: 'dando' },
	},
	// ── BERE ──────────────────────────────────────────────────────────────────
	bere: {
		'indicativo presente':  { io: 'bevo', tu: 'bevi', 'lui/lei': 'beve', noi: 'beviamo', voi: 'bevete', loro: 'bevono' },
		'imperfetto':           { io: 'bevevo', tu: 'bevevi', 'lui/lei': 'beveva', noi: 'bevevamo', voi: 'bevevate', loro: 'bevevano' },
		'passato remoto':       { io: 'bevvi', tu: 'bevesti', 'lui/lei': 'bevve', noi: 'bevemmo', voi: 'beveste', loro: 'bevvero' },
		'futuro semplice':      { io: 'berrò', tu: 'berrai', 'lui/lei': 'berrà', noi: 'berremo', voi: 'berrete', loro: 'berranno' },
		'congiuntivo presente': { io: 'beva', tu: 'beva', 'lui/lei': 'beva', noi: 'beviamo', voi: 'beviate', loro: 'bevano' },
		'congiuntivo imperfetto': { io: 'bevessi', tu: 'bevessi', 'lui/lei': 'bevesse', noi: 'bevessimo', voi: 'beveste', loro: 'bevessero' },
		'condizionale presente': { io: 'berrei', tu: 'berresti', 'lui/lei': 'berrebbe', noi: 'berremmo', voi: 'berreste', loro: 'berrebbero' },
		'imperativo':           { tu: 'bevi', 'lui/lei': 'beva', noi: 'beviamo', voi: 'bevete', loro: 'bevano' },
		'infinito presente':    { io: 'bere' },
		'participio presente':  { io: 'bevente' },
		'participio passato':   { io: 'bevuto' },
		'gerundio presente':    { io: 'bevendo' },
	},
	// ── PRENDERE ──────────────────────────────────────────────────────────────
	prendere: {
		'passato remoto':       { io: 'presi', tu: 'prendesti', 'lui/lei': 'prese', noi: 'prendemmo', voi: 'prendeste', loro: 'presero' },
		'participio passato':   { io: 'preso' },
		'infinito presente':    { io: 'prendere' },
		'participio presente':  { io: 'prendente' },
		'gerundio presente':    { io: 'prendendo' },
	},
	// ── METTERE ───────────────────────────────────────────────────────────────
	mettere: {
		'indicativo presente':  { io: 'metto', tu: 'metti', 'lui/lei': 'mette', noi: 'mettiamo', voi: 'mettete', loro: 'mettono' },
		'imperfetto':           { io: 'mettevo', tu: 'mettevi', 'lui/lei': 'metteva', noi: 'mettevamo', voi: 'mettevate', loro: 'mettevano' },
		'passato remoto':       { io: 'misi', tu: 'mettesti', 'lui/lei': 'mise', noi: 'mettemmo', voi: 'metteste', loro: 'misero' },
		'futuro semplice':      { io: 'metterò', tu: 'metterai', 'lui/lei': 'metterà', noi: 'metteremo', voi: 'metterete', loro: 'metteranno' },
		'congiuntivo presente': { io: 'metta', tu: 'metta', 'lui/lei': 'metta', noi: 'mettiamo', voi: 'mettiate', loro: 'mettano' },
		'congiuntivo imperfetto': { io: 'mettessi', tu: 'mettessi', 'lui/lei': 'mettesse', noi: 'mettessimo', voi: 'metteste', loro: 'mettessero' },
		'condizionale presente': { io: 'metterei', tu: 'metteresti', 'lui/lei': 'metterebbe', noi: 'metteremmo', voi: 'mettereste', loro: 'metterebbero' },
		'imperativo':           { tu: 'metti', 'lui/lei': 'metta', noi: 'mettiamo', voi: 'mettete', loro: 'mettano' },
		'infinito presente':    { io: 'mettere' },
		'participio presente':  { io: 'mettente' },
		'participio passato':   { io: 'messo' },
		'gerundio presente':    { io: 'mettendo' },
	},
	// ── VENIRE ────────────────────────────────────────────────────────────────
	venire: {
		'indicativo presente':  { io: 'vengo', tu: 'vieni', 'lui/lei': 'viene', noi: 'veniamo', voi: 'venite', loro: 'vengono' },
		'imperfetto':           { io: 'venivo', tu: 'venivi', 'lui/lei': 'veniva', noi: 'venivamo', voi: 'venivate', loro: 'venivano' },
		'passato remoto':       { io: 'venni', tu: 'venisti', 'lui/lei': 'venne', noi: 'venimmo', voi: 'veniste', loro: 'vennero' },
		'futuro semplice':      { io: 'verrò', tu: 'verrai', 'lui/lei': 'verrà', noi: 'verremo', voi: 'verrete', loro: 'verranno' },
		'congiuntivo presente': { io: 'venga', tu: 'venga', 'lui/lei': 'venga', noi: 'veniamo', voi: 'veniate', loro: 'vengano' },
		'congiuntivo imperfetto': { io: 'venissi', tu: 'venissi', 'lui/lei': 'venisse', noi: 'venissimo', voi: 'veniste', loro: 'venissero' },
		'condizionale presente': { io: 'verrei', tu: 'verresti', 'lui/lei': 'verrebbe', noi: 'verremmo', voi: 'verreste', loro: 'verrebbero' },
		'imperativo':           { tu: 'vieni', 'lui/lei': 'venga', noi: 'veniamo', voi: 'venite', loro: 'vengano' },
		'infinito presente':    { io: 'venire' },
		'participio presente':  { io: 'veniente' },
		'participio passato':   { io: 'venuto' },
		'gerundio presente':    { io: 'venendo' },
	},
	// ── USCIRE ────────────────────────────────────────────────────────────────
	uscire: {
		'indicativo presente':  { io: 'esco', tu: 'esci', 'lui/lei': 'esce', noi: 'usciamo', voi: 'uscite', loro: 'escono' },
		'imperfetto':           { io: 'uscivo', tu: 'uscivi', 'lui/lei': 'usciva', noi: 'uscivamo', voi: 'uscivate', loro: 'uscivano' },
		'passato remoto':       { io: 'uscii', tu: 'uscisti', 'lui/lei': 'uscì', noi: 'uscimmo', voi: 'usciste', loro: 'uscirono' },
		'futuro semplice':      { io: 'uscirò', tu: 'uscirai', 'lui/lei': 'uscirà', noi: 'usciremo', voi: 'uscirete', loro: 'usciranno' },
		'congiuntivo presente': { io: 'esca', tu: 'esca', 'lui/lei': 'esca', noi: 'usciamo', voi: 'usciate', loro: 'escano' },
		'congiuntivo imperfetto': { io: 'uscissi', tu: 'uscissi', 'lui/lei': 'uscisse', noi: 'uscissimo', voi: 'usciste', loro: 'uscissero' },
		'condizionale presente': { io: 'uscirei', tu: 'usciresti', 'lui/lei': 'uscirebbe', noi: 'usciremmo', voi: 'uscireste', loro: 'uscirebbero' },
		'imperativo':           { tu: 'esci', 'lui/lei': 'esca', noi: 'usciamo', voi: 'uscite', loro: 'escano' },
		'infinito presente':    { io: 'uscire' },
		'participio presente':  { io: 'uscente' },
		'participio passato':   { io: 'uscito' },
		'gerundio presente':    { io: 'uscendo' },
	},
	// ── VIVERE ────────────────────────────────────────────────────────────────
	vivere: {
		'indicativo presente':  { io: 'vivo', tu: 'vivi', 'lui/lei': 'vive', noi: 'viviamo', voi: 'vivete', loro: 'vivono' },
		'imperfetto':           { io: 'vivevo', tu: 'vivevi', 'lui/lei': 'viveva', noi: 'vivevamo', voi: 'vivevate', loro: 'vivevano' },
		'passato remoto':       { io: 'vissi', tu: 'vivesti', 'lui/lei': 'visse', noi: 'vivemmo', voi: 'viveste', loro: 'vissero' },
		'futuro semplice':      { io: 'vivrò', tu: 'vivrai', 'lui/lei': 'vivrà', noi: 'vivremo', voi: 'vivrete', loro: 'vivranno' },
		'congiuntivo presente': { io: 'viva', tu: 'viva', 'lui/lei': 'viva', noi: 'viviamo', voi: 'viviate', loro: 'vivano' },
		'congiuntivo imperfetto': { io: 'vivessi', tu: 'vivessi', 'lui/lei': 'vivesse', noi: 'vivessimo', voi: 'viveste', loro: 'vivessero' },
		'condizionale presente': { io: 'vivrei', tu: 'vivresti', 'lui/lei': 'vivrebbe', noi: 'vivremmo', voi: 'vivreste', loro: 'vivrebbero' },
		'imperativo':           { tu: 'vivi', 'lui/lei': 'viva', noi: 'viviamo', voi: 'vivete', loro: 'vivano' },
		'infinito presente':    { io: 'vivere' },
		'participio presente':  { io: 'vivente' },
		'participio passato':   { io: 'vissuto' },
		'gerundio presente':    { io: 'vivendo' },
	},
};

// ─── Translation helpers ────────────────────────────────────────────────────

/**
 * English translation templates per tense.
 * {base}, {past}, {pp}, {ing}, {third} interpolated from verb's en config.
 */
function enTranslate(person: string, tense: Tense, en: VerbInfo['en']): string {
	const p = person as Person;
	const { base, past, pp, ing, third } = en;
	// Pronoun mapping
	const pro: Record<Person, string> = { io: 'I', tu: 'you', 'lui/lei': 'he/she', noi: 'we', voi: 'you all', loro: 'they' };
	const proObj: Record<Person, string> = { io: 'me', tu: 'you', 'lui/lei': 'him/her', noi: 'us', voi: 'you all', loro: 'them' };
	const proPoss: Record<Person, string> = { io: 'my', tu: 'your', 'lui/lei': 'his/her', noi: 'our', voi: 'your', loro: 'their' };

	switch (tense) {
		// ── Simple ──
		case 'indicativo presente':
			if ((p === 'lui/lei' || p === 'io') && base === 'be') return p === 'io' ? 'I am' : 'he/she is';
			return p === 'lui/lei' ? `he/she ${third}` : `${pro[p]} ${base}`;
			// note: "I have" not "I has", "you speak" not "you speaks"
		case 'imperfetto':
			if (base === 'be') return `${pro[p]} was/were`;
			return `${pro[p]} used to ${base}`;
		case 'passato remoto':
			return `${pro[p]} ${past}`;
		case 'futuro semplice':
			return `${pro[p]} will ${base}`;
		case 'congiuntivo presente':
			return `(that) ${pro[p]} ${base}`;
		case 'congiuntivo imperfetto':
			return `(that) ${pro[p]} ${past}`;
		case 'condizionale presente':
			return `${pro[p]} would ${base}`;
		case 'imperativo': {
			const imp: Record<string, string> = {
				tu: `(${pro.tu}) ${base}!`,
				'lui/lei': `(he/she) ${base}!`,
				noi: `let's ${base}!`,
				voi: `(you all) ${base}!`,
				loro: `(they) ${base}!`,
			};
			return imp[p] || `${pro[p]} ${base}!`;
		}
		case 'infinito presente':
			return `to ${base}`;
		case 'participio presente':
			return `${ing}`;
		case 'participio passato':
			return `${pp}`;
		case 'gerundio presente':
			return `${ing}`;
		// ── Compound ──
		case 'passato prossimo':
			return `${pro[p]} have ${pp}`;
		case 'trapassato prossimo':
			return `${pro[p]} had ${pp}`;
		case 'trapassato remoto':
			return `${pro[p]} had ${pp} (remote past)`;
		case 'futuro anteriore':
			return `${pro[p]} will have ${pp}`;
		case 'congiuntivo passato':
			return `(that) ${pro[p]} have ${pp}`;
		case 'congiuntivo trapassato':
			return `(that) ${pro[p]} had ${pp}`;
		case 'condizionale passato':
			return `${pro[p]} would have ${pp}`;
		case 'infinito passato':
			return `to have ${pp}`;
		case 'gerundio passato':
			return `having ${pp}`;
	}
	return '';
}

// ─── Conjugation generation ─────────────────────────────────────────────────

/** Build a conjugation for a simple tense using ending patterns */
function conjSimple(verb: Verb, tense: Tense, person: Person, endings: EndingsTable): string | null {
	const e = endings[tense];
	if (!e || !e[person]) return null;

	const info = VERB_INFO[verb];
	let stem = info.stem;

	// Handle -ciare/-giare orthographic: drop stem's i before i-starting endings
	if (info.class === 'are-ciare' || info.class === 'are-sciare') {
		const ending = e[person];
		if (ending.startsWith('i')) {
			stem = stem.slice(0, -1); // mangi → mang, lasci → lasc
		}
	}

	return stem + e[person];
}

/** Return the infinitive form for a verb (used for infinito presente) */
function infinitive(verb: Verb): string {
	const info = VERB_INFO[verb];
	if (info.class === 'irregular') {
		const irr = IRREGULAR[verb]?.['infinito presente']?.io;
		if (irr) return irr;
	}
	return verb; // Most verbs, the infinitive is the key itself
}

/** Return the gerund for regular verbs */
function gerundio(verb: Verb): string {
	const info = VERB_INFO[verb];
	switch (info.class) {
		case 'are': case 'are-ciare': case 'are-sciare': case 'are-irreg': return info.stem + 'ando';
		case 'ere': return info.stem + 'endo';
		case 'ire': case 'ire-isco': return info.stem + 'endo';
		case 'irregular': return ''; // should be in IRREGULAR
	}
}

/** Return the participio presente for regular verbs */
function participioPresente(verb: Verb): string {
	const info = VERB_INFO[verb];
	switch (info.class) {
		case 'are': case 'are-ciare': case 'are-sciare': case 'are-irreg': return info.stem + 'ante';
		case 'ere': return info.stem + 'ente';
		case 'ire': case 'ire-isco': return info.stem + 'ente';
		case 'irregular': return '';
	}
}

/** Return the participio passato for regular verbs */
function participioPassato(verb: Verb): string {
	return VERB_INFO[verb].pp;
}

/** Return the plural masculine participio passato (e.g. parlato → parlati) */
function participioPassatoPlural(verb: Verb): string {
	const pp = participioPassato(verb);
	// Italian past participles all end in -o for masculine singular; plural replaces -o with -i
	return pp.endsWith('o') ? pp.slice(0, -1) + 'i' : pp;
}

/** Get the ending patterns table for a verb class */
function endingsForClass(cls: VerbClass): EndingsTable {
	switch (cls) {
		case 'are': return ARE;
		case 'are-ciare': return { ...ARE,
			'indicativo presente': CIARE_PRESENTE,
			'congiuntivo presente': CIARE_CONG_PRES,
		};
		case 'are-sciare': return { ...ARE,
			'indicativo presente': SCIARE_PRESENTE,
			'congiuntivo presente': SCIARE_CONG_PRES,
		};
		case 'are-irreg': return ARE;
		case 'ere': return ERE;
		case 'ire': return IRE;
		case 'ire-isco': return IRE_ISCO;
		case 'irregular': return {};
	}
}

// ─── Build the conjugation table ────────────────────────────────────────────

function buildData(): Record<Verb, Record<Tense, Record<Person, { conjugation: string; translation: string }>>> {
	const data = {} as Record<Verb, Record<Tense, Record<Person, { conjugation: string; translation: string }>>>;

	for (const verb of ALL_VERBS) {
		const vData = {} as Record<Tense, Record<Person, { conjugation: string; translation: string }>>;
		const info = VERB_INFO[verb as Verb];

		for (const tense of ALL_TENSES) {
			const tData = {} as Record<Person, { conjugation: string; translation: string }>;
			const irrTense = IRREGULAR[verb]?.[tense];

			for (const person of ALL_PERSONS) {
				const p = person as Person;
				let conjugation: string;

				// 1. Check irregular override
				if (irrTense?.[p]) {
					conjugation = irrTense[p]!;
				}
				// 2. Check if it's a compound tense
				else if (COMPOUND_TENSE_MAP[tense]) {
					const auxTense = COMPOUND_TENSE_MAP[tense]!.auxTense;
					// Build compound: aux conjugated in auxTense + past participle
					const auxForm = AUX[info.aux][auxTense][p];
					// Past participle agrees in number when auxiliary is essere
					const needsPlural = info.aux === 'essere' && (p === 'noi' || p === 'voi' || p === 'loro');
					const pp = needsPlural ? participioPassatoPlural(verb as Verb) : participioPassato(verb as Verb);
					conjugation = `${auxForm} ${pp}`;
				}
				// 3. Check if it's a simple tense with patterns
				else {
					const endings = endingsForClass(info.class);
					const generated = conjSimple(verb as Verb, tense, p, endings);
					if (generated !== null) {
						conjugation = generated;
					}
					// 4. Fallback to infinitive-based forms (infinito, gerundio, participi)
					else if (tense === 'infinito presente') {
						conjugation = infinitive(verb as Verb);
					} else if (tense === 'gerundio presente') {
						conjugation = gerundio(verb as Verb);
					} else if (tense === 'participio presente') {
						conjugation = participioPresente(verb as Verb);
					} else if (tense === 'participio passato') {
						conjugation = participioPassato(verb as Verb);
					} else {
						// Should not happen if data is complete
						conjugation = '';
					}
				}

				const translation = enTranslate(p, tense, info.en);
				tData[p] = { conjugation, translation };
			}

			vData[tense] = tData;
		}

		data[verb as Verb] = vData;
	}

	return data;
}

// ─── Build and export ───────────────────────────────────────────────────────

const data = buildData();

/** Build a flat map keyed by "verb:tense:person" for O(1) lookup */
export function buildConjugationMap(): ConjugationMap {
	const map: ConjugationMap = new Map();
	for (const verb of ALL_VERBS) {
		for (const tense of ALL_TENSES) {
			for (const person of ALL_PERSONS) {
				const entry = data[verb][tense][person];
				map.set(`${verb}:${tense}:${person}`, {
					verb,
					tense,
					person,
					conjugation: entry.conjugation,
					translation: entry.translation
				});
			}
		}
	}
	return map;
}

export const conjugationMap: ConjugationMap = buildConjugationMap();
