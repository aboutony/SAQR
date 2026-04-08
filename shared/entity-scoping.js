const {
    clone,
    emptyScope,
    getEntityNode,
    listAncestorNodes,
    listDescendantNodes,
    resolveEntityScope,
} = require('./entity-hierarchy');

const SCOPING_MODEL_STATUSES = new Set(['draft', 'active', 'retired']);
const PRINCIPAL_TYPES = new Set(['user', 'service']);
const PRINCIPAL_STATUSES = new Set(['active', 'inactive']);
const RESOURCE_TYPES = new Set(['user', 'workflow', 'alert', 'evidence', 'report']);
const RESOURCE_ACTIONS = new Set(['read', 'launch', 'approve', 'remediate', 'administer', 'report']);
const SCOPE_ACCESS_MODES = new Set(['exact', 'self_and_descendants', 'self_and_ancestors']);
const RESOURCE_SCOPE_RULES = Object.freeze({
    user: {
        scopeSource: 'principal.homeScope',
        notes: 'User and service principals are assigned one descriptive homeScope plus one or more explicit scope grants.',
    },
    workflow: {
        scopeSource: 'workflow.entityScopeTemplate or workflowInstance.entityScope',
        notes: 'Launch, read, approve, remediate, and administer actions resolve against the workflow scope lineage.',
    },
    alert: {
        scopeSource: 'normalized event entityScope',
        notes: 'Alerts inherit exact scope from the normalized event or producer lineage.',
    },
    evidence: {
        scopeSource: 'evidence lineage or linked alert scope',
        notes: 'Evidence inherits exact scope from the evidence-producing source lineage.',
    },
    report: {
        scopeSource: 'requested reporting target scope',
        notes: 'Reports may only target scopes that fall within an explicit reporting grant. Cross-entity portfolio roll-up remains later work.',
    },
});

function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function slugPatternMatch(value) {
    return typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

function scopeFieldsInOrder(scope) {
    return Object.keys(emptyScope());
}

function getScopeAnchorField(scope) {
    return scopeFieldsInOrder(scope)
        .reverse()
        .find(field => typeof scope[field] === 'string' && scope[field].trim() !== '');
}

function getScopeAnchorNodeId(scope) {
    const anchorField = getScopeAnchorField(scope);
    return anchorField ? scope[anchorField] : null;
}

function classifyScopeRelation(hierarchyCatalog, leftScope, rightScope) {
    const resolvedLeft = resolveEntityScope(hierarchyCatalog, leftScope || {});
    const resolvedRight = resolveEntityScope(hierarchyCatalog, rightScope || {});
    const leftAnchor = getScopeAnchorNodeId(resolvedLeft);
    const rightAnchor = getScopeAnchorNodeId(resolvedRight);

    if (!leftAnchor || !rightAnchor) {
        return 'none';
    }
    if (leftAnchor === rightAnchor) {
        return 'exact';
    }

    const rightAncestors = new Set(listAncestorNodes(hierarchyCatalog, rightAnchor).map(node => node.nodeId));
    if (rightAncestors.has(leftAnchor)) {
        return 'contains';
    }

    const leftAncestors = new Set(listAncestorNodes(hierarchyCatalog, leftAnchor).map(node => node.nodeId));
    if (leftAncestors.has(rightAnchor)) {
        return 'within';
    }

    return 'disjoint';
}

function grantMatchesScope(hierarchyCatalog, grant, resolvedResourceScope) {
    const relation = classifyScopeRelation(hierarchyCatalog, grant.scope, resolvedResourceScope);

    if (grant.scopeAccess === 'exact') {
        return { allowed: relation === 'exact', relation };
    }

    if (grant.scopeAccess === 'self_and_descendants') {
        return { allowed: relation === 'exact' || relation === 'contains', relation };
    }

    if (grant.scopeAccess === 'self_and_ancestors') {
        return { allowed: relation === 'exact' || relation === 'within', relation };
    }

    return { allowed: false, relation };
}

function validateGrant(grant, hierarchyCatalog, principalId, grantKeys, pushError) {
    if (!isObject(grant)) {
        pushError(`principal "${principalId}" includes a grant that is not an object`);
        return;
    }

    if (!slugPatternMatch(grant.grantKey)) {
        pushError(`principal "${principalId}" grantKey must be a non-empty slug`);
    } else if (grantKeys.has(grant.grantKey)) {
        pushError(`principal "${principalId}" contains duplicate grantKey "${grant.grantKey}"`);
    } else {
        grantKeys.add(grant.grantKey);
    }

    if (!Array.isArray(grant.resourceTypes) || grant.resourceTypes.length === 0) {
        pushError(`principal "${principalId}" grant "${grant.grantKey || '<unknown>'}" must declare at least one resourceType`);
    } else {
        grant.resourceTypes.forEach((resourceType) => {
            if (!RESOURCE_TYPES.has(resourceType)) {
                pushError(`principal "${principalId}" grant "${grant.grantKey || '<unknown>'}" uses unsupported resourceType "${resourceType}"`);
            }
        });
    }

    if (!Array.isArray(grant.actions) || grant.actions.length === 0) {
        pushError(`principal "${principalId}" grant "${grant.grantKey || '<unknown>'}" must declare at least one action`);
    } else {
        grant.actions.forEach((action) => {
            if (!RESOURCE_ACTIONS.has(action)) {
                pushError(`principal "${principalId}" grant "${grant.grantKey || '<unknown>'}" uses unsupported action "${action}"`);
            }
        });
    }

    if (!SCOPE_ACCESS_MODES.has(grant.scopeAccess)) {
        pushError(`principal "${principalId}" grant "${grant.grantKey || '<unknown>'}" uses unsupported scopeAccess "${grant.scopeAccess}"`);
    }

    if (!isObject(grant.scope)) {
        pushError(`principal "${principalId}" grant "${grant.grantKey || '<unknown>'}" must include an object scope`);
    } else {
        try {
            resolveEntityScope(hierarchyCatalog, grant.scope);
        } catch (error) {
            pushError(`principal "${principalId}" grant "${grant.grantKey || '<unknown>'}" uses invalid scope: ${error.message}`);
        }
    }
}

function validateEntityScopingDocument(document, hierarchyCatalog, sourceName = '<memory>') {
    const errors = [];
    const pushError = (message) => errors.push(`${sourceName}: ${message}`);

    if (!isObject(document)) {
        pushError('entity scoping document must be an object');
        return errors;
    }

    const requiredTopLevel = ['schemaVersion', 'modelKey', 'version', 'name', 'status', 'hierarchyRef', 'principals'];
    requiredTopLevel.forEach((field) => {
        if (!(field in document)) {
            pushError(`missing required top-level field "${field}"`);
        }
    });

    if (document.schemaVersion !== 1) {
        pushError('schemaVersion must equal 1');
    }
    if (!slugPatternMatch(document.modelKey)) {
        pushError('modelKey must be a non-empty slug using lowercase letters, digits, and hyphens');
    }
    if (!Number.isInteger(document.version) || document.version <= 0) {
        pushError('version must be a positive integer');
    }
    if (typeof document.name !== 'string' || document.name.trim() === '') {
        pushError('name must be a non-empty string');
    }
    if (!SCOPING_MODEL_STATUSES.has(document.status)) {
        pushError('status must be one of draft, active, or retired');
    }
    if (!isObject(document.hierarchyRef)) {
        pushError('hierarchyRef must be an object');
    } else {
        if (typeof document.hierarchyRef.hierarchyKey !== 'string' || document.hierarchyRef.hierarchyKey.trim() === '') {
            pushError('hierarchyRef.hierarchyKey must be a non-empty string');
        }
        if (!Number.isInteger(document.hierarchyRef.version) || document.hierarchyRef.version <= 0) {
            pushError('hierarchyRef.version must be a positive integer');
        }
    }
    if (!Array.isArray(document.principals) || document.principals.length === 0) {
        pushError('principals must be a non-empty array');
        return errors;
    }

    const principalIds = new Set();
    document.principals.forEach((principal, index) => {
        if (!isObject(principal)) {
            pushError(`principal at index ${index} must be an object`);
            return;
        }

        if (!slugPatternMatch(principal.principalId)) {
            pushError(`principal at index ${index} must include a non-empty slug principalId`);
        } else if (principalIds.has(principal.principalId)) {
            pushError(`duplicate principalId "${principal.principalId}"`);
        } else {
            principalIds.add(principal.principalId);
        }

        if (!PRINCIPAL_TYPES.has(principal.principalType)) {
            pushError(`principal "${principal.principalId || index}" uses unsupported principalType "${principal.principalType}"`);
        }
        if ('status' in principal && !PRINCIPAL_STATUSES.has(principal.status)) {
            pushError(`principal "${principal.principalId || index}" uses unsupported status "${principal.status}"`);
        }
        if (typeof principal.displayName !== 'string' || principal.displayName.trim() === '') {
            pushError(`principal "${principal.principalId || index}" must include a non-empty displayName`);
        }

        if (!isObject(principal.homeScope)) {
            pushError(`principal "${principal.principalId || index}" must include an object homeScope`);
        } else {
            try {
                resolveEntityScope(hierarchyCatalog, principal.homeScope);
            } catch (error) {
                pushError(`principal "${principal.principalId || index}" uses invalid homeScope: ${error.message}`);
            }
        }

        if ('roleKeys' in principal) {
            if (!Array.isArray(principal.roleKeys) || principal.roleKeys.some(role => typeof role !== 'string' || role.trim() === '')) {
                pushError(`principal "${principal.principalId || index}" roleKeys must be an array of non-empty strings`);
            }
        }

        if (!Array.isArray(principal.grants) || principal.grants.length === 0) {
            pushError(`principal "${principal.principalId || index}" must declare at least one grant`);
            return;
        }

        const grantKeys = new Set();
        principal.grants.forEach((grant) => validateGrant(grant, hierarchyCatalog, principal.principalId || String(index), grantKeys, pushError));
    });

    return errors;
}

function normalizeGrant(grant, hierarchyCatalog) {
    const resolvedScope = resolveEntityScope(hierarchyCatalog, grant.scope);
    return {
        grantKey: grant.grantKey,
        resourceTypes: [...grant.resourceTypes],
        actions: [...grant.actions],
        scopeAccess: grant.scopeAccess,
        scope: resolvedScope,
        anchorNodeId: getScopeAnchorNodeId(resolvedScope),
        notes: typeof grant.notes === 'string' ? grant.notes : '',
    };
}

function buildEntityScopingCatalog(document, hierarchyCatalog, sourceName = '<memory>') {
    const errors = validateEntityScopingDocument(document, hierarchyCatalog, sourceName);
    if (errors.length > 0) {
        throw new Error(`invalid entity scoping model: ${errors.join('; ')}`);
    }

    return {
        schemaVersion: document.schemaVersion,
        modelKey: document.modelKey,
        version: document.version,
        name: document.name,
        description: typeof document.description === 'string' ? document.description : '',
        status: document.status,
        hierarchyRef: clone(document.hierarchyRef),
        resourceScopeRules: clone(RESOURCE_SCOPE_RULES),
        principals: document.principals.map((principal) => ({
            principalId: principal.principalId,
            principalType: principal.principalType,
            displayName: principal.displayName,
            status: principal.status || 'active',
            roleKeys: Array.isArray(principal.roleKeys) ? [...principal.roleKeys] : [],
            homeScope: resolveEntityScope(hierarchyCatalog, principal.homeScope),
            grants: principal.grants.map(grant => normalizeGrant(grant, hierarchyCatalog)),
        })),
    };
}

function getPrincipal(scopingCatalog, principalId) {
    const principal = (scopingCatalog.principals || []).find(item => item.principalId === principalId);
    return principal ? clone(principal) : null;
}

function listPrincipalAccessibleNodes(scopingCatalog, hierarchyCatalog, principalId, resourceType, action, { levels = null } = {}) {
    const principal = getPrincipal(scopingCatalog, principalId);
    if (!principal) {
        throw new Error(`principal "${principalId}" was not found`);
    }

    const levelFilter = Array.isArray(levels) && levels.length > 0 ? new Set(levels) : null;
    const nodesById = new Map();

    for (const grant of principal.grants) {
        if (!grant.resourceTypes.includes(resourceType) || !grant.actions.includes(action)) {
            continue;
        }

        const anchorNode = getEntityNode(hierarchyCatalog, grant.anchorNodeId);
        if (!anchorNode) {
            continue;
        }

        const addNode = (node) => {
            if (!node) {
                return;
            }
            if (levelFilter && !levelFilter.has(node.level)) {
                return;
            }
            nodesById.set(node.nodeId, node);
        };

        addNode(anchorNode);

        if (grant.scopeAccess === 'self_and_descendants') {
            listDescendantNodes(hierarchyCatalog, anchorNode.nodeId).forEach(addNode);
        }

        if (grant.scopeAccess === 'self_and_ancestors') {
            listAncestorNodes(hierarchyCatalog, anchorNode.nodeId).forEach(addNode);
        }
    }

    return Array.from(nodesById.values())
        .sort((left, right) => left.nodeId.localeCompare(right.nodeId))
        .map(clone);
}

function canPrincipalAccessResource(scopingCatalog, hierarchyCatalog, principalId, resourceType, action, resourceScope) {
    const principal = getPrincipal(scopingCatalog, principalId);
    if (!principal) {
        return { allowed: false, reason: `principal "${principalId}" was not found` };
    }

    if (!RESOURCE_TYPES.has(resourceType)) {
        return { allowed: false, reason: `resourceType "${resourceType}" is unsupported` };
    }

    if (!RESOURCE_ACTIONS.has(action)) {
        return { allowed: false, reason: `action "${action}" is unsupported` };
    }

    const resolvedResourceScope = resolveEntityScope(hierarchyCatalog, resourceScope || {});

    for (const grant of principal.grants) {
        if (!grant.resourceTypes.includes(resourceType) || !grant.actions.includes(action)) {
            continue;
        }

        const evaluation = grantMatchesScope(hierarchyCatalog, grant, resolvedResourceScope);
        if (evaluation.allowed) {
            return {
                allowed: true,
                principalId,
                resourceType,
                action,
                matchedGrantKey: grant.grantKey,
                scopeRelation: evaluation.relation,
                resourceScope: resolvedResourceScope,
            };
        }
    }

    return {
        allowed: false,
        principalId,
        resourceType,
        action,
        reason: 'no matching scope grant',
        resourceScope: resolvedResourceScope,
    };
}

module.exports = {
    PRINCIPAL_STATUSES,
    PRINCIPAL_TYPES,
    RESOURCE_ACTIONS,
    RESOURCE_SCOPE_RULES,
    RESOURCE_TYPES,
    SCOPE_ACCESS_MODES,
    SCOPING_MODEL_STATUSES,
    buildEntityScopingCatalog,
    canPrincipalAccessResource,
    classifyScopeRelation,
    getPrincipal,
    getScopeAnchorField,
    getScopeAnchorNodeId,
    listPrincipalAccessibleNodes,
    validateEntityScopingDocument,
};
