const crypto = require('crypto');
const { normaliseActor, clone } = require('./actor-directory');

const VALID_STATUSES = new Set(['draft', 'published', 'deprecated', 'retired']);
const TERMINAL_GOVERNANCE_EVENTS = new Set([
    'definition_registered',
    'draft_created',
    'workflow_published',
    'workflow_deprecated',
    'workflow_rollback_created',
]);
const SYSTEM_ACTOR = {
    actorType: 'system',
    actorId: 'workflow-governance',
    displayName: 'Workflow Governance',
};

function nowIso(clock) {
    const value = typeof clock === 'function' ? clock() : new Date();
    if (value instanceof Date) {
        return value.toISOString();
    }

    return new Date(value).toISOString();
}

function createHistoryEntryId() {
    return `WFG-${crypto.randomUUID()}`;
}

function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function mergePatch(base, patch) {
    if (!isObject(base) || !isObject(patch)) {
        return clone(patch);
    }

    const output = clone(base);
    Object.entries(patch).forEach(([key, value]) => {
        if (isObject(value) && isObject(output[key])) {
            output[key] = mergePatch(output[key], value);
            return;
        }

        output[key] = clone(value);
    });
    return output;
}

function validateDefinitionShape(definition) {
    if (!definition || typeof definition !== 'object' || Array.isArray(definition)) {
        throw new Error('workflow definition must be an object');
    }
    if (typeof definition.workflowKey !== 'string' || definition.workflowKey.trim() === '') {
        throw new Error('workflow definition must include workflowKey');
    }
    if (!Number.isInteger(definition.version) || definition.version <= 0) {
        throw new Error('workflow definition must include a positive integer version');
    }
    if (!VALID_STATUSES.has(definition.status)) {
        throw new Error(`workflow definition "${definition.workflowKey}" uses unsupported status "${definition.status}"`);
    }
    if (!isObject(definition.publishControls)) {
        throw new Error(`workflow definition "${definition.workflowKey}" must include publishControls`);
    }
    if (typeof definition.publishControls.changeSummary !== 'string' || definition.publishControls.changeSummary.trim() === '') {
        throw new Error(`workflow definition "${definition.workflowKey}" must include publishControls.changeSummary`);
    }
    if (typeof definition.publishControls.approvalRecordRequired !== 'boolean') {
        throw new Error(`workflow definition "${definition.workflowKey}" must include boolean publishControls.approvalRecordRequired`);
    }
}

function createHistoryEntry({ historyIdFactory, workflowKey, version, entryType, actor, payload = {}, clock }) {
    return {
        historyEntryId: historyIdFactory(),
        workflowKey,
        version,
        entryType,
        recordedAt: nowIso(clock),
        recordedBy: normaliseActor(actor || SYSTEM_ACTOR),
        payload: clone(payload),
    };
}

function cloneDefinition(definition) {
    const output = clone(definition);
    output.publishControls = output.publishControls || {};
    return output;
}

function ensureApprovalRecord(definition, approvalRecord) {
    if (!definition.publishControls.approvalRecordRequired) {
        return;
    }

    if (!approvalRecord || typeof approvalRecord !== 'object') {
        throw new Error(`workflow "${definition.workflowKey}" version ${definition.version} requires an approvalRecord`);
    }
    if (typeof approvalRecord.approvalRecordId !== 'string' || approvalRecord.approvalRecordId.trim() === '') {
        throw new Error(`workflow "${definition.workflowKey}" version ${definition.version} requires approvalRecord.approvalRecordId`);
    }
}

function createWorkflowGovernanceService({
    definitions = [],
    clock = () => new Date(),
    historyIdFactory = createHistoryEntryId,
} = {}) {
    const workflows = new Map();
    const history = [];

    function appendHistory(entry) {
        history.push(entry);
    }

    function ensureWorkflowMap(workflowKey) {
        if (!workflows.has(workflowKey)) {
            workflows.set(workflowKey, new Map());
        }
        return workflows.get(workflowKey);
    }

    function listWorkflowKeys() {
        return Array.from(workflows.keys()).sort();
    }

    function getVersionMap(workflowKey) {
        return workflows.get(workflowKey) || null;
    }

    function listWorkflowVersions(workflowKey) {
        const versionMap = getVersionMap(workflowKey);
        if (!versionMap) {
            return [];
        }

        return Array.from(versionMap.values())
            .sort((left, right) => left.version - right.version)
            .map(cloneDefinition);
    }

    function getWorkflowVersion(workflowKey, version) {
        const versionMap = getVersionMap(workflowKey);
        if (!versionMap || !versionMap.has(version)) {
            return null;
        }

        return cloneDefinition(versionMap.get(version));
    }

    function getPublishedWorkflow(workflowKey) {
        const versionMap = getVersionMap(workflowKey);
        if (!versionMap) {
            return null;
        }

        for (const definition of versionMap.values()) {
            if (definition.status === 'published') {
                return cloneDefinition(definition);
            }
        }

        return null;
    }

    function getPublishedDefinitions() {
        return listWorkflowKeys()
            .map(getPublishedWorkflow)
            .filter(Boolean);
    }

    function listChangeHistory({ workflowKey = null, version = null } = {}) {
        return history
            .filter((entry) => {
                if (workflowKey && entry.workflowKey !== workflowKey) return false;
                if (version && entry.version !== version) return false;
                return true;
            })
            .map(clone);
    }

    function registerDefinition(definition, { actor = SYSTEM_ACTOR, entryType = 'definition_registered', payload = {} } = {}) {
        validateDefinitionShape(definition);
        if (!TERMINAL_GOVERNANCE_EVENTS.has(entryType)) {
            throw new Error(`unsupported governance history entryType "${entryType}"`);
        }

        const normalized = cloneDefinition(definition);
        const versionMap = ensureWorkflowMap(normalized.workflowKey);
        if (versionMap.has(normalized.version)) {
            throw new Error(`workflow "${normalized.workflowKey}" version ${normalized.version} already exists`);
        }

        versionMap.set(normalized.version, normalized);
        appendHistory(createHistoryEntry({
            historyIdFactory,
            workflowKey: normalized.workflowKey,
            version: normalized.version,
            entryType,
            actor,
            payload: {
                status: normalized.status,
                changeSummary: normalized.publishControls.changeSummary,
                ...payload,
            },
            clock,
        }));

        return cloneDefinition(normalized);
    }

    function createDraftVersion(workflowKey, {
        sourceVersion,
        actor = SYSTEM_ACTOR,
        changeSummary,
        definitionPatch = {},
        approvalRecordRequired = undefined,
    } = {}) {
        const source = getWorkflowVersion(workflowKey, sourceVersion);
        if (!source) {
            throw new Error(`workflow "${workflowKey}" version ${sourceVersion} was not found`);
        }
        if (typeof changeSummary !== 'string' || changeSummary.trim() === '') {
            throw new Error('changeSummary is required to create a draft version');
        }

        const nextVersion = Math.max(...listWorkflowVersions(workflowKey).map(item => item.version)) + 1;
        const patched = mergePatch(source, definitionPatch || {});
        patched.workflowKey = workflowKey;
        patched.version = nextVersion;
        patched.status = 'draft';
        patched.publishControls = patched.publishControls || {};
        patched.publishControls.changeSummary = changeSummary;
        if (!Object.prototype.hasOwnProperty.call(patched.publishControls, 'rollbackOfVersion')) {
            patched.publishControls.rollbackOfVersion = undefined;
        }
        delete patched.publishControls.publishedAt;
        if (typeof approvalRecordRequired === 'boolean') {
            patched.publishControls.approvalRecordRequired = approvalRecordRequired;
        }

        return registerDefinition(patched, {
            actor,
            entryType: 'draft_created',
            payload: {
                sourceVersion,
            },
        });
    }

    function publishWorkflowVersion(workflowKey, version, { actor = SYSTEM_ACTOR, approvalRecord = null } = {}) {
        const versionMap = getVersionMap(workflowKey);
        if (!versionMap || !versionMap.has(version)) {
            throw new Error(`workflow "${workflowKey}" version ${version} was not found`);
        }

        const target = versionMap.get(version);
        ensureApprovalRecord(target, approvalRecord);

        const publishedAt = nowIso(clock);
        versionMap.forEach((definition, candidateVersion) => {
            if (candidateVersion === version) {
                return;
            }
            if (definition.status === 'published') {
                definition.status = 'deprecated';
                definition.replacedByVersion = version;
                appendHistory(createHistoryEntry({
                    historyIdFactory,
                    workflowKey,
                    version: definition.version,
                    entryType: 'workflow_deprecated',
                    actor,
                    payload: {
                        replacedByVersion: version,
                    },
                    clock,
                }));
            }
        });

        target.status = 'published';
        target.publishedAt = publishedAt;
        target.publishControls.publishedAt = publishedAt;
        appendHistory(createHistoryEntry({
            historyIdFactory,
            workflowKey,
            version,
            entryType: 'workflow_published',
            actor,
            payload: {
                approvalRecord: approvalRecord ? clone(approvalRecord) : null,
                changeSummary: target.publishControls.changeSummary,
            },
            clock,
        }));

        return cloneDefinition(target);
    }

    function rollbackWorkflowVersion(workflowKey, targetVersion, {
        actor = SYSTEM_ACTOR,
        changeSummary,
        approvalRecord = null,
    } = {}) {
        const target = getWorkflowVersion(workflowKey, targetVersion);
        if (!target) {
            throw new Error(`workflow "${workflowKey}" version ${targetVersion} was not found`);
        }

        const summary = typeof changeSummary === 'string' && changeSummary.trim() !== ''
            ? changeSummary
            : `Rollback to version ${targetVersion}`;

        const draft = createDraftVersion(workflowKey, {
            sourceVersion: targetVersion,
            actor,
            changeSummary: summary,
            definitionPatch: {
                publishControls: {
                    rollbackOfVersion: targetVersion,
                },
            },
        });

        appendHistory(createHistoryEntry({
            historyIdFactory,
            workflowKey,
            version: draft.version,
            entryType: 'workflow_rollback_created',
            actor,
            payload: {
                rollbackOfVersion: targetVersion,
            },
            clock,
        }));

        return publishWorkflowVersion(workflowKey, draft.version, {
            actor,
            approvalRecord,
        });
    }

    definitions.forEach((definition) => {
        registerDefinition(definition);
    });

    return {
        createDraftVersion,
        getPublishedDefinitions,
        getPublishedWorkflow,
        getWorkflowVersion,
        listChangeHistory,
        listWorkflowKeys,
        listWorkflowVersions,
        publishWorkflowVersion,
        registerDefinition,
        rollbackWorkflowVersion,
    };
}

module.exports = {
    SYSTEM_ACTOR,
    createWorkflowGovernanceService,
};
