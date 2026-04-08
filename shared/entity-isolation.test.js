const fs = require('fs');
const path = require('path');
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { buildEntityHierarchyCatalog } = require('./entity-hierarchy');
const { buildEntityScopingCatalog } = require('./entity-scoping');
const {
    buildEntityIsolationCatalog,
    evaluateIsolationAccess,
    resolveResourceIsolationEnvelope,
    validateEntityIsolationDocument,
} = require('./entity-isolation');

const REPO_ROOT = path.resolve(__dirname, '..');

function loadFixture(relativePath) {
    return JSON.parse(fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8'));
}

describe('entity isolation model', () => {
    it('validates and builds the reference isolation catalog', () => {
        const fixture = loadFixture('fixtures/phase2-entity/isolation/saqr-reference-entity-isolation.isolation.json');
        const errors = validateEntityIsolationDocument(fixture, 'saqr-reference-entity-isolation.isolation.json');
        assert.deepEqual(errors, []);

        const catalog = buildEntityIsolationCatalog(fixture, 'saqr-reference-entity-isolation.isolation.json');
        assert.equal(catalog.resourcePolicies.length, 5);
        assert.equal(catalog.resourcePolicies.find(policy => policy.resourceType === 'workflow').partitionField, 'entityId');
    });

    it('allows same-partition operational workflow access', () => {
        const hierarchy = buildEntityHierarchyCatalog(
            loadFixture('fixtures/phase2-entity/hierarchies/saqr-reference-group.hierarchy.json'),
            'saqr-reference-group.hierarchy.json'
        );
        const scoping = buildEntityScopingCatalog(
            loadFixture('fixtures/phase2-entity/scoping/saqr-reference-entity-scoping.scoping.json'),
            hierarchy,
            'saqr-reference-entity-scoping.scoping.json'
        );
        const isolation = buildEntityIsolationCatalog(
            loadFixture('fixtures/phase2-entity/isolation/saqr-reference-entity-isolation.isolation.json'),
            'saqr-reference-entity-isolation.isolation.json'
        );

        const decision = evaluateIsolationAccess(
            scoping,
            hierarchy,
            isolation,
            'usr-bank-entity-ops',
            'workflow',
            'approve',
            { siteId: 'site-riyadh-hq' }
        );

        assert.equal(decision.allowed, true);
        assert.equal(decision.boundaryMode, 'same_partition_direct');
        assert.equal(decision.partitionKey, 'entity:ent-saqr-bank-ksa');
    });

    it('forces brokered read-only access across entity partitions', () => {
        const hierarchy = buildEntityHierarchyCatalog(
            loadFixture('fixtures/phase2-entity/hierarchies/saqr-reference-group.hierarchy.json'),
            'saqr-reference-group.hierarchy.json'
        );
        const scoping = buildEntityScopingCatalog(
            loadFixture('fixtures/phase2-entity/scoping/saqr-reference-entity-scoping.scoping.json'),
            hierarchy,
            'saqr-reference-entity-scoping.scoping.json'
        );
        const isolation = buildEntityIsolationCatalog(
            loadFixture('fixtures/phase2-entity/isolation/saqr-reference-entity-isolation.isolation.json'),
            'saqr-reference-entity-isolation.isolation.json'
        );

        const decision = evaluateIsolationAccess(
            scoping,
            hierarchy,
            isolation,
            'usr-group-compliance',
            'evidence',
            'read',
            { siteId: 'site-claims-riyadh' }
        );

        assert.equal(decision.allowed, true);
        assert.equal(decision.boundaryMode, 'brokered_read_only');
        assert.equal(decision.partitionKey, 'entity:ent-saqr-insurance-ksa');
    });

    it('keeps reporting on an aggregation plane and denies cross-entity mutation', () => {
        const hierarchy = buildEntityHierarchyCatalog(
            loadFixture('fixtures/phase2-entity/hierarchies/saqr-reference-group.hierarchy.json'),
            'saqr-reference-group.hierarchy.json'
        );
        const baseScoping = loadFixture('fixtures/phase2-entity/scoping/saqr-reference-entity-scoping.scoping.json');
        const scopingFixture = structuredClone(baseScoping);
        scopingFixture.principals.push({
            principalId: 'svc-group-workflow-control',
            principalType: 'service',
            displayName: 'Group Workflow Control',
            status: 'active',
            roleKeys: ['workflow-control'],
            homeScope: {
                groupId: 'grp-saqr'
            },
            grants: [
                {
                    grantKey: 'group-workflow-control',
                    resourceTypes: ['workflow'],
                    actions: ['read', 'launch', 'approve', 'administer'],
                    scopeAccess: 'self_and_descendants',
                    scope: {
                        groupId: 'grp-saqr'
                    }
                }
            ]
        });

        const scoping = buildEntityScopingCatalog(
            scopingFixture,
            hierarchy,
            'augmented-scoping.json'
        );
        const isolation = buildEntityIsolationCatalog(
            loadFixture('fixtures/phase2-entity/isolation/saqr-reference-entity-isolation.isolation.json'),
            'saqr-reference-entity-isolation.isolation.json'
        );

        const reportDecision = evaluateIsolationAccess(
            buildEntityScopingCatalog(baseScoping, hierarchy, 'saqr-reference-entity-scoping.scoping.json'),
            hierarchy,
            isolation,
            'usr-group-board',
            'report',
            'report',
            { entityId: 'ent-saqr-bank-ksa' }
        );
        assert.equal(reportDecision.allowed, true);
        assert.equal(reportDecision.boundaryMode, 'aggregate_read_only');
        assert.equal(reportDecision.partitionKey, 'group:grp-saqr');

        const mutateDecision = evaluateIsolationAccess(
            scoping,
            hierarchy,
            isolation,
            'svc-group-workflow-control',
            'workflow',
            'approve',
            { siteId: 'site-claims-riyadh' }
        );
        assert.equal(mutateDecision.allowed, false);
        assert.match(mutateDecision.reason, /single entity partition/);
    });

    it('rejects invalid isolation policies and resolves partition envelopes', () => {
        const fixture = loadFixture('fixtures/phase2-entity/isolation/saqr-reference-entity-isolation.isolation.json');
        const invalid = structuredClone(fixture);
        invalid.resourcePolicies[0].storagePlane = 'mixed-plane';
        const errors = validateEntityIsolationDocument(invalid, 'invalid.isolation.json');
        assert.ok(errors.some(error => error.includes('unsupported storagePlane')));

        const hierarchy = buildEntityHierarchyCatalog(
            loadFixture('fixtures/phase2-entity/hierarchies/saqr-reference-group.hierarchy.json'),
            'saqr-reference-group.hierarchy.json'
        );
        const isolation = buildEntityIsolationCatalog(
            fixture,
            'saqr-reference-entity-isolation.isolation.json'
        );
        const envelope = resolveResourceIsolationEnvelope(isolation, hierarchy, 'alert', {
            siloId: 'silo-riyadh-customer-hall'
        });
        assert.equal(envelope.partitionKey, 'entity:ent-saqr-bank-ksa');
        assert.equal(envelope.storagePlane, 'entity_data_plane');
    });
});
