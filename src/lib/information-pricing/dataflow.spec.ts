import { describe, expect, it } from 'vitest';
import { dataflow, DECISION_NODE, reach, REWARD_NODE, texParam } from './dataflow';
import { presetModel } from './presets';

const ids = { input: (i: number) => `in${i}`, intermediate: (i: number) => `m${i}` };

describe('dataflow', () => {
	it('draws the airline preset: a node per row, the decision and the reward', () => {
		const g = dataflow(presetModel('airline-share-buyback'), ids);
		expect(g.nodes).toHaveLength(7 + 4 + 2);
		const byId = new Map(g.nodes.map((n) => [n.id, n]));
		expect(byId.get('in0')!.tex).toBe('R \\sim \\mathrm{LogNormal}(1.4,\\ 0.35)');
		expect(byId.get('in1')!.tex).toBe('K \\sim \\mathrm{LogNormal}(3.5 \\times 10^{8},\\ 0.2)');
		expect(byId.get('in6')).toMatchObject({ kind: 'fixed', tex: '\\mathrm{C0} = 950' });
		expect(byId.get('m0')!.tex).toBe('\\mathrm{Rev} = K \\cdot p');
		expect(byId.get(DECISION_NODE)!.tex).toBe('b \\in \\{0, 250, \\dots, 1000\\}');
		expect(byId.get(REWARD_NODE)!.tex).toMatch(/^\\text\{Reward\} = /);
		// Rev(K,p) Fuel(K,F) Delta(Rev,Fuel) L(C0,b,Delta) reward(b,R,L,i,Lr)
		expect(g.edges).toHaveLength(14);
		expect(g.edges.filter((e) => e.to === REWARD_NODE).map((e) => e.from)).toEqual([
			DECISION_NODE,
			'in0',
			'm3',
			'in5',
			'in3'
		]);
	});

	it('shows an invalid formula as raw text and keeps the edges it tokenises', () => {
		const model = presetModel('airline-share-buyback');
		model.intermediates[0].formula = 'K * p +';
		const g = dataflow(model, ids, { intermediates: new Set([0]), reward: false });
		const rev = g.nodes.find((n) => n.id === 'm0')!;
		expect(rev).toMatchObject({ tex: null, raw: 'K * p +', error: true });
		expect(g.edges.filter((e) => e.to === 'm0').map((e) => e.from)).toEqual(['in1', 'in4']);
	});

	it('lists four or fewer decision values in full', () => {
		const g = dataflow(presetModel('blank'), ids);
		expect(g.nodes.find((n) => n.id === DECISION_NODE)!.tex).toBe('d \\in \\{0, 1\\}');
	});

	it('finds everything upstream and downstream of a node', () => {
		const g = dataflow(presetModel('airline-share-buyback'), ids);
		const up = reach(g, 'm2', 'up');
		expect([...up.nodes].sort()).toEqual(['in1', 'in2', 'in4', 'm0', 'm1']);
		expect(up.edges.size).toBe(6);
		const down = reach(g, 'm2', 'down');
		expect([...down.nodes].sort()).toEqual(['m3', REWARD_NODE]);
	});

	it('writes large round parameters in powers of ten', () => {
		expect(texParam(1e7)).toBe('10^{7}');
		expect(texParam(3.5e8)).toBe('3.5 \\times 10^{8}');
		expect(texParam(123456)).toBe('123{,}456');
		expect(texParam(0.001)).toBe('0.001');
	});
});
