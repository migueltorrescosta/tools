import type { Category, Comparison, Stimulus } from './types.js';

/** Our own word lists (Project Implicit's are research-only); see docs/implicit-association.md. */
const words = (label: string, list: string): Category => ({
	label,
	items: list.split(',').map((text): Stimulus => ({ kind: 'word', text: text.trim() }))
});

/** Faces from the Face Research Lab London Set (CC BY 4.0), cropped to 240 px. */
const faces = (label: string, slug: string, ids: string): Category => ({
	label,
	items: ids.split(',').map((id): Stimulus => ({
		kind: 'image',
		src: `/implicit-association/faces/${slug}-${id}.webp`,
		alt: `${label} face`
	}))
});

export const GOOD = words(
	'Good',
	'delight, kindness, smile, sunshine, gift, friend, cheer, warmth'
);
export const BAD = words('Bad', 'grief, cruel, rotten, disaster, filth, poison, sorrow, harm');
const MALE = words('Male', 'man, he, father, son, brother, uncle, husband, boy');
const FEMALE = words('Female', 'woman, she, mother, daughter, sister, aunt, wife, girl');
const CAREER = words(
	'Career',
	'office, salary, manager, business, profession, meeting, promotion, client'
);
const FAMILY = words(
	'Family',
	'home, children, parents, wedding, relatives, cousins, kitchen, marriage'
);
const SCIENCE = words(
	'Science',
	'physics, chemistry, biology, astronomy, geology, mathematics, engineering, laboratory'
);
const ARTS = words('Arts', 'poetry, painting, music, theatre, dance, sculpture, literature, opera');
const YOUNG = words('Young', 'youth, teenager, adolescent, youngster, toddler, student');
const OLD = words('Old', 'elderly, pensioner, grandparent, retiree, senior, aged');
const EUROPE = words('Europe', 'Paris, Berlin, Lisbon, Rome, Madrid, Vienna');
const US = words('United States', 'Chicago, Texas, Boston, Denver, Ohio, Seattle');
const LEFT = words('Left', 'equality, solidarity, unions, welfare, progressive, redistribution');
const RIGHT = words('Right', 'tradition, enterprise, order, nation, deregulation, conservative');
const PRO_EU = words(
	'Pro-EU',
	'integration, Erasmus, eurozone, Schengen, single market, federal Europe'
);
const EUROSCEPTIC = words(
	'Eurosceptic',
	'Brexit, sovereignty, opt-out, national veto, Frexit, withdrawal'
);
const WHITE = faces('White', 'white', '009,081,122,068,125,004');
const BLACK = faces('Black', 'black', '025,099,062,044,043,114');
const EAST_ASIAN = faces('East Asian', 'east-asian', '030,087,127,067,024,045');

const preset = (id: string, t: [Category, Category], a: [Category, Category]): Comparison => ({
	id,
	targets: t,
	attributes: a
});

export const PRESETS: readonly Comparison[] = [
	preset('gender-career', [MALE, FEMALE], [CAREER, FAMILY]),
	preset('gender-science', [MALE, FEMALE], [SCIENCE, ARTS]),
	preset('race-white-black', [WHITE, BLACK], [GOOD, BAD]),
	preset('race-white-east-asian', [WHITE, EAST_ASIAN], [GOOD, BAD]),
	preset('race-black-east-asian', [BLACK, EAST_ASIAN], [GOOD, BAD]),
	preset('age', [YOUNG, OLD], [GOOD, BAD]),
	preset('europe-us', [EUROPE, US], [GOOD, BAD]),
	preset('left-right', [LEFT, RIGHT], [GOOD, BAD]),
	preset('eu', [PRO_EU, EUROSCEPTIC], [GOOD, BAD])
];

/** The practice block's neutral categories, as in Nosek et al. (2014). */
export const PRACTICE = {
	targets: [
		words('Mammals', 'whale, horse, rabbit, tiger, mouse, bear'),
		words('Birds', 'robin, eagle, parrot, swan, owl, sparrow')
	] as [Category, Category],
	attributes: [GOOD, BAD] as [Category, Category]
};

/** "Male / Female × Science / Arts". */
export function title(c: Pick<Comparison, 'targets' | 'attributes'>): string {
	return `${c.targets[0].label} / ${c.targets[1].label} × ${c.attributes[0].label} / ${c.attributes[1].label}`;
}
