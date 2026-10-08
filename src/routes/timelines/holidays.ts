// Nationwide statutory public holidays of the EU member states, computed per year.
// Source of truth for data/events/public-holidays.json (regenerate with
// `node scripts/build-timeline-holidays.ts`). Regional holidays, Sunday-only feasts
// (Easter Sunday, Pentecost Sunday) and customary-but-not-statutory days are left out.

import type { TimelineEvent } from './timelines';

/** Calendar date as [year, month (1-12), day]. */
export type CalendarDate = [number, number, number];

/** Gregorian (Western) Easter Sunday, anonymous Gregorian algorithm (Meeus/Jones/Butcher). */
export function westernEaster(year: number): CalendarDate {
	const a = year % 19;
	const b = Math.floor(year / 100);
	const c = year % 100;
	const d = Math.floor(b / 4);
	const e = b % 4;
	const f = Math.floor((b + 8) / 25);
	const g = Math.floor((b - f + 1) / 3);
	const h = (19 * a + b - d - g + 15) % 30;
	const i = Math.floor(c / 4);
	const k = c % 4;
	const l = (32 + 2 * e + 2 * i - h - k) % 7;
	const m = Math.floor((a + 11 * h + 22 * l) / 451);
	const month = Math.floor((h + l - 7 * m + 114) / 31);
	const day = ((h + l - 7 * m + 114) % 31) + 1;
	return [year, month, day];
}

/**
 * Orthodox Easter Sunday as a Gregorian date: Meeus' Julian computus, then the Julian to
 * Gregorian offset, which is 13 days for 1900-2099.
 */
export function orthodoxEaster(year: number): CalendarDate {
	if (year < 1900 || year > 2099) throw new RangeError(`orthodoxEaster: ${year} outside 1900-2099`);
	const a = year % 4;
	const b = year % 7;
	const c = year % 19;
	const d = (19 * c + 15) % 30;
	const e = (2 * a + 4 * b - d + 34) % 7;
	const month = Math.floor((d + e + 114) / 31);
	const day = ((d + e + 114) % 31) + 1;
	return addDays([year, month, day], 13);
}

function toUtc([y, m, d]: CalendarDate): Date {
	return new Date(Date.UTC(y, m - 1, d));
}

function fromUtc(date: Date): CalendarDate {
	return [date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()];
}

export function addDays(date: CalendarDate, days: number): CalendarDate {
	const t = toUtc(date);
	t.setUTCDate(t.getUTCDate() + days);
	return fromUtc(t);
}

/** 0 = Sunday ... 6 = Saturday. */
export function weekday(date: CalendarDate): number {
	return toUtc(date).getUTCDay();
}

export function formatCalendarDate([y, m, d]: CalendarDate): string {
	return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** First date on or after [year, month, day] that falls on `dow`. */
function onOrAfter(year: number, month: number, day: number, dow: number): CalendarDate {
	const start: CalendarDate = [year, month, day];
	return addDays(start, (dow - weekday(start) + 7) % 7);
}

function lastWeekdayOfMonth(year: number, month: number, dow: number): CalendarDate {
	const last = addDays([year, month + 1, 1], -1);
	return addDays(last, -((weekday(last) - dow + 7) % 7));
}

const MONDAY = 1;
const SATURDAY = 6;
const SUNDAY = 0;

type Rule = (year: number) => CalendarDate;

const fixed =
	(month: number, day: number): Rule =>
	(year) => [year, month, day];
const easter =
	(offset: number): Rule =>
	(year) =>
		addDays(westernEaster(year), offset);
const orthodox =
	(offset: number): Rule =>
	(year) =>
		addDays(orthodoxEaster(year), offset);
const firstMonday =
	(month: number): Rule =>
	(year) =>
		onOrAfter(year, month, 1, MONDAY);

/** Saturday between 20 and 26 June (Finland, Sweden). */
const midsummerSaturday: Rule = (year) => onOrAfter(year, 6, 20, SATURDAY);
/** Saturday between 31 October and 6 November (Finland, Sweden). */
const allSaintsSaturday: Rule = (year) => onOrAfter(year, 10, 31, SATURDAY);
/** 27 April, or 26 April when the 27th is a Sunday (Netherlands). */
const kingsDay: Rule = (year) =>
	weekday([year, 4, 27]) === SUNDAY ? [year, 4, 26] : [year, 4, 27];
/** First Monday of February, or 1 February when it is a Friday (Ireland, since 2023). */
const stBrigidsDay: Rule = (year) =>
	weekday([year, 2, 1]) === 5 ? [year, 2, 1] : onOrAfter(year, 2, 1, MONDAY);

const NEW_YEAR: [string, Rule] = ["New Year's Day", fixed(1, 1)];
const EPIPHANY: [string, Rule] = ['Epiphany', fixed(1, 6)];
const GOOD_FRIDAY: [string, Rule] = ['Good Friday', easter(-2)];
const EASTER_MONDAY: [string, Rule] = ['Easter Monday', easter(1)];
const LABOUR_DAY: [string, Rule] = ['Labour Day', fixed(5, 1)];
const ASCENSION: [string, Rule] = ['Ascension Day', easter(39)];
const WHIT_MONDAY: [string, Rule] = ['Whit Monday', easter(50)];
const CORPUS_CHRISTI: [string, Rule] = ['Corpus Christi', easter(60)];
const ASSUMPTION: [string, Rule] = ['Assumption Day', fixed(8, 15)];
const ALL_SAINTS: [string, Rule] = ["All Saints' Day", fixed(11, 1)];
const IMMACULATE: [string, Rule] = ['Immaculate Conception', fixed(12, 8)];
const CHRISTMAS_EVE: [string, Rule] = ['Christmas Eve', fixed(12, 24)];
const CHRISTMAS: [string, Rule] = ['Christmas Day', fixed(12, 25)];
const ST_STEPHEN: [string, Rule] = ["St. Stephen's Day", fixed(12, 26)];
const BOXING_DAY: [string, Rule] = ['Second Day of Christmas', fixed(12, 26)];

export interface CountryHolidays {
	country: string;
	emoji: string;
	holidays: [string, Rule][];
}

export const COUNTRY_HOLIDAYS: CountryHolidays[] = [
	{
		country: 'Austria',
		emoji: '🇦🇹',
		holidays: [
			NEW_YEAR,
			EPIPHANY,
			EASTER_MONDAY,
			LABOUR_DAY,
			ASCENSION,
			WHIT_MONDAY,
			CORPUS_CHRISTI,
			ASSUMPTION,
			['National Day', fixed(10, 26)],
			ALL_SAINTS,
			IMMACULATE,
			CHRISTMAS,
			ST_STEPHEN
		]
	},
	{
		country: 'Belgium',
		emoji: '🇧🇪',
		holidays: [
			NEW_YEAR,
			EASTER_MONDAY,
			LABOUR_DAY,
			ASCENSION,
			WHIT_MONDAY,
			['National Day', fixed(7, 21)],
			ASSUMPTION,
			ALL_SAINTS,
			['Armistice Day', fixed(11, 11)],
			CHRISTMAS
		]
	},
	{
		country: 'Bulgaria',
		emoji: '🇧🇬',
		holidays: [
			NEW_YEAR,
			['Liberation Day', fixed(3, 3)],
			['Orthodox Good Friday', orthodox(-2)],
			['Orthodox Holy Saturday', orthodox(-1)],
			['Orthodox Easter Monday', orthodox(1)],
			LABOUR_DAY,
			["St. George's Day", fixed(5, 6)],
			['Culture and Literacy Day', fixed(5, 24)],
			['Unification Day', fixed(9, 6)],
			['Independence Day', fixed(9, 22)],
			CHRISTMAS_EVE,
			CHRISTMAS,
			BOXING_DAY
		]
	},
	{
		country: 'Croatia',
		emoji: '🇭🇷',
		holidays: [
			NEW_YEAR,
			EPIPHANY,
			EASTER_MONDAY,
			LABOUR_DAY,
			['Statehood Day', fixed(5, 30)],
			CORPUS_CHRISTI,
			['Anti-Fascist Struggle Day', fixed(6, 22)],
			['Victory and Homeland Thanksgiving Day', fixed(8, 5)],
			ASSUMPTION,
			ALL_SAINTS,
			['Remembrance Day', fixed(11, 18)],
			CHRISTMAS,
			ST_STEPHEN
		]
	},
	{
		country: 'Cyprus',
		emoji: '🇨🇾',
		holidays: [
			NEW_YEAR,
			EPIPHANY,
			['Green Monday', orthodox(-48)],
			['Greek Independence Day', fixed(3, 25)],
			['Cyprus National Day', fixed(4, 1)],
			['Orthodox Good Friday', orthodox(-2)],
			['Orthodox Easter Monday', orthodox(1)],
			LABOUR_DAY,
			['Kataklysmos', orthodox(50)],
			['Dormition of the Theotokos', fixed(8, 15)],
			['Independence Day', fixed(10, 1)],
			['Ochi Day', fixed(10, 28)],
			CHRISTMAS,
			BOXING_DAY
		]
	},
	{
		country: 'Czechia',
		emoji: '🇨🇿',
		holidays: [
			['Restoration Day of the Independent Czech State', fixed(1, 1)],
			GOOD_FRIDAY,
			EASTER_MONDAY,
			LABOUR_DAY,
			['Liberation Day', fixed(5, 8)],
			['Saints Cyril and Methodius Day', fixed(7, 5)],
			['Jan Hus Day', fixed(7, 6)],
			['St. Wenceslas Day', fixed(9, 28)],
			['Independent Czechoslovak State Day', fixed(10, 28)],
			['Struggle for Freedom and Democracy Day', fixed(11, 17)],
			CHRISTMAS_EVE,
			CHRISTMAS,
			ST_STEPHEN
		]
	},
	{
		country: 'Denmark',
		emoji: '🇩🇰',
		holidays: [
			NEW_YEAR,
			['Maundy Thursday', easter(-3)],
			GOOD_FRIDAY,
			EASTER_MONDAY,
			ASCENSION,
			WHIT_MONDAY,
			CHRISTMAS,
			BOXING_DAY
		]
	},
	{
		country: 'Estonia',
		emoji: '🇪🇪',
		holidays: [
			NEW_YEAR,
			['Independence Day', fixed(2, 24)],
			GOOD_FRIDAY,
			['Spring Day', fixed(5, 1)],
			['Victory Day', fixed(6, 23)],
			['Midsummer Day', fixed(6, 24)],
			['Restoration of Independence Day', fixed(8, 20)],
			CHRISTMAS_EVE,
			CHRISTMAS,
			BOXING_DAY
		]
	},
	{
		country: 'Finland',
		emoji: '🇫🇮',
		holidays: [
			NEW_YEAR,
			EPIPHANY,
			GOOD_FRIDAY,
			EASTER_MONDAY,
			['May Day', fixed(5, 1)],
			ASCENSION,
			['Midsummer Day', midsummerSaturday],
			["All Saints' Day", allSaintsSaturday],
			['Independence Day', fixed(12, 6)],
			CHRISTMAS,
			ST_STEPHEN
		]
	},
	{
		country: 'France',
		emoji: '🇫🇷',
		holidays: [
			NEW_YEAR,
			EASTER_MONDAY,
			LABOUR_DAY,
			['Victory in Europe Day', fixed(5, 8)],
			ASCENSION,
			WHIT_MONDAY,
			['Bastille Day', fixed(7, 14)],
			ASSUMPTION,
			ALL_SAINTS,
			['Armistice Day', fixed(11, 11)],
			CHRISTMAS
		]
	},
	{
		country: 'Germany',
		emoji: '🇩🇪',
		holidays: [
			NEW_YEAR,
			GOOD_FRIDAY,
			EASTER_MONDAY,
			LABOUR_DAY,
			ASCENSION,
			WHIT_MONDAY,
			['German Unity Day', fixed(10, 3)],
			CHRISTMAS,
			BOXING_DAY
		]
	},
	{
		country: 'Greece',
		emoji: '🇬🇷',
		holidays: [
			NEW_YEAR,
			EPIPHANY,
			['Clean Monday', orthodox(-48)],
			['Independence Day', fixed(3, 25)],
			['Orthodox Good Friday', orthodox(-2)],
			['Orthodox Easter Monday', orthodox(1)],
			LABOUR_DAY,
			['Orthodox Whit Monday', orthodox(50)],
			['Dormition of the Theotokos', fixed(8, 15)],
			['Ochi Day', fixed(10, 28)],
			CHRISTMAS,
			['Synaxis of the Theotokos', fixed(12, 26)]
		]
	},
	{
		country: 'Hungary',
		emoji: '🇭🇺',
		holidays: [
			NEW_YEAR,
			['National Day', fixed(3, 15)],
			GOOD_FRIDAY,
			EASTER_MONDAY,
			LABOUR_DAY,
			WHIT_MONDAY,
			["St. Stephen's Day", fixed(8, 20)],
			['Republic Day', fixed(10, 23)],
			ALL_SAINTS,
			CHRISTMAS,
			BOXING_DAY
		]
	},
	{
		country: 'Ireland',
		emoji: '🇮🇪',
		holidays: [
			NEW_YEAR,
			["St. Brigid's Day", stBrigidsDay],
			["St. Patrick's Day", fixed(3, 17)],
			EASTER_MONDAY,
			['May Bank Holiday', firstMonday(5)],
			['June Bank Holiday', firstMonday(6)],
			['August Bank Holiday', firstMonday(8)],
			['October Bank Holiday', (year) => lastWeekdayOfMonth(year, 10, MONDAY)],
			CHRISTMAS,
			ST_STEPHEN
		]
	},
	{
		country: 'Italy',
		emoji: '🇮🇹',
		holidays: [
			NEW_YEAR,
			EPIPHANY,
			EASTER_MONDAY,
			['Liberation Day', fixed(4, 25)],
			LABOUR_DAY,
			['Republic Day', fixed(6, 2)],
			ASSUMPTION,
			ALL_SAINTS,
			IMMACULATE,
			CHRISTMAS,
			ST_STEPHEN
		]
	},
	{
		country: 'Latvia',
		emoji: '🇱🇻',
		holidays: [
			NEW_YEAR,
			GOOD_FRIDAY,
			EASTER_MONDAY,
			LABOUR_DAY,
			['Restoration of Independence Day', fixed(5, 4)],
			['Midsummer Eve', fixed(6, 23)],
			['Midsummer Day', fixed(6, 24)],
			['Proclamation Day', fixed(11, 18)],
			CHRISTMAS_EVE,
			CHRISTMAS,
			BOXING_DAY,
			["New Year's Eve", fixed(12, 31)]
		]
	},
	{
		country: 'Lithuania',
		emoji: '🇱🇹',
		holidays: [
			NEW_YEAR,
			['State Restoration Day', fixed(2, 16)],
			['Independence Restoration Day', fixed(3, 11)],
			EASTER_MONDAY,
			LABOUR_DAY,
			["St. John's Day", fixed(6, 24)],
			['Statehood Day', fixed(7, 6)],
			ASSUMPTION,
			ALL_SAINTS,
			["All Souls' Day", fixed(11, 2)],
			CHRISTMAS_EVE,
			CHRISTMAS,
			BOXING_DAY
		]
	},
	{
		country: 'Luxembourg',
		emoji: '🇱🇺',
		holidays: [
			NEW_YEAR,
			EASTER_MONDAY,
			LABOUR_DAY,
			['Europe Day', fixed(5, 9)],
			ASCENSION,
			WHIT_MONDAY,
			['National Day', fixed(6, 23)],
			ASSUMPTION,
			ALL_SAINTS,
			CHRISTMAS,
			ST_STEPHEN
		]
	},
	{
		country: 'Malta',
		emoji: '🇲🇹',
		holidays: [
			NEW_YEAR,
			["Feast of St. Paul's Shipwreck", fixed(2, 10)],
			['Feast of St. Joseph', fixed(3, 19)],
			['Freedom Day', fixed(3, 31)],
			GOOD_FRIDAY,
			["Workers' Day", fixed(5, 1)],
			['Sette Giugno', fixed(6, 7)],
			['Feast of St. Peter and St. Paul', fixed(6, 29)],
			ASSUMPTION,
			['Victory Day', fixed(9, 8)],
			['Independence Day', fixed(9, 21)],
			IMMACULATE,
			['Republic Day', fixed(12, 13)],
			CHRISTMAS
		]
	},
	{
		country: 'Netherlands',
		emoji: '🇳🇱',
		holidays: [
			NEW_YEAR,
			EASTER_MONDAY,
			["King's Day", kingsDay],
			['Liberation Day', fixed(5, 5)],
			ASCENSION,
			WHIT_MONDAY,
			CHRISTMAS,
			BOXING_DAY
		]
	},
	{
		country: 'Poland',
		emoji: '🇵🇱',
		holidays: [
			NEW_YEAR,
			EPIPHANY,
			EASTER_MONDAY,
			LABOUR_DAY,
			['Constitution Day', fixed(5, 3)],
			CORPUS_CHRISTI,
			ASSUMPTION,
			ALL_SAINTS,
			['Independence Day', fixed(11, 11)],
			CHRISTMAS,
			BOXING_DAY
		]
	},
	{
		country: 'Portugal',
		emoji: '🇵🇹',
		holidays: [
			NEW_YEAR,
			GOOD_FRIDAY,
			['Freedom Day', fixed(4, 25)],
			LABOUR_DAY,
			CORPUS_CHRISTI,
			['Portugal Day', fixed(6, 10)],
			ASSUMPTION,
			['Republic Day', fixed(10, 5)],
			ALL_SAINTS,
			['Restoration of Independence', fixed(12, 1)],
			IMMACULATE,
			CHRISTMAS
		]
	},
	{
		country: 'Romania',
		emoji: '🇷🇴',
		holidays: [
			NEW_YEAR,
			['Day after New Year', fixed(1, 2)],
			EPIPHANY,
			['Synaxis of St. John the Baptist', fixed(1, 7)],
			['Unification Day', fixed(1, 24)],
			['Orthodox Good Friday', orthodox(-2)],
			['Orthodox Easter Monday', orthodox(1)],
			LABOUR_DAY,
			["Children's Day", fixed(6, 1)],
			['Orthodox Whit Monday', orthodox(50)],
			ASSUMPTION,
			["St. Andrew's Day", fixed(11, 30)],
			['National Day', fixed(12, 1)],
			CHRISTMAS,
			BOXING_DAY
		]
	},
	{
		country: 'Slovakia',
		emoji: '🇸🇰',
		holidays: [
			['Republic Day', fixed(1, 1)],
			EPIPHANY,
			GOOD_FRIDAY,
			EASTER_MONDAY,
			LABOUR_DAY,
			['Saints Cyril and Methodius Day', fixed(7, 5)],
			['Slovak National Uprising Anniversary', fixed(8, 29)],
			['Our Lady of Sorrows', fixed(9, 15)],
			ALL_SAINTS,
			CHRISTMAS_EVE,
			CHRISTMAS,
			ST_STEPHEN
		]
	},
	{
		country: 'Slovenia',
		emoji: '🇸🇮',
		holidays: [
			NEW_YEAR,
			["New Year's Holiday", fixed(1, 2)],
			['Prešeren Day', fixed(2, 8)],
			EASTER_MONDAY,
			['Day of Uprising Against Occupation', fixed(4, 27)],
			LABOUR_DAY,
			['Labour Day Holiday', fixed(5, 2)],
			['Statehood Day', fixed(6, 25)],
			ASSUMPTION,
			['Reformation Day', fixed(10, 31)],
			['Remembrance Day', fixed(11, 1)],
			CHRISTMAS,
			['Independence and Unity Day', fixed(12, 26)]
		]
	},
	{
		country: 'Spain',
		emoji: '🇪🇸',
		holidays: [
			NEW_YEAR,
			EPIPHANY,
			GOOD_FRIDAY,
			LABOUR_DAY,
			ASSUMPTION,
			['National Day', fixed(10, 12)],
			ALL_SAINTS,
			['Constitution Day', fixed(12, 6)],
			IMMACULATE,
			CHRISTMAS
		]
	},
	{
		country: 'Sweden',
		emoji: '🇸🇪',
		holidays: [
			NEW_YEAR,
			EPIPHANY,
			GOOD_FRIDAY,
			EASTER_MONDAY,
			LABOUR_DAY,
			ASCENSION,
			['National Day', fixed(6, 6)],
			['Midsummer Day', midsummerSaturday],
			["All Saints' Day", allSaintsSaturday],
			CHRISTMAS,
			BOXING_DAY
		]
	}
];

export const HOLIDAY_ID_BASE = 10001;

/**
 * One event per country and date for every year in [fromYear, toYear], sorted by date then
 * country. Holidays of one country that coincide on a date are merged into one event.
 * Ids are assigned in that order from HOLIDAY_ID_BASE, so the output is deterministic.
 */
export function generateHolidays(fromYear: number, toYear: number): TimelineEvent[] {
	const byKey = new Map<string, { country: CountryHolidays; date: string; names: string[] }>();
	for (let year = fromYear; year <= toYear; year++) {
		for (const country of COUNTRY_HOLIDAYS) {
			for (const [name, rule] of country.holidays) {
				const date = formatCalendarDate(rule(year));
				const key = `${date} ${country.country}`;
				const entry = byKey.get(key);
				if (entry) entry.names.push(name);
				else byKey.set(key, { country, date, names: [name] });
			}
		}
	}
	const entries = [...byKey.values()].sort((a, b) =>
		a.date === b.date
			? a.country.country.localeCompare(b.country.country)
			: a.date < b.date
				? -1
				: 1
	);
	return entries.map((e, i) => {
		const name = e.names.join(' / ');
		return {
			id: HOLIDAY_ID_BASE + i,
			emoji: e.country.emoji,
			date: e.date,
			title: `${e.country.country}: ${name}`,
			description: `${name}, public holiday in ${e.country.country}.`
		};
	});
}
