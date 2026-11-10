# Rank Vote: how it works

The details behind `/rank-vote`. The page's "How it works" gives the short version.

## The flow

1. Create a ballot with a title and its choices.
2. Share the vote link (the copy icon, or the QR code). Each voter ranks the choices and presses Send my vote, which opens the phone's share sheet, or copies the message "My vote for <title>: <code>" on a computer.
3. Paste what voters send into the tally page's Votes box, one per line. The page answers with one sentence (the Condorcet winner, else the instant-runoff winner) and keeps the four counts under "Compare counting methods".

## Reading the Votes box

Each non-blank line is "Name code", a bare code, or any text that holds a code, such as a forwarded message with a chat prefix. The code is the last word on the line that is a valid vote for this ballot (right length, in range and passing the check symbol). The name is the text before it, or before "My vote for" in a forwarded message; a line with no name is called Voter N. A later line for the same name replaces the earlier vote. Lines without a valid code are listed under the box by line number.

The ballot lives in the link itself; entered votes are saved in this browser only.

## The four counts

- **First Past The Post**: each ballot counts for its first choice only. Score: first-choice votes.
- **Instant Runoff**: the choice with the fewest first choices drops out and its ballots move to their next choice, until one choice has a majority. Score: votes in the final round.
- **Borda count**: with $n$ choices, a ballot gives its first choice $n-1$ points, its second $n-2$, down to 0 for its last. Score: Borda points.
- **Copeland**: each pair of choices is compared head to head across all ballots; a choice that beats every other is the Condorcet winner. Score: head-to-head wins minus losses.
