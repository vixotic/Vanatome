import {
  createVanatomeHierarchy,
  type VanatomeAtlas,
  type VanatomeHierarchyNode,
  type VanatomeStructure,
} from "@vixotic/vanatome-react";
import type {
  AnatomyStructure as AtlasStructure,
  LoadedAtlasBundle,
} from "@vixotic/vanatome-atlas";

export type AnatomyRegion = "head" | "thorax" | "abdomen" | "pelvis";

export type AnatomyStructure = VanatomeStructure & {
  region?: AnatomyRegion;
  scale: [number, number, number];
  color: string;
  summary: NonNullable<VanatomeStructure["summary"]>;
  function: NonNullable<VanatomeStructure["function"]>;
  fact: NonNullable<VanatomeStructure["fact"]>;
};

type CuratedStructure = Omit<AnatomyStructure, "position" | "scale"> & {
  position?: [number, number, number];
  scale?: [number, number, number];
};

export type AnatomyData = {
  registry: AnatomyStructure[];
  byId: Record<string, AnatomyStructure>;
  hierarchy: VanatomeHierarchyNode[];
  layers: readonly { id: string; label: string }[];
  mappedNodeCount: number;
  atlas: VanatomeAtlas;
  attributionUrl: string;
};

function releasedStructure(structure: CuratedStructure): CuratedStructure {
  return structure;
}

const curatedRegistry: CuratedStructure[] = [
  {
    id: "heart",
    name: "Heart",
    system: "Cardiovascular",
    region: "thorax",
    layer: "cardiovascular",
    parentId: "thorax",
    color: "#ff4f87",
    position: [0.16, 2.94, 0.17],
    scale: [0.58, 0.72, 0.5],
    summary: "A muscular organ centered behind the sternum and angled slightly left.",
    function: "Pumps oxygenated blood through systemic circulation and deoxygenated blood to the lungs.",
    fact: "Its four chambers coordinate as two synchronized pumps.",
  },
  {
    id: "lungs",
    name: "Lungs",
    system: "Respiratory",
    region: "thorax",
    layer: "respiratory",
    parentId: "thorax",
    color: "#63e6ff",
    position: [-0.01, 2.99, 0.07],
    scale: [1.25, 0.95, 0.55],
    summary: "Paired spongy organs filling most of the chest cavity.",
    function: "Exchange oxygen and carbon dioxide between inhaled air and the bloodstream.",
    fact: "The right lung has three lobes; the left has two to make room for the heart.",
  },
  {
    id: "liver",
    name: "Liver",
    system: "Digestive",
    region: "abdomen",
    layer: "digestive",
    parentId: "abdomen",
    color: "#ff945e",
    position: [-0.08, 2.12, 0.16],
    scale: [1.12, 0.48, 0.58],
    summary: "The largest solid internal organ, primarily in the upper-right abdomen.",
    function: "Processes nutrients, produces bile, stores energy, and helps filter blood.",
    fact: "It can restore much of its mass after partial surgical removal.",
  },
  {
    id: "stomach",
    name: "Stomach",
    system: "Digestive",
    region: "abdomen",
    layer: "digestive",
    parentId: "abdomen",
    color: "#c879ff",
    position: [0.27, 2.06, 0.25],
    scale: [0.52, 0.72, 0.45],
    summary: "A curved muscular sac in the upper-left abdomen.",
    function: "Mixes food with acid and enzymes before controlled release into the small intestine.",
    fact: "Its muscular wall churns a meal into a semi-liquid mixture called chyme.",
  },
  {
    id: "kidneys",
    name: "Kidneys",
    system: "Urinary",
    region: "abdomen",
    layer: "urinary",
    parentId: "abdomen",
    color: "#ff6f61",
    position: [0.01, 1.62, -0.09],
    scale: [1.02, 0.58, 0.38],
    summary: "A pair of bean-shaped organs positioned toward the back of the abdomen.",
    function: "Filter the blood, regulate fluid and electrolytes, and produce urine.",
    fact: "Each kidney contains roughly one million microscopic filtering units called nephrons.",
  },
  {
    id: "small-intestine",
    name: "Small Intestine",
    system: "Digestive",
    region: "abdomen",
    layer: "digestive",
    parentId: "abdomen",
    color: "#ffd36a",
    position: [0.06, 0.99, 0.3],
    scale: [0.95, 0.72, 0.45],
    summary: "A long, folded tube occupying much of the central lower abdomen.",
    function: "Completes most chemical digestion and absorbs nutrients into blood and lymph.",
    fact: "Its inner surface is amplified by folds, villi, and microvilli.",
  },
  {
    id: "large-intestine",
    name: "Large Intestine",
    system: "Digestive",
    region: "abdomen",
    layer: "digestive",
    parentId: "abdomen",
    color: "#47d7a5",
    position: [0, 0.69, 0.03],
    scale: [1.22, 0.92, 0.52],
    summary: "A wider tube framing the small intestine from the cecum to the rectum.",
    function: "Absorbs water and electrolytes and compacts waste.",
    fact: "Its resident microbiome helps process material the small intestine cannot digest.",
  },
  {
    id: "bladder",
    name: "Urinary Bladder",
    system: "Urinary",
    region: "pelvis",
    layer: "urinary",
    parentId: "pelvis",
    color: "#4bb7ff",
    position: [0, -0.11, 0],
    scale: [0.52, 0.46, 0.45],
    summary: "A hollow muscular reservoir seated low in the pelvis.",
    function: "Stores urine from the kidneys until voluntary release.",
    fact: "Stretch-sensitive nerves report bladder filling to the nervous system.",
  },
  releasedStructure({
    id: "trachea",
    name: "Trachea",
    system: "Respiratory",
    region: "thorax",
    layer: "respiratory",
    parentId: "thorax",
    color: "#62d6e8",
    summary: "A cartilage-supported airway descending from the larynx toward the lungs.",
    function: "Conducts inhaled and exhaled air between the upper airway and bronchi.",
    fact: "C-shaped cartilage rings help prevent the airway from collapsing.",
  }),
  releasedStructure({
    id: "oesophagus",
    name: "Oesophagus",
    system: "Digestive",
    region: "thorax",
    layer: "digestive",
    parentId: "thorax",
    color: "#d57f8e",
    summary: "A muscular tube passing through the thorax toward the stomach.",
    function: "Moves swallowed material to the stomach through coordinated contractions.",
    fact: "Its wave-like propulsive contractions are called peristalsis.",
  }),
  releasedStructure({
    id: "gallbladder",
    name: "Gallbladder",
    system: "Digestive",
    region: "abdomen",
    layer: "digestive",
    parentId: "abdomen",
    color: "#63a957",
    summary: "A small sac tucked beneath the liver.",
    function: "Stores and concentrates bile before releasing it into the small intestine.",
    fact: "Bile helps disperse dietary fats during digestion.",
  }),
  releasedStructure({
    id: "pancreas",
    name: "Pancreas",
    system: "Digestive",
    region: "abdomen",
    layer: "digestive",
    parentId: "abdomen",
    color: "#efad5c",
    summary: "An elongated gland lying behind the stomach.",
    function: "Supplies digestive enzymes and produces hormones involved in glucose control.",
    fact: "It serves both digestive and endocrine roles.",
  }),
  releasedStructure({
    id: "spleen",
    name: "Spleen",
    system: "Lymphatic",
    region: "abdomen",
    layer: "lymphatic",
    parentId: "abdomen",
    color: "#a94f78",
    summary: "A blood-rich lymphatic organ in the upper-left abdomen.",
    function: "Filters circulating blood and supports immune responses.",
    fact: "It also removes aging red blood cells from circulation.",
  }),
  releasedStructure({
    id: "brainstem",
    name: "Brainstem",
    system: "Nervous",
    region: "head",
    layer: "nervous",
    parentId: "head",
    color: "#ad7bdc",
    summary: "The midbrain, pons, and medulla forming the lower central brain axis.",
    function: "Relays signals and supports essential autonomic, motor, and sensory functions.",
    fact: "It connects higher brain regions with the spinal cord.",
  }),
  releasedStructure({
    id: "fourth-ventricle",
    name: "Fourth Ventricle",
    system: "Nervous",
    region: "head",
    layer: "nervous",
    parentId: "head",
    color: "#4db8eb",
    summary: "A cerebrospinal-fluid cavity between the brainstem and cerebellum.",
    function: "Provides a channel and reservoir within the ventricular system.",
    fact: "It continues inferiorly toward the spinal cord's central canal.",
  }),
  releasedStructure({
    id: "cerebral-aqueduct",
    name: "Cerebral Aqueduct",
    system: "Nervous",
    region: "head",
    layer: "nervous",
    parentId: "head",
    color: "#40a8e6",
    summary: "A narrow cerebrospinal-fluid channel through the midbrain.",
    function: "Connects the third and fourth ventricles.",
    fact: "Its narrow caliber makes blockage clinically significant.",
  }),
  releasedStructure({
    id: "superior-colliculi",
    name: "Superior Colliculi",
    system: "Nervous",
    region: "head",
    layer: "nervous",
    parentId: "head",
    color: "#e685a7",
    summary: "Paired rounded structures on the dorsal midbrain.",
    function: "Coordinate orienting movements toward visual stimuli.",
    fact: "They help align movements of the eyes and head.",
  }),
  releasedStructure({
    id: "inferior-colliculi",
    name: "Inferior Colliculi",
    system: "Nervous",
    region: "head",
    layer: "nervous",
    parentId: "head",
    color: "#d9709a",
    summary: "Paired auditory relay structures on the dorsal midbrain.",
    function: "Integrate auditory signals before they reach higher relay centers.",
    fact: "They contribute to rapid orientation toward sounds.",
  }),
  releasedStructure({
    id: "medullary-olives",
    name: "Medullary Olives",
    system: "Nervous",
    region: "head",
    layer: "nervous",
    parentId: "head",
    color: "#b88ee5",
    summary: "Paired surface prominences along the medulla oblongata.",
    function: "Relay motor-learning signals toward the cerebellum.",
    fact: "The underlying inferior olivary nuclei have strong cerebellar connections.",
  }),
  releasedStructure({
    id: "medullary-pyramids",
    name: "Medullary Pyramids",
    system: "Nervous",
    region: "head",
    layer: "nervous",
    parentId: "head",
    color: "#9f75d9",
    summary: "Paired longitudinal ridges on the front of the medulla.",
    function: "Carry major descending pathways for voluntary movement.",
    fact: "Many fibers cross near the lower end of the medulla.",
  }),
  releasedStructure({
    id: "red-nuclei",
    name: "Red Nuclei",
    system: "Nervous",
    region: "head",
    layer: "nervous",
    parentId: "head",
    color: "#eb426b",
    summary: "Paired motor-related nuclei within the midbrain.",
    function: "Participate in motor coordination through cerebellar and descending circuits.",
    fact: "Their reddish appearance is associated with iron-containing pigment.",
  }),
  releasedStructure({
    id: "oculomotor-nuclei",
    name: "Oculomotor Nuclei",
    system: "Nervous",
    region: "head",
    layer: "nervous",
    parentId: "head",
    color: "#75d1c7",
    summary: "Paired motor and accessory nuclei in the midbrain.",
    function: "Control most eye movements and contribute to pupil constriction.",
    fact: "Their fibers travel in the third cranial nerve.",
  }),
  releasedStructure({
    id: "facial-motor-nuclei",
    name: "Facial Motor Nuclei",
    system: "Nervous",
    region: "head",
    layer: "nervous",
    parentId: "head",
    color: "#6bc2d6",
    summary: "Paired motor nuclei located in the pons.",
    function: "Drive muscles used for facial expression.",
    fact: "Their axons emerge as part of the facial nerve.",
  }),
  releasedStructure({
    id: "abducens-nuclei",
    name: "Abducens Nuclei",
    system: "Nervous",
    region: "head",
    layer: "nervous",
    parentId: "head",
    color: "#61b3df",
    summary: "Paired eye-movement nuclei in the lower pons.",
    function: "Coordinate outward movement of the eyes.",
    fact: "Each nucleus contributes fibers to the sixth cranial nerve.",
  }),
  releasedStructure({
    id: "superior-salivatory-nuclei",
    name: "Superior Salivatory Nuclei",
    system: "Nervous",
    region: "head",
    layer: "nervous",
    parentId: "head",
    color: "#80ccb2",
    summary: "Paired autonomic nuclei associated with the facial nerve.",
    function: "Contribute signals for tear and salivary secretion.",
    fact: "Their output reaches glands through parasympathetic pathways.",
  }),
  releasedStructure({
    id: "vestibular-nuclei",
    name: "Vestibular Nuclei",
    system: "Nervous",
    region: "head",
    layer: "nervous",
    parentId: "head",
    color: "#57c7d1",
    summary: "Paired groups of nuclei near the junction of the pons and medulla.",
    function: "Integrate inner-ear signals used for balance, gaze, and posture.",
    fact: "They link vestibular input with eye-movement and spinal pathways.",
  }),
  releasedStructure({
    id: "interpeduncular-fossae",
    name: "Interpeduncular Fossae",
    system: "Nervous",
    region: "head",
    layer: "nervous",
    parentId: "head",
    color: "#bea0e6",
    summary: "A paired model representation of the depression between the cerebral peduncles.",
    function: "Marks an important ventral midbrain surface relationship.",
    fact: "Several vessels and cranial-nerve landmarks lie near this region.",
  }),
];

const systemColors: Record<string, string> = {
  cardiovascular: "#ff4f87",
  respiratory: "#63e6ff",
  digestive: "#ffb36a",
  urinary: "#6ea8ff",
  lymphatic: "#62d9a7",
  nervous: "#b784ff",
  skeletal: "#9befff",
};

function displayName(value: string) {
  const side = value.match(/\.(l|r)$/iu)?.[1]?.toLowerCase();
  const withoutSide = value.replace(/\.(l|r)$/iu, "");
  const spaced = withoutSide.replace(/[-_]+/gu, " ");
  const titled = spaced.replace(/\b\w/gu, (letter) => letter.toUpperCase());
  return side ? `${titled} (${side === "l" ? "left" : "right"})` : titled;
}

function systemName(value: string) {
  return value
    .split("-")
    .map((word) => `${word[0].toUpperCase()}${word.slice(1)}`)
    .join(" ");
}

const layerDefinitions = [
  { id: "cardiovascular", label: "Cardio" },
  { id: "respiratory", label: "Respiratory" },
  { id: "digestive", label: "Digestive" },
  { id: "urinary", label: "Urinary" },
  { id: "lymphatic", label: "Lymphatic" },
  { id: "nervous", label: "Nervous" },
  { id: "skeletal", label: "Skeletal" },
] as const;

export function createAnatomyData(bundle: LoadedAtlasBundle): AnatomyData {
  const releasedStructures = bundle.metadata.structures;
  const releasedById = new Map(
    releasedStructures.map((structure) => [structure.id, structure]),
  );

  const normalizedCuratedRegistry = curatedRegistry.map((structure) => {
    const released = releasedById.get(structure.id);
    if (!released) {
      throw new Error(`Loaded atlas metadata is missing ${structure.id}`);
    }
    return {
      ...structure,
      parentId: released.parentId ?? structure.parentId,
      layer: released.layer,
      position: [...released.position] as [number, number, number],
      scale: [1, 1, 1] as [number, number, number],
    };
  });

  const curatedById = new Map(
    normalizedCuratedRegistry.map((structure) => [structure.id, structure]),
  );

  function nearestCuratedAncestor(structure: AtlasStructure) {
    let parentId = structure.parentId;
    while (parentId) {
      const curated = curatedById.get(parentId);
      if (curated) return curated;
      parentId = releasedById.get(parentId)?.parentId;
    }
    return undefined;
  }

  const generatedRegistry: AnatomyStructure[] = releasedStructures
    .filter(
      (structure) =>
        structure.selectable !== false && !curatedById.has(structure.id),
    )
    .map((structure) => {
      const ancestor = nearestCuratedAncestor(structure);
      const name = displayName(structure.name ?? structure.id);
      const system = systemName(structure.system);
      const parentName = structure.parentId
        ? displayName(
            releasedById.get(structure.parentId)?.name ?? structure.parentId,
          )
        : system;
      return {
        id: structure.id,
        name,
        system,
        layer: structure.layer,
        parentId: structure.parentId,
        color: ancestor?.color ?? structure.color ??
          systemColors[structure.system] ?? "#58e7ff",
        position: [...structure.position] as [number, number, number],
        scale: [1, 1, 1],
        summary: structure.summary ??
          (structure.kind === "system"
            ? `${name} structures available in the current atlas.`
            : `${name}, represented as part of ${parentName}.`),
        function: structure.function ?? ancestor?.function ??
          `Explore the mapped anatomy of the ${name.toLowerCase()}.`,
        fact: structure.fact ?? ancestor?.fact ??
          "This structure retains its own stable atlas identifier and selectable mesh.",
      };
    });

  const registry: AnatomyStructure[] = [
    ...normalizedCuratedRegistry,
    ...generatedRegistry,
  ];
  const viewerStructures: VanatomeStructure[] = [
    ...registry,
    ...releasedStructures.filter(
      (structure) =>
        structure.selectable === false && !curatedById.has(structure.id),
    ),
  ];
  const byId = Object.fromEntries(
    registry.map((structure) => [structure.id, structure]),
  ) as Record<string, AnatomyStructure>;
  const hierarchy = createVanatomeHierarchy(
    registry,
  ) as VanatomeHierarchyNode[];
  const availableLayers = new Set(bundle.descriptor.layers);
  const layers = layerDefinitions.filter((layer) =>
    availableLayers.has(layer.id)
  );

  return {
    registry,
    byId,
    hierarchy,
    layers,
    mappedNodeCount: bundle.metadata.nodeCount,
    atlas: {
      ...bundle.atlas,
      structures: viewerStructures,
    },
    attributionUrl: bundle.provenance.noticeUrl ?? "/ATTRIBUTION.txt",
  };
}
