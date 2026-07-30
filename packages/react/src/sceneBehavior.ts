import type {
  VanatomeIsolationState,
  VanatomeStructure,
} from "./types.js";

export type VanatomeVisibility = {
  visible: ReadonlySet<string>;
  hidden: ReadonlySet<string>;
  context: ReadonlySet<string>;
};

export function createStructureIndex(
  structures: readonly VanatomeStructure[],
): ReadonlyMap<string, VanatomeStructure> {
  return new Map(structures.map((structure) => [structure.id, structure]));
}

export function getRelatedStructureIds(
  structures: readonly VanatomeStructure[],
  rootId: string,
): Set<string> {
  const childrenByParent = new Map<string, string[]>();
  for (const structure of structures) {
    if (!structure.parentId) continue;
    const children = childrenByParent.get(structure.parentId) ?? [];
    children.push(structure.id);
    childrenByParent.set(structure.parentId, children);
  }

  const related = new Set<string>();
  const pending = [rootId];
  while (pending.length) {
    const id = pending.pop();
    if (!id || related.has(id)) continue;
    related.add(id);
    pending.push(...(childrenByParent.get(id) ?? []));
  }
  return related;
}

export function resolveStructureVisibility(
  structures: readonly VanatomeStructure[],
  options: {
    visibleLayers?: readonly string[];
    isolatedId?: string | null;
    isolation?: VanatomeIsolationState | null;
    hiddenIds?: readonly string[];
    alwaysVisibleIds?: readonly string[];
  },
): VanatomeVisibility {
  const layerSet = options.visibleLayers?.length
    ? new Set(options.visibleLayers)
    : null;
  const isolation = options.isolation ??
    (options.isolatedId
      ? { id: options.isolatedId, mode: "selected" as const }
      : null);
  const structuresById = createStructureIndex(structures);
  const isolationRootId =
    isolation?.mode === "selected"
      ? isolation.id
      : isolation
        ? structuresById.get(isolation.id)?.parentId ?? isolation.id
        : null;
  const isolated = isolationRootId
    ? getRelatedStructureIds(structures, isolationRootId)
    : null;
  const selected = isolation
    ? getRelatedStructureIds(structures, isolation.id)
    : null;
  const alwaysVisible = new Set(options.alwaysVisibleIds ?? []);
  const hidden = new Set<string>();
  const context = new Set<string>();

  for (const id of options.hiddenIds ?? []) {
    for (const relatedId of getRelatedStructureIds(structures, id)) {
      hidden.add(relatedId);
    }
  }

  const visible = new Set<string>();
  for (const structure of structures) {
    const withinIsolation = !isolated || isolated.has(structure.id);
    const passesLayer =
      alwaysVisible.has(structure.id) ||
      !layerSet ||
      layerSet.has(structure.layer);
    if (
      passesLayer &&
      withinIsolation &&
      !hidden.has(structure.id)
    ) {
      visible.add(structure.id);
      if (
        isolation?.mode === "parent-context" &&
        !selected?.has(structure.id)
      ) {
        context.add(structure.id);
      }
    }
  }

  return { visible, hidden, context };
}

export function isStructureSelectable(
  structure: VanatomeStructure | undefined,
  visibleIds: ReadonlySet<string>,
): boolean {
  return Boolean(
    structure &&
    structure.selectable !== false &&
    visibleIds.has(structure.id),
  );
}

export function calculateFocusDistance(options: {
  radius: number;
  verticalFovDegrees: number;
  aspect: number;
  padding: number;
  minimumDistance: number;
  minDistance: number;
  maxDistance: number;
}): number {
  const verticalFov = (options.verticalFovDegrees * Math.PI) / 180;
  const horizontalFov =
    2 * Math.atan(Math.tan(verticalFov / 2) * Math.max(0.01, options.aspect));
  const limitingFov = Math.min(verticalFov, horizontalFov);
  const fittedDistance =
    (Math.max(0, options.radius) /
      Math.max(0.01, Math.sin(limitingFov / 2))) *
    Math.max(1, options.padding);
  return Math.min(
    options.maxDistance,
    Math.max(options.minDistance, options.minimumDistance, fittedDistance),
  );
}
