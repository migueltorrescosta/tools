# Information Pricing: how it works

The definitions behind `/information-pricing`. The page's "How it works" gives the short version; the background is in [Pricing Information](https://blog.mptc.uk/posts/Pricing-Information).

## Model

Describe what you don't know as inputs with a distribution (Fixed for what you do know), add in-between formulas (intermediates), then list your options (decisions) and a reward formula for them. Run draws many scenarios and scores every option in each one. Add scenarios appends more draws to the ones you have.

## Expected opportunity loss

In each scenario one option comes out on top. Any other option leaves money on the table: its opportunity loss. Average that over the scenarios and you get the expected opportunity loss (EOL).

## Value of perfect information

The best option's EOL is the expected value of perfect information (EVPI): if someone could tell you the future, that's the most their tip is worth.

## Value of information per input

The value of information asks the same for one input at a time: how much would you save if you only knew roughly where that input lands? It tells you which uncertainty is worth paying to resolve.

## Policy tree

The policy tree turns that into a rule of thumb: a few splits on the inputs, each ending in the option to pick there, checked on scenarios it didn't learn from.
