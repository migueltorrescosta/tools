# Company Trends: how it works

The method behind `/company-trends`. The page's "How it works" gives the short version; every figure's source is checked in [`src/routes/company-trends/data/sources/VERIFICATION.md`](../src/routes/company-trends/data/sources/VERIFICATION.md).

## Units

Figures are EUR millions: fiscal-year (trailing twelve months) totals placed at the quarter the fiscal year ends. Quarters in between are interpolated log-linearly between the annual figures.

## Axes

- Revenue runs across on a log scale.
- Operating margin = operating income / revenue, on a fixed −200% to +100% axis. Margins below −200% are pinned to the edge.
- Operating expenses = revenue − operating income.

## Currencies

Rates are the ECB quarterly average euro reference rates (foreign currency units per EUR), from the ECB EXR series (`Q.USD.EUR.SP00.A`, `Q.GBP.EUR.SP00.A`) via the DBnomics mirror of the [ECB Data Portal](https://data.ecb.europa.eu/data/datasets/EXR). USD and GBP fiscal-year figures convert to EUR with the mean of the quarterly rates over the fiscal year. Display in USD or GBP reconverts each quarter with the same fiscal-year mean rate, so reporting-currency figures match the filings.
