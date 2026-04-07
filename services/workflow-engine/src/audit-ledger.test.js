const fs = require('fs');
const path = require('path');
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
    createInMemoryActorDirectory,
    createWorkflowAuditLedgerService,
    createWorkflowExecutionService,
    createWorkflowGovernanceService,
} = require('./index');

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
            { actorType: 'user', actorId: 'auditor-01', displayName: 'Auditor 01', roleKey: 'auditor' },
            { actorType: 'user', actorId: 'admin-01', displayName: 'Admin 01', roleKey: 'admin' },
            { actorType: 'user', actorId: 'board-01', displayName: 'Board 01', roleKey: 'board' },
            { actorType: 'user', actorId: 'board-02', displayName: 'Board 02', roleKey: 'board' },
        ],
        roles: {
            analyst: ['analyst-01'],
            auditor: ['auditor-01'],
            admin: ['admin-01'],
            board: ['board-01', 'board-02'],
        },
        queues: {
            'compliance-analysts': ['analyst-01'],
        },
        delegates: {},
    });
}

function createDriftEvent(overrides = {}) {
    return {
        eventId: 'evt-nlp-audit-001',
        idempotencyKey: 'dedupe-nlp-audit-001',
        eventType: 'nlp.drift.detected',
        sourceFamily: 'nlp',
        occurredAt: '2026-04-07T12:00:00.000Z',
        ingestedAt: '2026-04-07T12:00:01.000Z',
        severity: 'high',
        authority: 'SAMA',
        actor: {
            actorType: 'user',
            actorId: 'analyst-01',
            displayName: 'Analyst 01',
            roleKey: 'analyst',
        },
        entityScope: {},
        correlation: {
            alertId: 'DRIFT-900',
            evidenceKey: 'EVID-TRIGGER-001',
        },
        evidenceRefs: [
            {
                refType: 'instruction_drift',
                refId: 'DRIFT-900',
                refHash: 'hash-drift-trigger',
            },
        ],
        payload: {
            alertId: 'DRIFT-900',
            title: 'Fee cap changed',
        },
        ...overrides,
    };
}

describe('workflow audit ledger service', () => {
    it('combines governance and runtime history into immutable ledger views', () => {
        const governanceClock = createClock('2026-04-07T09:00:00.000Z');
        const runtimeClock = createClock('2026-04-07T12:00:00.000Z');
        const governance = createWorkflowGovernanceService({
            definitions: [publish(loadDefinition('fixtures/phase2-workflow/workflows/regulatory-drift-review.workflow.json'))],
            clock: governanceClock,
        });
        const draft = governance.createDraftVersion('regulatory-drift-review', {
            sourceVersion: 1,
            actor: { actorType: 'user', actorId: 'admin-01', displayName: 'Admin 01', roleKey: 'admin' },
            changeSummary: 'Tune escalation wording',
            definitionPatch: {
                description: 'Updated draft for audit-ledger testing',
            },
        });
        governance.publishWorkflowVersion('regulatory-drift-review', draft.version, {
            actor: { actorType: 'user', actorId: 'admin-01', displayName: 'Admin 01', roleKey: 'admin' },
            approvalRecord: {
                approvalRecordId: 'APR-900',
            },
        });

        const runtime = createWorkflowExecutionService({
            definitions: governance.getPublishedDefinitions(),
            actorDirectory: createActorDirectory(),
            clock: runtimeClock,
        });
        const started = runtime.startForEvent(createDriftEvent())[0].instance;
        runtime.advanceInstance(started.instanceId, { outcome: 'onSuccess' });
        runtime.advanceInstance(started.instanceId, {
            outcome: 'onSuccess',
            evidenceRefs: [
                {
                    refType: 'regulatory_staging',
                    refId: 'RULE-22',
                    refHash: 'hash-rule-22',
                },
            ],
        });
        runtime.recordApprovalDecision(started.instanceId, {
            actor: { actorType: 'user', actorId: 'auditor-01', displayName: 'Auditor 01', roleKey: 'auditor' },
            decision: 'approve',
            evidenceRefs: [
                {
                    refType: 'vault_evidence',
                    refId: 'EVID-DEC-001',
                    refHash: 'hash-evid-dec-001',
                },
            ],
        });

        const ledger = createWorkflowAuditLedgerService({
            runtime,
            governance,
        });
        const auditView = ledger.getInstanceAuditView(started.instanceId);

        assert.equal(auditView.runtimeAuditLedger.some(entry => entry.entryType === 'approval_recorded'), true);
        assert.equal(auditView.governanceAuditLedger.some(entry => entry.entryType === 'workflow_published'), true);
        assert.equal(auditView.combinedAuditLedger.some(entry => entry.sourceType === 'runtime'), true);
        assert.equal(auditView.combinedAuditLedger.some(entry => entry.sourceType === 'governance'), true);

        auditView.runtimeAuditLedger[0].summary = 'mutated';
        auditView.evidenceLinks[0].linkedStepKeys.push('mutated-step');

        const freshView = ledger.getInstanceAuditView(started.instanceId);
        assert.notEqual(freshView.runtimeAuditLedger[0].summary, 'mutated');
        assert.equal(freshView.evidenceLinks.some(link => link.linkedStepKeys.includes('mutated-step')), false);
    });

    it('builds evidence-linked decision history with stable audit linkage', () => {
        const runtime = createWorkflowExecutionService({
            definitions: [publish(loadDefinition('fixtures/phase2-workflow/workflows/regulatory-drift-review.workflow.json'))],
            actorDirectory: createActorDirectory(),
            clock: createClock(),
        });

        const started = runtime.startForEvent(createDriftEvent({
            idempotencyKey: 'dedupe-nlp-audit-002',
            eventId: 'evt-nlp-audit-002',
        }))[0].instance;
        runtime.advanceInstance(started.instanceId, { outcome: 'onSuccess' });
        runtime.advanceInstance(started.instanceId, {
            outcome: 'onSuccess',
            evidenceRefs: [
                {
                    refType: 'obligation',
                    refId: 'OBL-19',
                    refHash: 'hash-obl-19',
                },
            ],
        });
        runtime.recordApprovalDecision(started.instanceId, {
            actor: { actorType: 'user', actorId: 'auditor-01', displayName: 'Auditor 01', roleKey: 'auditor' },
            decision: 'approve',
            notes: 'Validated against source pack',
            payload: {
                rationaleCode: 'legal-ok',
            },
            evidenceRefs: [
                {
                    refType: 'vault_evidence',
                    refId: 'EVID-DEC-002',
                    refHash: 'hash-evid-dec-002',
                },
            ],
        });

        const ledger = createWorkflowAuditLedgerService({ runtime });
        const history = ledger.getDecisionHistory(started.instanceId);
        assert.equal(history.length, 1);
        assert.equal(history[0].approvalMode, 'maker_checker');
        assert.equal(history[0].linkedAuditEntryIds.length >= 1, true);
        assert.equal(history[0].evidenceRefs[0].refId, 'EVID-DEC-002');

        const evidenceLinks = ledger.listEvidenceLinks(started.instanceId);
        const approvalEvidence = evidenceLinks.find(link => link.refId === 'EVID-DEC-002');
        assert.ok(approvalEvidence);
        assert.equal(approvalEvidence.linkedDecisionRecordIds.includes(history[0].decisionRecordId), true);
        assert.equal(approvalEvidence.linkedAuditEntryIds.length >= 1, true);
        assert.equal(approvalEvidence.linkedStepKeys.includes('request-legal-review'), true);
    });
});
