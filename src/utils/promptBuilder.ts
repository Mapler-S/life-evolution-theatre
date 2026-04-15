/**
 * AI 提示词构造 —— 高质量科研级古生物复原
 *
 * 设计理念：
 * - 每个类群拥有独有的视觉特征描述（形态、纹理、色彩、生态位）
 * - 参考顶级古生物艺术家风格（Zdeněk Burian, Mark Witton, Julius Csotonyi）
 * - prompt 引导生成带解剖标注风格的精美图版
 * - 兼顾科学准确性和艺术表现力
 */

import type { ExtinctionEvent, TaxonNode } from '../types'

/* ══════════════════════════════════════════════════
   类群专属视觉特征词库
   ══════════════════════════════════════════════════ */

interface TaxonTraits {
  /** 核心形态特征 */
  morphology: string
  /** 纹理/材质 */
  texture: string
  /** 色彩参考 */
  palette: string
  /** 生态场景 */
  habitat: string
  /** 比例尺参考 */
  scale: string
  /** 独特亮点 */
  signature: string
}

const TAXON_TRAITS: Record<string, TaxonTraits> = {
  /* ── 节肢动物 ── */
  Trilobita: {
    morphology: 'segmented exoskeleton with prominent cephalon bearing compound schizochroal eyes, thorax with articulated pleural segments, and semicircular pygidium',
    texture: 'glossy chitinous carapace with fine granular ornament, terrace ridges along margins',
    palette: 'deep amber-brown with darker axial lobe, translucent calcite eye lenses catching light',
    habitat: 'Paleozoic seafloor among crinoid gardens and bryozoan reefs, dappled light filtering through shallow water',
    scale: '3–8 cm body length, shown with 1 cm scale bar',
    signature: 'enrolled defensive posture shown in secondary inset diagram',
  },
  Eurypterida: {
    morphology: 'elongated body with chelicerae, paddle-shaped swimming appendages (6th pair), segmented opisthosoma ending in telson spike',
    texture: 'dark exoskeleton with scale-like ornamentation, smooth ventral surface',
    palette: 'deep olive-green to charcoal black, pale joints between segments',
    habitat: 'brackish Silurian lagoon with rippled sandy bottom, hunting among nautiloid shells',
    scale: 'up to 2.5 m, shown with 10 cm scale bar',
    signature: 'largest arthropod ever — imposing ventral view showing chelicerae spread',
  },
  Chelicerata: {
    morphology: 'prosoma with chelicerae and pedipalps, opisthosoma, four pairs of walking legs, book lungs or book gills',
    texture: 'smooth to lightly granular exoskeleton, fine setae on appendages',
    palette: 'earthy brown tones, horseshoe crab steel-blue blood reference',
    habitat: 'tidal flat at dawn, tracks trailing behind in wet sand',
    scale: '5–60 cm range, shown with 5 cm scale bar',
    signature: 'cross-section inset showing book gill respiration anatomy',
  },
  Crustacea: {
    morphology: 'biramous appendages, carapace shield, compound stalked eyes, multiple specialized limb pairs',
    texture: 'calcified exoskeleton with micro-pitting, antennae with fine annulations',
    palette: 'translucent amber to coral red, blue-green iridescence on carapace',
    habitat: 'sunlit reef margin surrounded by diverse invertebrate community',
    scale: '1–30 cm range, shown with 2 cm scale bar',
    signature: 'detailed view of biramous appendage structure in margin diagram',
  },
  Hexapoda: {
    morphology: 'three-part body (head, thorax, abdomen), three pairs of jointed legs, compound eyes, often with wings',
    texture: 'articulated exoskeleton with micro-sculptured surface, wing venation pattern',
    palette: 'iridescent greens and blues, amber-preserved specimen golden tones',
    habitat: 'Carboniferous swamp forest with giant ferns and Lepidodendron trunks',
    scale: 'Meganeura wingspan ~70 cm with 5 cm scale bar',
    signature: 'wing venation diagram in upper corner with taxonomic family annotation',
  },

  /* ── 软体动物 ── */
  Ammonoidea: {
    morphology: 'planispiral coiled shell with complex suture patterns (goniatitic/ceratitic/ammonitic), body chamber housing tentacled soft body, siphuncle tube',
    texture: 'mother-of-pearl nacre on shell interior, ribbed exterior with growth lines, delicate suture lines visible on weathered surface',
    palette: 'opalescent shell with rainbow nacre, warm amber body tones, deep blue ocean backdrop',
    habitat: 'Mesozoic open ocean, drifting among jellyfish with mosasaur silhouette in background',
    scale: '5–50 cm diameter, shown with 5 cm scale bar',
    signature: 'suture pattern diagram beside the main figure showing fractal-like complexity',
  },
  Belemnoidea: {
    morphology: 'torpedo-shaped internal shell (guard/rostrum), squid-like body with ten arms bearing hooks, large eyes, ink sac',
    texture: 'smooth calcite rostrum with radial crystalline structure in cross-section',
    palette: 'dark mahogany rostrum fossil, reconstructed animal in iridescent purple-grey',
    habitat: 'Jurassic shallow sea, hunting in small shoal formation near reef',
    scale: '15–40 cm length, shown with 5 cm scale bar',
    signature: 'cross-section of rostrum showing concentric growth rings as inset',
  },
  Nautiloidea: {
    morphology: 'coiled or straight chambered shell with simple suture lines, hood covering retracted tentacles, pinhole camera eye',
    texture: 'smooth polished shell with bold tiger-stripe color bands, pearly interior',
    palette: 'cream and reddish-brown alternating bands, deep nacreous interior',
    habitat: 'tropical reef slope, gliding above coral garden at moderate depth',
    scale: '15–25 cm diameter, shown with 5 cm scale bar',
    signature: 'cutaway view of internal chambers and siphuncle as technical inset',
  },
  Gastropoda: {
    morphology: 'univalve spiral shell in various coiling modes, muscular foot, radula, tentacles with eyes',
    texture: 'shell with spiral ridges, varices, or smooth polished surface depending on family',
    palette: 'warm coral pinks, cream, chocolate spirals, operculum amber',
    habitat: 'rocky intertidal zone with encrusting algae and barnacle neighbors',
    scale: '1–15 cm, shown with 1 cm scale bar',
    signature: 'radula micro-structure diagram as scanning-electron-microscope style inset',
  },
  Bivalvia: {
    morphology: 'two hinged valves with hinge teeth, adductor muscle scars, pallial sinus, siphons',
    texture: 'concentric growth rings, radial ribs or smooth periostracum',
    palette: 'pearl white interior, grey-brown exterior with purple hinge area',
    habitat: 'sandy substrate half-buried, siphons extended into clear water column',
    scale: '3–20 cm, shown with 2 cm scale bar',
    signature: 'interior valve view showing muscle scars and pallial line as companion diagram',
  },
  Rostroconchia: {
    morphology: 'univalve pseudo-bivalve shell, elongate and laterally compressed with posterior gape',
    texture: 'fine comarginal growth lines on smooth shell surface',
    palette: 'muted brown fossil tones with subtle cream banding',
    habitat: 'Paleozoic muddy seafloor among scattered brachiopod shells',
    scale: '2–5 cm, shown with 1 cm scale bar',
    signature: 'comparison diagram with true bivalve showing evolutionary convergence',
  },

  /* ── 脊索动物 ── */
  'Dinosauria': {
    morphology: 'bipedal theropod or quadrupedal sauropod bauplan, erect gait, fenestrated skull, air-sac system',
    texture: 'scales grading to proto-feathers on smaller theropods, pebbly hide on large forms, keratinous beak edges',
    palette: 'earth-tone camouflage with vivid display patches — rust, teal, ochre stripes',
    habitat: 'Late Cretaceous floodplain with flowering angiosperms, warm golden-hour light',
    scale: '2–30 m body length, human silhouette for scale comparison',
    signature: 'skeletal reconstruction ghosted beneath flesh, showing air-sac system and fenestrae',
  },
  Pterosauria: {
    morphology: 'wing membrane stretched on elongated fourth finger, pneumatic hollow bones, fibrous pycnofiber covering, elaborate cranial crests',
    texture: 'fine pycnofiber fur-like covering over body, thin translucent wing membrane with actinofibrils',
    palette: 'warm sandy-tan body, wing membrane pinkish-translucent, crest with vivid crimson or blue display colors',
    habitat: 'coastal Cretaceous cliff colony, soaring over chalk-white sea cliffs',
    scale: 'Quetzalcoatlus 10 m wingspan, shown with giraffe silhouette for comparison',
    signature: 'wing finger joint anatomy diagram, membrane attachment cross-section as inset',
  },
  Mosasauridae: {
    morphology: 'streamlined marine lizard body, paddle-like flippers, double-hinged jaw, bicarinate teeth, forked tongue',
    texture: 'smooth diamond-shaped scales like modern monitor lizard, counter-shaded',
    palette: 'dark blue-grey dorsal fading to pale ventral, golden eye, teeth gleaming',
    habitat: 'Late Cretaceous Western Interior Seaway, pursuing ammonite prey in open water',
    scale: '6–14 m, shown with diver silhouette for comparison',
    signature: 'jaw mechanics diagram showing pterygoid ratchet system as inset',
  },
  Plesiosauria: {
    morphology: 'barrel-shaped body with four large hydrofoil flippers, very long neck (elasmosaurid) or massive skull (pliosaurid), small head with interlocking teeth',
    texture: 'smooth skin with possible dark-light countershading',
    palette: 'slate grey dorsal, cream ventral, dark eyes',
    habitat: 'open Jurassic ocean, head breaking surface with fish in jaws',
    scale: '3–15 m, shown with small boat silhouette for comparison',
    signature: 'four-flipper underwater locomotion diagram showing figure-eight stroke pattern',
  },
  Placodermi: {
    morphology: 'massive bony head-and-trunk shield with jointed articulation, blade-like gnathal plates instead of true teeth',
    texture: 'thick dermal bone plates with tuberculate ornament, naked posterior body',
    palette: 'gunmetal grey armor plates, dark olive skin on unplated regions',
    habitat: 'Devonian reef, Dunkleosteus ambushing prey among stromatoporoid sponges',
    scale: '1–6 m, shown with human diver silhouette',
    signature: 'articulated skull-trunk joint mechanics diagram as inset',
  },
  Aves: {
    morphology: 'feathered body with pneumatic bones, keeled sternum, pygostyle, beak with no teeth (modern) or toothed (Mesozoic)',
    texture: 'layered contour feathers, iridescent plumage, scaled feet',
    palette: 'brilliant plumage colors — emerald, sapphire, gold — or cryptic mottled browns',
    habitat: 'canopy of flowering trees, mid-flight with wings fully spread',
    scale: '10 cm–2 m wingspan, shown with 10 cm scale bar',
    signature: 'feather microstructure diagram showing barbule hooklets as SEM-style inset',
  },
  Mammalia: {
    morphology: 'differentiated dentition (incisors/canines/premolars/molars), hair/fur, mammary glands, three middle ear ossicles',
    texture: 'dense pelage with guard hairs and underfur, vibrissae on muzzle',
    palette: 'warm brown and golden tones, pale ventral fur, dark nose and eyes',
    habitat: 'early Paleocene forest floor, small nocturnal forms emerging after K-Pg impact',
    scale: '5–30 cm body, shown with 2 cm scale bar',
    signature: 'dentition diagram showing tribosphenic molar occlusion pattern',
  },
  Chondrichthyes: {
    morphology: 'cartilaginous skeleton, placoid scale-covered skin, multiple gill slits, heterocercal tail in sharks',
    texture: 'shagreen dermal denticles giving sandpaper texture, ampullae of Lorenzini pores on snout',
    palette: 'grey-blue dorsal, white ventral countershading, dark fin tips',
    habitat: 'open ocean pelagic zone, sun rays filtering from above',
    scale: '1–6 m, shown with human diver silhouette',
    signature: 'dermal denticle SEM-style micro-diagram as inset, tooth replacement conveyor',
  },
  Osteichthyes: {
    morphology: 'bony skeleton, operculum covering gills, swim bladder, homocercal tail, ray or lobe fins',
    texture: 'overlapping cycloid or ctenoid scales with growth annuli, mucous coating',
    palette: 'silvery lateral line, iridescent blues and greens, warm golden fins',
    habitat: 'sunlit freshwater stream over pebble substrate with aquatic plants',
    scale: '5–80 cm, shown with 5 cm scale bar',
    signature: 'lateral line system and swim bladder anatomy as cross-section inset',
  },
  Amphibia: {
    morphology: 'moist permeable skin, four limbs in tetrapod configuration, external gills in larvae, dual circulatory system',
    texture: 'smooth glandular skin with mucous sheen, some with warty or granular surface',
    palette: 'vivid warning colors (poison frogs) or cryptic greens and browns',
    habitat: 'Carboniferous coal swamp, among giant horsetails and standing water',
    scale: '5–100 cm, shown with 5 cm scale bar',
    signature: 'skin gland cross-section and metamorphosis stages as margin diagrams',
  },
  Synapsida: {
    morphology: 'temporal fenestra behind eye orbit, differentiated dentition developing toward mammalian pattern, sprawling to semi-erect posture',
    texture: 'possibly glandular skin transitioning from reptilian scales to proto-hair',
    palette: 'muted earth tones — olive, sienna, grey — with possible facial markings',
    habitat: 'Permian arid floodplain with Glossopteris vegetation',
    scale: '0.5–3 m, shown with human silhouette for comparison',
    signature: 'temporal fenestra evolution series (pelycosaur → therapsid → mammal) as strip diagram',
  },
  Lepidosauria: {
    morphology: 'overlapping keeled scales, autotomic tail, Jacobson\'s organ, acrodont or pleurodont dentition',
    texture: 'fine imbricate scales with keels, smooth ventral scutes',
    palette: 'vivid greens, desert sandy-tan, or banded black-and-yellow warning colors',
    habitat: 'rocky Mediterranean-type scrubland, basking on sun-warmed limestone',
    scale: '10–300 cm, shown with 5 cm scale bar',
    signature: 'scale arrangement diagram and hemipenis/hemipene note as margin sketch',
  },
  Crocodylia: {
    morphology: 'heavily armored body with osteoderms, long snout with conical teeth, powerful laterally-compressed tail, webbed hind feet',
    texture: 'keeled dorsal osteoderms, smooth ventral scales, integumentary sensory organs on jaw',
    palette: 'dark olive-green dorsal, pale yellow ventral, dark crossbands on tail',
    habitat: 'tropical river bank, half-submerged with only eyes and nostrils above water',
    scale: '2–7 m, shown with human silhouette',
    signature: 'skull dorsal view showing secondary bony palate as scientific inset',
  },

  /* ── 海洋无脊椎 ── */
  Anthozoa: {
    morphology: 'polyp form with oral disc, tentacle ring, columnar body, calcareous corallite skeleton in scleractinians',
    texture: 'fleshy polyps with translucent tissue over stony coral skeleton, symbiotic zooxanthellae visible as color',
    palette: 'fluorescent greens, pinks, purples from symbiotic algae, white skeleton',
    habitat: 'shallow tropical reef crest under clear turquoise water with parrotfish',
    scale: 'individual polyps 1–10 mm, colony 10–200 cm, with 1 cm scale bar',
    signature: 'polyp cross-section showing mesentery arrangement and zooxanthellae as inset',
  },
  Rugosa: {
    morphology: 'solitary horn-shaped or colonial corallum with strong septa arranged in quadrants, cardinal-counter-alar arrangement',
    texture: 'fine calcitic septa with carinae, epitheca with growth rings',
    palette: 'warm limestone tan fossil, reconstructed animal with translucent amber polyp tissue',
    habitat: 'Paleozoic shallow carbonate platform with brachiopod-rich benthos',
    scale: '2–10 cm solitary, up to 30 cm colonial, with 1 cm scale bar',
    signature: 'transverse section showing septal insertion pattern compared to modern Scleractinia',
  },
  Tabulata: {
    morphology: 'colonial corals with small corallites connected by mural pores, prominent horizontal tabulae, reduced or absent septa',
    texture: 'honeycomb-like colony surface, fine-grained limestone matrix',
    palette: 'pale grey-cream fossil, reconstructed with soft green polyps in each corallite',
    habitat: 'Silurian–Devonian reef framework alongside stromatoporoids',
    scale: 'colony 5–30 cm, individual corallite 1–3 mm, with 5 mm scale bar',
    signature: 'longitudinal thin-section showing tabulae stacking as petrographic inset',
  },

  /* ── 腕足 ── */
  Brachiopoda: {
    morphology: 'bivalved shell with pedicle and brachial valves, lophophore for filter feeding, pedicle stalk for attachment',
    texture: 'radial ribbing (costate) or smooth shell, punctate or impunctate test',
    palette: 'grey to warm brown shell, lophophore feathery translucent in reconstruction',
    habitat: 'Paleozoic seafloor in dense clusters, dominating shallow marine carbonate community',
    scale: '1–8 cm, shown with 1 cm scale bar',
    signature: 'lophophore spiral arm anatomy diagram and shell interior showing muscle scars',
  },

  /* ── 棘皮 ── */
  Crinoidea: {
    morphology: 'calyx cup with branching pinnate arms, jointed stem with cirri holdfast, covered ambulacral grooves',
    texture: 'calcite ossicle plates with stereom microstructure, articulated arm segments',
    palette: 'golden-yellow to crimson arms, pale cream stem, deep blue ocean backdrop',
    habitat: 'Mississippian crinoid meadow, dense forest of stems swaying in gentle current',
    scale: 'calyx 2–5 cm, total height 30–100 cm, with 5 cm scale bar',
    signature: 'ossicle stereom microstructure SEM-style inset, arm cross-section',
  },
  Blastoidea: {
    morphology: 'bud-shaped theca with five ambulacral areas bearing brachioles, short stem, hydrospire respiratory structures',
    texture: 'finely sculpted calyx plates with radial symmetry',
    palette: 'warm fossil-ochre tones, delicate pink brachioles in reconstruction',
    habitat: 'Carboniferous crinoidal limestone seafloor alongside fellow pelmatozoans',
    scale: '1–3 cm theca, with 5 mm scale bar',
    signature: 'hydrospire respiratory system cutaway as unique anatomical inset',
  },

  /* ── 海绵 ── */
  Archaeocyatha: {
    morphology: 'double-walled conical to cylindrical skeleton with intervallum filled by septa and tabulae, central cavity',
    texture: 'porous calcareous walls with regular pore pattern',
    palette: 'pale cream skeleton, living tissue reconstructed in soft pink',
    habitat: 'Early Cambrian archaeocyathan reef, first animal-built reef ecosystem on Earth',
    scale: '2–15 cm height, with 1 cm scale bar',
    signature: 'wall pore-structure and water circulation diagram as scientific inset',
  },
  Hexactinellida: {
    morphology: 'siliceous spicules with six-rayed (triaxon) symmetry, lattice-like skeletal framework, Venus flower basket form',
    texture: 'exquisite glass-like spicule lattice, fiber-optic quality silica strands',
    palette: 'translucent ice-white to pale gold, bioluminescent glow in deep-sea setting',
    habitat: 'deep ocean floor (200–1000 m) in darkness, lit by faint bioluminescence',
    scale: '10–30 cm, with 2 cm scale bar',
    signature: 'spicule six-rayed geometry diagram and fiber-optic light transmission inset',
  },

  /* ── 古生代标志 ── */
  Graptolithina: {
    morphology: 'colonial rhabdosome with thecae arranged along stipes, varied stipe branching (dendroid to uniserial)',
    texture: 'organic periderm appearing as graphite-like film on shale, delicate saw-tooth edge',
    palette: 'silver-grey on dark shale matrix, reconstructed colony translucent amber',
    habitat: 'Ordovician open ocean, planktonic colonies drifting in surface currents',
    scale: '2–10 cm rhabdosome length, with 5 mm scale bar',
    signature: 'thecal aperture detail and branching pattern evolution series strip',
  },
  Conodonta: {
    morphology: 'eel-like soft body with large eyes, V-shaped myomeres, complex phosphatic tooth-like elements (conodont apparatus)',
    texture: 'smooth translucent body, crystalline apatite elements with fine denticulation',
    palette: 'amber-brown phosphatic elements, pale translucent body in reconstruction',
    habitat: 'Paleozoic epeiric sea water column, small predator among plankton',
    scale: '2–40 cm animal, elements 0.2–2 mm, with dual scale bars',
    signature: 'complete P-M-S element apparatus reconstruction diagram, the "golden spike" biostratigraphy role noted',
  },
}

/* 默认兜底特征 */
const DEFAULT_TRAITS: TaxonTraits = {
  morphology: 'distinctive body plan with taxonomically diagnostic features visible',
  texture: 'natural surface texture appropriate to the taxon',
  palette: 'naturalistic coloring based on modern analogs and phylogenetic bracketing',
  habitat: 'reconstructed paleoenvironment with contemporaneous flora and fauna',
  scale: 'shown with appropriate metric scale bar',
  signature: 'key diagnostic feature highlighted as scientific annotation inset',
}

/* ══════════════════════════════════════════════════
   Prompt 构造函数
   ══════════════════════════════════════════════════ */

function getTraits(name: string): TaxonTraits {
  // 精确匹配 → 去括号匹配 → 兜底
  return TAXON_TRAITS[name]
    ?? TAXON_TRAITS[name.replace(/\s*\(.*?\)/, '').trim()]
    ?? DEFAULT_TRAITS
}

/** 场景 A / D —— 按地质时期生成生态复原 */
export function buildIntervalPrompt(opts: {
  intervalName: string
  startMa: number
  endMa: number
  dominantTaxa?: string[]
}): string {
  const taxa = (opts.dominantTaxa ?? []).slice(0, 4)
  const mid = Math.round((opts.startMa + opts.endMa) / 2)
  const taxaTraitsSnippets = taxa
    .map(t => {
      const tr = getTraits(t)
      return `${t} (${tr.morphology.split(',')[0]})`
    })
    .join('; ')

  return [
    `Grand scientific plate illustrating the ${opts.intervalName} ecosystem (~${mid} Ma)`,
    `panoramic paleoenvironment reconstruction in the style of a premium natural history museum mural`,
    taxaTraitsSnippets && `dominant fauna: ${taxaTraitsSnippets}`,
    `environment rendered with volumetric atmospheric perspective, golden-hour light raking across the landscape`,
    `include a geological period label "${opts.intervalName}" and a small stratigraphic column in the lower corner`,
    `style: hyper-detailed scientific illustration combining accuracy of Zdeněk Burian with modern digital art techniques`,
  ].filter(Boolean).join('. ')
}

/** 场景 B —— 按分类群生成独具特色的科研插图 */
export function buildTaxonPrompt(opts: {
  taxonName: string
  description?: string
  intervalName?: string
}): string {
  const name = opts.taxonName.replace(/\s*\(.*?\)/, '').trim()
  const tr = getTraits(name)

  return [
    `Museum-quality scientific plate of ${name}`,
    /* 核心形态 */
    `primary figure: full-body reconstruction showing ${tr.morphology}`,
    /* 纹理与色彩 */
    `rendered with ${tr.texture}, coloring: ${tr.palette}`,
    /* 生态场景 */
    `background habitat: ${tr.habitat}`,
    /* 比例 */
    `${tr.scale}`,
    /* 独特标识图 */
    `secondary inset diagram: ${tr.signature}`,
    /* 标注风格 */
    `include fine anatomical leader lines pointing to 3–4 key diagnostic features with Latin labels`,
    opts.description && `context: ${opts.description}`,
    opts.intervalName && `geological period label: "${opts.intervalName}"`,
    /* 整体美学 */
    `overall aesthetic: masterful blend of scientific rigor and fine art — muted parchment border, elegant serif typography, reminiscent of 19th-century zoological monograph plates by Ernst Haeckel combined with modern paleoart quality of Julius Csotonyi`,
  ].filter(Boolean).join('. ')
}

/** 场景 C —— 灭绝前后对比双联画 */
export function buildExtinctionDiptychPrompt(ev: ExtinctionEvent): string {
  const affected = ev.affectedTaxa.slice(0, 3)
  const taxaDetails = affected.map(t => {
    const tr = getTraits(t)
    return `${t} with ${tr.morphology.split(',')[0]}`
  }).join(', ')

  return [
    `Grand diptych scientific plate: ${ev.name} (${ev.ma} Ma), the most dramatic event in the history of life`,

    `LEFT PANEL "Before" — thriving ${ev.intervalBefore} ecosystem at its zenith:`,
    `a lush, vibrant world teeming with ${taxaDetails}`,
    `warm sunlight, rich biodiversity, reef or forest at peak complexity`,
    `painted in warm golds and greens with hyperdetailed organism rendering`,

    `RIGHT PANEL "After" — desolate ${ev.intervalAfter} landscape:`,
    `the same location devastated — empty seafloor / barren terrain / ash-filled sky`,
    `scattered fossils of the victims half-buried in sediment`,
    `cold blue-grey palette, harsh flat light, eerie silence conveyed through empty space`,

    `dividing line between panels: a jagged geological boundary clay layer tinted with iridium anomaly`,
    `title cartouche at top: "${ev.nameZh}" in elegant serif with severity annotation "${Math.round(ev.severity * 100)}% genus-level extinction"`,
    `style: monumental museum-quality scientific comparison plate, dramatic chiaroscuro contrast, the emotional weight of deep time`,
  ].join('. ')
}

/** 根据当前选择，自动推荐默认 prompt */
export function buildDefaultPrompt(
  extinction: ExtinctionEvent | null,
  taxon: TaxonNode | null,
): { prompt: string; scene: 'diptych' | 'taxon' | 'idle' } {
  // 优先以具体类群生成 prompt — 用户点击生物时应看到对应物种的独特提示词
  if (taxon) {
    return {
      prompt: buildTaxonPrompt({
        taxonName: taxon.nam,
        description: undefined,
        intervalName: extinction?.intervalBefore,
      }),
      scene: 'taxon',
    }
  }
  if (extinction) {
    return { prompt: buildExtinctionDiptychPrompt(extinction), scene: 'diptych' }
  }
  return { prompt: '', scene: 'idle' }
}
