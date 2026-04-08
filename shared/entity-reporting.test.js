const fs = require('fs');
const path = require('path');
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { buildEntityHierarchyCatalog } = require('./entity-hierarchy');
const { buildEntityScopingCatalog } = require('./entity-scoping');
const { buildEntityIsolationCatalog } = require('./entity-isolation');
const { buildEntityRollupCatalog } = require('./entity-rollup');
const {
    buildEntityReportingCatalog,
    generateEntityReport,
    validateEntityReportingDocument,
} = require('./entity-reporting');

const REPO_ROOT = path.resolve(__dirname, '..');

function loadFixture(relativePath) {
    return JSON.parse(fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8'));
}

function buildReferences() {
    const hierarchyCatalog = buildEntityHierarchyCatalog(
        loadFixture('fixtures/phase2-entity/hierarchies/saqr-reference-group.hierarchy.json'),
        'saqr-reference-group.hierarchy.json'
    );
    const scopingCatalog = buildEntityScopingCatalog(
        loadFixture('fixtures/phase2-entity/scoping/saqr-reference-entity-scoping.scoping.json'),
        hierarchyCatalog,
        'saqr-reference-entity-scoping.scoping.json'
    );
    const isolationCatalog = buildEntityIsolationCatalog(
        loadFixture('fixtures/phase2-entity/isolation/saqr-reference-entity-isolation.isolation.json'),
        'saqr-reference-entity-isolation.isolation.json'
    );
    const rollupCatalog = buildEntityRollupCatalog(
        loadFixture('fixtures/phase2-entity/rollups/saqr-reference-portfolio-rollup.rollup.json'),
        hierarchyCatalog,
        'saqr-reference-portfolio-rollup.rollup.json'
    );

    return {
        hierarchyCatalog,
        scopingCatalog,
        isolationCatalog,
        rollupCatalog,
        hierarchyRef: { hierarchyKey: hierarchyCatalog.hierarchyKey, version: hierarchyCatalog.version },
        scopingRef: { modelKey: scopingCatalog.modelKey, version: scopingCatalog.version },
        isolationRef: { modelKey: isolationCatalog.modelKey, version: isolationCatalog.version },
        rollupRef: { modelKey: rollupCatalog.modelKey, version: rollupCatalog.version },
    };
}

describe('entity reporting model', () => {
    it('validates and builds the reference reporting catalog', () => {
        const references = buildReferences();
        const fixture = loadFixture('fixtures/phase2-entity/reports/saqr-reference-executive-reporting.report.json');
        const errors = validateEntityReportingDocument(fixture, references, 'saqr-reference-executive-reporting.report.json');
        assert.deepEqual(errors, []);

        const catalog = buildEntityReportingCatalog(fixture, references, 'saqr-reference-executive-reporting.report.json');
        assert.equal(catalog.reportDefinitions.length, 3);
        assert.equal(catalog.reportDefinitions[0].viewType, 'executive_summary');
    });

    it('generates a group executive summary with aggregated highlights', () => {
        const references = buildReferences();
        const reportingCatalog = buildEntityReportingCatalog(
            loadFixture('fixtures/phase2-entity/reports/saqr-reference-executive-reporting.report.json'),
            references,
            'saqr-reference-executive-reporting.report.json'
        );

        const report = generateEntityReport(reportingCatalog, references, {
            principalId: 'usr-group-board',
            reportKey: 'group-executive-summary',
            targetScope: {
                groupId: 'grp-saqr'
            },
        });

        assert.equal(report.boundaryMode, 'aggregate_read_only');
        assert.equal(report.rootLevel, 'group');
        assert.equal(report.overallStatus, 'breached');
        assert.equal(report.nodeCount, 10);
        assert.equal(report.controlHighlights[0].controlKey, 'bank-consumer-disclosure');
        assert.equal(report.nodeHighlights[0].nodeId, 'site-riyadh-hq');
    });

    it('generates an entity portfolio view and blocks principals without reporting grants', () => {
        const references = buildReferences();
        const reportingCatalog = buildEntityReportingCatalog(
            loadFixture('fixtures/phase2-entity/reports/saqr-reference-executive-reporting.report.json'),
            references,
            'saqr-reference-executive-reporting.report.json'
        );

        const entityReport = generateEntityReport(reportingCatalog, references, {
            principalId: 'usr-group-compliance',
            reportKey: 'entity-portfolio-summary',
            targetScope: {
                entityId: 'ent-saqr-bank-ksa'
            },
        });

        assert.equal(entityReport.rootLevel, 'entity');
        assert.equal(entityReport.boundaryMode, 'aggregate_read_only');
        assert.ok(entityReport.nodeHighlights.every(item => ['businessUnit', 'site', 'silo'].includes(item.level)));

        assert.throws(() => generateEntityReport(reportingCatalog, references, {
            principalId: 'usr-bank-entity-ops',
            reportKey: 'entity-portfolio-summary',
            targetScope: {
                entityId: 'ent-saqr-bank-ksa'
            },
        }), /no matching scope grant/);
    });

    it('rejects invalid report definitions and unsupported target root levels', () => {
        const references = buildReferences();
        const invalid = structuredClone(loadFixture('fixtures/phase2-entity/reports/saqr-reference-executive-reporting.report.json'));
        invalid.reportDefinitions.push({
            reportKey: 'bad-report',
            name: 'Bad Report',
            viewType: 'graph',
            targetRootLevels: ['district'],
            maxControlHighlights: 0,
            maxNodeHighlights: 0
        });

        const errors = validateEntityReportingDocument(invalid, references, 'invalid.report.json');
        assert.ok(errors.some(error => error.includes('unsupported viewType')));
        assert.ok(errors.some(error => error.includes('unsupported targetRootLevel')));

        const reportingCatalog = buildEntityReportingCatalog(
            loadFixture('fixtures/phase2-entity/reports/saqr-reference-executive-reporting.report.json'),
            references,
            'saqr-reference-executive-reporting.report.json'
        );
        assert.throws(() => generateEntityReport(reportingCatalog, references, {
            principalId: 'usr-group-board',
            reportKey: 'group-executive-summary',
            targetScope: {
                entityId: 'ent-saqr-bank-ksa'
            },
        }), /does not support root level/);
    });
});
