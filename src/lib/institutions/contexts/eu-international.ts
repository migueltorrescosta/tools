import type { Context } from '../types';

export const euInternational: Context = {
	id: 'eu-international',
	title: 'EU and international',
	summary:
		"The EU's institutions, agencies and funding programmes, the Council of Europe, the UN system and the international courts.",
	asOf: '2026-11-13',
	institutions: [
		{
			id: 'european-union',
			name: 'European Union',
			acronym: 'EU',
			kind: 'supranational',
			level: 'european',
			founded: '1993',
			seat: 'Brussels',
			url: 'https://european-union.europa.eu',
			summary:
				'Union of 27 member states that pool sovereignty in shared institutions making binding law.',
			responsibilities: [
				'Single market, customs union, trade policy',
				'Common rules on competition, data, digital, environment',
				'Euro (21 states since Bulgaria joined Jan 2026)',
				'Common Foreign and Security Policy'
			],
			obligations: [
				'Acts only within competences conferred by the Treaties (TEU, TFEU)',
				'Bound by the Charter of Fundamental Rights',
				'Subsidiarity and proportionality principles'
			],
			accountableTo: [
				'Member-state citizens via European Parliament',
				'Member states via Council and European Council'
			],
			overlaps: [
				{
					with: 'council-of-europe',
					note: 'Different organisation: the Council of Europe (46 states) is not part of the EU; all EU states belong to both.'
				}
			],
			sources: [
				'https://european-union.europa.eu/principles-countries-history/eu-countries_en',
				'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:12016M/TXT',
				'https://www.ecb.europa.eu/euro/changeover/bulgaria/html/index.en.html'
			]
		},
		{
			id: 'european-council',
			name: 'European Council',
			acronym: 'EUCO',
			kind: 'supranational',
			level: 'european',
			founded: '1974 (EU institution since 2009)',
			seat: 'Brussels',
			url: 'https://www.consilium.europa.eu/en/european-council/',
			summary:
				"Summit of the 27 heads of state or government that sets the EU's political direction.",
			responsibilities: [
				'Sets general political priorities',
				'Nominates Commission President candidate',
				'Unanimous deals on MFF and treaty matters',
				'Elects its President (António Costa since Dec 2024)'
			],
			obligations: [
				'Does not legislate (Art. 15 TEU)',
				'Must take account of EP elections when nominating Commission President',
				'President reports to Parliament after each meeting'
			],
			accountableTo: [
				'National parliaments (through each leader)',
				'european-parliament (reporting only)'
			],
			overlaps: [
				{
					with: 'council-of-the-eu',
					note: 'Both sit in the Justus Lipsius/Europa building and share a secretariat, but the Council of the EU is ministers legislating; the European Council is leaders steering.'
				},
				{
					with: 'council-of-europe',
					note: 'Name clash only: the Council of Europe is a separate 46-state human rights organisation in Strasbourg.'
				}
			],
			sources: [
				'https://www.consilium.europa.eu/en/european-council/',
				'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:12016M/TXT',
				'https://www.consilium.europa.eu/en/council-eu/decoding-the-council/council-of-europe-vs-european-council-vs-council-of-the-eu/'
			]
		},
		{
			id: 'council-of-the-eu',
			name: 'Council of the European Union',
			acronym: 'Council',
			kind: 'legislature',
			level: 'european',
			founded: '1958',
			seat: 'Brussels (Luxembourg in April, June, October)',
			url: 'https://www.consilium.europa.eu/en/council-eu/',
			summary:
				'National ministers who co-legislate with Parliament and coordinate member-state policies.',
			responsibilities: [
				'Adopts EU laws with Parliament (ordinary legislative procedure)',
				'Adopts EU budget with Parliament',
				'Concludes international agreements',
				'Rotating presidency: Cyprus H1 2026, Ireland H2 2026'
			],
			obligations: [
				'Qualified majority voting by default; unanimity in tax, CFSP, MFF',
				'Legislative deliberations held in public',
				'Treaties (Art. 16 TEU)'
			],
			accountableTo: ['National parliaments (via each minister)', 'cjeu (legality of its acts)'],
			overlaps: [
				{
					with: 'european-council',
					note: "Leaders' summit vs ministers' legislature; same secretariat, different roles."
				},
				{
					with: 'council-of-europe',
					note: 'Name clash only; unrelated legal order.'
				}
			],
			sources: [
				'https://www.consilium.europa.eu/en/council-eu/',
				'https://www.consilium.europa.eu/en/council-eu/presidency-council-eu/'
			]
		},
		{
			id: 'european-commission',
			name: 'European Commission',
			acronym: 'EC',
			kind: 'executive',
			level: 'european',
			founded: '1958',
			seat: 'Brussels',
			url: 'https://commission.europa.eu',
			summary:
				'EU executive: proposes laws, manages the budget, enforces the Treaties and negotiates trade.',
			responsibilities: [
				'Sole right of legislative initiative (mostly)',
				'Implements the EU budget and programmes',
				'Guardian of the Treaties: infringement procedures',
				'Competition and state-aid enforcement',
				'Tabled 2028-2034 MFF proposal (July 2025)'
			],
			obligations: [
				'Independence from governments (Art. 17 TEU)',
				'Collegiate responsibility to Parliament',
				'Annual discharge on budget implementation'
			],
			accountableTo: [
				'european-parliament',
				'cjeu',
				'european-court-of-auditors',
				'european-ombudsman'
			],
			overlaps: [],
			sources: [
				'https://commission.europa.eu/about/organisation_en',
				'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:12016M/TXT',
				'https://commission.europa.eu/strategy-and-policy/eu-budget/long-term-eu-budget/eu-budget-2028-2034_en'
			]
		},
		{
			id: 'dg-rtd',
			name: 'Directorate-General for Research and Innovation',
			acronym: 'DG RTD',
			kind: 'executive',
			level: 'european',
			founded: '1958 (as research DG)',
			seat: 'Brussels',
			url: 'https://commission.europa.eu/about/departments-and-executive-agencies/research-and-innovation_en',
			summary:
				'Commission department that designs and manages EU research policy and Horizon Europe.',
			responsibilities: [
				'Designs Horizon Europe work programmes',
				'Drafted FP10 proposal (2028-2034)',
				'Supervises REA and ERCEA'
			],
			obligations: ['Financial Regulation', 'Horizon Europe Regulation (EU) 2021/695'],
			accountableTo: ['european-commission'],
			overlaps: [],
			sources: [
				'https://commission.europa.eu/about/departments-and-executive-agencies/research-and-innovation_en'
			]
		},
		{
			id: 'dg-cnect',
			name: 'Directorate-General for Communications Networks, Content and Technology',
			acronym: 'DG CNECT',
			kind: 'executive',
			level: 'european',
			founded: '2012',
			seat: 'Brussels',
			url: 'https://commission.europa.eu/about/departments-and-executive-agencies/communications-networks-content-and-technology_en',
			summary:
				'Commission department for digital policy: AI, platforms, connectivity, chips and cybersecurity.',
			responsibilities: [
				'Hosts the EU AI Office',
				'Enforces DSA/DMA with DG COMP',
				'Manages Digital Europe Programme',
				'Chips Act policy'
			],
			obligations: ['AI Act, DSA, DMA, Chips Act mandates', 'Financial Regulation'],
			accountableTo: ['european-commission'],
			overlaps: [],
			sources: [
				'https://commission.europa.eu/about/departments-and-executive-agencies/communications-networks-content-and-technology_en'
			]
		},
		{
			id: 'european-parliament',
			name: 'European Parliament',
			acronym: 'EP',
			kind: 'legislature',
			level: 'european',
			founded: '1952 (directly elected since 1979)',
			seat: 'Strasbourg (also Brussels, Luxembourg)',
			url: 'https://www.europarl.europa.eu',
			summary:
				'Directly elected EU legislature of 720 MEPs, co-deciding laws and the budget with the Council.',
			responsibilities: [
				'Co-legislates with the Council',
				'Elects Commission President; approves the College',
				'Budget authority and annual discharge',
				'Can censure the Commission',
				'Elects the European Ombudsman'
			],
			obligations: ['Five-yearly elections (next 2029)', 'Treaties (Art. 14 TEU)'],
			accountableTo: ['EU citizens'],
			overlaps: [
				{
					with: 'council-of-europe',
					note: "The Council of Europe's Parliamentary Assembly (PACE), also in Strasbourg, is made of national MPs, not MEPs."
				}
			],
			sources: [
				'https://www.europarl.europa.eu/about-parliament/en',
				'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:12016M/TXT'
			]
		},
		{
			id: 'cjeu',
			name: 'Court of Justice of the European Union',
			acronym: 'CJEU',
			kind: 'court',
			level: 'european',
			founded: '1952',
			seat: 'Luxembourg',
			url: 'https://curia.europa.eu',
			summary:
				"EU's judicial institution (Court of Justice and General Court) ensuring uniform interpretation of EU law.",
			responsibilities: [
				"Preliminary rulings on EU law at national courts' request",
				'Infringement cases against member states',
				'Annulment of EU acts',
				'Appeals from the General Court',
				'Opinions on international agreements (e.g. ECHR accession)'
			],
			obligations: [
				'Treaties and Statute of the Court',
				'Judges independent, 6-year renewable terms'
			],
			accountableTo: ['Treaties (no hierarchical superior)'],
			overlaps: [
				{
					with: 'ecthr',
					note: 'Both rule on fundamental rights; CJEU applies EU law and the Charter, ECtHR the ECHR. Charter rights mirror ECHR meaning (Art. 52(3)). EU accession to the ECHR is pending a CJEU opinion requested Nov 2025.'
				},
				{
					with: 'icj',
					note: 'ICJ settles disputes between states under international law; CJEU only applies EU law.'
				},
				{
					with: 'icc',
					note: 'ICC tries individuals for international crimes; CJEU has no criminal jurisdiction.'
				}
			],
			sources: [
				'https://curia.europa.eu/jcms/jcms/Jo2_6999/en/',
				'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:12016E/TXT',
				'https://www.coe.int/en/web/human-rights-intergovernmental-cooperation/accession-of-the-european-union-to-the-european-convention-on-human-rights'
			]
		},
		{
			id: 'general-court',
			name: 'General Court',
			acronym: 'GC',
			kind: 'court',
			level: 'european',
			founded: '1988',
			seat: 'Luxembourg',
			url: 'https://curia.europa.eu/jcms/jcms/Jo2_7033/en/',
			summary:
				'First-instance EU court for actions by individuals and companies against EU institutions.',
			responsibilities: [
				'Annulment actions by firms and individuals (competition, state aid, trade marks)',
				'Since Oct 2024: preliminary rulings in VAT, customs, excise, ETS, passenger rights'
			],
			obligations: [
				'Appeals on points of law go to the Court of Justice',
				'Two judges per member state'
			],
			accountableTo: ['cjeu'],
			overlaps: [],
			sources: [
				'https://curia.europa.eu/jcms/jcms/Jo2_7033/en/',
				'https://curia.europa.eu/site/upload/docs/application/pdf/2024-10/cp240154en.pdf'
			]
		},
		{
			id: 'european-court-of-auditors',
			name: 'European Court of Auditors',
			acronym: 'ECA',
			kind: 'agency',
			level: 'european',
			founded: '1977',
			seat: 'Luxembourg',
			url: 'https://www.eca.europa.eu',
			summary: 'External auditor of EU finances; not a court in the judicial sense.',
			responsibilities: [
				'Audits EU revenue and spending',
				'Annual statement of assurance',
				'Special reports on programme performance',
				'Reports suspected fraud to OLAF/EPPO'
			],
			obligations: [
				'Independence (Art. 285-287 TFEU)',
				'One member per member state, appointed by Council'
			],
			accountableTo: ['european-parliament', 'council-of-the-eu'],
			overlaps: [
				{
					with: 'olaf',
					note: 'ECA audits systems and legality; OLAF investigates individual fraud cases. ECA passes suspicions to OLAF.'
				}
			],
			sources: [
				'https://european-union.europa.eu/institutions-law-budget/institutions-and-bodies/search-all-eu-institutions-and-bodies/european-court-auditors-eca_en',
				'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:12016E/TXT'
			]
		},
		{
			id: 'ecb',
			name: 'European Central Bank',
			acronym: 'ECB',
			kind: 'supranational',
			level: 'european',
			founded: '1998',
			seat: 'Frankfurt',
			url: 'https://www.ecb.europa.eu',
			summary:
				'Central bank for the euro area, setting monetary policy and supervising large banks.',
			responsibilities: [
				'Price stability (2% medium-term target)',
				'Sets euro-area interest rates',
				'Single Supervisory Mechanism for significant banks',
				'Digital euro preparation'
			],
			obligations: [
				'Independence (Art. 130 TFEU)',
				'No monetary financing of governments',
				'Reports annually to Parliament'
			],
			accountableTo: ['european-parliament (accountability hearings)', 'cjeu'],
			overlaps: [
				{
					with: 'imf',
					note: 'Both monitor financial stability; IMF globally and via loans, ECB only for the euro area.'
				}
			],
			sources: [
				'https://www.ecb.europa.eu/ecb/orga/html/index.en.html',
				'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:12016E/TXT'
			]
		},
		{
			id: 'eib',
			name: 'European Investment Bank (EIB Group, incl. European Investment Fund)',
			acronym: 'EIB',
			kind: 'investor',
			level: 'european',
			founded: '1958',
			seat: 'Luxembourg',
			url: 'https://www.eib.org',
			summary:
				"EU's public bank, owned by the 27 member states, lending for EU policy goals; EIF is its venture/SME arm.",
			responsibilities: [
				'Loans and guarantees for infrastructure, climate, innovation',
				'Implements InvestEU guarantee',
				'EIF invests in VC funds and SME guarantees',
				'Defence and security financing expanded since 2024'
			],
			obligations: [
				'EIB Statute (Protocol 5 to Treaties)',
				'Non-profit, AAA-rated lending policies',
				'Audited by ECA for EU-mandated operations'
			],
			accountableTo: [
				'Board of Governors (national finance ministers)',
				'european-court-of-auditors'
			],
			overlaps: [
				{
					with: 'world-bank',
					note: "EIB is the world's largest multilateral lender by volume; overlaps with World Bank outside the EU."
				}
			],
			sources: ['https://www.eib.org/en/about/index', 'https://www.eif.org/who_we_are/index.htm']
		},
		{
			id: 'european-ombudsman',
			name: 'European Ombudsman',
			kind: 'agency',
			level: 'european',
			founded: '1995',
			seat: 'Strasbourg',
			url: 'https://www.ombudsman.europa.eu',
			summary: 'Investigates complaints of maladministration by EU institutions and bodies.',
			responsibilities: [
				'Handles citizen and company complaints',
				'Own-initiative inquiries (transparency, ethics)',
				'Ombudsman since 2025: Teresa Anjinho'
			],
			obligations: [
				'Elected by Parliament per term',
				'Cannot handle complaints about national authorities or CJEU judicial work'
			],
			accountableTo: ['european-parliament'],
			overlaps: [],
			sources: [
				'https://www.ombudsman.europa.eu/en/about-us',
				'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:12016E/TXT'
			]
		},
		{
			id: 'olaf',
			name: 'European Anti-Fraud Office',
			acronym: 'OLAF',
			kind: 'agency',
			level: 'european',
			founded: '1999',
			seat: 'Brussels',
			url: 'https://anti-fraud.ec.europa.eu',
			summary:
				'Administrative investigator of fraud against the EU budget and of misconduct by EU staff.',
			responsibilities: [
				'Administrative investigations of EU-funds fraud',
				'Recommends recovery and disciplinary action',
				'Refers criminal suspicions to EPPO or national prosecutors'
			],
			obligations: [
				'Regulation 883/2013 (amended 2020)',
				'Independent in investigations though part of the Commission',
				'Supervisory Committee oversight'
			],
			accountableTo: ['european-commission', 'Supervisory Committee', 'european-parliament'],
			overlaps: [
				{
					with: 'eppo',
					note: 'OLAF does administrative probes; EPPO prosecutes crimes. Since 2021 OLAF must report criminal suspicions to EPPO and not duplicate its investigations.'
				},
				{
					with: 'eurojust',
					note: 'Eurojust coordinates national prosecutors; OLAF has no prosecutorial role.'
				}
			],
			sources: ['https://anti-fraud.ec.europa.eu/about-us_en']
		},
		{
			id: 'eppo',
			name: "European Public Prosecutor's Office",
			acronym: 'EPPO',
			kind: 'agency',
			level: 'european',
			founded: '2017 (operational 2021)',
			seat: 'Luxembourg',
			url: 'https://www.eppo.europa.eu',
			summary:
				'Independent EU prosecutor investigating and prosecuting crimes against the EU budget in 24 member states.',
			responsibilities: [
				'Investigates and prosecutes EU-budget fraud, VAT fraud over €10m, corruption',
				'Brings cases before national courts',
				'European Chief Prosecutor Andrés Ritter since 1 Nov 2026'
			],
			obligations: [
				'Regulation (EU) 2017/1939 (enhanced cooperation)',
				'Hungary, Ireland, Denmark do not participate (Hungary began joining in 2026)',
				'Annual report to Parliament, Council, Commission'
			],
			accountableTo: [
				'european-parliament',
				'council-of-the-eu',
				'national-courts (judicial review)'
			],
			overlaps: [
				{
					with: 'olaf',
					note: 'Criminal vs administrative; OLAF supports EPPO investigations.'
				},
				{
					with: 'eurojust',
					note: 'Eurojust helps coordinate national prosecutors; EPPO prosecutes itself. Eurojust still handles cases involving non-EPPO states.'
				}
			],
			sources: [
				'https://www.eppo.europa.eu/about/background_en',
				'https://eucrim.eu/news/andres-ritter-succeeds-laura-kovesi-as-european-chief-prosecutor/'
			]
		},
		{
			id: 'eurojust',
			name: 'European Union Agency for Criminal Justice Cooperation',
			acronym: 'Eurojust',
			kind: 'agency',
			level: 'european',
			founded: '2002',
			seat: 'The Hague',
			url: 'https://www.eurojust.europa.eu',
			summary: 'Helps national prosecutors and judges coordinate cross-border criminal cases.',
			responsibilities: [
				'Coordination meetings and joint investigation teams',
				'Facilitates European Arrest Warrants',
				'Core International Crimes evidence database (Ukraine)'
			],
			obligations: ['Regulation (EU) 2018/1727', 'No own prosecution powers'],
			accountableTo: ['european-parliament', 'council-of-the-eu'],
			overlaps: [
				{
					with: 'eppo',
					note: 'Coordinates national prosecutions vs EPPO prosecuting directly.'
				},
				{
					with: 'europol',
					note: 'Europol supports police; Eurojust supports prosecutors and judges. Both in The Hague, often on the same case.'
				},
				{
					with: 'icc',
					note: 'Eurojust supports national war-crimes prosecutions; the ICC prosecutes when states cannot or will not.'
				}
			],
			sources: ['https://www.eurojust.europa.eu/about-us']
		},
		{
			id: 'europol',
			name: 'European Union Agency for Law Enforcement Cooperation',
			acronym: 'Europol',
			kind: 'agency',
			level: 'european',
			founded: '1999 (EU agency 2010)',
			seat: 'The Hague',
			url: 'https://www.europol.europa.eu',
			summary:
				'EU police-cooperation hub supporting national forces against serious crime and terrorism.',
			responsibilities: [
				'Criminal intelligence analysis',
				'Supports cross-border operations',
				'European Cybercrime Centre (EC3)'
			],
			obligations: [
				'Regulation (EU) 2016/794 (amended 2022)',
				'No arrest or executive powers',
				'Data protection supervision by EDPS'
			],
			accountableTo: ['european-parliament (Joint Parliamentary Scrutiny Group)', 'edps'],
			overlaps: [
				{
					with: 'eurojust',
					note: 'Police vs judicial side of the same cases.'
				},
				{
					with: 'frontex',
					note: 'Both share migrant-smuggling intelligence; Frontex works at borders, Europol on criminal networks.'
				}
			],
			sources: ['https://www.europol.europa.eu/about-europol']
		},
		{
			id: 'frontex',
			name: 'European Border and Coast Guard Agency',
			acronym: 'Frontex',
			kind: 'agency',
			level: 'european',
			founded: '2004',
			seat: 'Warsaw',
			url: 'https://www.frontex.europa.eu',
			summary: 'Supports member states in managing the Schengen external borders and returns.',
			responsibilities: [
				'Joint operations at external borders',
				'Standing corps (target 10,000 by 2027)',
				'Return operations',
				'Risk analysis and vulnerability assessments'
			],
			obligations: [
				'Regulation (EU) 2019/1896',
				'Fundamental Rights Officer and complaints mechanism',
				'Member states keep primary responsibility for their borders'
			],
			accountableTo: ['european-parliament', 'council-of-the-eu', 'european-ombudsman'],
			overlaps: [
				{
					with: 'national-border-police',
					note: 'National border guards remain primarily responsible; Frontex staff act under host-state command.'
				},
				{
					with: 'euaa',
					note: 'Frontex handles borders and returns, EUAA asylum procedures; both deploy at hotspots.'
				}
			],
			sources: ['https://www.frontex.europa.eu/about-frontex/who-we-are/tasks-mission/']
		},
		{
			id: 'national-border-police',
			name: 'National border guards (generic)',
			kind: 'agency',
			level: 'national',
			founded: 'varies',
			seat: 'member states',
			url: 'https://home-affairs.ec.europa.eu/policies/schengen/border-crossing_en',
			summary:
				'Member-state authorities that actually control borders under the Schengen Borders Code.',
			responsibilities: [
				'Border checks and surveillance',
				'Can reintroduce temporary internal checks'
			],
			obligations: ['Schengen Borders Code', 'National law and ECHR'],
			accountableTo: ['National governments', 'national-courts'],
			overlaps: [
				{
					with: 'frontex',
					note: 'Primary responsibility stays national; Frontex supports and is deployed under host command.'
				}
			],
			sources: ['https://home-affairs.ec.europa.eu/policies/schengen/border-crossing_en']
		},
		{
			id: 'euaa',
			name: 'European Union Agency for Asylum',
			acronym: 'EUAA',
			kind: 'agency',
			level: 'european',
			founded: '2022 (replaced EASO, est. 2010)',
			seat: 'Valletta',
			url: 'https://euaa.europa.eu',
			summary: 'Supports member states in applying EU asylum law consistently.',
			responsibilities: [
				'Operational support with asylum processing',
				'Country-of-origin guidance',
				'Monitors application of the Pact on Migration and Asylum (applies from June 2026)'
			],
			obligations: [
				'Regulation (EU) 2021/2303',
				'Does not grant asylum itself; decisions stay national'
			],
			accountableTo: ['european-parliament', 'council-of-the-eu'],
			overlaps: [
				{
					with: 'unhcr',
					note: 'UNHCR is the global refugee guardian of the 1951 Convention; EUAA applies EU asylum law and works with UNHCR.'
				},
				{
					with: 'iom',
					note: 'IOM covers all migrants; EUAA only asylum within the EU+.'
				}
			],
			sources: [
				'https://euaa.europa.eu/about-us',
				'https://home-affairs.ec.europa.eu/policies/migration-and-asylum/pact-migration-and-asylum_en'
			]
		},
		{
			id: 'ema',
			name: 'European Medicines Agency',
			acronym: 'EMA',
			kind: 'agency',
			level: 'european',
			founded: '1995',
			seat: 'Amsterdam',
			url: 'https://www.ema.europa.eu',
			summary:
				'Evaluates and supervises medicines for the EU; the Commission grants marketing authorisations.',
			responsibilities: [
				'Scientific assessment of medicines',
				'Pharmacovigilance',
				'Shortage monitoring'
			],
			obligations: ['Regulation (EC) 726/2004', 'Recommendations become Commission decisions'],
			accountableTo: ['european-commission', 'european-parliament'],
			overlaps: [
				{
					with: 'who',
					note: 'WHO sets global norms and prequalifies medicines; EMA authorises for the EU market.'
				}
			],
			sources: ['https://www.ema.europa.eu/en/about-us']
		},
		{
			id: 'enisa',
			name: 'European Union Agency for Cybersecurity',
			acronym: 'ENISA',
			kind: 'agency',
			level: 'european',
			founded: '2004',
			seat: 'Athens',
			url: 'https://www.enisa.europa.eu',
			summary:
				'EU cybersecurity agency supporting NIS2 implementation and cybersecurity certification.',
			responsibilities: [
				'EU cybersecurity certification schemes',
				'Supports NIS2 and Cyber Resilience Act',
				'Threat landscape reports'
			],
			obligations: ['Cybersecurity Act (EU) 2019/881 (revision proposed 2026)'],
			accountableTo: ['european-commission', 'european-parliament'],
			overlaps: [
				{
					with: 'itu',
					note: 'ITU deals with global telecom standards and cyber capacity; ENISA with EU cybersecurity policy.'
				}
			],
			sources: ['https://www.enisa.europa.eu/about-enisa/who-we-are']
		},
		{
			id: 'eu-ai-office',
			name: 'European AI Office',
			acronym: 'AI Office',
			kind: 'agency',
			level: 'european',
			founded: '2024',
			seat: 'Brussels',
			url: 'https://digital-strategy.ec.europa.eu/en/policies/ai-office',
			summary:
				'Commission body within DG CNECT that enforces AI Act rules on general-purpose AI models.',
			responsibilities: [
				'Supervises general-purpose AI (GPAI) models; GPAI rules apply since Aug 2025',
				'Drafted GPAI Code of Practice',
				'After the 2026 Digital Omnibus: wider exclusive supervision of some AI systems',
				'Supports national market-surveillance authorities'
			],
			obligations: [
				'AI Act (EU) 2024/1689 as amended by the 2026 Digital Omnibus on AI',
				'High-risk deadlines moved to Dec 2027 (Annex III) and Aug 2028 (Annex I)'
			],
			accountableTo: ['dg-cnect', 'european-commission'],
			overlaps: [
				{
					with: 'oecd',
					note: 'OECD AI Principles are non-binding guidance; the AI Act is binding EU law that drew on them.'
				},
				{
					with: 'edpb',
					note: 'AI systems processing personal data fall under both GDPR (DPAs/EDPB) and the AI Act.'
				}
			],
			sources: [
				'https://digital-strategy.ec.europa.eu/en/policies/ai-office',
				'https://www.gibsondunn.com/eu-ai-act-omnibus-agreement-postponed-high-risk-deadlines-and-other-key-changes/'
			]
		},
		{
			id: 'edpb',
			name: 'European Data Protection Board',
			acronym: 'EDPB',
			kind: 'agency',
			level: 'european',
			founded: '2018',
			seat: 'Brussels',
			url: 'https://www.edpb.europa.eu',
			summary:
				'Board of national data protection authorities ensuring consistent GDPR application.',
			responsibilities: [
				'Binding decisions in cross-border GDPR disputes',
				'Guidelines and opinions',
				'Consistency mechanism'
			],
			obligations: ['GDPR (EU) 2016/679, Art. 68-76'],
			accountableTo: ['cjeu'],
			overlaps: [
				{
					with: 'national-dpas',
					note: 'National DPAs enforce GDPR (one-stop-shop lead authority); EDPB resolves disagreements between them with binding decisions.'
				},
				{
					with: 'edps',
					note: 'EDPS supervises EU institutions and provides the EDPB secretariat; EDPB covers member-state enforcement.'
				}
			],
			sources: [
				'https://www.edpb.europa.eu/about-edpb/who-we-are/european-data-protection-board_en'
			]
		},
		{
			id: 'edps',
			name: 'European Data Protection Supervisor',
			acronym: 'EDPS',
			kind: 'agency',
			level: 'european',
			founded: '2004',
			seat: 'Brussels',
			url: 'https://www.edps.europa.eu',
			summary:
				'Independent supervisor of personal-data processing by EU institutions, bodies and agencies.',
			responsibilities: [
				"Supervises EU institutions' data processing (incl. Europol)",
				'Advises on new EU laws',
				'Provides EDPB secretariat'
			],
			obligations: ['Regulation (EU) 2018/1725', 'Appointed by Parliament and Council'],
			accountableTo: ['european-parliament', 'council-of-the-eu', 'cjeu'],
			overlaps: [
				{
					with: 'edpb',
					note: 'Different scope: EU bodies vs national controllers.'
				}
			],
			sources: ['https://www.edps.europa.eu/about-edps_en']
		},
		{
			id: 'national-dpas',
			name: 'National data protection authorities (generic)',
			acronym: 'DPAs',
			kind: 'agency',
			level: 'national',
			founded: 'varies',
			seat: 'member states',
			url: 'https://www.edpb.europa.eu/about-edpb/about-edpb/members_en',
			summary:
				"Independent national regulators enforcing the GDPR, e.g. Ireland's DPC for many tech firms.",
			responsibilities: [
				'Investigate and fine GDPR breaches',
				"Lead authority for firms' EU main establishment"
			],
			obligations: ['GDPR independence requirements', 'Decisions reviewable by national courts'],
			accountableTo: ['national-courts', 'edpb (consistency)'],
			overlaps: [
				{
					with: 'edpb',
					note: 'Enforcement is national; EDPB arbitrates cross-border disputes.'
				}
			],
			sources: ['https://www.edpb.europa.eu/about-edpb/about-edpb/members_en']
		},
		{
			id: 'national-courts',
			name: 'National courts of EU member states (generic)',
			kind: 'court',
			level: 'national',
			founded: 'varies',
			seat: 'member states',
			url: 'https://e-justice.europa.eu/topics/taking-legal-action/legal-systems-eu-and-national/national-justice-systems_en',
			summary:
				'Ordinary courts that apply EU law daily and are the entry point to both CJEU and ECtHR routes.',
			responsibilities: [
				'Apply EU law with primacy over national law',
				'Refer EU-law questions to the CJEU',
				'Final domestic decisions can be taken to the ECtHR'
			],
			obligations: [
				'Last-instance courts must refer unclear EU-law questions (Art. 267 TFEU)',
				'ECHR obligations'
			],
			accountableTo: ['National constitutions'],
			overlaps: [],
			sources: [
				'https://e-justice.europa.eu/topics/taking-legal-action/legal-systems-eu-and-national/national-justice-systems_en',
				'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:12016E/TXT'
			]
		},
		{
			id: 'horizon-europe',
			name: 'Horizon Europe',
			acronym: 'HE',
			kind: 'programme',
			level: 'european',
			founded: '2021',
			seat: 'Brussels',
			url: 'https://research-and-innovation.ec.europa.eu/funding/funding-opportunities/funding-programmes-and-open-calls/horizon-europe_en',
			summary: 'EU research and innovation framework programme 2021-2027 (about €93.5bn).',
			responsibilities: [
				'Funds collaborative research (Pillar II clusters)',
				'Hosts ERC, MSCA, EIC',
				'Successor FP10 proposed at €175bn for 2028-2034, linked to European Competitiveness Fund; under negotiation'
			],
			obligations: [
				'Regulation (EU) 2021/695',
				'Associated countries (e.g. UK, Switzerland from 2025) pay in'
			],
			accountableTo: ['european-commission', 'european-parliament', 'council-of-the-eu'],
			overlaps: [
				{
					with: 'digital-europe-programme',
					note: 'Horizon funds research; Digital Europe funds deployment of digital capacity. Both fund AI.'
				}
			],
			sources: [
				'https://research-and-innovation.ec.europa.eu/funding/funding-opportunities/funding-programmes-and-open-calls/horizon-europe_en',
				'https://sciencebusiness.net/planning-fp10/fp10-meets-competitiveness-fund-we-can-have-both-says-commissioner',
				'https://commission.europa.eu/strategy-and-policy/eu-budget/long-term-eu-budget/eu-budget-2028-2034_en'
			]
		},
		{
			id: 'erc',
			name: 'European Research Council',
			acronym: 'ERC',
			kind: 'programme',
			level: 'european',
			founded: '2007',
			seat: 'Brussels',
			url: 'https://erc.europa.eu',
			summary:
				'Funds investigator-driven frontier research on excellence alone, via Horizon Europe Pillar I.',
			responsibilities: [
				'Starting, Consolidator, Advanced, Synergy, Proof of Concept grants',
				'Scientific Council sets strategy'
			],
			obligations: ['Scientific Council independence', 'Implemented by ERCEA'],
			accountableTo: ['european-commission'],
			overlaps: [],
			sources: ['https://erc.europa.eu/about-erc/mission']
		},
		{
			id: 'eic',
			name: 'European Innovation Council',
			acronym: 'EIC',
			kind: 'programme',
			level: 'european',
			founded: '2021',
			seat: 'Brussels',
			url: 'https://eic.ec.europa.eu',
			summary:
				'Horizon Europe Pillar III instrument funding breakthrough tech and scale-ups with grants and equity.',
			responsibilities: [
				'EIC Pathfinder, Transition, Accelerator',
				'EIC Fund takes equity stakes',
				'Scale-up initiatives (STEP Scale Up)'
			],
			obligations: ['Horizon Europe Regulation', 'Implemented by EISMEA'],
			accountableTo: ['european-commission'],
			overlaps: [
				{
					with: 'eib',
					note: 'Both provide EU-backed equity for innovators; EIF invests via VC funds, EIC Fund directly.'
				}
			],
			sources: ['https://eic.ec.europa.eu/eic-funding-opportunities_en']
		},
		{
			id: 'digital-europe-programme',
			name: 'Digital Europe Programme',
			acronym: 'DIGITAL',
			kind: 'programme',
			level: 'european',
			founded: '2021',
			seat: 'Brussels',
			url: 'https://digital-strategy.ec.europa.eu/en/activities/digital-programme',
			summary:
				'Funds deployment of supercomputing, AI, cybersecurity and digital skills (about €8.1bn, 2021-2027).',
			responsibilities: [
				'AI testing facilities and data spaces',
				'European Digital Innovation Hubs',
				'Cybersecurity capacity'
			],
			obligations: [
				'Regulation (EU) 2021/694',
				'Proposed to fold into European Competitiveness Fund from 2028'
			],
			accountableTo: ['european-commission'],
			overlaps: [
				{
					with: 'horizon-europe',
					note: 'Deployment vs research.'
				}
			],
			sources: [
				'https://digital-strategy.ec.europa.eu/en/activities/digital-programme',
				'https://commission.europa.eu/strategy-and-policy/eu-budget/long-term-eu-budget/eu-budget-2028-2034_en'
			]
		},
		{
			id: 'cohesion-funds',
			name: 'Cohesion policy funds (ERDF, Cohesion Fund, ESF+)',
			kind: 'programme',
			level: 'european',
			founded: '1975 (ERDF)',
			seat: 'Brussels',
			url: 'https://ec.europa.eu/regional_policy/funding_en',
			summary:
				'Largest EU investment policy (about €392bn 2021-2027) reducing regional disparities, under shared management.',
			responsibilities: [
				'Regional development, infrastructure, skills',
				'Managed by national/regional authorities',
				'2028-2034 proposal merges them into National and Regional Partnership Plans'
			],
			obligations: ['Common Provisions Regulation (EU) 2021/1060', 'Rule-of-law conditionality'],
			accountableTo: ['european-commission', 'european-court-of-auditors'],
			overlaps: [
				{
					with: 'recovery-and-resilience-facility',
					note: 'Both fund national investment plans; RRF is performance-based and temporary, cohesion is long-term and regional.'
				}
			],
			sources: [
				'https://ec.europa.eu/regional_policy/funding_en',
				'https://commission.europa.eu/strategy-and-policy/eu-budget/long-term-eu-budget/eu-budget-2028-2034_en'
			]
		},
		{
			id: 'recovery-and-resilience-facility',
			name: 'NextGenerationEU / Recovery and Resilience Facility',
			acronym: 'RRF',
			kind: 'programme',
			level: 'european',
			founded: '2021',
			seat: 'Brussels',
			url: 'https://commission.europa.eu/business-economy-euro/economic-recovery/recovery-and-resilience-facility_en',
			summary:
				'Temporary post-COVID instrument financed by joint EU borrowing, paying out against national plan milestones.',
			responsibilities: [
				"Grants and loans for national recovery plans (e.g. Portugal's PRR)",
				'Milestones due by 31 Aug 2026; last payments by 31 Dec 2026',
				'Repayment of EU borrowing through 2058'
			],
			obligations: [
				'Regulation (EU) 2021/241',
				'Payment only on verified milestones',
				'Audited by ECA'
			],
			accountableTo: ['european-commission', 'european-parliament', 'european-court-of-auditors'],
			overlaps: [
				{
					with: 'cohesion-funds',
					note: 'Overlapping national investment plans; ends 2026.'
				}
			],
			sources: [
				'https://commission.europa.eu/business-economy-euro/economic-recovery/recovery-and-resilience-facility_en'
			]
		},
		{
			id: 'chips-ju',
			name: 'Chips Joint Undertaking',
			acronym: 'Chips JU',
			kind: 'programme',
			level: 'european',
			founded: '2023 (succeeded KDT JU)',
			seat: 'Brussels',
			url: 'https://www.chips-ju.europa.eu',
			summary:
				'Public-private partnership implementing the Chips for Europe Initiative under the European Chips Act.',
			responsibilities: [
				'Pilot lines and design platform',
				'Competence centres',
				'Co-funded with member states and industry'
			],
			obligations: [
				'European Chips Act (EU) 2023/1781',
				'Council Regulation on Joint Undertakings'
			],
			accountableTo: ['european-commission', 'european-court-of-auditors'],
			overlaps: [],
			sources: [
				'https://www.chips-ju.europa.eu/about-us/',
				'https://commission.europa.eu/strategy-and-policy/priorities-2019-2024/europe-fit-digital-age/european-chips-act_en'
			]
		},
		{
			id: 'rea',
			name: 'European Research Executive Agency',
			acronym: 'REA',
			kind: 'agency',
			level: 'european',
			founded: '2007',
			seat: 'Brussels',
			url: 'https://rea.ec.europa.eu',
			summary:
				'Commission executive agency managing much of Horizon Europe (MSCA, clusters, widening).',
			responsibilities: [
				'Runs calls and grant agreements',
				'Central validation and expert services for Horizon'
			],
			obligations: [
				'Council Regulation (EC) 58/2003 on executive agencies',
				'Mandate set by Commission delegation act; no policy role'
			],
			accountableTo: ['european-commission'],
			overlaps: [],
			sources: ['https://rea.ec.europa.eu']
		},
		{
			id: 'ercea',
			name: 'European Research Council Executive Agency',
			acronym: 'ERCEA',
			kind: 'agency',
			level: 'european',
			founded: '2007',
			seat: 'Brussels',
			url: 'https://erc.europa.eu/about-erc/erc-executive-agency',
			summary:
				"Commission executive agency implementing ERC grants under the Scientific Council's strategy.",
			responsibilities: ['Peer review and grant management for ERC'],
			obligations: [
				'Council Regulation (EC) 58/2003 on executive agencies',
				'Mandate set by Commission delegation act; no policy role'
			],
			accountableTo: ['european-commission'],
			overlaps: [],
			sources: ['https://erc.europa.eu/about-erc/erc-executive-agency']
		},
		{
			id: 'eismea',
			name: 'European Innovation Council and SMEs Executive Agency',
			acronym: 'EISMEA',
			kind: 'agency',
			level: 'european',
			founded: '2021',
			seat: 'Brussels',
			url: 'https://eismea.ec.europa.eu',
			summary:
				'Commission executive agency running the EIC, Single Market Programme SME strands and interregional innovation.',
			responsibilities: ['Manages EIC grants', 'Enterprise Europe Network'],
			obligations: [
				'Council Regulation (EC) 58/2003 on executive agencies',
				'Mandate set by Commission delegation act; no policy role'
			],
			accountableTo: ['european-commission'],
			overlaps: [],
			sources: ['https://eismea.ec.europa.eu']
		},
		{
			id: 'hadea',
			name: 'European Health and Digital Executive Agency',
			acronym: 'HaDEA',
			kind: 'agency',
			level: 'european',
			founded: '2021',
			seat: 'Brussels',
			url: 'https://hadea.ec.europa.eu',
			summary:
				'Commission executive agency managing EU4Health, Digital Europe, CEF Digital and Horizon digital/health clusters.',
			responsibilities: ['Grant management for health and digital programmes'],
			obligations: [
				'Council Regulation (EC) 58/2003 on executive agencies',
				'Mandate set by Commission delegation act; no policy role'
			],
			accountableTo: ['european-commission'],
			overlaps: [],
			sources: ['https://hadea.ec.europa.eu']
		},
		{
			id: 'schengen-area',
			name: 'Schengen Area',
			kind: 'programme',
			level: 'european',
			founded: '1985 (agreement), 1995 (in force)',
			seat: 'n/a',
			url: 'https://home-affairs.ec.europa.eu/policies/schengen/schengen-area_en',
			summary:
				'Area without internal border controls: 29 countries (25 EU states plus Iceland, Norway, Switzerland, Liechtenstein).',
			responsibilities: [
				'Free movement without internal checks',
				'Common external border and visa rules',
				'Entry/Exit System live since Oct 2025; ETIAS planned'
			],
			obligations: [
				'Schengen Borders Code',
				'Temporary internal checks allowed for serious threats'
			],
			accountableTo: ['council-of-the-eu', 'european-commission (evaluation)'],
			overlaps: [
				{
					with: 'european-union',
					note: 'Not identical to the EU: Ireland and Cyprus are outside; four non-EU states are in.'
				}
			],
			sources: ['https://home-affairs.ec.europa.eu/policies/schengen/schengen-area_en']
		},
		{
			id: 'council-of-europe',
			name: 'Council of Europe',
			acronym: 'CoE',
			kind: 'intergovernmental',
			level: 'european',
			founded: '1949',
			seat: 'Strasbourg',
			url: 'https://www.coe.int',
			summary:
				'46-state human-rights organisation, separate from the EU, behind the ECHR and the ECtHR.',
			responsibilities: [
				'European Convention on Human Rights',
				'Committee of Ministers supervises ECtHR judgments',
				'Venice Commission, GRECO, Framework Convention on AI (2024)'
			],
			obligations: ['Statute of the Council of Europe', 'Russia expelled March 2022'],
			accountableTo: ['Member states (Committee of Ministers)', 'Parliamentary Assembly (PACE)'],
			overlaps: [
				{
					with: 'european-council',
					note: 'Name clash: the European Council is EU leaders; the Council of Europe is a separate treaty organisation.'
				},
				{
					with: 'council-of-the-eu',
					note: 'Name clash; unrelated legal order.'
				},
				{
					with: 'european-union',
					note: 'All EU states are CoE members, but the EU itself is not yet a party to the ECHR.'
				}
			],
			sources: [
				'https://www.coe.int/en/web/about-us/who-we-are',
				'https://www.coe.int/en/web/artificial-intelligence/the-framework-convention-on-artificial-intelligence'
			]
		},
		{
			id: 'ecthr',
			name: 'European Court of Human Rights',
			acronym: 'ECtHR',
			kind: 'court',
			level: 'european',
			founded: '1959',
			seat: 'Strasbourg',
			url: 'https://www.echr.coe.int',
			summary:
				'Council of Europe court ruling on violations of the ECHR by its 46 states; not an EU court.',
			responsibilities: [
				'Individual applications against states',
				'Inter-state cases',
				'Binding judgments, just satisfaction'
			],
			obligations: [
				'ECHR and Protocols',
				'Admissible only after exhausting domestic remedies, within 4 months',
				'Execution supervised by Committee of Ministers'
			],
			accountableTo: ['council-of-europe'],
			overlaps: [
				{
					with: 'cjeu',
					note: 'Both rights courts; ECtHR checks states against the ECHR, CJEU checks EU law. Different seats (Strasbourg vs Luxembourg).'
				},
				{
					with: 'icj',
					note: 'ICJ hears state-vs-state disputes globally; ECtHR mainly individual complaints in Europe.'
				},
				{
					with: 'icc',
					note: 'ICC convicts individuals; ECtHR finds states in violation.'
				}
			],
			sources: [
				'https://www.echr.coe.int/court-in-brief',
				'https://www.echr.coe.int/admissibility-guide'
			]
		},
		{
			id: 'united-nations',
			name: 'United Nations',
			acronym: 'UN',
			kind: 'intergovernmental',
			level: 'global',
			founded: '1945',
			seat: 'New York',
			url: 'https://www.un.org',
			summary:
				'Global organisation of 193 states for peace, security, human rights and development.',
			responsibilities: [
				'Six principal organs incl. GA, Security Council, Secretariat, ICJ',
				'Coordinates funds, programmes, specialised agencies',
				'Secretary-General selection for 2027-2031 under way in 2026'
			],
			obligations: ['UN Charter', 'Assessed contributions from members'],
			accountableTo: ['Member states (General Assembly)'],
			overlaps: [],
			sources: [
				'https://www.un.org/en/about-us/un-charter/full-text',
				'https://www.un.org/en/about-us/un-system'
			]
		},
		{
			id: 'un-general-assembly',
			name: 'UN General Assembly',
			acronym: 'UNGA',
			kind: 'legislature',
			level: 'global',
			founded: '1945',
			seat: 'New York',
			url: 'https://www.un.org/en/ga/',
			summary: 'Plenary of all 193 UN members; one state, one vote.',
			responsibilities: [
				'Adopts UN budget and scale of assessments',
				'Elects non-permanent Security Council members and HRC members',
				'Appoints Secretary-General on Council recommendation',
				'Non-binding resolutions on any issue'
			],
			obligations: ['UN Charter Ch. IV', 'Two-thirds majority on important questions'],
			accountableTo: ['Member states'],
			overlaps: [],
			sources: [
				'https://www.un.org/en/ga/about/background.shtml',
				'https://www.un.org/en/about-us/un-charter/full-text'
			]
		},
		{
			id: 'un-security-council',
			name: 'UN Security Council',
			acronym: 'UNSC',
			kind: 'intergovernmental',
			level: 'global',
			founded: '1945',
			seat: 'New York',
			url: 'https://main.un.org/securitycouncil/',
			summary:
				'15-member organ with primary responsibility for international peace; decisions bind all members.',
			responsibilities: [
				'Binding sanctions and use-of-force authorisations (Ch. VII)',
				'Peacekeeping mandates',
				'Recommends Secretary-General',
				'Can refer situations to the ICC'
			],
			obligations: ['UN Charter Ch. V-VII', 'Veto of the five permanent members'],
			accountableTo: ['un-general-assembly (annual report)'],
			overlaps: [],
			sources: [
				'https://main.un.org/securitycouncil/en/content/what-security-council',
				'https://www.un.org/en/about-us/un-charter/full-text'
			]
		},
		{
			id: 'un-secretariat',
			name: 'UN Secretariat',
			kind: 'executive',
			level: 'global',
			founded: '1945',
			seat: 'New York',
			url: 'https://www.un.org/en/about-us/secretariat',
			summary:
				'UN civil service led by the Secretary-General (António Guterres, term ends 31 Dec 2026).',
			responsibilities: [
				'Runs UN operations and peacekeeping departments',
				'SG good offices and mediation',
				'UN80 reform and cost cuts amid funding shortfalls'
			],
			obligations: ['UN Charter Ch. XV', 'International civil service independence'],
			accountableTo: ['un-general-assembly', 'un-security-council'],
			overlaps: [],
			sources: [
				'https://www.un.org/en/about-us/secretariat',
				'https://unric.org/en/next-un-secretary-general-2026-candidates-process/'
			]
		},
		{
			id: 'icj',
			name: 'International Court of Justice',
			acronym: 'ICJ',
			kind: 'court',
			level: 'global',
			founded: '1945 (sat 1946)',
			seat: 'The Hague',
			url: 'https://www.icj-cij.org',
			summary:
				'Principal judicial organ of the UN, settling disputes between states and giving advisory opinions.',
			responsibilities: [
				'Contentious cases between states only',
				'Advisory opinions (e.g. climate obligations, July 2025)',
				'15 judges elected by GA and Security Council'
			],
			obligations: [
				'ICJ Statute (part of UN Charter)',
				'Jurisdiction depends on state consent',
				'Enforcement via Security Council'
			],
			accountableTo: ['united-nations'],
			overlaps: [
				{
					with: 'icc',
					note: 'Both in The Hague: ICJ judges states, ICC tries individuals for crimes; ICC is not a UN organ.'
				},
				{
					with: 'pca',
					note: 'Both in the Peace Palace; PCA administers arbitration, ICJ is a standing court.'
				},
				{
					with: 'ecthr',
					note: 'Global state disputes vs regional individual human-rights complaints.'
				},
				{
					with: 'cjeu',
					note: 'International law vs EU law.'
				}
			],
			sources: ['https://www.icj-cij.org/court', 'https://www.icj-cij.org/case/187']
		},
		{
			id: 'un-human-rights-council',
			name: 'UN Human Rights Council',
			acronym: 'HRC',
			kind: 'intergovernmental',
			level: 'global',
			founded: '2006',
			seat: 'Geneva',
			url: 'https://www.ohchr.org/en/hr-bodies/hrc/home',
			summary:
				'47-state UN body reviewing human-rights situations, including the Universal Periodic Review.',
			responsibilities: [
				'Universal Periodic Review of all UN members',
				'Special rapporteurs and commissions of inquiry'
			],
			obligations: ['GA resolution 60/251', 'Members elected by GA for 3 years'],
			accountableTo: ['un-general-assembly'],
			overlaps: [
				{
					with: 'ecthr',
					note: 'HRC is political and non-binding; ECtHR issues binding judgments.'
				},
				{
					with: 'ohchr',
					note: "HRC is the states' body; OHCHR the secretariat and independent office."
				}
			],
			sources: ['https://www.ohchr.org/en/hr-bodies/hrc/about-council']
		},
		{
			id: 'ohchr',
			name: 'Office of the UN High Commissioner for Human Rights',
			acronym: 'OHCHR',
			kind: 'agency',
			level: 'global',
			founded: '1993',
			seat: 'Geneva',
			url: 'https://www.ohchr.org',
			summary:
				'UN Secretariat office leading on human rights, headed by High Commissioner Volker Türk.',
			responsibilities: [
				'Monitoring and reporting',
				'Supports HRC and treaty bodies',
				'Field presences'
			],
			obligations: ['GA resolution 48/141'],
			accountableTo: ['un-secretariat', 'un-general-assembly'],
			overlaps: [],
			sources: ['https://www.ohchr.org/en/about-us']
		},
		{
			id: 'unhcr',
			name: 'UN Refugee Agency',
			acronym: 'UNHCR',
			kind: 'agency',
			level: 'global',
			founded: '1950',
			seat: 'Geneva',
			url: 'https://www.unhcr.org',
			summary:
				'Guardian of the 1951 Refugee Convention, protecting refugees, asylum-seekers and stateless people.',
			responsibilities: [
				'Protection and assistance to refugees',
				"Refugee status determination where states don't",
				'Resettlement, cuts after 2025 donor reductions'
			],
			obligations: ['Statute (GA res. 428(V))', 'Voluntarily funded'],
			accountableTo: ['un-general-assembly', 'Executive Committee'],
			overlaps: [
				{
					with: 'iom',
					note: 'UNHCR for refugees under the Convention; IOM for all migrants, including labour migration and returns. Overlap in mixed flows.'
				},
				{
					with: 'euaa',
					note: 'Global mandate vs EU-asylum support.'
				}
			],
			sources: ['https://www.unhcr.org/about-unhcr']
		},
		{
			id: 'iom',
			name: 'International Organization for Migration',
			acronym: 'IOM',
			kind: 'intergovernmental',
			level: 'global',
			founded: '1951',
			seat: 'Geneva',
			url: 'https://www.iom.int',
			summary:
				'UN-related migration agency for all migrants (labour, displacement, voluntary returns).',
			responsibilities: [
				'Assisted voluntary return',
				'Displacement tracking',
				'Migration governance advice'
			],
			obligations: [
				'IOM Constitution',
				'Related organisation of the UN since 2016 (not a specialised agency)'
			],
			accountableTo: ['Member states (IOM Council)'],
			overlaps: [
				{
					with: 'unhcr',
					note: 'Overlapping operations in mixed migration; coordination through joint platforms.'
				},
				{
					with: 'euaa',
					note: 'IOM global, EUAA EU asylum only.'
				}
			],
			sources: ['https://www.iom.int/about-iom']
		},
		{
			id: 'who',
			name: 'World Health Organization',
			acronym: 'WHO',
			kind: 'intergovernmental',
			level: 'global',
			founded: '1948',
			seat: 'Geneva',
			url: 'https://www.who.int',
			summary: 'UN specialised agency for global health; US exit took effect 22 Jan 2026.',
			responsibilities: [
				'International Health Regulations (amended 2024)',
				'Pandemic Agreement adopted May 2025',
				'Norms and prequalification'
			],
			obligations: ['WHO Constitution', 'Funding hit by US withdrawal'],
			accountableTo: ['World Health Assembly (member states)'],
			overlaps: [
				{
					with: 'ema',
					note: 'Global norms vs EU authorisation.'
				}
			],
			sources: [
				'https://www.who.int/about',
				'https://www.who.int/news/item/20-05-2025-world-health-assembly-adopts-historic-pandemic-agreement-to-make-the-world-more-equitable-and-safer-from-future-pandemics'
			]
		},
		{
			id: 'unesco',
			name: 'UN Educational, Scientific and Cultural Organization',
			acronym: 'UNESCO',
			kind: 'intergovernmental',
			level: 'global',
			founded: '1945',
			seat: 'Paris',
			url: 'https://www.unesco.org',
			summary:
				'UN specialised agency for education, science, culture; issued global Recommendation on AI Ethics (2021).',
			responsibilities: [
				'World Heritage',
				'Recommendation on the Ethics of AI',
				'Education and science cooperation'
			],
			obligations: [
				'UNESCO Constitution',
				'US withdrawal announced July 2025, effective 31 Dec 2026'
			],
			accountableTo: ['General Conference (member states)'],
			overlaps: [
				{
					with: 'oecd',
					note: 'Both issued non-binding AI ethics frameworks (UNESCO 2021, OECD 2019/2024).'
				}
			],
			sources: [
				'https://www.unesco.org/en/brief',
				'https://www.state.gov/releases/office-of-the-spokesperson/2025/07/the-united-states-withdraws-from-the-united-nations-educational-scientific-and-cultural-organization-unesco'
			]
		},
		{
			id: 'itu',
			name: 'International Telecommunication Union',
			acronym: 'ITU',
			kind: 'standards-body',
			level: 'global',
			founded: '1865',
			seat: 'Geneva',
			url: 'https://www.itu.int',
			summary:
				'UN specialised agency for telecoms: spectrum, satellite orbits, technical standards.',
			responsibilities: [
				'Radio spectrum and orbit allocation',
				'ITU-T standards',
				'AI for Good summit'
			],
			obligations: ['ITU Constitution and Radio Regulations'],
			accountableTo: ['Plenipotentiary Conference (member states)'],
			overlaps: [],
			sources: ['https://www.itu.int/en/about/Pages/default.aspx']
		},
		{
			id: 'wipo',
			name: 'World Intellectual Property Organization',
			acronym: 'WIPO',
			kind: 'intergovernmental',
			level: 'global',
			founded: '1967',
			seat: 'Geneva',
			url: 'https://www.wipo.int',
			summary: 'UN specialised agency running international patent, trademark and design systems.',
			responsibilities: [
				'PCT patent filings, Madrid trademarks, Hague designs',
				'IP treaties incl. 2024 genetic resources treaty'
			],
			obligations: ['WIPO Convention'],
			accountableTo: ['General Assembly of WIPO (member states)'],
			overlaps: [
				{
					with: 'wto',
					note: "WTO's TRIPS Agreement sets enforceable IP minimums; WIPO administers registration systems."
				}
			],
			sources: ['https://www.wipo.int/about-wipo/en/']
		},
		{
			id: 'ilo',
			name: 'International Labour Organization',
			acronym: 'ILO',
			kind: 'intergovernmental',
			level: 'global',
			founded: '1919',
			seat: 'Geneva',
			url: 'https://www.ilo.org',
			summary:
				'Tripartite UN agency (governments, employers, workers) setting international labour standards.',
			responsibilities: ['Labour conventions and supervision', 'Decent work programmes'],
			obligations: ['ILO Constitution', 'Tripartite governance'],
			accountableTo: ['International Labour Conference'],
			overlaps: [],
			sources: ['https://www.ilo.org/about-ilo']
		},
		{
			id: 'imf',
			name: 'International Monetary Fund',
			acronym: 'IMF',
			kind: 'intergovernmental',
			level: 'global',
			founded: '1944',
			seat: 'Washington, D.C.',
			url: 'https://www.imf.org',
			summary:
				'Bretton Woods institution for monetary cooperation, surveillance and balance-of-payments lending.',
			responsibilities: [
				'Article IV surveillance',
				'Crisis lending with conditions',
				'Special Drawing Rights'
			],
			obligations: ['Articles of Agreement', 'Quota-weighted voting (US veto on major decisions)'],
			accountableTo: ['Board of Governors (member states)'],
			overlaps: [
				{
					with: 'world-bank',
					note: 'IMF: macro stability and short-term financing; World Bank: long-term development projects.'
				}
			],
			sources: ['https://www.imf.org/en/About']
		},
		{
			id: 'world-bank',
			name: 'World Bank Group',
			acronym: 'WBG',
			kind: 'intergovernmental',
			level: 'global',
			founded: '1944',
			seat: 'Washington, D.C.',
			url: 'https://www.worldbank.org',
			summary: 'Bretton Woods development lender (IBRD, IDA, IFC, MIGA, ICSID).',
			responsibilities: [
				'Development loans and grants',
				'Private-sector investment via IFC',
				'Investment arbitration via ICSID'
			],
			obligations: ['Articles of Agreement', 'Shareholding-weighted voting'],
			accountableTo: ['Board of Governors'],
			overlaps: [
				{
					with: 'imf',
					note: 'See IMF.'
				},
				{
					with: 'pca',
					note: 'ICSID and PCA both administer investor-state arbitration.'
				}
			],
			sources: ['https://www.worldbank.org/en/who-we-are']
		},
		{
			id: 'wto',
			name: 'World Trade Organization',
			acronym: 'WTO',
			kind: 'intergovernmental',
			level: 'global',
			founded: '1995',
			seat: 'Geneva',
			url: 'https://www.wto.org',
			summary: 'Global trade-rules body; its Appellate Body has been paralysed since Dec 2019.',
			responsibilities: [
				'Trade agreements (GATT, GATS, TRIPS)',
				'Dispute settlement panels',
				'EU is a member alongside its states'
			],
			obligations: ['Marrakesh Agreement', 'Consensus decision-making'],
			accountableTo: ['Ministerial Conference (members)'],
			overlaps: [],
			sources: [
				'https://www.wto.org/english/thewto_e/whatis_e/whatis_e.htm',
				'https://policy.trade.ec.europa.eu/enforcement-and-protection/dispute-settlement/wto-dispute-settlement_en'
			]
		},
		{
			id: 'icc',
			name: 'International Criminal Court',
			acronym: 'ICC',
			kind: 'court',
			level: 'global',
			founded: '2002 (Rome Statute 1998)',
			seat: 'The Hague',
			url: 'https://www.icc-cpi.int',
			summary:
				'Treaty-based permanent court trying individuals for genocide, crimes against humanity, war crimes and aggression; not a UN organ.',
			responsibilities: [
				'Prosecutes individuals when national courts cannot or will not',
				'Arrest warrants (e.g. Putin 2023, Netanyahu 2024)',
				"Victims' reparations"
			],
			obligations: [
				'Rome Statute; 125 states parties',
				'Complementarity: national courts first',
				'Relies on states for arrests',
				'Under US sanctions since 2025; Hungary reversed its withdrawal in 2026'
			],
			accountableTo: ['Assembly of States Parties'],
			overlaps: [
				{
					with: 'icj',
					note: 'Individuals vs states; Hague neighbours often confused.'
				},
				{
					with: 'ecthr',
					note: 'Criminal liability vs state human-rights responsibility.'
				}
			],
			sources: [
				'https://www.icc-cpi.int/about/the-court',
				'https://asp.icc-cpi.int/states-parties',
				'https://www.hrw.org/news/2026/04/24/hungarys-road-back-to-the-rule-of-law-runs-through-the-icc'
			]
		},
		{
			id: 'pca',
			name: 'Permanent Court of Arbitration',
			acronym: 'PCA',
			kind: 'court',
			level: 'global',
			founded: '1899',
			seat: 'The Hague',
			url: 'https://pca-cpa.org',
			summary:
				'Intergovernmental organisation that administers arbitration between states, organisations and investors; not a standing court.',
			responsibilities: [
				'Administers inter-state, investor-state and contract arbitrations',
				'Registry for ad hoc tribunals (e.g. UNCLOS cases)'
			],
			obligations: ['1899 and 1907 Hague Conventions'],
			accountableTo: ['Administrative Council (contracting parties)'],
			overlaps: [
				{
					with: 'icj',
					note: 'Arbitration with chosen arbitrators vs a permanent court.'
				}
			],
			sources: ['https://pca-cpa.org/en/about/']
		},
		{
			id: 'oecd',
			name: 'Organisation for Economic Co-operation and Development',
			acronym: 'OECD',
			kind: 'intergovernmental',
			level: 'global',
			founded: '1961',
			seat: 'Paris',
			url: 'https://www.oecd.org',
			summary:
				'38-member policy forum producing data, standards and peer reviews, incl. the OECD AI Principles.',
			responsibilities: [
				'OECD AI Principles (2019, updated 2024); AI definition reused in the AI Act',
				'Global minimum tax (Pillar Two) framework',
				'Economic surveys and PISA'
			],
			obligations: ['OECD Convention', 'Mostly non-binding recommendations'],
			accountableTo: ['OECD Council (members)'],
			overlaps: [
				{
					with: 'eu-ai-office',
					note: 'Soft-law principles vs binding EU regulation.'
				},
				{
					with: 'unesco',
					note: 'Parallel AI ethics instruments.'
				}
			],
			sources: ['https://oecd.ai/en/ai-principles', 'https://www.oecd.org/en/about.html']
		},
		{
			id: 'nato',
			name: 'North Atlantic Treaty Organization',
			acronym: 'NATO',
			kind: 'intergovernmental',
			level: 'european',
			founded: '1949',
			seat: 'Brussels',
			url: 'https://www.nato.int',
			summary: '32-member military alliance based on collective defence (Article 5).',
			responsibilities: [
				'Collective defence and deterrence',
				'Defence spending pledge of 5% of GDP by 2035 (Hague summit 2025)'
			],
			obligations: ['North Atlantic Treaty', 'Consensus decisions'],
			accountableTo: ['North Atlantic Council (members)'],
			overlaps: [
				{
					with: 'european-union',
					note: "EU's mutual-assistance clause (Art. 42(7) TEU) and growing defence funding overlap with NATO; 23 states are in both."
				}
			],
			sources: [
				'https://www.nato.int/cps/en/natohq/topics_110496.htm',
				'https://www.nato.int/cps/en/natohq/official_texts_236705.htm'
			]
		},
		{
			id: 'osce',
			name: 'Organization for Security and Co-operation in Europe',
			acronym: 'OSCE',
			kind: 'intergovernmental',
			level: 'european',
			founded: '1975 (Helsinki Final Act)',
			seat: 'Vienna',
			url: 'https://www.osce.org',
			summary:
				'57-state regional security body: election observation, conflict prevention, minority rights.',
			responsibilities: [
				'Election observation (ODIHR)',
				'Field missions',
				'Representative on Freedom of the Media'
			],
			obligations: ['Political commitments, not a treaty', 'Consensus decisions incl. Russia'],
			accountableTo: ['Ministerial Council (participating states)'],
			overlaps: [
				{
					with: 'council-of-europe',
					note: 'Both work on democracy and minority rights; CoE through binding treaties, OSCE through political commitments.'
				}
			],
			sources: ['https://www.osce.org/who-we-are']
		},
		{
			id: 'united-states-government',
			name: 'United States Government',
			acronym: 'US',
			kind: 'state',
			level: 'national',
			founded: '1789',
			seat: 'Washington, D.C.',
			url: 'https://www.usa.gov',
			summary: 'Largest funder of many international bodies, now withdrawing from several.',
			responsibilities: [
				'Permanent UNSC member with veto',
				'Largest IMF/World Bank shareholder',
				'Left WHO (Jan 2026), leaving UNESCO (end 2026), UN Human Rights Council; Jan 2026 memo exits 66 bodies'
			],
			obligations: ['US Constitution; treaty commitments'],
			accountableTo: ['US voters, Congress'],
			overlaps: [],
			sources: [
				'https://www.whitehouse.gov/presidential-actions/2026/01/withdrawing-the-united-states-from-international-organizations-conventions-and-treaties-that-are-contrary-to-the-interests-of-the-united-states/',
				'https://www.aljazeera.com/news/2026/1/8/trump-to-withdraw-us-from-dozens-of-un-international-organisations'
			]
		}
	],
	relations: [
		{
			from: 'european-council',
			to: 'european-union',
			kind: 'part-of',
			label: 'EU institution',
			detail: 'One of the seven EU institutions listed in Art. 13 TEU.',
			sources: ['https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:12016M/TXT']
		},
		{
			from: 'council-of-the-eu',
			to: 'european-union',
			kind: 'part-of',
			label: 'EU institution',
			detail: 'One of the seven EU institutions listed in Art. 13 TEU.',
			sources: ['https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:12016M/TXT']
		},
		{
			from: 'european-commission',
			to: 'european-union',
			kind: 'part-of',
			label: 'EU institution',
			detail: 'One of the seven EU institutions listed in Art. 13 TEU.',
			sources: ['https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:12016M/TXT']
		},
		{
			from: 'european-parliament',
			to: 'european-union',
			kind: 'part-of',
			label: 'EU institution',
			detail: 'One of the seven EU institutions listed in Art. 13 TEU.',
			sources: ['https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:12016M/TXT']
		},
		{
			from: 'cjeu',
			to: 'european-union',
			kind: 'part-of',
			label: 'EU institution',
			detail: 'One of the seven EU institutions listed in Art. 13 TEU.',
			sources: ['https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:12016M/TXT']
		},
		{
			from: 'european-court-of-auditors',
			to: 'european-union',
			kind: 'part-of',
			label: 'EU institution',
			detail: 'One of the seven EU institutions listed in Art. 13 TEU.',
			sources: ['https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:12016M/TXT']
		},
		{
			from: 'ecb',
			to: 'european-union',
			kind: 'part-of',
			label: 'EU institution',
			detail: 'One of the seven EU institutions listed in Art. 13 TEU.',
			sources: ['https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:12016M/TXT']
		},
		{
			from: 'eppo',
			to: 'european-union',
			kind: 'part-of',
			label: 'EU body/agency',
			detail: 'Decentralised EU agency or body established under EU law.',
			sources: [
				'https://european-union.europa.eu/institutions-law-budget/institutions-and-bodies/types-institutions-and-bodies_en'
			]
		},
		{
			from: 'eurojust',
			to: 'european-union',
			kind: 'part-of',
			label: 'EU body/agency',
			detail: 'Decentralised EU agency or body established under EU law.',
			sources: [
				'https://european-union.europa.eu/institutions-law-budget/institutions-and-bodies/types-institutions-and-bodies_en'
			]
		},
		{
			from: 'europol',
			to: 'european-union',
			kind: 'part-of',
			label: 'EU body/agency',
			detail: 'Decentralised EU agency or body established under EU law.',
			sources: [
				'https://european-union.europa.eu/institutions-law-budget/institutions-and-bodies/types-institutions-and-bodies_en'
			]
		},
		{
			from: 'frontex',
			to: 'european-union',
			kind: 'part-of',
			label: 'EU body/agency',
			detail: 'Decentralised EU agency or body established under EU law.',
			sources: [
				'https://european-union.europa.eu/institutions-law-budget/institutions-and-bodies/types-institutions-and-bodies_en'
			]
		},
		{
			from: 'euaa',
			to: 'european-union',
			kind: 'part-of',
			label: 'EU body/agency',
			detail: 'Decentralised EU agency or body established under EU law.',
			sources: [
				'https://european-union.europa.eu/institutions-law-budget/institutions-and-bodies/types-institutions-and-bodies_en'
			]
		},
		{
			from: 'ema',
			to: 'european-union',
			kind: 'part-of',
			label: 'EU body/agency',
			detail: 'Decentralised EU agency or body established under EU law.',
			sources: [
				'https://european-union.europa.eu/institutions-law-budget/institutions-and-bodies/types-institutions-and-bodies_en'
			]
		},
		{
			from: 'enisa',
			to: 'european-union',
			kind: 'part-of',
			label: 'EU body/agency',
			detail: 'Decentralised EU agency or body established under EU law.',
			sources: [
				'https://european-union.europa.eu/institutions-law-budget/institutions-and-bodies/types-institutions-and-bodies_en'
			]
		},
		{
			from: 'edpb',
			to: 'european-union',
			kind: 'part-of',
			label: 'EU body/agency',
			detail: 'Decentralised EU agency or body established under EU law.',
			sources: [
				'https://european-union.europa.eu/institutions-law-budget/institutions-and-bodies/types-institutions-and-bodies_en'
			]
		},
		{
			from: 'edps',
			to: 'european-union',
			kind: 'part-of',
			label: 'EU body/agency',
			detail: 'Decentralised EU agency or body established under EU law.',
			sources: [
				'https://european-union.europa.eu/institutions-law-budget/institutions-and-bodies/types-institutions-and-bodies_en'
			]
		},
		{
			from: 'european-ombudsman',
			to: 'european-union',
			kind: 'part-of',
			label: 'EU body/agency',
			detail: 'Decentralised EU agency or body established under EU law.',
			sources: [
				'https://european-union.europa.eu/institutions-law-budget/institutions-and-bodies/types-institutions-and-bodies_en'
			]
		},
		{
			from: 'eib',
			to: 'european-union',
			kind: 'part-of',
			label: 'EU body/agency',
			detail: 'Decentralised EU agency or body established under EU law.',
			sources: [
				'https://european-union.europa.eu/institutions-law-budget/institutions-and-bodies/types-institutions-and-bodies_en'
			]
		},
		{
			from: 'general-court',
			to: 'cjeu',
			kind: 'part-of',
			label: 'court within CJEU',
			detail: 'The CJEU comprises the Court of Justice and the General Court.',
			sources: ['https://curia.europa.eu/jcms/jcms/Jo2_6999/en/']
		},
		{
			from: 'general-court',
			to: 'cjeu',
			kind: 'appeals-to',
			label: 'appeal on law',
			detail: 'General Court rulings can be appealed on points of law to the Court of Justice.',
			sources: ['https://curia.europa.eu/jcms/jcms/Jo2_7033/en/']
		},
		{
			from: 'dg-rtd',
			to: 'european-commission',
			kind: 'part-of',
			label: 'Commission service',
			detail: 'A department of the Commission.',
			sources: ['https://commission.europa.eu/about/departments-and-executive-agencies_en']
		},
		{
			from: 'dg-cnect',
			to: 'european-commission',
			kind: 'part-of',
			label: 'Commission service',
			detail: 'A department of the Commission.',
			sources: ['https://commission.europa.eu/about/departments-and-executive-agencies_en']
		},
		{
			from: 'olaf',
			to: 'european-commission',
			kind: 'part-of',
			label: 'Commission service',
			detail: 'A department of the Commission.',
			sources: ['https://commission.europa.eu/about/departments-and-executive-agencies_en']
		},
		{
			from: 'eu-ai-office',
			to: 'dg-cnect',
			kind: 'part-of',
			label: 'unit within DG CNECT',
			detail: 'The AI Office was set up inside DG CNECT by Commission Decision of 24 Jan 2024.',
			sources: ['https://digital-strategy.ec.europa.eu/en/policies/ai-office']
		},
		{
			from: 'european-council',
			to: 'european-commission',
			kind: 'appoints',
			label: 'nominates President',
			detail:
				"The European Council proposes the Commission President by QMV and appoints the College after Parliament's consent.",
			sources: ['https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:12016M/TXT']
		},
		{
			from: 'european-parliament',
			to: 'european-commission',
			kind: 'appoints',
			label: 'elects President, approves College',
			detail:
				'Parliament elects the President and gives consent to the whole College after hearings (Art. 17(7) TEU).',
			sources: ['https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:12016M/TXT']
		},
		{
			from: 'european-parliament',
			to: 'european-commission',
			kind: 'oversees',
			label: 'censure, questions',
			detail:
				'Parliament can pass a motion of censure forcing the College to resign; also questions and inquiries.',
			sources: ['https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:12016E/TXT']
		},
		{
			from: 'european-parliament',
			to: 'european-ombudsman',
			kind: 'appoints',
			label: 'elects Ombudsman',
			detail: 'Parliament elects the Ombudsman after each election.',
			sources: ['https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:12016E/TXT']
		},
		{
			from: 'council-of-the-eu',
			to: 'european-court-of-auditors',
			kind: 'appoints',
			label: 'appoints members',
			detail: 'Council appoints ECA members after consulting Parliament.',
			sources: ['https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:12016E/TXT']
		},
		{
			from: 'european-council',
			to: 'ecb',
			kind: 'appoints',
			label: 'appoints Executive Board',
			detail:
				'European Council appoints ECB President and Board by QMV on Council recommendation after consulting Parliament.',
			sources: ['https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:12016E/TXT']
		},
		{
			from: 'council-of-the-eu',
			to: 'eppo',
			kind: 'appoints',
			label: 'appoints Chief Prosecutor',
			detail:
				'Parliament and Council jointly appoint the European Chief Prosecutor (Andrés Ritter, from 1 Nov 2026).',
			sources: [
				'https://eucrim.eu/news/andres-ritter-succeeds-laura-kovesi-as-european-chief-prosecutor/'
			]
		},
		{
			from: 'european-parliament',
			to: 'eppo',
			kind: 'appoints',
			label: 'co-appoints Chief Prosecutor',
			detail: 'Parliament approved Ritter on 10 March 2026.',
			sources: ['https://www.europarl.europa.eu/news/en/press-room/20251201IPR31709/']
		},
		{
			from: 'european-parliament',
			to: 'edps',
			kind: 'appoints',
			label: 'co-appoints EDPS',
			detail: 'Parliament and Council appoint the EDPS by common accord.',
			sources: ['https://www.edps.europa.eu/about-edps_en']
		},
		{
			from: 'council-of-the-eu',
			to: 'cjeu',
			kind: 'appoints',
			label: 'governments appoint judges',
			detail:
				"Judges are appointed by common accord of member-state governments after a panel's opinion (Art. 253-255 TFEU).",
			sources: ['https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:12016E/TXT']
		},
		{
			from: 'european-commission',
			to: 'european-parliament',
			kind: 'partners',
			label: 'proposes laws',
			detail: 'The Commission submits legislative proposals to Parliament and Council.',
			sources: ['https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:12016E/TXT']
		},
		{
			from: 'european-parliament',
			to: 'council-of-the-eu',
			kind: 'partners',
			label: 'co-legislators',
			detail: 'Ordinary legislative procedure: both must agree identical text.',
			sources: ['https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:12016E/TXT']
		},
		{
			from: 'european-council',
			to: 'council-of-the-eu',
			kind: 'partners',
			label: 'sets direction',
			detail:
				"European Council conclusions guide the Council's legislative work; unanimous MFF deal precedes Council regulation.",
			sources: ['https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:12016M/TXT']
		},
		{
			from: 'european-court-of-auditors',
			to: 'european-commission',
			kind: 'oversees',
			label: 'audits budget',
			detail:
				'ECA audits all EU spending, mostly managed by the Commission, for the annual discharge.',
			sources: ['https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:12016E/TXT']
		},
		{
			from: 'european-ombudsman',
			to: 'european-commission',
			kind: 'oversees',
			label: 'maladministration complaints',
			detail:
				"The Ombudsman investigates complaints about all EU institutions except the CJEU's judicial work.",
			sources: ['https://www.ombudsman.europa.eu/en/about-us']
		},
		{
			from: 'european-ombudsman',
			to: 'frontex',
			kind: 'oversees',
			label: 'inquiries',
			detail:
				"The Ombudsman has run inquiries into Frontex's complaints mechanism and search-and-rescue role.",
			sources: ['https://www.ombudsman.europa.eu/en/case/en/64297']
		},
		{
			from: 'cjeu',
			to: 'european-commission',
			kind: 'oversees',
			label: 'judicial review',
			detail: 'Annulment actions and failure-to-act cases against EU institutions.',
			sources: ['https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:12016E/TXT']
		},
		{
			from: 'european-commission',
			to: 'european-union',
			kind: 'oversees',
			label: 'infringement procedures',
			detail:
				'The Commission can take member states to the Court of Justice for failing to apply EU law.',
			sources: ['https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:12016E/TXT']
		},
		{
			from: 'edps',
			to: 'europol',
			kind: 'oversees',
			label: 'data protection supervision',
			detail: "EDPS supervises Europol's processing of personal data.",
			sources: ['https://www.edps.europa.eu/data-protection/our-role-supervisor/europol_en']
		},
		{
			from: 'european-parliament',
			to: 'ecb',
			kind: 'oversees',
			label: 'monetary dialogue',
			detail: 'ECB President appears before ECON quarterly; ECB reports annually.',
			sources: ['https://www.europarl.europa.eu/committees/en/econ/econ-policies/monetary-policy']
		},
		{
			from: 'ecb',
			to: 'european-union',
			kind: 'regulates',
			label: 'supervises large banks',
			detail: 'Single Supervisory Mechanism supervises significant banks in the euro area.',
			sources: ['https://www.bankingsupervision.europa.eu/about/thessm/html/index.en.html']
		},
		{
			from: 'olaf',
			to: 'eppo',
			kind: 'partners',
			label: 'reports criminal suspicions',
			detail: 'OLAF must report suspected crimes to EPPO and supports its investigations.',
			sources: ['https://anti-fraud.ec.europa.eu/about-us_en']
		},
		{
			from: 'european-court-of-auditors',
			to: 'olaf',
			kind: 'partners',
			label: 'passes fraud suspicions',
			detail: 'ECA forwards suspicions of fraud found in audits.',
			sources: [
				'https://european-union.europa.eu/institutions-law-budget/institutions-and-bodies/search-all-eu-institutions-and-bodies/european-court-auditors-eca_en'
			]
		},
		{
			from: 'eppo',
			to: 'national-courts',
			kind: 'appeals-to',
			label: 'prosecutes before national courts',
			detail: 'EPPO cases are tried in member-state courts; its acts are reviewable there.',
			sources: ['https://www.eppo.europa.eu/about/background_en']
		},
		{
			from: 'eurojust',
			to: 'eppo',
			kind: 'partners',
			label: 'working arrangement',
			detail: 'Eurojust supports EPPO cases involving non-participating states.',
			sources: ['https://www.eurojust.europa.eu/about-us']
		},
		{
			from: 'europol',
			to: 'eurojust',
			kind: 'partners',
			label: 'police-judicial cooperation',
			detail: 'Both agencies support the same cross-border cases from police and judicial sides.',
			sources: ['https://www.europol.europa.eu/about-europol']
		},
		{
			from: 'frontex',
			to: 'national-border-police',
			kind: 'partners',
			label: 'supports border control',
			detail: 'Frontex deploys standing-corps officers who act under host-state command.',
			sources: ['https://www.frontex.europa.eu/about-frontex/who-we-are/tasks-mission/']
		},
		{
			from: 'frontex',
			to: 'schengen-area',
			kind: 'implements',
			label: 'external border management',
			detail:
				"Frontex implements European integrated border management for Schengen's external frontier.",
			sources: ['https://www.frontex.europa.eu/about-frontex/who-we-are/tasks-mission/']
		},
		{
			from: 'national-border-police',
			to: 'schengen-area',
			kind: 'implements',
			label: 'Schengen Borders Code',
			detail: 'National border guards apply the Schengen Borders Code.',
			sources: ['https://home-affairs.ec.europa.eu/policies/schengen/schengen-area_en']
		},
		{
			from: 'euaa',
			to: 'unhcr',
			kind: 'partners',
			label: 'cooperation on asylum',
			detail: 'EUAA works with UNHCR on asylum standards and operations.',
			sources: ['https://euaa.europa.eu/about-us']
		},
		{
			from: 'unhcr',
			to: 'iom',
			kind: 'partners',
			label: 'mixed-migration coordination',
			detail: 'Joint responses to refugee and migrant flows.',
			sources: ['https://www.unhcr.org/about-unhcr']
		},
		{
			from: 'national-dpas',
			to: 'edpb',
			kind: 'member-of',
			label: 'board members',
			detail: 'Heads of national DPAs and the EDPS form the EDPB.',
			sources: ['https://www.edpb.europa.eu/about-edpb/about-edpb/members_en']
		},
		{
			from: 'edps',
			to: 'edpb',
			kind: 'member-of',
			label: 'member and secretariat',
			detail: 'EDPS is a member and provides the secretariat.',
			sources: [
				'https://www.edpb.europa.eu/about-edpb/who-we-are/european-data-protection-board_en'
			]
		},
		{
			from: 'edpb',
			to: 'national-dpas',
			kind: 'oversees',
			label: 'binding dispute decisions',
			detail: 'Art. 65 GDPR binding decisions settle disputes between DPAs.',
			sources: [
				'https://www.edpb.europa.eu/about-edpb/who-we-are/european-data-protection-board_en'
			]
		},
		{
			from: 'national-dpas',
			to: 'national-courts',
			kind: 'appeals-to',
			label: 'appeal against fines',
			detail: 'DPA decisions can be challenged in national courts, which may refer to the CJEU.',
			sources: ['https://www.edpb.europa.eu/about-edpb/about-edpb/members_en']
		},
		{
			from: 'oecd',
			to: 'eu-ai-office',
			kind: 'partners',
			label: 'AI definition source',
			detail: "The AI Act aligned its AI-system definition with the OECD's updated definition.",
			sources: ['https://oecd.ai/en/ai-principles']
		},
		{
			from: 'enisa',
			to: 'european-commission',
			kind: 'partners',
			label: 'advises on cybersecurity',
			detail: 'ENISA supports the Commission on NIS2 and certification.',
			sources: ['https://www.enisa.europa.eu/about-enisa/who-we-are']
		},
		{
			from: 'ema',
			to: 'european-commission',
			kind: 'partners',
			label: 'recommends authorisations',
			detail: 'EMA opinions are turned into marketing authorisations by Commission decision.',
			sources: ['https://www.ema.europa.eu/en/about-us']
		},
		{
			from: 'european-union',
			to: 'horizon-europe',
			kind: 'funds',
			label: 'EU budget (MFF)',
			detail: 'Horizon Europe is financed from the 2021-2027 MFF and NGEU.',
			sources: [
				'https://research-and-innovation.ec.europa.eu/funding/funding-opportunities/funding-programmes-and-open-calls/horizon-europe_en'
			]
		},
		{
			from: 'european-union',
			to: 'digital-europe-programme',
			kind: 'funds',
			label: 'EU budget (MFF)',
			detail: 'Financed from the 2021-2027 MFF.',
			sources: ['https://digital-strategy.ec.europa.eu/en/activities/digital-programme']
		},
		{
			from: 'european-union',
			to: 'cohesion-funds',
			kind: 'funds',
			label: 'EU budget (MFF)',
			detail: 'About a third of the MFF.',
			sources: ['https://ec.europa.eu/regional_policy/funding_en']
		},
		{
			from: 'european-union',
			to: 'recovery-and-resilience-facility',
			kind: 'funds',
			label: 'joint EU borrowing',
			detail: 'The Commission borrows on markets on behalf of the EU to fund NGEU.',
			sources: [
				'https://commission.europa.eu/business-economy-euro/economic-recovery/recovery-and-resilience-facility_en'
			]
		},
		{
			from: 'european-union',
			to: 'chips-ju',
			kind: 'funds',
			label: 'EU budget + member states',
			detail:
				'Chips JU is co-funded by Horizon Europe, Digital Europe, participating states and industry.',
			sources: ['https://www.chips-ju.europa.eu/about-us/']
		},
		{
			from: 'erc',
			to: 'horizon-europe',
			kind: 'part-of',
			label: 'Pillar I',
			detail: "ERC is part of Horizon Europe's Excellent Science pillar.",
			sources: ['https://erc.europa.eu/about-erc/mission']
		},
		{
			from: 'eic',
			to: 'horizon-europe',
			kind: 'part-of',
			label: 'Pillar III',
			detail: 'EIC is part of Innovative Europe pillar.',
			sources: ['https://eic.ec.europa.eu/eic-funding-opportunities_en']
		},
		{
			from: 'dg-rtd',
			to: 'horizon-europe',
			kind: 'oversees',
			label: 'manages programme',
			detail: 'DG RTD leads programme design and supervises its implementing agencies.',
			sources: [
				'https://commission.europa.eu/about/departments-and-executive-agencies/research-and-innovation_en'
			]
		},
		{
			from: 'dg-cnect',
			to: 'digital-europe-programme',
			kind: 'oversees',
			label: 'manages programme',
			detail: 'DG CNECT is lead DG for Digital Europe.',
			sources: ['https://digital-strategy.ec.europa.eu/en/activities/digital-programme']
		},
		{
			from: 'rea',
			to: 'horizon-europe',
			kind: 'implements',
			label: 'manages grants',
			detail: 'REA runs a large share of Horizon Europe calls.',
			sources: ['https://rea.ec.europa.eu']
		},
		{
			from: 'ercea',
			to: 'erc',
			kind: 'implements',
			label: 'runs ERC grants',
			detail: "ERCEA implements the ERC Scientific Council's strategy.",
			sources: ['https://erc.europa.eu/about-erc/erc-executive-agency']
		},
		{
			from: 'eismea',
			to: 'eic',
			kind: 'implements',
			label: 'runs EIC calls',
			detail: 'EISMEA manages EIC Pathfinder, Transition and Accelerator.',
			sources: ['https://eismea.ec.europa.eu']
		},
		{
			from: 'hadea',
			to: 'digital-europe-programme',
			kind: 'implements',
			label: 'manages grants',
			detail: 'HaDEA manages parts of Digital Europe and Horizon clusters 1 and 4.',
			sources: ['https://hadea.ec.europa.eu']
		},
		{
			from: 'european-commission',
			to: 'rea',
			kind: 'oversees',
			label: 'parent DGs supervise',
			detail: 'Executive agencies act under Commission delegation and supervision.',
			sources: ['https://commission.europa.eu/about/departments-and-executive-agencies_en']
		},
		{
			from: 'european-commission',
			to: 'ercea',
			kind: 'oversees',
			label: 'parent DGs supervise',
			detail: 'Executive agencies act under Commission delegation and supervision.',
			sources: ['https://commission.europa.eu/about/departments-and-executive-agencies_en']
		},
		{
			from: 'european-commission',
			to: 'eismea',
			kind: 'oversees',
			label: 'parent DGs supervise',
			detail: 'Executive agencies act under Commission delegation and supervision.',
			sources: ['https://commission.europa.eu/about/departments-and-executive-agencies_en']
		},
		{
			from: 'european-commission',
			to: 'hadea',
			kind: 'oversees',
			label: 'parent DGs supervise',
			detail: 'Executive agencies act under Commission delegation and supervision.',
			sources: ['https://commission.europa.eu/about/departments-and-executive-agencies_en']
		},
		{
			from: 'dg-cnect',
			to: 'chips-ju',
			kind: 'oversees',
			label: 'Chips Act policy lead',
			detail: 'The Commission is a founding member of the Chips JU and leads Chips Act policy.',
			sources: ['https://www.chips-ju.europa.eu/about-us/']
		},
		{
			from: 'eib',
			to: 'eic',
			kind: 'partners',
			label: 'co-investment',
			detail:
				'EIB Group and EIC co-finance scale-ups (e.g. European Tech Champions Initiative via EIF).',
			sources: ['https://www.eif.org/who_we_are/index.htm']
		},
		{
			from: 'european-court-of-auditors',
			to: 'recovery-and-resilience-facility',
			kind: 'oversees',
			label: 'audits payments',
			detail: 'ECA audits RRF milestone-based payments.',
			sources: [
				'https://european-union.europa.eu/institutions-law-budget/institutions-and-bodies/search-all-eu-institutions-and-bodies/european-court-auditors-eca_en'
			]
		},
		{
			from: 'european-court-of-auditors',
			to: 'cohesion-funds',
			kind: 'oversees',
			label: 'audits spending',
			detail: 'Cohesion spending has among the highest error rates in ECA reports.',
			sources: [
				'https://european-union.europa.eu/institutions-law-budget/institutions-and-bodies/search-all-eu-institutions-and-bodies/european-court-auditors-eca_en'
			]
		},
		{
			from: 'national-courts',
			to: 'cjeu',
			kind: 'appeals-to',
			label: 'preliminary reference (Art. 267)',
			detail:
				'National courts ask the Court of Justice (or since 2024 the General Court in some fields) how to interpret EU law; the answer binds them.',
			sources: ['https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:12016E/TXT']
		},
		{
			from: 'national-courts',
			to: 'ecthr',
			kind: 'appeals-to',
			label: 'application after domestic remedies',
			detail: 'Individuals can apply to Strasbourg within 4 months of the final domestic decision.',
			sources: ['https://www.echr.coe.int/admissibility-guide']
		},
		{
			from: 'ecthr',
			to: 'council-of-europe',
			kind: 'part-of',
			label: 'CoE court',
			detail: 'ECtHR is established by the ECHR under the Council of Europe.',
			sources: ['https://www.echr.coe.int/court-in-brief']
		},
		{
			from: 'council-of-europe',
			to: 'ecthr',
			kind: 'oversees',
			label: 'Committee of Ministers supervises execution',
			detail: 'The Committee of Ministers supervises execution of judgments.',
			sources: ['https://www.coe.int/en/web/execution']
		},
		{
			from: 'european-union',
			to: 'ecthr',
			kind: 'partners',
			label: 'accession pending',
			detail:
				'EU accession to the ECHR is mandated by Art. 6(2) TEU; the revised draft is awaiting a CJEU opinion requested Nov 2025.',
			sources: [
				'https://www.coe.int/en/web/human-rights-intergovernmental-cooperation/accession-of-the-european-union-to-the-european-convention-on-human-rights'
			]
		},
		{
			from: 'european-union',
			to: 'council-of-europe',
			kind: 'partners',
			label: 'cooperation, not membership',
			detail: 'The EU is not a CoE member; all 27 EU states are.',
			sources: ['https://www.coe.int/en/web/about-us/who-we-are']
		},
		{
			from: 'un-general-assembly',
			to: 'united-nations',
			kind: 'part-of',
			label: 'principal organ',
			detail: 'One of the six principal organs under Art. 7 UN Charter.',
			sources: ['https://www.un.org/en/about-us/un-charter/full-text']
		},
		{
			from: 'un-security-council',
			to: 'united-nations',
			kind: 'part-of',
			label: 'principal organ',
			detail: 'One of the six principal organs under Art. 7 UN Charter.',
			sources: ['https://www.un.org/en/about-us/un-charter/full-text']
		},
		{
			from: 'un-secretariat',
			to: 'united-nations',
			kind: 'part-of',
			label: 'principal organ',
			detail: 'One of the six principal organs under Art. 7 UN Charter.',
			sources: ['https://www.un.org/en/about-us/un-charter/full-text']
		},
		{
			from: 'icj',
			to: 'united-nations',
			kind: 'part-of',
			label: 'principal organ',
			detail: 'One of the six principal organs under Art. 7 UN Charter.',
			sources: ['https://www.un.org/en/about-us/un-charter/full-text']
		},
		{
			from: 'un-human-rights-council',
			to: 'un-general-assembly',
			kind: 'part-of',
			label: 'subsidiary of GA',
			detail: 'Established by and reports to the General Assembly.',
			sources: ['https://www.un.org/en/about-us/un-system']
		},
		{
			from: 'unhcr',
			to: 'un-general-assembly',
			kind: 'part-of',
			label: 'subsidiary of GA',
			detail: 'Established by and reports to the General Assembly.',
			sources: ['https://www.un.org/en/about-us/un-system']
		},
		{
			from: 'ohchr',
			to: 'un-secretariat',
			kind: 'part-of',
			label: 'Secretariat office',
			detail: 'OHCHR is part of the UN Secretariat.',
			sources: ['https://www.ohchr.org/en/about-us']
		},
		{
			from: 'who',
			to: 'united-nations',
			kind: 'partners',
			label: 'specialised agency',
			detail: 'Autonomous organisation linked to the UN by agreement under Art. 57/63 Charter.',
			sources: ['https://www.un.org/en/about-us/un-system']
		},
		{
			from: 'unesco',
			to: 'united-nations',
			kind: 'partners',
			label: 'specialised agency',
			detail: 'Autonomous organisation linked to the UN by agreement under Art. 57/63 Charter.',
			sources: ['https://www.un.org/en/about-us/un-system']
		},
		{
			from: 'itu',
			to: 'united-nations',
			kind: 'partners',
			label: 'specialised agency',
			detail: 'Autonomous organisation linked to the UN by agreement under Art. 57/63 Charter.',
			sources: ['https://www.un.org/en/about-us/un-system']
		},
		{
			from: 'wipo',
			to: 'united-nations',
			kind: 'partners',
			label: 'specialised agency',
			detail: 'Autonomous organisation linked to the UN by agreement under Art. 57/63 Charter.',
			sources: ['https://www.un.org/en/about-us/un-system']
		},
		{
			from: 'ilo',
			to: 'united-nations',
			kind: 'partners',
			label: 'specialised agency',
			detail: 'Autonomous organisation linked to the UN by agreement under Art. 57/63 Charter.',
			sources: ['https://www.un.org/en/about-us/un-system']
		},
		{
			from: 'imf',
			to: 'united-nations',
			kind: 'partners',
			label: 'specialised agency',
			detail: 'Autonomous organisation linked to the UN by agreement under Art. 57/63 Charter.',
			sources: ['https://www.un.org/en/about-us/un-system']
		},
		{
			from: 'world-bank',
			to: 'united-nations',
			kind: 'partners',
			label: 'specialised agency',
			detail: 'Autonomous organisation linked to the UN by agreement under Art. 57/63 Charter.',
			sources: ['https://www.un.org/en/about-us/un-system']
		},
		{
			from: 'iom',
			to: 'united-nations',
			kind: 'partners',
			label: 'related organisation',
			detail: 'IOM joined the UN system as a related organisation in 2016.',
			sources: ['https://www.iom.int/about-iom']
		},
		{
			from: 'wto',
			to: 'united-nations',
			kind: 'partners',
			label: 'related organisation, not agency',
			detail: 'WTO cooperates with the UN but is outside its system of specialised agencies.',
			sources: ['https://www.un.org/en/about-us/un-system']
		},
		{
			from: 'un-security-council',
			to: 'un-secretariat',
			kind: 'appoints',
			label: 'recommends SG',
			detail: 'Council recommends; GA appoints (selection for 2027 term under way).',
			sources: ['https://unric.org/en/next-un-secretary-general-2026-candidates-process/']
		},
		{
			from: 'un-general-assembly',
			to: 'un-secretariat',
			kind: 'appoints',
			label: 'appoints SG',
			detail: "GA appoints the Secretary-General on the Council's recommendation.",
			sources: ['https://www.un.org/en/about-us/un-charter/full-text']
		},
		{
			from: 'un-general-assembly',
			to: 'icj',
			kind: 'appoints',
			label: 'elects judges (with UNSC)',
			detail: 'Judges are elected by absolute majorities in both GA and Security Council.',
			sources: ['https://www.icj-cij.org/members']
		},
		{
			from: 'un-security-council',
			to: 'icj',
			kind: 'appoints',
			label: 'elects judges (with GA)',
			detail: 'Concurrent election with the GA.',
			sources: ['https://www.icj-cij.org/members']
		},
		{
			from: 'un-security-council',
			to: 'icc',
			kind: 'partners',
			label: 'can refer situations',
			detail:
				'Under Art. 13(b) Rome Statute the Council can refer situations (Darfur 2005, Libya 2011) and defer cases.',
			sources: ['https://www.icc-cpi.int/about/the-court']
		},
		{
			from: 'un-general-assembly',
			to: 'un-human-rights-council',
			kind: 'appoints',
			label: 'elects 47 members',
			detail: 'GA elects HRC members by secret ballot.',
			sources: ['https://www.ohchr.org/en/hr-bodies/hrc/about-council']
		},
		{
			from: 'un-general-assembly',
			to: 'united-nations',
			kind: 'funds',
			label: 'approves assessed budget',
			detail: "GA approves the regular budget and members' assessed contributions.",
			sources: ['https://www.un.org/en/about-us/un-charter/full-text']
		},
		{
			from: 'european-union',
			to: 'wto',
			kind: 'member-of',
			label: 'member with its 27 states',
			detail: 'The EU negotiates as one in the WTO via the Commission.',
			sources: ['https://www.wto.org/english/thewto_e/countries_e/european_communities_e.htm']
		},
		{
			from: 'european-union',
			to: 'united-nations',
			kind: 'partners',
			label: 'GA observer with enhanced rights',
			detail:
				'The EU has enhanced observer status at the GA (res. 65/276); its states are members.',
			sources: ['https://www.eeas.europa.eu/delegations/un-new-york_en']
		},
		{
			from: 'european-union',
			to: 'oecd',
			kind: 'partners',
			label: 'participates in OECD work',
			detail: "The Commission takes part in OECD work under the Convention's Protocol.",
			sources: ['https://www.oecd.org/en/about.html']
		},
		{
			from: 'european-union',
			to: 'nato',
			kind: 'partners',
			label: 'strategic partnership',
			detail: 'EU-NATO joint declarations (2016, 2018, 2023).',
			sources: ['https://www.nato.int/cps/en/natohq/topics_49217.htm']
		},
		{
			from: 'european-union',
			to: 'unhcr',
			kind: 'funds',
			label: 'major donor',
			detail: "The EU and its member states are among UNHCR's largest donors.",
			sources: ['https://www.unhcr.org/about-unhcr']
		},
		{
			from: 'european-union',
			to: 'who',
			kind: 'funds',
			label: 'voluntary contributions',
			detail: 'The Commission funds WHO programmes; EU states are members.',
			sources: ['https://www.who.int/about']
		},
		{
			from: 'european-union',
			to: 'icc',
			kind: 'partners',
			label: 'political and financial support',
			detail: 'All EU states are Rome Statute parties; EU funds and backs the ICC.',
			sources: [
				'https://www.eeas.europa.eu/delegations/un-new-york/eu-statement-un-general-assembly-report-international-criminal-court_en'
			]
		},
		{
			from: 'united-states-government',
			to: 'un-security-council',
			kind: 'member-of',
			label: 'permanent member (veto)',
			detail: 'One of the P5.',
			sources: ['https://www.un.org/en/about-us/un-charter/full-text']
		},
		{
			from: 'united-states-government',
			to: 'united-nations',
			kind: 'funds',
			label: 'largest assessed contributor (22%)',
			detail: 'The US pays 22% of the regular budget but has withheld and cut voluntary funding.',
			sources: [
				'https://www.aljazeera.com/news/2026/1/8/trump-to-withdraw-us-from-dozens-of-un-international-organisations'
			]
		},
		{
			from: 'united-states-government',
			to: 'who',
			kind: 'competes',
			label: 'withdrew Jan 2026',
			detail: 'US membership ended 22 Jan 2026 after a one-year notice.',
			sources: ['https://www.arabnews.pk/node/2630423']
		},
		{
			from: 'united-states-government',
			to: 'unesco',
			kind: 'member-of',
			label: 'leaving end 2026',
			detail: 'Withdrawal announced July 2025, effective 31 Dec 2026.',
			sources: [
				'https://www.state.gov/releases/office-of-the-spokesperson/2025/07/the-united-states-withdraws-from-the-united-nations-educational-scientific-and-cultural-organization-unesco'
			]
		},
		{
			from: 'united-states-government',
			to: 'icc',
			kind: 'competes',
			label: 'sanctions ICC officials',
			detail: 'Executive Order 14203 (Feb 2025) and designations of judges and the prosecutor.',
			sources: ['https://www.icc-cpi.int/about/the-court']
		},
		{
			from: 'united-states-government',
			to: 'imf',
			kind: 'member-of',
			label: 'largest shareholder, veto',
			detail: 'About 16.5% of votes; major decisions need 85%.',
			sources: ['https://www.imf.org/en/About']
		},
		{
			from: 'united-states-government',
			to: 'nato',
			kind: 'member-of',
			label: 'founding member',
			detail: 'Founding member of the alliance.',
			sources: ['https://www.nato.int/cps/en/natohq/topics_52044.htm']
		},
		{
			from: 'united-states-government',
			to: 'oecd',
			kind: 'member-of',
			label: 'member',
			detail: 'Founding OECD member.',
			sources: ['https://www.oecd.org/en/about.html']
		},
		{
			from: 'united-states-government',
			to: 'osce',
			kind: 'member-of',
			label: 'participating state',
			detail: 'One of 57 participating states.',
			sources: ['https://www.osce.org/who-we-are']
		},
		{
			from: 'world-bank',
			to: 'pca',
			kind: 'competes',
			label: 'ICSID vs PCA arbitration',
			detail: 'Both administer investor-state disputes; investors choose under treaty clauses.',
			sources: ['https://pca-cpa.org/en/about/']
		},
		{
			from: 'ohchr',
			to: 'un-human-rights-council',
			kind: 'partners',
			label: 'secretariat support',
			detail: 'OHCHR serves the Council.',
			sources: ['https://www.ohchr.org/en/about-us']
		},
		{
			from: 'council-of-europe',
			to: 'osce',
			kind: 'partners',
			label: 'democracy and rights cooperation',
			detail: 'Co-operate on elections and minority rights.',
			sources: ['https://www.osce.org/who-we-are']
		},
		{
			from: 'eurojust',
			to: 'icc',
			kind: 'partners',
			label: 'war-crimes evidence',
			detail:
				"Eurojust's CICED database supports national prosecutors and ICC cooperation on Ukraine.",
			sources: ['https://www.eurojust.europa.eu/about-us']
		}
	],
	routes: [
		{
			id: 'horizon-grant',
			title: 'Who pays for a Horizon grant',
			steps: [
				{
					id: 'european-commission',
					note: 'Proposes the long-term budget and the research programme.'
				},
				{
					id: 'european-parliament',
					note: 'Adopts the budget with the Council.'
				},
				{
					id: 'council-of-the-eu',
					note: 'Adopts the budget with Parliament.'
				},
				{
					id: 'horizon-europe',
					note: 'The programme that holds the research money.'
				},
				{
					id: 'ercea',
					note: "Runs the European Research Council's calls and pays its grants."
				},
				{
					id: 'rea',
					note: 'Runs most other Horizon calls.'
				},
				{
					id: 'european-court-of-auditors',
					note: 'Audits how the money was spent.'
				}
			]
		},
		{
			id: 'rights',
			title: 'My rights were violated',
			steps: [
				{
					id: 'national-courts',
					note: 'Start here: national courts apply EU law and the Convention.'
				},
				{
					id: 'cjeu',
					note: "Answers national courts' questions on EU law; you can't apply directly."
				},
				{
					id: 'ecthr',
					note: 'Take a case here once national remedies are exhausted.'
				},
				{
					id: 'european-ombudsman',
					note: 'Complain here about maladministration by an EU body.'
				},
				{
					id: 'un-human-rights-council',
					note: "Reviews states' records; it doesn't decide individual cases."
				}
			]
		},
		{
			id: 'asylum',
			title: 'Seeking asylum in Europe',
			steps: [
				{
					id: 'national-border-police',
					note: 'Checks people at the external border.'
				},
				{
					id: 'frontex',
					note: "Supports national border guards; it doesn't decide asylum claims."
				},
				{
					id: 'euaa',
					note: 'Helps national authorities process claims consistently.'
				},
				{
					id: 'unhcr',
					note: 'Watches over the Refugee Convention and helps refugees.'
				},
				{
					id: 'cjeu',
					note: 'Interprets EU asylum law when national courts ask.'
				}
			]
		},
		{
			id: 'prosecution',
			title: 'Who prosecutes what',
			steps: [
				{
					id: 'icc',
					note: 'Tries individuals for genocide, war crimes and crimes against humanity.'
				},
				{
					id: 'icj',
					note: 'Settles disputes between states; it tries no one.'
				},
				{
					id: 'eppo',
					note: 'Prosecutes fraud against the EU budget in participating states.'
				},
				{
					id: 'olaf',
					note: 'Investigates EU-budget fraud administratively and passes cases on.'
				},
				{
					id: 'eurojust',
					note: 'Helps national prosecutors work together across borders.'
				}
			]
		}
	]
};
