const {
    COMPONENT_KEYS,
    TOPOLOGY_MODEL_STATUSES,
    TOPOLOGY_PATTERNS,
    getSupportedTopology,
} = require('./sovereign-topology');

const POLICY_MODEL_STATUSES = new Set(['draft', 'active', 'retired']);
const DATA_CLASSES = new Set([
    'workflow_runtime',
    'evidence_records',
    'reporting_aggregates',
    'credential_secrets',
]);
const RESIDENCY_REQUIREMENTS = new Set([
    'topology_boundary',
    'country_boundary',
    'premises_boundary',
]);
const ENCRYPTION_BOUNDARIES = new Set([
    'tenant_managed_kms',
    'country_managed_kms',
    'cluster_managed_kms',
    'customer_managed_hsm',
]);
const CROSS_BORDER_MODES = new Set([
    'prohibited',
    'metadata_only',
    'brokered_export_only',
    'approval_required',
]);
const MOVEMENT_KINDS = new Set([
    'replication',
    'export',
    'support_access',
]);

function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function slugPatternMatch(value) {
    return typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

function uniqueStrings(array, allowedValues, fieldName, pushError, contextLabel) {
    if (!Array.isArray(array) || array.length === 0) {
        pushError(`${contextLabel} ${fieldName} must be a non-empty array`);
        return new Set();
    }

    const values = new Set();
    array.forEach((value) => {
        if (typeof value !== 'string' || value.trim() === '') {
            pushError(`${contextLabel} ${fieldName} must contain non-empty strings`);
            return;
        }
        if (!allowedValues.has(value)) {
            pushError(`${contextLabel} ${fieldName} contains unsupported value "${value}"`);
            return;
        }
        if (values.has(value)) {
            pushError(`${contextLabel} ${fieldName} contains duplicate value "${value}"`);
            return;
        }
        values.add(value);
    });

    return values;
}

function expectedResidencyRequirement(pattern) {
    return {
        single_tenant: 'topology_boundary',
        per_country: 'country_boundary',
        per_cluster: 'topology_boundary',
        on_premises: 'premises_boundary',
    }[pattern];
}

function expectedEncryptionBoundary(pattern) {
    return {
        single_tenant: 'tenant_managed_kms',
        per_country: 'country_managed_kms',
        per_cluster: 'cluster_managed_kms',
        on_premises: 'customer_managed_hsm',
    }[pattern];
}

function validateTopologyReference(document, topologyCatalog, pushError) {
    if (!isObject(document.topologyRef)) {
        pushError('topologyRef must be an object');
        return;
    }

    if (typeof document.topologyRef.modelKey !== 'string' || document.topologyRef.modelKey.trim() === '') {
        pushError('topologyRef.modelKey must be a non-empty string');
    }
    if (!Number.isInteger(document.topologyRef.version) || document.topologyRef.version <= 0) {
        pushError('topologyRef.version must be a positive integer');
    }

    if (topologyCatalog) {
        if (document.topologyRef.modelKey !== topologyCatalog.modelKey) {
            pushError('topologyRef.modelKey must match the loaded sovereign topology catalog');
        }
        if (document.topologyRef.version !== topologyCatalog.version) {
            pushError('topologyRef.version must match the loaded sovereign topology catalog');
        }
        if (!TOPOLOGY_MODEL_STATUSES.has(topologyCatalog.status)) {
            pushError('loaded sovereign topology catalog must be valid');
        }
    }
}

function validateSovereignPolicyDocument(document, topologyCatalog, sourceName = '<memory>') {
    const errors = [];
    const pushError = (message) => errors.push(`${sourceName}: ${message}`);

    if (!isObject(document)) {
        pushError('sovereign policy document must be an object');
        return errors;
    }

    const requiredTopLevel = [
        'schemaVersion',
        'modelKey',
        'version',
        'name',
        'status',
        'topologyRef',
        'policyRules',
    ];
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
    if (!POLICY_MODEL_STATUSES.has(document.status)) {
        pushError('status must be one of draft, active, or retired');
    }

    validateTopologyReference(document, topologyCatalog, pushError);

    if (!Array.isArray(document.policyRules) || document.policyRules.length === 0) {
        pushError('policyRules must be a non-empty array');
        return errors;
    }

    const ruleKeys = new Set();
    const coverageKeys = new Set();
    document.policyRules.forEach((rule, index) => {
        if (!isObject(rule)) {
            pushError(`policy rule at index ${index} must be an object`);
            return;
        }

        const label = `policy rule "${rule.policyKey || index}"`;
        if (!slugPatternMatch(rule.policyKey)) {
            pushError(`policy rule at index ${index} must include a non-empty slug policyKey`);
        } else if (ruleKeys.has(rule.policyKey)) {
            pushError(`duplicate policyKey "${rule.policyKey}"`);
        } else {
            ruleKeys.add(rule.policyKey);
        }

        if (!DATA_CLASSES.has(rule.dataClass)) {
            pushError(`${label} uses unsupported dataClass "${rule.dataClass}"`);
        }

        const patternSet = uniqueStrings(rule.topologyPatterns, TOPOLOGY_PATTERNS, 'topologyPatterns', pushError, label);

        if (!RESIDENCY_REQUIREMENTS.has(rule.residencyRequirement)) {
            pushError(`${label} uses unsupported residencyRequirement "${rule.residencyRequirement}"`);
        }
        if (!ENCRYPTION_BOUNDARIES.has(rule.encryptionBoundary)) {
            pushError(`${label} uses unsupported encryptionBoundary "${rule.encryptionBoundary}"`);
        }
        if (!CROSS_BORDER_MODES.has(rule.crossBorderMode)) {
            pushError(`${label} uses unsupported crossBorderMode "${rule.crossBorderMode}"`);
        }

        uniqueStrings(rule.relatedComponents, COMPONENT_KEYS, 'relatedComponents', pushError, label);

        patternSet.forEach((pattern) => {
            if (rule.residencyRequirement !== expectedResidencyRequirement(pattern)) {
                pushError(`${label} residencyRequirement must match topology pattern "${pattern}"`);
            }
            if (rule.encryptionBoundary !== expectedEncryptionBoundary(pattern)) {
                pushError(`${label} encryptionBoundary must match topology pattern "${pattern}"`);
            }

            const coverageKey = `${pattern}::${rule.dataClass}`;
            if (coverageKeys.has(coverageKey)) {
                pushError(`${label} duplicates policy coverage for "${coverageKey}"`);
            } else {
                coverageKeys.add(coverageKey);
            }
        });
    });

    TOPOLOGY_PATTERNS.forEach((pattern) => {
        DATA_CLASSES.forEach((dataClass) => {
            const coverageKey = `${pattern}::${dataClass}`;
            if (!coverageKeys.has(coverageKey)) {
                pushError(`policyRules must cover dataClass "${dataClass}" for topology pattern "${pattern}"`);
            }
        });
    });

    return errors;
}

function buildSovereignPolicyCatalog(document, topologyCatalog, sourceName = '<memory>') {
    const errors = validateSovereignPolicyDocument(document, topologyCatalog, sourceName);
    if (errors.length > 0) {
        throw new Error(`invalid sovereign policy model: ${errors.join('; ')}`);
    }

    return {
        schemaVersion: document.schemaVersion,
        modelKey: document.modelKey,
        version: document.version,
        name: document.name,
        description: typeof document.description === 'string' ? document.description : '',
        status: document.status,
        topologyRef: clone(document.topologyRef),
        policyRules: document.policyRules.map((rule) => ({
            policyKey: rule.policyKey,
            dataClass: rule.dataClass,
            topologyPatterns: [...rule.topologyPatterns],
            residencyRequirement: rule.residencyRequirement,
            encryptionBoundary: rule.encryptionBoundary,
            crossBorderMode: rule.crossBorderMode,
            relatedComponents: [...rule.relatedComponents],
            notes: typeof rule.notes === 'string' ? rule.notes : '',
        })),
    };
}

function resolveSovereignPolicy(policyCatalog, topologyCatalog, topologyKey, dataClass) {
    if (typeof topologyKey !== 'string' || topologyKey.trim() === '') {
        throw new Error('topologyKey is required');
    }
    if (!DATA_CLASSES.has(dataClass)) {
        throw new Error(`unsupported dataClass "${dataClass}"`);
    }

    const topology = getSupportedTopology(topologyCatalog, topologyKey);
    if (!topology) {
        throw new Error(`topology "${topologyKey}" was not found`);
    }

    const rule = (policyCatalog.policyRules || []).find((item) => item.dataClass === dataClass && item.topologyPatterns.includes(topology.pattern));
    if (!rule) {
        throw new Error(`no sovereign policy found for topology pattern "${topology.pattern}" and dataClass "${dataClass}"`);
    }

    return {
        policyKey: rule.policyKey,
        dataClass: rule.dataClass,
        topologyKey: topology.topologyKey,
        topologyPattern: topology.pattern,
        deploymentTarget: topology.deploymentTarget,
        boundaryScope: topology.boundaryScope,
        residencyRequirement: rule.residencyRequirement,
        encryptionBoundary: rule.encryptionBoundary,
        crossBorderMode: rule.crossBorderMode,
        relatedComponents: [...rule.relatedComponents],
    };
}

function evaluateCrossBorderMovement(policyCatalog, topologyCatalog, command) {
    const {
        topologyKey,
        dataClass,
        sourceBoundaryId,
        destinationBoundaryId,
        movementKind,
        metadataOnly = false,
        brokered = false,
        approvalGranted = false,
    } = command || {};

    if (!MOVEMENT_KINDS.has(movementKind)) {
        throw new Error(`unsupported movementKind "${movementKind}"`);
    }
    if (typeof sourceBoundaryId !== 'string' || sourceBoundaryId.trim() === '') {
        throw new Error('sourceBoundaryId is required');
    }
    if (typeof destinationBoundaryId !== 'string' || destinationBoundaryId.trim() === '') {
        throw new Error('destinationBoundaryId is required');
    }

    const policy = resolveSovereignPolicy(policyCatalog, topologyCatalog, topologyKey, dataClass);
    const crossBorder = sourceBoundaryId !== destinationBoundaryId;

    if (!crossBorder) {
        return {
            allowed: true,
            reason: 'movement stays within the same boundary',
            crossBorder,
            movementKind,
            ...policy,
        };
    }

    switch (policy.crossBorderMode) {
    case 'prohibited':
        return {
            allowed: false,
            reason: 'cross-border movement is prohibited for this data class',
            crossBorder,
            movementKind,
            ...policy,
        };
    case 'metadata_only':
        return {
            allowed: metadataOnly,
            reason: metadataOnly
                ? 'metadata-only cross-border movement is allowed'
                : 'cross-border movement requires metadata-only payloads',
            crossBorder,
            movementKind,
            ...policy,
        };
    case 'brokered_export_only':
        return {
            allowed: brokered && movementKind === 'export',
            reason: brokered && movementKind === 'export'
                ? 'brokered export is allowed for this data class'
                : 'cross-border movement requires a brokered export path',
            crossBorder,
            movementKind,
            ...policy,
        };
    case 'approval_required':
        return {
            allowed: approvalGranted,
            reason: approvalGranted
                ? 'cross-border movement allowed with explicit approval'
                : 'cross-border movement requires explicit approval',
            crossBorder,
            movementKind,
            ...policy,
        };
    default:
        throw new Error(`unsupported crossBorderMode "${policy.crossBorderMode}"`);
    }
}

module.exports = {
    CROSS_BORDER_MODES,
    DATA_CLASSES,
    ENCRYPTION_BOUNDARIES,
    MOVEMENT_KINDS,
    POLICY_MODEL_STATUSES,
    RESIDENCY_REQUIREMENTS,
    buildSovereignPolicyCatalog,
    evaluateCrossBorderMovement,
    resolveSovereignPolicy,
    validateSovereignPolicyDocument,
};
