import { useCallback, useMemo, useState } from "react";
import type {
  VanatomeControllerState,
  VanatomeIsolationMode,
  VanatomeIsolationState,
} from "./types.js";

export function useVanatomeController(
  initialLayers: readonly string[] = [],
): VanatomeControllerState {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isolation, setIsolation] =
    useState<VanatomeIsolationState | null>(null);
  const isolatedId = isolation?.id ?? null;
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
  const isolate = useCallback((
    id?: string | null,
    mode: VanatomeIsolationMode = "selected",
  ) => {
    const targetId = id === undefined ? selectedId : id;
    setIsolation(targetId ? { id: targetId, mode } : null);
  }, [selectedId]);
  const clear = useCallback(() => {
    setSelectedId(null);
    setIsolation(null);
  }, []);
  const reset = useCallback(() => {
    setSelectedId(null);
    setIsolation(null);
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
      isolation,
      visibleLayers,
      focusRequestKey,
      resetViewKey,
      select,
      focus,
      isolate,
      clear,
      reset,
      setVisibleLayers,
      toggleLayer,
    }),
    [
      focus,
      focusRequestKey,
      clear,
      isolate,
      isolatedId,
      isolation,
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
