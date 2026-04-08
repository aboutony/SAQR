const { clone, getEntityNode, resolveEntityScope } = require('./entity-hierarchy');
const { evaluateIsolationAccess } = require('./entity-isolation');
const { buildPortfolioRollup } = require('./entity-rollup');

const REPORTING_MODEL_STATUSES = new Set(['draft', 'active', 'retired']);
const REPORT_VIEW_TYPES = new Set(['executive_summary', 'entity_portfolio', 'control_heatmap']);
const ENTITY_LEVELS = new Set(['group', 'entity', 'businessUnit', 'site', 'silo']);
const STATUS_PRIORITY = Object.freeze({
    breached: 5,
    attention: 4,
    not_assessed: 3,
    compliant: 2,
    not_applicable: 1,
});
const SEVERITY_PRIORITY = Object.freeze({
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
});

function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function slugPatternMatch(value) {
    return typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

function deepestScopeField(scope) {
    return ['siloId', 'siteId', 'businessUnitId', 'entityId', 'groupId']
        .find(field => typeof scope[field] === 'string' && scope[field].trim() !== '');
}

function inferRootNodeId(scope) {
    const field = deepestScopeField(scope || {});
    return field ? scope[field] : null;
}

function validateReferenceObject(document, field, keyField, pushError) {
    if (!isObject(document[field])) {
        pushError(`${field} must be an object`);
        return;
    }

    if (typeof document[field][keyField] !== 'string' || document[field][keyField].trim() === '') {
        pushError(`${field}.${keyField} must be a non-empty string`);
    }
    if (!Number.isInteger(document[field].version) || document[field].version <= 0) {
        pushError(`${field}.version must be a positive integer`);
    }
}

function compareReference(documentRef, actualRef, fieldName, keyField, pushError) {
    if (!documentRef || !actualRef) {
        return;
    }
    if (documentRef[keyField] !== actualRef[keyField]) {
        pushError(`${fieldName}.${keyField} must match the loaded ${fieldName}`);
    }
    if (documentRef.version !== actualRef.version) {
        pushError(`${fieldName}.version must match the loaded ${fieldName}`);
    }
}

function validateEntityReportingDocument(document, references = {}, sourceName = '<memory>') {
    const errors = [];
    const pushError = (message) => errors.push(`${sourceName}: ${message}`);

    if (!isObject(document)) {
        pushError('entity reporting document must be an object');
        return errors;
    }

    const requiredTopLevel = [
        'schemaVersion',
        'modelKey',
        'version',
        'name',
        'status',
        'hierarchyRef',
        'scopingRef',
        'isolationRef',
        'rollupRef',
        'reportDefinitions',
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
    if (!REPORTING_MODEL_STATUSES.has(document.status)) {
        pushError('status must be one of draft, active, or retired');
    }

    validateReferenceObject(document, 'hierarchyRef', 'hierarchyKey', pushError);
    validateReferenceObject(document, 'scopingRef', 'modelKey', pushError);
    validateReferenceObject(document, 'isolationRef', 'modelKey', pushError);
    validateReferenceObject(document, 'rollupRef', 'modelKey', pushError);

    compareReference(document.hierarchyRef, references.hierarchyRef, 'hierarchyRef', 'hierarchyKey', pushError);
    compareReference(document.scopingRef, references.scopingRef, 'scopingRef', 'modelKey', pushError);
    compareReference(document.isolationRef, references.isolationRef, 'isolationRef', 'modelKey', pushError);
    compareReference(document.rollupRef, references.rollupRef, 'rollupRef', 'modelKey', pushError);

    if (!Array.isArray(document.reportDefinitions) || document.reportDefinitions.length === 0) {
        pushError('reportDefinitions must be a non-empty array');
        return errors;
    }

    const reportKeys = new Set();
    document.reportDefinitions.forEach((definition, index) => {
        if (!isObject(definition)) {
            pushError(`report definition at index ${index} must be an object`);
            return;
        }

        if (!slugPatternMatch(definition.reportKey)) {
            pushError(`report definition at index ${index} must include a non-empty slug reportKey`);
        } else if (reportKeys.has(definition.reportKey)) {
            pushError(`duplicate reportKey "${definition.reportKey}"`);
        } else {
            reportKeys.add(definition.reportKey);
        }

        if (typeof definition.name !== 'string' || definition.name.trim() === '') {
            pushError(`report definition "${definition.reportKey || index}" must include a non-empty name`);
        }
        if (!REPORT_VIEW_TYPES.has(definition.viewType)) {
            pushError(`report definition "${definition.reportKey || index}" uses unsupported viewType "${definition.viewType}"`);
        }
        if (!Array.isArray(definition.targetRootLevels) || definition.targetRootLevels.length === 0) {
            pushError(`report definition "${definition.reportKey || index}" must declare at least one targetRootLevel`);
        } else {
            definition.targetRootLevels.forEach((level) => {
                if (!ENTITY_LEVELS.has(level)) {
                    pushError(`report definition "${definition.reportKey || index}" uses unsupported targetRootLevel "${level}"`);
                }
            });
        }
        if ('includeChildLevels' in definition) {
            if (!Array.isArray(definition.includeChildLevels) || definition.includeChildLevels.length === 0) {
                pushError(`report definition "${definition.reportKey || index}" includeChildLevels must be a non-empty array when present`);
            } else {
                definition.includeChildLevels.forEach((level) => {
                    if (!ENTITY_LEVELS.has(level)) {
                        pushError(`report definition "${definition.reportKey || index}" uses unsupported includeChildLevel "${level}"`);
                    }
                });
            }
        }
        if (!Number.isInteger(definition.maxControlHighlights) || definition.maxControlHighlights <= 0) {
            pushError(`report definition "${definition.reportKey || index}" must use a positive integer maxControlHighlights`);
        }
        if (!Number.isInteger(definition.maxNodeHighlights) || definition.maxNodeHighlights <= 0) {
            pushError(`report definition "${definition.reportKey || index}" must use a positive integer maxNodeHighlights`);
        }
        if ('audienceTags' in definition) {
            if (!Array.isArray(definition.audienceTags) || definition.audienceTags.some(tag => typeof tag !== 'string' || tag.trim() === '')) {
                pushError(`report definition "${definition.reportKey || index}" audienceTags must be an array of non-empty strings`);
            }
        }
    });

    return errors;
}

function buildEntityReportingCatalog(document, references = {}, sourceName = '<memory>') {
    const errors = validateEntityReportingDocument(document, references, sourceName);
    if (errors.length > 0) {
        throw new Error(`invalid entity reporting model: ${errors.join('; ')}`);
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
        isolationRef: clone(document.isolationRef),
        rollupRef: clone(document.rollupRef),
        reportDefinitions: document.reportDefinitions.map((definition) => ({
            reportKey: definition.reportKey,
            name: definition.name,
            viewType: definition.viewType,
            targetRootLevels: [...definition.targetRootLevels],
            includeChildLevels: Array.isArray(definition.includeChildLevels) ? [...definition.includeChildLevels] : [],
            maxControlHighlights: definition.maxControlHighlights,
            maxNodeHighlights: definition.maxNodeHighlights,
            audienceTags: Array.isArray(definition.audienceTags) ? [...definition.audienceTags] : [],
        })),
    };
}

function getReportDefinition(reportingCatalog, reportKey) {
    const definition = (reportingCatalog.reportDefinitions || []).find((item) => item.reportKey === reportKey);
    return definition ? clone(definition) : null;
}

function summarizeHighlightedControl(controlRollup) {
    return {
        controlKey: controlRollup.controlKey,
        controlName: controlRollup.controlName,
        severity: controlRollup.severity,
        worstStatus: controlRollup.worstStatus,
        applicableNodeCount: controlRollup.applicableNodeCount,
        directNodeCount: controlRollup.directNodeCount,
        inheritedNodeCount: controlRollup.inheritedNodeCount,
        statusCounts: clone(controlRollup.statusCounts),
    };
}

function summarizeHighlightedNode(nodeSummary) {
    return {
        nodeId: nodeSummary.nodeId,
        level: nodeSummary.level,
        scope: clone(nodeSummary.scope),
        overallStatus: nodeSummary.overallStatus,
        totalControls: nodeSummary.totalControls,
        directControlCount: nodeSummary.directControlCount,
        inheritedControlCount: nodeSummary.inheritedControlCount,
        statusCounts: clone(nodeSummary.statusCounts),
    };
}

function generateEntityReport(reportingCatalog, references, command) {
    const {
        hierarchyCatalog,
        scopingCatalog,
        isolationCatalog,
        rollupCatalog,
    } = references;

    const {
        principalId,
        reportKey,
        targetScope,
    } = command || {};

    if (typeof principalId !== 'string' || principalId.trim() === '') {
        throw new Error('principalId is required');
    }
    if (typeof reportKey !== 'string' || reportKey.trim() === '') {
        throw new Error('reportKey is required');
    }

    const definition = getReportDefinition(reportingCatalog, reportKey);
    if (!definition) {
        throw new Error(`report definition "${reportKey}" was not found`);
    }

    const resolvedScope = resolveEntityScope(hierarchyCatalog, targetScope || {});
    const rootNodeId = inferRootNodeId(resolvedScope);
    const rootNode = getEntityNode(hierarchyCatalog, rootNodeId);

    if (!rootNode) {
        throw new Error('targetScope must resolve to an existing hierarchy node');
    }
    if (!definition.targetRootLevels.includes(rootNode.level)) {
        throw new Error(`report "${reportKey}" does not support root level "${rootNode.level}"`);
    }

    const accessDecision = evaluateIsolationAccess(
        scopingCatalog,
        hierarchyCatalog,
        isolationCatalog,
        principalId,
        'report',
        'report',
        resolvedScope
    );

    if (!accessDecision.allowed) {
        throw new Error(accessDecision.reason);
    }

    const portfolioRollup = buildPortfolioRollup(rollupCatalog, hierarchyCatalog, rootNodeId);
    const childLevelFilter = new Set(definition.includeChildLevels);

    const nodeHighlights = portfolioRollup.nodeSummaries
        .filter(summary => summary.nodeId !== rootNodeId)
        .filter(summary => childLevelFilter.size === 0 || childLevelFilter.has(summary.level))
        .sort((left, right) => {
            const statusDelta = STATUS_PRIORITY[right.overallStatus] - STATUS_PRIORITY[left.overallStatus];
            if (statusDelta !== 0) {
                return statusDelta;
            }
            const controlDelta = (right.directControlCount + right.inheritedControlCount) - (left.directControlCount + left.inheritedControlCount);
            if (controlDelta !== 0) {
                return controlDelta;
            }
            return left.nodeId.localeCompare(right.nodeId);
        })
        .slice(0, definition.maxNodeHighlights)
        .map(summarizeHighlightedNode);

    const controlHighlights = portfolioRollup.controlRollups
        .sort((left, right) => {
            const statusDelta = STATUS_PRIORITY[right.worstStatus] - STATUS_PRIORITY[left.worstStatus];
            if (statusDelta !== 0) {
                return statusDelta;
            }
            const severityDelta = SEVERITY_PRIORITY[right.severity] - SEVERITY_PRIORITY[left.severity];
            if (severityDelta !== 0) {
                return severityDelta;
            }
            const countDelta = right.applicableNodeCount - left.applicableNodeCount;
            if (countDelta !== 0) {
                return countDelta;
            }
            return left.controlKey.localeCompare(right.controlKey);
        })
        .slice(0, definition.maxControlHighlights)
        .map(summarizeHighlightedControl);

    return {
        reportKey: definition.reportKey,
        reportName: definition.name,
        viewType: definition.viewType,
        audienceTags: [...definition.audienceTags],
        principalId,
        boundaryMode: accessDecision.boundaryMode,
        rootNodeId: rootNode.nodeId,
        rootLevel: rootNode.level,
        rootScope: clone(portfolioRollup.rootScope),
        overallStatus: portfolioRollup.overallStatus,
        nodeCount: portfolioRollup.nodeCount,
        nodeStatusCounts: clone(portfolioRollup.nodeStatusCounts),
        controlHighlights,
        nodeHighlights,
    };
}

module.exports = {
    REPORT_VIEW_TYPES,
    REPORTING_MODEL_STATUSES,
    buildEntityReportingCatalog,
    generateEntityReport,
    getReportDefinition,
    validateEntityReportingDocument,
};
