# Wordle Solver: how it works

The details behind `/wordle`. The page's "How it works" gives the short version.

## Entering a guess

After you play a guess in Wordle, look at its tiles: green letters are in the right position, yellow letters are in the word but in the wrong position, and black letters are not in the word. Click the tiles in the tool to match those colours, then press Submit. The tool shows the next word to play.

Keyboard: 1 or B, 2 or Y and 3 or G set the focused tile to black, yellow or green; the arrow keys move between tiles.

## The suggestions

The suggestions follow a fixed, precomputed decision tree. Open with RAISE and play every suggested word exactly as shown. If you open with another word or play anything else, the remaining suggestions no longer apply.

Some suggestions are probe words that can never be the answer: they are chosen because their colours split the remaining candidates best. When only one candidate is left the tool says so; play it and mark every tile green to finish.

The tree is built for Normal mode. Some suggestions ignore letters you already found, so Wordle's Hard Mode may reject them.
