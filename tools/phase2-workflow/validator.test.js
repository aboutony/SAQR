const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { loadWorkflowDefinition, validateWorkflowDefinition } = require('./validator');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

test('bundled workflow definitions pass validation', () => {
    const fixtures = [
        'fixtures/phase2-workflow/workflows/regulatory-drift-review.workflow.json',
        'fixtures/phase2-workflow/workflows/visual-branch-remediation.workflow.json',
        'fixtures/phase2-workflow/workflows/cross-authority-committee-review.workflow.json',
    ];

    for (const fixture of fixtures) {
        const absolutePath = path.join(REPO_ROOT, fixture);
        const document = loadWorkflowDefinition(absolutePath);
        const errors = validateWorkflowDefinition(document, fixture);
        assert.deepEqual(errors, [], `expected no validation errors for ${fixture}`);
    }
});

test('invalid approval step, selector grammar, and unreachable step are rejected', () => {
    const broken = {
        schemaVersion: 1,
        workflowKey: 'broken-workflow',
        version: 1,
        name: 'Broken Workflow',
        status: 'draft',
        entryStepKey: 'triage',
        triggers: [
            {
                triggerKey: 'manual-trigger',
                sourceFamilies: ['manual'],
                eventTypes: ['workflow.manual.triggered'],
                matchRules: [
                    {
                        field: 'payload.launchCategory',
                        operator: 'equals',
                        value: 'broken'
                    }
                ]
            }
        ],
        approvalPolicies: [
            {
                approvalPolicyKey: 'broken-approval',
                mode: 'maker_checker',
                minimumApprovals: 1,
                approverSelectors: [
                    {
                        type: 'district',
                        value: ''
                    }
                ]
            }
        ],
        slaPolicies: [
            {
                slaPolicyKey: 'broken-sla',
                targetDurationMinutes: 10,
                breachDurationMinutes: 20,
                pauseStates: ['']
            }
        ],
        escalationPolicies: [
            {
                escalationPolicyKey: 'broken-escalation',
                triggerCondition: 'after_lunch',
                targetType: 'role',
                targetRef: 'admin'
            }
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
                        {
                            type: 'queue',
                            value: 'triage'
                        }
                    ]
                },
                slaPolicyRef: 'broken-sla',
                transitions: {
                    onSuccess: 'approval'
                }
            },
            {
                stepKey: 'approval',
                order: 2,
                name: 'Approval',
                stepType: 'approve',
                actionType: 'request_approval',
                approvalPolicyRef: 'broken-approval',
                escalationPolicyRefs: ['broken-escalation'],
                transitions: {
                    onApprove: null,
                    onReject: 'triage'
                }
            },
            {
                stepKey: 'orphan',
                order: 3,
                name: 'Orphan',
                stepType: 'notify',
                actionType: 'emit_notification',
                transitions: {
                    onSuccess: null
                }
            }
        ],
        publishControls: {
            changeSummary: 'Broken example',
            approvalRecordRequired: true
        }
    };

    const errors = validateWorkflowDefinition(broken, 'broken.workflow.json');
    assert.ok(errors.some(error => error.includes('unsupported type')), 'expected invalid selector type error');
    assert.ok(errors.some(error => error.includes('makerCheckerScope') || error.includes('segregationOfDuties')), 'expected maker-checker scope error');
    assert.ok(errors.some(error => error.includes('pauseStates')), 'expected invalid pauseStates error');
    assert.ok(errors.some(error => error.includes('unsupported triggerCondition')), 'expected invalid escalation trigger condition error');
    assert.ok(errors.some(error => error.includes('unreachable')), 'expected unreachable step error');
});
