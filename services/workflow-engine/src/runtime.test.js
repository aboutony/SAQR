const fs = require('fs');
const path = require('path');
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { createWorkflowExecutionService, createInMemoryActorDirectory, validateNormalizedEvent } = require('./index');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');

function loadDefinition(relativePath) {
    return JSON.parse(fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8'));
}

function publish(definition) {
    return {
        ...definition,
        status: 'published',
    };
}

function createClock(startAt = '2026-04-07T12:00:00.000Z') {
    let current = new Date(startAt).getTime();
    return () => {
        current += 1000;
        return new Date(current);
    };
}

function createActorDirectory() {
    return createInMemoryActorDirectory({
        users: [
            { actorType: 'user', actorId: 'analyst-01', displayName: 'Analyst 01', roleKey: 'analyst' },
            { actorType: 'user', actorId: 'analyst-02', displayName: 'Analyst 02', roleKey: 'analyst' },
            { actorType: 'user', actorId: 'auditor-01', displayName: 'Auditor 01', roleKey: 'auditor' },
            { actorType: 'user', actorId: 'admin-01', displayName: 'Admin 01', roleKey: 'admin' },
            { actorType: 'user', actorId: 'board-01', displayName: 'Board 01', roleKey: 'board' },
            { actorType: 'user', actorId: 'board-02', displayName: 'Board 02', roleKey: 'board' },
            { actorType: 'user', actorId: 'board-03', displayName: 'Board 03', roleKey: 'board' },
            { actorType: 'user', actorId: 'ops-01', displayName: 'Ops 01', roleKey: 'viewer' },
            { actorType: 'user', actorId: 'risk-01', displayName: 'Risk 01', roleKey: 'analyst' },
            { actorType: 'user', actorId: 'specific-01', displayName: 'Specific 01', roleKey: 'admin' },
            { actorType: 'user', actorId: 'delegate-01', displayName: 'Delegate 01', roleKey: 'admin' },
            { actorType: 'user', actorId: 'blocked-01', displayName: 'Blocked 01', roleKey: 'auditor' },
        ],
        roles: {
            analyst: ['analyst-01', 'analyst-02', 'risk-01'],
            auditor: ['auditor-01', 'blocked-01'],
            admin: ['admin-01', 'delegate-01', 'specific-01'],
            board: ['board-01', 'board-02', 'board-03'],
            viewer: ['ops-01'],
        },
        queues: {
            'compliance-analysts': ['analyst-01', 'analyst-02'],
            'site-operations': ['ops-01'],
            'risk-triage': ['risk-01'],
        },
        delegates: {
            'user:auditor-01': ['delegate-01'],
        },
    });
}

function createDriftEvent(overrides = {}) {
    return {
        eventId: 'evt-nlp-001',
        idempotencyKey: 'dedupe-nlp-001',
        eventType: 'nlp.drift.detected',
        sourceFamily: 'nlp',
        occurredAt: '2026-04-07T12:00:00.000Z',
        ingestedAt: '2026-04-07T12:00:01.000Z',
        severity: 'high',
        authority: 'SAMA',
        entityScope: {},
        correlation: {
            alertId: 'DRIFT-001',
            documentKey: 'DOC-402',
            evidenceKey: 'EVID-001',
            contentHash: 'hash-402',
        },
        evidenceRefs: [],
        payload: {
            alertId: 'DRIFT-001',
            driftType: 'parameter_change',
            title: 'Fee cap changed',
            description: 'Administrative fee cap reduced.',
        },
        ...overrides,
    };
}

function createCvEvent(overrides = {}) {
    return {
        eventId: 'evt-cv-001',
        idempotencyKey: 'dedupe-cv-001',
        eventType: 'cv.violation.detected',
        sourceFamily: 'cv',
        occurredAt: '2026-04-07T12:05:00.000Z',
        ingestedAt: '2026-04-07T12:05:01.000Z',
        severity: 'medium',
        entityScope: {},
        correlation: {
            cameraId: 'CAM-01',
            evidenceKey: 'CVE-001',
        },
        evidenceRefs: [],
        payload: {
            evidenceId: 'CVE-001',
            cameraId: 'CAM-01',
            violationCode: 'MOMAH-CV-001',
        },
        ...overrides,
    };
}

function createManualEvent(idempotencyKey, launchCategory, overrides = {}) {
    return {
        eventId: `evt-manual-${idempotencyKey}`,
        idempotencyKey,
        eventType: 'workflow.manual.triggered',
        sourceFamily: 'manual',
        occurredAt: '2026-04-07T13:00:00.000Z',
        ingestedAt: '2026-04-07T13:00:01.000Z',
        severity: 'high',
        actor: {
            actorType: 'user',
            actorId: 'analyst-01',
            displayName: 'Analyst 01',
            roleKey: 'analyst',
        },
        entityScope: {},
        correlation: {
            launchId: `launch-${idempotencyKey}`,
        },
        evidenceRefs: [],
        payload: {
            launchCategory,
        },
        ...overrides,
    };
}

function createAssignmentDefinition() {
    return publish({
        schemaVersion: 1,
        workflowKey: 'assignment-routing',
        version: 1,
        name: 'Assignment Routing',
        status: 'draft',
        entryStepKey: 'triage',
        triggers: [
            {
                triggerKey: 'manual',
                sourceFamilies: ['manual'],
                eventTypes: ['workflow.manual.triggered'],
                matchRules: [{ field: 'payload.launchCategory', operator: 'equals', value: 'assignment-routing' }],
            },
        ],
        steps: [
            {
                stepKey: 'triage',
                order: 1,
                name: 'Triage',
                stepType: 'assign',
                actionType: 'route_to_queue',
                assignmentRule: {
                    selectors: [
                        { type: 'queue', value: 'risk-triage' },
                        { type: 'role', value: 'auditor' },
                        { type: 'user', value: 'specific-01' },
                    ],
                },
                transitions: {
                    onSuccess: null,
                },
            },
        ],
        publishControls: {
            changeSummary: 'assignment',
            approvalRecordRequired: false,
        },
    });
}

function createDelegatedDefinition() {
    return publish({
        schemaVersion: 1,
        workflowKey: 'delegated-approval',
        version: 1,
        name: 'Delegated Approval',
        status: 'draft',
        entryStepKey: 'approval',
        triggers: [
            {
                triggerKey: 'manual',
                sourceFamilies: ['manual'],
                eventTypes: ['workflow.manual.triggered'],
                matchRules: [{ field: 'payload.launchCategory', operator: 'equals', value: 'delegated-approval' }],
            },
        ],
        approvalPolicies: [
            {
                approvalPolicyKey: 'delegated-review',
                mode: 'delegated',
                minimumApprovals: 1,
                quorumMode: 'fixed',
                approverSelectors: [{ type: 'user', value: 'auditor-01' }],
                delegateSelectors: [{ type: 'user', value: 'delegate-01' }],
                rejectionMode: 'first_rejection',
            },
        ],
        steps: [
            {
                stepKey: 'approval',
                order: 1,
                name: 'Approval',
                stepType: 'approve',
                actionType: 'request_approval',
                approvalPolicyRef: 'delegated-review',
                transitions: {
                    onApprove: null,
                    onReject: null,
                },
            },
        ],
        publishControls: {
            changeSummary: 'delegated',
            approvalRecordRequired: true,
        },
    });
}

function createPausedSlaDefinition() {
    return publish({
        schemaVersion: 1,
        workflowKey: 'paused-sla-approval',
        version: 1,
        name: 'Paused SLA Approval',
        status: 'draft',
        entryStepKey: 'approval',
        triggers: [
            {
                triggerKey: 'manual',
                sourceFamilies: ['manual'],
                eventTypes: ['workflow.manual.triggered'],
                matchRules: [{ field: 'payload.launchCategory', operator: 'equals', value: 'paused-sla-approval' }],
            },
        ],
        approvalPolicies: [
            {
                approvalPolicyKey: 'paused-approval',
                mode: 'single',
                minimumApprovals: 1,
                quorumMode: 'fixed',
                approverSelectors: [{ type: 'user', value: 'auditor-01' }],
                rejectionMode: 'first_rejection',
            },
        ],
        slaPolicies: [
            {
                slaPolicyKey: 'paused-waiting-approval',
                targetDurationMinutes: 30,
                warningDurationMinutes: 15,
                breachDurationMinutes: 30,
                reminderIntervalsMinutes: [10, 20],
                pauseStates: ['waiting_approval'],
                breachSeverityOverride: 'critical',
            },
        ],
        steps: [
            {
                stepKey: 'approval',
                order: 1,
                name: 'Approval',
                stepType: 'approve',
                actionType: 'request_approval',
                approvalPolicyRef: 'paused-approval',
                slaPolicyRef: 'paused-waiting-approval',
                transitions: {
                    onApprove: null,
                    onReject: null,
                },
            },
        ],
        publishControls: {
            changeSummary: 'paused-sla',
            approvalRecordRequired: true,
        },
    });
}

describe('workflow execution service', () => {
    it('matches published workflows from normalized events', () => {
        const runtime = createWorkflowExecutionService({
            definitions: [publish(loadDefinition('fixtures/phase2-workflow/workflows/regulatory-drift-review.workflow.json'))],
            actorDirectory: createActorDirectory(),
            clock: createClock(),
        });

        const matches = runtime.matchEvent(createDriftEvent());
        assert.equal(matches.length, 1);
        assert.equal(matches[0].workflowKey, 'regulatory-drift-review');
    });

    it('resolves assignment selectors deterministically for queue, role, and user selectors', () => {
        const runtime = createWorkflowExecutionService({
            definitions: [createAssignmentDefinition()],
            actorDirectory: createActorDirectory(),
            clock: createClock(),
        });

        const started = runtime.startForEvent(createManualEvent('assign-001', 'assignment-routing'))[0].instance;
        const assignments = runtime.resolveCurrentAssignments(started.instanceId);

        assert.deepEqual(assignments.map(item => item.actor.actorId), ['risk-01', 'auditor-01', 'blocked-01', 'specific-01']);
        assert.equal(started.auditEntries.some(entry => entry.entryType === 'assignment_resolved'), true);
    });

    it('blocks maker-checker approval from the originating actor and supports explicit delegation rules', () => {
        const runtime = createWorkflowExecutionService({
            definitions: [
                publish(loadDefinition('fixtures/phase2-workflow/workflows/regulatory-drift-review.workflow.json')),
                createDelegatedDefinition(),
            ],
            actorDirectory: createActorDirectory(),
            clock: createClock(),
        });

        const makerChecker = runtime.startForEvent(createDriftEvent({
            idempotencyKey: 'dedupe-nlp-maker-checker',
            actor: {
                actorType: 'user',
                actorId: 'blocked-01',
                displayName: 'Blocked 01',
                roleKey: 'auditor',
            },
        }), {
            actor: {
                actorType: 'user',
                actorId: 'blocked-01',
                displayName: 'Blocked 01',
                roleKey: 'auditor',
            },
        })[0].instance;
        runtime.advanceInstance(makerChecker.instanceId, { outcome: 'onSuccess' });
        runtime.advanceInstance(makerChecker.instanceId, { outcome: 'onSuccess' });

        assert.throws(
            () => runtime.recordApprovalDecision(makerChecker.instanceId, {
                actor: {
                    actorType: 'user',
                    actorId: 'blocked-01',
                    displayName: 'Blocked 01',
                    roleKey: 'auditor',
                },
                decision: 'approve',
            }),
            /maker-checker/
        );

        const delegated = runtime.startForEvent(createManualEvent('delegate-001', 'delegated-approval'))[0].instance;
        assert.throws(
            () => runtime.delegateApproval(delegated.instanceId, {
                actor: { actorType: 'user', actorId: 'auditor-01', displayName: 'Auditor 01', roleKey: 'auditor' },
                delegateTo: { actorType: 'user', actorId: 'board-01', displayName: 'Board 01', roleKey: 'board' },
                reason: 'invalid target',
            }),
            /not permitted/
        );

        const afterDelegation = runtime.delegateApproval(delegated.instanceId, {
            actor: { actorType: 'user', actorId: 'auditor-01', displayName: 'Auditor 01', roleKey: 'auditor' },
            delegateTo: { actorType: 'user', actorId: 'delegate-01', displayName: 'Delegate 01', roleKey: 'admin' },
            reason: 'out of office',
        });

        assert.equal(afterDelegation.auditEntries.some(entry => entry.entryType === 'approval_delegation_denied'), true);
        assert.equal(afterDelegation.auditEntries.some(entry => entry.entryType === 'approval_delegated'), true);
        assert.equal(runtime.resolveCurrentAssignments(delegated.instanceId).some(item => item.actor.actorId === 'delegate-01'), true);
    });

    it('completes single-approval style flows on first approval or first rejection', () => {
        const runtime = createWorkflowExecutionService({
            definitions: [createDelegatedDefinition()],
            actorDirectory: createActorDirectory(),
            clock: createClock(),
        });

        const approved = runtime.startForEvent(createManualEvent('delegate-approve', 'delegated-approval'))[0].instance;
        const afterDelegation = runtime.delegateApproval(approved.instanceId, {
            actor: { actorType: 'user', actorId: 'auditor-01', displayName: 'Auditor 01', roleKey: 'auditor' },
            delegateTo: { actorType: 'user', actorId: 'delegate-01', displayName: 'Delegate 01', roleKey: 'admin' },
        });
        assert.equal(afterDelegation.state, 'waiting_approval');
        const approvedInstance = runtime.recordApprovalDecision(approved.instanceId, {
            actor: { actorType: 'user', actorId: 'delegate-01', displayName: 'Delegate 01', roleKey: 'admin' },
            decision: 'approve',
        });
        assert.equal(approvedInstance.state, 'completed');

        const rejected = runtime.startForEvent(createManualEvent('delegate-reject', 'delegated-approval'))[0].instance;
        const rejectedInstance = runtime.recordApprovalDecision(rejected.instanceId, {
            actor: { actorType: 'user', actorId: 'auditor-01', displayName: 'Auditor 01', roleKey: 'auditor' },
            decision: 'reject',
        });
        assert.equal(rejectedInstance.state, 'completed');
        assert.equal(rejectedInstance.auditEntries.some(entry => entry.entryType === 'approval_resolved'), true);
    });

    it('supports fixed-quorum committee approval, quorum failure, and duplicate-decision rejection', () => {
        const definition = publish(loadDefinition('fixtures/phase2-workflow/workflows/cross-authority-committee-review.workflow.json'));
        const runtime = createWorkflowExecutionService({
            definitions: [definition],
            actorDirectory: createActorDirectory(),
            clock: createClock(),
        });

        const approved = runtime.startForEvent(createManualEvent('committee-approve', 'cross-authority-committee-review'))[0].instance;
        runtime.advanceInstance(approved.instanceId, { outcome: 'onSuccess' });
        let instance = runtime.recordApprovalDecision(approved.instanceId, {
            actor: { actorType: 'user', actorId: 'board-01', displayName: 'Board 01', roleKey: 'board' },
            decision: 'approve',
        });
        assert.equal(instance.state, 'waiting_approval');
        assert.throws(
            () => runtime.recordApprovalDecision(approved.instanceId, {
                actor: { actorType: 'user', actorId: 'board-01', displayName: 'Board 01', roleKey: 'board' },
                decision: 'approve',
            }),
            /duplicate actor decisions/
        );
        instance = runtime.recordApprovalDecision(approved.instanceId, {
            actor: { actorType: 'user', actorId: 'board-02', displayName: 'Board 02', roleKey: 'board' },
            decision: 'approve',
        });
        assert.equal(instance.state, 'active');
        assert.equal(instance.currentStepKey, 'dispatch-remediation');

        const rejected = runtime.startForEvent(createManualEvent('committee-reject', 'cross-authority-committee-review'))[0].instance;
        runtime.advanceInstance(rejected.instanceId, { outcome: 'onSuccess' });
        runtime.recordApprovalDecision(rejected.instanceId, {
            actor: { actorType: 'user', actorId: 'board-01', displayName: 'Board 01', roleKey: 'board' },
            decision: 'reject',
        });
        const rejectedInstance = runtime.recordApprovalDecision(rejected.instanceId, {
            actor: { actorType: 'user', actorId: 'board-02', displayName: 'Board 02', roleKey: 'board' },
            decision: 'reject',
        });
        assert.equal(rejectedInstance.currentStepKey, 'notify-oversight');
    });

    it('opens a new committee round during escalation and preserves prior-round history', () => {
        const runtime = createWorkflowExecutionService({
            definitions: [publish(loadDefinition('fixtures/phase2-workflow/workflows/regulatory-drift-review.workflow.json'))],
            actorDirectory: createActorDirectory(),
            clock: createClock(),
        });

        const started = runtime.startForEvent(createDriftEvent({ idempotencyKey: 'dedupe-nlp-escalate' }))[0].instance;
        runtime.advanceInstance(started.instanceId, { outcome: 'onSuccess' });
        runtime.advanceInstance(started.instanceId, { outcome: 'onSuccess' });
        const escalated = runtime.escalateApprovalToCommittee(started.instanceId, { reason: 'complex policy exception' });
        const approvalRun = escalated.stepRuns.find(run => run.runId === escalated.currentStepRunId);

        assert.equal(approvalRun.approvalSession.rounds.length, 2);
        assert.equal(approvalRun.approvalSession.rounds[0].status, 'escalated');
        assert.equal(approvalRun.approvalSession.rounds[1].roundType, 'committee');
        assert.equal(escalated.auditEntries.some(entry => entry.entryType === 'approval_escalated'), true);
        assert.equal(escalated.auditEntries.filter(entry => entry.entryType === 'committee_round_opened').length >= 1, true);
    });

    it('supports reassignment, timer waiting states, and breach-resume transitions', () => {
        const runtime = createWorkflowExecutionService({
            definitions: [
                createAssignmentDefinition(),
                publish(loadDefinition('fixtures/phase2-workflow/workflows/visual-branch-remediation.workflow.json')),
            ],
            actorDirectory: createActorDirectory(),
            clock: createClock(),
        });

        const assigned = runtime.startForEvent(createManualEvent('assign-reassign', 'assignment-routing'))[0].instance;
        const reassigned = runtime.reassignCurrentStep(assigned.instanceId, {
            actor: { actorType: 'user', actorId: 'admin-01', displayName: 'Admin 01', roleKey: 'admin' },
            target: { actorType: 'user', actorId: 'delegate-01', displayName: 'Delegate 01', roleKey: 'admin' },
            reason: 'manual override',
        });
        assert.deepEqual(runtime.resolveCurrentAssignments(assigned.instanceId).map(item => item.actor.actorId), ['delegate-01']);
        assert.equal(reassigned.auditEntries.some(entry => entry.entryType === 'assignment_changed'), true);

        const started = runtime.startForEvent(createCvEvent())[0].instance;
        let instance = runtime.advanceInstance(started.instanceId, { outcome: 'onSuccess' });
        instance = runtime.advanceInstance(started.instanceId, { outcome: 'onSuccess' });
        instance = runtime.advanceInstance(started.instanceId, { outcome: 'onSuccess' });
        assert.equal(instance.currentStepKey, 'wait-remediation-window');
        assert.equal(instance.state, 'waiting_external');
        instance = runtime.markInstanceBreached(started.instanceId, { reason: 'timer breached' });
        assert.equal(instance.state, 'breached');
        instance = runtime.resumeInstance(started.instanceId);
        assert.equal(instance.state, 'waiting_external');
    });

    it('evaluates SLA reminders and breach handling deterministically', () => {
        const runtime = createWorkflowExecutionService({
            definitions: [publish(loadDefinition('fixtures/phase2-workflow/workflows/regulatory-drift-review.workflow.json'))],
            actorDirectory: createActorDirectory(),
            clock: createClock(),
        });

        const started = runtime.startForEvent(createDriftEvent({ idempotencyKey: 'dedupe-nlp-sla-assign' }))[0].instance;
        const warningEvaluation = runtime.evaluateInstanceSla(started.instanceId, {
            at: '2026-04-07T15:10:00.000Z',
        });
        assert.equal(warningEvaluation.actions.filter(action => action.actionType === 'sla_reminder_sent').length, 3);
        assert.equal(warningEvaluation.actions.some(action => action.actionType === 'sla_warning'), true);

        const breachEvaluation = runtime.evaluateInstanceSla(started.instanceId, {
            at: '2026-04-07T16:20:00.000Z',
        });
        assert.equal(breachEvaluation.actions.some(action => action.actionType === 'sla_breach'), true);
        assert.equal(breachEvaluation.instance.state, 'breached');
        const breachedRun = breachEvaluation.instance.stepRuns.find(run => run.runId === breachEvaluation.instance.currentStepRunId);
        assert.equal(breachedRun.reminderCount, 3);
    });

    it('supports pause-aware SLA monitoring and automated escalation on breach', () => {
        const runtime = createWorkflowExecutionService({
            definitions: [
                createPausedSlaDefinition(),
                publish(loadDefinition('fixtures/phase2-workflow/workflows/regulatory-drift-review.workflow.json')),
            ],
            actorDirectory: createActorDirectory(),
            clock: createClock(),
        });

        const paused = runtime.startForEvent(createManualEvent('paused-sla-001', 'paused-sla-approval'))[0].instance;
        const pausedScan = runtime.evaluateInstanceSla(paused.instanceId, {
            at: '2026-04-08T00:00:00.000Z',
        });
        assert.deepEqual(pausedScan.actions, []);
        assert.equal(pausedScan.instance.state, 'waiting_approval');

        const drift = runtime.startForEvent(createDriftEvent({ idempotencyKey: 'dedupe-nlp-sla-escalation' }))[0].instance;
        runtime.advanceInstance(drift.instanceId, { outcome: 'onSuccess' });
        runtime.advanceInstance(drift.instanceId, { outcome: 'onSuccess' });

        const automation = runtime.runSlaAutomation({
            at: '2026-04-07T20:30:00.000Z',
        });
        const driftResult = automation.results.find(result => result.instanceId === drift.instanceId);
        assert.equal(automation.affectedInstances >= 1, true);
        assert.equal(driftResult.actions.some(action => action.actionType === 'escalation_triggered'), true);

        const updated = runtime.getInstance(drift.instanceId);
        const approvalRun = updated.stepRuns.find(run => run.stepKey === 'request-legal-review');
        assert.equal(updated.currentStepKey, 'notify-management');
        assert.equal(approvalRun.slaState.status, 'escalated');
        assert.equal(updated.auditEntries.some(entry => entry.entryType === 'sla_breach'), true);
        assert.equal(updated.auditEntries.some(entry => entry.entryType === 'escalation_triggered'), true);
    });

    it('validates event envelopes and keeps idempotent start semantics intact', () => {
        const runtime = createWorkflowExecutionService({
            definitions: [publish(loadDefinition('fixtures/phase2-workflow/workflows/regulatory-drift-review.workflow.json'))],
            actorDirectory: createActorDirectory(),
            clock: createClock(),
        });

        const event = createDriftEvent({ idempotencyKey: 'dedupe-nlp-idempotent' });
        const first = runtime.startForEvent(event);
        const second = runtime.startForEvent(event);

        assert.equal(first[0].status, 'started');
        assert.equal(second[0].status, 'duplicate');

        const errors = validateNormalizedEvent({
            sourceFamily: 'manual',
            eventType: 'workflow.manual.triggered',
        });
        assert.ok(errors.some(error => error.includes('eventId')));
        assert.ok(errors.some(error => error.includes('actor')));
    });
});
