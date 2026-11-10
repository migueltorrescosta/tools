# Symbolic Regression: how it works

The details behind `/symbolic-regression`. The page's "How it works" gives the short version.

## Data

Load a CSV: comma, semicolon and tab delimiters are detected. Pick the column to predict and the inputs to use. Rows with missing or non-numeric values are dropped. A random share of the rows, set by Validation (%), is held back to score each equation.

## Search

A genetic search runs on Web Workers for the time budget, combining the chosen operators. It keeps a Pareto front: the most accurate equation at each complexity. The equation marked **best** balances accuracy against simplicity. Select any equation or point on the Pareto plot to inspect it, or hover one to preview it in the plots.

Run starts a fresh search; while it runs, Run turns into Stop, and Continue resumes a stopped search. The run settings (time budget, seed, workers, validation share and operators) sit behind the Advanced line in the Run box, which names their current values.

The result shows the selected equation with its complexity and validation R²; More metrics holds the MSEs, the RMSE and the score. The list shows three equations: the simplest, the one marked best and the most accurate (plus the selected one, when you picked another); Show all lists the whole front. Copy copies the selected equation as text, LaTeX, Python or JavaScript, picked in the menu beside it. Download CSV saves your data with the selected equation's predictions and each row's split.

## Privacy

Your data never leaves the browser. Datasets under about 2 MB and the last results are saved in local storage. The share link carries only the settings and, for an example, its name.
