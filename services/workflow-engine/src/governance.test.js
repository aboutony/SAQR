const fs = require('fs');
const path = require('path');
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { createWorkflowGovernanceService } = require('./index');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');

function loadDefinition(relativePath) {
    return JSON.parse(fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8'));
}

function createClock(startAt = '2026-04-07T12:00:00.000Z') {
    let current = new Date(startAt).getTime();
    return () => {
        current += 1000;
        return new Date(current);
    };
}

function approvalRecord(recordId = 'APR-001') {
    return {
        approvalRecordId: recordId,
        approvedBy: {
            actorType: 'user',
            actorId: 'admin-01',
            displayName: 'Admin 01',
            roleKey: 'admin',
        },
        approvedAt: '2026-04-07T14:00:00.000Z',
    };
}

describe('workflow governance service', () => {
    it('registers definitions and exposes version history per workflow', () => {
        const governance = createWorkflowGovernanceService({
            definitions: [
                loadDefinition('fixtures/phase2-workflow/workflows/regulatory-drift-review.workflow.json'),
                loadDefinition('fixtures/phase2-workflow/workflows/visual-branch-remediation.workflow.json'),
            ],
            clock: createClock(),
        });

        assert.deepEqual(governance.listWorkflowKeys(), ['regulatory-drift-review', 'visual-branch-remediation']);
        assert.equal(governance.listWorkflowVersions('regulatory-drift-review').length, 1);
        assert.equal(governance.listChangeHistory({ workflowKey: 'regulatory-drift-review' }).length, 1);
    });

    it('creates a new draft version from a source version and records change history', () => {
        const governance = createWorkflowGovernanceService({
            definitions: [loadDefinition('fixtures/phase2-workflow/workflows/regulatory-drift-review.workflow.json')],
            clock: createClock(),
        });

        const draft = governance.createDraftVersion('regulatory-drift-review', {
            sourceVersion: 1,
            changeSummary: 'Add a second reminder interval',
            definitionPatch: {
                slaPolicies: [
                    {
                        slaPolicyKey: 'triage-sla',
                        targetDurationMinutes: 240,
                        warningDurationMinutes: 180,
                        breachDurationMinutes: 240,
                        reminderIntervalsMinutes: [30, 60, 120, 180],
                        pauseStates: ['waiting_external'],
                        breachSeverityOverride: 'high',
                    },
                ],
            },
        });

        assert.equal(draft.version, 2);
        assert.equal(draft.status, 'draft');
        assert.equal(draft.publishControls.changeSummary, 'Add a second reminder interval');
        const history = governance.listChangeHistory({ workflowKey: 'regulatory-drift-review', version: 2 });
        assert.equal(history.some(entry => entry.entryType === 'draft_created'), true);
    });

    it('requires approval records when publishing approval-gated workflows and deprecates older published versions', () => {
        const governance = createWorkflowGovernanceService({
            definitions: [loadDefinition('fixtures/phase2-workflow/workflows/regulatory-drift-review.workflow.json')],
            clock: createClock(),
        });

        assert.throws(
            () => governance.publishWorkflowVersion('regulatory-drift-review', 1),
            /approvalRecord/
        );

        const firstPublished = governance.publishWorkflowVersion('regulatory-drift-review', 1, {
            approvalRecord: approvalRecord('APR-101'),
        });
        assert.equal(firstPublished.status, 'published');

        const draft = governance.createDraftVersion('regulatory-drift-review', {
            sourceVersion: 1,
            changeSummary: 'Prepare revised governance draft',
        });
        const secondPublished = governance.publishWorkflowVersion('regulatory-drift-review', draft.version, {
            approvalRecord: approvalRecord('APR-102'),
        });

        assert.equal(secondPublished.status, 'published');
        const original = governance.getWorkflowVersion('regulatory-drift-review', 1);
        assert.equal(original.status, 'deprecated');
        assert.equal(original.replacedByVersion, 2);
        assert.equal(governance.getPublishedWorkflow('regulatory-drift-review').version, 2);
    });

    it('creates rollback versions as new published versions and preserves change history', () => {
        const governance = createWorkflowGovernanceService({
            definitions: [loadDefinition('fixtures/phase2-workflow/workflows/regulatory-drift-review.workflow.json')],
            clock: createClock(),
        });

        governance.publishWorkflowVersion('regulatory-drift-review', 1, {
            approvalRecord: approvalRecord('APR-201'),
        });
        governance.createDraftVersion('regulatory-drift-review', {
            sourceVersion: 1,
            changeSummary: 'Version two with alternate queue',
            definitionPatch: {
                steps: [
                    {
                        stepKey: 'assign-compliance-analyst',
                        order: 1,
                        name: 'Assign compliance analyst',
                        stepType: 'assign',
                        actionType: 'route_to_queue',
                        assignmentRule: {
                            selectors: [
                                {
                                    type: 'queue',
                                    value: 'regulatory-ops'
                                }
                            ]
                        },
                        slaPolicyRef: 'triage-sla',
                        transitions: {
                            onSuccess: 'collect-source-evidence'
                        }
                    },
                    ...loadDefinition('fixtures/phase2-workflow/workflows/regulatory-drift-review.workflow.json').steps.slice(1),
                ],
            },
        });
        governance.publishWorkflowVersion('regulatory-drift-review', 2, {
            approvalRecord: approvalRecord('APR-202'),
        });

        const rolledBack = governance.rollbackWorkflowVersion('regulatory-drift-review', 1, {
            changeSummary: 'Rollback to version 1 after governance review',
            approvalRecord: approvalRecord('APR-203'),
        });

        assert.equal(rolledBack.version, 3);
        assert.equal(rolledBack.status, 'published');
        assert.equal(rolledBack.publishControls.rollbackOfVersion, 1);
        assert.equal(governance.getPublishedWorkflow('regulatory-drift-review').version, 3);

        const history = governance.listChangeHistory({ workflowKey: 'regulatory-drift-review' });
        assert.equal(history.some(entry => entry.entryType === 'workflow_rollback_created'), true);
        assert.equal(history.some(entry => entry.entryType === 'workflow_published' && entry.version === 3), true);
    });

    it('provides published definitions for runtime consumption', () => {
        const governance = createWorkflowGovernanceService({
            definitions: [
                loadDefinition('fixtures/phase2-workflow/workflows/regulatory-drift-review.workflow.json'),
                loadDefinition('fixtures/phase2-workflow/workflows/visual-branch-remediation.workflow.json'),
            ],
            clock: createClock(),
        });

        governance.publishWorkflowVersion('regulatory-drift-review', 1, {
            approvalRecord: approvalRecord('APR-301'),
        });

        const published = governance.getPublishedDefinitions();
        assert.equal(published.length, 1);
        assert.equal(published[0].workflowKey, 'regulatory-drift-review');
        assert.equal(published[0].status, 'published');
    });
});
