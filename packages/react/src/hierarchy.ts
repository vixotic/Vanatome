import type {
  VanatomeHierarchyNode,
  VanatomeStructure,
} from "./types.js";

export function createVanatomeHierarchy(
  structures: readonly VanatomeStructure[],
): VanatomeHierarchyNode[] {
  const nodes = new Map<string, VanatomeHierarchyNode>(
    structures.map((structure) => [
      structure.id,
      { ...structure, children: [] },
    ]),
  );
  const roots: VanatomeHierarchyNode[] = [];

  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  return roots;
}

export function getVanatomeDescendantIds(
  hierarchy: readonly VanatomeHierarchyNode[],
  id: string,
): string[] {
  const result: string[] = [];

  const visit = (nodes: readonly VanatomeHierarchyNode[]): boolean => {
    for (const node of nodes) {
      if (node.id === id) {
        const collect = (current: VanatomeHierarchyNode) => {
          result.push(current.id);
          current.children.forEach(collect);
        };
        collect(node);
        return true;
      }
      if (visit(node.children)) return true;
    }
    return false;
  };

  visit(hierarchy);
  return result;
}
