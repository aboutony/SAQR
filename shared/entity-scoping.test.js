const fs = require('fs');
const path = require('path');
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { buildEntityHierarchyCatalog } = require('./entity-hierarchy');
const {
    buildEntityScopingCatalog,
    canPrincipalAccessResource,
    classifyScopeRelation,
    listPrincipalAccessibleNodes,
    validateEntityScopingDocument,
} = require('./entity-scoping');

const REPO_ROOT = path.resolve(__dirname, '..');

function loadFixture(relativePath) {
    return JSON.parse(fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8'));
}

describe('entity scoping model', () => {
    it('validates and builds the reference scoping catalog', () => {
        const hierarchyFixture = loadFixture('fixtures/phase2-entity/hierarchies/saqr-reference-group.hierarchy.json');
        const scopingFixture = loadFixture('fixtures/phase2-entity/scoping/saqr-reference-entity-scoping.scoping.json');
        const hierarchyCatalog = buildEntityHierarchyCatalog(hierarchyFixture, 'saqr-reference-group.hierarchy.json');
        const errors = validateEntityScopingDocument(scopingFixture, hierarchyCatalog, 'saqr-reference-entity-scoping.scoping.json');
        assert.deepEqual(errors, []);

        const scopingCatalog = buildEntityScopingCatalog(scopingFixture, hierarchyCatalog, 'saqr-reference-entity-scoping.scoping.json');
        assert.equal(scopingCatalog.principals.length, 4);
        assert.equal(scopingCatalog.principals[0].grants[0].scope.groupId, 'grp-saqr');
    });

    it('allows descendant access but blocks sibling-entity access', () => {
        const hierarchyFixture = loadFixture('fixtures/phase2-entity/hierarchies/saqr-reference-group.hierarchy.json');
        const scopingFixture = loadFixture('fixtures/phase2-entity/scoping/saqr-reference-entity-scoping.scoping.json');
        const hierarchyCatalog = buildEntityHierarchyCatalog(hierarchyFixture, 'saqr-reference-group.hierarchy.json');
        const scopingCatalog = buildEntityScopingCatalog(scopingFixture, hierarchyCatalog, 'saqr-reference-entity-scoping.scoping.json');

        const allowed = canPrincipalAccessResource(
            scopingCatalog,
            hierarchyCatalog,
            'usr-bank-entity-ops',
            'workflow',
            'approve',
            { siteId: 'site-riyadh-hq' }
        );
        assert.equal(allowed.allowed, true);
        assert.equal(allowed.matchedGrantKey, 'bank-workflow-ops');

        const denied = canPrincipalAccessResource(
            scopingCatalog,
            hierarchyCatalog,
            'usr-bank-entity-ops',
            'evidence',
            'read',
            { siteId: 'site-claims-riyadh' }
        );
        assert.equal(denied.allowed, false);
        assert.match(denied.reason, /no matching scope grant/);
    });

    it('supports reporting visibility and ancestor or descendant scope classification', () => {
        const hierarchyFixture = loadFixture('fixtures/phase2-entity/hierarchies/saqr-reference-group.hierarchy.json');
        const scopingFixture = loadFixture('fixtures/phase2-entity/scoping/saqr-reference-entity-scoping.scoping.json');
        const hierarchyCatalog = buildEntityHierarchyCatalog(hierarchyFixture, 'saqr-reference-group.hierarchy.json');
        const scopingCatalog = buildEntityScopingCatalog(scopingFixture, hierarchyCatalog, 'saqr-reference-entity-scoping.scoping.json');

        const visibleNodes = listPrincipalAccessibleNodes(
            scopingCatalog,
            hierarchyCatalog,
            'usr-group-board',
            'report',
            'report',
            { levels: ['entity', 'site'] }
        );
        assert.deepEqual(
            visibleNodes.map(node => node.nodeId),
            ['ent-saqr-bank-ksa', 'ent-saqr-insurance-ksa', 'site-claims-riyadh', 'site-jeddah-digital-ops', 'site-riyadh-hq']
        );

        const relation = classifyScopeRelation(
            hierarchyCatalog,
            { entityId: 'ent-saqr-bank-ksa' },
            { siloId: 'silo-riyadh-customer-hall' }
        );
        assert.equal(relation, 'contains');
    });

    it('rejects invalid resource types and invalid grant scopes', () => {
        const hierarchyFixture = loadFixture('fixtures/phase2-entity/hierarchies/saqr-reference-group.hierarchy.json');
        const scopingFixture = loadFixture('fixtures/phase2-entity/scoping/saqr-reference-entity-scoping.scoping.json');
        const hierarchyCatalog = buildEntityHierarchyCatalog(hierarchyFixture, 'saqr-reference-group.hierarchy.json');
        const invalid = structuredClone(scopingFixture);
        invalid.principals[0].grants.push({
            grantKey: 'bad-grant',
            resourceTypes: ['dashboard'],
            actions: ['read'],
            scopeAccess: 'self_and_descendants',
            scope: {
                siteId: 'site-unknown'
            }
        });

        const errors = validateEntityScopingDocument(invalid, hierarchyCatalog, 'invalid.scoping.json');
        assert.ok(errors.some(error => error.includes('unsupported resourceType')));
        assert.ok(errors.some(error => error.includes('invalid scope')));
    });
});
