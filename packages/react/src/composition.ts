import type {
  VanatomeAtlas,
  VanatomeAtlasComposition,
  VanatomeStructure,
} from "./types.js";

function sameStructure(
  left: VanatomeStructure,
  right: VanatomeStructure,
): boolean {
  return left.id === right.id &&
    left.system === right.system &&
    left.layer === right.layer &&
    left.parentId === right.parentId &&
    left.kind === right.kind;
}

export function composeVanatomeAtlases(
  sources: readonly VanatomeAtlas[],
): VanatomeAtlasComposition {
  const atlases = [...new Map(
    sources.map((atlas) => [atlas.modelUrl, atlas]),
  ).values()];
  if (atlases.length === 0) {
    throw new Error("VanatomeViewer requires at least one atlas source.");
  }

  const version = atlases[0].version;
  for (const atlas of atlases.slice(1)) {
    if (atlas.version !== version) {
      throw new Error(
        `Cannot compose atlas versions ${version} and ${atlas.version}.`,
      );
    }
  }
  const buildIds = [...new Set(
    atlases.flatMap((atlas) => atlas.buildId ? [atlas.buildId] : []),
  )];
  if (buildIds.length > 1) {
    throw new Error(
      `Cannot compose atlas builds ${buildIds.join(" and ")}.`,
    );
  }

  const structures = new Map<string, VanatomeStructure>();
  for (const atlas of atlases) {
    for (const structure of atlas.structures) {
      const existing = structures.get(structure.id);
      if (existing && !sameStructure(existing, structure)) {
        throw new Error(
          `Structure "${structure.id}" conflicts across composed atlases.`,
        );
      }
      if (existing) {
        throw new Error(
          `Structure "${structure.id}" is duplicated across composed atlas models.`,
        );
      }
      structures.set(structure.id, structure);
    }
  }

  return {
    atlases,
    modelUrls: atlases.map((atlas) => atlas.modelUrl),
    structures: [...structures.values()],
  };
}

export function resolveVanatomeAtlasSources({
  atlas,
  atlases,
}: Pick<VanatomeViewerPropsSource, "atlas" | "atlases">): VanatomeAtlasComposition {
  if (atlas && atlases) {
    throw new Error("Supply either `atlas` or `atlases`, not both.");
  }
  return composeVanatomeAtlases(atlas ? [atlas] : (atlases ?? []));
}

type VanatomeViewerPropsSource = {
  atlas?: VanatomeAtlas;
  atlases?: readonly VanatomeAtlas[];
};
