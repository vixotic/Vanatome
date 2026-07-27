const LOCAL_ATLAS_CATALOG_URL = "/atlas/demo-1.1.0/catalog.json";

export const ATLAS_CATALOG_URL =
  process.env.NEXT_PUBLIC_VANATOME_ATLAS_CATALOG_URL ??
  (process.env.NODE_ENV === "production"
    ? "/releases/1.1.0/catalog.json"
    : LOCAL_ATLAS_CATALOG_URL);

export const ATLAS_ATTRIBUTION_URL =
  ATLAS_CATALOG_URL.startsWith("http")
    ? new URL("../../ATTRIBUTION.txt", ATLAS_CATALOG_URL).href
    : "/ATTRIBUTION.txt";
