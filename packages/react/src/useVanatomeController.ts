import { useCallback, useMemo, useState } from "react";
import type { VanatomeController } from "./types.js";

export function useVanatomeController(
  initialLayers: readonly string[] = [],
): VanatomeController {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isolatedId, setIsolatedId] = useState<string | null>(null);
  const [visibleLayers, setVisibleLayersState] =
    useState<readonly string[]>(initialLayers);
  const [focusRequestKey, setFocusRequestKey] = useState(0);
  const [resetViewKey, setResetViewKey] = useState(0);

  const select = useCallback((id: string | null) => {
    setSelectedId(id);
    if (id) setFocusRequestKey((key) => key + 1);
  }, []);
  const focus = useCallback((id?: string | null) => {
    if (id !== undefined) setSelectedId(id);
    setFocusRequestKey((key) => key + 1);
  }, []);
  const isolate = useCallback((id?: string | null) => {
    setIsolatedId(id === undefined ? selectedId : id);
  }, [selectedId]);
  const reset = useCallback(() => {
    setSelectedId(null);
    setIsolatedId(null);
    setVisibleLayersState(initialLayers);
    setResetViewKey((key) => key + 1);
  }, [initialLayers]);
  const setVisibleLayers = useCallback((layers: readonly string[]) => {
    setVisibleLayersState([...layers]);
  }, []);
  const toggleLayer = useCallback((layer: string) => {
    setVisibleLayersState((layers) =>
      layers.includes(layer)
        ? layers.filter((candidate) => candidate !== layer)
        : [...layers, layer],
    );
  }, []);

  return useMemo(
    () => ({
      selectedId,
      isolatedId,
      visibleLayers,
      focusRequestKey,
      resetViewKey,
      select,
      focus,
      isolate,
      reset,
      setVisibleLayers,
      toggleLayer,
    }),
    [
      focus,
      focusRequestKey,
      isolate,
      isolatedId,
      reset,
      resetViewKey,
      select,
      selectedId,
      setVisibleLayers,
      toggleLayer,
      visibleLayers,
    ],
  );
}
