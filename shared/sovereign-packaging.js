const { COMPONENT_KEYS, getSupportedTopology } = require('./sovereign-topology');
const { POLICY_MODEL_STATUSES, resolveSovereignPolicy } = require('./sovereign-policy');

const PACKAGING_MODEL_STATUSES = new Set(['draft', 'active', 'retired']);
const DISTRIBUTION_MODES = new Set(['container_service', 'embedded_module']);

function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function slugPatternMatch(value) {
    return typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

function validateReference(document, field, catalog, pushError) {
    if (!isObject(document[field])) {
        pushError(`${field} must be an object`);
        return;
    }

    if (typeof document[field].modelKey !== 'string' || document[field].modelKey.trim() === '') {
        pushError(`${field}.modelKey must be a non-empty string`);
    }
    if (!Number.isInteger(document[field].version) || document[field].version <= 0) {
        pushError(`${field}.version must be a positive integer`);
    }

    if (catalog) {
        if (document[field].modelKey !== catalog.modelKey) {
            pushError(`${field}.modelKey must match the loaded ${field} catalog`);
        }
        if (document[field].version !== catalog.version) {
            pushError(`${field}.version must match the loaded ${field} catalog`);
        }
    }
}

function validateStringArray(array, fieldName, pushError, contextLabel) {
    if (!Array.isArray(array) || array.length === 0) {
        pushError(`${contextLabel} ${fieldName} must be a non-empty array`);
        return;
    }

    array.forEach((value) => {
        if (typeof value !== 'string' || value.trim() === '') {
            pushError(`${contextLabel} ${fieldName} must contain non-empty strings`);
        }
    });
}

function validateSovereignPackagingDocument(document, topologyCatalog, policyCatalog, sourceName = '<memory>') {
    const errors = [];
    const pushError = (message) => errors.push(`${sourceName}: ${message}`);

    if (!isObject(document)) {
        pushError('sovereign packaging document must be an object');
        return errors;
    }

    const requiredTopLevel = [
        'schemaVersion',
        'modelKey',
        'version',
        'name',
        'status',
        'topologyRef',
        'policyRef',
        'packageProfiles',
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
    if (!PACKAGING_MODEL_STATUSES.has(document.status)) {
        pushError('status must be one of draft, active, or retired');
    }

    validateReference(document, 'topologyRef', topologyCatalog, pushError);
    validateReference(document, 'policyRef', policyCatalog, pushError);
    if (policyCatalog && !POLICY_MODEL_STATUSES.has(policyCatalog.status)) {
        pushError('loaded policy catalog must be valid');
    }

    if (!Array.isArray(document.packageProfiles) || document.packageProfiles.length === 0) {
        pushError('packageProfiles must be a non-empty array');
        return errors;
    }

    const profileKeys = new Set();
    document.packageProfiles.forEach((profile, index) => {
        if (!isObject(profile)) {
            pushError(`package profile at index ${index} must be an object`);
            return;
        }

        const label = `package profile "${profile.profileKey || index}"`;
        if (!slugPatternMatch(profile.profileKey)) {
            pushError(`package profile at index ${index} must include a non-empty slug profileKey`);
        } else if (profileKeys.has(profile.profileKey)) {
            pushError(`duplicate profileKey "${profile.profileKey}"`);
        } else {
            profileKeys.add(profile.profileKey);
        }

        if (typeof profile.topologyKey !== 'string' || profile.topologyKey.trim() === '') {
            pushError(`${label} must include a non-empty topologyKey`);
        } else if (topologyCatalog && !getSupportedTopology(topologyCatalog, profile.topologyKey)) {
            pushError(`${label} references unknown topologyKey "${profile.topologyKey}"`);
        }

        validateStringArray(profile.composeFiles, 'composeFiles', pushError, label);
        validateStringArray(profile.envTemplates, 'envTemplates', pushError, label);
        validateStringArray(profile.kustomizeFiles, 'kustomizeFiles', pushError, label);
        validateStringArray(profile.deliveryNotes, 'deliveryNotes', pushError, label);

        if (!Array.isArray(profile.componentBindings) || profile.componentBindings.length === 0) {
            pushError(`${label} componentBindings must be a non-empty array`);
            return;
        }

        const componentKeys = new Set();
        profile.componentBindings.forEach((binding, bindingIndex) => {
            if (!isObject(binding)) {
                pushError(`${label} component binding at index ${bindingIndex} must be an object`);
                return;
            }

            if (!COMPONENT_KEYS.has(binding.componentKey)) {
                pushError(`${label} uses unsupported componentKey "${binding.componentKey}"`);
            } else if (componentKeys.has(binding.componentKey)) {
                pushError(`${label} duplicates component binding "${binding.componentKey}"`);
            } else {
                componentKeys.add(binding.componentKey);
            }

            if (!DISTRIBUTION_MODES.has(binding.distributionMode)) {
                pushError(`${label} component "${binding.componentKey || bindingIndex}" uses unsupported distributionMode "${binding.distributionMode}"`);
            }
            if (typeof binding.runtimeArtifact !== 'string' || binding.runtimeArtifact.trim() === '') {
                pushError(`${label} component "${binding.componentKey || bindingIndex}" must include a non-empty runtimeArtifact`);
            }
        });

        COMPONENT_KEYS.forEach((componentKey) => {
            if (!componentKeys.has(componentKey)) {
                pushError(`${label} must bind component "${componentKey}"`);
            }
        });
    });

    return errors;
}

function buildSovereignPackagingCatalog(document, topologyCatalog, policyCatalog, sourceName = '<memory>') {
    const errors = validateSovereignPackagingDocument(document, topologyCatalog, policyCatalog, sourceName);
    if (errors.length > 0) {
        throw new Error(`invalid sovereign packaging model: ${errors.join('; ')}`);
    }

    return {
        schemaVersion: document.schemaVersion,
        modelKey: document.modelKey,
        version: document.version,
        name: document.name,
        description: typeof document.description === 'string' ? document.description : '',
        status: document.status,
        topologyRef: clone(document.topologyRef),
        policyRef: clone(document.policyRef),
        packageProfiles: document.packageProfiles.map((profile) => ({
            profileKey: profile.profileKey,
            topologyKey: profile.topologyKey,
            composeFiles: [...profile.composeFiles],
            envTemplates: [...profile.envTemplates],
            kustomizeFiles: [...profile.kustomizeFiles],
            deliveryNotes: [...profile.deliveryNotes],
            componentBindings: profile.componentBindings.map((binding) => ({
                componentKey: binding.componentKey,
                distributionMode: binding.distributionMode,
                runtimeArtifact: binding.runtimeArtifact,
            })),
        })),
    };
}

function getPackagingProfile(catalog, profileKey) {
    const profile = (catalog.packageProfiles || []).find((item) => item.profileKey === profileKey);
    return profile ? clone(profile) : null;
}

function resolveSovereignPackagingProfile(catalog, topologyCatalog, policyCatalog, profileKey) {
    const profile = getPackagingProfile(catalog, profileKey);
    if (!profile) {
        throw new Error(`package profile "${profileKey}" was not found`);
    }

    const topology = getSupportedTopology(topologyCatalog, profile.topologyKey);
    if (!topology) {
        throw new Error(`topology "${profile.topologyKey}" was not found`);
    }

    const evidencePolicy = resolveSovereignPolicy(policyCatalog, topologyCatalog, topology.topologyKey, 'evidence_records');
    const reportingPolicy = resolveSovereignPolicy(policyCatalog, topologyCatalog, topology.topologyKey, 'reporting_aggregates');

    return {
        profileKey: profile.profileKey,
        topologyKey: topology.topologyKey,
        topologyPattern: topology.pattern,
        deploymentTarget: topology.deploymentTarget,
        boundaryScope: topology.boundaryScope,
        composeFiles: [...profile.composeFiles],
        envTemplates: [...profile.envTemplates],
        kustomizeFiles: [...profile.kustomizeFiles],
        componentBindings: profile.componentBindings.map((binding) => ({
            ...binding,
            policyDefaults: {
                evidenceRecords: evidencePolicy,
                reportingAggregates: reportingPolicy,
            },
        })),
        deliveryNotes: [...profile.deliveryNotes],
    };
}

module.exports = {
    DISTRIBUTION_MODES,
    PACKAGING_MODEL_STATUSES,
    buildSovereignPackagingCatalog,
    getPackagingProfile,
    resolveSovereignPackagingProfile,
    validateSovereignPackagingDocument,
};
