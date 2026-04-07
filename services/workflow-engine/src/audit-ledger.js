const { actorsEqual, clone, normaliseActor } = require('./actor-directory');

function parseIso(value) {
    const timestamp = Date.parse(value || '');
    return Number.isNaN(timestamp) ? 0 : timestamp;
}

function compareEntries(left, right) {
    const timestampDelta = parseIso(left.recordedAt) - parseIso(right.recordedAt);
    if (timestampDelta !== 0) {
        return timestampDelta;
    }

    return String(left.ledgerEntryId || '').localeCompare(String(right.ledgerEntryId || ''));
}

function normalizeEvidenceRef(ref) {
    if (!ref || typeof ref !== 'object') {
        return {
            refType: 'unknown',
            refId: 'unknown',
            refHash: null,
        };
    }

    return {
        ...clone(ref),
        refType: ref.refType || 'unknown',
        refId: ref.refId || 'unknown',
        refHash: ref.refHash || null,
    };
}

function dedupeEvidenceRefs(refs = []) {
    const seen = new Set();
    const output = [];

    refs.forEach((ref) => {
        const normalized = normalizeEvidenceRef(ref);
        const key = `${normalized.refType}:${normalized.refId}:${normalized.refHash || ''}`;
        if (seen.has(key)) {
            return;
        }
        seen.add(key);
        output.push(normalized);
    });

    return output;
}

function buildGovernanceSummary(entry) {
    const baseByType = {
        definition_registered: `Registered workflow definition ${entry.workflowKey} v${entry.version}`,
        draft_created: `Created draft workflow version ${entry.workflowKey} v${entry.version}`,
        workflow_published: `Published workflow version ${entry.workflowKey} v${entry.version}`,
        workflow_deprecated: `Deprecated workflow version ${entry.workflowKey} v${entry.version}`,
        workflow_rollback_created: `Created rollback workflow version ${entry.workflowKey} v${entry.version}`,
    };
    const base = baseByType[entry.entryType] || `Recorded governance event ${entry.entryType}`;
    const changeSummary = entry.payload && typeof entry.payload.changeSummary === 'string'
        ? entry.payload.changeSummary.trim()
        : '';

    return changeSummary ? `${base}: ${changeSummary}` : base;
}

function createRuntimeLedgerEntry(instance, entry) {
    return {
        ledgerEntryId: `runtime:${entry.auditEntryId}`,
        sourceType: 'runtime',
        sourceEntryId: entry.auditEntryId,
        workflowKey: instance.workflowKey,
        workflowVersion: instance.workflowVersion,
        instanceId: instance.instanceId,
        stepKey: entry.stepKey || null,
        entryType: entry.entryType,
        recordedAt: entry.recordedAt,
        recordedBy: normaliseActor(entry.recordedBy),
        summary: entry.summary || '',
        payload: clone(entry.payload || {}),
        evidenceRefs: dedupeEvidenceRefs(entry.evidenceRefs || []),
    };
}

function createGovernanceLedgerEntry(entry) {
    return {
        ledgerEntryId: `governance:${entry.historyEntryId}`,
        sourceType: 'governance',
        sourceEntryId: entry.historyEntryId,
        workflowKey: entry.workflowKey,
        workflowVersion: entry.version,
        instanceId: null,
        stepKey: null,
        entryType: entry.entryType,
        recordedAt: entry.recordedAt,
        recordedBy: normaliseActor(entry.recordedBy),
        summary: buildGovernanceSummary(entry),
        payload: clone(entry.payload || {}),
        evidenceRefs: [],
    };
}

function ensureRuntime(runtime) {
    if (!runtime) {
        return null;
    }
    if (typeof runtime.getInstance !== 'function' || typeof runtime.listInstances !== 'function') {
        throw new Error('workflow runtime provider must implement getInstance(instanceId) and listInstances()');
    }
    return runtime;
}

function ensureGovernance(governance) {
    if (!governance) {
        return null;
    }
    if (typeof governance.listChangeHistory !== 'function') {
        throw new Error('workflow governance provider must implement listChangeHistory(filters)');
    }
    return governance;
}

function matchesEntryTypeFilter(filterSet, entryType) {
    if (!filterSet) {
        return true;
    }

    return filterSet.has(entryType);
}

function createWorkflowAuditLedgerService({
    runtime = null,
    governance = null,
} = {}) {
    const resolvedRuntime = ensureRuntime(runtime);
    const resolvedGovernance = ensureGovernance(governance);

    function normalizeEntryTypes(entryTypes = null) {
        if (!Array.isArray(entryTypes) || entryTypes.length === 0) {
            return null;
        }
        return new Set(entryTypes.map(value => String(value)));
    }

    function listRuntimeAuditEntries({
        workflowKey = null,
        workflowVersion = null,
        instanceId = null,
        entryTypes = null,
    } = {}) {
        if (!resolvedRuntime) {
            return [];
        }

        const entryTypeFilter = normalizeEntryTypes(entryTypes);
        const instances = instanceId
            ? [resolvedRuntime.getInstance(instanceId)].filter(Boolean)
            : resolvedRuntime.listInstances();

        return instances
            .filter((instance) => {
                if (workflowKey && instance.workflowKey !== workflowKey) return false;
                if (workflowVersion && instance.workflowVersion !== workflowVersion) return false;
                return true;
            })
            .flatMap(instance => (instance.auditEntries || [])
                .filter(entry => matchesEntryTypeFilter(entryTypeFilter, entry.entryType))
                .map(entry => createRuntimeLedgerEntry(instance, entry)))
            .sort(compareEntries)
            .map(clone);
    }

    function listGovernanceAuditEntries({
        workflowKey = null,
        workflowVersion = null,
        entryTypes = null,
    } = {}) {
        if (!resolvedGovernance) {
            return [];
        }

        const entryTypeFilter = normalizeEntryTypes(entryTypes);
        return resolvedGovernance
            .listChangeHistory({
                workflowKey,
                version: workflowVersion || null,
            })
            .filter(entry => matchesEntryTypeFilter(entryTypeFilter, entry.entryType))
            .map(createGovernanceLedgerEntry)
            .sort(compareEntries)
            .map(clone);
    }

    function resolveInstanceForLedger(instanceId) {
        if (!instanceId || !resolvedRuntime) {
            return null;
        }

        return resolvedRuntime.getInstance(instanceId);
    }

    function listAuditLedger({
        workflowKey = null,
        workflowVersion = null,
        instanceId = null,
        includeRuntime = true,
        includeGovernance = true,
        entryTypes = null,
    } = {}) {
        const instance = resolveInstanceForLedger(instanceId);
        const resolvedWorkflowKey = workflowKey || (instance ? instance.workflowKey : null);
        const resolvedWorkflowVersion = workflowVersion || (instance ? instance.workflowVersion : null);

        const runtimeEntries = includeRuntime
            ? listRuntimeAuditEntries({
                workflowKey: resolvedWorkflowKey,
                workflowVersion: instanceId ? resolvedWorkflowVersion : workflowVersion,
                instanceId,
                entryTypes,
            })
            : [];
        const governanceEntries = includeGovernance
            ? listGovernanceAuditEntries({
                workflowKey: resolvedWorkflowKey,
                workflowVersion: instanceId ? resolvedWorkflowVersion : workflowVersion,
                entryTypes,
            })
            : [];

        return [...runtimeEntries, ...governanceEntries]
            .sort(compareEntries)
            .map(clone);
    }

    function getDecisionHistory(instanceId) {
        if (!resolvedRuntime) {
            throw new Error('workflow runtime provider is required to resolve decision history');
        }

        const instance = resolvedRuntime.getInstance(instanceId);
        if (!instance) {
            return [];
        }

        const decisionAuditMap = new Map();
        const fallbackAuditEntries = [];
        (instance.auditEntries || []).forEach((entry) => {
            if (entry.entryType !== 'approval_recorded') {
                return;
            }

            const decisionRecordId = entry.payload && entry.payload.decisionRecordId;
            if (decisionRecordId) {
                if (!decisionAuditMap.has(decisionRecordId)) {
                    decisionAuditMap.set(decisionRecordId, []);
                }
                decisionAuditMap.get(decisionRecordId).push(entry);
                return;
            }

            fallbackAuditEntries.push(entry);
        });

        const history = [];
        (instance.stepRuns || []).forEach((stepRun) => {
            const session = stepRun.approvalSession;
            if (!session || !Array.isArray(session.rounds)) {
                return;
            }

            session.rounds.forEach((round) => {
                (round.decisions || []).forEach((decisionRecord) => {
                    let linkedAuditEntries = decisionAuditMap.get(decisionRecord.decisionRecordId) || [];
                    if (linkedAuditEntries.length === 0) {
                        linkedAuditEntries = fallbackAuditEntries.filter(entry => (
                            entry.stepKey === stepRun.stepKey
                            && entry.recordedAt === decisionRecord.decidedAt
                            && actorsEqual(entry.recordedBy, decisionRecord.actor)
                            && entry.payload
                            && entry.payload.decision === decisionRecord.decision
                        ));
                    }

                    history.push({
                        decisionRecordId: decisionRecord.decisionRecordId,
                        instanceId: instance.instanceId,
                        workflowKey: instance.workflowKey,
                        workflowVersion: instance.workflowVersion,
                        stepKey: stepRun.stepKey,
                        stepRunId: stepRun.runId,
                        approvalSessionId: session.approvalSessionId,
                        approvalPolicyKey: session.approvalPolicyKey,
                        approvalMode: session.mode,
                        roundId: round.roundId,
                        roundNumber: round.roundNumber,
                        roundType: round.roundType,
                        actor: normaliseActor(decisionRecord.actor),
                        decision: decisionRecord.decision,
                        decidedAt: decisionRecord.decidedAt,
                        notes: decisionRecord.notes || '',
                        payload: clone(decisionRecord.payload || {}),
                        evidenceRefs: dedupeEvidenceRefs(decisionRecord.evidenceRefs || []),
                        linkedAuditEntryIds: linkedAuditEntries.map(entry => entry.auditEntryId),
                        linkedLedgerEntryIds: linkedAuditEntries.map(entry => `runtime:${entry.auditEntryId}`),
                    });
                });
            });
        });

        return history
            .sort((left, right) => {
                const timestampDelta = parseIso(left.decidedAt) - parseIso(right.decidedAt);
                if (timestampDelta !== 0) {
                    return timestampDelta;
                }
                return String(left.decisionRecordId).localeCompare(String(right.decisionRecordId));
            })
            .map(clone);
    }

    function listEvidenceLinks(instanceId) {
        if (!resolvedRuntime) {
            throw new Error('workflow runtime provider is required to resolve evidence links');
        }

        const instance = resolvedRuntime.getInstance(instanceId);
        if (!instance) {
            return [];
        }

        const decisionHistory = getDecisionHistory(instanceId);
        const evidenceIndex = new Map();

        function ensureEvidence(ref) {
            const normalized = normalizeEvidenceRef(ref);
            const key = `${normalized.refType}:${normalized.refId}:${normalized.refHash || ''}`;
            if (!evidenceIndex.has(key)) {
                evidenceIndex.set(key, {
                    refType: normalized.refType,
                    refId: normalized.refId,
                    refHash: normalized.refHash,
                    firstSeenAt: null,
                    lastSeenAt: null,
                    linkedSourceTypes: [],
                    linkedAuditEntryIds: [],
                    linkedLedgerEntryIds: [],
                    linkedDecisionRecordIds: [],
                    linkedStepKeys: [],
                });
            }
            return evidenceIndex.get(key);
        }

        function updateTimestamp(bucket, timestamp) {
            if (!timestamp) {
                return;
            }
            if (!bucket.firstSeenAt || parseIso(timestamp) < parseIso(bucket.firstSeenAt)) {
                bucket.firstSeenAt = timestamp;
            }
            if (!bucket.lastSeenAt || parseIso(timestamp) > parseIso(bucket.lastSeenAt)) {
                bucket.lastSeenAt = timestamp;
            }
        }

        function pushUnique(list, value) {
            if (value === null || value === undefined || value === '') {
                return;
            }
            if (!list.includes(value)) {
                list.push(value);
            }
        }

        (instance.evidenceRefs || []).forEach((ref) => {
            const bucket = ensureEvidence(ref);
            updateTimestamp(bucket, instance.openedAt);
            pushUnique(bucket.linkedSourceTypes, 'instance');
        });

        (instance.auditEntries || []).forEach((entry) => {
            (entry.evidenceRefs || []).forEach((ref) => {
                const bucket = ensureEvidence(ref);
                updateTimestamp(bucket, entry.recordedAt);
                pushUnique(bucket.linkedSourceTypes, 'audit');
                pushUnique(bucket.linkedAuditEntryIds, entry.auditEntryId);
                pushUnique(bucket.linkedLedgerEntryIds, `runtime:${entry.auditEntryId}`);
                pushUnique(bucket.linkedStepKeys, entry.stepKey || null);
            });
        });

        decisionHistory.forEach((decisionRecord) => {
            (decisionRecord.evidenceRefs || []).forEach((ref) => {
                const bucket = ensureEvidence(ref);
                updateTimestamp(bucket, decisionRecord.decidedAt);
                pushUnique(bucket.linkedSourceTypes, 'decision');
                pushUnique(bucket.linkedDecisionRecordIds, decisionRecord.decisionRecordId);
                decisionRecord.linkedAuditEntryIds.forEach(id => pushUnique(bucket.linkedAuditEntryIds, id));
                decisionRecord.linkedLedgerEntryIds.forEach(id => pushUnique(bucket.linkedLedgerEntryIds, id));
                pushUnique(bucket.linkedStepKeys, decisionRecord.stepKey);
            });
        });

        return Array.from(evidenceIndex.values())
            .sort((left, right) => {
                const timestampDelta = parseIso(left.firstSeenAt) - parseIso(right.firstSeenAt);
                if (timestampDelta !== 0) {
                    return timestampDelta;
                }
                return `${left.refType}:${left.refId}`.localeCompare(`${right.refType}:${right.refId}`);
            })
            .map(clone);
    }

    function getInstanceAuditView(instanceId) {
        if (!resolvedRuntime) {
            throw new Error('workflow runtime provider is required to resolve instance audit views');
        }

        const instance = resolvedRuntime.getInstance(instanceId);
        if (!instance) {
            return null;
        }

        const runtimeAuditLedger = listRuntimeAuditEntries({ instanceId });
        const governanceAuditLedger = listGovernanceAuditEntries({
            workflowKey: instance.workflowKey,
            workflowVersion: instance.workflowVersion,
        });
        return {
            instanceId: instance.instanceId,
            workflowKey: instance.workflowKey,
            workflowVersion: instance.workflowVersion,
            runtimeAuditLedger,
            governanceAuditLedger,
            combinedAuditLedger: [...runtimeAuditLedger, ...governanceAuditLedger].sort(compareEntries),
            decisionHistory: getDecisionHistory(instanceId),
            evidenceLinks: listEvidenceLinks(instanceId),
        };
    }

    return {
        getDecisionHistory,
        getInstanceAuditView,
        listAuditLedger,
        listEvidenceLinks,
        listGovernanceAuditEntries,
        listRuntimeAuditEntries,
    };
}

module.exports = {
    createWorkflowAuditLedgerService,
};
