const { clone, resolveEntityScope } = require('./entity-hierarchy');
const { canPrincipalAccessResource, getPrincipal, RESOURCE_TYPES } = require('./entity-scoping');

const ISOLATION_MODEL_STATUSES = new Set(['draft', 'active', 'retired']);
const PARTITION_LEVELS = new Set(['group', 'entity']);
const STORAGE_PLANES = new Set(['control_plane', 'entity_data_plane', 'aggregation_plane']);
const CROSS_ENTITY_READ_MODES = new Set(['deny', 'brokered_read_only', 'aggregate_read_only']);
const CROSS_ENTITY_WRITE_MODES = new Set(['deny', 'single_partition_only']);

function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function slugPatternMatch(value) {
    return typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

function partitionFieldForLevel(level) {
    return level === 'group' ? 'groupId' : 'entityId';
}

function getResourceIsolationPolicy(isolationCatalog, resourceType) {
    if (!isolationCatalog || !Array.isArray(isolationCatalog.resourcePolicies)) {
        throw new Error('entity isolation catalog must include resourcePolicies');
    }

    const policy = isolationCatalog.resourcePolicies.find(item => item.resourceType === resourceType);
    if (!policy) {
        throw new Error(`resourceType "${resourceType}" is missing an isolation policy`);
    }

    return clone(policy);
}

function validateEntityIsolationDocument(document, sourceName = '<memory>') {
    const errors = [];
    const pushError = (message) => errors.push(`${sourceName}: ${message}`);

    if (!isObject(document)) {
        pushError('entity isolation document must be an object');
        return errors;
    }

    const requiredTopLevel = ['schemaVersion', 'modelKey', 'version', 'name', 'status', 'hierarchyRef', 'scopingRef', 'resourcePolicies'];
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
    if (!ISOLATION_MODEL_STATUSES.has(document.status)) {
        pushError('status must be one of draft, active, or retired');
    }

    ['hierarchyRef', 'scopingRef'].forEach((field) => {
        if (!isObject(document[field])) {
            pushError(`${field} must be an object`);
            return;
        }

        const keyField = field === 'hierarchyRef' ? 'hierarchyKey' : 'modelKey';
        if (typeof document[field][keyField] !== 'string' || document[field][keyField].trim() === '') {
            pushError(`${field}.${keyField} must be a non-empty string`);
        }
        if (!Number.isInteger(document[field].version) || document[field].version <= 0) {
            pushError(`${field}.version must be a positive integer`);
        }
    });

    if (!Array.isArray(document.resourcePolicies) || document.resourcePolicies.length === 0) {
        pushError('resourcePolicies must be a non-empty array');
        return errors;
    }

    const resourceTypesSeen = new Set();
    document.resourcePolicies.forEach((policy, index) => {
        if (!isObject(policy)) {
            pushError(`resource policy at index ${index} must be an object`);
            return;
        }

        if (!RESOURCE_TYPES.has(policy.resourceType)) {
            pushError(`resource policy at index ${index} uses unsupported resourceType "${policy.resourceType}"`);
        } else if (resourceTypesSeen.has(policy.resourceType)) {
            pushError(`duplicate isolation policy for resourceType "${policy.resourceType}"`);
        } else {
            resourceTypesSeen.add(policy.resourceType);
        }

        if (!PARTITION_LEVELS.has(policy.partitionLevel)) {
            pushError(`resource policy "${policy.resourceType || index}" uses unsupported partitionLevel "${policy.partitionLevel}"`);
        }
        if (!STORAGE_PLANES.has(policy.storagePlane)) {
            pushError(`resource policy "${policy.resourceType || index}" uses unsupported storagePlane "${policy.storagePlane}"`);
        }
        if (!CROSS_ENTITY_READ_MODES.has(policy.crossEntityReadMode)) {
            pushError(`resource policy "${policy.resourceType || index}" uses unsupported crossEntityReadMode "${policy.crossEntityReadMode}"`);
        }
        if (!CROSS_ENTITY_WRITE_MODES.has(policy.crossEntityWriteMode)) {
            pushError(`resource policy "${policy.resourceType || index}" uses unsupported crossEntityWriteMode "${policy.crossEntityWriteMode}"`);
        }
        if (typeof policy.requiresEntityId !== 'boolean') {
            pushError(`resource policy "${policy.resourceType || index}" requiresEntityId must be a boolean`);
        }
    });

    Array.from(RESOURCE_TYPES).forEach((resourceType) => {
        if (!resourceTypesSeen.has(resourceType)) {
            pushError(`resourcePolicies must include resourceType "${resourceType}"`);
        }
    });

    return errors;
}

function buildEntityIsolationCatalog(document, sourceName = '<memory>') {
    const errors = validateEntityIsolationDocument(document, sourceName);
    if (errors.length > 0) {
        throw new Error(`invalid entity isolation model: ${errors.join('; ')}`);
    }

    return {
        schemaVersion: document.schemaVersion,
        modelKey: document.modelKey,
        version: document.version,
        name: document.name,
        description: typeof document.description === 'string' ? document.description : '',
        status: document.status,
        hierarchyRef: clone(document.hierarchyRef),
        scopingRef: clone(document.scopingRef),
        resourcePolicies: document.resourcePolicies.map(policy => ({
            resourceType: policy.resourceType,
            partitionLevel: policy.partitionLevel,
            partitionField: partitionFieldForLevel(policy.partitionLevel),
            storagePlane: policy.storagePlane,
            requiresEntityId: policy.requiresEntityId,
            crossEntityReadMode: policy.crossEntityReadMode,
            crossEntityWriteMode: policy.crossEntityWriteMode,
            notes: typeof policy.notes === 'string' ? policy.notes : '',
        })),
    };
}

function resolveResourceIsolationEnvelope(isolationCatalog, hierarchyCatalog, resourceType, resourceScope = {}) {
    const policy = getResourceIsolationPolicy(isolationCatalog, resourceType);
    const resolvedScope = resolveEntityScope(hierarchyCatalog, resourceScope);

    if (policy.requiresEntityId && !resolvedScope.entityId) {
        throw new Error(`resourceType "${resourceType}" requires entityId in the resolved scope`);
    }

    const partitionId = resolvedScope[policy.partitionField];
    if (!partitionId) {
        throw new Error(`resourceType "${resourceType}" could not resolve partition field "${policy.partitionField}"`);
    }

    return {
        resourceType,
        partitionLevel: policy.partitionLevel,
        partitionField: policy.partitionField,
        partitionId,
        partitionKey: `${policy.partitionLevel}:${partitionId}`,
        storagePlane: policy.storagePlane,
        crossEntityReadMode: policy.crossEntityReadMode,
        crossEntityWriteMode: policy.crossEntityWriteMode,
        requiresEntityId: policy.requiresEntityId,
        resolvedScope,
    };
}

function isReadOnlyAction(action) {
    return action === 'read' || action === 'report';
}

function evaluateIsolationAccess(scopingCatalog, hierarchyCatalog, isolationCatalog, principalId, resourceType, action, resourceScope = {}) {
    const authz = canPrincipalAccessResource(scopingCatalog, hierarchyCatalog, principalId, resourceType, action, resourceScope);
    if (!authz.allowed) {
        return {
            allowed: false,
            stage: 'scoping',
            reason: authz.reason,
            principalId,
            resourceType,
            action,
        };
    }

    const principal = getPrincipal(scopingCatalog, principalId);
    const matchedGrant = principal.grants.find(grant => grant.grantKey === authz.matchedGrantKey);
    const envelope = resolveResourceIsolationEnvelope(isolationCatalog, hierarchyCatalog, resourceType, resourceScope);
    const grantPartitionId = matchedGrant.scope[envelope.partitionField] || null;
    const samePartition = grantPartitionId !== null && grantPartitionId === envelope.partitionId;
    const readOnlyAction = isReadOnlyAction(action);

    if (envelope.storagePlane === 'aggregation_plane') {
        if (!readOnlyAction) {
            return {
                allowed: false,
                stage: 'isolation',
                reason: 'aggregation plane is read-only',
                principalId,
                resourceType,
                action,
                matchedGrantKey: matchedGrant.grantKey,
                partitionKey: envelope.partitionKey,
            };
        }

        return {
            allowed: true,
            stage: 'isolation',
            boundaryMode: 'aggregate_read_only',
            principalId,
            resourceType,
            action,
            matchedGrantKey: matchedGrant.grantKey,
            partitionKey: envelope.partitionKey,
            storagePlane: envelope.storagePlane,
            resolvedScope: envelope.resolvedScope,
            samePartition,
        };
    }

    if (samePartition) {
        return {
            allowed: true,
            stage: 'isolation',
            boundaryMode: 'same_partition_direct',
            principalId,
            resourceType,
            action,
            matchedGrantKey: matchedGrant.grantKey,
            partitionKey: envelope.partitionKey,
            storagePlane: envelope.storagePlane,
            resolvedScope: envelope.resolvedScope,
            samePartition: true,
        };
    }

    if (readOnlyAction) {
        if (envelope.crossEntityReadMode === 'brokered_read_only' || envelope.crossEntityReadMode === 'aggregate_read_only') {
            return {
                allowed: true,
                stage: 'isolation',
                boundaryMode: envelope.crossEntityReadMode,
                principalId,
                resourceType,
                action,
                matchedGrantKey: matchedGrant.grantKey,
                partitionKey: envelope.partitionKey,
                storagePlane: envelope.storagePlane,
                resolvedScope: envelope.resolvedScope,
                samePartition: false,
            };
        }

        return {
            allowed: false,
            stage: 'isolation',
            reason: 'cross-entity read is not allowed for this resource type',
            principalId,
            resourceType,
            action,
            matchedGrantKey: matchedGrant.grantKey,
            partitionKey: envelope.partitionKey,
        };
    }

    return {
        allowed: false,
        stage: 'isolation',
        reason: envelope.crossEntityWriteMode === 'single_partition_only'
            ? 'cross-entity mutation requires a single entity partition'
            : 'cross-entity mutation is not allowed for this resource type',
        principalId,
        resourceType,
        action,
        matchedGrantKey: matchedGrant.grantKey,
        partitionKey: envelope.partitionKey,
    };
}

module.exports = {
    CROSS_ENTITY_READ_MODES,
    CROSS_ENTITY_WRITE_MODES,
    ISOLATION_MODEL_STATUSES,
    PARTITION_LEVELS,
    STORAGE_PLANES,
    buildEntityIsolationCatalog,
    evaluateIsolationAccess,
    getResourceIsolationPolicy,
    resolveResourceIsolationEnvelope,
    validateEntityIsolationDocument,
};
