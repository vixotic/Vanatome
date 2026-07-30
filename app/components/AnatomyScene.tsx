"use client";

import {
  VanatomeViewer,
  type VanatomeAtlas,
  type VanatomeContextMenuEvent,
  type VanatomeIsolationState,
} from "@vixotic/vanatome-react";

type Props = {
  atlas: VanatomeAtlas;
  selectedId: string | null;
  isolation: VanatomeIsolationState | null;
  visibleLayers: readonly string[];
  focusRequestKey: number;
  resetViewKey: number;
  onSelect: (id: string | null) => void;
  onStructureContextMenu: (event: VanatomeContextMenuEvent) => void;
  onEscape: () => void;
};

export function AnatomyScene({ atlas, ...props }: Props) {
  return (
    <VanatomeViewer
      atlas={atlas}
      modelScale={7}
      modelPosition={[0, -6.1, 0]}
      initialCameraPosition={[0, 0, 18]}
      focusDistance={2.2}
      enablePan
      alwaysVisibleIds={["body-shell"]}
      loadingFallback={(
        <div className="scene-loading">
          <div className="scanner-ring" />
          <span>Loading anatomical geometry</span>
        </div>
      )}
      {...props}
    />
  );
}
