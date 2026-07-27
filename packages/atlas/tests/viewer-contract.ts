import type { VanatomeAtlas as PublishedViewerAtlas } from "@vixotic/vanatome-react";
import type { VanatomeViewerAtlas } from "../src/types.js";

type Assert<T extends true> = T;

type ViewerAcceptsLoadedAtlas = Assert<
  VanatomeViewerAtlas extends PublishedViewerAtlas ? true : false
>;

export type { ViewerAcceptsLoadedAtlas };
