# Symbolic Regression: how it works

The details behind `/symbolic-regression`. The page's "How it works" gives the short version.

## Data

Load a CSV: comma, semicolon and tab delimiters are detected. Pick the column to predict and the inputs to use. Rows with missing or non-numeric values are dropped. A random share of the rows, set by Validation (%), is held back to score each equation.

## Search

A genetic search runs on Web Workers for the time budget, combining the chosen operators. It keeps a Pareto front: the most accurate equation at each complexity. The equation marked **best** balances accuracy against simplicity. Select any equation or point on the Pareto plot to inspect it, or hover one to preview it in the plots.

Run starts a fresh search. Stop pauses it and Continue resumes it. Download CSV saves your data with the selected equation's predictions and each row's split.

## Privacy

Your data never leaves the browser. Datasets under about 2 MB and the last results are saved in local storage. The share link carries only the settings and, for an example, its name.
