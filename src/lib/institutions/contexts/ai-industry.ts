import type { Context } from '../types';

export const aiIndustry: Context = {
	id: 'ai-industry',
	title: 'AI industry',
	summary:
		'Who makes AI chips, who runs the data centres, who builds the models, who pays for them and who regulates them.',
	asOf: '2026-11-13',
	institutions: [
		{
			id: 'asml',
			name: 'ASML Holding',
			kind: 'company',
			level: 'private',
			founded: '1984',
			seat: 'Veldhoven',
			url: 'https://www.asml.com',
			summary:
				'Sole supplier of EUV lithography machines, without which leading-edge chips cannot be made.',
			responsibilities: [
				'Builds EUV and DUV lithography systems',
				'Services installed base worldwide',
				'Main shareholder of Mistral AI (~11%)'
			],
			obligations: [
				'Dutch export licences for EUV and advanced DUV to China',
				'US EAR foreign direct product rules',
				'EU Market Abuse Regulation; Euronext/Nasdaq listing'
			],
			accountableTo: ['Shareholders', 'netherlands-government (export licensing)'],
			overlaps: [
				{
					with: 'tokyo-electron',
					note: 'Both sell fab tools, but ASML has no lithography competitor at EUV; overlap only in metrology/track adjacency.'
				}
			],
			sources: [
				'https://www.asml.com/en/company/about-asml',
				'https://www.trendforce.com/news/2026/08/25/news-u-s-may-push-near-total-asml-china-ban-on-duv-sales-and-servicing-amid-chinas-domestic-lithography-push/'
			]
		},
		{
			id: 'carl-zeiss-smt',
			name: 'Carl Zeiss SMT',
			kind: 'company',
			level: 'private',
			founded: '2001',
			seat: 'Oberkochen',
			url: 'https://www.zeiss.com/semiconductor-manufacturing-technology',
			summary:
				'Exclusive maker of the optics inside ASML lithography machines; 24.9% owned by ASML.',
			responsibilities: [
				'Designs and makes EUV mirrors and DUV lenses',
				'Co-develops High-NA EUV optics with ASML'
			],
			obligations: [
				'German and EU export control law (dual-use regulation)',
				'Exclusive supply arrangement with ASML'
			],
			accountableTo: ['Carl Zeiss AG (75.1%)', 'asml (24.9%)'],
			overlaps: [],
			sources: [
				'https://www.zeiss.com/semiconductor-manufacturing-technology/about-us.html',
				'https://www.asml.com/en/news/press-releases/2016/asml-to-acquire-249-percent-of-carl-zeiss-smt'
			]
		},
		{
			id: 'tsmc',
			name: 'Taiwan Semiconductor Manufacturing Company',
			acronym: 'TSMC',
			kind: 'company',
			level: 'private',
			founded: '1987',
			seat: 'Hsinchu',
			url: 'https://www.tsmc.com',
			summary:
				"World's dominant contract chipmaker; fabricates nearly all leading AI accelerators and CoWoS packaging.",
			responsibilities: [
				'Fabricates Nvidia, AMD, Broadcom, Apple, Google TPU chips',
				'Advanced packaging (CoWoS) for HBM-based accelerators',
				'Building fabs in Arizona, Japan, Germany'
			],
			obligations: [
				'Taiwan rules limiting most advanced nodes abroad (N-1/N-2)',
				'US CHIPS Act award conditions (US$6.6bn grant)',
				'US EAR: no advanced chips for listed Chinese firms'
			],
			accountableTo: [
				'Shareholders',
				'taiwan-government (largest holder via National Development Fund ~6%)'
			],
			overlaps: [
				{
					with: 'samsung-electronics',
					note: 'Both offer leading-edge foundry; TSMC holds ~70% share, Samsung and Intel Foundry compete for second source.'
				},
				{
					with: 'intel',
					note: 'Intel Foundry is the US-government-backed alternative to TSMC; overlap resolved by customers dual-sourcing.'
				}
			],
			sources: [
				'https://www.tsmc.com/english/aboutTSMC',
				'https://www.commerce.gov/news/press-releases/2024/11/biden-harris-administration-announces-chips-incentives-award-tsmc-arizona'
			]
		},
		{
			id: 'samsung-electronics',
			name: 'Samsung Electronics',
			kind: 'company',
			level: 'private',
			founded: '1969',
			seat: 'Suwon',
			url: 'https://www.samsung.com',
			summary:
				"Korean memory and foundry giant; supplies HBM to Nvidia/AMD and led Mistral's 2026 round.",
			responsibilities: [
				'Makes DRAM, HBM and NAND',
				'Contract foundry (2nm GAA)',
				'Building Taylor, Texas fab'
			],
			obligations: [
				'Korean and US export controls',
				'US CHIPS Act award conditions (~US$4.7bn)',
				'US VEU status for China fabs revoked 2025, now annual licences'
			],
			accountableTo: ['Shareholders', 'south-korea-government (industrial policy)'],
			overlaps: [
				{
					with: 'sk-hynix',
					note: 'Head-to-head in HBM; SK hynix leads, Samsung qualified HBM3E/HBM4 with Nvidia late.'
				}
			],
			sources: [
				'https://www.samsung.com/semiconductor/',
				'https://www.euronews.com/2026/09/08/mistral-ai-raises-record-3-billion-in-samsung-led-funding-round'
			]
		},
		{
			id: 'intel',
			name: 'Intel Corporation',
			kind: 'company',
			level: 'private',
			founded: '1968',
			seat: 'Santa Clara',
			url: 'https://www.intel.com',
			summary:
				'US chipmaker and foundry (Intel Foundry, 18A); about 10% owned by the US government since 2025.',
			responsibilities: [
				'Designs x86 CPUs and Gaudi accelerators',
				'Intel Foundry contract manufacturing (18A, planned 14A)',
				'Domestic leading-edge capacity for US'
			],
			obligations: [
				'US securities law (SEC reporting, Sarbanes-Oxley)',
				'Terms of US equity deal replacing CHIPS grants',
				'CHIPS Secure Enclave defence obligations'
			],
			accountableTo: ['Shareholders', 'united-states-government (~9.9% at the Aug 2025 deal)'],
			overlaps: [
				{
					with: 'tsmc',
					note: 'Competing foundry; Intel is subsidised as the US alternative.'
				}
			],
			sources: [
				'https://www.intc.com/',
				'https://www.theregister.com/2025/08/25/intel_gets_trumped/',
				'https://www.intc.com/news-events/press-releases/detail/1748/intel-and-trump-administration-reach-historic-agreement-to'
			]
		},
		{
			id: 'sk-hynix',
			name: 'SK hynix',
			kind: 'company',
			level: 'private',
			founded: '1983',
			seat: 'Icheon',
			url: 'https://www.skhynix.com',
			summary: 'Leading HBM supplier; main memory partner for Nvidia accelerators.',
			responsibilities: ['Makes HBM3E/HBM4, DRAM, NAND', 'Building HBM packaging plant in Indiana'],
			obligations: ['Korean and US export controls', 'US CHIPS award (up to US$458m) conditions'],
			accountableTo: ['Shareholders (SK Group ~20%)', 'south-korea-government (industrial policy)'],
			overlaps: [
				{
					with: 'micron',
					note: 'Third HBM supplier; all three compete for Nvidia qualification.'
				}
			],
			sources: [
				'https://news.skhynix.com/',
				'https://www.commerce.gov/news/press-releases/2024/12/biden-harris-administration-announces-chips-incentives-award-sk-hynix'
			]
		},
		{
			id: 'micron',
			name: 'Micron Technology',
			kind: 'company',
			level: 'private',
			founded: '1978',
			seat: 'Boise',
			url: 'https://www.micron.com',
			summary: 'Only US memory maker; supplies HBM to Nvidia and AMD.',
			responsibilities: ['Makes DRAM, HBM, NAND', 'Building fabs in Idaho and New York'],
			obligations: [
				'US securities law (SEC reporting, Sarbanes-Oxley)',
				'US CHIPS award (~US$6.1bn) conditions',
				'China CAC ban on Micron in critical infrastructure (2023)'
			],
			accountableTo: ['Shareholders'],
			overlaps: [],
			sources: [
				'https://investors.micron.com/',
				'https://www.commerce.gov/news/press-releases/2024/12/biden-harris-administration-announces-chips-incentives-award-micron'
			]
		},
		{
			id: 'nvidia',
			name: 'Nvidia',
			kind: 'company',
			level: 'private',
			founded: '1993',
			seat: 'Santa Clara',
			url: 'https://www.nvidia.com',
			summary:
				'Dominant AI accelerator designer (Blackwell, Vera Rubin) and an increasingly large investor in its own customers.',
			responsibilities: [
				'Designs GPUs, NVLink, networking, CUDA software',
				'Invests in labs and neoclouds (OpenAI, Anthropic, xAI, CoreWeave, Intel)',
				'Licensed H20/H200 sales to China under BIS rules'
			],
			obligations: [
				'US securities law (SEC reporting, Sarbanes-Oxley)',
				'US Export Administration Regulations (EAR) on advanced chips',
				'Licences to China subject to case-by-case review and fees to US government'
			],
			accountableTo: ['Shareholders', 'united-states-government (export licensing)'],
			overlaps: [
				{
					with: 'openai',
					note: 'Supplier and investor at once: equity returns as chip purchases (circular deal).'
				},
				{
					with: 'coreweave',
					note: 'Investor, supplier and capacity backstop buyer for the same company.'
				},
				{
					with: 'amd',
					note: 'Direct competitor in GPUs; both carry China licence conditions.'
				}
			],
			sources: [
				'https://nvidianews.nvidia.com/',
				'https://nvidianews.nvidia.com/news/nvidia-and-coreweave-strengthen-collaboration-to-accelerate-buildout-of-ai-factories'
			]
		},
		{
			id: 'amd',
			name: 'Advanced Micro Devices',
			kind: 'company',
			level: 'private',
			founded: '1969',
			seat: 'Santa Clara',
			url: 'https://www.amd.com',
			summary:
				'Second GPU supplier (Instinct MI350/MI450); gave OpenAI warrants for up to ~10% of its shares.',
			responsibilities: [
				'Designs Instinct GPUs and EPYC CPUs',
				'6 GW OpenAI deal; 6 GW-class Meta deal',
				'Fabless; manufactures at TSMC'
			],
			obligations: [
				'US securities law (SEC reporting, Sarbanes-Oxley)',
				'US Export Administration Regulations (EAR) on advanced chips'
			],
			accountableTo: ['Shareholders'],
			overlaps: [
				{
					with: 'nvidia',
					note: "Competitor; AMD offers equity-for-purchase terms (warrants) like Nvidia's circular deals."
				}
			],
			sources: [
				'https://ir.amd.com/news-events/press-releases/detail/1260/amd-and-openai-announce-strategic-partnership'
			]
		},
		{
			id: 'broadcom',
			name: 'Broadcom',
			kind: 'company',
			level: 'private',
			founded: '1961',
			seat: 'Palo Alto',
			url: 'https://www.broadcom.com',
			summary: 'Designs custom AI ASICs (Google TPU, OpenAI chips) and AI networking.',
			responsibilities: [
				'Co-designs Google TPUs',
				'10 GW custom accelerator deal with OpenAI',
				'Supplies TPU capacity for Anthropic'
			],
			obligations: [
				'US securities law (SEC reporting, Sarbanes-Oxley)',
				'US Export Administration Regulations (EAR) on advanced chips'
			],
			accountableTo: ['Shareholders'],
			overlaps: [],
			sources: [
				'https://openai.com/index/openai-and-broadcom-announce-strategic-collaboration/',
				'https://www.hpcwire.com/off-the-wire/anthropic-signs-google-broadcom-deal-to-add-multi-gigawatt-tpu-capacity/'
			]
		},
		{
			id: 'arm',
			name: 'Arm Holdings',
			kind: 'company',
			level: 'private',
			founded: '1990',
			seat: 'Cambridge (UK)',
			url: 'https://www.arm.com',
			summary:
				'Licenses the CPU instruction set used in Nvidia Grace, AWS Graviton and most phones; ~90% owned by SoftBank.',
			responsibilities: [
				'Licenses CPU architectures and cores',
				'Designs compute subsystems for data-centre chips'
			],
			obligations: [
				'US securities law (SEC reporting, Sarbanes-Oxley) (Nasdaq listing)',
				'UK National Security and Investment Act'
			],
			accountableTo: ['Shareholders', 'softbank (~90%)'],
			overlaps: [],
			sources: ['https://www.arm.com/company', 'https://group.softbank/en/ir']
		},
		{
			id: 'applied-materials',
			name: 'Applied Materials',
			kind: 'company',
			level: 'private',
			founded: '1967',
			seat: 'Santa Clara',
			url: 'https://www.appliedmaterials.com',
			summary: 'Largest US maker of deposition and etch tools for fabs.',
			responsibilities: ['Supplies deposition, etch, inspection tools to all fabs'],
			obligations: [
				'US securities law (SEC reporting, Sarbanes-Oxley)',
				'US Export Administration Regulations (EAR) on advanced chips'
			],
			accountableTo: ['Shareholders'],
			overlaps: [
				{
					with: 'lam-research',
					note: 'Overlapping etch/deposition product lines; fabs multi-source.'
				},
				{
					with: 'tokyo-electron',
					note: 'Same tool categories under a different (Japanese) export regime.'
				}
			],
			sources: ['https://www.appliedmaterials.com/us/en/corporate.html']
		},
		{
			id: 'lam-research',
			name: 'Lam Research',
			kind: 'company',
			level: 'private',
			founded: '1980',
			seat: 'Fremont',
			url: 'https://www.lamresearch.com',
			summary: 'US leader in etch tools critical for HBM and 3D NAND.',
			responsibilities: ['Supplies etch and deposition tools'],
			obligations: [
				'US securities law (SEC reporting, Sarbanes-Oxley)',
				'US Export Administration Regulations (EAR) on advanced chips'
			],
			accountableTo: ['Shareholders'],
			overlaps: [],
			sources: ['https://investor.lamresearch.com/']
		},
		{
			id: 'tokyo-electron',
			name: 'Tokyo Electron',
			acronym: 'TEL',
			kind: 'company',
			level: 'private',
			founded: '1963',
			seat: 'Tokyo',
			url: 'https://www.tel.com',
			summary: "Japan's largest fab-tool maker (coaters, etch, deposition).",
			responsibilities: ['Supplies track, etch, deposition tools'],
			obligations: ['Japan Foreign Exchange and Foreign Trade Act export controls (METI)'],
			accountableTo: ['Shareholders', 'japan-government (METI licensing)'],
			overlaps: [
				{
					with: 'applied-materials',
					note: 'Competes in the same tool segments; China rules differ by regime (BIS vs METI).'
				}
			],
			sources: ['https://www.tel.com/about/']
		},
		{
			id: 'cadence',
			name: 'Cadence Design Systems',
			kind: 'company',
			level: 'private',
			founded: '1988',
			seat: 'San Jose',
			url: 'https://www.cadence.com',
			summary: 'One of two dominant EDA vendors used to design every advanced chip.',
			responsibilities: ['Chip design software and IP', 'Verification hardware'],
			obligations: [
				'US securities law (SEC reporting, Sarbanes-Oxley)',
				'US Export Administration Regulations (EAR) on advanced chips (EDA for GAA nodes)'
			],
			accountableTo: ['Shareholders'],
			overlaps: [
				{
					with: 'synopsys',
					note: 'Duopoly in EDA; both were briefly restricted from China in mid-2025.'
				}
			],
			sources: ['https://www.cadence.com/en_US/home/company.html']
		},
		{
			id: 'synopsys',
			name: 'Synopsys',
			kind: 'company',
			level: 'private',
			founded: '1986',
			seat: 'Sunnyvale',
			url: 'https://www.synopsys.com',
			summary: 'Largest EDA and chip-IP vendor; Nvidia invested US$2bn in 2025.',
			responsibilities: ['Chip design software, IP', 'Simulation (Ansys, acquired 2025)'],
			obligations: [
				'US securities law (SEC reporting, Sarbanes-Oxley)',
				'US Export Administration Regulations (EAR) on advanced chips'
			],
			accountableTo: ['Shareholders'],
			overlaps: [],
			sources: ['https://news.synopsys.com/']
		},
		{
			id: 'huawei',
			name: 'Huawei',
			kind: 'company',
			level: 'private',
			founded: '1987',
			seat: 'Shenzhen',
			url: 'https://www.huawei.com',
			summary: "China's main AI-chip designer (Ascend); on the US Entity List.",
			responsibilities: [
				'Designs Ascend accelerators and supernodes',
				'Supplies compute to DeepSeek and Chinese clouds'
			],
			obligations: ['US Entity List restrictions', 'Chinese law and state AI-chip policy'],
			accountableTo: ['Employee-owned via union', 'china-government (policy)'],
			overlaps: [
				{
					with: 'nvidia',
					note: 'Beijing steers buyers from Nvidia to Huawei; overlapping national-champion vs import roles.'
				}
			],
			sources: [
				'https://www.huawei.com/en/corporate-information',
				'https://www.trendforce.com/news/2026/04/29/news-huawei-ascend-cambricon-and-hygon-completed-day-0-adaptation-to-deepseek-v4/'
			]
		},
		{
			id: 'smic',
			name: 'Semiconductor Manufacturing International Corporation',
			acronym: 'SMIC',
			kind: 'company',
			level: 'private',
			founded: '2000',
			seat: 'Shanghai',
			url: 'https://www.smics.com',
			summary: "China's largest foundry; makes Huawei Ascend chips at 7nm-class without EUV.",
			responsibilities: ['Contract chipmaking', 'Fabricates Huawei Ascend dies'],
			obligations: ['US Entity List restrictions', 'HKEX/STAR listing rules'],
			accountableTo: ['Shareholders (incl. state funds)', 'china-big-fund'],
			overlaps: [],
			sources: ['https://www.smics.com/en/site/about_summary']
		},
		{
			id: 'microsoft',
			name: 'Microsoft',
			kind: 'company',
			level: 'private',
			founded: '1975',
			seat: 'Redmond',
			url: 'https://www.microsoft.com',
			summary: 'Azure cloud; holds ~27% of OpenAI Group PBC and invested in Anthropic.',
			responsibilities: [
				'Runs Azure AI infrastructure',
				'Exclusive OpenAI API reseller (to 2032 IP rights)',
				'Hosts Anthropic models; builds own MAI models'
			],
			obligations: [
				'US securities law (SEC reporting, Sarbanes-Oxley)',
				'EU AI Act GPAI obligations',
				'Frontier Model Forum commitments'
			],
			accountableTo: ['Shareholders'],
			overlaps: [
				{
					with: 'openai',
					note: 'Investor, landlord and competitor (own MAI models, Copilot) at once.'
				},
				{
					with: 'amazon',
					note: 'Both clouds invest in labs that also buy their capacity.'
				}
			],
			sources: [
				'https://blogs.microsoft.com/blog/2025/10/28/the-next-chapter-of-the-microsoft-openai-partnership/'
			]
		},
		{
			id: 'amazon',
			name: 'Amazon (AWS)',
			kind: 'company',
			level: 'private',
			founded: '1994',
			seat: 'Seattle',
			url: 'https://aws.amazon.com',
			summary:
				"Largest cloud; Anthropic's primary training partner (Trainium) and a US$50bn OpenAI investor.",
			responsibilities: [
				'Runs AWS and Trainium chips',
				'Hosts Claude on Bedrock; Project Rainier',
				'Invested in both Anthropic and OpenAI'
			],
			obligations: [
				'US securities law (SEC reporting, Sarbanes-Oxley)',
				'EU AI Act / DMA obligations'
			],
			accountableTo: ['Shareholders'],
			overlaps: [
				{
					with: 'alphabet-google',
					note: 'Both are major Anthropic shareholders and compute suppliers.'
				},
				{
					with: 'anthropic',
					note: 'Investor and supplier, and a competitor via its own Nova models.'
				}
			],
			sources: [
				'https://www.aboutamazon.com/news/company-news/amazon-anthropic-ai-investment',
				'https://siliconangle.com/2026/04/20/amazon-invest-25b-anthropic-part-expanded-cloud-partnership/'
			]
		},
		{
			id: 'alphabet-google',
			name: 'Alphabet (Google)',
			kind: 'company',
			level: 'private',
			founded: '1998',
			seat: 'Mountain View',
			url: 'https://abc.xyz',
			summary:
				'Owns Google Cloud, TPUs and DeepMind; major Anthropic shareholder and TPU supplier.',
			responsibilities: [
				'Designs TPUs (with Broadcom)',
				'Google Cloud infrastructure',
				'Owns Google DeepMind (Gemini)'
			],
			obligations: [
				'US securities law (SEC reporting, Sarbanes-Oxley)',
				'EU DMA gatekeeper and AI Act duties',
				'US antitrust remedies (search case)'
			],
			accountableTo: ['Shareholders'],
			overlaps: [
				{
					with: 'anthropic',
					note: 'Invests in and supplies a direct Gemini competitor.'
				}
			],
			sources: [
				'https://abc.xyz/investor/',
				'https://www.anthropic.com/news/expanding-our-use-of-google-cloud-tpus-and-services'
			]
		},
		{
			id: 'google-deepmind',
			name: 'Google DeepMind',
			kind: 'company',
			level: 'private',
			founded: '2010',
			seat: 'London',
			url: 'https://deepmind.google',
			summary: "Alphabet's frontier lab building Gemini.",
			responsibilities: ['Develops Gemini models', 'Frontier safety research'],
			obligations: ['EU AI Act GPAI code of practice', 'CAISI and UK AISI testing agreements'],
			accountableTo: ['alphabet-google'],
			overlaps: [],
			sources: [
				'https://deepmind.google/about/',
				'https://digitalpolicyalert.org/event/39699-center-for-ai-standards-and-innovation-signed-frontier-ai-national-security-testing-agreements-with-google-deepmind-microsoft-and-xai'
			]
		},
		{
			id: 'oracle',
			name: 'Oracle (OCI)',
			kind: 'company',
			level: 'private',
			founded: '1977',
			seat: 'Austin',
			url: 'https://www.oracle.com',
			summary: "Cloud builder of OpenAI's Stargate sites under a ~US$300bn, 4.5 GW contract.",
			responsibilities: ['Builds and operates Stargate data centres', 'Partner in Stargate UAE'],
			obligations: ['US securities law (SEC reporting, Sarbanes-Oxley)'],
			accountableTo: ['Shareholders'],
			overlaps: [],
			sources: [
				'https://www.tomshardware.com/tech-industry/oracle-rebuts-incorrect-reporting-on-stargate-expansion'
			]
		},
		{
			id: 'coreweave',
			name: 'CoreWeave',
			kind: 'company',
			level: 'private',
			founded: '2017',
			seat: 'Livingston (NJ)',
			url: 'https://www.coreweave.com',
			summary: "Largest GPU 'neocloud'; Nvidia is a top shareholder and backstop customer.",
			responsibilities: ['Rents Nvidia GPU capacity', 'Contracts with OpenAI, Meta, Microsoft'],
			obligations: ['US securities law (SEC reporting, Sarbanes-Oxley)'],
			accountableTo: ['Shareholders (incl. nvidia)'],
			overlaps: [
				{
					with: 'nvidia',
					note: 'Customer, investee and capacity off-taker of the same firm.'
				}
			],
			sources: [
				'https://datacenterknowledge.com/investing/nvidia-invests-2b-more-in-coreweave-for-5-gw-data-center-push'
			]
		},
		{
			id: 'meta',
			name: 'Meta Platforms',
			kind: 'company',
			level: 'private',
			founded: '2004',
			seat: 'Menlo Park',
			url: 'https://about.meta.com',
			summary:
				'Builds open-weight Llama models and gigawatt data centres (Hyperion); 2026 capex US$125-145bn.',
			responsibilities: [
				'Meta Superintelligence Labs',
				'Hyperion and Prometheus data centres',
				'Buys Nvidia, AMD and rents Google TPUs'
			],
			obligations: [
				'US securities law (SEC reporting, Sarbanes-Oxley)',
				'EU AI Act (declined GPAI code of practice)',
				'EU DSA/DMA'
			],
			accountableTo: ['Shareholders (Zuckerberg control)'],
			overlaps: [],
			sources: [
				'https://www.businesstoday.in/technology/news/story/meta-bets-billions-on-google-to-power-its-ai-ambitions-518270-2026-02-27'
			]
		},
		{
			id: 'openai-foundation',
			name: 'OpenAI Foundation',
			kind: 'nonprofit',
			level: 'private',
			founded: '2015',
			seat: 'San Francisco',
			url: 'https://openai.com/foundation',
			summary:
				'Nonprofit that controls OpenAI Group PBC and holds ~26% of it after the Oct 2025 recapitalisation.',
			responsibilities: [
				'Appoints the PBC board',
				'Funds health and AI-resilience grants (US$25bn pledge)'
			],
			obligations: [
				'Delaware and California AG conditions on the recapitalisation',
				'US nonprofit (501(c)(3)) law'
			],
			accountableTo: ['Delaware and California Attorneys General'],
			overlaps: [],
			sources: [
				'https://openai.com/index/built-to-benefit-everyone/',
				'https://www.mediapost.com/publications/article/410233/openai-restructures-microsoft-takes-27-stake-in.html'
			]
		},
		{
			id: 'openai',
			name: 'OpenAI Group PBC',
			kind: 'company',
			level: 'private',
			founded: '2015',
			seat: 'San Francisco',
			url: 'https://openai.com',
			summary:
				'Maker of ChatGPT; public benefit corporation valued at ~US$1.25tn (Nov 2026 first close).',
			responsibilities: [
				'Develops GPT models and ChatGPT',
				'Stargate compute build-out (~30 GW in commitments)'
			],
			obligations: [
				'Delaware PBC law; Foundation control',
				'EU AI Act GPAI obligations',
				'CAISI pre-deployment testing agreement'
			],
			accountableTo: ['openai-foundation'],
			overlaps: [
				{
					with: 'microsoft',
					note: 'Partner and competitor; exclusivity loosened in 2025.'
				}
			],
			sources: [
				'https://openai.com/index/built-to-benefit-everyone/',
				'https://siliconangle.com/2026/11/06/openai-reportedly-raises-11b-in-new-funding-at-1-25t-valuation/'
			]
		},
		{
			id: 'anthropic',
			name: 'Anthropic',
			kind: 'company',
			level: 'private',
			founded: '2021',
			seat: 'San Francisco',
			url: 'https://www.anthropic.com',
			summary: 'Maker of Claude; public benefit corporation valued at US$965bn (May 2026).',
			responsibilities: ['Develops Claude models', 'Multi-chip strategy: Trainium, TPU, Nvidia'],
			obligations: [
				'Delaware PBC law; Long-Term Benefit Trust',
				'EU AI Act GPAI code of practice',
				'CAISI and UK AISI testing agreements'
			],
			accountableTo: ['Long-Term Benefit Trust and shareholders'],
			overlaps: [
				{
					with: 'amazon',
					note: 'Its two largest backers (Amazon, Google) are also its compute suppliers and competitors.'
				}
			],
			sources: ['https://www.anthropic.com/company', 'https://www.anthropic.com/news/series-h']
		},
		{
			id: 'spacex-xai',
			name: 'SpaceX (incl. xAI)',
			kind: 'company',
			level: 'private',
			founded: '2002',
			seat: 'Starbase (TX)',
			url: 'https://x.ai',
			summary: 'xAI (Grok, Colossus) merged into SpaceX in Feb 2026 at ~US$1.25tn combined.',
			responsibilities: [
				'Develops Grok models',
				'Runs Colossus supercomputers in Memphis',
				'Owns X (Twitter)'
			],
			obligations: ['US law; CAISI testing agreement (May 2026)', 'EU DSA for X'],
			accountableTo: ['Shareholders (Musk control)'],
			overlaps: [],
			sources: [
				'https://fortune.com/2026/02/02/elon-musk-spacex-xai-ipo-trillion',
				'https://nairametrics.com/2026/02/03/musks-spacex-merges-xai-in-deal-valued-at-1-25-trillion/'
			]
		},
		{
			id: 'mistral-ai',
			name: 'Mistral AI',
			kind: 'company',
			level: 'private',
			founded: '2023',
			seat: 'Paris',
			url: 'https://mistral.ai',
			summary: "Europe's leading frontier lab; raised EUR3bn at >EUR21bn (Sept 2026).",
			responsibilities: ['Open and proprietary models', 'Mistral Compute data centres in France'],
			obligations: ['EU AI Act GPAI obligations', 'French corporate law'],
			accountableTo: ['Shareholders (ASML ~11%)'],
			overlaps: [],
			sources: [
				'https://www.euronews.com/2026/09/08/mistral-ai-raises-record-3-billion-in-samsung-led-funding-round'
			]
		},
		{
			id: 'deepseek',
			name: 'DeepSeek',
			kind: 'company',
			level: 'private',
			founded: '2023',
			seat: 'Hangzhou',
			url: 'https://www.deepseek.com',
			summary:
				'Chinese open-weight lab funded by hedge fund High-Flyer; V4 (Apr 2026) adapted to Huawei Ascend.',
			responsibilities: ['Open-weight models (V3, R1, V4)', 'Co-optimises with Chinese chips'],
			obligations: ['China generative AI measures (CAC filing)', 'Data security law'],
			accountableTo: ['High-Flyer; CAC'],
			overlaps: [],
			sources: [
				'https://thenextweb.com/news/deepseek-v4-pro-flash-launch-open-source',
				'https://techwireasia.com/2026/04/deepseek-v4-huawei-ai-chips/'
			]
		},
		{
			id: 'alibaba',
			name: 'Alibaba Group (Qwen)',
			kind: 'company',
			level: 'private',
			founded: '1999',
			seat: 'Hangzhou',
			url: 'https://www.alibabagroup.com',
			summary: 'Chinese cloud leader; Qwen open-weight models; investor in Moonshot.',
			responsibilities: ['Alibaba Cloud', 'Qwen models', 'Designs own AI chips (T-Head)'],
			obligations: ['China CAC rules', 'US/HK listing rules'],
			accountableTo: ['Shareholders'],
			overlaps: [],
			sources: ['https://www.alibabagroup.com/en-US/about-alibaba']
		},
		{
			id: 'moonshot-ai',
			name: 'Moonshot AI (Kimi)',
			kind: 'company',
			level: 'private',
			founded: '2023',
			seat: 'Beijing',
			url: 'https://www.moonshot.ai',
			summary: 'Chinese lab behind Kimi; valued ~US$35bn (Jul 2026), reportedly higher since.',
			responsibilities: ['Kimi open-weight models'],
			obligations: ['China CAC rules'],
			accountableTo: ['Shareholders (Alibaba, Meituan, Tencent)'],
			overlaps: [],
			sources: [
				'https://www.yicaiglobal.com/news/moonshot-ais-latest-fundraiser-lifts-valuation-to-usd35-billion-amid-kimis-silicon-valley-buzz'
			]
		},
		{
			id: 'safe-superintelligence',
			name: 'Safe Superintelligence',
			acronym: 'SSI',
			kind: 'company',
			level: 'private',
			founded: '2024',
			seat: 'Palo Alto / Tel Aviv',
			url: 'https://ssi.inc',
			summary:
				"Ilya Sutskever's research lab; last confirmed valuation US$32bn (Apr 2025); runs on Google TPUs.",
			responsibilities: ['Superintelligence research, no product'],
			obligations: ['US corporate law'],
			accountableTo: ['Shareholders'],
			overlaps: [],
			sources: [
				'https://ssi.inc',
				'https://aimagazine.com/news/safe-superintelligence-sutskever-nvidia-and-a-us-32bn-ai-b'
			]
		},
		{
			id: 'softbank',
			name: 'SoftBank Group',
			kind: 'investor',
			level: 'private',
			founded: '1981',
			seat: 'Tokyo',
			url: 'https://group.softbank',
			summary: 'Largest outside OpenAI investor (~11%) and Stargate lead; owns ~90% of Arm.',
			responsibilities: ['Invests in OpenAI, Arm, Intel', 'Leads Stargate LLC financing'],
			obligations: ['Tokyo Stock Exchange rules', 'Japanese corporate law'],
			accountableTo: ['Shareholders (Son control)'],
			overlaps: [],
			sources: [
				'https://group.softbank/en/news/press',
				'https://finance.yahoo.com/markets/stocks/articles/openai-closes-122bn-funding-round-093126735.html'
			]
		},
		{
			id: 'mgx',
			name: 'MGX',
			kind: 'investor',
			level: 'national',
			founded: '2024',
			seat: 'Abu Dhabi',
			url: 'https://www.mgx.ae',
			summary: 'Abu Dhabi state AI investor (Mubadala, G42); Stargate equity partner.',
			responsibilities: [
				'Invests in OpenAI, xAI, Anthropic, Stargate',
				'Co-founded AI Infrastructure Partnership'
			],
			obligations: ['UAE sovereign investment rules'],
			accountableTo: ['uae-government'],
			overlaps: [
				{
					with: 'pif',
					note: 'Gulf sovereign funds compete for the same AI infrastructure deals.'
				}
			],
			sources: ['https://www.mgx.ae/en/news']
		},
		{
			id: 'pif',
			name: 'Public Investment Fund',
			acronym: 'PIF',
			kind: 'investor',
			level: 'national',
			founded: '1971',
			seat: 'Riyadh',
			url: 'https://www.pif.gov.sa',
			summary: 'Saudi sovereign fund; owns Humain.',
			responsibilities: ['Funds Humain and data-centre build-out'],
			obligations: ['Saudi PIF law'],
			accountableTo: ['saudi-arabia-government'],
			overlaps: [],
			sources: [
				'https://www.pif.gov.sa/en/news-and-insights/press-releases/2025/hrh-crown-prince-launches-humain-as-global-ai-powerhouse/'
			]
		},
		{
			id: 'humain',
			name: 'Humain',
			kind: 'company',
			level: 'national',
			founded: '2025',
			seat: 'Riyadh',
			url: 'https://www.humain.com',
			summary:
				'PIF-owned Saudi AI company buying Nvidia/AMD chips; licensed for Blackwell exports Nov 2025.',
			responsibilities: ['Builds Saudi data centres', 'Arabic models; xAI 500 MW JV'],
			obligations: ['US export licence security conditions'],
			accountableTo: ['pif'],
			overlaps: [],
			sources: [
				'https://www.thenationalnews.com/future/technology/2025/11/20/uae-ai-nvidia-chips-us/'
			]
		},
		{
			id: 'qia',
			name: 'Qatar Investment Authority',
			acronym: 'QIA',
			kind: 'investor',
			level: 'national',
			founded: '2005',
			seat: 'Doha',
			url: 'https://www.qia.qa',
			summary: 'Qatari sovereign fund; investor in Anthropic and xAI.',
			responsibilities: ['Late-stage AI lab investments'],
			obligations: ['Qatari sovereign fund law'],
			accountableTo: ['Qatar government'],
			overlaps: [],
			sources: [
				'https://www.anthropic.com/news/anthropic-raises-series-f-at-usd183b-post-money-valuation'
			]
		},
		{
			id: 'g42',
			name: 'G42',
			kind: 'company',
			level: 'national',
			founded: '2018',
			seat: 'Abu Dhabi',
			url: 'https://www.g42.ai',
			summary: 'UAE state-linked AI group; builds Stargate UAE; Microsoft holds a US$1.5bn stake.',
			responsibilities: ['Builds 1 GW Stargate UAE (5 GW campus)', 'AI cloud and models'],
			obligations: ['US export licence security conditions'],
			accountableTo: ['uae-government'],
			overlaps: [],
			sources: [
				'https://gulfnews.com/business/economy/g42-gets-us-approval-for-advanced-ai-chip-exports-1.500353606'
			]
		},
		{
			id: 'china-big-fund',
			name: 'China Integrated Circuit Industry Investment Fund',
			acronym: 'Big Fund',
			kind: 'programme',
			level: 'national',
			founded: '2014',
			seat: 'Beijing',
			summary: 'State chip fund; Phase III (2024) holds RMB344bn for chips, tools and HBM.',
			responsibilities: ['Equity in SMIC, tool makers, memory'],
			obligations: ['Chinese state-asset rules'],
			accountableTo: ['china-government (MIIT, MOF)'],
			overlaps: [],
			sources: [
				'https://www.reuters.com/technology/china-sets-up-475-bln-state-fund-boost-semiconductor-industry-2024-05-27/'
			]
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
			summary: 'Sets export controls, CHIPS subsidies and AI policy; holds ~10% of Intel.',
			responsibilities: [
				"America's AI Action Plan (2025)",
				'Export controls via Commerce/BIS',
				'Equity stakes (Intel)'
			],
			obligations: [
				'US Constitution; Congress appropriations',
				'CHIPS and Science Act 2022',
				'Export Control Reform Act 2018'
			],
			accountableTo: ['US Congress', 'US voters'],
			overlaps: [
				{
					with: 'china-government',
					note: 'Mutual export controls (chips vs rare earths) under a truce.'
				}
			],
			sources: [
				'https://www.whitehouse.gov/articles/2025/07/white-house-unveils-americas-ai-action-plan/'
			]
		},
		{
			id: 'us-bis',
			name: 'Bureau of Industry and Security',
			acronym: 'BIS',
			kind: 'agency',
			level: 'national',
			founded: '1950',
			seat: 'Washington, D.C.',
			url: 'https://www.bis.gov',
			summary: 'Commerce agency running US export controls on chips, tools and model weights.',
			responsibilities: [
				'Licenses H200/MI325X to China case-by-case (Jan 2026)',
				'Entity List',
				'Gulf chip export approvals'
			],
			obligations: ['Export Control Reform Act 2018', 'EAR'],
			accountableTo: ['united-states-government (Commerce Secretary)'],
			overlaps: [
				{
					with: 'netherlands-government',
					note: 'Dutch licensing of ASML overlaps US FDP rules; aligned by negotiation.'
				},
				{
					with: 'japan-government',
					note: 'METI controls on Japanese tools overlap BIS; aligned by 2023 trilateral deal.'
				}
			],
			sources: [
				'https://www.bis.gov/',
				'https://introl.com/blog/bis-export-policy-h200-mi325x-china-case-by-case-2026'
			]
		},
		{
			id: 'chips-program-office',
			name: 'CHIPS Program Office',
			kind: 'programme',
			level: 'national',
			founded: '2022',
			seat: 'Washington, D.C.',
			url: 'https://www.nist.gov/chips',
			summary: 'Commerce office administering CHIPS Act manufacturing incentives (US$39bn).',
			responsibilities: [
				'Grants to TSMC, Samsung, Micron, SK hynix',
				'Converted Intel grants into equity (2025)'
			],
			obligations: ['CHIPS and Science Act 2022'],
			accountableTo: ['united-states-government (Commerce)'],
			overlaps: [],
			sources: ['https://www.nist.gov/chips']
		},
		{
			id: 'nist',
			name: 'National Institute of Standards and Technology',
			acronym: 'NIST',
			kind: 'agency',
			level: 'national',
			founded: '1901',
			seat: 'Gaithersburg',
			url: 'https://www.nist.gov',
			summary: 'Commerce standards agency; houses CAISI and the AI Risk Management Framework.',
			responsibilities: ['AI RMF and standards', 'Hosts CAISI and CHIPS office'],
			obligations: ['NIST Organic Act'],
			accountableTo: ['united-states-government (Commerce)'],
			overlaps: [],
			sources: ['https://www.nist.gov/artificial-intelligence']
		},
		{
			id: 'caisi',
			name: 'Center for AI Standards and Innovation',
			acronym: 'CAISI',
			kind: 'agency',
			level: 'national',
			founded: '2023',
			seat: 'Gaithersburg',
			url: 'https://www.nist.gov/caisi',
			summary:
				'Former US AI Safety Institute (renamed Jun 2025); tests frontier models pre-deployment.',
			responsibilities: [
				'Voluntary pre-deployment testing of all major US labs',
				'Evaluates foreign (e.g. DeepSeek) models',
				'40+ model assessments'
			],
			obligations: ['Directives from Commerce Secretary and AI Action Plan'],
			accountableTo: ['nist', 'united-states-government (Commerce)'],
			overlaps: [
				{
					with: 'uk-aisi',
					note: 'Both test the same frontier models; shared or joint evaluations reduce duplication.'
				}
			],
			sources: [
				'https://digitalpolicyalert.org/event/39699-center-for-ai-standards-and-innovation-signed-frontier-ai-national-security-testing-agreements-with-google-deepmind-microsoft-and-xai'
			]
		},
		{
			id: 'china-government',
			name: "Government of the People's Republic of China",
			kind: 'state',
			level: 'national',
			founded: '1949',
			seat: 'Beijing',
			url: 'https://english.www.gov.cn',
			summary: 'Runs chip self-sufficiency policy and rare-earth export controls.',
			responsibilities: [
				'MOFCOM export controls on rare earths, gallium, germanium',
				'Big Fund chip subsidies',
				'Discourages Nvidia purchases'
			],
			obligations: ['PRC Export Control Law 2020', 'US-China trade truce (Nov 2025)'],
			accountableTo: ['Chinese Communist Party'],
			overlaps: [
				{
					with: 'united-states-government',
					note: 'Mirror-image export-control regimes; truce suspends parts of both.'
				}
			],
			sources: [
				'https://www.spglobal.com/energy/en/news-research/latest-news/metals/110926-china-extends-rare-earth-export-suspension-to-january-2027'
			]
		},
		{
			id: 'netherlands-government',
			name: 'Government of the Netherlands',
			officialName: 'Rijksoverheid',
			kind: 'state',
			level: 'national',
			founded: '1815',
			seat: 'The Hague',
			url: 'https://www.government.nl',
			summary: 'Licenses ASML exports of EUV and advanced DUV tools and servicing.',
			responsibilities: [
				'Export licences for lithography to China',
				'Spare-parts and servicing licences'
			],
			obligations: ['EU dual-use regulation 2021/821', 'Wassenaar Arrangement'],
			accountableTo: ['Dutch parliament'],
			overlaps: [
				{
					with: 'us-bis',
					note: 'Parallel controls over the same ASML machines; pushback on US MATCH Act.'
				}
			],
			sources: [
				'https://www.government.nl/topics/export-controls-of-strategic-goods',
				'https://bits-chips.com/article/dutch-minister-pushes-back-on-us-bid-to-tighten-china-chip-controls/'
			]
		},
		{
			id: 'taiwan-government',
			name: 'Government of Taiwan',
			kind: 'state',
			level: 'national',
			founded: '1949',
			seat: 'Taipei',
			url: 'https://www.ey.gov.tw',
			summary: 'Largest TSMC shareholder; restricts export of most advanced nodes.',
			responsibilities: ['N-2 rule for overseas fabs', 'Export controls (added Huawei, SMIC 2025)'],
			obligations: ['Act for Industrial Innovation'],
			accountableTo: ['Legislative Yuan'],
			overlaps: [],
			sources: ['https://www.ey.gov.tw/']
		},
		{
			id: 'japan-government',
			name: 'Government of Japan',
			kind: 'state',
			level: 'national',
			founded: '1947',
			seat: 'Tokyo',
			url: 'https://www.meti.go.jp/english',
			summary: 'Funds Rapidus and TSMC Kumamoto; METI controls chip-tool exports.',
			responsibilities: ['Rapidus subsidies (~JPY2.35tn R&D)', 'Export controls on tools'],
			obligations: ['Foreign Exchange and Foreign Trade Act'],
			accountableTo: ['National Diet'],
			overlaps: [
				{
					with: 'us-bis',
					note: 'Overlapping tool export controls aligned since 2023.'
				}
			],
			sources: ['https://www.theregister.com/2026/02/27/rapidus_funding/']
		},
		{
			id: 'rapidus',
			name: 'Rapidus',
			kind: 'company',
			level: 'national',
			founded: '2022',
			seat: 'Tokyo',
			url: 'https://www.rapidus.inc',
			summary:
				'Japanese state-backed 2nm foundry targeting 2027 mass production; government golden share.',
			responsibilities: ['2nm pilot line in Hokkaido (IBM tech)'],
			obligations: ['IPA investment terms, golden share'],
			accountableTo: ['japan-government'],
			overlaps: [],
			sources: [
				'https://english.adnkronos.com/2026/02/27/rapidus-gets-267-6-b-yen-in-public-private-funds/'
			]
		},
		{
			id: 'south-korea-government',
			name: 'Government of the Republic of Korea',
			kind: 'state',
			level: 'national',
			founded: '1948',
			seat: 'Sejong',
			url: 'https://www.motie.go.kr/eng',
			summary: 'Supports Samsung and SK hynix with tax credits and a KRW100tn+ AI fund.',
			responsibilities: ['K-Chips Act tax credits', 'National AI computing centre'],
			obligations: ['AI Basic Act (in force Jan 2026)'],
			accountableTo: ['National Assembly'],
			overlaps: [],
			sources: ['https://www.motie.go.kr/eng']
		},
		{
			id: 'uk-government',
			name: 'UK government',
			kind: 'state',
			level: 'national',
			founded: '1707',
			seat: 'London',
			url: 'https://www.gov.uk',
			summary: 'Runs the AI Security Institute and AI Opportunities Action Plan.',
			responsibilities: ['Funds UK AISI', 'AI Growth Zones'],
			obligations: ['UK law; no AI-specific statute'],
			accountableTo: ['UK Parliament'],
			overlaps: [],
			sources: ['https://www.gov.uk/government/publications/ai-opportunities-action-plan']
		},
		{
			id: 'uk-aisi',
			name: 'AI Security Institute',
			acronym: 'AISI',
			kind: 'agency',
			level: 'national',
			founded: '2023',
			seat: 'London',
			url: 'https://www.aisi.gov.uk',
			summary: 'UK state body testing frontier models (renamed from AI Safety Institute Feb 2025).',
			responsibilities: [
				'Pre-deployment testing',
				'Security-focused research',
				'Alignment Project grants'
			],
			obligations: ['DSIT direction'],
			accountableTo: ['uk-government (DSIT)'],
			overlaps: [
				{
					with: 'caisi',
					note: 'Overlapping national testing remits; coordinated via MoU and joint tests.'
				}
			],
			sources: ['https://www.aisi.gov.uk/']
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
			summary: 'Sets the AI Act, EU Chips Act and AI gigafactory funding.',
			responsibilities: [
				'AI Act (GPAI rules since Aug 2025)',
				'Chips Act',
				'Dual-use export regulation'
			],
			obligations: ['EU Treaties'],
			accountableTo: ['EU citizens via Parliament and Council'],
			overlaps: [],
			sources: ['https://european-union.europa.eu/']
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
			summary: 'EU executive implementing the AI Act and Chips Act; proposed the AI Omnibus delay.',
			responsibilities: [
				'Enforces AI Act via AI Office',
				'InvestAI (EUR200bn target)',
				'Chips Act state-aid approvals'
			],
			obligations: ['EU Treaties; Regulation 2024/1689 and 2026/1744'],
			accountableTo: ['European Parliament', 'Council of the EU'],
			overlaps: [],
			sources: [
				'https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai',
				'https://www.addleshawgoddard.com/en/insights/insights-briefings/2026/technology/eu-ai-act-ai-omnibus-formally-adopted/'
			]
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
			summary: 'Commission unit supervising general-purpose AI models under the AI Act.',
			responsibilities: [
				'Supervises GPAI providers',
				'Runs GPAI Code of Practice',
				'Enforcement powers from Aug 2026'
			],
			obligations: ['AI Act (Reg. 2024/1689, amended 2026/1744)'],
			accountableTo: ['european-commission'],
			overlaps: [
				{
					with: 'uk-aisi',
					note: 'Both evaluate frontier models; AI Office is a regulator, AISI a tester.'
				}
			],
			sources: ['https://digital-strategy.ec.europa.eu/en/policies/ai-office']
		},
		{
			id: 'eurohpc-ju',
			name: 'EuroHPC Joint Undertaking',
			acronym: 'EuroHPC',
			kind: 'programme',
			level: 'european',
			founded: '2018',
			seat: 'Luxembourg',
			url: 'https://eurohpc-ju.europa.eu',
			summary: 'EU supercomputing body running AI Factories and the AI Gigafactories tender.',
			responsibilities: [
				'19 AI Factories',
				'AI gigafactory call (extended: lot 2 closes 3 Dec 2026, lot 1 on 4 Feb 2027)'
			],
			obligations: ['Council Regulation (EU) 2021/1173 as amended'],
			accountableTo: ['european-commission', 'Participating states'],
			overlaps: [],
			sources: [
				'https://www.eurohpc-ju.europa.eu/call-tenders-selection-artificial-intelligence-gigafactory-consortia-and-establishment-ai_en',
				'https://eurohpc-ju.europa.eu/'
			]
		},
		{
			id: 'uae-government',
			name: 'Government of the United Arab Emirates',
			acronym: 'UAE',
			kind: 'state',
			level: 'national',
			founded: '1971',
			seat: 'Abu Dhabi',
			url: 'https://u.ae',
			summary: 'Funds MGX and G42; partner in Stargate UAE under the US-UAE AI campus deal.',
			responsibilities: ['Sovereign AI investment', 'US chip-import security commitments'],
			obligations: ['US-UAE AI acceleration partnership'],
			accountableTo: ['Federal Supreme Council'],
			overlaps: [],
			sources: [
				'https://www.thenationalnews.com/future/technology/2025/11/20/uae-ai-nvidia-chips-us/'
			]
		},
		{
			id: 'saudi-arabia-government',
			name: 'Government of Saudi Arabia',
			kind: 'state',
			level: 'national',
			founded: '1932',
			seat: 'Riyadh',
			url: 'https://www.my.gov.sa',
			summary: 'Funds Humain via PIF; US Strategic AI Partnership (2025).',
			responsibilities: ['Vision 2030 AI build-out'],
			obligations: ['US chip export conditions'],
			accountableTo: ['King'],
			overlaps: [],
			sources: ['https://www.pif.gov.sa/']
		},
		{
			id: 'oecd',
			name: 'Organisation for Economic Co-operation and Development',
			acronym: 'OECD',
			kind: 'intergovernmental',
			level: 'global',
			founded: '1961',
			seat: 'Paris',
			url: 'https://oecd.ai',
			summary: 'Hosts the OECD AI Principles and the Hiroshima AI Process reporting framework.',
			responsibilities: [
				'AI Principles (2019, updated 2024)',
				'HAIP company transparency reports',
				'GPAI partnership'
			],
			obligations: ['OECD Convention'],
			accountableTo: ['Member governments'],
			overlaps: [
				{
					with: 'international-network-ai-safety-institutes',
					note: 'Both coordinate states on AI risk; OECD on policy, network on testing science.'
				}
			],
			sources: ['https://oecd.ai/en/ai-principles', 'https://oecd.ai/en/transparency']
		},
		{
			id: 'international-network-ai-safety-institutes',
			name: 'International Network for Advanced AI Measurement, Evaluation and Science',
			kind: 'intergovernmental',
			level: 'global',
			founded: '2024',
			seat: 'London (UK coordinates)',
			url: 'https://www.gov.uk/government/news/efforts-to-share-best-practices-on-ai-measurement-and-evaluations-driven-forward-through-the-international-network-for-advanced-ai-measurement-evalua',
			summary:
				'Network of national AI safety and security institutes (US, UK, EU, Japan, Korea, others) for joint testing; renamed from the International Network of AI Safety Institutes in Dec 2025.',
			responsibilities: ['Joint testing exercises', 'Shared evaluation methods'],
			obligations: ['Mission statement (San Francisco, Nov 2024); non-binding'],
			accountableTo: ['Member governments'],
			overlaps: [
				{
					with: 'oecd',
					note: 'Overlapping coordination; network focuses on technical evaluation.'
				}
			],
			sources: [
				'https://www.gov.uk/government/news/efforts-to-share-best-practices-on-ai-measurement-and-evaluations-driven-forward-through-the-international-network-for-advanced-ai-measurement-evalua'
			]
		},
		{
			id: 'frontier-model-forum',
			name: 'Frontier Model Forum',
			acronym: 'FMF',
			kind: 'nonprofit',
			level: 'global',
			founded: '2023',
			seat: 'Washington, D.C.',
			url: 'https://www.frontiermodelforum.org',
			summary: 'Industry body of frontier labs for safety best practice.',
			responsibilities: ['Safety frameworks and bio/cyber thresholds', 'AI Safety Fund'],
			obligations: ['Member commitments (voluntary)'],
			accountableTo: ['Member companies'],
			overlaps: [
				{
					with: 'mlcommons',
					note: 'Both industry-led; FMF does safety policy, MLCommons benchmarks.'
				}
			],
			sources: ['https://www.frontiermodelforum.org/about-us/']
		},
		{
			id: 'mlcommons',
			name: 'MLCommons',
			kind: 'standards-body',
			level: 'global',
			founded: '2020',
			seat: 'San Francisco',
			url: 'https://mlcommons.org',
			summary: 'Engineering consortium running MLPerf and AILuminate safety benchmarks.',
			responsibilities: ['MLPerf training/inference benchmarks', 'AILuminate safety benchmark'],
			obligations: ['Member agreements'],
			accountableTo: ['Members'],
			overlaps: [],
			sources: ['https://mlcommons.org/about-us/']
		}
	],
	relations: [
		{
			from: 'carl-zeiss-smt',
			to: 'asml',
			kind: 'supplies',
			label: 'EUV optics',
			detail: 'Zeiss SMT is the exclusive supplier of mirrors and lenses for ASML scanners.',
			sources: ['https://www.zeiss.com/semiconductor-manufacturing-technology/about-us.html']
		},
		{
			from: 'asml',
			to: 'carl-zeiss-smt',
			kind: 'invests-in',
			label: '24.9% stake',
			detail: 'ASML bought 24.9% of Carl Zeiss SMT in 2016 (EUR1bn) to fund High-NA EUV.',
			sources: [
				'https://www.asml.com/en/news/press-releases/2016/asml-to-acquire-249-percent-of-carl-zeiss-smt'
			]
		},
		{
			from: 'asml',
			to: 'tsmc',
			kind: 'supplies',
			label: 'EUV lithography',
			detail: "TSMC is ASML's largest EUV customer for N3/N2 nodes.",
			sources: ['https://www.asml.com/en/company/about-asml']
		},
		{
			from: 'asml',
			to: 'samsung-electronics',
			kind: 'supplies',
			label: 'EUV lithography',
			detail: 'Samsung uses ASML EUV for DRAM, HBM and 2nm foundry.',
			sources: ['https://www.asml.com/en/company/about-asml']
		},
		{
			from: 'asml',
			to: 'intel',
			kind: 'supplies',
			label: 'High-NA EUV',
			detail: 'Intel was first to install ASML High-NA EUV (EXE:5000) for 14A development.',
			sources: ['https://www.asml.com/en/news']
		},
		{
			from: 'asml',
			to: 'sk-hynix',
			kind: 'supplies',
			label: 'EUV lithography',
			detail: 'SK hynix uses EUV for 1b/1c-nm DRAM in HBM.',
			sources: ['https://news.skhynix.com/']
		},
		{
			from: 'asml',
			to: 'smic',
			kind: 'supplies',
			label: 'DUV only (licensed)',
			detail:
				'SMIC can buy only older DUV tools under Dutch licences; no EUV ever shipped to China.',
			sources: [
				'https://www.trendforce.com/news/2026/08/25/news-u-s-may-push-near-total-asml-china-ban-on-duv-sales-and-servicing-amid-chinas-domestic-lithography-push/'
			]
		},
		{
			from: 'applied-materials',
			to: 'tsmc',
			kind: 'supplies',
			label: 'Fab tools',
			detail: 'Deposition, etch and inspection tools for all TSMC fabs.',
			sources: ['https://www.appliedmaterials.com/us/en/corporate.html']
		},
		{
			from: 'lam-research',
			to: 'sk-hynix',
			kind: 'supplies',
			label: 'Etch tools',
			detail: 'High-aspect-ratio etch for DRAM/HBM and NAND.',
			sources: ['https://investor.lamresearch.com/']
		},
		{
			from: 'tokyo-electron',
			to: 'tsmc',
			kind: 'supplies',
			label: 'Coater/etch tools',
			detail: 'EUV coater-developer tracks paired with ASML scanners.',
			sources: ['https://www.tel.com/about/']
		},
		{
			from: 'cadence',
			to: 'nvidia',
			kind: 'supplies',
			label: 'EDA software',
			detail: 'Nvidia designs GPUs with Cadence and Synopsys tools.',
			sources: ['https://www.cadence.com/en_US/home/company.html']
		},
		{
			from: 'synopsys',
			to: 'nvidia',
			kind: 'supplies',
			label: 'EDA software',
			detail: 'Synopsys EDA and IP used across Nvidia designs.',
			sources: ['https://news.synopsys.com/']
		},
		{
			from: 'nvidia',
			to: 'synopsys',
			kind: 'invests-in',
			label: 'US$2bn stake',
			detail: 'Nvidia bought ~US$2bn of Synopsys shares (Dec 2025) to GPU-accelerate EDA.',
			sources: ['https://news.synopsys.com/']
		},
		{
			from: 'tsmc',
			to: 'nvidia',
			kind: 'supplies',
			label: 'Wafer fab + CoWoS',
			detail: 'TSMC fabricates and packages Blackwell and Rubin GPUs (N4P/N3).',
			sources: ['https://www.tsmc.com/english/aboutTSMC']
		},
		{
			from: 'tsmc',
			to: 'amd',
			kind: 'supplies',
			label: 'Wafer fab',
			detail: 'TSMC makes AMD Instinct MI350/MI450 (N3/N2).',
			sources: ['https://www.tsmc.com/english/aboutTSMC']
		},
		{
			from: 'tsmc',
			to: 'broadcom',
			kind: 'supplies',
			label: 'Custom ASIC fab',
			detail: 'TSMC manufactures Broadcom-designed TPUs and OpenAI chips.',
			sources: ['https://www.tsmc.com/english/aboutTSMC']
		},
		{
			from: 'sk-hynix',
			to: 'nvidia',
			kind: 'supplies',
			label: 'HBM3E/HBM4',
			detail: "SK hynix is Nvidia's main HBM supplier, including HBM4 for Vera Rubin.",
			sources: ['https://news.skhynix.com/']
		},
		{
			from: 'samsung-electronics',
			to: 'nvidia',
			kind: 'supplies',
			label: 'HBM',
			detail: 'Samsung qualified HBM3E and HBM4 with Nvidia after delays.',
			sources: ['https://www.samsung.com/semiconductor/']
		},
		{
			from: 'micron',
			to: 'nvidia',
			kind: 'supplies',
			label: 'HBM3E',
			detail: 'Micron supplies HBM3E for Blackwell systems.',
			sources: ['https://investors.micron.com/']
		},
		{
			from: 'arm',
			to: 'nvidia',
			kind: 'supplies',
			label: 'CPU architecture',
			detail: 'Nvidia Grace and Vera CPUs use Arm Neoverse cores under licence.',
			sources: ['https://www.arm.com/company']
		},
		{
			from: 'broadcom',
			to: 'alphabet-google',
			kind: 'partners',
			label: 'TPU co-design',
			detail: 'Broadcom co-designs and supplies Google TPUs.',
			sources: ['https://openai.com/index/openai-and-broadcom-announce-strategic-collaboration/']
		},
		{
			from: 'broadcom',
			to: 'openai',
			kind: 'partners',
			label: '10 GW custom chips',
			detail:
				'Oct 2025: OpenAI and Broadcom to deploy 10 GW of OpenAI-designed accelerators, 2026-2029.',
			sources: ['https://openai.com/index/openai-and-broadcom-announce-strategic-collaboration/']
		},
		{
			from: 'smic',
			to: 'huawei',
			kind: 'supplies',
			label: 'Ascend dies',
			detail: 'SMIC fabricates Huawei Ascend chips at 7nm-class without EUV.',
			sources: ['https://www.smics.com/en/site/about_summary']
		},
		{
			from: 'huawei',
			to: 'deepseek',
			kind: 'supplies',
			label: 'Ascend compute',
			detail: 'DeepSeek V4 (Apr 2026) adapted to and partly trained on Huawei Ascend.',
			sources: ['https://techwireasia.com/2026/04/deepseek-v4-huawei-ai-chips/']
		},
		{
			from: 'intel',
			to: 'united-states-government',
			kind: 'supplies',
			label: 'Secure Enclave chips',
			detail: 'CHIPS Secure Enclave programme (~US$3bn) for defence chips.',
			sources: ['https://www.theregister.com/2025/08/25/intel_gets_trumped/']
		},
		{
			from: 'nvidia',
			to: 'microsoft',
			kind: 'supplies',
			label: 'GPU systems',
			detail: "Microsoft is Nvidia's largest cloud buyer (GB200/GB300 clusters).",
			sources: ['https://nvidianews.nvidia.com/']
		},
		{
			from: 'nvidia',
			to: 'oracle',
			kind: 'supplies',
			label: 'Stargate GPUs',
			detail: 'Oracle ordered ~400,000 GB200 chips (~US$40bn) for Abilene.',
			sources: [
				'https://www.techspot.com/news/108047-oracle-orders-400000-nvidia-chips-power-massive-stargate.html'
			]
		},
		{
			from: 'nvidia',
			to: 'coreweave',
			kind: 'supplies',
			label: 'GPUs',
			detail: 'CoreWeave runs Nvidia-only fleets.',
			sources: [
				'https://datacenterknowledge.com/investing/nvidia-invests-2b-more-in-coreweave-for-5-gw-data-center-push'
			]
		},
		{
			from: 'nvidia',
			to: 'spacex-xai',
			kind: 'supplies',
			label: 'Colossus GPUs',
			detail: "xAI's Colossus 1/2 in Memphis run hundreds of thousands of Nvidia GPUs.",
			sources: ['https://x.ai']
		},
		{
			from: 'oracle',
			to: 'openai',
			kind: 'partners',
			label: 'Stargate 4.5 GW',
			detail:
				'Jul 2025: ~US$300bn, 4.5 GW contract; Abilene ~1.2 GW due Q4 2026; extra Abilene expansion dropped.',
			sources: [
				'https://www.tomshardware.com/tech-industry/oracle-rebuts-incorrect-reporting-on-stargate-expansion',
				'https://epoch.ai/blog/openai-stargate-where-the-us-sites-stand'
			]
		},
		{
			from: 'softbank',
			to: 'openai',
			kind: 'partners',
			label: 'Stargate JV',
			detail:
				'Jan 2025: Stargate LLC with OpenAI, Oracle and MGX, US$500bn/10 GW target; SoftBank financial lead.',
			sources: ['https://openai.com/index/announcing-the-stargate-project/']
		},
		{
			from: 'amd',
			to: 'openai',
			kind: 'partners',
			label: '6 GW + warrants',
			detail:
				'Oct 2025: 6 GW of Instinct GPUs from H2 2026; warrant for up to 160m AMD shares (~10%) vesting by milestones.',
			sources: [
				'https://ir.amd.com/news-events/press-releases/detail/1260/amd-and-openai-announce-strategic-partnership'
			]
		},
		{
			from: 'nvidia',
			to: 'openai',
			kind: 'partners',
			label: '10 GW LOI',
			detail:
				"Sept 2025 LOI for 10 GW of Nvidia systems; Huang said Feb 2026 it was 'never a commitment'.",
			sources: [
				'https://fortune.com/2026/02/02/jensen-huang-nvidia-ceo-on-openai-investment-never-a-commitment/'
			]
		},
		{
			from: 'microsoft',
			to: 'openai',
			kind: 'partners',
			label: 'US$250bn Azure',
			detail:
				'Oct 2025 deal: OpenAI commits US$250bn of Azure; Microsoft keeps IP rights to 2032, loses compute right of first refusal.',
			sources: [
				'https://blogs.microsoft.com/blog/2025/10/28/the-next-chapter-of-the-microsoft-openai-partnership/'
			]
		},
		{
			from: 'amazon',
			to: 'openai',
			kind: 'partners',
			label: 'AWS US$100bn',
			detail:
				"Nov 2025 US$38bn deal expanded to ~US$100bn over 8 years, tied to Amazon's 2026 investment.",
			sources: [
				'https://finance.yahoo.com/markets/stocks/articles/openai-closes-122bn-funding-round-093126735.html'
			]
		},
		{
			from: 'coreweave',
			to: 'openai',
			kind: 'partners',
			label: 'Compute contracts',
			detail: 'Contracts totalling ~US$22bn (2025).',
			sources: [
				'https://letsdatascience.com/news/coreweave-diversifies-revenue-with-multibillion-ai-contracts-03e02ae5'
			]
		},
		{
			from: 'coreweave',
			to: 'meta',
			kind: 'partners',
			label: 'US$35bn compute',
			detail: 'US$14.2bn (Sept 2025) plus US$21bn (Apr 2026) through 2032.',
			sources: ['https://www.eweek.com/news/meta-coreweave-21b-ai-cloud-deal/']
		},
		{
			from: 'amazon',
			to: 'anthropic',
			kind: 'partners',
			label: 'Trainium, 5 GW',
			detail:
				'Apr 2026: Anthropic commits >US$100bn over 10 years for up to 5 GW of Trainium; Project Rainier.',
			sources: [
				'https://siliconangle.com/2026/04/20/amazon-invest-25b-anthropic-part-expanded-cloud-partnership/'
			]
		},
		{
			from: 'alphabet-google',
			to: 'anthropic',
			kind: 'partners',
			label: 'TPUs ~1 GW + 3.5 GW',
			detail:
				'Oct 2025: up to 1m TPUs (>1 GW in 2026); Apr 2026: ~3.5 GW more via Broadcom from 2027.',
			sources: [
				'https://www.anthropic.com/news/expanding-our-use-of-google-cloud-tpus-and-services',
				'https://www.hpcwire.com/off-the-wire/anthropic-signs-google-broadcom-deal-to-add-multi-gigawatt-tpu-capacity/'
			]
		},
		{
			from: 'broadcom',
			to: 'anthropic',
			kind: 'supplies',
			label: 'TPU capacity',
			detail:
				"Broadcom supplies the 3.5 GW TPU expansion, contingent on Anthropic's commercial success.",
			sources: [
				'https://www.hpcwire.com/off-the-wire/anthropic-signs-google-broadcom-deal-to-add-multi-gigawatt-tpu-capacity/'
			]
		},
		{
			from: 'microsoft',
			to: 'anthropic',
			kind: 'partners',
			label: 'US$30bn Azure',
			detail: 'Nov 2025: Anthropic commits US$30bn to Azure, up to 1 GW of Nvidia systems.',
			sources: [
				'https://www.aljazeera.com/economy/2025/11/18/microsoft-nvidia-invest-in-anthropic-in-cloud-services-deal'
			]
		},
		{
			from: 'alphabet-google',
			to: 'meta',
			kind: 'partners',
			label: 'TPU rental',
			detail:
				'Feb 2026: multibillion deal for Meta to rent Google Cloud TPUs; purchase talks ongoing.',
			sources: [
				'https://www.businesstoday.in/technology/news/story/meta-bets-billions-on-google-to-power-its-ai-ambitions-518270-2026-02-27'
			]
		},
		{
			from: 'amd',
			to: 'meta',
			kind: 'supplies',
			label: 'MI450 GPUs',
			detail: 'Five-year ~US$60bn deal for AMD MI450 from H2 2026 (reported).',
			sources: [
				'https://www.businesstoday.in/technology/news/story/meta-bets-billions-on-google-to-power-its-ai-ambitions-518270-2026-02-27'
			]
		},
		{
			from: 'alphabet-google',
			to: 'safe-superintelligence',
			kind: 'partners',
			label: 'TPU compute',
			detail: 'SSI runs research primarily on Google Cloud TPUs (Apr 2025).',
			sources: [
				'https://aimagazine.com/news/safe-superintelligence-sutskever-nvidia-and-a-us-32bn-ai-b'
			]
		},
		{
			from: 'g42',
			to: 'openai',
			kind: 'partners',
			label: 'Stargate UAE',
			detail: '1 GW cluster with OpenAI, Oracle, Nvidia, Cisco, SoftBank; first 200 MW in 2026.',
			sources: [
				'https://www.thenationalnews.com/future/technology/2025/11/20/uae-ai-nvidia-chips-us/'
			]
		},
		{
			from: 'humain',
			to: 'spacex-xai',
			kind: 'partners',
			label: '500 MW data centre',
			detail: 'Nov 2025 plan for xAI-Humain 500 MW Saudi data centre.',
			sources: [
				'https://www.thenationalnews.com/future/technology/2025/11/20/uae-ai-nvidia-chips-us/'
			]
		},
		{
			from: 'openai-foundation',
			to: 'openai',
			kind: 'oversees',
			label: 'Controls PBC (~26%)',
			detail: 'Foundation appoints the PBC board and holds ~26% plus warrants (Oct 2025).',
			sources: [
				'https://openai.com/index/built-to-benefit-everyone/',
				'https://www.mediapost.com/publications/article/410233/openai-restructures-microsoft-takes-27-stake-in.html'
			]
		},
		{
			from: 'microsoft',
			to: 'openai',
			kind: 'invests-in',
			label: '~27% stake',
			detail:
				'~27% of OpenAI Group PBC (~US$135bn at Oct 2025), from ~US$13bn invested since 2019; joined Mar 2026 round.',
			sources: [
				'https://blogs.microsoft.com/blog/2025/10/28/the-next-chapter-of-the-microsoft-openai-partnership/'
			]
		},
		{
			from: 'softbank',
			to: 'openai',
			kind: 'invests-in',
			label: '~11%, US$60bn+',
			detail: 'US$30bn (2025) plus US$30bn in Mar 2026 round.',
			sources: [
				'https://finance.yahoo.com/markets/stocks/articles/openai-closes-122bn-funding-round-093126735.html'
			]
		},
		{
			from: 'amazon',
			to: 'openai',
			kind: 'invests-in',
			label: 'US$50bn (Mar 2026)',
			detail: 'US$50bn in the US$122bn round; ~US$35bn contingent on IPO or AGI.',
			sources: [
				'https://finance.yahoo.com/markets/stocks/articles/openai-closes-122bn-funding-round-093126735.html'
			]
		},
		{
			from: 'nvidia',
			to: 'openai',
			kind: 'invests-in',
			label: 'US$30bn (Mar 2026)',
			detail: 'US$30bn in the Mar 2026 round, largely as compute rather than cash.',
			sources: [
				'https://finance.yahoo.com/markets/stocks/articles/openai-closes-122bn-funding-round-093126735.html'
			]
		},
		{
			from: 'mgx',
			to: 'openai',
			kind: 'invests-in',
			label: 'Round co-lead',
			detail: 'MGX co-led the Mar 2026 US$122bn round; Stargate equity partner.',
			sources: [
				'https://finance.yahoo.com/markets/stocks/articles/openai-closes-122bn-funding-round-093126735.html'
			]
		},
		{
			from: 'amazon',
			to: 'anthropic',
			kind: 'invests-in',
			label: 'US$13bn + up to 20bn',
			detail:
				'US$8bn (2023-24) + US$5bn (Apr 2026) + up to US$20bn on milestones; stake est. mid-teens %.',
			sources: [
				'https://siliconangle.com/2026/04/20/amazon-invest-25b-anthropic-part-expanded-cloud-partnership/'
			]
		},
		{
			from: 'alphabet-google',
			to: 'anthropic',
			kind: 'invests-in',
			label: '~14% stake',
			detail: '~US$3bn+ invested; ~14% stake per 2025 court filings; further 2025 investment.',
			sources: [
				'https://www.anthropic.com/news/expanding-our-use-of-google-cloud-tpus-and-services'
			]
		},
		{
			from: 'microsoft',
			to: 'anthropic',
			kind: 'invests-in',
			label: 'Up to US$5bn',
			detail: 'Nov 2025 commitment alongside Azure deal.',
			sources: [
				'https://www.aljazeera.com/economy/2025/11/18/microsoft-nvidia-invest-in-anthropic-in-cloud-services-deal'
			]
		},
		{
			from: 'nvidia',
			to: 'anthropic',
			kind: 'invests-in',
			label: 'Up to US$10bn',
			detail: 'Nov 2025 commitment; Anthropic adopts Nvidia Grace Blackwell/Vera Rubin.',
			sources: [
				'https://www.aljazeera.com/economy/2025/11/18/microsoft-nvidia-invest-in-anthropic-in-cloud-services-deal'
			]
		},
		{
			from: 'qia',
			to: 'anthropic',
			kind: 'invests-in',
			label: 'Series F/G',
			detail: 'QIA co-led Series F (Sept 2025, US$13bn at US$183bn).',
			sources: [
				'https://www.anthropic.com/news/anthropic-raises-series-f-at-usd183b-post-money-valuation'
			]
		},
		{
			from: 'nvidia',
			to: 'spacex-xai',
			kind: 'invests-in',
			label: 'xAI rounds',
			detail: 'Nvidia invested in xAI Series E (US$20bn, Jan 2026), now SpaceX stock.',
			sources: [
				'https://pulse2.com/spacex-acquires-xai-in-deal-reportedly-valuing-combined-company-at-1-25-trillion'
			]
		},
		{
			from: 'mgx',
			to: 'spacex-xai',
			kind: 'invests-in',
			label: 'xAI rounds',
			detail: "MGX backed xAI's 2025 rounds.",
			sources: ['https://www.mgx.ae/en/news']
		},
		{
			from: 'nvidia',
			to: 'coreweave',
			kind: 'invests-in',
			label: '~US$2bn+, #2 holder',
			detail: 'Jan 2026: US$2bn at US$87.20/share; plus US$6.3bn capacity backstop to 2032.',
			sources: [
				'https://datacenterknowledge.com/investing/nvidia-invests-2b-more-in-coreweave-for-5-gw-data-center-push'
			]
		},
		{
			from: 'nvidia',
			to: 'intel',
			kind: 'invests-in',
			label: 'US$5bn (~4%)',
			detail: 'Sept 2025: US$5bn at US$23.28/share and joint x86+RTX products.',
			sources: [
				'https://nvidianews.nvidia.com/news/nvidia-and-intel-to-develop-ai-infrastructure-and-personal-computing-products'
			]
		},
		{
			from: 'softbank',
			to: 'intel',
			kind: 'invests-in',
			label: 'US$2bn',
			detail: 'Aug 2025 purchase at US$23/share.',
			sources: ['https://www.theregister.com/2025/08/25/intel_gets_trumped/']
		},
		{
			from: 'united-states-government',
			to: 'intel',
			kind: 'invests-in',
			label: '~9.9% equity',
			detail:
				'Aug 2025: US$8.9bn of CHIPS grants and Secure Enclave funds converted to 433m shares; warrant for 5% more.',
			sources: [
				'https://www.theregister.com/2025/08/25/intel_gets_trumped/',
				'https://www.intc.com/news-events/press-releases/detail/1748/intel-and-trump-administration-reach-historic-agreement-to'
			]
		},
		{
			from: 'softbank',
			to: 'arm',
			kind: 'invests-in',
			label: '~90% stake',
			detail: "SoftBank kept ~90% after Arm's 2023 IPO.",
			sources: ['https://group.softbank/en/ir']
		},
		{
			from: 'asml',
			to: 'mistral-ai',
			kind: 'invests-in',
			label: '~11%, EUR1.3bn',
			detail: 'ASML led Sept 2025 Series C (EUR1.7bn at EUR11.7bn).',
			sources: [
				'https://www.asml.com/en/news/press-releases/2025/asml-mistral-ai-enter-strategic-partnership'
			]
		},
		{
			from: 'samsung-electronics',
			to: 'mistral-ai',
			kind: 'invests-in',
			label: 'Led EUR3bn round',
			detail: 'Sept 2026 Series D at >EUR21bn led by Samsung.',
			sources: [
				'https://www.euronews.com/2026/09/08/mistral-ai-raises-record-3-billion-in-samsung-led-funding-round'
			]
		},
		{
			from: 'alibaba',
			to: 'moonshot-ai',
			kind: 'invests-in',
			label: 'Major shareholder',
			detail: "Alibaba led Moonshot's ~US$1bn round in Feb 2024; Moonshot at ~US$35bn (Jul 2026).",
			sources: [
				'https://www.business-standard.com/world-news/alibaba-leads-largest-financing-deal-to-mint-2-5-billion-china-ai-firm-124022701330_1.html',
				'https://www.yicaiglobal.com/news/moonshot-ais-latest-fundraiser-lifts-valuation-to-usd35-billion-amid-kimis-silicon-valley-buzz'
			]
		},
		{
			from: 'nvidia',
			to: 'safe-superintelligence',
			kind: 'invests-in',
			label: 'Strategic investor',
			detail: "Nvidia and Alphabet invested in SSI's Apr 2025 round at US$32bn.",
			sources: [
				'https://aimagazine.com/news/safe-superintelligence-sutskever-nvidia-and-a-us-32bn-ai-b'
			]
		},
		{
			from: 'microsoft',
			to: 'g42',
			kind: 'invests-in',
			label: 'US$1.5bn',
			detail: 'Apr 2024 stake with US government security assurances.',
			sources: [
				'https://news.microsoft.com/source/2024/04/16/microsoft-invests-1-5-billion-in-abu-dhabis-g42-to-accelerate-ai-development-and-global-expansion/'
			]
		},
		{
			from: 'pif',
			to: 'humain',
			kind: 'invests-in',
			label: 'Owner',
			detail: 'PIF launched and owns Humain (May 2025).',
			sources: [
				'https://www.pif.gov.sa/en/news-and-insights/press-releases/2025/hrh-crown-prince-launches-humain-as-global-ai-powerhouse/'
			]
		},
		{
			from: 'uae-government',
			to: 'mgx',
			kind: 'funds',
			label: 'State capital',
			detail: 'MGX founded by Mubadala and G42, chaired by Sheikh Tahnoon.',
			sources: ['https://www.mgx.ae/en/news']
		},
		{
			from: 'china-big-fund',
			to: 'smic',
			kind: 'invests-in',
			label: 'State equity',
			detail: 'Big Fund I/II are major SMIC shareholders; Phase III RMB344bn (2024).',
			sources: [
				'https://www.reuters.com/technology/china-sets-up-475-bln-state-fund-boost-semiconductor-industry-2024-05-27/'
			]
		},
		{
			from: 'china-government',
			to: 'china-big-fund',
			kind: 'funds',
			label: 'Finance ministry capital',
			detail: 'MOF and state banks capitalise the Big Fund.',
			sources: [
				'https://www.reuters.com/technology/china-sets-up-475-bln-state-fund-boost-semiconductor-industry-2024-05-27/'
			]
		},
		{
			from: 'taiwan-government',
			to: 'tsmc',
			kind: 'invests-in',
			label: '~6% via NDF',
			detail: "National Development Fund is TSMC's largest single shareholder.",
			sources: ['https://www.tsmc.com/english/aboutTSMC']
		},
		{
			from: 'japan-government',
			to: 'rapidus',
			kind: 'funds',
			label: 'JPY2.35tn R&D aid; golden share',
			detail: 'METI R&D grants (JPY631.5bn added Apr 2026) and IPA equity with golden share.',
			sources: [
				'https://www.theregister.com/2026/02/27/rapidus_funding/',
				'https://english.adnkronos.com/2026/02/27/rapidus-gets-267-6-b-yen-in-public-private-funds/'
			]
		},
		{
			from: 'japan-government',
			to: 'tsmc',
			kind: 'funds',
			label: 'Kumamoto subsidies',
			detail: 'Up to JPY1.2tn for TSMC/JASM Kumamoto fabs.',
			sources: ['https://www.meti.go.jp/english']
		},
		{
			from: 'chips-program-office',
			to: 'tsmc',
			kind: 'funds',
			label: 'US$6.6bn grant',
			detail: 'CHIPS award for three Arizona fabs (Nov 2024); TSMC pledged US$165bn US investment.',
			sources: [
				'https://www.commerce.gov/news/press-releases/2024/11/biden-harris-administration-announces-chips-incentives-award-tsmc-arizona'
			]
		},
		{
			from: 'chips-program-office',
			to: 'samsung-electronics',
			kind: 'funds',
			label: 'US$4.7bn grant',
			detail: 'CHIPS award for Taylor, Texas (Dec 2024).',
			sources: [
				'https://www.commerce.gov/news/press-releases/2024/12/biden-harris-administration-announces-chips-incentives-award-samsung'
			]
		},
		{
			from: 'chips-program-office',
			to: 'micron',
			kind: 'funds',
			label: 'US$6.1bn+ grant',
			detail: 'CHIPS award for Idaho and New York fabs (Dec 2024).',
			sources: [
				'https://www.commerce.gov/news/press-releases/2024/12/biden-harris-administration-announces-chips-incentives-award-micron'
			]
		},
		{
			from: 'chips-program-office',
			to: 'sk-hynix',
			kind: 'funds',
			label: 'US$458m grant',
			detail: 'CHIPS award for Indiana HBM packaging plant.',
			sources: [
				'https://www.commerce.gov/news/press-releases/2024/12/biden-harris-administration-announces-chips-incentives-award-sk-hynix'
			]
		},
		{
			from: 'chips-program-office',
			to: 'united-states-government',
			kind: 'part-of',
			label: 'Commerce Dept office',
			detail: 'Administers CHIPS Act within Commerce/NIST.',
			sources: ['https://www.nist.gov/chips']
		},
		{
			from: 'eurohpc-ju',
			to: 'european-commission',
			kind: 'implements',
			label: 'AI Factories/Gigafactories',
			detail:
				'Runs gigafactory tender (EUR10bn public, EUR20bn private target); awards early 2027.',
			sources: [
				'https://www.eurohpc-ju.europa.eu/call-tenders-selection-artificial-intelligence-gigafactory-consortia-and-establishment-ai_en'
			]
		},
		{
			from: 'european-commission',
			to: 'eurohpc-ju',
			kind: 'funds',
			label: 'Digital Europe/Horizon',
			detail: 'Commission co-funds EuroHPC alongside member states.',
			sources: ['https://eurohpc-ju.europa.eu/']
		},
		{
			from: 'south-korea-government',
			to: 'samsung-electronics',
			kind: 'funds',
			label: 'K-Chips tax credits',
			detail: 'Investment tax credits up to 25-30% for chip capex.',
			sources: ['https://www.motie.go.kr/eng']
		},
		{
			from: 'south-korea-government',
			to: 'sk-hynix',
			kind: 'funds',
			label: 'K-Chips tax credits',
			detail: 'Same credits; Yongin cluster infrastructure support.',
			sources: ['https://www.motie.go.kr/eng']
		},
		{
			from: 'uk-government',
			to: 'uk-aisi',
			kind: 'funds',
			label: 'Core budget',
			detail: 'DSIT funds AISI (~GBP66m/yr plus initial GBP100m).',
			sources: ['https://www.aisi.gov.uk/']
		},
		{
			from: 'us-bis',
			to: 'nvidia',
			kind: 'regulates',
			label: 'China licences',
			detail:
				'H200 to China case-by-case since Jan 2026 (25% fee, volume caps, US lab verification).',
			sources: ['https://introl.com/blog/bis-export-policy-h200-mi325x-china-case-by-case-2026']
		},
		{
			from: 'us-bis',
			to: 'amd',
			kind: 'regulates',
			label: 'China licences',
			detail: 'MI325X under the same case-by-case regime.',
			sources: ['https://introl.com/blog/bis-export-policy-h200-mi325x-china-case-by-case-2026']
		},
		{
			from: 'us-bis',
			to: 'huawei',
			kind: 'regulates',
			label: 'Entity List',
			detail:
				'Huawei on Entity List since 2019; Ascend use worldwide flagged by BIS guidance (May 2025).',
			sources: ['https://www.bis.gov/']
		},
		{
			from: 'us-bis',
			to: 'smic',
			kind: 'regulates',
			label: 'Entity List',
			detail: 'SMIC listed since 2020; tools for <=14nm need licences.',
			sources: ['https://www.bis.gov/']
		},
		{
			from: 'us-bis',
			to: 'asml',
			kind: 'regulates',
			label: 'Foreign direct product rule',
			detail: 'US FDP rules reach ASML tools with US content.',
			sources: ['https://www.bis.gov/']
		},
		{
			from: 'us-bis',
			to: 'g42',
			kind: 'regulates',
			label: 'Export licence',
			detail: 'Nov 2025: licence for up to 35,000 GB300-equivalents with security conditions.',
			sources: [
				'https://www.thenationalnews.com/future/technology/2025/11/20/uae-ai-nvidia-chips-us/'
			]
		},
		{
			from: 'us-bis',
			to: 'humain',
			kind: 'regulates',
			label: 'Export licence',
			detail: 'Nov 2025: licence for up to 35,000 GB300-equivalents.',
			sources: [
				'https://www.thenationalnews.com/future/technology/2025/11/20/uae-ai-nvidia-chips-us/'
			]
		},
		{
			from: 'us-bis',
			to: 'united-states-government',
			kind: 'part-of',
			label: 'Commerce Dept',
			detail: 'BIS is a Commerce bureau.',
			sources: ['https://www.bis.gov/']
		},
		{
			from: 'netherlands-government',
			to: 'asml',
			kind: 'regulates',
			label: 'Export licences',
			detail: 'Licences for EUV, 1970i/1980i DUV and their servicing to China.',
			sources: [
				'https://bits-chips.com/article/dutch-minister-pushes-back-on-us-bid-to-tighten-china-chip-controls/'
			]
		},
		{
			from: 'japan-government',
			to: 'tokyo-electron',
			kind: 'regulates',
			label: 'Tool export controls',
			detail: 'METI licensing of 23+ tool categories since 2023.',
			sources: ['https://www.meti.go.jp/english']
		},
		{
			from: 'taiwan-government',
			to: 'tsmc',
			kind: 'regulates',
			label: 'N-2 overseas rule',
			detail: "Fabs abroad must lag Taiwan's leading node.",
			sources: ['https://www.ey.gov.tw/']
		},
		{
			from: 'china-government',
			to: 'nvidia',
			kind: 'regulates',
			label: 'Customs/antitrust curbs',
			detail: 'SAMR antitrust probe (2025) and customs blocking H200 imports (Jan 2026).',
			sources: [
				'https://www.networkworld.com/article/4117031/yea-or-nay-will-nvidia-h200-chips-go-to-china.html'
			]
		},
		{
			from: 'china-government',
			to: 'united-states-government',
			kind: 'regulates',
			label: 'Rare-earth controls',
			detail:
				'Oct 2025 controls suspended under truce; pause on five elements extended to 10 Jan 2027; April 2025 controls on seven still in force.',
			sources: [
				'https://www.spglobal.com/energy/en/news-research/latest-news/metals/110926-china-extends-rare-earth-export-suspension-to-january-2027'
			]
		},
		{
			from: 'eu-ai-office',
			to: 'openai',
			kind: 'regulates',
			label: 'GPAI obligations',
			detail:
				'GPAI rules since Aug 2025; fines enforceable from Aug 2026. OpenAI signed Code of Practice.',
			sources: ['https://digital-strategy.ec.europa.eu/en/policies/ai-office']
		},
		{
			from: 'eu-ai-office',
			to: 'anthropic',
			kind: 'regulates',
			label: 'GPAI obligations',
			detail: 'Signatory of GPAI Code of Practice.',
			sources: ['https://digital-strategy.ec.europa.eu/en/policies/ai-office']
		},
		{
			from: 'eu-ai-office',
			to: 'google-deepmind',
			kind: 'regulates',
			label: 'GPAI obligations',
			detail: 'Signatory of GPAI Code of Practice.',
			sources: ['https://digital-strategy.ec.europa.eu/en/policies/ai-office']
		},
		{
			from: 'eu-ai-office',
			to: 'meta',
			kind: 'regulates',
			label: 'GPAI obligations',
			detail: 'Meta refused to sign the Code; must show compliance otherwise.',
			sources: ['https://digital-strategy.ec.europa.eu/en/policies/ai-office']
		},
		{
			from: 'eu-ai-office',
			to: 'mistral-ai',
			kind: 'regulates',
			label: 'GPAI obligations',
			detail: 'Signatory of GPAI Code of Practice.',
			sources: ['https://digital-strategy.ec.europa.eu/en/policies/ai-office']
		},
		{
			from: 'eu-ai-office',
			to: 'european-commission',
			kind: 'part-of',
			label: 'DG CONNECT unit',
			detail: 'AI Office sits in DG CONNECT.',
			sources: ['https://digital-strategy.ec.europa.eu/en/policies/ai-office']
		},
		{
			from: 'european-commission',
			to: 'european-union',
			kind: 'part-of',
			label: 'EU executive',
			detail: 'EU executive.',
			sources: ['https://commission.europa.eu']
		},
		{
			from: 'european-union',
			to: 'netherlands-government',
			kind: 'regulates',
			label: 'Dual-use regulation',
			detail: 'EU Reg. 2021/821 frames Dutch licensing; national lists add lithography.',
			sources: ['https://www.government.nl/topics/export-controls-of-strategic-goods']
		},
		{
			from: 'caisi',
			to: 'openai',
			kind: 'oversees',
			label: 'Pre-deployment tests',
			detail: 'Voluntary testing agreements, renegotiated 2025-26.',
			sources: [
				'https://digitalpolicyalert.org/event/39699-center-for-ai-standards-and-innovation-signed-frontier-ai-national-security-testing-agreements-with-google-deepmind-microsoft-and-xai'
			]
		},
		{
			from: 'caisi',
			to: 'anthropic',
			kind: 'oversees',
			label: 'Pre-deployment tests',
			detail: 'Voluntary testing agreement.',
			sources: [
				'https://digitalpolicyalert.org/event/39699-center-for-ai-standards-and-innovation-signed-frontier-ai-national-security-testing-agreements-with-google-deepmind-microsoft-and-xai'
			]
		},
		{
			from: 'caisi',
			to: 'google-deepmind',
			kind: 'oversees',
			label: 'Pre-deployment tests',
			detail: 'Agreement signed May 2026.',
			sources: [
				'https://digitalpolicyalert.org/event/39699-center-for-ai-standards-and-innovation-signed-frontier-ai-national-security-testing-agreements-with-google-deepmind-microsoft-and-xai'
			]
		},
		{
			from: 'caisi',
			to: 'spacex-xai',
			kind: 'oversees',
			label: 'Pre-deployment tests',
			detail: 'Agreement signed May 2026.',
			sources: [
				'https://digitalpolicyalert.org/event/39699-center-for-ai-standards-and-innovation-signed-frontier-ai-national-security-testing-agreements-with-google-deepmind-microsoft-and-xai'
			]
		},
		{
			from: 'caisi',
			to: 'nist',
			kind: 'part-of',
			label: 'NIST centre',
			detail: 'CAISI sits in NIST, Commerce.',
			sources: [
				'https://digitalpolicyalert.org/event/39699-center-for-ai-standards-and-innovation-signed-frontier-ai-national-security-testing-agreements-with-google-deepmind-microsoft-and-xai'
			]
		},
		{
			from: 'nist',
			to: 'united-states-government',
			kind: 'part-of',
			label: 'Commerce agency',
			detail: 'Commerce agency.',
			sources: ['https://www.nist.gov/']
		},
		{
			from: 'uk-aisi',
			to: 'anthropic',
			kind: 'oversees',
			label: 'Pre-deployment tests',
			detail: 'AISI tests Claude models before release.',
			sources: ['https://www.aisi.gov.uk/']
		},
		{
			from: 'uk-aisi',
			to: 'openai',
			kind: 'oversees',
			label: 'Pre-deployment tests',
			detail: 'AISI tests OpenAI models before release.',
			sources: ['https://www.aisi.gov.uk/']
		},
		{
			from: 'uk-aisi',
			to: 'uk-government',
			kind: 'part-of',
			label: 'DSIT directorate',
			detail: 'DSIT directorate.',
			sources: ['https://www.aisi.gov.uk/']
		},
		{
			from: 'caisi',
			to: 'international-network-ai-safety-institutes',
			kind: 'member-of',
			label: 'US member',
			detail: 'Founding member (Nov 2024).',
			sources: [
				'https://www.gov.uk/government/news/efforts-to-share-best-practices-on-ai-measurement-and-evaluations-driven-forward-through-the-international-network-for-advanced-ai-measurement-evalua'
			]
		},
		{
			from: 'uk-aisi',
			to: 'international-network-ai-safety-institutes',
			kind: 'member-of',
			label: 'UK member',
			detail: 'Founding member.',
			sources: [
				'https://www.gov.uk/government/news/efforts-to-share-best-practices-on-ai-measurement-and-evaluations-driven-forward-through-the-international-network-for-advanced-ai-measurement-evalua'
			]
		},
		{
			from: 'eu-ai-office',
			to: 'international-network-ai-safety-institutes',
			kind: 'member-of',
			label: 'EU member',
			detail: 'EU represented by the AI Office.',
			sources: [
				'https://www.gov.uk/government/news/efforts-to-share-best-practices-on-ai-measurement-and-evaluations-driven-forward-through-the-international-network-for-advanced-ai-measurement-evalua'
			]
		},
		{
			from: 'united-states-government',
			to: 'oecd',
			kind: 'member-of',
			label: 'Member',
			detail: 'Member.',
			sources: ['https://www.oecd.org/en/about/members-partners.html']
		},
		{
			from: 'japan-government',
			to: 'oecd',
			kind: 'member-of',
			label: 'Member; HAIP host',
			detail: 'Japan launched the Hiroshima AI Process, reported through OECD.',
			sources: ['https://oecd.ai/en/transparency']
		},
		{
			from: 'openai',
			to: 'frontier-model-forum',
			kind: 'member-of',
			label: 'Founding member',
			detail: 'Founding member.',
			sources: ['https://www.frontiermodelforum.org/about-us/']
		},
		{
			from: 'anthropic',
			to: 'frontier-model-forum',
			kind: 'member-of',
			label: 'Founding member',
			detail: 'Founding member.',
			sources: ['https://www.frontiermodelforum.org/about-us/']
		},
		{
			from: 'alphabet-google',
			to: 'frontier-model-forum',
			kind: 'member-of',
			label: 'Founding member',
			detail: 'Founding member.',
			sources: ['https://www.frontiermodelforum.org/about-us/']
		},
		{
			from: 'microsoft',
			to: 'frontier-model-forum',
			kind: 'member-of',
			label: 'Founding member',
			detail: 'Founding member.',
			sources: ['https://www.frontiermodelforum.org/about-us/']
		},
		{
			from: 'amazon',
			to: 'frontier-model-forum',
			kind: 'member-of',
			label: 'Member (2024)',
			detail: 'Member (2024).',
			sources: ['https://www.frontiermodelforum.org/about-us/']
		},
		{
			from: 'meta',
			to: 'frontier-model-forum',
			kind: 'member-of',
			label: 'Member (2024)',
			detail: 'Member (2024).',
			sources: ['https://www.frontiermodelforum.org/about-us/']
		},
		{
			from: 'nvidia',
			to: 'mlcommons',
			kind: 'member-of',
			label: 'Founding member',
			detail: 'MLPerf benchmark submitter.',
			sources: ['https://mlcommons.org/about-us/']
		},
		{
			from: 'alphabet-google',
			to: 'mlcommons',
			kind: 'member-of',
			label: 'Member',
			detail: 'Member.',
			sources: ['https://mlcommons.org/about-us/']
		},
		{
			from: 'google-deepmind',
			to: 'alphabet-google',
			kind: 'part-of',
			label: 'Alphabet lab',
			detail: 'Alphabet lab.',
			sources: ['https://deepmind.google/about/']
		},
		{
			from: 'humain',
			to: 'saudi-arabia-government',
			kind: 'part-of',
			label: 'PIF company',
			detail: 'PIF company.',
			sources: ['https://www.pif.gov.sa/']
		},
		{
			from: 'saudi-arabia-government',
			to: 'pif',
			kind: 'oversees',
			label: 'Chaired by Crown Prince',
			detail: 'Chaired by Crown Prince.',
			sources: ['https://www.pif.gov.sa/']
		},
		{
			from: 'uae-government',
			to: 'g42',
			kind: 'oversees',
			label: 'Sheikh Tahnoon chairs',
			detail: 'Sheikh Tahnoon chairs.',
			sources: ['https://www.g42.ai']
		},
		{
			from: 'openai',
			to: 'anthropic',
			kind: 'competes',
			label: 'Frontier models',
			detail:
				'Lead rivals in enterprise and coding; Anthropic run-rate revenue >US$30bn (Apr 2026).',
			sources: [
				'https://www.hpcwire.com/off-the-wire/anthropic-signs-google-broadcom-deal-to-add-multi-gigawatt-tpu-capacity/'
			]
		},
		{
			from: 'openai',
			to: 'google-deepmind',
			kind: 'competes',
			label: 'Frontier models',
			detail: 'ChatGPT vs Gemini in consumer AI.',
			sources: ['https://deepmind.google/about/']
		},
		{
			from: 'nvidia',
			to: 'huawei',
			kind: 'competes',
			label: 'AI accelerators in China',
			detail: "Beijing pushes buyers to Ascend; Nvidia's China share fell sharply.",
			sources: [
				'https://www.trendforce.com/news/2026/04/29/news-huawei-ascend-cambricon-and-hygon-completed-day-0-adaptation-to-deepseek-v4/'
			]
		},
		{
			from: 'tsmc',
			to: 'intel',
			kind: 'competes',
			label: 'Leading-edge foundry',
			detail:
				'Intel Foundry 18A/14A seeks external customers (a preliminary Apple deal reported in 2026).',
			sources: [
				'https://www.intc.com/news-events/press-releases/detail/1748/intel-and-trump-administration-reach-historic-agreement-to'
			]
		},
		{
			from: 'sk-hynix',
			to: 'samsung-electronics',
			kind: 'competes',
			label: 'HBM',
			detail: 'HBM4 race for Vera Rubin.',
			sources: ['https://news.skhynix.com/']
		}
	],
	parts: [
		{
			id: 'chips',
			title: 'Chip supply chain',
			ids: [
				'asml',
				'carl-zeiss-smt',
				'tsmc',
				'samsung-electronics',
				'intel',
				'sk-hynix',
				'micron',
				'nvidia',
				'amd',
				'broadcom',
				'arm',
				'applied-materials',
				'lam-research',
				'tokyo-electron',
				'cadence',
				'synopsys',
				'huawei',
				'smic',
				'rapidus',
				'microsoft',
				'openai'
			]
		},
		{
			id: 'labs',
			title: 'Labs and clouds',
			ids: [
				'microsoft',
				'amazon',
				'alphabet-google',
				'google-deepmind',
				'oracle',
				'coreweave',
				'meta',
				'openai-foundation',
				'openai',
				'anthropic',
				'spacex-xai',
				'mistral-ai',
				'deepseek',
				'alibaba',
				'moonshot-ai',
				'safe-superintelligence',
				'nvidia',
				'amd',
				'broadcom',
				'huawei'
			]
		},
		{
			id: 'funding',
			title: 'Investors and funding',
			ids: [
				'softbank',
				'mgx',
				'pif',
				'humain',
				'qia',
				'g42',
				'china-big-fund',
				'microsoft',
				'amazon',
				'alphabet-google',
				'nvidia',
				'openai',
				'anthropic',
				'spacex-xai',
				'mistral-ai',
				'asml',
				'coreweave',
				'uae-government',
				'saudi-arabia-government',
				'intel',
				'united-states-government',
				'japan-government',
				'rapidus',
				'eurohpc-ju'
			]
		},
		{
			id: 'governments',
			title: 'Governments and export controls',
			ids: [
				'united-states-government',
				'us-bis',
				'chips-program-office',
				'china-government',
				'netherlands-government',
				'taiwan-government',
				'japan-government',
				'south-korea-government',
				'uk-government',
				'uae-government',
				'saudi-arabia-government',
				'european-union',
				'european-commission',
				'eurohpc-ju',
				'china-big-fund',
				'rapidus',
				'asml',
				'tsmc',
				'nvidia',
				'intel',
				'smic',
				'huawei'
			]
		},
		{
			id: 'safety',
			title: 'AI safety and standards',
			ids: [
				'nist',
				'caisi',
				'uk-aisi',
				'uk-government',
				'eu-ai-office',
				'european-commission',
				'european-union',
				'oecd',
				'international-network-ai-safety-institutes',
				'frontier-model-forum',
				'mlcommons',
				'united-states-government',
				'openai',
				'anthropic',
				'google-deepmind',
				'microsoft',
				'meta',
				'amazon'
			]
		}
	],
	routes: [
		{
			id: 'chip',
			title: 'How an AI chip gets made',
			steps: [
				{
					id: 'carl-zeiss-smt',
					note: "Makes the optics inside ASML's machines."
				},
				{
					id: 'asml',
					note: 'The only maker of EUV lithography machines.'
				},
				{
					id: 'nvidia',
					note: 'Designs the GPU but owns no factories.'
				},
				{
					id: 'tsmc',
					note: 'Makes and packages the chip.'
				},
				{
					id: 'sk-hynix',
					note: 'Supplies the high-bandwidth memory stacked next to it.'
				},
				{
					id: 'microsoft',
					note: 'Buys the chips for its cloud data centres.'
				},
				{
					id: 'openai',
					note: 'Rents the compute to train and serve its models.'
				}
			]
		},
		{
			id: 'lab-funding',
			title: 'Who pays for the frontier labs',
			steps: [
				{
					id: 'microsoft',
					note: "OpenAI's largest outside shareholder."
				},
				{
					id: 'openai',
					note: 'Raises money from big tech, chipmakers and SoftBank.'
				},
				{
					id: 'softbank',
					note: 'Leads funding for OpenAI and Stargate.'
				},
				{
					id: 'amazon',
					note: "Anthropic's largest cloud partner and investor."
				},
				{
					id: 'alphabet-google',
					note: 'Invests in Anthropic and supplies its TPUs.'
				},
				{
					id: 'anthropic',
					note: 'Raises money from cloud providers and funds.'
				},
				{
					id: 'nvidia',
					note: 'Invests in many of its own customers.'
				}
			]
		},
		{
			id: 'exports',
			title: 'Who can stop a chip export',
			steps: [
				{
					id: 'us-bis',
					note: 'Licenses exports of advanced chips and tools.'
				},
				{
					id: 'netherlands-government',
					note: "Licenses ASML's machines leaving the Netherlands."
				},
				{
					id: 'japan-government',
					note: 'Controls exports of Japanese chipmaking tools.'
				},
				{
					id: 'china-government',
					note: 'Restricts rare earths and blocks some chip imports.'
				}
			]
		},
		{
			id: 'safety',
			title: 'Who checks frontier models',
			steps: [
				{
					id: 'caisi',
					note: 'The US centre that tests models with the labs.'
				},
				{
					id: 'uk-aisi',
					note: 'The UK institute that tests models before release.'
				},
				{
					id: 'eu-ai-office',
					note: "Enforces the AI Act's rules on general-purpose models."
				},
				{
					id: 'international-network-ai-safety-institutes',
					note: 'Links the national institutes.'
				},
				{
					id: 'frontier-model-forum',
					note: "The labs' own industry body for safety practice."
				}
			]
		}
	]
};
