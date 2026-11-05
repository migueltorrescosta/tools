# Decision Tree: units

The sources behind the "Pick a unit" branch of `/decision-tree`, and the details the tree leaves out.

## How the branch works

The tree keeps every question to five answers or fewer, shows no tooltips, and reaches any unit within three answers of "What are you measuring?". With 63 ways to reach a unit, three is the fewest possible at five answers per question. Where the audience matters, the answers name only the US, the UK and Canada, which cover most readers. The other places that differ from the metric default are listed below; treat them like this:

| Place                               | Treat as  | Except                                                                                               |
| ----------------------------------- | --------- | ---------------------------------------------------------------------------------------------------- |
| Liberia                             | US        | Speed limits are in km/h; sources conflict on °F                                                     |
| Palau, Micronesia, Marshall Islands | US        | —                                                                                                    |
| Bahamas, Belize, Cayman Islands     | US        | Cayman fuel is in imperial gallons; Bahamas and Belize also use °C                                   |
| Myanmar                             | Elsewhere | Roads are signed in miles, fuel is sold by the gallon, and markets weigh food in viss (about 1.6 kg) |

The tree also leaves out US weather pressure (inches of mercury) and imperial gallons in the UK's miles-per-gallon. The data is in `src/lib/decision-tree/data/tree.json` (node ids start with `u_`).

## Imperial and metric

Only the United States, Liberia and Myanmar have not fully adopted the metric system ([CIA World Factbook, as cited on Skeptics Stack Exchange](https://kiwix.lema.org/skeptics.stackexchange.com_en_all_2023-11/questions/37325/only-the-us-liberia-and-myanmar-are-not-metric); [Metrication](https://en.wikipedia.org/wiki/Metrication)). The US government has a metric policy, but daily life uses US customary units. Liberia pledged to go metric in 2018 and has since moved speed limits to km/h ([Metric Views](https://metricviews.uk/2023/05/02/metric-progress-in-myanmar-and-liberia/)), but gallons and miles remain common. In Myanmar, markets weigh food in viss and ticals, roads are signed in miles and fuel is sold by the gallon, while speed limits are in km/h by law ([Myanmar units of measurement](https://en.wikipedia.org/wiki/Myanmar_units_of_measurement); [Metric Views](https://metricviews.uk/2018/02/08/metric-in-myanmar-an-update/)).

The UK requires metric units for trade. Imperial units alone are allowed only for draught beer and cider, milk in returnable containers, precious metals and road signs. In daily life people use miles, mph, mpg, pints, and stones for body weight. In 2023 the government dropped plans to widen imperial use after 99% of responses to its consultation backed metric ([consultation response](https://www.gov.uk/government/consultations/choice-on-units-of-measurement-markings-and-sales/outcome/choice-on-units-of-measurement-consultation-response); [consultation paper](https://assets.publishing.service.gov.uk/government/uploads/system/uploads/attachment_data/file/1081018/choice-on-units-of-measurement-markings-and-sales-consultation.pdf)).

Canada is officially metric. In a 2022 poll, 80% of Canadians gave height in feet and inches and 76% gave weight in pounds ([Research Co.](https://researchco.ca/2022/08/15/how-canadians-measure/); see also [Angus Reid, 2017](https://angusreid.org/metric/)). Temperature, road distances and fuel are metric.

Belize, the Bahamas and the Cayman Islands post speed limits in mph. Belize sells fuel in US gallons and the Cayman Islands in imperial gallons ([driving in Belize](https://www.centralamerica.com/living/daily-life/driving-in-belize-guide); [Cayman speed limit regulations](https://www.dvdl.gov.ky/documents/Traffic-Speed-Limits-in-Cayman-Brac-and-Little-Cayman-Regulations-2018-Revision-2021-02-25-07-57-18.PDF)). Palau, Micronesia and the Marshall Islands follow US practice.

## Celsius, kelvin and Fahrenheit

The kelvin is the SI unit of thermodynamic temperature. The degree Celsius has the same size, so a temperature difference can be given in either unit ([ISO 80000-5:2019](https://iteh.es/catalog/standards/iso/03fa87cc-2eeb-413f-82da-483fa2d530f1/iso-80000-5-2019); [NIST SP 811](https://www.nist.gov/pml/special-publication-811); [BIPM](https://www.bipm.org/en/publications/si-brochure/annex-1/thermodynamic-temperature)). Use kelvin when a formula needs zero at absolute zero: the ideal gas law $pV = nRT$, radiation ($T^4$), Carnot efficiency $1 - T_c/T_h$. Kelvin is also the convention for colour temperature, cryogenics and astronomy. Use Celsius for everyday temperatures outside the US and for lab readings and temperature changes.

Fahrenheit is the everyday scale in the US and its territories, Palau, Micronesia, the Marshall Islands, the Cayman Islands and Liberia; the Bahamas and Belize use it alongside Celsius ([Fahrenheit](https://en.wikipedia.org/wiki/Fahrenheit)). Sources conflict on Liberia.

## Units by field

These conventions hold worldwide, whatever a country's everyday system:

- **Aviation and shipping:** feet for altitude, knots for speed and nautical miles (1852 m) for distance ([ICAO Annex 5](https://applications.icao.int/postalhistory/annex_5_units_of_measurement_to_be_used_in_air_and_ground_operations.htm); [NAV Portugal AIP GEN 2.1](https://ais.nav.pt/wp-content/uploads/AIS_Files/eAIP_Current/eAIP_Online/eAIP/html/eAIP/LP-GEN-2.1-en-PT.html)). China and a few other countries give altitude in metres.
- **Accepted with the SI:** the SI Brochure accepts 15 non-SI units, including the litre, tonne, hectare, astronomical unit, dalton and electronvolt ([BIPM, 2026 update](https://www.bipm.org/en/-/2026-06-04-updated-si-brochure-clarifies-the-status-of-non-si-units); [Metric Views](https://metricviews.uk/2024/08/30/which-non-si-units-are-accepted-for-use-with-the-si/)).
- **Food energy:** EU labels must show kJ and kcal ([Regulation 1169/2011, Annex XV](https://legislation.gov.uk/eur/2011/1169/annex/XV/data.pdf)); US labels show Calories (kcal) ([Nutrition facts label](https://en.wikipedia.org/wiki/Nutrition_facts_label)); Australia and New Zealand put kJ first.
- **Trade:** crude oil in barrels (42 US gal), gold and silver in troy ounces (31.1 g), gems in carats (200 mg).
- **Everyday sizes:** screens, wheel rims and pipe threads in inches; blood pressure in mmHg; weather pressure in hPa (inHg in the US).
