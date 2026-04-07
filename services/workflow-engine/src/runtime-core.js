const crypto = require('crypto');
const {
    actorKey,
    actorsEqual,
    createInMemoryActorDirectory,
    dedupeActors,
    ensureActorDirectory,
    normaliseActor,
    normaliseSelector,
    selectorsFromAssignmentRule,
} = require('./actor-directory');

const TERMINAL_INSTANCE_STATES = new Set(['completed', 'canceled', 'rolled_back']);
const VALID_EVENT_TYPES = new Set([
    'cdc.violation.detected',
    'nlp.drift.detected',
    'nlp.obligation.triggered',
    'cv.violation.detected',
    'sentinel.regulatory_update.detected',
    'workflow.manual.triggered',
]);
const VALID_SOURCE_FAMILIES = new Set(['cdc', 'nlp', 'cv', 'sentinel', 'manual']);
const VALID_SEVERITIES = new Set(['critical', 'high', 'medium', 'low', 'info']);
const VALID_MATCH_OPERATORS = new Set(['equals', 'not_equals', 'in', 'gte', 'lte', 'contains', 'exists']);
const APPROVAL_DECISIONS = new Set(['approve', 'reject']);
const STEP_STATE_BY_TYPE = {
    approve: 'waiting_approval',
    wait_timer: 'waiting_external',
};
const INSTANCE_STATE_BY_TYPE = {
    approve: 'waiting_approval',
    wait_timer: 'waiting_external',
};
const SYSTEM_ACTOR = {
    actorType: 'system',
    actorId: 'workflow-engine',
    displayName: 'Workflow Engine',
};

function clone(value) {
    return structuredClone(value);
}

function nowIso(clock) {
    const value = typeof clock === 'function' ? clock() : new Date();
    if (value instanceof Date) {
        return value.toISOString();
    }

    return new Date(value).toISOString();
}

function normaliseIso(value, fallbackClock = () => new Date()) {
    if (value === undefined || value === null) {
        return nowIso(fallbackClock);
    }

    const normalized = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(normalized.getTime())) {
        throw new Error(`invalid timestamp "${value}"`);
    }

    return normalized.toISOString();
}

function createFixedClock(atIso) {
    return () => new Date(atIso);
}

function createInstanceId() {
    return `WFI-${crypto.randomUUID()}`;
}

function createAuditEntryId() {
    return `WFA-${crypto.randomUUID()}`;
}

function createAssignmentId() {
    return `WFS-${crypto.randomUUID()}`;
}

function createApprovalSessionId() {
    return `WFP-${crypto.randomUUID()}`;
}

function createApprovalRoundId() {
    return `WFR-${crypto.randomUUID()}`;
}

function createApprovalDecisionId() {
    return `WFD-${crypto.randomUUID()}`;
}

function getValueAtPath(target, path) {
    if (!path) return undefined;
    return String(path)
        .split('.')
        .reduce((current, key) => (current === undefined || current === null ? undefined : current[key]), target);
}

function matchRule(event, rule) {
    const actualValue = getValueAtPath(event, rule.field);

    if (!VALID_MATCH_OPERATORS.has(rule.operator)) {
        return false;
    }

    switch (rule.operator) {
        case 'equals':
            return actualValue === rule.value;
        case 'not_equals':
            return actualValue !== rule.value;
        case 'in':
            return Array.isArray(rule.value) && rule.value.includes(actualValue);
        case 'gte':
            return actualValue >= rule.value;
        case 'lte':
            return actualValue <= rule.value;
        case 'contains':
            if (typeof actualValue === 'string') {
                return actualValue.includes(String(rule.value));
            }
            if (Array.isArray(actualValue)) {
                return actualValue.includes(rule.value);
            }
            return false;
        case 'exists':
            return rule.value === false ? actualValue === undefined : actualValue !== undefined;
        default:
            return false;
    }
}

function validateNormalizedEvent(event) {
    const errors = [];
    const requiredFields = ['eventId', 'idempotencyKey', 'eventType', 'sourceFamily', 'occurredAt', 'ingestedAt', 'severity', 'entityScope', 'correlation', 'payload'];

    if (!event || typeof event !== 'object' || Array.isArray(event)) {
        return ['event must be an object'];
    }

    requiredFields.forEach((field) => {
        if (!(field in event)) {
            errors.push(`missing required event field "${field}"`);
        }
    });

    if (typeof event.eventId !== 'string' || event.eventId.trim() === '') {
        errors.push('eventId must be a non-empty string');
    }

    if (typeof event.idempotencyKey !== 'string' || event.idempotencyKey.trim() === '') {
        errors.push('idempotencyKey must be a non-empty string');
    }

    if (!VALID_EVENT_TYPES.has(event.eventType)) {
        errors.push(`eventType "${event.eventType}" is unsupported`);
    }

    if (!VALID_SOURCE_FAMILIES.has(event.sourceFamily)) {
        errors.push(`sourceFamily "${event.sourceFamily}" is unsupported`);
    }

    if (!VALID_SEVERITIES.has(event.severity)) {
        errors.push(`severity "${event.severity}" is unsupported`);
    }

    if (event.sourceFamily === 'manual' && (!event.actor || typeof event.actor !== 'object')) {
        errors.push('manual events must include actor');
    }

    if (['cdc', 'nlp', 'sentinel'].includes(event.sourceFamily) && (!event.authority || typeof event.authority !== 'string')) {
        errors.push(`authority is required for sourceFamily "${event.sourceFamily}"`);
    }

    if (!event.entityScope || typeof event.entityScope !== 'object' || Array.isArray(event.entityScope)) {
        errors.push('entityScope must be an object');
    }

    if (!event.correlation || typeof event.correlation !== 'object' || Array.isArray(event.correlation)) {
        errors.push('correlation must be an object');
    }

    if (!event.payload || typeof event.payload !== 'object' || Array.isArray(event.payload)) {
        errors.push('payload must be an object');
    }

    return errors;
}

function normaliseDefinition(definition) {
    if (!definition || typeof definition !== 'object' || Array.isArray(definition)) {
        throw new Error('workflow definition must be an object');
    }

    if (typeof definition.workflowKey !== 'string' || definition.workflowKey.trim() === '') {
        throw new Error('workflow definition must include workflowKey');
    }

    if (!Array.isArray(definition.steps) || definition.steps.length === 0) {
        throw new Error(`[${definition.workflowKey}] workflow definition must include steps`);
    }

    if (!Array.isArray(definition.triggers) || definition.triggers.length === 0) {
        throw new Error(`[${definition.workflowKey}] workflow definition must include triggers`);
    }

    const copy = clone(definition);
    copy.stepsByKey = Object.fromEntries(copy.steps.map(step => [step.stepKey, step]));
    copy.stepsOrdered = [...copy.steps].sort((left, right) => left.order - right.order);
    copy.approvalPoliciesByKey = Object.fromEntries((copy.approvalPolicies || []).map(policy => [policy.approvalPolicyKey, policy]));
    copy.slaPoliciesByKey = Object.fromEntries((copy.slaPolicies || []).map(policy => [policy.slaPolicyKey, policy]));
    copy.escalationPoliciesByKey = Object.fromEntries((copy.escalationPolicies || []).map(policy => [policy.escalationPolicyKey, policy]));

    if (!copy.stepsByKey[copy.entryStepKey]) {
        throw new Error(`[${definition.workflowKey}] entryStepKey "${copy.entryStepKey}" does not exist`);
    }

    return copy;
}

function currentStepStateFor(stepType) {
    return STEP_STATE_BY_TYPE[stepType] || 'in_progress';
}

function currentInstanceStateFor(stepType) {
    return INSTANCE_STATE_BY_TYPE[stepType] || 'active';
}

function createAuditEntry(instance, { entryType, actor, stepKey = null, summary, payload = {}, evidenceRefs = [], clock, auditIdFactory }) {
    return {
        auditEntryId: auditIdFactory(),
        instanceId: instance.instanceId,
        stepKey,
        entryType,
        recordedAt: nowIso(clock),
        recordedBy: normaliseActor(actor),
        summary,
        payload,
        evidenceRefs: clone(evidenceRefs),
    };
}

function addAudit(instance, entry) {
    instance.auditEntries.push(entry);
}

function deriveDueAt(definition, step, clock) {
    if (!step.slaPolicyRef) return null;
    const policy = definition.slaPoliciesByKey[step.slaPolicyRef];
    if (!policy || !Number.isInteger(policy.targetDurationMinutes) || policy.targetDurationMinutes <= 0) {
        return null;
    }

    const dueAt = new Date(nowIso(clock));
    dueAt.setMinutes(dueAt.getMinutes() + policy.targetDurationMinutes);
    return dueAt.toISOString();
}

function findSlaPolicy(instance, step) {
    if (!step.slaPolicyRef) {
        return null;
    }

    return instance.definitionSnapshot.slaPoliciesByKey[step.slaPolicyRef] || null;
}

function shouldPauseSla(slaState, instanceState, runState) {
    const pauseStates = new Set(slaState.pauseStates || []);
    return pauseStates.has(instanceState) || pauseStates.has(runState);
}

function buildSlaState(definition, step, instanceState, runState, clock) {
    if (!step.slaPolicyRef) {
        return null;
    }

    const policy = definition.slaPoliciesByKey[step.slaPolicyRef];
    if (!policy) {
        return null;
    }

    const openedAt = nowIso(clock);
    const pauseStates = clone(policy.pauseStates || []);
    const reminderSchedule = [...new Set((policy.reminderIntervalsMinutes || []).filter(Number.isInteger))].sort((left, right) => left - right).map(intervalMinutes => ({
        intervalMinutes,
        sentAt: null,
    }));
    const paused = pauseStates.includes(instanceState) || pauseStates.includes(runState);

    return {
        slaPolicyKey: policy.slaPolicyKey,
        status: 'tracking',
        openedAt,
        lastEvaluatedAt: null,
        warningDurationMinutes: Number.isInteger(policy.warningDurationMinutes) ? policy.warningDurationMinutes : null,
        targetDurationMinutes: Number.isInteger(policy.targetDurationMinutes) ? policy.targetDurationMinutes : null,
        breachDurationMinutes: Number.isInteger(policy.breachDurationMinutes) ? policy.breachDurationMinutes : null,
        breachSeverityOverride: policy.breachSeverityOverride || null,
        pauseStates,
        reminderSchedule,
        warningRecordedAt: null,
        breachRecordedAt: null,
        completedAt: null,
        pausedAt: paused ? openedAt : null,
        totalPausedMs: 0,
        pauseWindows: paused ? [{ startedAt: openedAt, resumedAt: null }] : [],
        executedEscalations: [],
    };
}

function closeSlaPauseWindow(slaState, atIso) {
    if (!slaState || !slaState.pausedAt) {
        return;
    }

    const pausedAtMs = new Date(slaState.pausedAt).getTime();
    const resumedAtMs = new Date(atIso).getTime();
    if (resumedAtMs > pausedAtMs) {
        slaState.totalPausedMs += resumedAtMs - pausedAtMs;
    }

    const activeWindow = slaState.pauseWindows.find(window => window && window.startedAt === slaState.pausedAt && window.resumedAt === null);
    if (activeWindow) {
        activeWindow.resumedAt = atIso;
    }

    slaState.pausedAt = null;
}

function syncSlaPauseState(currentRun, instanceState, atIso) {
    const slaState = currentRun && currentRun.slaState;
    if (!slaState || ['completed', 'escalated'].includes(slaState.status)) {
        return;
    }

    const paused = shouldPauseSla(slaState, instanceState, currentRun.state);
    if (paused && !slaState.pausedAt) {
        slaState.pausedAt = atIso;
        slaState.pauseWindows.push({
            startedAt: atIso,
            resumedAt: null,
        });
    } else if (!paused && slaState.pausedAt) {
        closeSlaPauseWindow(slaState, atIso);
    }

    slaState.lastEvaluatedAt = atIso;
}

function getSlaElapsedMinutes(slaState, atIso) {
    if (!slaState) {
        return 0;
    }

    const openedAtMs = new Date(slaState.openedAt).getTime();
    const currentMs = new Date(atIso).getTime();
    const openPauseMs = slaState.pausedAt ? Math.max(0, currentMs - new Date(slaState.pausedAt).getTime()) : 0;
    const elapsedMs = Math.max(0, currentMs - openedAtMs - slaState.totalPausedMs - openPauseMs);
    return elapsedMs / 60000;
}

function finalizeSlaState(currentRun, atIso, status = 'completed') {
    if (!currentRun || !currentRun.slaState) {
        return;
    }

    closeSlaPauseWindow(currentRun.slaState, atIso);
    currentRun.slaState.status = status;
    currentRun.slaState.completedAt = atIso;
    currentRun.slaState.lastEvaluatedAt = atIso;
}

function getCurrentRun(instance) {
    return instance.stepRuns.find(run => run.runId === instance.currentStepRunId) || null;
}

function assertAdvancableInstance(instance) {
    if (!instance) {
        throw new Error('workflow instance not found');
    }

    if (TERMINAL_INSTANCE_STATES.has(instance.state)) {
        throw new Error(`workflow instance ${instance.instanceId} is already terminal with state "${instance.state}"`);
    }
}

function attachEvidence(instance, currentRun, evidenceRefs, { actor, clock, auditIdFactory }) {
    if (!Array.isArray(evidenceRefs) || evidenceRefs.length === 0) {
        return;
    }

    const existingKeys = new Set(instance.evidenceRefs.map(ref => `${ref.refType}:${ref.refId}:${ref.refHash || ''}`));
    const newRefs = [];

    evidenceRefs.forEach((ref) => {
        if (!ref || typeof ref !== 'object') return;
        const dedupeKey = `${ref.refType}:${ref.refId}:${ref.refHash || ''}`;
        if (existingKeys.has(dedupeKey)) return;
        existingKeys.add(dedupeKey);
        newRefs.push(clone(ref));
    });

    if (newRefs.length === 0) {
        return;
    }

    instance.evidenceRefs.push(...newRefs);
    currentRun.evidenceRefs.push(...newRefs);
    addAudit(instance, createAuditEntry(instance, {
        entryType: 'evidence_attached',
        actor,
        stepKey: currentRun.stepKey,
        summary: `Attached ${newRefs.length} evidence reference(s)`,
        evidenceRefs: newRefs,
        clock,
        auditIdFactory,
    }));
}

function getDefinitionSnapshot(instance) {
    return {
        workflowKey: instance.workflowKey,
        version: instance.workflowVersion,
        stepsByKey: instance.definitionSnapshot.stepsByKey,
        approvalPoliciesByKey: instance.definitionSnapshot.approvalPoliciesByKey,
        slaPoliciesByKey: instance.definitionSnapshot.slaPoliciesByKey,
        escalationPoliciesByKey: instance.definitionSnapshot.escalationPoliciesByKey,
    };
}

function createResolutionContext(instance, step, policy = null) {
    return {
        instanceId: instance.instanceId,
        workflowKey: instance.workflowKey,
        stepKey: step.stepKey,
        stepType: step.stepType,
        entityScope: clone(instance.entityScope || {}),
        authority: instance.authority || null,
        sourceFamily: instance.sourceFamily,
        approvalPolicyKey: policy ? policy.approvalPolicyKey : null,
    };
}

function mapSelectorsToAssignments(actorDirectory, selectors, context, { assignmentType, clock, delegatedBy = null, reason = null }) {
    const normalizedSelectors = (selectors || []).map(normaliseSelector);
    const assignments = [];
    const seen = new Set();

    normalizedSelectors.forEach((selector) => {
        const resolvedActors = dedupeActors((actorDirectory.resolveSelectors([selector], context) || []).map(normaliseActor));
        resolvedActors.forEach((actor) => {
            const key = actorKey(actor);
            if (seen.has(key)) {
                return;
            }
            seen.add(key);
            assignments.push({
                assignmentId: createAssignmentId(),
                actor,
                selectorType: selector.type,
                selectorValue: selector.value,
                assignmentType,
                assignmentState: 'active',
                delegatedBy: delegatedBy ? normaliseActor(delegatedBy) : null,
                assignedAt: nowIso(clock),
                reason: reason || null,
            });
        });
    });

    return assignments;
}

function deriveQueueOwnership(step, assignments) {
    const selectors = selectorsFromAssignmentRule(step.assignmentRule);
    const queueSelector = selectors.find(selector => selector.type === 'queue');
    if (queueSelector) {
        return queueSelector.value;
    }

    const queueAssignment = (assignments || []).find(entry => entry.selectorType === 'queue' || entry.actor.actorType === 'queue');
    return queueAssignment ? queueAssignment.actor.actorId : null;
}

function resolveStepAssignments(instance, step, actorDirectory, clock) {
    const selectors = selectorsFromAssignmentRule(step.assignmentRule);
    if (selectors.length === 0) {
        return [];
    }

    return mapSelectorsToAssignments(
        actorDirectory,
        selectors,
        createResolutionContext(instance, step),
        {
            assignmentType: step.stepType === 'approve' ? 'approver' : 'assignee',
            clock,
        }
    );
}

function defaultMakerCheckerScope(policy) {
    if (policy && policy.makerCheckerScope && typeof policy.makerCheckerScope === 'object') {
        return clone(policy.makerCheckerScope);
    }

    const segregation = policy && policy.segregationOfDuties && typeof policy.segregationOfDuties === 'object'
        ? policy.segregationOfDuties
        : {};

    return {
        blockInstanceOriginActor: Boolean(segregation.disallowSubmitterApproval),
        blockTriggerActor: Boolean(segregation.disallowSubmitterApproval),
    };
}

function findApprovalPolicy(instance, step) {
    if (!step.approvalPolicyRef) {
        return null;
    }

    return instance.definitionSnapshot.approvalPoliciesByKey[step.approvalPolicyRef] || null;
}

function getActiveApprovalRound(session) {
    if (!session) {
        return null;
    }

    return session.rounds.find(round => round.roundId === session.activeRoundId) || null;
}

function buildApprovalRound(instance, step, policy, actorDirectory, clock, {
    selectors = policy.approverSelectors,
    roundNumber = 1,
    roundType = policy.mode === 'parallel_committee' ? 'committee' : 'primary',
    delegatedBy = null,
    reason = null,
} = {}) {
    const assignments = mapSelectorsToAssignments(
        actorDirectory,
        selectors || [],
        createResolutionContext(instance, step, policy),
        {
            assignmentType: roundType === 'committee' ? 'committee_member' : 'approver',
            clock,
            delegatedBy,
            reason,
        }
    );

    return {
        roundId: createApprovalRoundId(),
        roundNumber,
        roundType,
        status: 'open',
        selectors: clone((selectors || []).map(normaliseSelector)),
        assignments,
        decisions: [],
        openedAt: nowIso(clock),
        closedAt: null,
        minimumApprovals: policy.minimumApprovals || 1,
        quorumMode: policy.quorumMode || 'fixed',
        rejectionMode: policy.rejectionMode || (policy.mode === 'parallel_committee' ? 'quorum_impossible' : 'first_rejection'),
    };
}

function buildApprovalSession(instance, step, policy, actorDirectory, clock) {
    const primaryRound = buildApprovalRound(instance, step, policy, actorDirectory, clock);
    return {
        approvalSessionId: createApprovalSessionId(),
        approvalPolicyKey: policy.approvalPolicyKey,
        mode: policy.mode,
        status: 'open',
        openedAt: nowIso(clock),
        closedAt: null,
        quorumMode: policy.quorumMode || 'fixed',
        rejectionMode: policy.rejectionMode || (policy.mode === 'parallel_committee' ? 'quorum_impossible' : 'first_rejection'),
        minimumApprovals: policy.minimumApprovals || 1,
        delegateSelectors: clone((policy.delegateSelectors || []).map(normaliseSelector)),
        committeeSelectors: clone((policy.committeeSelectors || []).map(normaliseSelector)),
        makerCheckerScope: defaultMakerCheckerScope(policy),
        rounds: [primaryRound],
        activeRoundId: primaryRound.roundId,
    };
}

function syncCurrentRunAssignments(currentRun) {
    currentRun.assignedTo = currentRun.assignments[0] ? clone(currentRun.assignments[0].actor) : null;
}

function activateStep(instance, definition, stepKey, { actor, clock, auditIdFactory, actorDirectory }) {
    const step = definition.stepsByKey[stepKey];
    const attempt = instance.stepRuns.filter(run => run.stepKey === stepKey).length + 1;
    const run = {
        runId: `${instance.instanceId}:${stepKey}:${attempt}`,
        instanceId: instance.instanceId,
        stepKey,
        attempt,
        state: currentStepStateFor(step.stepType),
        assignedTo: null,
        assignments: [],
        approvalSession: null,
        slaState: null,
        dueAt: deriveDueAt(definition, step, clock),
        openedAt: nowIso(clock),
        completedAt: null,
        completedBy: null,
        reminderCount: 0,
        notes: '',
        payload: {},
        evidenceRefs: [],
    };

    instance.currentStepKey = stepKey;
    instance.currentStepRunId = run.runId;
    instance.state = currentInstanceStateFor(step.stepType);
    run.slaState = buildSlaState(definition, step, instance.state, run.state, clock);

    const assignments = resolveStepAssignments(instance, step, actorDirectory, clock);
    if (assignments.length > 0) {
        run.assignments = assignments;
        syncCurrentRunAssignments(run);
        const owningQueue = deriveQueueOwnership(step, assignments);
        if (owningQueue) {
            instance.owningQueue = owningQueue;
        }
    }

    if (step.stepType === 'approve') {
        const policy = findApprovalPolicy(instance, step);
        if (!policy) {
            throw new Error(`step "${step.stepKey}" references missing approvalPolicyRef "${step.approvalPolicyRef}"`);
        }
        run.approvalSession = buildApprovalSession(instance, step, policy, actorDirectory, clock);
        run.assignments = clone(getActiveApprovalRound(run.approvalSession).assignments);
        syncCurrentRunAssignments(run);
    }

    instance.stepRuns.push(run);
    addAudit(instance, createAuditEntry(instance, {
        entryType: 'step_started',
        actor,
        stepKey,
        summary: `Started step "${step.name}"`,
        payload: {
            stepType: step.stepType,
            actionType: step.actionType,
            attempt,
        },
        clock,
        auditIdFactory,
    }));

    if (run.assignments.length > 0) {
        addAudit(instance, createAuditEntry(instance, {
            entryType: 'assignment_resolved',
            actor,
            stepKey,
            summary: `Resolved ${run.assignments.length} assignment(s) for step "${step.name}"`,
            payload: {
                assignments: clone(run.assignments),
            },
            clock,
            auditIdFactory,
        }));
    }

    if (step.stepType === 'approve') {
        const session = run.approvalSession;
        const round = getActiveApprovalRound(session);
        addAudit(instance, createAuditEntry(instance, {
            entryType: 'approval_requested',
            actor,
            stepKey,
            summary: `Approval requested for step "${step.name}"`,
            payload: {
                approvalSessionId: session.approvalSessionId,
                approvalPolicyRef: step.approvalPolicyRef,
                mode: session.mode,
                roundId: round.roundId,
                minimumApprovals: session.minimumApprovals,
            },
            clock,
            auditIdFactory,
        }));

        if (session.mode === 'parallel_committee' || round.roundType === 'committee') {
            addAudit(instance, createAuditEntry(instance, {
                entryType: 'committee_round_opened',
                actor,
                stepKey,
                summary: `Opened committee round ${round.roundNumber} for step "${step.name}"`,
                payload: {
                    approvalSessionId: session.approvalSessionId,
                    roundId: round.roundId,
                    roundNumber: round.roundNumber,
                    minimumApprovals: round.minimumApprovals,
                    assignments: clone(round.assignments),
                },
                clock,
                auditIdFactory,
            }));
        }
    }

    return run;
}

function finishInstance(instance, outcome, { actor, clock, auditIdFactory }) {
    instance.state = 'completed';
    instance.closedAt = nowIso(clock);
    instance.currentStepKey = null;
    instance.currentStepRunId = null;

    addAudit(instance, createAuditEntry(instance, {
        entryType: 'instance_completed',
        actor,
        summary: `Completed workflow instance ${instance.instanceId}`,
        payload: {
            finalOutcome: outcome,
        },
        clock,
        auditIdFactory,
    }));
}

function transitionFromCurrentStep(instance, definition, currentStep, currentRun, {
    outcome,
    actor,
    notes = '',
    payload = {},
    evidenceRefs = [],
    clock,
    auditIdFactory,
    actorDirectory,
    completionEntryType = 'step_completed',
    completionSummaryPrefix = 'Completed step',
}) {
    if (!(outcome in currentStep.transitions)) {
        throw new Error(`outcome "${outcome}" is invalid for step "${currentStep.stepKey}"`);
    }

    attachEvidence(instance, currentRun, evidenceRefs, {
        actor,
        clock,
        auditIdFactory,
    });

    currentRun.state = 'completed';
    currentRun.completedAt = nowIso(clock);
    currentRun.completedBy = normaliseActor(actor);
    currentRun.notes = notes || '';
    currentRun.payload = clone(payload || {});
    finalizeSlaState(currentRun, currentRun.completedAt, 'completed');

    addAudit(instance, createAuditEntry(instance, {
        entryType: completionEntryType,
        actor,
        stepKey: currentStep.stepKey,
        summary: `${completionSummaryPrefix} "${currentStep.name}" via outcome "${outcome}"`,
        payload: {
            outcome,
            notes,
            ...payload,
        },
        evidenceRefs,
        clock,
        auditIdFactory,
    }));

    const targetStepKey = currentStep.transitions[outcome];
    if (targetStepKey === null) {
        finishInstance(instance, outcome, {
            actor,
            clock,
            auditIdFactory,
        });
        return;
    }

    activateStep(instance, definition, targetStepKey, {
        actor,
        clock,
        auditIdFactory,
        actorDirectory,
    });
}

function countDecisions(round, decision) {
    return round.decisions.filter(item => item.decision === decision).length;
}

function roundHasDecision(round, actor) {
    return round.decisions.some(entry => actorsEqual(entry.actor, actor));
}

function findRoundAssignment(round, actor) {
    return round.assignments.find(entry => entry.assignmentState === 'active' && actorsEqual(entry.actor, actor)) || null;
}

function isMakerCheckerBlocked(instance, session, actor) {
    const scope = session.makerCheckerScope || {};
    if (scope.blockInstanceOriginActor && actorsEqual(instance.originActor, actor)) {
        return true;
    }
    if (scope.blockTriggerActor && actorsEqual(instance.triggerActor, actor)) {
        return true;
    }
    return false;
}

function evaluateApprovalSession(session) {
    const round = getActiveApprovalRound(session);
    if (!round) {
        return { status: 'open', outcome: null };
    }

    if (session.mode === 'parallel_committee' || round.roundType === 'committee') {
        const approvals = countDecisions(round, 'approve');
        const decidedActors = new Set(round.decisions.map(entry => actorKey(entry.actor)));
        const remainingEligible = round.assignments.filter(entry => entry.assignmentState === 'active' && !decidedActors.has(actorKey(entry.actor))).length;

        if (approvals >= round.minimumApprovals) {
            return { status: 'approved', outcome: 'onApprove' };
        }

        if (approvals + remainingEligible < round.minimumApprovals) {
            return { status: 'rejected', outcome: 'onReject' };
        }

        return { status: 'open', outcome: null };
    }

    const lastDecision = round.decisions[round.decisions.length - 1];
    if (!lastDecision) {
        return { status: 'open', outcome: null };
    }

    if (lastDecision.decision === 'approve') {
        return { status: 'approved', outcome: 'onApprove' };
    }

    return { status: 'rejected', outcome: 'onReject' };
}

function hasExecutedEscalation(slaState, escalationPolicyKey, triggerCondition) {
    return (slaState.executedEscalations || []).some(entry => entry.escalationPolicyKey === escalationPolicyKey && entry.triggerCondition === triggerCondition);
}

function recordExecutedEscalation(slaState, escalationPolicyKey, triggerCondition, executedAt) {
    slaState.executedEscalations.push({
        escalationPolicyKey,
        triggerCondition,
        executedAt,
    });
}

function resolveEscalationTargets(actorDirectory, escalationPolicy, instance, currentStep) {
    if (!escalationPolicy || escalationPolicy.targetType === 'webhook') {
        return [];
    }

    return dedupeActors((actorDirectory.resolveSelectors([
        {
            type: escalationPolicy.targetType,
            value: escalationPolicy.targetRef,
        },
    ], createResolutionContext(instance, currentStep)) || []).map(normaliseActor));
}

function applySeverityOverride(instance, severityOverride) {
    if (severityOverride) {
        instance.severity = severityOverride;
    }
}

function completeCurrentRunByEscalation(instance, definition, currentStep, currentRun, {
    actor,
    atIso,
    targetStepKey,
    reason,
    auditIdFactory,
    actorDirectory,
}) {
    if (currentRun.approvalSession) {
        currentRun.approvalSession.status = 'escalated';
        currentRun.approvalSession.closedAt = atIso;
        const round = getActiveApprovalRound(currentRun.approvalSession);
        if (round && round.status === 'open') {
            round.status = 'escalated';
            round.closedAt = atIso;
        }
    }

    currentRun.state = 'completed';
    currentRun.completedAt = atIso;
    currentRun.completedBy = normaliseActor(actor);
    currentRun.notes = reason || '';
    finalizeSlaState(currentRun, atIso, 'escalated');

    addAudit(instance, createAuditEntry(instance, {
        entryType: 'step_completed',
        actor,
        stepKey: currentStep.stepKey,
        summary: `Completed step "${currentStep.name}" via automated escalation`,
        payload: {
            outcome: 'escalation_override',
            targetStepKey,
            reason: reason || null,
        },
        clock: createFixedClock(atIso),
        auditIdFactory,
    }));

    activateStep(instance, definition, targetStepKey, {
        actor,
        clock: createFixedClock(atIso),
        auditIdFactory,
        actorDirectory,
    });
}

function createWorkflowExecutionService({
    definitions = [],
    clock = () => new Date(),
    instanceIdFactory = createInstanceId,
    auditIdFactory = createAuditEntryId,
    actorDirectory = createInMemoryActorDirectory(),
    logger = null,
} = {}) {
    const resolvedActorDirectory = ensureActorDirectory(actorDirectory);
    const definitionsByKey = new Map();
    const instancesById = new Map();
    const idempotencyIndex = new Map();

    const emit = (level, event, fields = {}) => {
        if (!logger || typeof logger[level] !== 'function') {
            return;
        }
        logger[level](event, fields);
    };

    function openCommitteeEscalation(instance, currentStep, currentRun, { actor = SYSTEM_ACTOR, reason = 'committee_escalation', atIso = nowIso(clock) } = {}) {
        const policy = findApprovalPolicy(instance, currentStep);
        const session = currentRun.approvalSession;
        if (!policy || !session || !Array.isArray(session.committeeSelectors) || session.committeeSelectors.length === 0) {
            throw new Error('approval policy does not define committeeSelectors for escalation');
        }

        const currentRound = getActiveApprovalRound(session);
        if (currentRound) {
            currentRound.status = 'escalated';
            currentRound.closedAt = atIso;
        }

        const nextRound = buildApprovalRound(instance, currentStep, policy, resolvedActorDirectory, createFixedClock(atIso), {
            selectors: session.committeeSelectors,
            roundNumber: session.rounds.length + 1,
            roundType: 'committee',
            reason,
        });
        session.rounds.push(nextRound);
        session.activeRoundId = nextRound.roundId;
        currentRun.assignments = clone(nextRound.assignments);
        syncCurrentRunAssignments(currentRun);

        addAudit(instance, createAuditEntry(instance, {
            entryType: 'approval_escalated',
            actor,
            stepKey: currentStep.stepKey,
            summary: `Escalated approval for step "${currentStep.name}" to committee`,
            payload: {
                approvalSessionId: session.approvalSessionId,
                reason,
                roundId: nextRound.roundId,
            },
            clock: createFixedClock(atIso),
            auditIdFactory,
        }));
        addAudit(instance, createAuditEntry(instance, {
            entryType: 'committee_round_opened',
            actor,
            stepKey: currentStep.stepKey,
            summary: `Opened committee round ${nextRound.roundNumber} for step "${currentStep.name}"`,
            payload: {
                approvalSessionId: session.approvalSessionId,
                roundId: nextRound.roundId,
                roundNumber: nextRound.roundNumber,
                minimumApprovals: nextRound.minimumApprovals,
                assignments: clone(nextRound.assignments),
            },
            clock: createFixedClock(atIso),
            auditIdFactory,
        }));

        return nextRound;
    }

    function triggerEscalationPolicies(instance, currentStep, currentRun, triggerCondition, { actor = SYSTEM_ACTOR, atIso } = {}) {
        if (!currentRun || !currentRun.slaState) {
            return [];
        }

        const definition = definitionsByKey.get(instance.workflowKey);
        const actions = [];
        const escalationKeys = Array.isArray(currentStep.escalationPolicyRefs) ? currentStep.escalationPolicyRefs : [];

        escalationKeys.forEach((escalationKey) => {
            const escalationPolicy = instance.definitionSnapshot.escalationPoliciesByKey[escalationKey];
            if (!escalationPolicy || escalationPolicy.triggerCondition !== triggerCondition) {
                return;
            }
            if (hasExecutedEscalation(currentRun.slaState, escalationPolicy.escalationPolicyKey, triggerCondition)) {
                return;
            }

            const targetActors = resolveEscalationTargets(resolvedActorDirectory, escalationPolicy, instance, currentStep);
            applySeverityOverride(instance, escalationPolicy.severityOverride);
            addAudit(instance, createAuditEntry(instance, {
                entryType: 'escalation_triggered',
                actor,
                stepKey: currentStep.stepKey,
                summary: `Triggered escalation policy "${escalationPolicy.escalationPolicyKey}"`,
                payload: {
                    triggerCondition,
                    targetType: escalationPolicy.targetType,
                    targetRef: escalationPolicy.targetRef,
                    targetActors,
                    nextStepOverride: escalationPolicy.nextStepOverride || null,
                    severityOverride: escalationPolicy.severityOverride || null,
                },
                clock: createFixedClock(atIso),
                auditIdFactory,
            }));
            recordExecutedEscalation(currentRun.slaState, escalationPolicy.escalationPolicyKey, triggerCondition, atIso);

            const action = {
                actionType: 'escalation_triggered',
                triggerCondition,
                escalationPolicyKey: escalationPolicy.escalationPolicyKey,
                targetType: escalationPolicy.targetType,
                targetRef: escalationPolicy.targetRef,
                targetActors: clone(targetActors),
            };

            if (escalationPolicy.nextStepOverride && definition && definition.stepsByKey[escalationPolicy.nextStepOverride]) {
                completeCurrentRunByEscalation(instance, definition, currentStep, currentRun, {
                    actor,
                    atIso,
                    targetStepKey: escalationPolicy.nextStepOverride,
                    reason: `Automated escalation: ${escalationPolicy.escalationPolicyKey}`,
                    auditIdFactory,
                    actorDirectory: resolvedActorDirectory,
                });
                action.transitionedTo = escalationPolicy.nextStepOverride;
            } else if (currentStep.stepType === 'approve' && currentRun.approvalSession && Array.isArray(currentRun.approvalSession.committeeSelectors) && currentRun.approvalSession.committeeSelectors.length > 0) {
                const round = getActiveApprovalRound(currentRun.approvalSession);
                if (!round || round.roundType !== 'committee') {
                    openCommitteeEscalation(instance, currentStep, currentRun, {
                        actor,
                        reason: `Automated escalation: ${escalationPolicy.escalationPolicyKey}`,
                        atIso,
                    });
                    action.committeeEscalated = true;
                }
            }

            actions.push(action);
        });

        return actions;
    }

    function evaluateCurrentRunSla(instance, { at = null, actor = SYSTEM_ACTOR } = {}) {
        const currentRun = getCurrentRun(instance);
        if (!currentRun || !currentRun.slaState) {
            return [];
        }

        const currentStep = instance.definitionSnapshot.stepsByKey[currentRun.stepKey];
        if (!currentStep) {
            return [];
        }

        const atIso = normaliseIso(at, clock);
        syncSlaPauseState(currentRun, instance.state, atIso);
        if (currentRun.slaState.pausedAt || ['completed', 'escalated'].includes(currentRun.slaState.status) || currentRun.slaState.breachRecordedAt) {
            return [];
        }

        const actions = [];
        const elapsedMinutes = getSlaElapsedMinutes(currentRun.slaState, atIso);

        currentRun.slaState.reminderSchedule.forEach((reminder) => {
            if (reminder.sentAt || elapsedMinutes < reminder.intervalMinutes) {
                return;
            }
            reminder.sentAt = atIso;
            currentRun.reminderCount += 1;
            addAudit(instance, createAuditEntry(instance, {
                entryType: 'sla_reminder_sent',
                actor,
                stepKey: currentStep.stepKey,
                summary: `Sent SLA reminder for step "${currentStep.name}"`,
                payload: {
                    intervalMinutes: reminder.intervalMinutes,
                    assignees: clone(currentRun.assignments),
                },
                clock: createFixedClock(atIso),
                auditIdFactory,
            }));
            actions.push({
                actionType: 'sla_reminder_sent',
                intervalMinutes: reminder.intervalMinutes,
                stepKey: currentStep.stepKey,
            });
        });

        if (currentRun.slaState.warningDurationMinutes && !currentRun.slaState.warningRecordedAt && elapsedMinutes >= currentRun.slaState.warningDurationMinutes) {
            currentRun.slaState.warningRecordedAt = atIso;
            addAudit(instance, createAuditEntry(instance, {
                entryType: 'sla_warning',
                actor,
                stepKey: currentStep.stepKey,
                summary: `SLA warning reached for step "${currentStep.name}"`,
                payload: {
                    elapsedMinutes,
                    warningDurationMinutes: currentRun.slaState.warningDurationMinutes,
                },
                clock: createFixedClock(atIso),
                auditIdFactory,
            }));
            actions.push({
                actionType: 'sla_warning',
                stepKey: currentStep.stepKey,
                elapsedMinutes,
            });
            actions.push(...triggerEscalationPolicies(instance, currentStep, currentRun, 'sla_warning', {
                actor,
                atIso,
            }));
        }

        if (currentRun.slaState.breachDurationMinutes && !currentRun.slaState.breachRecordedAt && elapsedMinutes >= currentRun.slaState.breachDurationMinutes) {
            currentRun.slaState.breachRecordedAt = atIso;
            applySeverityOverride(instance, currentRun.slaState.breachSeverityOverride);
            instance.state = 'breached';
            addAudit(instance, createAuditEntry(instance, {
                entryType: 'sla_breach',
                actor,
                stepKey: currentStep.stepKey,
                summary: `SLA breach reached for step "${currentStep.name}"`,
                payload: {
                    elapsedMinutes,
                    breachDurationMinutes: currentRun.slaState.breachDurationMinutes,
                    breachSeverityOverride: currentRun.slaState.breachSeverityOverride,
                },
                clock: createFixedClock(atIso),
                auditIdFactory,
            }));
            actions.push({
                actionType: 'sla_breach',
                stepKey: currentStep.stepKey,
                elapsedMinutes,
            });
            actions.push(...triggerEscalationPolicies(instance, currentStep, currentRun, 'sla_breach', {
                actor,
                atIso,
            }));
            emit('warn', 'workflow.instance.sla_breach', {
                workflowKey: instance.workflowKey,
                instanceId: instance.instanceId,
                stepKey: currentStep.stepKey,
            });
        }

        currentRun.slaState.lastEvaluatedAt = atIso;
        return actions;
    }

    function registerDefinitions(nextDefinitions) {
        nextDefinitions.forEach((definition) => {
            const normalized = normaliseDefinition(definition);
            definitionsByKey.set(normalized.workflowKey, normalized);
        });
    }

    function listDefinitions() {
        return Array.from(definitionsByKey.values()).map(definition => clone(definition));
    }

    function getDefinition(workflowKey) {
        const definition = definitionsByKey.get(workflowKey);
        return definition ? clone(definition) : null;
    }

    function matchEvent(event, { includeStatuses = ['published'] } = {}) {
        const errors = validateNormalizedEvent(event);
        if (errors.length > 0) {
            throw new Error(`invalid workflow event: ${errors.join('; ')}`);
        }

        const matches = [];

        definitionsByKey.forEach((definition) => {
            if (!includeStatuses.includes(definition.status)) {
                return;
            }

            const matchedTrigger = definition.triggers.find((trigger) => {
                if (!trigger.sourceFamilies.includes(event.sourceFamily)) return false;
                if (!trigger.eventTypes.includes(event.eventType)) return false;
                return trigger.matchRules.every(rule => matchRule(event, rule));
            });

            if (!matchedTrigger) {
                return;
            }

            matches.push({
                workflowKey: definition.workflowKey,
                version: definition.version,
                triggerKey: matchedTrigger.triggerKey,
            });
        });

        return matches;
    }

    function buildInstance(definition, event, { actor } = {}) {
        const startedAt = nowIso(clock);
        const workflowActor = normaliseActor(actor || event.actor || SYSTEM_ACTOR);
        const instance = {
            instanceId: instanceIdFactory(),
            workflowKey: definition.workflowKey,
            workflowVersion: definition.version,
            state: 'queued',
            triggerEventId: event.eventId,
            idempotencyKey: event.idempotencyKey,
            sourceFamily: event.sourceFamily,
            eventType: event.eventType,
            authority: event.authority || definition.owningAuthority || null,
            severity: event.severity || definition.defaultSeverity || 'medium',
            entityScope: clone(event.entityScope || {}),
            correlation: clone(event.correlation || {}),
            owningQueue: null,
            originActor: workflowActor,
            triggerActor: normaliseActor(event.actor || workflowActor),
            currentStepKey: null,
            currentStepRunId: null,
            openedAt: startedAt,
            closedAt: null,
            cancellationReason: null,
            evidenceRefs: clone(event.evidenceRefs || []),
            stepRuns: [],
            auditEntries: [],
            definitionSnapshot: {
                workflowKey: definition.workflowKey,
                version: definition.version,
                status: definition.status,
                name: definition.name,
                stepsByKey: clone(definition.stepsByKey),
                stepsOrdered: clone(definition.stepsOrdered),
                approvalPoliciesByKey: clone(definition.approvalPoliciesByKey),
                slaPoliciesByKey: clone(definition.slaPoliciesByKey),
                escalationPoliciesByKey: clone(definition.escalationPoliciesByKey),
            },
        };

        addAudit(instance, createAuditEntry(instance, {
            entryType: 'instance_created',
            actor: workflowActor,
            summary: `Created workflow instance for ${definition.workflowKey}`,
            payload: {
                triggerEventId: event.eventId,
                sourceFamily: event.sourceFamily,
                eventType: event.eventType,
            },
            evidenceRefs: event.evidenceRefs || [],
            clock,
            auditIdFactory,
        }));

        activateStep(instance, definition, definition.entryStepKey, {
            actor: workflowActor,
            clock,
            auditIdFactory,
            actorDirectory: resolvedActorDirectory,
        });

        return instance;
    }

    function startWorkflow(workflowKey, { event, actor = null, includeStatuses = ['published'] } = {}) {
        const definition = definitionsByKey.get(workflowKey);
        if (!definition) {
            throw new Error(`workflow definition "${workflowKey}" was not found`);
        }

        if (!includeStatuses.includes(definition.status)) {
            throw new Error(`workflow definition "${workflowKey}" is "${definition.status}" and cannot start`);
        }

        const errors = validateNormalizedEvent(event);
        if (errors.length > 0) {
            throw new Error(`invalid workflow event: ${errors.join('; ')}`);
        }

        const dedupeKey = `${workflowKey}:${event.idempotencyKey}`;
        if (idempotencyIndex.has(dedupeKey)) {
            const existingInstanceId = idempotencyIndex.get(dedupeKey);
            return {
                status: 'duplicate',
                workflowKey,
                instanceId: existingInstanceId,
                instance: clone(instancesById.get(existingInstanceId)),
            };
        }

        const instance = buildInstance(definition, event, { actor });
        instancesById.set(instance.instanceId, instance);
        idempotencyIndex.set(dedupeKey, instance.instanceId);

        emit('info', 'workflow.instance.started', {
            workflowKey: definition.workflowKey,
            instanceId: instance.instanceId,
            triggerEventId: event.eventId,
            state: instance.state,
            currentStepKey: instance.currentStepKey,
        });

        return {
            status: 'started',
            workflowKey,
            instanceId: instance.instanceId,
            instance: clone(instance),
        };
    }

    function startForEvent(event, options = {}) {
        const matches = matchEvent(event, options);
        return matches.map(match => startWorkflow(match.workflowKey, {
            event,
            actor: options.actor || null,
            includeStatuses: options.includeStatuses || ['published'],
        }));
    }

    function getAvailableOutcomes(instanceId) {
        const instance = instancesById.get(instanceId);
        if (!instance || !instance.currentStepKey) {
            return [];
        }

        const step = instance.definitionSnapshot.stepsByKey[instance.currentStepKey];
        return step && step.transitions ? Object.keys(step.transitions) : [];
    }

    function evaluateInstanceSla(instanceId, { at = null, actor = SYSTEM_ACTOR } = {}) {
        const instance = instancesById.get(instanceId);
        if (!instance) {
            throw new Error('workflow instance not found');
        }

        const actions = evaluateCurrentRunSla(instance, { at, actor });
        return {
            evaluatedAt: normaliseIso(at, clock),
            instance: clone(instance),
            actions,
        };
    }

    function runSlaAutomation({ at = null, actor = SYSTEM_ACTOR } = {}) {
        const evaluatedAt = normaliseIso(at, clock);
        const results = [];

        instancesById.forEach((instance) => {
            if (TERMINAL_INSTANCE_STATES.has(instance.state) || !instance.currentStepKey) {
                return;
            }

            const actions = evaluateCurrentRunSla(instance, {
                at: evaluatedAt,
                actor,
            });

            results.push({
                instanceId: instance.instanceId,
                workflowKey: instance.workflowKey,
                currentStepKey: instance.currentStepKey,
                state: instance.state,
                actions,
            });
        });

        return {
            evaluatedAt,
            evaluatedInstances: results.length,
            affectedInstances: results.filter(result => result.actions.length > 0).length,
            results: clone(results),
        };
    }

    function resolveCurrentAssignments(instanceId) {
        const instance = instancesById.get(instanceId);
        if (!instance) {
            throw new Error('workflow instance not found');
        }

        const currentRun = getCurrentRun(instance);
        return currentRun ? clone(currentRun.assignments || []) : [];
    }

    function reassignCurrentStep(instanceId, { actor = SYSTEM_ACTOR, target, reason = 'manual_reassignment' } = {}) {
        const instance = instancesById.get(instanceId);
        assertAdvancableInstance(instance);
        const currentRun = getCurrentRun(instance);
        if (!currentRun) {
            throw new Error(`workflow instance ${instanceId} has no active step`);
        }

        const targetActor = normaliseActor(target);
        currentRun.assignments = [{
            assignmentId: createAssignmentId(),
            actor: targetActor,
            selectorType: targetActor.actorType,
            selectorValue: targetActor.actorId,
            assignmentType: currentRun.approvalSession ? 'approver' : 'assignee',
            assignmentState: 'active',
            delegatedBy: null,
            assignedAt: nowIso(clock),
            reason,
        }];
        syncCurrentRunAssignments(currentRun);

        if (currentRun.approvalSession) {
            const round = getActiveApprovalRound(currentRun.approvalSession);
            if (round && round.decisions.length > 0) {
                throw new Error('cannot reassign an approval round after decisions exist');
            }
            if (round) {
                round.assignments = clone(currentRun.assignments);
            }
        }

        addAudit(instance, createAuditEntry(instance, {
            entryType: 'assignment_changed',
            actor,
            stepKey: instance.currentStepKey,
            summary: `Changed assignment for step "${instance.currentStepKey}"`,
            payload: {
                target: targetActor,
                reason,
            },
            clock,
            auditIdFactory,
        }));

        return clone(instance);
    }

    function delegateApproval(instanceId, { actor, delegateTo, reason = 'manual_delegation' } = {}) {
        const instance = instancesById.get(instanceId);
        assertAdvancableInstance(instance);
        const currentStep = instance.definitionSnapshot.stepsByKey[instance.currentStepKey];
        const currentRun = getCurrentRun(instance);
        if (!currentStep || !currentRun || currentStep.stepType !== 'approve' || !currentRun.approvalSession) {
            throw new Error(`workflow instance ${instanceId} is not waiting on approval`);
        }

        const approvalActor = normaliseActor(actor);
        const delegateActor = normaliseActor(delegateTo);
        const session = currentRun.approvalSession;
        const round = getActiveApprovalRound(session);
        const assignment = findRoundAssignment(round, approvalActor);
        if (!assignment) {
            throw new Error('only an assigned approver can delegate this approval');
        }

        const allowedDelegates = dedupeActors(
            (resolvedActorDirectory.resolveDelegates(
                approvalActor,
                session.delegateSelectors,
                createResolutionContext(instance, currentStep, findApprovalPolicy(instance, currentStep))
            ) || []).map(normaliseActor)
        );

        if (!allowedDelegates.some(candidate => actorsEqual(candidate, delegateActor))) {
            addAudit(instance, createAuditEntry(instance, {
                entryType: 'approval_delegation_denied',
                actor: approvalActor,
                stepKey: currentStep.stepKey,
                summary: `Denied approval delegation for step "${currentStep.name}"`,
                payload: {
                    delegateTo: delegateActor,
                    reason,
                },
                clock,
                auditIdFactory,
            }));
            throw new Error('delegate target is not permitted by explicit delegate selectors');
        }

        assignment.assignmentState = 'delegated';
        assignment.delegatedTo = delegateActor;
        const delegatedAssignment = {
            assignmentId: createAssignmentId(),
            actor: delegateActor,
            selectorType: delegateActor.actorType,
            selectorValue: delegateActor.actorId,
            assignmentType: 'approver',
            assignmentState: 'active',
            delegatedBy: approvalActor,
            assignedAt: nowIso(clock),
            reason,
        };
        round.assignments.push(delegatedAssignment);
        currentRun.assignments = clone(round.assignments.filter(entry => entry.assignmentState === 'active'));
        syncCurrentRunAssignments(currentRun);

        addAudit(instance, createAuditEntry(instance, {
            entryType: 'approval_delegated',
            actor: approvalActor,
            stepKey: currentStep.stepKey,
            summary: `Delegated approval for step "${currentStep.name}"`,
            payload: {
                delegateTo: delegateActor,
                reason,
            },
            clock,
            auditIdFactory,
        }));

        return clone(instance);
    }

    function recordApprovalDecision(instanceId, {
        actor,
        decision,
        notes = '',
        payload = {},
        evidenceRefs = [],
    } = {}) {
        const instance = instancesById.get(instanceId);
        assertAdvancableInstance(instance);
        const currentStep = instance.definitionSnapshot.stepsByKey[instance.currentStepKey];
        const currentRun = getCurrentRun(instance);
        if (!currentStep || !currentRun || currentStep.stepType !== 'approve' || !currentRun.approvalSession) {
            throw new Error(`workflow instance ${instanceId} is not waiting on approval`);
        }

        if (!APPROVAL_DECISIONS.has(decision)) {
            throw new Error(`approval decision "${decision}" is invalid`);
        }

        const approvalActor = normaliseActor(actor);
        const session = currentRun.approvalSession;
        const round = getActiveApprovalRound(session);
        if (!findRoundAssignment(round, approvalActor)) {
            throw new Error('actor is not assigned to the active approval round');
        }
        if (roundHasDecision(round, approvalActor)) {
            throw new Error('duplicate actor decisions are not allowed in the same approval round');
        }
        if (session.mode === 'maker_checker' && isMakerCheckerBlocked(instance, session, approvalActor)) {
            throw new Error('maker-checker approval is blocked for the originating actor');
        }

        attachEvidence(instance, currentRun, evidenceRefs, {
            actor: approvalActor,
            clock,
            auditIdFactory,
        });

        const decisionRecord = {
            decisionRecordId: createApprovalDecisionId(),
            roundId: round.roundId,
            actor: approvalActor,
            decision,
            decidedAt: nowIso(clock),
            notes,
            payload: clone(payload || {}),
            evidenceRefs: clone(evidenceRefs || []),
        };
        round.decisions.push(decisionRecord);

        addAudit(instance, createAuditEntry(instance, {
            entryType: 'approval_recorded',
            actor: approvalActor,
            stepKey: currentStep.stepKey,
            summary: `Recorded approval decision "${decision}" for step "${currentStep.name}"`,
            payload: {
                approvalSessionId: session.approvalSessionId,
                roundId: round.roundId,
                decisionRecordId: decisionRecord.decisionRecordId,
                decision,
                notes,
                ...payload,
            },
            evidenceRefs,
            clock,
            auditIdFactory,
        }));

        const resolution = evaluateApprovalSession(session);
        if (resolution.status === 'open') {
            return clone(instance);
        }

        round.status = resolution.status;
        round.closedAt = nowIso(clock);
        session.status = resolution.status;
        session.closedAt = nowIso(clock);

        const definition = definitionsByKey.get(instance.workflowKey);
        transitionFromCurrentStep(instance, definition, currentStep, currentRun, {
            outcome: resolution.outcome,
            actor: approvalActor,
            notes,
            payload,
            evidenceRefs: [],
            clock,
            auditIdFactory,
            actorDirectory: resolvedActorDirectory,
            completionEntryType: 'approval_resolved',
            completionSummaryPrefix: 'Resolved approval step',
        });

        emit('info', 'workflow.instance.approval_resolved', {
            workflowKey: instance.workflowKey,
            instanceId: instance.instanceId,
            currentStepKey: instance.currentStepKey,
            resolution: resolution.status,
        });

        return clone(instance);
    }

    function escalateApprovalToCommittee(instanceId, { actor = SYSTEM_ACTOR, reason = 'committee_escalation' } = {}) {
        const instance = instancesById.get(instanceId);
        assertAdvancableInstance(instance);
        const currentStep = instance.definitionSnapshot.stepsByKey[instance.currentStepKey];
        const currentRun = getCurrentRun(instance);
        if (!currentStep || !currentRun || currentStep.stepType !== 'approve' || !currentRun.approvalSession) {
            throw new Error(`workflow instance ${instanceId} is not waiting on approval`);
        }

        openCommitteeEscalation(instance, currentStep, currentRun, {
            actor,
            reason,
        });

        return clone(instance);
    }

    function advanceInstance(instanceId, {
        outcome,
        actor = SYSTEM_ACTOR,
        notes = '',
        payload = {},
        evidenceRefs = [],
    } = {}) {
        const instance = instancesById.get(instanceId);
        assertAdvancableInstance(instance);

        const currentStep = instance.definitionSnapshot.stepsByKey[instance.currentStepKey];
        const currentRun = getCurrentRun(instance);
        if (!currentStep || !currentRun) {
            throw new Error(`workflow instance ${instanceId} has no active step`);
        }

        if (currentStep.stepType === 'approve') {
            if (outcome === 'onApprove') {
                return recordApprovalDecision(instanceId, { actor, decision: 'approve', notes, payload, evidenceRefs });
            }
            if (outcome === 'onReject') {
                return recordApprovalDecision(instanceId, { actor, decision: 'reject', notes, payload, evidenceRefs });
            }
        }

        const definition = definitionsByKey.get(instance.workflowKey);
        transitionFromCurrentStep(instance, definition, currentStep, currentRun, {
            outcome,
            actor,
            notes,
            payload,
            evidenceRefs,
            clock,
            auditIdFactory,
            actorDirectory: resolvedActorDirectory,
        });

        emit('info', 'workflow.instance.advanced', {
            workflowKey: instance.workflowKey,
            instanceId: instance.instanceId,
            outcome,
            currentStepKey: instance.currentStepKey,
            state: instance.state,
        });

        return clone(instance);
    }

    function cancelInstance(instanceId, { actor = SYSTEM_ACTOR, reason = 'canceled' } = {}) {
        const instance = instancesById.get(instanceId);
        assertAdvancableInstance(instance);

        const currentRun = getCurrentRun(instance);
        if (currentRun) {
            currentRun.state = 'canceled';
            currentRun.completedAt = nowIso(clock);
            finalizeSlaState(currentRun, currentRun.completedAt, 'completed');
        }

        instance.state = 'canceled';
        instance.cancellationReason = reason;
        instance.closedAt = nowIso(clock);
        instance.currentStepKey = null;
        instance.currentStepRunId = null;

        addAudit(instance, createAuditEntry(instance, {
            entryType: 'instance_canceled',
            actor,
            stepKey: currentRun ? currentRun.stepKey : null,
            summary: `Canceled workflow instance ${instance.instanceId}`,
            payload: { reason },
            clock,
            auditIdFactory,
        }));

        return clone(instance);
    }

    function markInstanceBreached(instanceId, { actor = SYSTEM_ACTOR, reason = 'sla_breach' } = {}) {
        const instance = instancesById.get(instanceId);
        assertAdvancableInstance(instance);
        const currentRun = getCurrentRun(instance);
        const breachedAt = nowIso(clock);
        instance.state = 'breached';
        if (currentRun && currentRun.slaState && !currentRun.slaState.breachRecordedAt) {
            currentRun.slaState.breachRecordedAt = breachedAt;
            currentRun.slaState.lastEvaluatedAt = breachedAt;
        }
        addAudit(instance, createAuditEntry(instance, {
            entryType: 'sla_breach',
            actor,
            stepKey: instance.currentStepKey,
            summary: `Marked workflow instance ${instance.instanceId} as breached`,
            payload: { reason },
            clock: createFixedClock(breachedAt),
            auditIdFactory,
        }));
        return clone(instance);
    }

    function resumeInstance(instanceId, { actor = SYSTEM_ACTOR } = {}) {
        const instance = instancesById.get(instanceId);
        if (!instance) {
            throw new Error('workflow instance not found');
        }
        if (instance.state !== 'breached') {
            throw new Error(`workflow instance ${instanceId} is not breached`);
        }
        const step = instance.definitionSnapshot.stepsByKey[instance.currentStepKey];
        instance.state = currentInstanceStateFor(step.stepType);
        const resumedAt = nowIso(clock);
        const currentRun = getCurrentRun(instance);
        if (currentRun && currentRun.slaState) {
            currentRun.slaState.lastEvaluatedAt = resumedAt;
            syncSlaPauseState(currentRun, instance.state, resumedAt);
        }
        addAudit(instance, createAuditEntry(instance, {
            entryType: 'step_started',
            actor,
            stepKey: instance.currentStepKey,
            summary: `Resumed workflow instance ${instance.instanceId}`,
            payload: {
                resumedState: instance.state,
            },
            clock: createFixedClock(resumedAt),
            auditIdFactory,
        }));
        return clone(instance);
    }

    function getInstance(instanceId) {
        const instance = instancesById.get(instanceId);
        return instance ? clone(instance) : null;
    }

    function listInstances() {
        return Array.from(instancesById.values()).map(instance => clone(instance));
    }

    registerDefinitions(definitions);

    return {
        registerDefinitions,
        listDefinitions,
        getDefinition,
        matchEvent,
        startWorkflow,
        startForEvent,
        advanceInstance,
        cancelInstance,
        markInstanceBreached,
        resumeInstance,
        getAvailableOutcomes,
        evaluateInstanceSla,
        runSlaAutomation,
        getInstance,
        listInstances,
        resolveCurrentAssignments,
        reassignCurrentStep,
        delegateApproval,
        recordApprovalDecision,
        escalateApprovalToCommittee,
    };
}

module.exports = {
    SYSTEM_ACTOR,
    createWorkflowExecutionService,
    validateNormalizedEvent,
    matchRule,
};
