"use client";

import {
  VanatomeViewer,
  type VanatomeAtlas,
} from "@vixotic/vanatome-react";

type Props = {
  atlas: VanatomeAtlas;
  selectedId: string | null;
  isolatedId: string | null;
  visibleLayers: readonly string[];
  focusRequestKey: number;
  resetViewKey: number;
  onSelect: (id: string | null) => void;
};

export function AnatomyScene({ atlas, ...props }: Props) {
  return (
    <VanatomeViewer
      atlas={atlas}
      modelScale={7}
      modelPosition={[0, -6.1, 0]}
      initialCameraPosition={[0, 0, 18]}
      focusDistance={7.4}
      {...props}
    />
  );
}
