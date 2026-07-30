const LOCAL_ATLAS_CATALOG_URL = "/atlas/demo-1.2.0/catalog.json";
const PUBLIC_ATLAS_CATALOG_URL =
  "https://atlas.vanatome.vixotic.in/releases/1.2.0/catalog.json";
const configuredCatalogUrl =
  process.env.NEXT_PUBLIC_VANATOME_ATLAS_CATALOG_URL;

export const ATLAS_CATALOG_URL =
  configuredCatalogUrl ??
  (process.env.NODE_ENV === "production"
    ? PUBLIC_ATLAS_CATALOG_URL
    : LOCAL_ATLAS_CATALOG_URL);

export const ATLAS_CATALOG_IS_DEMO =
  !configuredCatalogUrl && process.env.NODE_ENV !== "production";

export const ATLAS_ATTRIBUTION_URL =
  ATLAS_CATALOG_URL.startsWith("http")
    ? new URL("../../ATTRIBUTION.txt", ATLAS_CATALOG_URL).href
    : "/ATTRIBUTION.txt";
