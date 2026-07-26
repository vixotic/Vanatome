import {
  createVanatomeHierarchy,
  type VanatomeAtlas,
  type VanatomeHierarchyNode,
  type VanatomeStructure,
} from "@vixotic/vanatome-react";

export type AnatomyRegion = "thorax" | "abdomen" | "pelvis";

export type AnatomyStructure = VanatomeStructure & {
  region: AnatomyRegion;
  scale: [number, number, number];
  color: string;
  summary: NonNullable<VanatomeStructure["summary"]>;
  function: NonNullable<VanatomeStructure["function"]>;
  fact: NonNullable<VanatomeStructure["fact"]>;
};

export const anatomyRegistry: AnatomyStructure[] = [
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
];

export const anatomyById = Object.fromEntries(
  anatomyRegistry.map((structure) => [structure.id, structure]),
) as Record<string, AnatomyStructure>;

const hierarchyRegions: VanatomeStructure[] = [
  {
    id: "thorax",
    name: "Thorax",
    system: "Regional anatomy",
    layer: "region",
    position: [0, 2.8, 0],
  },
  {
    id: "abdomen",
    name: "Abdomen",
    system: "Regional anatomy",
    layer: "region",
    position: [0, 1.5, 0],
  },
  {
    id: "pelvis",
    name: "Pelvis",
    system: "Regional anatomy",
    layer: "region",
    position: [0, 0, 0],
  },
];

export const anatomyHierarchy = createVanatomeHierarchy([
  ...hierarchyRegions,
  ...anatomyRegistry,
]) as VanatomeHierarchyNode[];

export const anatomyLayers = [
  { id: "cardiovascular", label: "Cardio" },
  { id: "respiratory", label: "Respiratory" },
  { id: "digestive", label: "Digestive" },
  { id: "urinary", label: "Urinary" },
] as const;

export const vanatomeAtlas: VanatomeAtlas = {
  id: "vanatome-human",
  name: "Vanatome Human Atlas",
  version: "1.0.0",
  modelUrl: "/models/z-anatomy-full-body.glb",
  structures: anatomyRegistry,
  attribution: "Z-Anatomy contributors, CC BY-SA 4.0",
};
