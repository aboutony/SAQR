const fs = require('fs');
const path = require('path');
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { buildEntityHierarchyCatalog } = require('./entity-hierarchy');
const {
    buildEntityRollupCatalog,
    buildPortfolioRollup,
    buildNodeRollupSummary,
    resolveEffectiveControlStates,
    validateEntityRollupDocument,
} = require('./entity-rollup');

const REPO_ROOT = path.resolve(__dirname, '..');

function loadFixture(relativePath) {
    return JSON.parse(fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8'));
}

describe('entity roll-up model', () => {
    it('validates and builds the reference roll-up catalog', () => {
        const hierarchyCatalog = buildEntityHierarchyCatalog(
            loadFixture('fixtures/phase2-entity/hierarchies/saqr-reference-group.hierarchy.json'),
            'saqr-reference-group.hierarchy.json'
        );
        const fixture = loadFixture('fixtures/phase2-entity/rollups/saqr-reference-portfolio-rollup.rollup.json');
        const errors = validateEntityRollupDocument(fixture, hierarchyCatalog, 'saqr-reference-portfolio-rollup.rollup.json');
        assert.deepEqual(errors, []);

        const catalog = buildEntityRollupCatalog(fixture, hierarchyCatalog, 'saqr-reference-portfolio-rollup.rollup.json');
        assert.equal(catalog.controlDefinitions.length, 4);
        assert.equal(catalog.controlAssignments.length, 4);
        assert.equal(catalog.controlAssessments.length, 8);
    });

    it('resolves inherited and local-only controls correctly for descendant nodes', () => {
        const hierarchyCatalog = buildEntityHierarchyCatalog(
            loadFixture('fixtures/phase2-entity/hierarchies/saqr-reference-group.hierarchy.json'),
            'saqr-reference-group.hierarchy.json'
        );
        const rollupCatalog = buildEntityRollupCatalog(
            loadFixture('fixtures/phase2-entity/rollups/saqr-reference-portfolio-rollup.rollup.json'),
            hierarchyCatalog,
            'saqr-reference-portfolio-rollup.rollup.json'
        );

        const siteStates = resolveEffectiveControlStates(rollupCatalog, hierarchyCatalog, 'site-riyadh-hq');
        assert.deepEqual(siteStates.map(state => state.controlKey), [
            'bank-consumer-disclosure',
            'group-sanctions-screening',
            'riyadh-branch-signage',
        ]);
        assert.equal(siteStates.find(state => state.controlKey === 'riyadh-branch-signage').status, 'attention');
        assert.equal(siteStates.find(state => state.controlKey === 'bank-consumer-disclosure').status, 'breached');

        const siloStates = resolveEffectiveControlStates(rollupCatalog, hierarchyCatalog, 'silo-riyadh-customer-hall');
        assert.deepEqual(siloStates.map(state => state.controlKey), [
            'bank-consumer-disclosure',
            'group-sanctions-screening',
        ]);
        assert.equal(siloStates.find(state => state.controlKey === 'bank-consumer-disclosure').status, 'attention');
        assert.equal(siloStates.find(state => state.controlKey === 'group-sanctions-screening').status, 'not_assessed');
    });

    it('builds portfolio roll-ups with inherited-control aggregation', () => {
        const hierarchyCatalog = buildEntityHierarchyCatalog(
            loadFixture('fixtures/phase2-entity/hierarchies/saqr-reference-group.hierarchy.json'),
            'saqr-reference-group.hierarchy.json'
        );
        const rollupCatalog = buildEntityRollupCatalog(
            loadFixture('fixtures/phase2-entity/rollups/saqr-reference-portfolio-rollup.rollup.json'),
            hierarchyCatalog,
            'saqr-reference-portfolio-rollup.rollup.json'
        );

        const bankPortfolio = buildPortfolioRollup(rollupCatalog, hierarchyCatalog, 'ent-saqr-bank-ksa');
        assert.equal(bankPortfolio.nodeCount, 6);
        assert.equal(bankPortfolio.overallStatus, 'breached');
        assert.equal(bankPortfolio.nodeStatusCounts.breached, 1);

        const disclosureRollup = bankPortfolio.controlRollups.find(item => item.controlKey === 'bank-consumer-disclosure');
        assert.equal(disclosureRollup.applicableNodeCount, 6);
        assert.equal(disclosureRollup.directNodeCount, 1);
        assert.equal(disclosureRollup.inheritedNodeCount, 5);
        assert.equal(disclosureRollup.statusCounts.breached, 1);
        assert.equal(disclosureRollup.statusCounts.attention, 1);
        assert.equal(disclosureRollup.statusCounts.compliant, 1);

        const siteSummary = buildNodeRollupSummary(rollupCatalog, hierarchyCatalog, 'site-riyadh-hq');
        assert.equal(siteSummary.overallStatus, 'breached');
        assert.equal(siteSummary.directControlCount, 1);
        assert.equal(siteSummary.inheritedControlCount, 2);
    });

    it('rejects duplicate exact assessments and invalid scopes', () => {
        const hierarchyCatalog = buildEntityHierarchyCatalog(
            loadFixture('fixtures/phase2-entity/hierarchies/saqr-reference-group.hierarchy.json'),
            'saqr-reference-group.hierarchy.json'
        );
        const invalid = structuredClone(loadFixture('fixtures/phase2-entity/rollups/saqr-reference-portfolio-rollup.rollup.json'));
        invalid.controlAssessments.push({
            assessmentKey: 'duplicate-site-disclosure',
            controlKey: 'bank-consumer-disclosure',
            scope: {
                siteId: 'site-riyadh-hq'
            },
            status: 'attention',
            sourceType: 'workflow'
        });
        invalid.controlAssignments.push({
            assignmentKey: 'bad-scope',
            controlKey: 'group-sanctions-screening',
            inheritanceMode: 'inherit_to_descendants',
            scope: {
                siteId: 'site-unknown'
            }
        });

        const errors = validateEntityRollupDocument(invalid, hierarchyCatalog, 'invalid.rollup.json');
        assert.ok(errors.some(error => error.includes('duplicate exact control assessment')));
        assert.ok(errors.some(error => error.includes('uses invalid scope')));
    });
});
