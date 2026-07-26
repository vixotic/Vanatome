"use client";

import { VanatomeViewer } from "@vixotic/vanatome-react";
import { vanatomeAtlas } from "../data/anatomy";

type Props = {
  selectedId: string | null;
  isolatedId: string | null;
  visibleLayers: readonly string[];
  focusRequestKey: number;
  resetViewKey: number;
  onSelect: (id: string | null) => void;
};

export function AnatomyScene(props: Props) {
  return (
    <VanatomeViewer
      atlas={vanatomeAtlas}
      modelScale={7}
      modelPosition={[0, -6.1, 0]}
      initialCameraPosition={[0, 0, 18]}
      focusDistance={7.4}
      {...props}
    />
  );
}
