// Nationwide public holidays of the EU member states, computed per year.
// Source of truth for data/events/public-holidays.json (regenerate with
// `node scripts/build-timeline-holidays.ts`).
//
// - Statutory holidays are listed as they stand in law, including Sunday-only feasts
//   (Easter Sunday, Pentecost Sunday) where the law names them as public holidays. Countries
//   whose law only makes every Sunday a rest day (e.g. Greece, Italy, Netherlands) or
//   names the feast only regionally (Germany: Brandenburg) do not get them.
// - Holidays whose statutory status changed carry validFrom/validTo (inclusive years) and
//   are emitted only inside that range. Sources are cited next to each such rule.
// - Widely observed customary days off that are not statutory are included with
//   deFacto: true; their title carries a "(de facto)" marker.
// - Regional holidays (e.g. Spain's autonomous communities) are left out. Decree-moved
//   days (e.g. Greece moving 1 May) keep their statutory date.

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

export type Rule = (year: number) => CalendarDate;

export interface HolidayOptions {
	/** First year (inclusive) in which the holiday applies. */
	validFrom?: number;
	/** Last year (inclusive) in which the holiday applies. */
	validTo?: number;
	/** Customary day off, not a statutory public holiday. Marked in the title. */
	deFacto?: boolean;
	/** Sentence that replaces the default description for this holiday. */
	note?: string;
}

/** [name, rule] or [name, rule, options]. */
export type HolidayEntry = [string, Rule] | [string, Rule, HolidayOptions];

export const DE_FACTO_MARKER = ' (de facto)';

export function appliesIn(options: HolidayOptions | undefined, year: number): boolean {
	return (
		(options?.validFrom === undefined || year >= options.validFrom) &&
		(options?.validTo === undefined || year <= options.validTo)
	);
}

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
/** Friday between 19 and 25 June, the eve of midsummerSaturday (Finland, Sweden). */
const midsummerEve: Rule = (year) => addDays(midsummerSaturday(year), -1);
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
const EASTER_SUNDAY: [string, Rule] = ['Easter Sunday', easter(0)];
const PENTECOST: [string, Rule] = ['Pentecost Sunday', easter(49)];
const ORTHODOX_EASTER_SUNDAY: [string, Rule] = ['Orthodox Easter Sunday', orthodox(0)];

export interface CountryHolidays {
	country: string;
	emoji: string;
	holidays: HolidayEntry[];
}

export const COUNTRY_HOLIDAYS: CountryHolidays[] = [
	{
		country: 'Austria',
		emoji: '🇦🇹',
		holidays: [
			NEW_YEAR,
			EPIPHANY,
			// Until 2018 a holiday only for members of the Protestant, Old Catholic and Methodist
			// churches; replaced by a "personal holiday" after ECJ C-193/17 (BGBl. I Nr. 22/2019).
			// https://www.drda.at/infas/2019/383/35/Karfreitag--Feiertag-fuer-niemanden
			['Good Friday', easter(-2), { validTo: 2018 }],
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
			// Labour Code art. 154(1): Easter is two days, Sunday and Monday.
			ORTHODOX_EASTER_SUNDAY,
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
			// Act on Holidays (NN 110/19) art. 1 names Uskrs (Easter Sunday); Pentecost is not a holiday.
			// https://www.pravo.unizg.hr/wp-content/uploads/2024/02/Zakon_o_blagdanima_spomendanima_i_neradnim_danima_u_RH_NN_2019_110.pdf
			EASTER_SUNDAY,
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
			// Holy Saturday, Easter Tuesday and Christmas Eve: public-service / bank closures that
			// most private employers follow by custom; not in the core statutory list, and private
			// sector holidays rest on contracts and collective agreements.
			// https://www.visitcyprus.com/useful-info/time-working-hours-holidays/
			// https://en.wikipedia.org/wiki/Public_holidays_in_Cyprus
			['Orthodox Holy Saturday', orthodox(-1), { deFacto: true }],
			// Easter Sunday per https://en.wikipedia.org/wiki/Public_holidays_in_Cyprus
			ORTHODOX_EASTER_SUNDAY,
			['Orthodox Easter Monday', orthodox(1)],
			['Orthodox Easter Tuesday', orthodox(2), { deFacto: true }],
			LABOUR_DAY,
			['Kataklysmos', orthodox(50)],
			['Dormition of the Theotokos', fixed(8, 15)],
			['Independence Day', fixed(10, 1)],
			['Ochi Day', fixed(10, 28)],
			[...CHRISTMAS_EVE, { deFacto: true }],
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
			// Påskedag and pinsedag are statutory helligdage (helligdagsloven).
			EASTER_SUNDAY,
			EASTER_MONDAY,
			// Abolished by Act no. 214 of 6 March 2023, in force 1 January 2024; last kept 5 May 2023.
			// https://en.wikipedia.org/wiki/Store_Bededag
			['Great Prayer Day', easter(26), { validTo: 2023 }],
			ASCENSION,
			PENTECOST,
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
			// Holidays Act s. 2: ülestõusmispühade 1. püha and nelipühade 1. püha are public holidays.
			EASTER_SUNDAY,
			['Spring Day', fixed(5, 1)],
			PENTECOST,
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
			// Easter Day and Whit Sunday: https://en.wikipedia.org/wiki/Public_holidays_in_Finland
			EASTER_SUNDAY,
			EASTER_MONDAY,
			['May Day', fixed(5, 1)],
			ASCENSION,
			PENTECOST,
			// Midsummer Eve and Christmas Eve are not statutory but are days off by custom and
			// collective agreements. https://en.wikipedia.org/wiki/Public_holidays_in_Finland
			['Midsummer Eve', midsummerEve, { deFacto: true }],
			['Midsummer Day', midsummerSaturday],
			["All Saints' Day", allSaintsSaturday],
			['Independence Day', fixed(12, 6)],
			[...CHRISTMAS_EVE, { deFacto: true }],
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
			// Labour Code (Act I of 2012) s. 102(1) names húsvétvasárnap and pünkösdvasárnap.
			EASTER_SUNDAY,
			EASTER_MONDAY,
			LABOUR_DAY,
			PENTECOST,
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
			// Restored by Law no. 151 of 8 October 2025, from 2026.
			// https://www.gazzettaufficiale.it/eli/gu/2025/10/10/236/sg/pdf (GU n. 236)
			["St. Francis of Assisi's Day", fixed(10, 4), { validFrom: 2026 }],
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
			// Law on Holidays, Remembrance Days and Celebration Days, s. 1 names Easter Sunday and
			// Pentecost. https://likumi.lv/ta/en/en/id/72608
			GOOD_FRIDAY,
			EASTER_SUNDAY,
			EASTER_MONDAY,
			LABOUR_DAY,
			['Restoration of Independence Day', fixed(5, 4)],
			PENTECOST,
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
			// Labour Code art. 123: Easter Sunday and Monday (western tradition).
			EASTER_SUNDAY,
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
			// Listed in the Algemene termijnenwet, but a paid day off only every five years (2025,
			// 2030, ...) under most collective agreements, so marked de facto.
			// https://www.rijksoverheid.nl/onderwerpen/arbeidsovereenkomst-en-cao/vraag-en-antwoord/officiele-feestdagen
			// https://www.rendement.nl/arbeidsvoorwaarden/nieuws/wel-of-geen-vrij-op-5-mei.html
			[
				'Liberation Day',
				fixed(5, 5),
				{
					deFacto: true,
					note: 'Liberation Day: national holiday in the Netherlands, but a paid day off only every five years (2025, 2030, ...) under most collective agreements.'
				}
			],
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
			// Public Holidays Act 1951 art. 1 names the first day of Easter and of Pentecost.
			EASTER_SUNDAY,
			EASTER_MONDAY,
			LABOUR_DAY,
			['Constitution Day', fixed(5, 3)],
			PENTECOST,
			CORPUS_CHRISTI,
			ASSUMPTION,
			ALL_SAINTS,
			['Independence Day', fixed(11, 11)],
			// Added to the Public Holidays Act by the amendment in force 1 February 2025.
			// https://www.roedl.pl/en/good-to-know/good-to-know/labour-law/christmas-eve-as-public-holiday
			[...CHRISTMAS_EVE, { validFrom: 2025 }],
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
			// Labour Code art. 234 names Domingo de Páscoa as a mandatory holiday.
			// https://sabiasque.pt/codigo-trabalho/1322-artigo-234-feriados-obrigatorios.html
			EASTER_SUNDAY,
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
			// Labour Code art. 139: first and second day of Easter and of Pentecost (Rusalii).
			ORTHODOX_EASTER_SUNDAY,
			['Orthodox Easter Monday', orthodox(1)],
			LABOUR_DAY,
			["Children's Day", fixed(6, 1)],
			['Orthodox Pentecost Sunday', orthodox(49)],
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
			// Act 261/2025, s. 4b (transitional): 8 May and 15 September are not days of rest in 2026
			// only. https://static.slov-lex.sk/static/SK/ZZ/2025/261/20251101.html
			['Victory over Fascism Day', fixed(5, 8), { validTo: 2025 }],
			['Victory over Fascism Day', fixed(5, 8), { validFrom: 2027 }],
			['Saints Cyril and Methodius Day', fixed(7, 5)],
			['Slovak National Uprising Anniversary', fixed(8, 29)],
			// Still a state holiday but no longer a day of rest from 2024 (Act 530/2023).
			// https://www.podnikajte.sk/pracovne-pravo-bozp/1-september-zruseny-sviatok-co-to-znamena-pre-zamestnancov
			['Constitution Day', fixed(9, 1), { validTo: 2023 }],
			['Our Lady of Sorrows', fixed(9, 15), { validTo: 2025 }],
			['Our Lady of Sorrows', fixed(9, 15), { validFrom: 2027 }],
			ALL_SAINTS,
			// No longer a day of rest from 1 November 2025 (Act 261/2025, s. 2(3) of Act 241/1993).
			['Struggle for Freedom and Democracy Day', fixed(11, 17), { validTo: 2024 }],
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
			// Zakon o praznikih in dela prostih dnevih, art. 2: Easter Sunday and Pentecost Sunday are
			// work-free days. https://www.racunovodja.com/printCL.asp?cl=2686
			EASTER_SUNDAY,
			EASTER_MONDAY,
			['Day of Uprising Against Occupation', fixed(4, 27)],
			LABOUR_DAY,
			['Labour Day Holiday', fixed(5, 2)],
			PENTECOST,
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
			// Påskdagen and pingstdagen are allmänna helgdagar (Lag 1989:253 s. 1).
			EASTER_SUNDAY,
			EASTER_MONDAY,
			LABOUR_DAY,
			ASCENSION,
			PENTECOST,
			['National Day', fixed(6, 6)],
			// Midsummer Eve, Christmas Eve and New Year's Eve are not allmänna helgdagar (Lag
			// 1989:253) but are days off by custom and collective agreements.
			// https://lagen.nu/1989:253 (Semesterlag 1977:480 s. 3a treats the eves as Sundays)
			['Midsummer Eve', midsummerEve, { deFacto: true }],
			['Midsummer Day', midsummerSaturday],
			["All Saints' Day", allSaintsSaturday],
			[...CHRISTMAS_EVE, { deFacto: true }],
			CHRISTMAS,
			BOXING_DAY,
			["New Year's Eve", fixed(12, 31), { deFacto: true }]
		]
	}
];

export const HOLIDAY_ID_BASE = 10001;

/** Title segment of one holiday: its name, with DE_FACTO_MARKER when customary. */
export function holidayLabel([name, , options]: HolidayEntry): string {
	return options?.deFacto ? name + DE_FACTO_MARKER : name;
}

function describe(country: string, entries: HolidayEntry[]): string {
	const statutory = entries.filter(([, , o]) => !o?.deFacto && !o?.note).map(([n]) => n);
	const sentences = statutory.length
		? [`${statutory.join(' / ')}, public holiday in ${country}.`]
		: [];
	for (const [name, , o] of entries) {
		if (o?.note) sentences.push(o.note);
		else if (o?.deFacto)
			sentences.push(`${name}: customary day off in ${country}, not a statutory public holiday.`);
	}
	return sentences.join(' ');
}

/**
 * One event per country and date for every year in [fromYear, toYear], sorted by date then
 * country. Holidays of one country that coincide on a date are merged into one event.
 * Entries with validFrom/validTo are emitted only for years inside that range.
 * Ids are assigned in that order from HOLIDAY_ID_BASE, so the output is deterministic.
 */
export function generateHolidays(fromYear: number, toYear: number): TimelineEvent[] {
	const byKey = new Map<
		string,
		{ country: CountryHolidays; date: string; entries: HolidayEntry[] }
	>();
	for (let year = fromYear; year <= toYear; year++) {
		for (const country of COUNTRY_HOLIDAYS) {
			for (const entry of country.holidays) {
				if (!appliesIn(entry[2], year)) continue;
				const date = formatCalendarDate(entry[1](year));
				const key = `${date} ${country.country}`;
				const existing = byKey.get(key);
				if (existing) existing.entries.push(entry);
				else byKey.set(key, { country, date, entries: [entry] });
			}
		}
	}
	const sorted = [...byKey.values()].sort((a, b) =>
		a.date === b.date
			? a.country.country.localeCompare(b.country.country)
			: a.date < b.date
				? -1
				: 1
	);
	return sorted.map((e, i) => ({
		id: HOLIDAY_ID_BASE + i,
		emoji: e.country.emoji,
		date: e.date,
		title: `${e.country.country}: ${e.entries.map(holidayLabel).join(' / ')}`,
		description: describe(e.country.country, e.entries)
	}));
}
