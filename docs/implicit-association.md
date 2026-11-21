# Implicit Association

`/implicit-association` runs a Brief Implicit Association Test (BIAT) in the browser. You choose two groups and two attributes, sort words or faces with two keys, and get a D-score. Every run stays in the browser's localStorage, and the page charts your runs as they build up.

## Procedure

The design follows Nosek et al. (2014), the reference for BIAT scoring. `plan` in `src/lib/implicit-association/sequence.ts` builds it:

- A 16-trial practice block on neutral categories (Mammals or Good on I; Birds and Bad on E).
- Four 20-trial blocks. The first attribute (Good, Science, Career) is always focal and shares the I key with one group; E is "anything else". The focal group alternates: blocks 1 and 3 take one group, blocks 2 and 4 the other. Each run picks at random which group comes first and records it (`Run.firstFocal`).
- In each block, the first 4 trials show groups only and are never scored. The remaining 16 alternate group and attribute trials, with each category drawn 4 times. Items cycle in a shuffled order, so each item shows before any repeats.
- A wrong key shows a red ✕, and the trial waits for the correct key. Latency runs from stimulus onset to the correct key, so errors carry their own time cost.
- Stimulus onset is the `requestAnimationFrame` after the stimulus renders. Responses use the event's `timeStamp` (keydown, or pointerdown on the tap zones, which show only on coarse pointers). Each response records its input, and a run counts as touch when most of its responses came from touch.

## Scoring

`score` in `src/lib/implicit-association/score.ts` applies these rules:

1. Drop warm-up trials and trials over 10 s.
2. Recode latencies under 400 ms to 400 ms and over 2000 ms to 2000 ms.
3. For blocks 1–2 and for blocks 3–4, compute D as the mean latency with the second group focal, minus the mean with the first group focal, divided by the sample SD of all latencies in both blocks (not a pooled within-block SD).
4. Average the two D values.

A positive D means the first group goes with the focal attribute more easily than the second group. Bands on $|D|$: under 0.15, no clear association; at least 0.15, slight; at least 0.35, moderate; at least 0.65, strong.

**Quality rule.** A run with more than 10% of test-block responses under 300 ms is kept and shown as a hollow dot. It's left out of means and the heat map.

## Charts

The history has one chart, built from `associations` and `sections` in `src/lib/implicit-association/history.ts` and drawn by `Dumbbell` and `Section` in `src/routes/implicit-association/lib/`:

- **Axes.** A comparison links a pair of groups (Male/Female) with a pair of attributes (Science/Arts). It can be drawn on either axis: on the attribute axis as a dumbbell between its groups, or on the group axis as a dumbbell between its attributes. `sections` picks the fewest axes that show every comparison once. This is a minimum vertex cover of the bipartite graph of group pairs and attribute pairs, found exactly with König's theorem, with ties going to the attribute axis. With the presets, every Good/Bad comparison shares one Good–Bad axis, and the two gender comparisons share one Male–Female axis.
- **Layout.** Axes sit side by side as columns, and stack on narrow screens.
- **Dumbbells.** Each name sits $D/2$ toward the axis end it goes with, so the length is the mean D and the lean gives the direction. Rows are sorted by strength.
- **Colour depth** shows the strength band (slight, moderate, strong): weaker associations fade toward the background.
- **Opacity** shows confidence: faint with fewer than 3 counted runs, medium while the 95% interval of the mean still includes 0, and solid once the interval excludes 0. Only the marks fade; names and values keep full contrast.
- **Labels.** Under each dumbbell are the mean D and the run count. Hovering gives a sentence with the direction, band, confidence and the 95% interval.
- **Runs.** Keyboard and touch runs are averaged together, and runs flagged as too fast are left out. The "All runs" table lists every run, flagged ones included, and doubles as the chart's table view.

## Stimuli and licences

- The word lists are our own; `PRESETS` in `src/lib/implicit-association/presets.ts` holds them. Project Implicit's lists and images are licensed for non-commercial research, so they are not reused.
- The faces in the race comparisons come from the Face Research Lab London Set (DeBruine & Jones, 2017, [CC BY 4.0](https://doi.org/10.6084/m9.figshare.5047666.v5)). Its participants consented to use "in lab-based and web-based studies in their original or altered forms". The tool uses 6 neutral front faces per group (3 women, 3 men), picked at random with seed 7 from the self-reported White, Black and East Asian faces. Each face is cropped to a square around its template landmarks and resized to 240 px WebP (`static/implicit-association/faces/`). The set has no West Asian preset: its self-reported West Asian faces don't read as one recognisable group. It has no age preset either: only 8 of the 100 faces are over 40.
- MR2 (Strohminger et al., 2016) was considered and rejected. It is CC BY-NC-SA, but its authors hand it out through a request form, so it isn't re-hosted here.

## Storage and sharing

- localStorage key `implicit-association:runs` holds every run with its trial-level responses.
- Custom comparisons live in IndexedDB (database `implicit-association`, store `kv`, key `custom`; see `src/lib/implicit-association/idb.ts`), because uploaded images, stored as 160 px JPEG data URLs, can outgrow localStorage. The bin in the top bar clears both.
- Export writes both keys to a versioned JSON file (`Backup`). Import merges by id.
- The share link carries the selected comparison: `#p=<preset id>` for a preset, `#c=<base64url JSON>` for a word-only custom comparison. A custom comparison's id is a hash of its content, so a shared test groups with the same test in the recipient's history. Image comparisons aren't encoded in the link.

## Caveats

The IAT's internal consistency is about 0.8, but its test-retest reliability is only about 0.5 (Greenwald & Lai, 2020), and the BIAT is noisier per run. A single score says little about one person, which is why the page leads with the average over runs. Browser timing adds a few milliseconds of noise from keyboards and more from touchscreens (Reimers & Stewart, 2015). That noise is small next to the 100–300 ms differences the test measures.
