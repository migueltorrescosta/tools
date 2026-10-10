export interface PricedItem {
	id: number;
	price: number;
}

/** Returns a float in [0, 1), like Math.random. */
export type Rng = () => number;
