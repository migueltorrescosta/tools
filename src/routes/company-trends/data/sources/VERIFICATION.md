# Dataset verification log

Every fiscal-year anchor in `companies/*.json` was re-checked against a primary source (task mg-y2m1.7),
because the original curation read figures through a summarizing fetcher.

Method:

- SEC filers: SEC XBRL `companyconcept` API (exact raw values per fiscal-year context, 10-K / 20-F); pre-XBRL
  years from the income statement or selected financial data tables of the 10-K / 20-F filings.
- Other filers: annual reports and financial statements, reading the exact table row with its column headers.
- Tolerance: exact to the filed unit. Figures filed in thousands are stored to the thousand (e.g. 19.108); figures filed in millions are stored as whole or one-decimal millions as printed.
- Values that could not be confirmed from a primary source were removed (gaps are interpolated in the chart).
- Private companies (OpenAI, Anthropic) stay `estimated`; checked only against the cited articles.

## Alphabet (`alphabet`)

- Anchors checked: 26 (revenue + operating income each)
- Sources: SEC XBRL companyconcept CIK0001288776 (Revenues FY2010-2014, OperatingIncomeLoss FY2007-2014) and CIK0001652044 (Revenues/RevenueFromContractWithCustomerExcludingAssessedTax, OperatingIncomeLoss FY2015-2025); Google 10-K FY2004 Item 6 FY2000-2004 and 10-K FY2009 Item 6 FY2005-2009 (thousands)
- Corrected:
  - none (FY2000-2009 stored to the thousand as filed; all matched 10-K FY2004 / FY2009 Item 6)
- Notes fixed: added that 2012 operating income was later restated to 13,834
- Removed / unverifiable:
  - none
- sourceUrl fixes: none

## Amazon (`amazon`)

- Anchors checked: 26 (revenue + operating income each)
- Sources: SEC XBRL companyconcept CIK0001018724 (SalesRevenueNet FY2007-2017, RevenueFromContractWithCustomerExcludingAssessedTax FY2018-2025, OperatingIncomeLoss FY2007-2025); 10-K FY2002 Item 6 FY2000-2001; 10-K FY2004 Consolidated Statements of Operations FY2002-2004; 10-K FY2006 Item 6 FY2005-2006
- Corrected:
  - none (FY2000-2004 stored to the thousand as filed; all matched. FY2003 OI 270.595 per 10-K FY2004 statements of operations; FY2006 10-K selected data prints 270)
- Removed / unverifiable:
  - none
- sourceUrl fixes: none

## Anthropic (`anthropic`)

- Anchors checked: 2 (revenue + operating income each)
- Sources: Capital Brief (citing Reuters review of confidential IPO prospectus, 2026-09-29): 2025 revenue "USD4.59 billion", operating loss "USD8.06 billion", GAAP net loss USD41.97B; 2024 revenue "USD386 million", operating loss "USD2.98 billion", net loss USD8.31B; consistent with notes. Corroborated by secondary coverage of the Reuters report. Prospectus not public on EDGAR (EFTS search: no Anthropic S-1), so no better-attested primary figures exist; quality "estimated" retained.
- Corrected:
  - none
- Removed / unverifiable:
  - none
- sourceUrl fixes: none

## Apple (`apple`)

- Anchors checked: 26 (revenue + operating income each)
- Sources: SEC XBRL companyconcept CIK0000320193 (SalesRevenueNet FY2007-2017 incl. 10-K/A 0001193125-10-012091 for FY2007 restated 24,578/4,407; RevenueFromContractWithCustomerExcludingAssessedTax FY2018-2025; OperatingIncomeLoss FY2007-2025); 10-K FY2002/FY2004/FY2007 Consolidated Statements of Operations FY2000-2006
- Corrected:
  - none
- Removed / unverifiable:
  - none
- sourceUrl fixes: none

## ASML (`asml`)

- Anchors checked: 26 (revenue + operating income each)
- Sources: SEC XBRL companyconcept CIK0000937966 (SalesRevenueNet FY2009-2017, RevenueFromContractWithCustomerExcludingAssessedTax FY2016-2025, OperatingIncomeLoss FY2009-2025 incl. 20-F/A entries: FY2009 -165,013k in 20-F/A 0000950123-10-018242, later -163,125k); 20-F FY2004 Item 3 selected data, EUR thousands (FY2000-2004); 20-F FY2009 Item 3.A selected data (FY2005-2009)
- Corrected:
  - none
- Removed / unverifiable:
  - none
- sourceUrl fixes: none

## BMW (`bmw`)

- Anchors checked: 26 (revenue + operating income each)
- Sources: BMW Annual Report 2009 ten-year comparison (UAB copy; FY2000); BMW Annual Report 2010 ten-year comparison (UAB copy; FY2001-2010); BMW Group Report 2020 ten-year comparison PDF (FY2011-2013); BMW Group Report 2023 ten-year comparison PDF (FY2014-2023, 2018 restated); BMW FY2025 results press release 12 Mar 2026 overview table (FY2024-2025, Group revenues / Group EBIT). Rows 'Revenues' and 'Profit/Earnings before financial result' read via PDF text extraction.
- Corrected:
  - none
- Removed / unverifiable:
  - none
- sourceUrl fixes: none

## Boeing (`boeing`)

- Anchors checked: 26 (revenue + operating income each)
- Sources: SEC XBRL companyconcept CIK0000012927 (Revenues, OperatingIncomeLoss) FY2007-2025; 10-K FY2002 Consolidated Results of Operations FY2000; 10-K FY2003 Consolidated Statements of Operations FY2001-2003; 10-K FY2006 Consolidated Statements of Operations FY2004-2006
- Corrected:
  - none (all 52 values match)
- Removed / unverifiable:
  - none
- sourceUrl fixes: none

## BP (`bp`)

- Anchors checked: 26 (revenue + operating income each)
- Sources: SEC XBRL companyconcept CIK0000313807 (ifrs-full Revenue, ProfitLossBeforeTax) FY2015-2025; BP Q4 results 6-Ks (bp6k4q01, bp200402106k, bp200602076k, bp200702066k, bp200802056k, bp200902036k2, bp201002026k2, bp201202076k, d669396d6k, bp201502036k) group income statements FY2000-2014
- Corrected:
  - none
- Removed / unverifiable:
  - none
- sourceUrl fixes: none

## Chevron (`chevron`)

- Anchors checked: 26 (revenue + operating income each)
- Sources: SEC XBRL companyconcept CIK0000093410 (Revenues, IncomeLossFromContinuingOperationsBeforeIncomeTaxesMinorityInterestAndIncomeLossFromEquityMethodInvestments) FY2007-2025; ChevronTexaco 10-K FY2002 (FY2000), 10-K FY2003 (FY2001-2003; FY2002 revenue 98913 is the FY2003-10-K restated figure, FY2002 10-K showed 99049), Chevron 10-K FY2006 (FY2004-2006) Consolidated Statement of Income
- Corrected:
  - none (values). Source text only: FY2007 accession 0000950123-10-048910 -> 0000950123-10-016846 (FY2009 10-K, the filing that carries the FY2007 facts); FY2009 accession 0000093410-12-002976 -> 0000950123-12-002976 (typo)
- Removed / unverifiable:
  - none
- sourceUrl fixes: none

## Coca-Cola (`coca-cola`)

- Anchors checked: 26 (revenue + operating income each)
- Sources: 10-K FY2003 Item 6 Summary of Operations FY2000-2003; 10-K FY2008 Item 6 FY2004-2008; 10-K FY2010 XBRL R1.xml Consolidated Statements of Income FY2008-2010; 10-K R2/R3 Consolidated Statements of Income in FY2013, FY2016, FY2019, FY2022, FY2025 filings (FY2011-2025). SEC companyconcept API returned empty unit arrays for CIK0000021344 via WebFetch, so filing statements used directly.
- Corrected:
  - none
- Removed / unverifiable:
  - none
- sourceUrl fixes: none

## Costco (`costco`)

- Anchors checked: 27 (revenue + operating income each)
- Sources: SEC XBRL companyconcept CIK0000909832 (Revenues FY2009-2025, OperatingIncomeLoss FY2008-2026); 10-K FY2026 Consolidated Statements of Income (Total revenue 303,154, Operating income 11,685); 10-K FY2010 Item 6 FY2008 (net sales 70,977 + membership fees 1,506 = 72,483); 10-K FY2007 Item 6 FY2003-2007 (net sales + membership fees, in thousands); 10-K FY2002 Item 6 FY2000-2002 (Total revenue, Operating income, in thousands)
- Corrected:
  - none
- Removed / unverifiable:
  - none
- sourceUrl fixes:
  - FY2008 (2008-08-31): XBRL Revenues concept has no FY2008 fact; source/sourceUrl changed to Costco 10-K FY2010 Item 6 (https://www.sec.gov/Archives/edgar/data/909832/000119312510230379/d10k.htm)

## Eli Lilly (`eli-lilly`)

- Anchors checked: 26 (revenue + operating income each)
- Sources: 10-K FY2004 Exhibit 13 Selected Financial Data (Net sales / Income before income taxes) FY2000-2004; 10-K FY2009 Selected Financial Data and Consolidated Statements of Operations FY2005-2009; SEC XBRL companyconcept CIK0000059478 (Revenues, IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest) FY2007-2025 by accn
- Corrected:
  - none (all 52 values match; FY2018 24,555.7 / 3,795.7 as first reported, FY2019 10-K restatement 3,680.1 noted in file)
- Removed / unverifiable:
  - none
- sourceUrl fixes: none

## Eni (`eni`)

- Anchors checked: 26 (revenue + operating income each)
- Sources: SEC XBRL companyconcept CIK0001002242 (ifrs-full RevenueFromContractsWithCustomers FY2017-2025, ProfitLossFromOperatingActivities FY2015-2025); Eni 6-K 2017-04-07 FY2016 results FY2015-2016 (continuing ops); 20-F FY2004 (Italian GAAP) FY2000-2003, 20-F FY2008 FY2004-2008, 20-F FY2011 FY2009-2011, 20-F FY2014 FY2012-2014 Item 3 Selected Financial Information
- Corrected:
  - none
- Removed / unverifiable:
  - none
- sourceUrl fixes: none

## ExxonMobil (`exxonmobil`)

- Anchors checked: 26 (revenue + operating income each)
- Sources: SEC XBRL companyconcept CIK0000034088 (Revenues, IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest) FY2009-2025, stored values match the cited later-10-K (restated) facts (e.g. FY2015 239854, FY2016 200628, FY2017 244363, FY2018 290212); 10-K FY2002/FY2005/FY2008 Consolidated Statement of Income FY2000-2008 ('Total revenue' / 'Total revenues and other income', 'Income before income taxes')
- Corrected:
  - none
- Removed / unverifiable:
  - none
- sourceUrl fixes: none

## Ferrari (`ferrari`)

- Anchors checked: 15 (revenue + operating income each)
- Sources: SEC XBRL companyconcept CIK0001648416 (ifrs-full Revenue, ProfitLossFromOperatingActivities) FY2015-2025, single value per period (no restatements); 20-F FY2015 Item 3.A Selected Financial Data (Net revenues, EBIT, EUR million) FY2011-2015; 20-F FY2016 Item 3.A FY2012-2016; R2/R3 income-statement pages (FY2019, FY2022, FY2025 filings) confirmed EUR-thousands values for 2017-2025
- Corrected:
  - none
- Removed / unverifiable:
  - none
- sourceUrl fixes: none

## Ford (`ford`)

- Anchors checked: 26 (revenue + operating income each)
- Sources: 10-K FY2004 Item 6 (FY2000-2004), 10-K FY2005 Item 6 (FY2005), 10-K FY2010 Item 6 (FY2006-2010); XBRL R pages of 10-K FY2013 R2 (FY2011-2013), FY2016 R2 (FY2014-2016), FY2019 R3 (FY2017-2019), FY2022 R4 (FY2020-2022), FY2025 R3 (FY2023-2025); cross-checked SEC XBRL companyconcept CIK0000037996 Revenues FY2008-2024
- Corrected:
  - none
- Removed / unverifiable:
  - none
- sourceUrl fixes: none
- Note: XBRL concept IncomeLossFromContinuingOperationsBeforeIncomeTaxesMinorityInterestAndIncomeLossFromEquityMethodInvestments for FY2009-2013 excludes equity in affiliates (e.g. FY2013 5932); stored values follow the statement line 'Income before income taxes' (incl. equity income), consistent with notes.

## General Motors (`general-motors`)

- Anchors checked: 25 (revenue + operating income each)
- Sources: Old GM (CIK 40730) 10-K FY2002 Consolidated Statements of Income (FY2000-2001), 10-K FY2004 (FY2002-2004), 10-K FY2007 MD&A Consolidated Results (FY2005), 10-K FY2008 MD&A Consolidated Results (FY2006-2008); SEC XBRL companyconcept CIK0001467858 (Revenues; IncomeLossFromContinuingOperationsBeforeIncomeTaxesMinorityInterestAndIncomeLossFromEquityMethodInvestments for FY2010; IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest for FY2011-2025)
- Corrected:
  - none
- Removed / unverifiable:
  - none
- sourceUrl fixes: none
- Note: FY2015/FY2016 values (152356/7718, 166380/11684) are as reported in the cited FY2016 10-K (pre-Opel restatement; FY2017 10-K restated FY2016 to 149184/12008), consistent with notes "2017+ restated excl. Opel/Vauxhall".

## Inditex (`inditex`)

- Anchors checked: 27 (revenue + operating income each)
- Sources: Informe Anual 2003 'Principales indicadores' (Ventas, EBIT; Spanish GAAP) FY1999-2003; Informe Anual 2009 indicator table + Pérdidas y Ganancias consolidada FY2004-2009; Informe Anual 2011 FY2010-2011; AR2013/AR2015 online consolidated income statements (thousands EUR) FY2012-2015; Consolidated Annual Accounts 2017/2019/2021 income statements FY2016-2021; FY23 Results and FY2025 Results income statements FY2022-2025
- Corrected:
  - FY2009 (2010-01-31) revenue: 11048 -> 11084 (Informe Anual 2009, Pérdidas y Ganancias consolidada, Ventas 11,083,514 thousand; the indicator tables in AR2009 and AR2011 print transposed 11.048, contradicted by the audited statement, the report's own text "11.084 millones" and segment totals). Source text and notes updated.
- Removed / unverifiable:
  - none
- sourceUrl fixes: none

## Intel (`intel`)

- Anchors checked: 26 (revenue + operating income each)
- Sources: SEC XBRL companyconcept CIK0000050863 (SalesRevenueNet FY2007-2017, RevenueFromContractWithCustomerExcludingAssessedTax FY2016-2025, OperatingIncomeLoss FY2007-2025); 10-K 2004 Selected Financial Data FY2000-2004; 10-K 2006 Selected Financial Data FY2002-2006
- Corrected:
  - none
- Removed / unverifiable:
  - none
- sourceUrl fixes: none

## Johnson & Johnson (`johnson-johnson`)

- Anchors checked: 25 (revenue + operating income each)
- Sources: SEC XBRL companyconcept CIK0000200406 (SalesRevenueGoodsNet FY2007-2017, RevenueFromContractWithCustomerExcludingAssessedTax FY2016-2025, IncomeLossFromContinuingOperationsBeforeIncomeTaxesMinorityInterestAndIncomeLossFromEquityMethodInvestments FY2007-2019, IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest FY2019-2025), matched to each year's own 10-K accn; 10-K FY2009 Exhibit 13 ten-year Summary of Operations (Sales to customers / Earnings before provision for taxes on income) FY2000-2009
- Corrected:
  - none (all 50 values match). Notes: removed false claim that the FY2015 revenue XBRL context ends 2015-12-27 (XBRL context is 2014-12-29 to 2016-01-03); replaced with 53-week-year statement.
- Removed / unverifiable:
  - none
- sourceUrl fixes: none

## LVMH (`lvmh`)

- Anchors checked: 26 (revenue + operating income each)
- Sources: Documents de référence 2002/2003 multi-year table ('Chiffre d'affaires', 'Résultat opérationnel', French GAAP) FY2000-2003; DR2006 compte de résultat ('Ventes', 'Résultat opérationnel') FY2004-2006; DR2009 (AMF) FY2007-2009; DR2012 FY2010-2012; annual results press releases 2015/2017/2020/2025 condensed income statements ('Revenue', 'Operating profit') FY2013-2020, FY2023-2025; Financial Documents Dec 31 2023 FY2021-2023
- Corrected:
  - none
- Removed / unverifiable:
  - none
- sourceUrl fixes: none

## McDonald's (`mcdonalds`)

- Anchors checked: 26 (revenue + operating income each)
- Sources: SEC XBRL companyconcept CIK0000063908 (Revenues, OperatingIncomeLoss) FY2007-2025; 10-K FY2004 Item 6 11-year summary FY2000-2004; 10-K FY2010 Item 6 6-year summary FY2005-2010; R2/R3 Consolidated Statement of Income in FY2013, FY2016, FY2019, FY2022, FY2025 10-Ks (FY2023 shown as 25,494.0 / 11,647.0 in FY2025 10-K vs 25,493.7 / 11,646.7 originally; stored values match the cited filing).
- Corrected:
  - none
- Removed / unverifiable:
  - none
- sourceUrl fixes: none

## Mercedes-Benz Group (`mercedes-benz`)

- Anchors checked: 26 (revenue + operating income each)
- Sources: DaimlerChrysler 20-F FY2002 (selected financial data revenues; segment table Total operating profit) FY2000-2001; Daimler AR2011 Ten Year Summary ('Revenue', 'Operating profit (loss)/EBIT') FY2002-2010; Daimler AR2020 Ten-Year Summary E.01 ('Revenue', 'EBIT') FY2011-2020; MBG AR2021 statement of income (continuing ops) FY2021; MBG AR2023 statement of income FY2022-2023; FY2025 results press release key figures (reported EBIT row, not adjusted) FY2024-2025
- Corrected:
  - none
- Removed / unverifiable:
  - none
- sourceUrl fixes: none

## Meta Platforms (Facebook) (`meta`)

- Anchors checked: 19 (revenue + operating income each)
- Sources: SEC XBRL companyconcept CIK0001326801 (Revenues FY2010-2017, RevenueFromContractWithCustomerExcludingAssessedTax FY2016-2025, OperatingIncomeLoss FY2010-2025); Form S-1 (Feb 2012) Selected Consolidated Financial Data FY2007-2011
- Corrected:
  - none
- Removed / unverifiable:
  - none
- sourceUrl fixes: none

## Microsoft (`microsoft`)

- Anchors checked: 27 (revenue + operating income each)
- Sources: SEC XBRL companyconcept CIK0000789019 (SalesRevenueNet FY2009-2016, Revenues/RevenueFromContractWithCustomerExcludingAssessedTax FY2017-2026, OperatingIncomeLoss FY2009-2026 incl. FY2017 ASC 606 restated 29,025 in accn 0001564590-18-019062); 10-K FY2004 and FY2008 Item 6 Selected Financial Data FY2000-2008
- Corrected:
  - none (values); notes corrected: FY2002-2003 in the FY2004 10-K are restated for retroactive SFAS 123 adoption (FY2000-2001 not restated), not "as originally reported"
- Removed / unverifiable:
  - none
- sourceUrl fixes: none

## Netflix (`netflix`)

- Anchors checked: 26 (revenue + operating income each)
- Sources: SEC XBRL companyconcept CIK0001065280 (Revenues, OperatingIncomeLoss) FY2007-2025, all values exact to the thousand; 10-K FY2006 Item 6 Selected Financial Data FY2002-2006; 10-K FY2004 Item 6 FY2000-2001 (also confirms notes' 2004 restatement claim: 506,228 in FY2004 10-K vs 500,611 in FY2006 10-K; operating income identical)
- Corrected:
  - none
- Removed / unverifiable:
  - none
- sourceUrl fixes: none
- Note: values are stored in millions with three decimals (exact thousands), not rounded to the nearest million as the brief's convention states. Left unchanged (exact, not wrong); flag for a global formatting decision.

## Nike (`nike`)

- Anchors checked: 27 (revenue + operating income each)
- Sources: SEC XBRL companyconcept CIK0000320187 (SalesRevenueNet FY2009-2018, RevenueFromContractWithCustomerExcludingAssessedTax FY2018-2026, IncomeLossFromContinuingOperationsBeforeIncomeTaxes... FY2020-2026); R2/R3 Consolidated Statements of Income in FY2011, FY2014, FY2017, FY2020, FY2023, FY2026 10-Ks (FY2009-2026; FY2012 restated 23,331 in FY2014 10-K vs 24,128 original, stored matches cited filing); 10-K FY2002 Consolidated Statements of Income FY2000-2002; 10-K FY2005 Consolidated Statements of Income FY2003-2005; 10-K FY2008 Item 6 FY2006-2008.
- Corrected:
  - none (values). Source label for FY2003-2005 changed from "Item 6 Selected Financial Data" to "Consolidated Statements of Income" (Item 6 in that 10-K shows no pretax income row). Notes updated: the "before cumulative effect of accounting change" pretax label applies to FY2000-2005, not only FY2000-2002.
- Removed / unverifiable:
  - none
- sourceUrl fixes: none

## NVIDIA (`nvidia`)

- Anchors checked: 27 (revenue + operating income each)
- Sources: SEC XBRL companyconcept CIK0001045810 (Revenues FY2008-2018/FY2020-2026, RevenueFromContractWithCustomerExcludingAssessedTax FY2017-2022, OperatingIncomeLoss FY2009-2026); 10-K FY2004 Selected Financial Data FY2000-2004; 10-K FY2008 Selected Financial Data FY2004-2008 (restated)
- Corrected:
  - FY2019 (2019-01-27) revenue: 11798 -> 11716 (XBRL RevenueFromContractWithCustomerExcludingAssessedTax, 10-K accn 0001045810-19-000023; 11798 appears in no filing fact)
- Removed / unverifiable:
  - none
- sourceUrl fixes: FY2019 sourceUrl -> companyconcept RevenueFromContractWithCustomerExcludingAssessedTax.json (revenue not tagged under us-gaap:Revenues for that year). Notes amended: FY2008 OI not in XBRL, confirmed from FY2008 10-K.

## OpenAI (`openai`)

- Anchors checked: 2 (revenue + operating income each)
- Sources: Where's Your Ed At, "Exclusive: OpenAI Losses Increased Nearly 8X in 2025, With Spending Hitting $34 Billion" (2026-06-15), states audited documents independently verified by the FT: 2024 revenue "$3.7 billion", loss from operations "$8.78 billion"; 2025 revenue "$13.07 billion", loss from operations "$20.92 billion". No more precise 2024 revenue given. No public S-1 on EDGAR (S-1 filed confidentially 2026-05-22), so no better-attested primary figures exist; quality "estimated" retained.
- Corrected:
  - none
- Removed / unverifiable:
  - none
- sourceUrl fixes: none

## Oracle (`oracle`)

- Anchors checked: 27 (revenue + operating income each)
- Sources: SEC XBRL companyconcept CIK0001341439 (Revenues, OperatingIncomeLoss) FY2008-2026; FY2021 10-K R4 income statement FY2019-2021 (cross-check); 10-K FY2004 (CIK 777676) Selected Financial Data FY2000-2004; 10-K FY2007 Selected Financial Data FY2003-2007
- Corrected:
  - none (FY2018 13679/39831 = as first reported in FY2018 10-K; FY2019 10-K restated to 13264/39383 under ASC 606 — stored first-reported values retained)
- Removed / unverifiable:
  - none
- sourceUrl fixes: none

## Pfizer (`pfizer`)

- Anchors checked: 26 (revenue + operating income each)
- Sources: 10-K FY2002/FY2004/FY2007 Exhibit 13 income statements (Revenues; Income from continuing operations before provision for taxes on income, minority interests...) FY2000-2007; XBRL R2/R3 statements of income in 10-K FY2010, FY2013, FY2016, FY2019, FY2022, FY2025 FY2008-2025; cross-checked against SEC XBRL companyconcept CIK0000078003 (SalesRevenueNet, Revenues, IncomeLossFromContinuingOperationsBeforeIncomeTaxes...)
- Corrected:
  - none (all 52 values match the cited filing presentation; FY2023 revenue 59,553 is the FY2024/FY2025 10-K restatement, first-reported 58,496, consistent with notes)
- Removed / unverifiable:
  - none
- sourceUrl fixes: none

## Procter & Gamble (`procter-gamble`)

- Anchors checked: 27 (revenue + operating income each)
- Sources: SEC XBRL companyconcept CIK0000080424 (SalesRevenueNet FY2007-2018, Revenues FY2018-2026, OperatingIncomeLoss FY2007-2026, incl. restated values from accn 0000080424-15-000070 and 8-K 0000080424-18-000106); 10-K FY2005 Ex.13 Financial Summary FY2000-2005; 10-K FY2007 Ex.13 Financial Summary FY2006-2007; 10-K FY2015 Item 6 Financial Summary FY2011-2015; FY2026 10-K R3.htm FY2024-2026.
- Corrected:
  - none
- Removed / unverifiable:
  - none
- sourceUrl fixes: none

## SAP (`sap`)

- Anchors checked: 26 (revenue + operating income each)
- Sources: SEC XBRL companyconcept CIK0001000184 (ifrs-full Revenue, ProfitLossFromOperatingActivities) FY2015-2025; 20-F FY2019/FY2022/FY2025 XBRL R2 income statements (FY2017-2025; FY2021-22 as first reported 27,842/4,656 and 30,871/4,670, later restated for Qualtrics to 26,953/6,308 and 29,520/5,914 — stored values follow notes); 20-F FY2004 and FY2006 Item 3 selected data, US GAAP in EUR thousands (FY2000-2005); 20-F FY2009, FY2014, FY2016 Item 3 selected data, IFRS (FY2006-2016)
- Corrected:
  - none
- Removed / unverifiable:
  - none
- sourceUrl fixes: none

## Shell (`shell`)

- Anchors checked: 25 (revenue + operating income each)
- Sources: SEC XBRL companyconcept CIK0001306965 (ifrs-full Revenue, ProfitLossBeforeTax) FY2015-2025; Royal Dutch Petroleum 6-K Q4 2002/Q4 2003/Q4 2004 Group statements of income FY2001-2003; RDS 20-F FY2005 selected financial data FY2004-2005; RDS Q4 6-Ks FY2007-FY2014 consolidated statements of income FY2006-2014
- Corrected:
  - none (values all match). `notes` corrected: 2002 and 2003 stored values are the restated figures from the following year's Q4 release (2002 first reported 179,431 net proceeds; 2003 first reported 201,932 / 23,188), not "as first reported"
- Removed / unverifiable:
  - none
- sourceUrl fixes: none

## Tesco (`tesco`)

- Anchors checked: 27 (revenue + operating income each)
- Sources: Annual Report 2001 group P&L (FY2000-01; FY2000 turnover 18,796 = 18,666 continuing + 130 discontinued); Annual Report 2003 group P&L comparative (FY2002); Annual Report 2007 five year record (FY2003-07, UK GAAP/IFRS columns); Annual Report 2011 five year record + group income statement (FY2008-11); Preliminary Results group income statements 2009/10, 2012/13, 2014/15, 2016/17, 2018/19 (FY2018 restated comparative), 2020/21, 2022/23, 2023/24 (FY2023 restated), 2025/26 (FY2025 comparative, FY2026 53 weeks). All PDFs fetched from the cited sourceUrls and read via text extraction of the income-statement rows.
- Corrected:
  - none
- Removed / unverifiable:
  - none (note: AR2003 originally reported FY2003 turnover 26,337 / op profit 1,484; stored 26,004 / 1,492 match the AR2007 five-year record cited, consistent with notes)
- sourceUrl fixes: none

## Tesla (`tesla`)

- Anchors checked: 19 (revenue + operating income each)
- Sources: SEC XBRL companyconcept CIK0001318605 (Revenues, OperatingIncomeLoss) FY2009-2025 (FY2009-2011 from accn 0001193125-12-081990, per notes); Form S-1 2010-01-29 Summary Consolidated Financial Data FY2007-2008 (Automotive sales $73K / $14,742K, the only revenue line; Loss from operations (79,933) / (78,504); 2006 op loss (30,431) confirms omission note)
- Corrected:
  - none
- Removed / unverifiable:
  - none
- sourceUrl fixes: none
- Note: FY2007-2018 stored with three decimals (exact thousands), FY2019+ as whole millions (filings switched to millions). Not rounded per brief convention; left unchanged since rounding FY2007 revenue (0.073) to 0 would break the log axis. Flag for a global decision. XBRL also carries later-rounded FY2017/FY2018 revenue (11,759 / 21,461) from FY2019 10-K; stored first-reported values match within tolerance.

## TotalEnergies (`totalenergies`)

- Anchors checked: 25 (revenue + operating income each; operating income re-derived as consolidated net income + income taxes)
- Sources: SEC XBRL R2 consolidated statements of income from 20-F FY2017/FY2019/FY2022/FY2025 FY2015-2025; TotalFinaElf/Total results 6-Ks (2003-03-07, 2004-03-08 Ex.99.5, 2006-02-22, 2007-02-20, 2009-02-20, 2011-02-18, 2013-02-19, 2015-02-12) consolidated statements of income FY2001-2014
- Corrected:
  - none
- Removed / unverifiable:
  - none
- sourceUrl fixes: none

## Volkswagen Group (`volkswagen`)

- Anchors checked: 26 (revenue + operating income each)
- Sources: VW AR2004 Ten-Year Review FY2000; AR2005 Five-Year Review FY2001-2005; AR2010 Five-Year Review FY2006-2010; Sustainability Report 2011 key figures/five-year table FY2011; AR2016 Five-Year Review XLS FY2012-2015; AR2020 Five-Year Overview FY2016-2020; AR2025 Five-Year Review FY2021-2025 ('Sales revenue', 'Operating profit'/'Operating result')
- Corrected:
  - none (notes: AR2025 footnotes mark both 2022 and 2023 as adjusted; note updated to say so)
- Removed / unverifiable:
  - none
- sourceUrl fixes: none

## Walmart (`walmart`)

- Anchors checked: 26 (revenue + operating income each)
- Sources: SEC XBRL companyconcept CIK0000104169 (Revenues, OperatingIncomeLoss) FY2008-FY2026; 10-K FY2007 Exhibit 13 income statement FY2005-2007; 10-K FY2004 Exhibit 13 FY2002-2004 (Operating Profit); 10-K FY2003 Exhibit 13 FY2001 (Total Revenues 193,116, Operating Profit 11,311)
- Corrected:
  - none
- Removed / unverifiable:
  - none
- sourceUrl fixes: none
- Note: FY2009, FY2010, FY2012, FY2013 stored values are as-first-reported XBRL figures; later 10-Ks restated them (e.g. FY2010 revenue 408,085 / OI 24,002; FY2013 revenue 468,651 / OI 27,725). Matches original primary values, so verified; notes now state the as-first-reported policy.
