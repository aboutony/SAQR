const {
    clone,
    getEntityNode,
    listDescendantNodes,
    resolveEntityScope,
} = require('./entity-hierarchy');

const ROLLUP_MODEL_STATUSES = new Set(['draft', 'active', 'retired']);
const CONTROL_SEVERITIES = new Set(['critical', 'high', 'medium', 'low']);
const CONTROL_STATUSES = new Set(['compliant', 'attention', 'breached', 'not_assessed', 'not_applicable']);
const INHERITANCE_MODES = new Set(['local_only', 'inherit_to_descendants']);
const ASSESSMENT_SOURCE_TYPES = new Set(['manual', 'cdc', 'nlp', 'cv', 'workflow']);
const STATUS_PRIORITY = Object.freeze({
    breached: 5,
    attention: 4,
    not_assessed: 3,
    compliant: 2,
    not_applicable: 1,
});

function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function slugPatternMatch(value) {
    return typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

function getScopeAnchorField(scope) {
    return Object.keys({
        groupId: null,
        entityId: null,
        businessUnitId: null,
        siteId: null,
        siloId: null,
    })
        .reverse()
        .find(field => typeof scope[field] === 'string' && scope[field].trim() !== '');
}

function getScopeAnchorNodeId(scope) {
    const field = getScopeAnchorField(scope);
    return field ? scope[field] : null;
}

function statusCountsSeed() {
    return {
        breached: 0,
        attention: 0,
        not_assessed: 0,
        compliant: 0,
        not_applicable: 0,
    };
}

function calculateWorstStatus(statuses) {
    if (!Array.isArray(statuses) || statuses.length === 0) {
        return 'not_assessed';
    }

    return [...statuses].sort((left, right) => STATUS_PRIORITY[right] - STATUS_PRIORITY[left])[0];
}

function validateEntityRollupDocument(document, hierarchyCatalog, sourceName = '<memory>') {
    const errors = [];
    const pushError = (message) => errors.push(`${sourceName}: ${message}`);

    if (!isObject(document)) {
        pushError('entity rollup document must be an object');
        return errors;
    }

    const requiredTopLevel = ['schemaVersion', 'modelKey', 'version', 'name', 'status', 'hierarchyRef', 'controlDefinitions', 'controlAssignments'];
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
    if (!ROLLUP_MODEL_STATUSES.has(document.status)) {
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

    if (!Array.isArray(document.controlDefinitions) || document.controlDefinitions.length === 0) {
        pushError('controlDefinitions must be a non-empty array');
        return errors;
    }

    const controlKeys = new Set();
    document.controlDefinitions.forEach((definition, index) => {
        if (!isObject(definition)) {
            pushError(`control definition at index ${index} must be an object`);
            return;
        }

        if (!slugPatternMatch(definition.controlKey)) {
            pushError(`control definition at index ${index} must include a non-empty slug controlKey`);
        } else if (controlKeys.has(definition.controlKey)) {
            pushError(`duplicate controlKey "${definition.controlKey}"`);
        } else {
            controlKeys.add(definition.controlKey);
        }

        if (typeof definition.name !== 'string' || definition.name.trim() === '') {
            pushError(`control definition "${definition.controlKey || index}" must include a non-empty name`);
        }
        if (!CONTROL_SEVERITIES.has(definition.severity)) {
            pushError(`control definition "${definition.controlKey || index}" uses unsupported severity "${definition.severity}"`);
        }
    });

    if (!Array.isArray(document.controlAssignments) || document.controlAssignments.length === 0) {
        pushError('controlAssignments must be a non-empty array');
        return errors;
    }

    const assignmentKeys = new Set();
    const assignmentScopeKeys = new Set();
    document.controlAssignments.forEach((assignment, index) => {
        if (!isObject(assignment)) {
            pushError(`control assignment at index ${index} must be an object`);
            return;
        }

        if (!slugPatternMatch(assignment.assignmentKey)) {
            pushError(`control assignment at index ${index} must include a non-empty slug assignmentKey`);
        } else if (assignmentKeys.has(assignment.assignmentKey)) {
            pushError(`duplicate assignmentKey "${assignment.assignmentKey}"`);
        } else {
            assignmentKeys.add(assignment.assignmentKey);
        }

        if (!controlKeys.has(assignment.controlKey)) {
            pushError(`control assignment "${assignment.assignmentKey || index}" references unknown controlKey "${assignment.controlKey}"`);
        }
        if (!INHERITANCE_MODES.has(assignment.inheritanceMode)) {
            pushError(`control assignment "${assignment.assignmentKey || index}" uses unsupported inheritanceMode "${assignment.inheritanceMode}"`);
        }
        if (!isObject(assignment.scope)) {
            pushError(`control assignment "${assignment.assignmentKey || index}" must include an object scope`);
        } else {
            try {
                const resolvedScope = resolveEntityScope(hierarchyCatalog, assignment.scope);
                const assignmentScopeKey = `${assignment.controlKey}::${getScopeAnchorNodeId(resolvedScope)}`;
                if (assignmentScopeKeys.has(assignmentScopeKey)) {
                    pushError(`duplicate control assignment scope for "${assignment.controlKey}"`);
                } else {
                    assignmentScopeKeys.add(assignmentScopeKey);
                }
            } catch (error) {
                pushError(`control assignment "${assignment.assignmentKey || index}" uses invalid scope: ${error.message}`);
            }
        }
    });

    const controlAssessments = Array.isArray(document.controlAssessments) ? document.controlAssessments : [];
    const assessmentKeys = new Set();
    const assessmentScopeKeys = new Set();
    controlAssessments.forEach((assessment, index) => {
        if (!isObject(assessment)) {
            pushError(`control assessment at index ${index} must be an object`);
            return;
        }

        if (!slugPatternMatch(assessment.assessmentKey)) {
            pushError(`control assessment at index ${index} must include a non-empty slug assessmentKey`);
        } else if (assessmentKeys.has(assessment.assessmentKey)) {
            pushError(`duplicate assessmentKey "${assessment.assessmentKey}"`);
        } else {
            assessmentKeys.add(assessment.assessmentKey);
        }

        if (!controlKeys.has(assessment.controlKey)) {
            pushError(`control assessment "${assessment.assessmentKey || index}" references unknown controlKey "${assessment.controlKey}"`);
        }
        if (!CONTROL_STATUSES.has(assessment.status)) {
            pushError(`control assessment "${assessment.assessmentKey || index}" uses unsupported status "${assessment.status}"`);
        }
        if (!ASSESSMENT_SOURCE_TYPES.has(assessment.sourceType)) {
            pushError(`control assessment "${assessment.assessmentKey || index}" uses unsupported sourceType "${assessment.sourceType}"`);
        }
        if (!isObject(assessment.scope)) {
            pushError(`control assessment "${assessment.assessmentKey || index}" must include an object scope`);
        } else {
            try {
                const resolvedScope = resolveEntityScope(hierarchyCatalog, assessment.scope);
                const assessmentScopeKey = `${assessment.controlKey}::${getScopeAnchorNodeId(resolvedScope)}`;
                if (assessmentScopeKeys.has(assessmentScopeKey)) {
                    pushError(`duplicate exact control assessment for "${assessment.controlKey}"`);
                } else {
                    assessmentScopeKeys.add(assessmentScopeKey);
                }
            } catch (error) {
                pushError(`control assessment "${assessment.assessmentKey || index}" uses invalid scope: ${error.message}`);
            }
        }
    });

    return errors;
}

function buildEntityRollupCatalog(document, hierarchyCatalog, sourceName = '<memory>') {
    const errors = validateEntityRollupDocument(document, hierarchyCatalog, sourceName);
    if (errors.length > 0) {
        throw new Error(`invalid entity rollup model: ${errors.join('; ')}`);
    }

    const definitions = document.controlDefinitions.map((definition) => ({
        controlKey: definition.controlKey,
        name: definition.name,
        severity: definition.severity,
        description: typeof definition.description === 'string' ? definition.description : '',
        metadata: isObject(definition.metadata) ? clone(definition.metadata) : {},
    }));

    const assignments = document.controlAssignments.map((assignment) => {
        const resolvedScope = resolveEntityScope(hierarchyCatalog, assignment.scope);
        const anchorNodeId = getScopeAnchorNodeId(resolvedScope);
        return {
            assignmentKey: assignment.assignmentKey,
            controlKey: assignment.controlKey,
            inheritanceMode: assignment.inheritanceMode,
            scope: resolvedScope,
            anchorNodeId,
            notes: typeof assignment.notes === 'string' ? assignment.notes : '',
        };
    });

    const assessments = (Array.isArray(document.controlAssessments) ? document.controlAssessments : []).map((assessment) => {
        const resolvedScope = resolveEntityScope(hierarchyCatalog, assessment.scope);
        const anchorNodeId = getScopeAnchorNodeId(resolvedScope);
        return {
            assessmentKey: assessment.assessmentKey,
            controlKey: assessment.controlKey,
            status: assessment.status,
            sourceType: assessment.sourceType,
            scope: resolvedScope,
            anchorNodeId,
            notes: typeof assessment.notes === 'string' ? assessment.notes : '',
        };
    });

    return {
        schemaVersion: document.schemaVersion,
        modelKey: document.modelKey,
        version: document.version,
        name: document.name,
        description: typeof document.description === 'string' ? document.description : '',
        status: document.status,
        hierarchyRef: clone(document.hierarchyRef),
        controlDefinitions: definitions,
        controlAssignments: assignments,
        controlAssessments: assessments,
    };
}

function appliesAssignmentToNode(targetNode, assignment) {
    if (assignment.anchorNodeId === targetNode.nodeId) {
        return true;
    }
    return assignment.inheritanceMode === 'inherit_to_descendants'
        && Array.isArray(targetNode.ancestorNodeIds)
        && targetNode.ancestorNodeIds.includes(assignment.anchorNodeId);
}

function assignmentSpecificity(hierarchyCatalog, assignment) {
    const anchorNode = getEntityNode(hierarchyCatalog, assignment.anchorNodeId);
    return anchorNode ? anchorNode.ancestorNodeIds.length : -1;
}

function resolveEffectiveControlStates(rollupCatalog, hierarchyCatalog, nodeId) {
    const targetNode = getEntityNode(hierarchyCatalog, nodeId);
    if (!targetNode) {
        throw new Error(`entity node "${nodeId}" was not found`);
    }

    const definitionsByKey = new Map(rollupCatalog.controlDefinitions.map((definition) => [definition.controlKey, definition]));
    const exactAssessments = new Map(
        rollupCatalog.controlAssessments
            .filter(assessment => assessment.anchorNodeId === nodeId)
            .map(assessment => [assessment.controlKey, assessment])
    );

    const candidateAssignments = rollupCatalog.controlAssignments.filter((assignment) => appliesAssignmentToNode(targetNode, assignment));
    const assignmentsByControl = new Map();

    candidateAssignments.forEach((assignment) => {
        const current = assignmentsByControl.get(assignment.controlKey);
        if (!current || assignmentSpecificity(hierarchyCatalog, assignment) > assignmentSpecificity(hierarchyCatalog, current)) {
            assignmentsByControl.set(assignment.controlKey, assignment);
        }
    });

    const effectiveStates = Array.from(assignmentsByControl.values())
        .map((assignment) => {
            const definition = definitionsByKey.get(assignment.controlKey);
            const assessment = exactAssessments.get(assignment.controlKey) || null;
            const status = assessment ? assessment.status : 'not_assessed';
            const inheritedFromNodeId = assignment.anchorNodeId === nodeId ? null : assignment.anchorNodeId;
            return {
                controlKey: assignment.controlKey,
                controlName: definition.name,
                severity: definition.severity,
                assignmentKey: assignment.assignmentKey,
                assignmentMode: assignment.inheritanceMode,
                anchorNodeId: assignment.anchorNodeId,
                inheritedFromNodeId,
                inherited: Boolean(inheritedFromNodeId),
                status,
                statusSource: assessment ? 'assessment' : 'default',
                assessmentKey: assessment ? assessment.assessmentKey : null,
                assessmentSourceType: assessment ? assessment.sourceType : null,
                scope: clone(targetNode.lineage),
            };
        })
        .sort((left, right) => left.controlKey.localeCompare(right.controlKey));

    return effectiveStates;
}

function buildNodeRollupSummary(rollupCatalog, hierarchyCatalog, nodeId) {
    const node = getEntityNode(hierarchyCatalog, nodeId);
    if (!node) {
        throw new Error(`entity node "${nodeId}" was not found`);
    }

    const controlStates = resolveEffectiveControlStates(rollupCatalog, hierarchyCatalog, nodeId);
    const counts = statusCountsSeed();
    controlStates.forEach((state) => {
        counts[state.status] += 1;
    });

    return {
        nodeId: node.nodeId,
        level: node.level,
        scope: clone(node.lineage),
        totalControls: controlStates.length,
        directControlCount: controlStates.filter(state => !state.inherited).length,
        inheritedControlCount: controlStates.filter(state => state.inherited).length,
        statusCounts: counts,
        overallStatus: calculateWorstStatus(controlStates.map(state => state.status)),
        controlStates,
    };
}

function buildPortfolioRollup(rollupCatalog, hierarchyCatalog, rootNodeId) {
    const rootNode = getEntityNode(hierarchyCatalog, rootNodeId);
    if (!rootNode) {
        throw new Error(`entity node "${rootNodeId}" was not found`);
    }

    const targetNodes = [rootNode, ...listDescendantNodes(hierarchyCatalog, rootNodeId)];
    const nodeSummaries = targetNodes.map(node => buildNodeRollupSummary(rollupCatalog, hierarchyCatalog, node.nodeId));
    const nodeStatusCounts = statusCountsSeed();
    nodeSummaries.forEach((summary) => {
        nodeStatusCounts[summary.overallStatus] += 1;
    });

    const definitionsByKey = new Map(rollupCatalog.controlDefinitions.map((definition) => [definition.controlKey, definition]));
    const controlRollupsByKey = new Map();

    nodeSummaries.forEach((summary) => {
        summary.controlStates.forEach((state) => {
            if (!controlRollupsByKey.has(state.controlKey)) {
                const definition = definitionsByKey.get(state.controlKey);
                controlRollupsByKey.set(state.controlKey, {
                    controlKey: state.controlKey,
                    controlName: definition.name,
                    severity: definition.severity,
                    applicableNodeCount: 0,
                    directNodeCount: 0,
                    inheritedNodeCount: 0,
                    statusCounts: statusCountsSeed(),
                    worstStatus: 'not_applicable',
                });
            }

            const rollup = controlRollupsByKey.get(state.controlKey);
            rollup.applicableNodeCount += 1;
            if (state.inherited) {
                rollup.inheritedNodeCount += 1;
            } else {
                rollup.directNodeCount += 1;
            }
            rollup.statusCounts[state.status] += 1;
            rollup.worstStatus = calculateWorstStatus([rollup.worstStatus, state.status]);
        });
    });

    return {
        rootNodeId,
        rootScope: clone(rootNode.lineage),
        nodeCount: nodeSummaries.length,
        overallStatus: calculateWorstStatus(nodeSummaries.map(summary => summary.overallStatus)),
        nodeStatusCounts,
        controlRollups: Array.from(controlRollupsByKey.values()).sort((left, right) => left.controlKey.localeCompare(right.controlKey)),
        nodeSummaries,
    };
}

module.exports = {
    ASSESSMENT_SOURCE_TYPES,
    CONTROL_SEVERITIES,
    CONTROL_STATUSES,
    INHERITANCE_MODES,
    ROLLUP_MODEL_STATUSES,
    buildEntityRollupCatalog,
    buildNodeRollupSummary,
    buildPortfolioRollup,
    calculateWorstStatus,
    resolveEffectiveControlStates,
    validateEntityRollupDocument,
};
