/**
 * Organizations list page - displays hierarchical tree view.
 */

import { getOrganizations } from '@/lib/api/objects';
import { OrganizationsListPage } from './OrganizationsListPage';
import type { Organization, HierarchyTreeNode } from '@/lib/types/objects';

// Build tree structure from flat organization list
function buildTree(organizations: Organization[]): HierarchyTreeNode[] {
    const nodeMap = new Map<string, HierarchyTreeNode>();
    const roots: HierarchyTreeNode[] = [];

    // Create all nodes first
    organizations.forEach((org) => {
        nodeMap.set(org.oid, {
            oid: org.oid,
            name: org.name,
            children: [],
        });
    });

    // Build parent-child relationships
    organizations.forEach((org) => {
        const node = nodeMap.get(org.oid)!;
        if (org.parent_oid && nodeMap.has(org.parent_oid)) {
            nodeMap.get(org.parent_oid)!.children.push(node);
        } else {
            roots.push(node);
        }
    });

    // Sort children alphabetically
    const sortNodes = (nodes: HierarchyTreeNode[]) => {
        nodes.sort((a, b) => a.name.localeCompare(b.name));
        nodes.forEach((node) => sortNodes(node.children));
    };
    sortNodes(roots);

    return roots;
}

export default async function OrganizationsPage() {
    const organizations = await getOrganizations();
    const treeNodes = buildTree(organizations);

    return <OrganizationsListPage treeNodes={treeNodes} />;
}
