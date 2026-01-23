/**
 * Service Catalogs list page - displays hierarchical tree view.
 */

import { getServiceCatalogs } from '@/lib/api/objects';
import { ServiceCatalogsListPage } from './ServiceCatalogsListPage';
import type { ServiceCatalog, HierarchyTreeNode } from '@/lib/types/objects';

// Build tree structure from flat service catalog list
function buildTree(items: ServiceCatalog[]): HierarchyTreeNode[] {
    const nodeMap = new Map<string, HierarchyTreeNode>();
    const roots: HierarchyTreeNode[] = [];

    items.forEach((item) => {
        nodeMap.set(item.oid, {
            oid: item.oid,
            name: item.name,
            children: [],
            is_active: item.is_active,
        });
    });

    items.forEach((item) => {
        const node = nodeMap.get(item.oid)!;
        if (item.parent_oid && nodeMap.has(item.parent_oid)) {
            nodeMap.get(item.parent_oid)!.children.push(node);
        } else {
            roots.push(node);
        }
    });

    const sortNodes = (nodes: HierarchyTreeNode[]) => {
        nodes.sort((a, b) => a.name.localeCompare(b.name));
        nodes.forEach((node) => sortNodes(node.children));
    };
    sortNodes(roots);

    return roots;
}

export default async function ServiceCatalogsPage() {
    const items = await getServiceCatalogs();
    const treeNodes = buildTree(items);

    return <ServiceCatalogsListPage treeNodes={treeNodes} />;
}
