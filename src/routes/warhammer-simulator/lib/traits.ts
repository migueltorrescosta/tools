import giftTraitsData from '$lib/warhammer-simulator/data/gift-traits.json';

type TraitEntry = {
	id: string;
	name: string;
	description: string;
	category: string;
	cost: number;
};

const traits = giftTraitsData as TraitEntry[];

export const GIFT_POINT_LIMIT = 50;
/** Items (non-gifts) are limited to MAX_ITEMS; gifts only by points. */
export const MAX_ITEMS = 2;

/** The traits a character can toggle in the builder. */
export const giftTraits = traits.filter((t) => t.category === 'gift' || t.category === 'item');

const isGift = (id: string) => traits.find((t) => t.id === id)?.category === 'gift';

export const itemCount = (ids: string[]) => ids.filter((t) => !isGift(t)).length;

/** A trait is locked when adding it would exceed the item limit. */
export const isTraitLocked = (ids: string[], id: string) =>
	!ids.includes(id) && !isGift(id) && itemCount(ids) >= MAX_ITEMS;

export const totalGiftPoints = (ids: string[]) =>
	ids.reduce((sum, id) => sum + (traits.find((t) => t.id === id)?.cost ?? 0), 0);
