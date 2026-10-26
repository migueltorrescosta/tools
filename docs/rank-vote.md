# Rank Vote: how it works

The details behind `/rank-vote`. The page's "How it works" gives the short version.

## The flow

1. Create a ballot with a title and its choices.
2. Share the vote link. Each voter ranks the choices and sends you the short vote code it gives them.
3. Enter each name and code on the tally page to see the results under four counting methods.

The ballot lives in the link itself; entered votes are saved in this browser only.

## The four counts

- **First Past The Post**: each ballot counts for its first choice only. Score: first-choice votes.
- **Instant Runoff**: the choice with the fewest first choices drops out and its ballots move to their next choice, until one choice has a majority. Score: votes in the final round.
- **Borda count**: with $n$ choices, a ballot gives its first choice $n-1$ points, its second $n-2$, down to 0 for its last. Score: Borda points.
- **Copeland**: each pair of choices is compared head to head across all ballots; a choice that beats every other is the Condorcet winner. Score: head-to-head wins minus losses.
