/** One stimulus: a word, or an image (a static path or a data URL) with its alt text. */
export type Stimulus = { kind: 'word'; text: string } | { kind: 'image'; src: string; alt: string };

export interface Category {
	label: string;
	items: Stimulus[];
}

/**
 * A comparison: two target categories and two attribute categories. The first attribute is
 * the focal one (Good, Science, Career): it shares the I key with one target per block.
 */
export interface Comparison {
	id: string;
	targets: [Category, Category];
	attributes: [Category, Category];
	/** Preset comparisons ship with the tool; custom ones live in the browser. */
	custom?: boolean;
}

export type InputKind = 'keyboard' | 'touch';
/** The two response keys: E (left, "anything else") and I (right, the focal categories). */
export type Side = 'left' | 'right';

/** One trial as shown: which category the stimulus comes from and the correct side. */
export interface Trial {
	/** 0-3 test blocks; -1 the practice block. */
	block: number;
	/** 'target' or 'attribute' index into the comparison (or the practice categories). */
	group: 'target' | 'attribute';
	category: 0 | 1;
	item: number;
	correct: Side;
	/** The first 4 trials of each block are warm-up and never scored. */
	warmup: boolean;
}

/** A trial with its response: latency to the correct key (errors must be corrected). */
export interface Response extends Trial {
	rt: number;
	error: boolean;
	input: InputKind;
}

export interface Run {
	id: string;
	comparisonId: string;
	/** Labels at the time of the run, so history survives edits and deletions. */
	labels: { targets: [string, string]; attributes: [string, string] };
	date: string;
	input: InputKind;
	/** Which target shared the I key in blocks 1 and 3. */
	firstFocal: 0 | 1;
	responses: Response[];
}
