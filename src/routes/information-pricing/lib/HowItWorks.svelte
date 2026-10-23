<details class="how" data-testid="how">
	<summary>How it works</summary>
	<div class="body">
		<p>
			Describe what you don't know as inputs with a distribution (Fixed for what you do know), add
			in-between formulas, then list your options and a reward formula for them. Run draws many
			scenarios and scores every option in each one.
		</p>
		<p>
			In each scenario one option comes out on top. Any other option leaves money on the table: its
			opportunity loss. Average that over the scenarios and you get the expected opportunity loss
			(EOL).
		</p>
		<p>
			The best option's EOL is the expected value of perfect information (EVPI): if someone could
			tell you the future, that's the most their tip is worth.
		</p>
		<p>
			The value of information asks the same for one input at a time: how much would you save if you
			only knew roughly where that input lands? It tells you which uncertainty is worth paying to
			resolve.
		</p>
		<p>
			The policy tree turns that into a rule of thumb: a few splits on the inputs, each ending in
			the option to pick there, checked on scenarios it didn't learn from.
		</p>
		<p>
			More in <a href="https://blog.mptc.uk/posts/Pricing-Information">Pricing Information</a>.
		</p>
	</div>
</details>

<style>
	.body p {
		margin: 0 0 var(--sp-2);
	}
	.body p:last-child {
		margin-bottom: 0;
	}
</style>
