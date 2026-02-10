import type { HierarchyTreeNode } from '@/lib/types/objects';

interface HierarchyItem {
    oid: string;
    name: string;
    parent_oid: string | null;
    is_active: boolean;
}

export function buildHierarchyTree<T extends HierarchyItem>(items: T[]): HierarchyTreeNode[] {
    const nodeMap = new Map<string, HierarchyTreeNode>();
    const roots: HierarchyTreeNode[] = [];
    const attached = new Set<string>();

    items.forEach((item) => {
        nodeMap.set(item.oid, {
            oid: item.oid,
            name: item.name,
            children: [],
            is_active: item.is_active,
        });
    });

    items.forEach((item) => {
        if (attached.has(item.oid)) return;

        const node = nodeMap.get(item.oid);
        if (!node) return;

        if (item.parent_oid && nodeMap.has(item.parent_oid)) {
            nodeMap.get(item.parent_oid)!.children.push(node);
        } else {
            roots.push(node);
        }
        attached.add(item.oid);
    });

    const sortNodes = (nodes: HierarchyTreeNode[]) => {
        nodes.sort((a, b) => a.name.localeCompare(b.name));
        nodes.forEach((node) => sortNodes(node.children));
    };

    sortNodes(roots);
    return roots;
}
