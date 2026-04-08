const fs = require('fs');
const path = require('path');
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
    buildEntityHierarchyCatalog,
    getEntityNode,
    listAncestorNodes,
    listDescendantNodes,
    resolveEntityScope,
    validateEntityHierarchyDocument,
} = require('./entity-hierarchy');

const REPO_ROOT = path.resolve(__dirname, '..');

function loadFixture(relativePath) {
    return JSON.parse(fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8'));
}

describe('entity hierarchy domain model', () => {
    it('validates and builds a reference hierarchy catalog with derived lineage', () => {
        const fixture = loadFixture('fixtures/phase2-entity/hierarchies/saqr-reference-group.hierarchy.json');
        const errors = validateEntityHierarchyDocument(fixture, 'saqr-reference-group.hierarchy.json');
        assert.deepEqual(errors, []);

        const catalog = buildEntityHierarchyCatalog(fixture, 'saqr-reference-group.hierarchy.json');
        const silo = getEntityNode(catalog, 'silo-riyadh-customer-hall');
        assert.equal(silo.lineage.groupId, 'grp-saqr');
        assert.equal(silo.lineage.entityId, 'ent-saqr-bank-ksa');
        assert.equal(silo.lineage.businessUnitId, 'bu-retail-banking');
        assert.equal(silo.lineage.siteId, 'site-riyadh-hq');
        assert.equal(silo.lineage.siloId, 'silo-riyadh-customer-hall');
    });

    it('resolves partial scopes and supports direct site-under-entity lineage', () => {
        const fixture = loadFixture('fixtures/phase2-entity/hierarchies/saqr-reference-group.hierarchy.json');
        const catalog = buildEntityHierarchyCatalog(fixture, 'saqr-reference-group.hierarchy.json');

        const siteScope = resolveEntityScope(catalog, {
            siteId: 'site-jeddah-digital-ops',
        });
        assert.equal(siteScope.groupId, 'grp-saqr');
        assert.equal(siteScope.entityId, 'ent-saqr-bank-ksa');
        assert.equal(siteScope.businessUnitId, null);
        assert.equal(siteScope.siteId, 'site-jeddah-digital-ops');

        const siloScope = resolveEntityScope(catalog, {
            groupId: 'grp-saqr',
            entityId: 'ent-saqr-bank-ksa',
            siloId: 'silo-riyadh-customer-hall',
        });
        assert.equal(siloScope.businessUnitId, 'bu-retail-banking');
        assert.equal(siloScope.siteId, 'site-riyadh-hq');
    });

    it('lists ancestors and descendants and rejects invalid parent chains or conflicting scopes', () => {
        const fixture = loadFixture('fixtures/phase2-entity/hierarchies/saqr-reference-group.hierarchy.json');
        const catalog = buildEntityHierarchyCatalog(fixture, 'saqr-reference-group.hierarchy.json');

        const ancestors = listAncestorNodes(catalog, 'silo-riyadh-customer-hall');
        assert.deepEqual(ancestors.map(node => node.nodeId), [
            'grp-saqr',
            'ent-saqr-bank-ksa',
            'bu-retail-banking',
            'site-riyadh-hq',
        ]);

        const descendants = listDescendantNodes(catalog, 'ent-saqr-bank-ksa', {
            levels: ['site', 'silo'],
        });
        assert.deepEqual(descendants.map(node => node.nodeId), [
            'site-jeddah-digital-ops',
            'site-riyadh-hq',
            'silo-jeddah-kyc-zone',
            'silo-riyadh-customer-hall',
        ]);

        assert.throws(() => resolveEntityScope(catalog, {
            entityId: 'ent-saqr-bank-ksa',
            siteId: 'site-claims-riyadh',
        }), /entity scope conflict/);

        const invalid = structuredClone(fixture);
        invalid.nodes.push({
            nodeId: 'silo-invalid',
            level: 'silo',
            name: 'Invalid Silo',
            parentNodeId: 'ent-saqr-bank-ksa',
        });
        const errors = validateEntityHierarchyDocument(invalid, 'invalid.hierarchy.json');
        assert.ok(errors.some(error => error.includes('may not have parent level "entity"')));
    });
});
