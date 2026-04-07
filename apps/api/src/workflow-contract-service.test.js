const fs = require('fs');
const path = require('path');
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { createWorkflowContractService } = require('./workflow-contract-service');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');

function loadJson(relativePath) {
    return JSON.parse(fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8'));
}

function createClock(startAt = '2026-04-07T12:00:00.000Z') {
    let current = new Date(startAt).getTime();
    return () => {
        current += 1000;
        return new Date(current);
    };
}

describe('workflow contract service', () => {
    it('loads bundled workflow fixtures and exposes published definition views', () => {
        const service = createWorkflowContractService({
            runtimeClock: createClock('2026-04-07T12:00:00.000Z'),
            governanceClock: createClock('2026-04-07T09:00:00.000Z'),
        });

        const fixtures = service.listDefinitionFixtures();
        const published = service.listDefinitions({ status: 'published' });

        assert.equal(fixtures.length, 3);
        assert.equal(published.length, 3);
        assert.deepEqual(
            published.map(item => item.workflowKey),
            ['cross-authority-committee-review', 'regulatory-drift-review', 'visual-branch-remediation']
        );
        assert.equal(fixtures.every(item => item.sourceStatus === 'draft'), true);
    });

    it('validates, matches, starts, and audits workflow instances through one delivery seam', () => {
        const service = createWorkflowContractService({
            runtimeClock: createClock('2026-04-07T12:00:00.000Z'),
            governanceClock: createClock('2026-04-07T09:00:00.000Z'),
        });

        const definition = loadJson('fixtures/phase2-workflow/workflows/regulatory-drift-review.workflow.json');
        const event = loadJson('fixtures/phase2-workflow/contracts/requests/workflow-event-start.request.json');
        const validation = service.validateDefinitionDocument(definition, 'regulatory-drift-review.workflow.json');
        assert.equal(validation.valid, true);

        const matches = service.matchEvent(event.event);
        assert.equal(matches.length, 1);
        assert.equal(matches[0].workflowKey, 'regulatory-drift-review');

        const results = service.startForEvent(event.event, { actor: event.actor });
        assert.equal(results.length, 1);
        assert.equal(results[0].status, 'started');

        const instanceId = results[0].instanceId;
        const auditView = service.getInstanceAuditView(instanceId);
        assert.ok(auditView);
        assert.equal(auditView.runtimeAuditLedger.some(entry => entry.entryType === 'instance_created'), true);
        assert.equal(auditView.governanceAuditLedger.some(entry => entry.entryType === 'definition_registered'), true);
    });

    it('syncs published workflow versions back into runtime matching after governance actions', () => {
        const service = createWorkflowContractService({
            runtimeClock: createClock('2026-04-07T12:00:00.000Z'),
            governanceClock: createClock('2026-04-07T09:00:00.000Z'),
        });

        const event = loadJson('fixtures/phase2-workflow/contracts/requests/workflow-event-match.request.json');
        const draft = service.createDraftVersion('regulatory-drift-review', {
            sourceVersion: 1,
            actor: { actorType: 'user', actorId: 'admin-01', displayName: 'Admin 01', roleKey: 'admin' },
            changeSummary: 'Raise contract version for API publication',
            definitionPatch: {
                description: 'Published through workflow contract service',
            },
        });

        const published = service.publishWorkflowVersion('regulatory-drift-review', draft.version, {
            actor: { actorType: 'user', actorId: 'admin-01', displayName: 'Admin 01', roleKey: 'admin' },
            approvalRecord: {
                approvalRecordId: 'APR-P2-110',
                approvedBy: 'Architecture Board',
            },
        });

        assert.equal(published.version, 2);
        assert.equal(service.getWorkflowDefinition('regulatory-drift-review', { publishedOnly: true }).version, 2);
        assert.equal(service.matchEvent(event.event)[0].version, 2);
    });
});
