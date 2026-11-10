<details class="how" data-testid="how">
	<summary>How it works</summary>
	<p>
		What is it worth to know before you decide? Build a model, simulate it and price the
		uncertainty. Everything runs in your browser.
	</p>
	<p>
		List what you don't know as inputs, then your options and a reward formula. Press Run to score
		every option over many scenarios. The best option's average regret is what perfect information
		is worth. The value chart and the policy tree show which input is worth resolving.
	</p>
	<p>
		Inputs are the things you're unsure about, each with a distribution. Intermediates are named
		formulas that reuse inputs, other intermediates or the decision; use them to break up a long
		reward. Decisions are the options you choose between, how each is labelled, and the reward to
		maximise. The dataflow shows how the numbers feed each other, from the inputs down to the
		reward; click a box to find its row and light up what it uses and what uses it.
	</p>
	<p>
		After a run, Add scenarios draws more scenarios onto the ones you have, and Scenarios (CSV)
		downloads every one: inputs, intermediates, each decision's reward and opportunity loss, and the
		optimal reward.
	</p>
	<p>
		In the scatter, across is the value of knowing an input first: how much better your decision
		gets, on average, if you learn it before choosing. Up is its share of profit spread: how much of
		the ups and downs in your profit, under the recommended decision, come from that input alone
		(100 % means all of them). The policy tree's settings cap its depth, its smallest group (a share
		of all scenarios) and the smallest gain a split must bring.
	</p>
	<p>
		The definitions are in the
		<a href="https://github.com/migueltorrescosta/tools/blob/main/docs/information-pricing.md"
			>docs</a
		>, and the background in
		<a href="https://blog.mptc.uk/posts/Pricing-Information">Pricing Information</a>.
	</p>
</details>
