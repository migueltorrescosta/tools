import type { Context } from '../types';

export const portugal: Context = {
	id: 'portugal',
	title: 'Portugal',
	summary:
		'The Portuguese state: sovereign organs, courts, borders and migration, work and social security, tax, research funding, regulators and local government.',
	asOf: '2026-11-13',
	institutions: [
		{
			id: 'president-of-the-republic',
			name: 'President of the Republic',
			officialName: 'Presidente da República',
			acronym: 'PR',
			kind: 'executive',
			level: 'national',
			founded: '1976',
			seat: 'Lisbon (Palácio de Belém)',
			url: 'https://www.presidencia.pt/',
			summary:
				'Directly elected head of state; António José Seguro took office on 9 March 2026, succeeding Marcelo Rebelo de Sousa.',
			responsibilities: [
				"Appoints the Prime Minister and, on PM's proposal, ministers",
				'Promulgates or vetoes laws and decree-laws',
				'Requests preventive constitutional review from the Constitutional Court',
				'Can dissolve parliament and call elections',
				'Commander-in-chief of the armed forces',
				'Appoints the Attorney General and Court of Auditors president on government proposal'
			],
			obligations: [
				'Constitution (CRP) arts. 120-140',
				'Five-year term, max two consecutive',
				'Must hear Council of State before dissolution'
			],
			accountableTo: [
				'Electorate',
				'assembleia-da-republica (impeachment-type proceedings via STJ)'
			],
			overlaps: [],
			sources: [
				'https://rr.pt/noticia/politica/2026/03/09/antonio-jose-seguro-toma-posse-como-presidente-da-republica/462253/',
				'https://www.presidencia.pt/',
				'https://www.parlamento.pt/Legislacao/Paginas/ConstituicaoRepublicaPortuguesa.aspx'
			]
		},
		{
			id: 'assembleia-da-republica',
			name: 'Assembly of the Republic',
			officialName: 'Assembleia da República',
			acronym: 'AR',
			kind: 'legislature',
			level: 'national',
			founded: '1976',
			seat: 'Lisbon (Palácio de São Bento)',
			url: 'https://www.parlamento.pt/',
			summary: 'Unicameral national parliament of 230 deputies (XVII legislature since June 2025).',
			responsibilities: [
				'Passes laws, state budget and authorises government decree-laws',
				'Scrutinises and can censure the Government',
				'Elects 10 of 13 Constitutional Court judges and the Ombudsman',
				'Elects members of CSM, ERC and Council of State'
			],
			obligations: [
				'Constitution (CRP) arts. 147-181',
				'Four-year legislature',
				'Reserved competence on rights, courts, elections'
			],
			accountableTo: ['Electorate'],
			overlaps: [],
			sources: [
				'https://www.parlamento.pt/',
				'https://www.parlamento.pt/Legislacao/Paginas/ConstituicaoRepublicaPortuguesa.aspx'
			]
		},
		{
			id: 'portugal-government',
			name: 'Government of Portugal (XXV Constitutional Government)',
			officialName: 'Governo da República Portuguesa',
			kind: 'executive',
			level: 'national',
			founded: '1976',
			seat: 'Lisbon',
			url: 'https://www.portugal.gov.pt/',
			summary:
				'Executive led by PM Luís Montenegro (PSD/CDS-PP minority) since June 2025, with 16 ministries.',
			responsibilities: [
				'Conducts general policy and runs public administration',
				'Issues decree-laws and regulations',
				'Proposes state budget; manages EU funds through its agencies',
				"Proposes appointments of PGR, regulators' boards and senior officials"
			],
			obligations: [
				'Constitution (CRP) arts. 182-201',
				'Politically responsible to AR and President',
				'Budget framework law; EU fiscal rules'
			],
			accountableTo: ['assembleia-da-republica', 'president-of-the-republic'],
			overlaps: [],
			sources: [
				'https://www.portugal.gov.pt/pt/gc25',
				'https://en.wikipedia.org/wiki/XXV_Constitutional_Government_of_Portugal'
			]
		},
		{
			id: 'council-of-state',
			name: 'Council of State',
			officialName: 'Conselho de Estado',
			acronym: 'CE',
			kind: 'executive',
			level: 'national',
			founded: '1982',
			seat: 'Lisbon (Palácio de Belém)',
			url: 'https://www.presidencia.pt/presidente-da-republica/as-funcoes/conselho-de-estado/',
			summary: 'Political advisory body of the President, presided by the President.',
			responsibilities: [
				'Advises on dissolution of AR and regional assemblies',
				'Advises on dismissal of the Government',
				'Advises on declarations of war, peace, state of emergency'
			],
			obligations: [
				'Constitution (CRP) arts. 141-146',
				'Opinions are mandatory to seek but not binding'
			],
			accountableTo: ['president-of-the-republic'],
			overlaps: [],
			sources: [
				'https://www.presidencia.pt/presidente-da-republica/as-funcoes/conselho-de-estado/',
				'https://www.parlamento.pt/Legislacao/Paginas/ConstituicaoRepublicaPortuguesa.aspx'
			]
		},
		{
			id: 'ministry-finance',
			name: 'Ministry of Finance',
			officialName: 'Ministério das Finanças',
			acronym: 'MF',
			kind: 'executive',
			level: 'national',
			founded: '1801',
			seat: 'Lisbon',
			url: 'https://www.portugal.gov.pt/pt/gc25/area-de-governo/financas',
			summary:
				'Ministry of State and Finance (Joaquim Miranda Sarmento); budget, tax and public finances.',
			responsibilities: [
				'Prepares the State Budget',
				'Oversees Autoridade Tributária and IGF',
				'Shareholder function for state companies'
			],
			obligations: ['Budget framework law (LEO)', 'EU Stability and Growth Pact reporting'],
			accountableTo: ['portugal-government'],
			overlaps: [],
			sources: ['https://www.portugal.gov.pt/pt/gc25/area-de-governo/financas']
		},
		{
			id: 'ministry-justice',
			name: 'Ministry of Justice',
			officialName: 'Ministério da Justiça',
			acronym: 'MJ',
			kind: 'executive',
			level: 'national',
			founded: '1821',
			seat: 'Lisbon',
			url: 'https://justica.gov.pt/',
			summary:
				'Ministry (Rita Júdice) responsible for court administration resources, registries, PJ and prisons.',
			responsibilities: [
				'Oversees IRN, PJ, DGAJ, prisons and Julgados de Paz network',
				'Court infrastructure and IT (Citius)',
				'Promotes alternative dispute resolution'
			],
			obligations: ['Must respect judicial independence (CRP art. 203)'],
			accountableTo: ['portugal-government'],
			overlaps: [],
			sources: ['https://justica.gov.pt/', 'https://www.portugal.gov.pt/pt/gc25']
		},
		{
			id: 'ministry-internal-administration',
			name: 'Ministry of Internal Administration',
			officialName: 'Ministério da Administração Interna',
			acronym: 'MAI',
			kind: 'executive',
			level: 'national',
			founded: '1834',
			seat: 'Lisbon',
			url: 'https://www.portugal.gov.pt/pt/gc25/area-de-governo/administracao-interna',
			summary:
				'Ministry for internal security, police and civil protection; Luís Neves (ex-PJ director) minister since 23 Feb 2026.',
			responsibilities: [
				'Oversees PSP (incl. UNEF) and GNR',
				'Civil protection (ANEPC)',
				'Elections administration'
			],
			obligations: ['Internal Security Law (Lei 53/2008)'],
			accountableTo: ['portugal-government'],
			overlaps: [],
			sources: [
				'https://eco.sapo.pt/2026/02/23/novo-ministro-da-administracao-interna-ja-tomou-posse/',
				'https://www.portugal.gov.pt/pt/gc25/area-de-governo/administracao-interna'
			]
		},
		{
			id: 'ministry-labour-social-security',
			name: 'Ministry of Labour, Solidarity and Social Security',
			officialName: 'Ministério do Trabalho, Solidariedade e Segurança Social',
			acronym: 'MTSSS',
			kind: 'executive',
			level: 'national',
			founded: '1916',
			seat: 'Lisbon',
			url: 'https://www.portugal.gov.pt/pt/gc25/area-de-governo/trabalho-solidariedade-e-seguranca-social',
			summary:
				'Ministry (Maria do Rosário Palma Ramalho) for employment, labour law and social security.',
			responsibilities: [
				'Oversees IEFP, ISS, IGFSS, ACT, DGERT, CITE',
				'Labour law reform (Trabalho XXI package)',
				'Social Security Budget'
			],
			obligations: ['Social Security framework law (Lei 4/2007)'],
			accountableTo: ['portugal-government'],
			overlaps: [],
			sources: [
				'https://www.portugal.gov.pt/pt/gc25/area-de-governo/trabalho-solidariedade-e-seguranca-social'
			]
		},
		{
			id: 'ministry-education-science-innovation',
			name: 'Ministry of Education, Science and Innovation',
			officialName: 'Ministério da Educação, Ciência e Inovação',
			acronym: 'MECI',
			kind: 'executive',
			level: 'national',
			founded: '2024',
			seat: 'Lisbon',
			url: 'https://www.portugal.gov.pt/pt/gc25/area-de-governo/educacao-ciencia-e-inovacao',
			summary:
				'Ministry (Fernando Alexandre) covering schools, higher education and research funding via AI2.',
			responsibilities: [
				'Oversees AI2 (merged FCT + ANI)',
				'Higher education and schools policy',
				'National science and innovation system (SNCTI)'
			],
			obligations: ['Decree-Law 210/2026 (SNCTI regime)'],
			accountableTo: ['portugal-government'],
			overlaps: [],
			sources: [
				'https://www.portugal.gov.pt/pt/gc25/area-de-governo/educacao-ciencia-e-inovacao',
				'https://cms.law/en/prt/news-information/new-legal-framework-for-the-national-science-technology-and-innovation-system-decree-law-no.-210-2026-of-3-november'
			]
		},
		{
			id: 'ministry-economy-cohesion',
			name: 'Ministry of Economy and Territorial Cohesion',
			officialName: 'Ministério da Economia e da Coesão Territorial',
			acronym: 'MECT',
			kind: 'executive',
			level: 'national',
			founded: '2025',
			seat: 'Lisbon',
			url: 'https://www.portugal.gov.pt/pt/gc25/area-de-governo/economia-e-coesao-territorial',
			summary:
				'Ministry (Manuel Castro Almeida) merging economy with EU cohesion funds and regional policy.',
			responsibilities: [
				'Oversees AD&C, Recuperar Portugal, CCDRs',
				'Coordinates Portugal 2030 and PRR',
				'Decentralisation to municipalities'
			],
			obligations: ['EU Common Provisions Regulation (2021/1060)', 'RRF Regulation (2021/241)'],
			accountableTo: ['portugal-government'],
			overlaps: [],
			sources: [
				'https://www.portugal.gov.pt/pt/gc25/area-de-governo/economia-e-coesao-territorial',
				'https://www.portugal.gov.pt/pt/gc25'
			]
		},
		{
			id: 'ministry-state-reform',
			name: 'Ministry Adjunct and for State Reform',
			officialName: 'Ministério Adjunto e da Reforma do Estado',
			acronym: 'MARE',
			kind: 'executive',
			level: 'national',
			founded: '2025',
			seat: 'Lisbon',
			url: 'https://www.portugal.gov.pt/pt/gc25/area-de-governo/reforma-do-estado',
			summary:
				'New ministry (Gonçalo Saraiva Matias) for administrative simplification and digital state.',
			responsibilities: [
				'Oversees ARTE (ex-AMA) and the State CTO',
				'Public administration reform and simplification',
				'Digital public services strategy'
			],
			obligations: ['Decree-Law 96/2025 (ARTE)'],
			accountableTo: ['portugal-government'],
			overlaps: [],
			sources: [
				'https://eco.sapo.pt/2025/07/31/governo-cria-agencia-para-a-reforma-tecnologica-e-o-cargo-de-diretor-de-sistemas-do-estado/',
				'https://www.portugal.gov.pt/pt/gc25'
			]
		},
		{
			id: 'constitutional-court',
			name: 'Constitutional Court',
			officialName: 'Tribunal Constitucional',
			acronym: 'TC',
			kind: 'court',
			level: 'national',
			founded: '1983',
			seat: 'Lisbon',
			url: 'https://www.tribunalconstitucional.pt/',
			summary:
				'Court with final say on constitutionality; struck down nationality-loss penal provisions twice (Dec 2025, 2026).',
			responsibilities: [
				'Preventive and successive review of constitutionality',
				'Concrete review on appeal from any court',
				'Electoral and political-party matters',
				'Receives asset/incompatibility declarations (via Entidade para a Transparência)'
			],
			obligations: [
				'Constitution (CRP) arts. 221-224',
				'Lei 28/82 (LTC)',
				'Nine-year non-renewable judge terms'
			],
			accountableTo: ['assembleia-da-republica (elects 10 of 13 judges)'],
			overlaps: [],
			sources: [
				'https://www.tribunalconstitucional.pt/',
				'https://observador.pt/2026/05/03/seguro-promulga-lei-da-nacionalidade-mas-critica-nao-ter-tido-maior-consenso/',
				'https://www.parlamento.pt/Legislacao/Paginas/ConstituicaoRepublicaPortuguesa.aspx'
			]
		},
		{
			id: 'supreme-court-of-justice',
			name: 'Supreme Court of Justice',
			officialName: 'Supremo Tribunal de Justiça',
			acronym: 'STJ',
			kind: 'court',
			level: 'national',
			founded: '1833',
			seat: 'Lisbon',
			url: 'https://www.stj.pt/',
			summary: 'Highest court of the civil and criminal judicial order.',
			responsibilities: [
				'Hears appeals on points of law from the Relação courts',
				'Unifies case law (uniform jurisprudence rulings)',
				'Tries cases against top officeholders'
			],
			obligations: [
				'Constitution (CRP) art. 210',
				'Lei 62/2013 (LOSJ)',
				'Bound by CJEU preliminary rulings on EU law'
			],
			accountableTo: ['superior-council-magistracy'],
			overlaps: [],
			sources: [
				'https://www.stj.pt/',
				'https://diariodarepublica.pt/dr/legislacao-consolidada/lei/2013-34580575'
			]
		},
		{
			id: 'courts-of-appeal',
			name: 'Courts of Appeal (Relação)',
			officialName: 'Tribunais da Relação',
			acronym: 'TR',
			kind: 'court',
			level: 'regional',
			founded: '1833',
			seat: 'Lisbon, Porto, Coimbra, Évora, Guimarães',
			url: 'https://www.tribunais.org.pt/',
			summary: 'Five second-instance courts of the judicial order.',
			responsibilities: [
				'Rehear facts and law on appeal from comarca courts',
				'First instance for some cases against judges/prosecutors'
			],
			obligations: ['Lei 62/2013 (LOSJ)', 'Civil and Criminal Procedure Codes'],
			accountableTo: ['superior-council-magistracy'],
			overlaps: [],
			sources: [
				'https://www.tribunais.org.pt/',
				'https://diariodarepublica.pt/dr/legislacao-consolidada/lei/2013-34580575'
			]
		},
		{
			id: 'comarca-courts',
			name: 'District (Comarca) Courts',
			officialName: 'Tribunais Judiciais de Comarca',
			kind: 'court',
			level: 'local',
			founded: '2014',
			seat: '23 comarcas nationwide',
			url: 'https://www.tribunais.org.pt/',
			summary:
				'First-instance civil, criminal, family, labour and commercial courts in 23 comarcas.',
			responsibilities: [
				'Civil, criminal, family and minors cases',
				'Labour courts (dismissal, workplace accidents)',
				'Commerce, insolvency and execution proceedings'
			],
			obligations: [
				'Lei 62/2013 (LOSJ)',
				'Procedural codes',
				'Must refer EU-law questions to CJEU when required'
			],
			accountableTo: ['superior-council-magistracy'],
			overlaps: [],
			sources: [
				'https://www.tribunais.org.pt/',
				'https://diariodarepublica.pt/dr/legislacao-consolidada/lei/2013-34580575'
			]
		},
		{
			id: 'supreme-administrative-court',
			name: 'Supreme Administrative Court',
			officialName: 'Supremo Tribunal Administrativo',
			acronym: 'STA',
			kind: 'court',
			level: 'national',
			founded: '1870',
			seat: 'Lisbon',
			url: 'https://www.stadministrativo.pt/',
			summary: 'Highest court of the administrative and tax order.',
			responsibilities: [
				'Appeals on law from the TCAs',
				'Exceptional review (revista) of administrative and tax rulings',
				'Cases against Government acts'
			],
			obligations: [
				'Constitution (CRP) art. 212',
				'ETAF (Lei 13/2002)',
				'CPTA and CPPT procedure codes'
			],
			accountableTo: ['CSTAF (Conselho Superior dos Tribunais Administrativos e Fiscais)'],
			overlaps: [],
			sources: [
				'https://www.stadministrativo.pt/',
				'https://diariodarepublica.pt/dr/legislacao-consolidada/lei/2002-34580675'
			]
		},
		{
			id: 'central-administrative-courts',
			name: 'Central Administrative Courts (North and South)',
			officialName: 'Tribunais Centrais Administrativos (Norte e Sul)',
			acronym: 'TCA',
			kind: 'court',
			level: 'regional',
			founded: '1997',
			seat: 'Porto, Lisbon',
			url: 'https://www.tcanorte.pt/',
			summary: 'Second-instance administrative and tax courts.',
			responsibilities: [
				'Hear appeals from TAF rulings on facts and law',
				'Some first-instance cases against senior officials'
			],
			obligations: ['ETAF (Lei 13/2002)'],
			accountableTo: ['CSTAF (Conselho Superior dos Tribunais Administrativos e Fiscais)'],
			overlaps: [],
			sources: [
				'https://www.tcanorte.pt/',
				'https://www.tcasul.pt/',
				'https://diariodarepublica.pt/dr/legislacao-consolidada/lei/2002-34580675'
			]
		},
		{
			id: 'administrative-tax-courts',
			name: 'Administrative and Tax Courts',
			officialName: 'Tribunais Administrativos e Fiscais',
			acronym: 'TAF',
			kind: 'court',
			level: 'local',
			founded: '1984',
			seat: '16 seats nationwide',
			url: 'https://www.tribunais.org.pt/',
			summary: 'First-instance courts for disputes with public bodies and tax disputes.',
			responsibilities: [
				'Challenges to administrative acts (e.g. AIMA delays, licensing)',
				'Tax impugnations against AT',
				'Public procurement and state liability'
			],
			obligations: ['ETAF (Lei 13/2002)', 'CPTA, CPPT'],
			accountableTo: ['CSTAF (Conselho Superior dos Tribunais Administrativos e Fiscais)'],
			overlaps: [
				{
					with: 'caad',
					note: 'Tax disputes up to EUR 10M can go to CAAD arbitration instead of TAF; taxpayer chooses, decision then largely final.'
				}
			],
			sources: [
				'https://www.tribunais.org.pt/',
				'https://diariodarepublica.pt/dr/legislacao-consolidada/lei/2002-34580675',
				'https://observador.pt/2026/07/23/governo-quer-redistribuir-processos-da-aima-por-tribunais-de-todo-o-pais-apos-chumbar-proposta-igual-da-il-em-fevereiro/'
			]
		},
		{
			id: 'court-of-auditors',
			name: 'Court of Auditors',
			officialName: 'Tribunal de Contas',
			acronym: 'TdC',
			kind: 'court',
			level: 'national',
			founded: '1849',
			seat: 'Lisbon (sections in Azores, Madeira)',
			url: 'https://www.tcontas.pt/',
			summary: 'Supreme external audit body and court for public spending.',
			responsibilities: [
				'Prior approval (visto) of major public contracts',
				'Audits State accounts, PRR and EU funds',
				'Financial liability trials of public managers'
			],
			obligations: [
				'Constitution (CRP) art. 214',
				'Lei 98/97 (LOPTC)',
				'Opinion on Conta Geral do Estado to AR'
			],
			accountableTo: ['assembleia-da-republica'],
			overlaps: [
				{
					with: 'igf',
					note: "Both audit public money: TdC is an independent court (external control, can sanction); IGF is the Government's internal inspectorate and EU-funds audit authority. TdC can use IGF work; overlap on PRR/EU-fund audits."
				},
				{
					with: 'european-court-of-auditors',
					note: 'Both audit EU funds spent in Portugal; ECA audits for the EU budget, TdC for national accountability; they cooperate under TFEU art. 287.'
				}
			],
			sources: [
				'https://www.tcontas.pt/',
				'https://www.parlamento.pt/Legislacao/Paginas/ConstituicaoRepublicaPortuguesa.aspx'
			]
		},
		{
			id: 'julgados-de-paz',
			name: 'Justices of the Peace',
			officialName: 'Julgados de Paz',
			acronym: 'JP',
			kind: 'court',
			level: 'local',
			founded: '2001',
			seat: '~25 municipalities/groupings',
			url: 'https://www.conselhodosjulgadosdepaz.com.pt/',
			summary:
				'Low-cost small-claims courts favouring mediation, for civil claims up to EUR 15,000.',
			responsibilities: [
				'Neighbour, condominium, tenancy and consumer disputes',
				'Mediation before trial',
				'Fixed fee of EUR 70'
			],
			obligations: ['Lei 78/2001 (as amended by Lei 54/2013)'],
			accountableTo: ['Conselho dos Julgados de Paz', 'assembleia-da-republica'],
			overlaps: [
				{
					with: 'comarca-courts',
					note: 'Concurrent jurisdiction for small civil claims; claimant chooses. Appeals over EUR 2,500 go to the comarca court.'
				}
			],
			sources: [
				'https://www.conselhodosjulgadosdepaz.com.pt/',
				'https://dgpj.justica.gov.pt/Resolucao-de-Litigios/Julgados-de-Paz'
			]
		},
		{
			id: 'caad',
			name: 'Administrative Arbitration Centre',
			officialName: 'Centro de Arbitragem Administrativa',
			acronym: 'CAAD',
			kind: 'court',
			level: 'national',
			founded: '2009',
			seat: 'Lisbon',
			url: 'https://www.caad.org.pt/',
			summary: 'State-authorised arbitration centre for tax and administrative disputes.',
			responsibilities: [
				'Tax arbitration against AT (RJAT)',
				'Public employment and administrative contract disputes',
				'Decisions within ~6 months'
			],
			obligations: [
				'Decree-Law 10/2011 (RJAT)',
				'Arbitrators must be independent; decisions published'
			],
			accountableTo: ['ministry-justice'],
			overlaps: [],
			sources: ['https://www.caad.org.pt/']
		},
		{
			id: 'public-prosecution',
			name: "Public Prosecution Service / Attorney General's Office",
			officialName: 'Ministério Público / Procuradoria-Geral da República',
			acronym: 'MP / PGR',
			kind: 'agency',
			level: 'national',
			founded: '1976',
			seat: 'Lisbon',
			url: 'https://www.ministeriopublico.pt/',
			summary: 'Autonomous prosecution magistracy headed by the Attorney General (PGR).',
			responsibilities: [
				'Directs criminal investigations (PJ, PSP, GNR act under it)',
				'Represents the State and minors in court',
				'Defends legality; can request TC review'
			],
			obligations: [
				'Constitution (CRP) arts. 219-220',
				'Estatuto do MP (Lei 68/2019)',
				'Six-year PGR term'
			],
			accountableTo: ['Conselho Superior do Ministério Público', 'president-of-the-republic'],
			overlaps: [
				{
					with: 'eppo',
					note: 'EPPO investigates fraud against the EU budget in Portugal via European Delegated Prosecutors; MP keeps other crimes and hands over EU-fraud cases.'
				}
			],
			sources: [
				'https://www.ministeriopublico.pt/',
				'https://www.ministeriopublico.pt/pagina/procuradoria-geral-da-republica'
			]
		},
		{
			id: 'superior-council-magistracy',
			name: 'High Council for the Judiciary',
			officialName: 'Conselho Superior da Magistratura',
			acronym: 'CSM',
			kind: 'agency',
			level: 'national',
			founded: '1976',
			seat: 'Lisbon',
			url: 'https://www.csm.org.pt/',
			summary: 'Body that appoints, promotes, inspects and disciplines judicial-order judges.',
			responsibilities: [
				'Appoints and moves judges of comarca, Relação and STJ',
				'Judicial inspections and discipline',
				'Court management guidance'
			],
			obligations: ['Constitution (CRP) art. 218', 'Estatuto dos Magistrados Judiciais'],
			accountableTo: [
				'assembleia-da-republica (elects 7 members)',
				'president-of-the-republic (appoints 2)'
			],
			overlaps: [],
			sources: [
				'https://www.csm.org.pt/',
				'https://www.parlamento.pt/Legislacao/Paginas/ConstituicaoRepublicaPortuguesa.aspx'
			]
		},
		{
			id: 'bar-association',
			name: 'Portuguese Bar Association',
			officialName: 'Ordem dos Advogados',
			acronym: 'OA',
			kind: 'agency',
			level: 'national',
			founded: '1926',
			seat: 'Lisbon',
			url: 'https://portal.oa.pt/',
			summary: 'Public professional association regulating lawyers.',
			responsibilities: [
				'Admission and discipline of lawyers',
				'Organises legal aid appointments with ISS',
				'Defends rule of law and access to justice'
			],
			obligations: [
				'Estatuto da OA (Lei 145/2015)',
				'Lei 2/2013 on public professional associations'
			],
			accountableTo: ['assembleia-da-republica (statute by law)'],
			overlaps: [],
			sources: ['https://portal.oa.pt/']
		},
		{
			id: 'ombudsman',
			name: 'Ombudsman',
			officialName: 'Provedor de Justiça',
			kind: 'agency',
			level: 'national',
			founded: '1975',
			seat: 'Lisbon',
			url: 'https://www.provedor-jus.pt/',
			summary:
				'Independent body handling free complaints against public administration; also national preventive mechanism and NHRI.',
			responsibilities: [
				'Investigates complaints (e.g. AIMA, Segurança Social, AT)',
				'Issues non-binding recommendations',
				'Can ask TC for review of constitutionality',
				'National Preventive Mechanism against torture'
			],
			obligations: ['Constitution (CRP) art. 23', 'Lei 9/91 (Estatuto)', 'Annual report to AR'],
			accountableTo: ['assembleia-da-republica'],
			overlaps: [
				{
					with: 'administrative-tax-courts',
					note: 'Both review administrative conduct; Ombudsman is free and informal but non-binding, courts are binding. A complaint does not suspend court deadlines.'
				}
			],
			sources: [
				'https://www.provedor-jus.pt/',
				'https://www.parlamento.pt/Legislacao/Paginas/ConstituicaoRepublicaPortuguesa.aspx'
			]
		},
		{
			id: 'aima',
			name: 'Agency for Integration, Migration and Asylum',
			officialName: 'Agência para a Integração, Migrações e Asilo',
			acronym: 'AIMA',
			kind: 'agency',
			level: 'national',
			founded: '2023',
			seat: 'Lisbon',
			url: 'https://aima.gov.pt/',
			summary:
				'Administrative migration agency created on 29 Oct 2023 when SEF was abolished; handles residence permits and asylum decisions.',
			responsibilities: [
				'Residence permits, renewals and family reunification',
				'Asylum and international protection decisions',
				'Integration policy and migrant support centres'
			],
			obligations: [
				'Decree-Law 41/2023',
				'Foreigners Law (Lei 23/2007, amended 2025)',
				'EU asylum acquis and new Pact on Migration and Asylum'
			],
			accountableTo: ['ministry-presidency', 'administrative-tax-courts'],
			overlaps: [
				{
					with: 'psp-unef',
					note: 'Since Aug 2025 removals, readmission and returns moved from AIMA to PSP/UNEF (AIMA abolished its UARR unit Oct 2025). AIMA keeps permits and asylum; UNEF checks stays and enforces.'
				},
				{
					with: 'irn',
					note: 'IRN handled some residence-permit renewals for AIMA; government planned to bring in-person renewals back to AIMA.'
				},
				{
					with: 'iss',
					note: 'Reception of asylum seekers is moving from AIMA to Segurança Social (announced June 2026).'
				}
			],
			sources: [
				'https://aima.gov.pt/',
				'https://diariodarepublica.pt/dr/detalhe/decreto-lei/41-2023-213498802',
				'https://diariodarepublica.pt/dr/detalhe/deliberacao/1543-2025-985743531',
				'https://rr.pt/noticia/pais/2026/06/01/seguranca-social-vai-ser-unica-responsavel-pelo-acolhimento-de-requerentes-de-asilo/472965/'
			]
		},
		{
			id: 'psp',
			name: 'Public Security Police',
			officialName: 'Polícia de Segurança Pública',
			acronym: 'PSP',
			kind: 'agency',
			level: 'national',
			founded: '1867',
			seat: 'Lisbon',
			url: 'https://www.psp.pt/',
			summary:
				'Civilian national police for urban areas; since 2023 responsible for air border control.',
			responsibilities: [
				'Public order and policing in cities',
				'Air border control at airports (via UNEF)',
				'Firearms and private-security licensing'
			],
			obligations: [
				'Lei 53/2007 (PSP organic law)',
				'Internal Security Law',
				'Schengen Borders Code'
			],
			accountableTo: [
				'ministry-internal-administration',
				'public-prosecution (in criminal investigations)'
			],
			overlaps: [
				{
					with: 'gnr',
					note: 'Territorial split: PSP covers urban areas, GNR rural areas and most of the territory; borders split by type (air = PSP, sea and land = GNR).'
				},
				{
					with: 'pj',
					note: 'PSP investigates minor and mid-level crime; PJ has reserved competence for serious/organised crime, including migrant smuggling and trafficking.'
				}
			],
			sources: [
				'https://www.psp.pt/',
				'https://diariodarepublica.pt/dr/detalhe/decreto-lei/41-2023-213498802'
			]
		},
		{
			id: 'psp-unef',
			name: 'National Foreigners and Borders Unit (PSP)',
			officialName: 'Unidade Nacional de Estrangeiros e Fronteiras',
			acronym: 'UNEF',
			kind: 'agency',
			level: 'national',
			founded: '2025',
			seat: 'Lisbon',
			url: 'https://www.psp.pt/',
			summary:
				"PSP unit ('mini-SEF') operating since 21 Aug 2025 with ~1,200 officers for airport borders, stay controls and returns.",
			responsibilities: [
				'Air border checks at Lisbon, Porto, Faro, Azores, Madeira airports',
				"Inspecting foreigners' stay in Portugal",
				'Removal, readmission and return operations (taken from AIMA)',
				'Operates EU Entry/Exit System at airports (since Oct 2025)'
			],
			obligations: ['Lei 55-C/2025', 'Schengen Borders Code', 'EU Return Directive'],
			accountableTo: ['psp', 'ministry-internal-administration'],
			overlaps: [
				{
					with: 'aima',
					note: 'UNEF enforces (returns, stay checks) while AIMA decides permits; the hand-over of ~100k pending return files caused confusion over who to contact.'
				}
			],
			sources: [
				'https://diariodarepublica.pt/dr/detalhe/lei/55-c-2025-925904931',
				'https://www.rtp.pt/noticias/pais/unidade-nacional-de-estrangeiros-e-fronteiras-da-psp-entra-em-vigor-com-1200-policias_n1678114',
				'https://eco.sapo.pt/2025/08/29/mini-sef-herda-100-mil-processos-em-atraso-para-expulsar-imigrantes/'
			]
		},
		{
			id: 'gnr',
			name: 'National Republican Guard',
			officialName: 'Guarda Nacional Republicana',
			acronym: 'GNR',
			kind: 'agency',
			level: 'national',
			founded: '1911',
			seat: 'Lisbon',
			url: 'https://www.gnr.pt/',
			summary:
				'Gendarmerie-type security force for rural areas; since 2023 controls sea and land borders.',
			responsibilities: [
				'Policing outside main urban areas',
				'Sea and land border control (UCC coastal unit)',
				'Road traffic, environment (SEPNA), customs-fiscal (UAF)'
			],
			obligations: ['Lei 63/2007 (GNR organic law)', 'Schengen Borders Code'],
			accountableTo: [
				'ministry-internal-administration',
				'Ministry of National Defence (military status)'
			],
			overlaps: [
				{
					with: 'psp',
					note: 'Parallel general police forces with geographic split; GNR has sea/land borders, PSP air borders.'
				}
			],
			sources: [
				'https://www.gnr.pt/',
				'https://diariodarepublica.pt/dr/detalhe/decreto-lei/41-2023-213498802'
			]
		},
		{
			id: 'pj',
			name: 'Criminal Investigation Police',
			officialName: 'Polícia Judiciária',
			acronym: 'PJ',
			kind: 'agency',
			level: 'national',
			founded: '1945',
			seat: 'Lisbon',
			url: 'https://www.policiajudiciaria.pt/',
			summary:
				"Criminal police for serious and organised crime; took over SEF's criminal investigation powers in 2023.",
			responsibilities: [
				'Serious, organised, economic and cyber crime',
				'Human trafficking and migrant smuggling (ex-SEF)',
				'Interpol/Europol national unit'
			],
			obligations: [
				'Lei 37/2008 (PJ organic law)',
				'Criminal Investigation Organisation Law (LOIC, Lei 49/2008)'
			],
			accountableTo: ['ministry-justice', 'public-prosecution'],
			overlaps: [
				{
					with: 'psp',
					note: 'LOIC reserves serious crime to PJ; MP can delegate other investigations to PSP/GNR.'
				}
			],
			sources: [
				'https://www.policiajudiciaria.pt/',
				'https://diariodarepublica.pt/dr/detalhe/decreto-lei/41-2023-213498802'
			]
		},
		{
			id: 'irn',
			name: 'Registries and Notary Institute',
			officialName: 'Instituto dos Registos e do Notariado',
			acronym: 'IRN',
			kind: 'agency',
			level: 'national',
			founded: '2007',
			seat: 'Lisbon',
			url: 'https://irn.justica.gov.pt/',
			summary:
				'Runs civil, land, commercial and vehicle registries (Conservatórias), Cartão de Cidadão, passports and nationality.',
			responsibilities: [
				'Cartão de Cidadão and passports (took ex-SEF passport role)',
				'Nationality applications (new law promulgated May 2026)',
				'Birth, marriage, property, company and car registration'
			],
			obligations: ['Civil Registration Code', 'Nationality Law (Lei 37/81, as amended 2026)'],
			accountableTo: ['ministry-justice'],
			overlaps: [
				{
					with: 'aima',
					note: 'Residence-permit renewal appointments have been run partly at IRN desks for AIMA.'
				}
			],
			sources: [
				'https://irn.justica.gov.pt/',
				'https://observador.pt/2026/05/03/seguro-promulga-lei-da-nacionalidade-mas-critica-nao-ter-tido-maior-consenso/',
				'https://diariodarepublica.pt/dr/detalhe/decreto-lei/41-2023-213498802'
			]
		},
		{
			id: 'iefp',
			name: 'Institute for Employment and Vocational Training',
			officialName: 'Instituto do Emprego e Formação Profissional',
			acronym: 'IEFP',
			kind: 'agency',
			level: 'national',
			founded: '1979',
			seat: 'Lisbon',
			url: 'https://www.iefp.pt/',
			summary: 'Public employment service: job-seeker registration, placement and training.',
			responsibilities: [
				'Registers unemployed and job seekers',
				'Vocational training and hiring incentives',
				'EURES and recognition services for migrants'
			],
			obligations: [
				'Decree-Law 143/2012 (organic law)',
				'Must verify active job search of benefit recipients'
			],
			accountableTo: ['ministry-labour-social-security'],
			overlaps: [
				{
					with: 'iss',
					note: 'Unemployment benefit is paid by Segurança Social (ISS) but requires IEFP registration; the claim is filed with ISS, job-search obligations are monitored by IEFP.'
				}
			],
			sources: ['https://www.iefp.pt/']
		},
		{
			id: 'iss',
			name: 'Social Security Institute',
			officialName: 'Instituto da Segurança Social',
			acronym: 'ISS',
			kind: 'agency',
			level: 'national',
			founded: '2001',
			seat: 'Lisbon (18 district centres)',
			url: 'https://www.seg-social.pt/',
			summary:
				'Pays social benefits and pensions and registers contributors; restructured by Decree-Law 63/2026.',
			responsibilities: [
				'Unemployment, sickness, parental benefits and pensions (Centro Nacional de Pensões)',
				'Contributor registration (NISS)',
				'Social action; asylum-seeker reception (being transferred from AIMA)',
				'Legal aid decisions'
			],
			obligations: [
				'Lei 4/2007 (Social Security framework)',
				'Decree-Law 63/2026 (new organic law)',
				'EU social security coordination (Reg. 883/2004)'
			],
			accountableTo: ['ministry-labour-social-security'],
			overlaps: [
				{
					with: 'iefp',
					note: 'See IEFP: two bodies for one unemployment claim.'
				},
				{
					with: 'igfss',
					note: 'ISS pays benefits; IGFSS manages the money and collects contribution debts.'
				}
			],
			sources: [
				'https://files.diariodarepublica.pt/1s/2026/02/04000/0002300033.pdf',
				'https://www.seg-social.pt/',
				'https://rr.pt/noticia/pais/2026/06/01/seguranca-social-vai-ser-unica-responsavel-pelo-acolhimento-de-requerentes-de-asilo/472965/'
			]
		},
		{
			id: 'igfss',
			name: 'Social Security Financial Management Institute',
			officialName: 'Instituto de Gestão Financeira da Segurança Social',
			acronym: 'IGFSS',
			kind: 'agency',
			level: 'national',
			founded: '1977',
			seat: 'Lisbon',
			url: 'https://www.seg-social.pt/',
			summary: 'Manages the Social Security Budget and enforces collection of contribution debts.',
			responsibilities: [
				'Unified financial management of Social Security funds',
				'Coercive collection of contribution debts',
				'Manages Social Security property'
			],
			obligations: ['Social Security Budget law', 'Reports to Court of Auditors'],
			accountableTo: ['ministry-labour-social-security', 'court-of-auditors'],
			overlaps: [],
			sources: [
				'https://www.gov.pt/entidades/instituto-de-gestao-financeira-da-seguranca-social',
				'https://files.diariodarepublica.pt/1s/2026/02/04000/0002300033.pdf'
			]
		},
		{
			id: 'act',
			name: 'Authority for Working Conditions',
			officialName: 'Autoridade para as Condições do Trabalho',
			acronym: 'ACT',
			kind: 'agency',
			level: 'national',
			founded: '2007',
			seat: 'Lisbon',
			url: 'https://www.act.gov.pt/',
			summary: 'Labour inspectorate enforcing labour law and workplace safety.',
			responsibilities: [
				'Inspects workplaces; fines employers',
				'Occupational health and safety enforcement',
				'Advises workers and employers; undeclared work'
			],
			obligations: ['Labour Code', 'ILO Conventions 81 and 129'],
			accountableTo: ['ministry-labour-social-security'],
			overlaps: [
				{
					with: 'cite',
					note: 'Gender-equality complaints may go to CITE (opinions, especially on dismissal of pregnant workers) or ACT (enforcement/fines).'
				}
			],
			sources: ['https://www.act.gov.pt/']
		},
		{
			id: 'dgert',
			name: 'Directorate-General for Employment and Labour Relations',
			officialName: 'Direção-Geral do Emprego e das Relações de Trabalho',
			acronym: 'DGERT',
			kind: 'agency',
			level: 'national',
			founded: '2007',
			seat: 'Lisbon',
			url: 'https://www.dgert.gov.pt/',
			summary: 'Collective bargaining registry, conciliation and training-provider certification.',
			responsibilities: [
				'Deposits and publishes collective agreements',
				'Conciliation and mediation in labour conflicts',
				'Certifies training entities'
			],
			obligations: ['Labour Code (collective bargaining)'],
			accountableTo: ['ministry-labour-social-security'],
			overlaps: [],
			sources: ['https://www.dgert.gov.pt/']
		},
		{
			id: 'cite',
			name: 'Commission for Equality in Labour and Employment',
			officialName: 'Comissão para a Igualdade no Trabalho e no Emprego',
			acronym: 'CITE',
			kind: 'agency',
			level: 'national',
			founded: '1979',
			seat: 'Lisbon',
			url: 'https://cite.gov.pt/',
			summary: 'Tripartite body promoting gender equality at work and parental rights.',
			responsibilities: [
				'Mandatory prior opinion on dismissal of pregnant/breastfeeding workers',
				'Opinions on flexible schedules for parents',
				'Equal-pay complaints'
			],
			obligations: ['Labour Code arts. 63, 57', 'EU equal treatment directives'],
			accountableTo: ['ministry-labour-social-security'],
			overlaps: [],
			sources: ['https://cite.gov.pt/']
		},
		{
			id: 'at',
			name: 'Tax and Customs Authority',
			officialName: 'Autoridade Tributária e Aduaneira',
			acronym: 'AT',
			kind: 'agency',
			level: 'national',
			founded: '2012',
			seat: 'Lisbon',
			url: 'https://www.portaldasfinancas.gov.pt/',
			summary: 'Assesses and collects taxes and customs duties; issues NIF tax numbers.',
			responsibilities: [
				'NIF issuance and IRS/IRC/IVA collection',
				'Customs at external EU border',
				'Tax enforcement and execution proceedings'
			],
			obligations: [
				'General Tax Law (LGT)',
				'EU Customs Code and VAT directive',
				'Taxpayer rights under CPPT'
			],
			accountableTo: ['ministry-finance', 'administrative-tax-courts', 'caad'],
			overlaps: [],
			sources: ['https://www.portaldasfinancas.gov.pt/']
		},
		{
			id: 'arte',
			name: 'Agency for the Technological Reform of the State (ex-AMA)',
			officialName: 'Agência para a Reforma Tecnológica do Estado',
			acronym: 'ARTE',
			kind: 'agency',
			level: 'national',
			founded: '2025',
			seat: 'Lisbon',
			url: 'https://www.arte.gov.pt/',
			summary:
				'Successor of AMA (Decree-Law 96/2025, Aug 2025); runs gov.pt, Chave Móvel Digital and Lojas do Cidadão.',
			responsibilities: [
				'gov.pt portal and Chave Móvel Digital (digital ID)',
				'Lojas do Cidadão and Espaços Cidadão network',
				'State IT/digital strategy under the State CTO'
			],
			obligations: ['Decree-Law 96/2025', 'eIDAS Regulation (EU digital identity)'],
			accountableTo: ['ministry-state-reform'],
			overlaps: [],
			sources: [
				'https://eco.sapo.pt/2025/07/31/governo-cria-agencia-para-a-reforma-tecnologica-e-o-cargo-de-diretor-de-sistemas-do-estado/',
				'https://www.arte.gov.pt/',
				'https://www.gov.pt/'
			]
		},
		{
			id: 'lojas-do-cidadao',
			name: 'Citizen Shops',
			officialName: 'Lojas do Cidadão',
			kind: 'agency',
			level: 'local',
			founded: '1999',
			seat: '~70 shops nationwide',
			url: 'https://www.gov.pt/',
			summary: 'One-stop counters housing desks of IRN, AT, Segurança Social, AIMA and utilities.',
			responsibilities: [
				'In-person access to multiple public services',
				'Cartão de Cidadão and Chave Móvel Digital activation'
			],
			obligations: ['Service-level agreements with participating bodies'],
			accountableTo: ['arte', 'municipalities (co-run Espaços Cidadão)'],
			overlaps: [],
			sources: ['https://www.gov.pt/', 'https://www.arte.gov.pt/']
		},
		{
			id: 'igf',
			name: 'Inspectorate-General of Finance',
			officialName: 'Inspeção-Geral de Finanças',
			acronym: 'IGF',
			kind: 'agency',
			level: 'national',
			founded: '1930',
			seat: 'Lisbon',
			url: 'https://www.igf.gov.pt/',
			summary: "Government's high-level financial control body and EU-funds Audit Authority.",
			responsibilities: [
				'Internal control of public finances and local authorities',
				'Audit Authority for Portugal 2030 and PRR',
				'Anti-fraud coordination service (AFCOS) with OLAF'
			],
			obligations: ['Decree-Law 96/2012', 'EU CPR art. 71 (audit authority)'],
			accountableTo: ['ministry-finance'],
			overlaps: [
				{
					with: 'court-of-auditors',
					note: 'Internal (IGF) vs external (TdC) control of the same spending; see TdC entry.'
				}
			],
			sources: ['https://www.igf.gov.pt/']
		},
		{
			id: 'ai2',
			name: 'Agency for Research and Innovation (merged FCT + ANI)',
			officialName: 'Agência para a Investigação e Inovação, E.P.E.',
			acronym: 'AI2',
			kind: 'agency',
			level: 'national',
			founded: '2025',
			seat: 'Lisbon',
			url: 'https://www.fct.pt/',
			summary:
				'Created by Decree-Law 132/2025 merging FCT and ANI; in operation since Jan 2026 with separate science and innovation funding streams.',
			responsibilities: [
				'Research grants, PhD and researcher funding (ex-FCT)',
				'Business innovation and tech-transfer support (ex-ANI)',
				'Manages Horizon Europe national contact points',
				'Five-year programme contract with the State'
			],
			obligations: [
				'Decree-Law 132/2025',
				'Decree-Law 210/2026 (SNCTI regime)',
				'EU state-aid (RDI framework)'
			],
			accountableTo: ['ministry-education-science-innovation'],
			overlaps: [],
			sources: [
				'https://www.fct.pt/en/nomeacao-do-conselho-de-administracao-da-ai2-agencia-para-a-investigacao-e-inovacao/',
				'https://portugal.gov.pt/gc25/comunicacao/comunicados/dominios-estrategicos-e-alocacao-orcamental-da-ai2-definidos-ate-outubro-apos-debate-alargado',
				'https://cms.law/en/prt/news-information/new-legal-framework-for-the-national-science-technology-and-innovation-system-decree-law-no.-210-2026-of-3-november'
			]
		},
		{
			id: 'adc',
			name: 'Agency for Development and Cohesion',
			officialName: 'Agência para o Desenvolvimento e Coesão',
			acronym: 'AD&C',
			kind: 'agency',
			level: 'national',
			founded: '2013',
			seat: 'Lisbon',
			url: 'https://www.adcoesao.pt/',
			summary:
				'Coordinates EU cohesion policy funds (Portugal 2030) and is paying/certifying authority.',
			responsibilities: [
				'Coordinates Portugal 2030 operational programmes',
				'Paying authority for ERDF, ESF+, Cohesion Fund',
				'Monitoring and evaluation of EU funds'
			],
			obligations: [
				'EU Common Provisions Regulation 2021/1060',
				'Decree-Law 5/2023 (PT2030 governance)'
			],
			accountableTo: ['ministry-economy-cohesion', 'igf', 'european-commission'],
			overlaps: [
				{
					with: 'recuperar-portugal',
					note: 'Two parallel EU-fund machines: AD&C for cohesion funds (PT2030), Recuperar Portugal for RRF (PRR); beneficiaries face separate portals and rules.'
				}
			],
			sources: ['https://www.adcoesao.pt/', 'https://portugal2030.pt/']
		},
		{
			id: 'portugal-2030',
			name: 'Portugal 2030 Partnership Agreement',
			officialName: 'Portugal 2030',
			acronym: 'PT2030',
			kind: 'programme',
			level: 'national',
			founded: '2022',
			seat: 'Lisbon',
			url: 'https://portugal2030.pt/',
			summary:
				"Portugal's ~EUR 23bn EU cohesion policy framework for 2021-2027 with thematic and regional programmes.",
			responsibilities: [
				'Thematic programmes (COMPETE 2030, PESSOAS 2030, Sustentável 2030)',
				'Regional programmes run by CCDRs (Norte 2030 etc.)'
			],
			obligations: ['Partnership Agreement with European Commission', 'N+3 decommitment rule'],
			accountableTo: ['adc', 'european-commission'],
			overlaps: [],
			sources: ['https://portugal2030.pt/']
		},
		{
			id: 'compete-2030',
			name: 'COMPETE 2030 (Innovation and Digital Transition Programme)',
			officialName: 'Programa Temático Inovação e Transição Digital (COMPETE 2030)',
			acronym: 'COMPETE 2030',
			kind: 'programme',
			level: 'national',
			founded: '2022',
			seat: 'Lisbon',
			url: 'https://www.compete2030.gov.pt/',
			summary: 'PT2030 thematic programme funding business innovation, R&D and digitalisation.',
			responsibilities: [
				'Incentives for SME innovation and internationalisation',
				'Co-funds R&D projects with AI2'
			],
			obligations: ['ERDF regulation', 'Managing-authority rules under CPR'],
			accountableTo: ['adc', 'ministry-economy-cohesion'],
			overlaps: [],
			sources: ['https://www.compete2030.gov.pt/', 'https://portugal2030.pt/']
		},
		{
			id: 'prr',
			name: 'Recovery and Resilience Plan',
			officialName: 'Plano de Recuperação e Resiliência',
			acronym: 'PRR',
			kind: 'programme',
			level: 'national',
			founded: '2021',
			seat: 'Lisbon',
			url: 'https://recuperarportugal.gov.pt/',
			summary:
				"Portugal's ~EUR 22bn NextGenerationEU plan; execution deadline Aug 2026, payments continuing into 2027.",
			responsibilities: [
				'Reforms and investments in health, housing, digital, climate',
				'Milestone-based EU payments'
			],
			obligations: ['RRF Regulation 2021/241', 'Council Implementing Decision on PT plan'],
			accountableTo: ['recuperar-portugal', 'european-commission'],
			overlaps: [],
			sources: [
				'https://recuperarportugal.gov.pt/',
				'https://portugal.gov.pt/gc25/governo/comunicados-do-conselho-de-ministros/comunicado-do-conselho-de-ministros-de-1-de-outubro-de-2026'
			]
		},
		{
			id: 'recuperar-portugal',
			name: 'Recuperar Portugal Mission Structure',
			officialName: 'Estrutura de Missão Recuperar Portugal',
			acronym: 'EMRP',
			kind: 'agency',
			level: 'national',
			founded: '2021',
			seat: 'Lisbon',
			url: 'https://recuperarportugal.gov.pt/',
			summary:
				'Coordinates PRR execution; mandate extended to 31 Dec 2028 for closure (CM, 1 Oct 2026; RCM 196/2026).',
			responsibilities: [
				'Payment requests to the European Commission',
				'Contracts with intermediate beneficiaries and pays final beneficiaries',
				'Final report and EU audit follow-up'
			],
			obligations: ['RRF Regulation 2021/241', 'RCM 196/2026'],
			accountableTo: [
				'ministry-economy-cohesion',
				'Comissão Nacional de Acompanhamento do PRR',
				'igf'
			],
			overlaps: [
				{
					with: 'ptrr-agency',
					note: 'New national PTRR plan (2026) has its own agency; distinct from the EU-funded PRR despite similar names.'
				}
			],
			sources: [
				'https://recuperarportugal.gov.pt/',
				'https://portugal.gov.pt/gc25/governo/comunicados-do-conselho-de-ministros/comunicado-do-conselho-de-ministros-de-1-de-outubro-de-2026'
			]
		},
		{
			id: 'ptrr-agency',
			name: 'PTRR Agency (Portugal Transformation, Recovery and Resilience)',
			officialName: 'Agência para o PTRR - Portugal Transformação, Recuperação e Resiliência',
			acronym: 'PTRR',
			kind: 'agency',
			level: 'national',
			founded: '2026',
			seat: 'Lisbon',
			url: 'https://www.portugal.gov.pt/',
			summary:
				'Mission structure created June 2026 to coordinate the 9-year EUR 22.6bn PTRR plan after the early-2026 storms.',
			responsibilities: [
				'Coordinates and monitors PTRR investments and reforms',
				'Works with Estrutura de Missão Reconstruir o Centro'
			],
			obligations: ['Council of Ministers resolution (June 2026)'],
			accountableTo: ['ministry-presidency'],
			overlaps: [],
			sources: [
				'https://portugal.gov.pt/gc25/comunicacao/noticias/conselho-de-ministros-aprova-criacao-de-agencia-para-coordenar-ptrr-portugal-transformacao-recuperacao-e-resiliencia'
			]
		},
		{
			id: 'banco-de-portugal',
			name: 'Bank of Portugal',
			officialName: 'Banco de Portugal',
			acronym: 'BdP',
			kind: 'agency',
			level: 'national',
			founded: '1846',
			seat: 'Lisbon',
			url: 'https://www.bportugal.pt/',
			summary: 'Central bank, part of the Eurosystem; prudential and conduct supervisor of banks.',
			responsibilities: [
				'Implements ECB monetary policy',
				'Supervises less significant banks; with ECB for significant ones',
				'National resolution authority; bank conduct'
			],
			obligations: [
				'EU Treaties and ECB Statute',
				'Lei Orgânica do BdP (Lei 5/98)',
				'Independence from Government'
			],
			accountableTo: ['european-union (Eurosystem/ECB)', 'assembleia-da-republica (hearings)'],
			overlaps: [
				{
					with: 'cmvm',
					note: 'Three financial supervisors (BdP, CMVM, ASF) coordinated in the CNSF; a 2019-era reform to merge supervision was never completed.'
				}
			],
			sources: ['https://www.bportugal.pt/']
		},
		{
			id: 'cmvm',
			name: 'Securities Market Commission',
			officialName: 'Comissão do Mercado de Valores Mobiliários',
			acronym: 'CMVM',
			kind: 'agency',
			level: 'national',
			founded: '1991',
			seat: 'Lisbon',
			url: 'https://www.cmvm.pt/',
			summary:
				'Capital markets regulator; national competent authority for MiCA crypto-asset providers.',
			responsibilities: [
				'Supervises issuers, funds and investment firms',
				'Investor protection',
				'MiCA crypto-asset service providers (with BdP)'
			],
			obligations: [
				'Securities Code (CVM)',
				'Framework law for regulators (Lei 67/2013)',
				'ESMA rules'
			],
			accountableTo: ['ministry-finance', 'assembleia-da-republica'],
			overlaps: [],
			sources: ['https://www.cmvm.pt/']
		},
		{
			id: 'asf',
			name: 'Insurance and Pension Funds Supervisory Authority',
			officialName: 'Autoridade de Supervisão de Seguros e Fundos de Pensões',
			acronym: 'ASF',
			kind: 'agency',
			level: 'national',
			founded: '1982',
			seat: 'Lisbon',
			url: 'https://www.asf.com.pt/',
			summary: 'Prudential and conduct supervisor of insurers and pension funds.',
			responsibilities: [
				'Licensing and supervision of insurers',
				'Consumer complaints on insurance',
				'Pension fund supervision'
			],
			obligations: ['Solvency II', 'Lei 67/2013', 'EIOPA rules'],
			accountableTo: ['ministry-finance', 'assembleia-da-republica'],
			overlaps: [],
			sources: ['https://www.asf.com.pt/']
		},
		{
			id: 'anacom',
			name: 'National Communications Authority',
			officialName: 'Autoridade Nacional de Comunicações',
			acronym: 'ANACOM',
			kind: 'agency',
			level: 'national',
			founded: '1981',
			seat: 'Lisbon',
			url: 'https://www.anacom.pt/',
			summary:
				'Telecoms and postal regulator; designated (Sept 2025) as AI Act market surveillance authority and single point of contact; DSA coordinator.',
			responsibilities: [
				'Electronic communications and postal regulation',
				'AI Act market surveillance and single contact point (designation announced, implementing law pending)',
				'Digital Services Coordinator (Lei 12-A/2026)',
				'Spectrum management'
			],
			obligations: [
				'Lei das Comunicações Eletrónicas (Lei 16/2022)',
				'Lei 67/2013',
				'EU AI Act (Reg. 2024/1689)'
			],
			accountableTo: ['assembleia-da-republica', 'portugal-government'],
			overlaps: [
				{
					with: 'cnpd',
					note: 'AI systems processing personal data fall under both ANACOM (AI Act) and CNPD (GDPR); 14 sectoral bodies also share fundamental-rights supervision of high-risk AI.'
				}
			],
			sources: [
				'https://www.anacom.pt/',
				'https://econews.pt/?p=45370',
				'https://cms.law/en/int/expert-guides/ai-regulation-scanner/portugal'
			]
		},
		{
			id: 'cnpd',
			name: 'National Data Protection Commission',
			officialName: 'Comissão Nacional de Proteção de Dados',
			acronym: 'CNPD',
			kind: 'agency',
			level: 'national',
			founded: '1991',
			seat: 'Lisbon',
			url: 'https://www.cnpd.pt/',
			summary: 'Independent GDPR supervisory authority attached to the Assembly of the Republic.',
			responsibilities: [
				'Handles data protection complaints',
				'Fines GDPR breaches',
				'Opinions on legislation involving personal data'
			],
			obligations: ['GDPR (Reg. 2016/679)', 'Lei 58/2019', 'Annual report to AR'],
			accountableTo: ['assembleia-da-republica'],
			overlaps: [],
			sources: ['https://www.cnpd.pt/']
		},
		{
			id: 'erc-media',
			name: 'Regulatory Authority for the Media',
			officialName: 'Entidade Reguladora para a Comunicação Social',
			acronym: 'ERC',
			kind: 'agency',
			level: 'national',
			founded: '2005',
			seat: 'Lisbon',
			url: 'https://www.erc.pt/',
			summary: 'Constitutional media regulator for press, radio, TV and online media.',
			responsibilities: [
				'Pluralism, right of reply and media ownership transparency',
				'Licensing of TV/radio operators',
				'European Media Freedom Act authority'
			],
			obligations: ['Constitution (CRP) art. 39', 'Lei 53/2005'],
			accountableTo: ['assembleia-da-republica (elects 4 of 5 members)'],
			overlaps: [],
			sources: ['https://www.erc.pt/']
		},
		{
			id: 'competition-authority',
			name: 'Competition Authority',
			officialName: 'Autoridade da Concorrência',
			acronym: 'AdC',
			kind: 'agency',
			level: 'national',
			founded: '2003',
			seat: 'Lisbon',
			url: 'https://www.concorrencia.pt/',
			summary: 'Enforces antitrust and merger control.',
			responsibilities: [
				'Cartel and abuse-of-dominance investigations',
				'Merger control',
				'Advocacy on market regulation'
			],
			obligations: ['Competition Law (Lei 19/2012)', 'TFEU arts. 101-102', 'Lei 67/2013'],
			accountableTo: [
				'assembleia-da-republica',
				'Competition, Regulation and Supervision Court (Santarém)'
			],
			overlaps: [],
			sources: ['https://www.concorrencia.pt/']
		},
		{
			id: 'municipalities',
			name: 'Municipalities (308)',
			officialName: 'Municípios / Câmaras Municipais',
			kind: 'executive',
			level: 'local',
			founded: '1976',
			seat: '308 municipalities',
			url: 'https://www.anmp.pt/',
			summary:
				'Elected local governments (câmara + assembleia municipal); last elections Oct 2025.',
			responsibilities: [
				'Urban planning, licensing and local housing',
				'Schools (decentralised), local health and social action',
				'Water, waste, local roads; IMI property tax revenue'
			],
			obligations: [
				'Lei 75/2013 (local authorities)',
				'Lei 73/2013 (local finance)',
				'Decentralisation Law 50/2018'
			],
			accountableTo: [
				'Local electorate',
				'Government administrative oversight (tutela) via IGF/CCDR',
				'court-of-auditors'
			],
			overlaps: [
				{
					with: 'ccdrs',
					note: 'CCDRs plan regionally, manage regional EU programmes and give opinions on municipal plans; municipalities license and execute. Overlaps in land-use and environmental approvals.'
				}
			],
			sources: [
				'https://www.anmp.pt/',
				'https://diariodarepublica.pt/dr/legislacao-consolidada/lei/2013-34478775'
			]
		},
		{
			id: 'freguesias',
			name: 'Parishes (Freguesias)',
			officialName: 'Freguesias',
			kind: 'executive',
			level: 'local',
			founded: '1976',
			seat: '~3,259 parishes',
			url: 'https://www.anafre.pt/',
			summary: 'Lowest tier of local government; 2025 law restored many parishes merged in 2013.',
			responsibilities: [
				'Certificates (atestados de residência)',
				'Local maintenance and green spaces',
				'Delegated municipal tasks'
			],
			obligations: ['Lei 75/2013', 'Lei 39/2021 (creation/restoration of parishes)'],
			accountableTo: ['Local electorate', 'municipalities'],
			overlaps: [],
			sources: ['https://www.anafre.pt/']
		},
		{
			id: 'ccdrs',
			name: 'Regional Coordination and Development Commissions (5)',
			officialName: 'Comissões de Coordenação e Desenvolvimento Regional',
			acronym: 'CCDR',
			kind: 'agency',
			level: 'regional',
			founded: '1979',
			seat: 'Porto, Coimbra, Lisbon, Évora, Faro',
			url: 'https://www.ccdr-n.pt/',
			summary:
				'Five mainland regional public institutes (since DL 36/2023) that absorbed regional agriculture, culture, education and health services.',
			responsibilities: [
				'Manage regional PT2030 programmes (e.g. Norte 2030)',
				'Land-use planning and environmental licensing',
				'Absorbed deconcentrated state services (agriculture, culture, etc.)'
			],
			obligations: ['Decree-Law 36/2023', 'EU CPR as managing authorities'],
			accountableTo: ['ministry-economy-cohesion', 'Regional councils of mayors'],
			overlaps: [
				{
					with: 'municipalities',
					note: 'See municipalities entry; CCDR presidents are elected by local councillors, blurring state/local roles.'
				}
			],
			sources: [
				'https://diariodarepublica.pt/dr/detalhe/decreto-lei/36-2023-213498795',
				'https://www.ccdr-n.pt/'
			]
		},
		{
			id: 'azores',
			name: 'Autonomous Region of the Azores',
			officialName: 'Região Autónoma dos Açores',
			acronym: 'RAA',
			kind: 'executive',
			level: 'regional',
			founded: '1976',
			seat: 'Ponta Delgada / Angra / Horta',
			url: 'https://portal.azores.gov.pt/',
			summary: 'Autonomous region with its own legislative assembly and regional government.',
			responsibilities: [
				'Regional legislation in non-reserved matters',
				'Regional health, education, transport',
				'Manages own EU programme (Açores 2030)'
			],
			obligations: [
				'Constitution (CRP) arts. 225-234',
				'Political-Administrative Statute (Lei 39/80)'
			],
			accountableTo: [
				'Regional electorate',
				'Representative of the Republic',
				'constitutional-court'
			],
			overlaps: [],
			sources: [
				'https://portal.azores.gov.pt/',
				'https://www.parlamento.pt/Legislacao/Paginas/ConstituicaoRepublicaPortuguesa.aspx'
			]
		},
		{
			id: 'madeira',
			name: 'Autonomous Region of Madeira',
			officialName: 'Região Autónoma da Madeira',
			acronym: 'RAM',
			kind: 'executive',
			level: 'regional',
			founded: '1976',
			seat: 'Funchal',
			url: 'https://www.madeira.gov.pt/',
			summary: 'Autonomous region with its own legislative assembly and regional government.',
			responsibilities: [
				'Regional legislation in non-reserved matters',
				'Regional health, education, transport',
				'Manages own EU programme (Madeira 2030)'
			],
			obligations: [
				'Constitution (CRP) arts. 225-234',
				'Political-Administrative Statute (Lei 13/91)'
			],
			accountableTo: [
				'Regional electorate',
				'Representative of the Republic',
				'constitutional-court'
			],
			overlaps: [],
			sources: [
				'https://www.madeira.gov.pt/',
				'https://www.parlamento.pt/Legislacao/Paginas/ConstituicaoRepublicaPortuguesa.aspx'
			]
		},
		{
			id: 'ministry-presidency',
			name: 'Ministry of the Presidency',
			officialName: 'Ministério da Presidência',
			acronym: 'MP',
			kind: 'executive',
			level: 'national',
			founded: '2024',
			seat: 'Lisbon',
			url: 'https://www.portugal.gov.pt/pt/gc25/area-de-governo/presidencia',
			summary:
				'Ministry (António Leitão Amaro) coordinating government, including migration policy and the PTRR agency.',
			responsibilities: [
				'Tutela of AIMA and migration policy',
				'Coordinates Council of Ministers',
				'Oversees PTRR agency'
			],
			obligations: ['Government organic law (DL 2025)'],
			accountableTo: ['portugal-government'],
			overlaps: [],
			sources: [
				'https://portugal.gov.pt/gc25/comunicacao/noticias/conselho-de-ministros-aprova-criacao-de-agencia-para-coordenar-ptrr-portugal-transformacao-recuperacao-e-resiliencia',
				'https://www.portugal.gov.pt/pt/gc25/area-de-governo/presidencia'
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
				}
			],
			sources: [
				'https://curia.europa.eu/jcms/jcms/Jo2_6999/en/',
				'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:12016E/TXT',
				'https://www.coe.int/en/web/human-rights-intergovernmental-cooperation/accession-of-the-european-union-to-the-european-convention-on-human-rights'
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
				}
			],
			sources: [
				'https://www.echr.coe.int/court-in-brief',
				'https://www.echr.coe.int/admissibility-guide'
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
			overlaps: [],
			sources: [
				'https://www.edpb.europa.eu/about-edpb/who-we-are/european-data-protection-board_en'
			]
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
			overlaps: [],
			sources: [
				'https://www.eppo.europa.eu/about/background_en',
				'https://eucrim.eu/news/andres-ritter-succeeds-laura-kovesi-as-european-chief-prosecutor/'
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
			overlaps: [],
			sources: [
				'https://european-union.europa.eu/institutions-law-budget/institutions-and-bodies/search-all-eu-institutions-and-bodies/european-court-auditors-eca_en',
				'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:12016E/TXT'
			]
		},
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
			overlaps: [],
			sources: [
				'https://european-union.europa.eu/principles-countries-history/eu-countries_en',
				'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:12016M/TXT',
				'https://www.ecb.europa.eu/euro/changeover/bulgaria/html/index.en.html'
			]
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
			overlaps: [],
			sources: ['https://www.frontex.europa.eu/about-frontex/who-we-are/tasks-mission/']
		}
	],
	relations: [
		{
			from: 'president-of-the-republic',
			to: 'portugal-government',
			kind: 'appoints',
			label: 'appoints PM and ministers',
			detail:
				"The President appoints the PM after hearing parties and election results, and ministers on the PM's proposal.",
			sources: ['https://www.parlamento.pt/Legislacao/Paginas/ConstituicaoRepublicaPortuguesa.aspx']
		},
		{
			from: 'assembleia-da-republica',
			to: 'portugal-government',
			kind: 'oversees',
			label: 'confidence and censure',
			detail:
				"The Government must survive the AR's programme debate and can fall through censure or failed confidence motions.",
			sources: ['https://www.parlamento.pt/Legislacao/Paginas/ConstituicaoRepublicaPortuguesa.aspx']
		},
		{
			from: 'president-of-the-republic',
			to: 'assembleia-da-republica',
			kind: 'oversees',
			label: 'can dissolve',
			detail: 'The President may dissolve the AR after hearing parties and the Council of State.',
			sources: ['https://www.parlamento.pt/Legislacao/Paginas/ConstituicaoRepublicaPortuguesa.aspx']
		},
		{
			from: 'council-of-state',
			to: 'president-of-the-republic',
			kind: 'oversees',
			label: 'advises',
			detail: 'The Council of State gives mandatory, non-binding opinions to the President.',
			sources: ['https://www.parlamento.pt/Legislacao/Paginas/ConstituicaoRepublicaPortuguesa.aspx']
		},
		{
			from: 'assembleia-da-republica',
			to: 'constitutional-court',
			kind: 'appoints',
			label: 'elects 10 of 13 judges',
			detail: 'AR elects ten judges by two-thirds majority; they co-opt the other three.',
			sources: ['https://www.tribunalconstitucional.pt/']
		},
		{
			from: 'president-of-the-republic',
			to: 'constitutional-court',
			kind: 'appeals-to',
			label: 'requests preventive review',
			detail:
				'The President can send bills to the TC before promulgation; used for the nationality law decrees in 2025.',
			sources: [
				'https://observador.pt/2026/05/03/seguro-promulga-lei-da-nacionalidade-mas-critica-nao-ter-tido-maior-consenso/',
				'https://www.parlamento.pt/Legislacao/Paginas/ConstituicaoRepublicaPortuguesa.aspx'
			]
		},
		{
			from: 'assembleia-da-republica',
			to: 'ombudsman',
			kind: 'appoints',
			label: 'elects Ombudsman',
			detail: 'The Ombudsman is elected by two-thirds of AR deputies and reports to it annually.',
			sources: ['https://www.provedor-jus.pt/']
		},
		{
			from: 'president-of-the-republic',
			to: 'public-prosecution',
			kind: 'appoints',
			label: 'appoints PGR',
			detail:
				"The President appoints the Attorney General on the Government's proposal for six years.",
			sources: ['https://www.parlamento.pt/Legislacao/Paginas/ConstituicaoRepublicaPortuguesa.aspx']
		},
		{
			from: 'portugal-government',
			to: 'public-prosecution',
			kind: 'appoints',
			label: 'proposes PGR',
			detail: 'The Government proposes the Attorney General to the President.',
			sources: ['https://www.parlamento.pt/Legislacao/Paginas/ConstituicaoRepublicaPortuguesa.aspx']
		},
		{
			from: 'president-of-the-republic',
			to: 'court-of-auditors',
			kind: 'appoints',
			label: 'appoints president',
			detail: 'The TdC president is appointed by the President on Government proposal.',
			sources: ['https://www.parlamento.pt/Legislacao/Paginas/ConstituicaoRepublicaPortuguesa.aspx']
		},
		{
			from: 'assembleia-da-republica',
			to: 'superior-council-magistracy',
			kind: 'appoints',
			label: 'elects 7 members',
			detail: 'The AR elects seven CSM members; the President appoints two; judges elect seven.',
			sources: ['https://www.csm.org.pt/']
		},
		{
			from: 'superior-council-magistracy',
			to: 'comarca-courts',
			kind: 'oversees',
			label: 'appoints, disciplines judges',
			detail: 'The CSM manages careers and discipline of judicial-order judges.',
			sources: ['https://www.csm.org.pt/']
		},
		{
			from: 'superior-council-magistracy',
			to: 'courts-of-appeal',
			kind: 'oversees',
			label: 'appoints, disciplines judges',
			detail: 'Relação judges are promoted and inspected by the CSM.',
			sources: ['https://www.csm.org.pt/']
		},
		{
			from: 'superior-council-magistracy',
			to: 'supreme-court-of-justice',
			kind: 'oversees',
			label: 'manages STJ judges',
			detail:
				'The CSM is chaired by the STJ president and manages STJ appointments by curricular contest.',
			sources: ['https://www.csm.org.pt/']
		},
		{
			from: 'assembleia-da-republica',
			to: 'erc-media',
			kind: 'appoints',
			label: 'elects 4 of 5 members',
			detail: 'ERC council members are elected by the AR, who co-opt the fifth.',
			sources: ['https://www.erc.pt/']
		},
		{
			from: 'assembleia-da-republica',
			to: 'cnpd',
			kind: 'appoints',
			label: 'elects members',
			detail: 'CNPD sits with the AR; most members are elected by it.',
			sources: ['https://www.cnpd.pt/']
		},
		{
			from: 'portugal-government',
			to: 'banco-de-portugal',
			kind: 'appoints',
			label: 'appoints governor',
			detail: 'The governor is appointed by the Council of Ministers after an AR hearing.',
			sources: ['https://www.bportugal.pt/']
		},
		{
			from: 'portugal-government',
			to: 'anacom',
			kind: 'appoints',
			label: 'appoints board',
			detail:
				'Regulator boards are appointed by the Council of Ministers after an AR hearing (Lei 67/2013).',
			sources: ['https://www.anacom.pt/']
		},
		{
			from: 'portugal-government',
			to: 'competition-authority',
			kind: 'appoints',
			label: 'appoints board',
			detail: 'Board appointed by Council of Ministers after AR hearing and CReSAP opinion.',
			sources: ['https://www.concorrencia.pt/']
		},
		{
			from: 'ministry-finance',
			to: 'portugal-government',
			kind: 'part-of',
			label: 'ministry of',
			detail: 'Ministry of the XXV Constitutional Government.',
			sources: ['https://www.portugal.gov.pt/pt/gc25']
		},
		{
			from: 'ministry-justice',
			to: 'portugal-government',
			kind: 'part-of',
			label: 'ministry of',
			detail: 'Ministry of the XXV Constitutional Government.',
			sources: ['https://www.portugal.gov.pt/pt/gc25']
		},
		{
			from: 'ministry-internal-administration',
			to: 'portugal-government',
			kind: 'part-of',
			label: 'ministry of',
			detail: 'Ministry of the XXV Constitutional Government.',
			sources: ['https://www.portugal.gov.pt/pt/gc25']
		},
		{
			from: 'ministry-labour-social-security',
			to: 'portugal-government',
			kind: 'part-of',
			label: 'ministry of',
			detail: 'Ministry of the XXV Constitutional Government.',
			sources: ['https://www.portugal.gov.pt/pt/gc25']
		},
		{
			from: 'ministry-education-science-innovation',
			to: 'portugal-government',
			kind: 'part-of',
			label: 'ministry of',
			detail: 'Ministry of the XXV Constitutional Government.',
			sources: ['https://www.portugal.gov.pt/pt/gc25']
		},
		{
			from: 'ministry-economy-cohesion',
			to: 'portugal-government',
			kind: 'part-of',
			label: 'ministry of',
			detail: 'Ministry of the XXV Constitutional Government.',
			sources: ['https://www.portugal.gov.pt/pt/gc25']
		},
		{
			from: 'ministry-state-reform',
			to: 'portugal-government',
			kind: 'part-of',
			label: 'ministry of',
			detail: 'Ministry of the XXV Constitutional Government.',
			sources: ['https://www.portugal.gov.pt/pt/gc25']
		},
		{
			from: 'ministry-presidency',
			to: 'portugal-government',
			kind: 'part-of',
			label: 'ministry of',
			detail: 'Ministry of the XXV Constitutional Government.',
			sources: ['https://www.portugal.gov.pt/pt/gc25']
		},
		{
			from: 'ministry-finance',
			to: 'at',
			kind: 'oversees',
			label: 'tutela (supervision)',
			detail: 'The ministry holds ministerial supervision (tutela/superintendência) over the body.',
			sources: ['https://www.portaldasfinancas.gov.pt/']
		},
		{
			from: 'ministry-finance',
			to: 'igf',
			kind: 'oversees',
			label: 'tutela (supervision)',
			detail: 'The ministry holds ministerial supervision (tutela/superintendência) over the body.',
			sources: ['https://www.igf.gov.pt/']
		},
		{
			from: 'ministry-justice',
			to: 'irn',
			kind: 'oversees',
			label: 'tutela (supervision)',
			detail: 'The ministry holds ministerial supervision (tutela/superintendência) over the body.',
			sources: ['https://irn.justica.gov.pt/']
		},
		{
			from: 'ministry-justice',
			to: 'pj',
			kind: 'oversees',
			label: 'tutela (supervision)',
			detail: 'The ministry holds ministerial supervision (tutela/superintendência) over the body.',
			sources: ['https://www.policiajudiciaria.pt/']
		},
		{
			from: 'ministry-internal-administration',
			to: 'psp',
			kind: 'oversees',
			label: 'tutela (supervision)',
			detail: 'The ministry holds ministerial supervision (tutela/superintendência) over the body.',
			sources: ['https://www.psp.pt/']
		},
		{
			from: 'ministry-internal-administration',
			to: 'gnr',
			kind: 'oversees',
			label: 'tutela (supervision)',
			detail: 'The ministry holds ministerial supervision (tutela/superintendência) over the body.',
			sources: ['https://www.gnr.pt/']
		},
		{
			from: 'ministry-labour-social-security',
			to: 'iefp',
			kind: 'oversees',
			label: 'tutela (supervision)',
			detail: 'The ministry holds ministerial supervision (tutela/superintendência) over the body.',
			sources: ['https://www.iefp.pt/']
		},
		{
			from: 'ministry-labour-social-security',
			to: 'iss',
			kind: 'oversees',
			label: 'tutela (supervision)',
			detail: 'The ministry holds ministerial supervision (tutela/superintendência) over the body.',
			sources: ['https://files.diariodarepublica.pt/1s/2026/02/04000/0002300033.pdf']
		},
		{
			from: 'ministry-labour-social-security',
			to: 'igfss',
			kind: 'oversees',
			label: 'tutela (supervision)',
			detail: 'The ministry holds ministerial supervision (tutela/superintendência) over the body.',
			sources: ['https://files.diariodarepublica.pt/1s/2026/02/04000/0002300033.pdf']
		},
		{
			from: 'ministry-labour-social-security',
			to: 'act',
			kind: 'oversees',
			label: 'tutela (supervision)',
			detail: 'The ministry holds ministerial supervision (tutela/superintendência) over the body.',
			sources: ['https://www.act.gov.pt/']
		},
		{
			from: 'ministry-labour-social-security',
			to: 'dgert',
			kind: 'oversees',
			label: 'tutela (supervision)',
			detail: 'The ministry holds ministerial supervision (tutela/superintendência) over the body.',
			sources: ['https://www.dgert.gov.pt/']
		},
		{
			from: 'ministry-labour-social-security',
			to: 'cite',
			kind: 'oversees',
			label: 'tutela (supervision)',
			detail: 'The ministry holds ministerial supervision (tutela/superintendência) over the body.',
			sources: ['https://cite.gov.pt/']
		},
		{
			from: 'ministry-education-science-innovation',
			to: 'ai2',
			kind: 'oversees',
			label: 'tutela (supervision)',
			detail: 'The ministry holds ministerial supervision (tutela/superintendência) over the body.',
			sources: [
				'https://portugal.gov.pt/gc25/comunicacao/comunicados/dominios-estrategicos-e-alocacao-orcamental-da-ai2-definidos-ate-outubro-apos-debate-alargado'
			]
		},
		{
			from: 'ministry-economy-cohesion',
			to: 'adc',
			kind: 'oversees',
			label: 'tutela (supervision)',
			detail: 'The ministry holds ministerial supervision (tutela/superintendência) over the body.',
			sources: ['https://www.adcoesao.pt/']
		},
		{
			from: 'ministry-economy-cohesion',
			to: 'recuperar-portugal',
			kind: 'oversees',
			label: 'tutela (supervision)',
			detail: 'The ministry holds ministerial supervision (tutela/superintendência) over the body.',
			sources: [
				'https://portugal.gov.pt/gc25/governo/comunicados-do-conselho-de-ministros/comunicado-do-conselho-de-ministros-de-1-de-outubro-de-2026'
			]
		},
		{
			from: 'ministry-economy-cohesion',
			to: 'ccdrs',
			kind: 'oversees',
			label: 'tutela (supervision)',
			detail: 'The ministry holds ministerial supervision (tutela/superintendência) over the body.',
			sources: ['https://diariodarepublica.pt/dr/detalhe/decreto-lei/36-2023-213498795']
		},
		{
			from: 'ministry-state-reform',
			to: 'arte',
			kind: 'oversees',
			label: 'tutela (supervision)',
			detail: 'The ministry holds ministerial supervision (tutela/superintendência) over the body.',
			sources: [
				'https://eco.sapo.pt/2025/07/31/governo-cria-agencia-para-a-reforma-tecnologica-e-o-cargo-de-diretor-de-sistemas-do-estado/'
			]
		},
		{
			from: 'ministry-presidency',
			to: 'aima',
			kind: 'oversees',
			label: 'tutela (supervision)',
			detail: 'The ministry holds ministerial supervision (tutela/superintendência) over the body.',
			sources: ['https://aima.gov.pt/']
		},
		{
			from: 'ministry-presidency',
			to: 'ptrr-agency',
			kind: 'oversees',
			label: 'tutela (supervision)',
			detail: 'The ministry holds ministerial supervision (tutela/superintendência) over the body.',
			sources: [
				'https://portugal.gov.pt/gc25/comunicacao/noticias/conselho-de-ministros-aprova-criacao-de-agencia-para-coordenar-ptrr-portugal-transformacao-recuperacao-e-resiliencia'
			]
		},
		{
			from: 'psp-unef',
			to: 'psp',
			kind: 'part-of',
			label: 'PSP unit',
			detail:
				'UNEF is a special unit within PSP created by Lei 55-C/2025, operating since 21 Aug 2025.',
			sources: ['https://diariodarepublica.pt/dr/detalhe/lei/55-c-2025-925904931']
		},
		{
			from: 'arte',
			to: 'lojas-do-cidadao',
			kind: 'implements',
			label: 'runs network',
			detail: 'ARTE (ex-AMA) manages the Lojas do Cidadão network and gov.pt.',
			sources: ['https://www.arte.gov.pt/']
		},
		{
			from: 'municipalities',
			to: 'lojas-do-cidadao',
			kind: 'partners',
			label: 'co-run Espaços Cidadão',
			detail: 'Municipalities host Espaços Cidadão under protocols with ARTE.',
			sources: ['https://www.gov.pt/']
		},
		{
			from: 'freguesias',
			to: 'municipalities',
			kind: 'part-of',
			label: 'sub-municipal tier',
			detail: "Parishes are units within a municipality's territory with delegated tasks.",
			sources: ['https://www.anafre.pt/']
		},
		{
			from: 'public-prosecution',
			to: 'pj',
			kind: 'oversees',
			label: 'directs investigations',
			detail:
				'In criminal inquiries the MP directs the investigation; PJ acts under its functional dependency.',
			sources: ['https://www.ministeriopublico.pt/']
		},
		{
			from: 'public-prosecution',
			to: 'psp',
			kind: 'oversees',
			label: 'directs investigations',
			detail: 'PSP acts as criminal police under MP direction in delegated inquiries.',
			sources: ['https://www.ministeriopublico.pt/']
		},
		{
			from: 'public-prosecution',
			to: 'gnr',
			kind: 'oversees',
			label: 'directs investigations',
			detail: 'GNR acts as criminal police under MP direction in delegated inquiries.',
			sources: ['https://www.ministeriopublico.pt/']
		},
		{
			from: 'comarca-courts',
			to: 'courts-of-appeal',
			kind: 'appeals-to',
			label: 'appeal',
			detail:
				'Civil and criminal first-instance rulings are appealed to the Relação on fact and law.',
			sources: ['https://diariodarepublica.pt/dr/legislacao-consolidada/lei/2013-34580575']
		},
		{
			from: 'courts-of-appeal',
			to: 'supreme-court-of-justice',
			kind: 'appeals-to',
			label: 'appeal on law',
			detail:
				'Further appeal (revista/recurso) to the STJ on points of law, subject to value thresholds.',
			sources: ['https://diariodarepublica.pt/dr/legislacao-consolidada/lei/2013-34580575']
		},
		{
			from: 'julgados-de-paz',
			to: 'comarca-courts',
			kind: 'appeals-to',
			label: 'appeal above EUR 2,500',
			detail:
				'Julgados de Paz rulings in claims above half the first-instance threshold can be appealed to the comarca court.',
			sources: ['https://dgpj.justica.gov.pt/Resolucao-de-Litigios/Julgados-de-Paz']
		},
		{
			from: 'administrative-tax-courts',
			to: 'central-administrative-courts',
			kind: 'appeals-to',
			label: 'appeal',
			detail: 'TAF rulings are appealed to TCA Norte or Sul.',
			sources: ['https://diariodarepublica.pt/dr/legislacao-consolidada/lei/2002-34580675']
		},
		{
			from: 'central-administrative-courts',
			to: 'supreme-administrative-court',
			kind: 'appeals-to',
			label: 'exceptional revista',
			detail: 'STA hears exceptional review and appeals on uniform case law.',
			sources: ['https://diariodarepublica.pt/dr/legislacao-consolidada/lei/2002-34580675']
		},
		{
			from: 'administrative-tax-courts',
			to: 'supreme-administrative-court',
			kind: 'appeals-to',
			label: 'per saltum on law',
			detail: 'Tax cases on points of law only can go directly from TAF to STA.',
			sources: ['https://diariodarepublica.pt/dr/legislacao-consolidada/lei/2002-34580675']
		},
		{
			from: 'caad',
			to: 'supreme-administrative-court',
			kind: 'appeals-to',
			label: 'limited appeal',
			detail:
				'CAAD tax awards are final save appeal to STA on conflicting case law, or annulment at TCA.',
			sources: ['https://www.caad.org.pt/']
		},
		{
			from: 'caad',
			to: 'constitutional-court',
			kind: 'appeals-to',
			label: 'constitutional questions',
			detail: 'Arbitral awards applying unconstitutional norms can be appealed to the TC.',
			sources: ['https://www.caad.org.pt/']
		},
		{
			from: 'supreme-court-of-justice',
			to: 'constitutional-court',
			kind: 'appeals-to',
			label: 'constitutional appeal',
			detail:
				'Any court decision applying or refusing a norm on constitutional grounds can be appealed to the TC (concrete review).',
			sources: ['https://www.parlamento.pt/Legislacao/Paginas/ConstituicaoRepublicaPortuguesa.aspx']
		},
		{
			from: 'supreme-administrative-court',
			to: 'constitutional-court',
			kind: 'appeals-to',
			label: 'constitutional appeal',
			detail:
				'Any court decision applying or refusing a norm on constitutional grounds can be appealed to the TC (concrete review).',
			sources: ['https://www.parlamento.pt/Legislacao/Paginas/ConstituicaoRepublicaPortuguesa.aspx']
		},
		{
			from: 'courts-of-appeal',
			to: 'constitutional-court',
			kind: 'appeals-to',
			label: 'constitutional appeal',
			detail:
				'Any court decision applying or refusing a norm on constitutional grounds can be appealed to the TC (concrete review).',
			sources: ['https://www.parlamento.pt/Legislacao/Paginas/ConstituicaoRepublicaPortuguesa.aspx']
		},
		{
			from: 'comarca-courts',
			to: 'constitutional-court',
			kind: 'appeals-to',
			label: 'constitutional appeal',
			detail:
				'Any court decision applying or refusing a norm on constitutional grounds can be appealed to the TC (concrete review).',
			sources: ['https://www.parlamento.pt/Legislacao/Paginas/ConstituicaoRepublicaPortuguesa.aspx']
		},
		{
			from: 'administrative-tax-courts',
			to: 'constitutional-court',
			kind: 'appeals-to',
			label: 'constitutional appeal',
			detail:
				'Any court decision applying or refusing a norm on constitutional grounds can be appealed to the TC (concrete review).',
			sources: ['https://www.parlamento.pt/Legislacao/Paginas/ConstituicaoRepublicaPortuguesa.aspx']
		},
		{
			from: 'central-administrative-courts',
			to: 'constitutional-court',
			kind: 'appeals-to',
			label: 'constitutional appeal',
			detail:
				'Any court decision applying or refusing a norm on constitutional grounds can be appealed to the TC (concrete review).',
			sources: ['https://www.parlamento.pt/Legislacao/Paginas/ConstituicaoRepublicaPortuguesa.aspx']
		},
		{
			from: 'court-of-auditors',
			to: 'constitutional-court',
			kind: 'appeals-to',
			label: 'constitutional appeal',
			detail:
				'Any court decision applying or refusing a norm on constitutional grounds can be appealed to the TC (concrete review).',
			sources: ['https://www.parlamento.pt/Legislacao/Paginas/ConstituicaoRepublicaPortuguesa.aspx']
		},
		{
			from: 'supreme-court-of-justice',
			to: 'cjeu',
			kind: 'appeals-to',
			label: 'preliminary reference',
			detail: 'Courts of last instance must refer EU-law questions to the CJEU (TFEU art. 267).',
			sources: ['https://curia.europa.eu/']
		},
		{
			from: 'supreme-administrative-court',
			to: 'cjeu',
			kind: 'appeals-to',
			label: 'preliminary reference',
			detail: 'Courts of last instance must refer EU-law questions to the CJEU (TFEU art. 267).',
			sources: ['https://curia.europa.eu/']
		},
		{
			from: 'supreme-court-of-justice',
			to: 'ecthr',
			kind: 'appeals-to',
			label: 'individual application',
			detail:
				'After exhausting domestic remedies individuals may apply to the ECtHR in Strasbourg.',
			sources: ['https://www.echr.coe.int/']
		},
		{
			from: 'ombudsman',
			to: 'constitutional-court',
			kind: 'appeals-to',
			label: 'requests review',
			detail: 'The Ombudsman can ask the TC for successive review of constitutionality.',
			sources: ['https://www.parlamento.pt/Legislacao/Paginas/ConstituicaoRepublicaPortuguesa.aspx']
		},
		{
			from: 'aima',
			to: 'administrative-tax-courts',
			kind: 'appeals-to',
			label: 'challenges and urgent actions',
			detail:
				'Residents sue AIMA in administrative courts over delays (intimações); the government plans to spread these cases beyond Lisbon.',
			sources: [
				'https://observador.pt/2026/07/23/governo-quer-redistribuir-processos-da-aima-por-tribunais-de-todo-o-pais-apos-chumbar-proposta-igual-da-il-em-fevereiro/'
			]
		},
		{
			from: 'at',
			to: 'administrative-tax-courts',
			kind: 'appeals-to',
			label: 'tax impugnation',
			detail: 'Taxpayers challenge AT assessments in the TAF.',
			sources: ['https://diariodarepublica.pt/dr/legislacao-consolidada/lei/2002-34580675']
		},
		{
			from: 'at',
			to: 'caad',
			kind: 'appeals-to',
			label: 'tax arbitration',
			detail: 'Taxpayers may choose CAAD arbitration; AT is bound to it (Portaria 112-A/2011).',
			sources: ['https://www.caad.org.pt/']
		},
		{
			from: 'ombudsman',
			to: 'aima',
			kind: 'oversees',
			label: 'complaints',
			detail:
				'AIMA is among the bodies most complained about to the Ombudsman; recommendations are non-binding.',
			sources: ['https://www.provedor-jus.pt/']
		},
		{
			from: 'ombudsman',
			to: 'iss',
			kind: 'oversees',
			label: 'complaints',
			detail: 'Ombudsman handles complaints on pensions and benefits.',
			sources: ['https://www.provedor-jus.pt/']
		},
		{
			from: 'bar-association',
			to: 'comarca-courts',
			kind: 'partners',
			label: 'legal representation',
			detail:
				"OA lawyers represent parties; legal aid lawyers are appointed through OA's system after ISS approval.",
			sources: ['https://portal.oa.pt/']
		},
		{
			from: 'iss',
			to: 'bar-association',
			kind: 'partners',
			label: 'legal aid',
			detail: 'ISS decides legal aid eligibility; OA appoints the lawyer.',
			sources: ['https://www.seg-social.pt/']
		},
		{
			from: 'court-of-auditors',
			to: 'portugal-government',
			kind: 'oversees',
			label: 'audits State accounts',
			detail: 'TdC issues its opinion on the General State Account to the AR.',
			sources: ['https://www.tcontas.pt/']
		},
		{
			from: 'court-of-auditors',
			to: 'municipalities',
			kind: 'oversees',
			label: 'audits, prior visa',
			detail: 'TdC audits local authorities and grants prior visa on large contracts.',
			sources: ['https://www.tcontas.pt/']
		},
		{
			from: 'court-of-auditors',
			to: 'recuperar-portugal',
			kind: 'oversees',
			label: 'audits PRR',
			detail: 'TdC regularly audits PRR execution.',
			sources: ['https://www.tcontas.pt/']
		},
		{
			from: 'igf',
			to: 'adc',
			kind: 'oversees',
			label: 'EU-fund audit authority',
			detail: 'IGF is the Audit Authority for PT2030 and PRR.',
			sources: ['https://www.igf.gov.pt/']
		},
		{
			from: 'igf',
			to: 'recuperar-portugal',
			kind: 'oversees',
			label: 'audit and control',
			detail: 'IGF audits the PRR control system and payment requests.',
			sources: ['https://www.igf.gov.pt/']
		},
		{
			from: 'igf',
			to: 'municipalities',
			kind: 'oversees',
			label: 'inspection (tutela)',
			detail: "IGF exercises the Government's financial tutela over local authorities.",
			sources: ['https://www.igf.gov.pt/']
		},
		{
			from: 'european-court-of-auditors',
			to: 'court-of-auditors',
			kind: 'partners',
			label: 'EU-fund audit cooperation',
			detail: 'ECA and TdC cooperate on audits of EU funds spent in Portugal.',
			sources: ['https://www.eca.europa.eu/']
		},
		{
			from: 'eppo',
			to: 'public-prosecution',
			kind: 'partners',
			label: 'EU-fraud cases',
			detail:
				"EPPO's European Delegated Prosecutors in Lisbon take EU-budget fraud cases; MP handles the rest.",
			sources: ['https://www.eppo.europa.eu/']
		},
		{
			from: 'cnpd',
			to: 'edpb',
			kind: 'member-of',
			label: 'GDPR board member',
			detail: 'CNPD sits on the European Data Protection Board.',
			sources: ['https://www.edpb.europa.eu/']
		},
		{
			from: 'anacom',
			to: 'european-commission',
			kind: 'implements',
			label: 'AI Act / DSA authority',
			detail:
				"ANACOM is announced as AI Act market surveillance authority and single contact point, and is Digital Services Coordinator, cooperating with the Commission's AI Office.",
			sources: [
				'https://econews.pt/?p=45370',
				'https://cms.law/en/int/expert-guides/ai-regulation-scanner/portugal'
			]
		},
		{
			from: 'psp-unef',
			to: 'frontex',
			kind: 'partners',
			label: 'external border cooperation',
			detail:
				'UNEF (air) and GNR (sea/land) cooperate with Frontex on Schengen external borders and returns.',
			sources: ['https://www.frontex.europa.eu/']
		},
		{
			from: 'gnr',
			to: 'frontex',
			kind: 'partners',
			label: 'sea border operations',
			detail: "GNR's coastal unit takes part in Frontex joint operations.",
			sources: ['https://www.frontex.europa.eu/']
		},
		{
			from: 'banco-de-portugal',
			to: 'european-union',
			kind: 'member-of',
			label: 'Eurosystem/SSM',
			detail: 'BdP is part of the Eurosystem and the Single Supervisory Mechanism.',
			sources: ['https://www.bportugal.pt/']
		},
		{
			from: 'portugal-government',
			to: 'european-union',
			kind: 'member-of',
			label: 'member state',
			detail: 'Portugal has been an EU member state since 1986.',
			sources: ['https://european-union.europa.eu/']
		},
		{
			from: 'banco-de-portugal',
			to: 'portugal-government',
			kind: 'partners',
			label: 'financial stability',
			detail: 'BdP advises the Government on financial stability within the CNSF framework.',
			sources: ['https://www.bportugal.pt/']
		},
		{
			from: 'cnpd',
			to: 'arte',
			kind: 'regulates',
			label: 'data protection',
			detail:
				'CNPD supervises personal data processing by public bodies including digital ID services.',
			sources: ['https://www.cnpd.pt/']
		},
		{
			from: 'european-commission',
			to: 'adc',
			kind: 'funds',
			label: 'cohesion funds',
			detail:
				'The Commission pays ERDF, ESF+ and Cohesion Fund transfers to AD&C as paying authority.',
			sources: ['https://www.adcoesao.pt/']
		},
		{
			from: 'adc',
			to: 'portugal-2030',
			kind: 'implements',
			label: 'coordinates PT2030',
			detail: 'AD&C coordinates and monitors the Portugal 2030 programmes.',
			sources: ['https://portugal2030.pt/']
		},
		{
			from: 'portugal-2030',
			to: 'compete-2030',
			kind: 'funds',
			label: 'thematic programme',
			detail: 'COMPETE 2030 is one of the PT2030 thematic programmes.',
			sources: ['https://portugal2030.pt/']
		},
		{
			from: 'portugal-2030',
			to: 'ccdrs',
			kind: 'funds',
			label: 'regional programmes',
			detail:
				'CCDRs are managing authorities for the mainland regional programmes (Norte 2030, Centro 2030...).',
			sources: ['https://portugal2030.pt/']
		},
		{
			from: 'compete-2030',
			to: 'ai2',
			kind: 'funds',
			label: 'co-funds R&D',
			detail: 'COMPETE 2030 co-funds R&D and innovation calls run with AI2 (ex-FCT/ANI).',
			sources: ['https://www.compete2030.gov.pt/']
		},
		{
			from: 'european-commission',
			to: 'prr',
			kind: 'funds',
			label: 'RRF grants and loans',
			detail: 'The Commission pays PRR tranches on achievement of milestones under the RRF.',
			sources: ['https://recuperarportugal.gov.pt/']
		},
		{
			from: 'recuperar-portugal',
			to: 'prr',
			kind: 'implements',
			label: 'coordinates PRR',
			detail:
				'Recuperar Portugal submits payment requests and pays beneficiaries; mandate extended to 2028.',
			sources: [
				'https://portugal.gov.pt/gc25/governo/comunicados-do-conselho-de-ministros/comunicado-do-conselho-de-ministros-de-1-de-outubro-de-2026'
			]
		},
		{
			from: 'prr',
			to: 'municipalities',
			kind: 'funds',
			label: 'housing, schools',
			detail: 'Municipalities are major PRR beneficiaries (housing, schools, health centres).',
			sources: ['https://recuperarportugal.gov.pt/']
		},
		{
			from: 'prr',
			to: 'ai2',
			kind: 'funds',
			label: 'agendas mobilizadoras',
			detail: 'PRR funded innovation agendas and research programmes managed by ex-ANI/FCT.',
			sources: ['https://recuperarportugal.gov.pt/']
		},
		{
			from: 'portugal-government',
			to: 'ai2',
			kind: 'funds',
			label: 'programme contract',
			detail: 'The State funds AI2 through a five-year programme contract.',
			sources: [
				'https://portugal.gov.pt/gc25/comunicacao/comunicados/dominios-estrategicos-e-alocacao-orcamental-da-ai2-definidos-ate-outubro-apos-debate-alargado'
			]
		},
		{
			from: 'igfss',
			to: 'iss',
			kind: 'funds',
			label: 'Social Security budget',
			detail: 'IGFSS manages the funds from which ISS pays benefits.',
			sources: ['https://www.gov.pt/entidades/instituto-de-gestao-financeira-da-seguranca-social']
		},
		{
			from: 'portugal-government',
			to: 'municipalities',
			kind: 'funds',
			label: 'FEF transfers',
			detail:
				'Municipalities receive State budget transfers (Fundo de Equilíbrio Financeiro) and decentralisation funds.',
			sources: ['https://diariodarepublica.pt/dr/legislacao-consolidada/lei/2013-34478775']
		},
		{
			from: 'portugal-government',
			to: 'ptrr-agency',
			kind: 'funds',
			label: 'PTRR plan',
			detail: 'The PTRR is a national EUR 22.6bn plan coordinated by the new agency.',
			sources: [
				'https://portugal.gov.pt/gc25/comunicacao/noticias/conselho-de-ministros-aprova-criacao-de-agencia-para-coordenar-ptrr-portugal-transformacao-recuperacao-e-resiliencia'
			]
		},
		{
			from: 'iefp',
			to: 'iss',
			kind: 'partners',
			label: 'unemployment claims',
			detail:
				'IEFP registration is required for ISS unemployment benefit; IEFP reports non-compliance.',
			sources: ['https://www.seg-social.pt/']
		},
		{
			from: 'act',
			to: 'cite',
			kind: 'partners',
			label: 'equality enforcement',
			detail: 'CITE issues opinions; ACT inspects and fines.',
			sources: ['https://cite.gov.pt/']
		},
		{
			from: 'psp-unef',
			to: 'aima',
			kind: 'partners',
			label: 'returns and stay checks',
			detail:
				'UNEF enforces removal decisions and stay checks; AIMA keeps permit and asylum decisions.',
			sources: [
				'https://eco.sapo.pt/2025/08/29/mini-sef-herda-100-mil-processos-em-atraso-para-expulsar-imigrantes/',
				'https://diariodarepublica.pt/dr/detalhe/deliberacao/1543-2025-985743531'
			]
		},
		{
			from: 'aima',
			to: 'iss',
			kind: 'partners',
			label: 'asylum reception handover',
			detail: 'Asylum-seeker reception is being transferred from AIMA to Segurança Social.',
			sources: [
				'https://rr.pt/noticia/pais/2026/06/01/seguranca-social-vai-ser-unica-responsavel-pelo-acolhimento-de-requerentes-de-asilo/472965/'
			]
		},
		{
			from: 'irn',
			to: 'aima',
			kind: 'partners',
			label: 'permit renewals desk',
			detail: 'IRN desks have handled AIMA residence-permit renewals.',
			sources: ['https://aima.gov.pt/']
		},
		{
			from: 'ccdrs',
			to: 'municipalities',
			kind: 'partners',
			label: 'regional coordination',
			detail:
				'CCDR presidents are elected by local councillors; CCDRs give binding opinions on municipal plans.',
			sources: ['https://diariodarepublica.pt/dr/detalhe/decreto-lei/36-2023-213498795']
		},
		{
			from: 'pj',
			to: 'psp-unef',
			kind: 'partners',
			label: 'smuggling investigations',
			detail: 'PJ investigates migrant smuggling/trafficking detected by UNEF at borders.',
			sources: ['https://www.policiajudiciaria.pt/']
		},
		{
			from: 'azores',
			to: 'constitutional-court',
			kind: 'appeals-to',
			label: 'regional law review',
			detail:
				'Regional legislation is subject to TC review, requested by the Representative of the Republic.',
			sources: ['https://www.parlamento.pt/Legislacao/Paginas/ConstituicaoRepublicaPortuguesa.aspx']
		},
		{
			from: 'madeira',
			to: 'constitutional-court',
			kind: 'appeals-to',
			label: 'regional law review',
			detail:
				'Regional legislation is subject to TC review, requested by the Representative of the Republic.',
			sources: ['https://www.parlamento.pt/Legislacao/Paginas/ConstituicaoRepublicaPortuguesa.aspx']
		},
		{
			from: 'portugal-government',
			to: 'azores',
			kind: 'funds',
			label: 'State transfers',
			detail: 'Regions receive transfers under the Regional Finance Law (Lei Orgânica 2/2013).',
			sources: ['https://www.parlamento.pt/Legislacao/Paginas/ConstituicaoRepublicaPortuguesa.aspx']
		},
		{
			from: 'portugal-government',
			to: 'madeira',
			kind: 'funds',
			label: 'State transfers',
			detail: 'Regions receive transfers under the Regional Finance Law (Lei Orgânica 2/2013).',
			sources: ['https://www.parlamento.pt/Legislacao/Paginas/ConstituicaoRepublicaPortuguesa.aspx']
		},
		{
			from: 'portugal-government',
			to: 'cmvm',
			kind: 'appoints',
			label: 'appoints board',
			detail:
				'The Council of Ministers appoints the board after a hearing in the Assembleia da República (Lei 67/2013, art. 17).',
			sources: [
				'https://www.cmvm.pt/',
				'https://diariodarepublica.pt/dr/detalhe/lei/67-2013-499239'
			]
		},
		{
			from: 'portugal-government',
			to: 'asf',
			kind: 'appoints',
			label: 'appoints board',
			detail:
				'The Council of Ministers appoints the board after a hearing in the Assembleia da República (Lei 67/2013, art. 17).',
			sources: [
				'https://www.asf.com.pt/',
				'https://diariodarepublica.pt/dr/detalhe/lei/67-2013-499239'
			]
		}
	],
	routes: [
		{
			id: 'lost-job',
			title: 'I lost my job',
			steps: [
				{
					id: 'iefp',
					note: 'Register as unemployed and look for work or training.'
				},
				{
					id: 'iss',
					note: 'Claim unemployment benefit; you must be registered with IEFP.'
				},
				{
					id: 'act',
					note: 'Report unpaid wages or unsafe or unlawful practices.'
				},
				{
					id: 'comarca-courts',
					note: 'Challenge a dismissal at the labour court.'
				}
			]
		},
		{
			id: 'moving-here',
			title: "I'm moving to Portugal from abroad",
			steps: [
				{
					id: 'at',
					note: 'Get a tax number (NIF).'
				},
				{
					id: 'iss',
					note: 'Get a social security number (NISS).'
				},
				{
					id: 'aima',
					note: 'Apply for or renew a residence permit, or ask for asylum.'
				},
				{
					id: 'psp-unef',
					note: "Checks passports at airports and foreigners' right to stay."
				},
				{
					id: 'irn',
					note: 'Apply for nationality, the Citizen Card or a passport.'
				}
			]
		},
		{
			id: 'tax-dispute',
			title: 'I disagree with a tax bill',
			steps: [
				{
					id: 'at',
					note: 'Complain to the Tax Authority first.'
				},
				{
					id: 'caad',
					note: 'Or take it to tax arbitration, usually faster.'
				},
				{
					id: 'administrative-tax-courts',
					note: 'Or challenge it in the tax court.'
				},
				{
					id: 'central-administrative-courts',
					note: 'Hears appeals from the tax courts.'
				},
				{
					id: 'supreme-administrative-court',
					note: 'The last instance for tax and administrative cases.'
				}
			]
		},
		{
			id: 'civil-appeal',
			title: 'Taking a case all the way up',
			steps: [
				{
					id: 'comarca-courts',
					note: 'Most cases start in the district court.'
				},
				{
					id: 'courts-of-appeal',
					note: 'Hear appeals on facts and law.'
				},
				{
					id: 'supreme-court-of-justice',
					note: 'Hears appeals on points of law only.'
				},
				{
					id: 'constitutional-court',
					note: 'Rules on whether a law applied to you is unconstitutional.'
				},
				{
					id: 'cjeu',
					note: "Answers Portuguese courts' questions on EU law."
				},
				{
					id: 'ecthr',
					note: 'Take a case here once national remedies are exhausted.'
				}
			]
		}
	]
};
