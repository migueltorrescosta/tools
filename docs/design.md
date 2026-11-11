# Design

How tools.mptc.uk looks and why. The owner chose this look in November 2026 from renders of the real site (bead w-06a). The colours, sizes and spaces are tokens in `src/lib/styles/tokens.css`, and each page is built from the components in `src/lib/ui`. This page gives the rules those files can't state on their own.

## The look: dawn horizon

- **Background:** a warm-to-cool sweep, peach at the top of the window and blue at the bottom, neutral between, where the content sits (`--bg`, `--bg-top`, `--bg-bottom`). It is fixed to the window and the boxes scroll over it (`body::before` in `src/lib/styles/base.css`). No grid.
- **Glass boxes:** every box and the top bar are tinted glass that mostly hides the gradient (66% opaque in light, 60% in dark), blurred 18px with a hairline edge, an inner top highlight and a soft shadow (`--box-*` in `tokens.css`). The recipe follows Apple's and Microsoft's material guidance: text never sits on the raw gradient. Asked for less transparency, the boxes turn solid. Controls keep the opaque `--surface`.
- **Space:** airy. Boxes have 24px of padding, the middle spacing steps are 16, 20 and 32px, and the reading column is 64rem.
- **Accent:** one dawn orange (`--accent`). It marks links, the main button, focus and the picked option, and nothing else. Status colours (`--success`, `--warning`, `--danger`) mark states. A colour that carries no meaning (decorative stripes, a tint per item) is left out.
- **Type:** the system font everywhere. Monospace only for code and values people copy.
- **Section titles:** `Panel` titles are body size over a short accent rule, with no header band.

## The frame

- **Top bar** (`src/routes/+layout.svelte`): the breadcrumb "Tools / Tool name", the tool's own actions (Share and Clear from `PageHeader`'s `actions`, drawn in the bar through `headerActions` in `src/lib/ui/header-actions.svelte.ts`), then the three-way theme switch (`ThemeSwitch`).
- **No title row:** `PageHeader` keeps the h1 for screen readers only. Credits and blog links go in How it works.
- **Theme:** Light, Match device and Dark (`setMode` in `src/lib/theme.svelte.ts`). Match device clears the saved choice. The build keeps `light-dark()` as written (`build.cssTarget` in `vite.config.ts`). Lowered, it would ignore the switch.
- **Homepage:** two boxes: a find box (intro, filter) that stays in view, beside the list box on a wide screen and above it on a phone; the list box holds the groups in two columns, the matches, or the no-match line. While you type, the matches show as one list, Enter opens the first, and `/` jumps to the filter.

## Boxes

- Every box is a `Panel` (`src/lib/ui/Panel.svelte`), a `boxed` `Fold`, or one of the homepage's two boxes (themselves Panels in `src/routes/+page.svelte`). Nothing else draws box chrome.
- No box inside a box.
- Everything on a page sits inside a box, except the footer and step indicators.
- How it works and References are the last lines of the last box.
- At most 5 boxes on a page, counting everything.

## Rules inside a tool

- **The answer first:** a result opens with its `Answer` (`src/lib/ui/Answer.svelte`): a bold headline that states it ("Pizza wins", "Signal X looks like Gamma …"), then one plain sentence, then its detail. Results stay open; tables may fold, charts don't.
- **Settings fold, outputs don't:** run settings go behind the one Advanced line in `RunControls` (`fields` with a `summary`; bind `advancedOpen` to open it when a field inside has an error). A tool's preset sits in the Run box (`preset`), right above Run.
- **Closed lines:** any other fold is a `Fold` (`src/lib/ui/Fold.svelte`): "Label · what it holds", accent label, muted summary. `boxed` gives it Panel chrome, for a whole panel that starts closed.
- **One main button:** Run turns into Stop while running, and Continue appears only after a stop.
- **No (i) icons:** where a control needs explaining, use one short visible hint line (a `Field` hint, or the `.hint` class in `src/lib/styles/utilities.css`). Otherwise the explanation goes in How it works.
- **Messages are text:** `Alert` draws its symbol and coloured text, with no box. Errors sit under the field they concern. Inside an existing live region, or for a line that isn't news, pass `live={false}`.
- **Actions that read as text** (Change, Try an example, Pause) are `Button variant="link"`; add `tone="muted"` for a quiet one beside a main action (Undo, Start over).
- **How it works** (`details.how`, styled in `base.css`) is a quiet link at the end of the last box. It holds the method, the credits and the blog links. References stay open below it.
- **Destructive actions are quiet:** Clear is grey until it is hovered or armed.
- **Touch:** controls are 36px, and 44px under a coarse pointer (`--control-h`).
