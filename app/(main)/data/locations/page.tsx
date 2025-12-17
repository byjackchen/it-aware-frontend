/**
 * Locations list page - displays hierarchical tree view.
 */

import { getLocations } from '@/lib/api/objects';
import { LocationsListPage } from './LocationsListPage';
import type { Location, HierarchyTreeNode } from '@/lib/types/objects';

// Build tree structure from flat location list
function buildTree(locations: Location[]): HierarchyTreeNode[] {
    const nodeMap = new Map<string, HierarchyTreeNode>();
    const roots: HierarchyTreeNode[] = [];

    locations.forEach((loc) => {
        nodeMap.set(loc.oid, {
            oid: loc.oid,
            name: loc.name,
            children: [],
        });
    });

    locations.forEach((loc) => {
        const node = nodeMap.get(loc.oid)!;
        if (loc.parent_oid && nodeMap.has(loc.parent_oid)) {
            nodeMap.get(loc.parent_oid)!.children.push(node);
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

export default async function LocationsPage() {
    const locations = await getLocations();
    const treeNodes = buildTree(locations);

    return <LocationsListPage treeNodes={treeNodes} />;
}
