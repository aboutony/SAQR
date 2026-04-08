const TOPOLOGY_MODEL_STATUSES = new Set(['draft', 'active', 'retired']);
const TOPOLOGY_PATTERNS = new Set(['single_tenant', 'per_country', 'per_cluster', 'on_premises']);
const DEPLOYMENT_TARGETS = new Set(['sovereign_cloud', 'on_premises']);
const BOUNDARY_SCOPES = new Set(['tenant', 'country', 'cluster', 'premises']);
const RUNTIME_CLASSES = new Set(['stateless', 'stateful', 'worker', 'control_plane']);
const PLACEMENT_MODES = new Set([
    'shared_within_topology',
    'dedicated_per_tenant',
    'dedicated_per_country',
    'dedicated_per_cluster',
    'dedicated_on_prem',
]);
const COMPONENT_KEYS = new Set([
    'shield-ui',
    'api',
    'workflow-engine',
    'sentinel-scrapers',
    'cv-watchman',
    'nlp-interpreter',
    'evidence-vault',
]);
const DEPENDENCY_KEYS = new Set([
    'postgres',
    'kafka',
    'identity-provider',
    'vms-gateway',
    'ingress-gateway',
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

function expectedBoundaryScope(pattern) {
    return {
        single_tenant: 'tenant',
        per_country: 'country',
        per_cluster: 'cluster',
        on_premises: 'premises',
    }[pattern];
}

function expectedDeploymentTarget(pattern) {
    return pattern === 'on_premises' ? 'on_premises' : 'sovereign_cloud';
}

function placementModeForPattern(pattern, isolated) {
    if (!isolated) {
        return 'shared_within_topology';
    }

    return {
        single_tenant: 'dedicated_per_tenant',
        per_country: 'dedicated_per_country',
        per_cluster: 'dedicated_per_cluster',
        on_premises: 'dedicated_on_prem',
    }[pattern];
}

function uniqueStrings(array, allowedValues, fieldName, pushError, contextLabel) {
    if (!Array.isArray(array)) {
        pushError(`${contextLabel} ${fieldName} must be an array`);
        return new Set();
    }

    const values = new Set();
    array.forEach((value) => {
        if (typeof value !== 'string' || value.trim() === '') {
            pushError(`${contextLabel} ${fieldName} must contain non-empty strings`);
            return;
        }
        if (allowedValues && !allowedValues.has(value)) {
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

function validateSovereignTopologyDocument(document, sourceName = '<memory>') {
    const errors = [];
    const pushError = (message) => errors.push(`${sourceName}: ${message}`);

    if (!isObject(document)) {
        pushError('sovereign topology document must be an object');
        return errors;
    }

    const requiredTopLevel = [
        'schemaVersion',
        'modelKey',
        'version',
        'name',
        'status',
        'supportedTopologies',
        'componentPlacements',
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
    if (!TOPOLOGY_MODEL_STATUSES.has(document.status)) {
        pushError('status must be one of draft, active, or retired');
    }

    if (!Array.isArray(document.supportedTopologies) || document.supportedTopologies.length === 0) {
        pushError('supportedTopologies must be a non-empty array');
        return errors;
    }

    const topologyKeys = new Set();
    const topologyPatterns = new Set();
    document.supportedTopologies.forEach((topology, index) => {
        if (!isObject(topology)) {
            pushError(`supported topology at index ${index} must be an object`);
            return;
        }

        const label = `supported topology "${topology.topologyKey || index}"`;
        if (!slugPatternMatch(topology.topologyKey)) {
            pushError(`supported topology at index ${index} must include a non-empty slug topologyKey`);
        } else if (topologyKeys.has(topology.topologyKey)) {
            pushError(`duplicate topologyKey "${topology.topologyKey}"`);
        } else {
            topologyKeys.add(topology.topologyKey);
        }

        if (!TOPOLOGY_PATTERNS.has(topology.pattern)) {
            pushError(`${label} uses unsupported pattern "${topology.pattern}"`);
        } else if (topologyPatterns.has(topology.pattern)) {
            pushError(`duplicate supported topology pattern "${topology.pattern}"`);
        } else {
            topologyPatterns.add(topology.pattern);
        }

        if (typeof topology.name !== 'string' || topology.name.trim() === '') {
            pushError(`${label} must include a non-empty name`);
        }
        if (!DEPLOYMENT_TARGETS.has(topology.deploymentTarget)) {
            pushError(`${label} uses unsupported deploymentTarget "${topology.deploymentTarget}"`);
        } else if (topology.pattern && topology.deploymentTarget !== expectedDeploymentTarget(topology.pattern)) {
            pushError(`${label} deploymentTarget must match pattern "${topology.pattern}"`);
        }
        if (!BOUNDARY_SCOPES.has(topology.boundaryScope)) {
            pushError(`${label} uses unsupported boundaryScope "${topology.boundaryScope}"`);
        } else if (topology.pattern && topology.boundaryScope !== expectedBoundaryScope(topology.pattern)) {
            pushError(`${label} boundaryScope must match pattern "${topology.pattern}"`);
        }
        if (typeof topology.description !== 'string' || topology.description.trim() === '') {
            pushError(`${label} must include a non-empty description`);
        }

        const sharedComponents = uniqueStrings(topology.sharedComponents, COMPONENT_KEYS, 'sharedComponents', pushError, label);
        const isolatedComponents = uniqueStrings(topology.isolatedComponents, COMPONENT_KEYS, 'isolatedComponents', pushError, label);
        isolatedComponents.forEach((componentKey) => {
            if (sharedComponents.has(componentKey)) {
                pushError(`${label} cannot declare component "${componentKey}" as both shared and isolated`);
            }
        });

        const dependencySet = uniqueStrings(topology.externalDependencies, DEPENDENCY_KEYS, 'externalDependencies', pushError, label);
        if (dependencySet.size === 0) {
            pushError(`${label} must declare at least one external dependency`);
        }

        COMPONENT_KEYS.forEach((componentKey) => {
            if (!sharedComponents.has(componentKey) && !isolatedComponents.has(componentKey)) {
                pushError(`${label} must classify component "${componentKey}" as shared or isolated`);
            }
        });
    });

    TOPOLOGY_PATTERNS.forEach((pattern) => {
        if (!topologyPatterns.has(pattern)) {
            pushError(`supportedTopologies must include a topology for pattern "${pattern}"`);
        }
    });

    if (!Array.isArray(document.componentPlacements) || document.componentPlacements.length === 0) {
        pushError('componentPlacements must be a non-empty array');
        return errors;
    }

    const componentPlacementKeys = new Set();
    document.componentPlacements.forEach((placement, index) => {
        if (!isObject(placement)) {
            pushError(`component placement at index ${index} must be an object`);
            return;
        }

        const label = `component placement "${placement.componentKey || index}"`;
        if (!COMPONENT_KEYS.has(placement.componentKey)) {
            pushError(`${label} uses unsupported componentKey "${placement.componentKey}"`);
        } else if (componentPlacementKeys.has(placement.componentKey)) {
            pushError(`duplicate component placement for "${placement.componentKey}"`);
        } else {
            componentPlacementKeys.add(placement.componentKey);
        }

        if (!RUNTIME_CLASSES.has(placement.runtimeClass)) {
            pushError(`${label} uses unsupported runtimeClass "${placement.runtimeClass}"`);
        }
        if (!PLACEMENT_MODES.has(placement.defaultPlacement)) {
            pushError(`${label} uses unsupported defaultPlacement "${placement.defaultPlacement}"`);
        }

        const allowedPatterns = uniqueStrings(placement.allowedPatterns, TOPOLOGY_PATTERNS, 'allowedPatterns', pushError, label);
        if (allowedPatterns.size === 0) {
            pushError(`${label} must allow at least one topology pattern`);
        }

        if (placement.defaultPlacement === 'dedicated_per_country' && !allowedPatterns.has('per_country')) {
            pushError(`${label} dedicated_per_country defaultPlacement requires pattern "per_country"`);
        }
        if (placement.defaultPlacement === 'dedicated_per_cluster' && !allowedPatterns.has('per_cluster')) {
            pushError(`${label} dedicated_per_cluster defaultPlacement requires pattern "per_cluster"`);
        }
        if (placement.defaultPlacement === 'dedicated_on_prem' && !allowedPatterns.has('on_premises')) {
            pushError(`${label} dedicated_on_prem defaultPlacement requires pattern "on_premises"`);
        }
        if (placement.defaultPlacement === 'dedicated_per_tenant' && !allowedPatterns.has('single_tenant')) {
            pushError(`${label} dedicated_per_tenant defaultPlacement requires pattern "single_tenant"`);
        }
    });

    COMPONENT_KEYS.forEach((componentKey) => {
        if (!componentPlacementKeys.has(componentKey)) {
            pushError(`componentPlacements must include component "${componentKey}"`);
        }
    });

    return errors;
}

function buildSovereignTopologyCatalog(document, sourceName = '<memory>') {
    const errors = validateSovereignTopologyDocument(document, sourceName);
    if (errors.length > 0) {
        throw new Error(`invalid sovereign topology model: ${errors.join('; ')}`);
    }

    return {
        schemaVersion: document.schemaVersion,
        modelKey: document.modelKey,
        version: document.version,
        name: document.name,
        description: typeof document.description === 'string' ? document.description : '',
        status: document.status,
        supportedTopologies: document.supportedTopologies.map((topology) => ({
            topologyKey: topology.topologyKey,
            pattern: topology.pattern,
            name: topology.name,
            deploymentTarget: topology.deploymentTarget,
            boundaryScope: topology.boundaryScope,
            description: topology.description,
            sharedComponents: [...topology.sharedComponents],
            isolatedComponents: [...topology.isolatedComponents],
            externalDependencies: [...topology.externalDependencies],
        })),
        componentPlacements: document.componentPlacements.map((placement) => ({
            componentKey: placement.componentKey,
            runtimeClass: placement.runtimeClass,
            defaultPlacement: placement.defaultPlacement,
            allowedPatterns: [...placement.allowedPatterns],
            notes: typeof placement.notes === 'string' ? placement.notes : '',
        })),
    };
}

function getSupportedTopology(catalog, topologyKey) {
    const topology = (catalog.supportedTopologies || []).find((item) => item.topologyKey === topologyKey);
    return topology ? clone(topology) : null;
}

function getComponentPlacement(catalog, componentKey) {
    const placement = (catalog.componentPlacements || []).find((item) => item.componentKey === componentKey);
    return placement ? clone(placement) : null;
}

function resolveComponentPlacement(catalog, topologyKey, componentKey) {
    const topology = getSupportedTopology(catalog, topologyKey);
    if (!topology) {
        throw new Error(`topology "${topologyKey}" was not found`);
    }

    const componentPlacement = getComponentPlacement(catalog, componentKey);
    if (!componentPlacement) {
        throw new Error(`component "${componentKey}" was not found`);
    }
    if (!componentPlacement.allowedPatterns.includes(topology.pattern)) {
        throw new Error(`component "${componentKey}" is not allowed in topology pattern "${topology.pattern}"`);
    }

    const isolated = topology.isolatedComponents.includes(componentKey);
    const shared = topology.sharedComponents.includes(componentKey);
    if (!isolated && !shared) {
        throw new Error(`topology "${topologyKey}" does not classify component "${componentKey}"`);
    }

    return {
        topologyKey: topology.topologyKey,
        topologyPattern: topology.pattern,
        deploymentTarget: topology.deploymentTarget,
        boundaryScope: topology.boundaryScope,
        componentKey,
        runtimeClass: componentPlacement.runtimeClass,
        placementMode: placementModeForPattern(topology.pattern, isolated),
        isolated,
        sharedWithinTopology: shared,
        externalDependencies: [...topology.externalDependencies],
    };
}

function listTopologyPatterns(catalog) {
    return (catalog.supportedTopologies || [])
        .map((topology) => ({
            topologyKey: topology.topologyKey,
            pattern: topology.pattern,
            deploymentTarget: topology.deploymentTarget,
            boundaryScope: topology.boundaryScope,
        }))
        .sort((left, right) => left.topologyKey.localeCompare(right.topologyKey));
}

module.exports = {
    BOUNDARY_SCOPES,
    COMPONENT_KEYS,
    DEPENDENCY_KEYS,
    DEPLOYMENT_TARGETS,
    PLACEMENT_MODES,
    RUNTIME_CLASSES,
    TOPOLOGY_MODEL_STATUSES,
    TOPOLOGY_PATTERNS,
    buildSovereignTopologyCatalog,
    getComponentPlacement,
    getSupportedTopology,
    listTopologyPatterns,
    resolveComponentPlacement,
    validateSovereignTopologyDocument,
};
