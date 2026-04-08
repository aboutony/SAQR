const HIERARCHY_STATUSES = new Set(['draft', 'active', 'retired']);
const NODE_STATUSES = new Set(['active', 'inactive']);
const ENTITY_LEVELS = ['group', 'entity', 'businessUnit', 'site', 'silo'];
const SCOPE_FIELDS_BY_LEVEL = {
    group: 'groupId',
    entity: 'entityId',
    businessUnit: 'businessUnitId',
    site: 'siteId',
    silo: 'siloId',
};
const LEVEL_BY_SCOPE_FIELD = Object.fromEntries(
    Object.entries(SCOPE_FIELDS_BY_LEVEL).map(([level, scopeField]) => [scopeField, level])
);
const ALLOWED_PARENT_LEVELS = {
    group: [],
    entity: ['group'],
    businessUnit: ['entity'],
    site: ['entity', 'businessUnit'],
    silo: ['site'],
};

function clone(value) {
    return structuredClone(value);
}

function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function slugPatternMatch(value) {
    return typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

function emptyScope() {
    return {
        groupId: null,
        entityId: null,
        businessUnitId: null,
        siteId: null,
        siloId: null,
    };
}

function normalizeNode(node) {
    return {
        nodeId: String(node.nodeId),
        level: node.level,
        scopeField: SCOPE_FIELDS_BY_LEVEL[node.level],
        name: String(node.name),
        code: typeof node.code === 'string' ? node.code : null,
        description: typeof node.description === 'string' ? node.description : null,
        status: node.status || 'active',
        parentNodeId: typeof node.parentNodeId === 'string' && node.parentNodeId.trim() !== '' ? node.parentNodeId : null,
        metadata: isObject(node.metadata) ? clone(node.metadata) : {},
    };
}

function validateEntityHierarchyDocument(document, sourceName = '<memory>') {
    const errors = [];
    const pushError = (message) => errors.push(`${sourceName}: ${message}`);

    if (!isObject(document)) {
        pushError('entity hierarchy document must be an object');
        return errors;
    }

    const requiredTopLevel = ['schemaVersion', 'hierarchyKey', 'version', 'name', 'status', 'nodes'];
    requiredTopLevel.forEach((field) => {
        if (!(field in document)) {
            pushError(`missing required top-level field "${field}"`);
        }
    });

    if (document.schemaVersion !== 1) {
        pushError('schemaVersion must equal 1');
    }
    if (!slugPatternMatch(document.hierarchyKey)) {
        pushError('hierarchyKey must be a non-empty slug using lowercase letters, digits, and hyphens');
    }
    if (!Number.isInteger(document.version) || document.version <= 0) {
        pushError('version must be a positive integer');
    }
    if (typeof document.name !== 'string' || document.name.trim() === '') {
        pushError('name must be a non-empty string');
    }
    if (!HIERARCHY_STATUSES.has(document.status)) {
        pushError('status must be one of draft, active, or retired');
    }
    if (!Array.isArray(document.nodes) || document.nodes.length === 0) {
        pushError('nodes must be a non-empty array');
        return errors;
    }

    const nodeIds = new Set();
    const nodeLevelById = new Map();
    let groupCount = 0;

    document.nodes.forEach((node, index) => {
        if (!isObject(node)) {
            pushError(`node at index ${index} must be an object`);
            return;
        }

        if (typeof node.nodeId !== 'string' || node.nodeId.trim() === '') {
            pushError(`node at index ${index} must include a non-empty nodeId`);
        } else if (nodeIds.has(node.nodeId)) {
            pushError(`duplicate nodeId "${node.nodeId}"`);
        } else {
            nodeIds.add(node.nodeId);
            nodeLevelById.set(node.nodeId, node.level);
        }

        if (!ENTITY_LEVELS.includes(node.level)) {
            pushError(`node "${node.nodeId || index}" uses unsupported level "${node.level}"`);
        }

        if (typeof node.name !== 'string' || node.name.trim() === '') {
            pushError(`node "${node.nodeId || index}" must include a non-empty name`);
        }

        if ('status' in node && !NODE_STATUSES.has(node.status)) {
            pushError(`node "${node.nodeId || index}" uses unsupported status "${node.status}"`);
        }

        if ('scopeField' in node && node.scopeField !== SCOPE_FIELDS_BY_LEVEL[node.level]) {
            pushError(`node "${node.nodeId || index}" scopeField must equal "${SCOPE_FIELDS_BY_LEVEL[node.level]}" for level "${node.level}"`);
        }

        if (node.level === 'group') {
            groupCount += 1;
            if ('parentNodeId' in node && node.parentNodeId) {
                pushError(`group node "${node.nodeId || index}" may not declare parentNodeId`);
            }
        } else if (typeof node.parentNodeId !== 'string' || node.parentNodeId.trim() === '') {
            pushError(`node "${node.nodeId || index}" must declare parentNodeId`);
        }

        if ('metadata' in node && !isObject(node.metadata)) {
            pushError(`node "${node.nodeId || index}" metadata must be an object when present`);
        }
    });

    if (groupCount === 0) {
        pushError('at least one group node is required');
    }

    document.nodes.forEach((node) => {
        if (!ENTITY_LEVELS.includes(node.level) || node.level === 'group') {
            return;
        }

        if (!nodeLevelById.has(node.parentNodeId)) {
            pushError(`node "${node.nodeId}" references unknown parentNodeId "${node.parentNodeId}"`);
            return;
        }

        const parentLevel = nodeLevelById.get(node.parentNodeId);
        if (!ALLOWED_PARENT_LEVELS[node.level].includes(parentLevel)) {
            pushError(`node "${node.nodeId}" at level "${node.level}" may not have parent level "${parentLevel}"`);
        }
    });

    const nodesById = new Map(document.nodes
        .filter(node => isObject(node) && typeof node.nodeId === 'string' && node.nodeId.trim() !== '')
        .map(node => [node.nodeId, node]));

    const visited = new Set();
    const visiting = new Set();

    function detectCycle(nodeId) {
        if (!nodesById.has(nodeId) || visited.has(nodeId)) {
            return;
        }
        if (visiting.has(nodeId)) {
            pushError(`cycle detected at node "${nodeId}"`);
            return;
        }

        visiting.add(nodeId);
        const node = nodesById.get(nodeId);
        if (node && typeof node.parentNodeId === 'string' && node.parentNodeId.trim() !== '') {
            detectCycle(node.parentNodeId);
        }
        visiting.delete(nodeId);
        visited.add(nodeId);
    }

    nodesById.forEach((_, nodeId) => detectCycle(nodeId));
    return errors;
}

function buildEntityHierarchyCatalog(document, sourceName = '<memory>') {
    const errors = validateEntityHierarchyDocument(document, sourceName);
    if (errors.length > 0) {
        throw new Error(`invalid entity hierarchy: ${errors.join('; ')}`);
    }

    const normalizedNodes = document.nodes.map(normalizeNode);
    const nodesById = new Map(normalizedNodes.map(node => [node.nodeId, node]));
    const childrenById = new Map(normalizedNodes.map(node => [node.nodeId, []]));
    normalizedNodes.forEach((node) => {
        if (node.parentNodeId) {
            childrenById.get(node.parentNodeId).push(node.nodeId);
        }
    });

    const lineageCache = new Map();

    function computeLineage(nodeId) {
        if (lineageCache.has(nodeId)) {
            return clone(lineageCache.get(nodeId));
        }

        const node = nodesById.get(nodeId);
        const lineage = node.parentNodeId ? computeLineage(node.parentNodeId) : emptyScope();
        lineage[SCOPE_FIELDS_BY_LEVEL[node.level]] = node.nodeId;
        lineageCache.set(nodeId, clone(lineage));
        return lineage;
    }

    const catalogNodes = normalizedNodes.map((node) => {
        const lineage = computeLineage(node.nodeId);
        const ancestorNodeIds = ENTITY_LEVELS
            .map(level => lineage[SCOPE_FIELDS_BY_LEVEL[level]])
            .filter(Boolean)
            .filter(nodeId => nodeId !== node.nodeId);

        return {
            ...node,
            lineage,
            ancestorNodeIds,
            childNodeIds: clone(childrenById.get(node.nodeId) || []),
        };
    });

    return {
        schemaVersion: document.schemaVersion,
        hierarchyKey: document.hierarchyKey,
        version: document.version,
        name: document.name,
        description: typeof document.description === 'string' ? document.description : '',
        status: document.status,
        metadata: isObject(document.metadata) ? clone(document.metadata) : {},
        nodes: catalogNodes.map(clone),
    };
}

function indexCatalogNodes(catalog) {
    if (!catalog || !Array.isArray(catalog.nodes)) {
        throw new Error('entity hierarchy catalog must include nodes');
    }
    return new Map(catalog.nodes.map(node => [node.nodeId, node]));
}

function getEntityNode(catalog, nodeId) {
    const node = indexCatalogNodes(catalog).get(nodeId);
    return node ? clone(node) : null;
}

function listAncestorNodes(catalog, nodeId) {
    const nodesById = indexCatalogNodes(catalog);
    const node = nodesById.get(nodeId);
    if (!node) {
        throw new Error(`entity node "${nodeId}" was not found`);
    }

    return (node.ancestorNodeIds || []).map(ancestorNodeId => clone(nodesById.get(ancestorNodeId)));
}

function listDescendantNodes(catalog, nodeId, { levels = null } = {}) {
    const nodesById = indexCatalogNodes(catalog);
    if (!nodesById.has(nodeId)) {
        throw new Error(`entity node "${nodeId}" was not found`);
    }

    const levelFilter = Array.isArray(levels) && levels.length > 0 ? new Set(levels) : null;
    const output = [];
    const queue = [...(nodesById.get(nodeId).childNodeIds || [])];

    while (queue.length > 0) {
        const currentNodeId = queue.shift();
        const currentNode = nodesById.get(currentNodeId);
        if (!currentNode) continue;

        if (!levelFilter || levelFilter.has(currentNode.level)) {
            output.push(clone(currentNode));
        }

        queue.push(...(currentNode.childNodeIds || []));
    }

    return output;
}

function resolveEntityScope(catalog, partialScope = {}) {
    const nodesById = indexCatalogNodes(catalog);
    const providedFields = Object.entries(emptyScope())
        .map(([field]) => field)
        .filter(field => typeof partialScope[field] === 'string' && partialScope[field].trim() !== '');

    if (providedFields.length === 0) {
        return emptyScope();
    }

    const deepestField = [...Object.keys(emptyScope())]
        .reverse()
        .find(field => providedFields.includes(field));
    const targetNodeId = partialScope[deepestField];
    const expectedLevel = LEVEL_BY_SCOPE_FIELD[deepestField];
    const node = nodesById.get(targetNodeId);

    if (!node) {
        throw new Error(`entity scope references unknown ${deepestField} "${targetNodeId}"`);
    }
    if (node.level !== expectedLevel) {
        throw new Error(`entity scope field "${deepestField}" must resolve to level "${expectedLevel}"`);
    }

    const resolved = {
        ...emptyScope(),
        ...(node.lineage || emptyScope()),
    };

    providedFields.forEach((field) => {
        if (resolved[field] !== partialScope[field]) {
            throw new Error(`entity scope conflict for "${field}"`);
        }
    });

    return resolved;
}

module.exports = {
    ALLOWED_PARENT_LEVELS,
    ENTITY_LEVELS,
    HIERARCHY_STATUSES,
    LEVEL_BY_SCOPE_FIELD,
    NODE_STATUSES,
    SCOPE_FIELDS_BY_LEVEL,
    buildEntityHierarchyCatalog,
    clone,
    emptyScope,
    getEntityNode,
    listAncestorNodes,
    listDescendantNodes,
    resolveEntityScope,
    validateEntityHierarchyDocument,
};
