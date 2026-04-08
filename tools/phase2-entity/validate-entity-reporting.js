#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { buildEntityHierarchyCatalog } = require('../../shared/entity-hierarchy');
const { buildEntityScopingCatalog } = require('../../shared/entity-scoping');
const { buildEntityIsolationCatalog } = require('../../shared/entity-isolation');
const { buildEntityRollupCatalog } = require('../../shared/entity-rollup');
const {
    buildEntityReportingCatalog,
    generateEntityReport,
    validateEntityReportingDocument,
} = require('../../shared/entity-reporting');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_HIERARCHY_FILE = path.join(REPO_ROOT, 'fixtures', 'phase2-entity', 'hierarchies', 'saqr-reference-group.hierarchy.json');
const DEFAULT_SCOPING_FILE = path.join(REPO_ROOT, 'fixtures', 'phase2-entity', 'scoping', 'saqr-reference-entity-scoping.scoping.json');
const DEFAULT_ISOLATION_FILE = path.join(REPO_ROOT, 'fixtures', 'phase2-entity', 'isolation', 'saqr-reference-entity-isolation.isolation.json');
const DEFAULT_ROLLUP_FILE = path.join(REPO_ROOT, 'fixtures', 'phase2-entity', 'rollups', 'saqr-reference-portfolio-rollup.rollup.json');
const DEFAULT_REPORTING_DIR = path.join(REPO_ROOT, 'fixtures', 'phase2-entity', 'reports');

function loadJson(filePath) {
    return JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8'));
}

function findReportingFiles(targets) {
    if (targets.length > 0) {
        return targets.map(target => path.resolve(REPO_ROOT, target));
    }

    if (!fs.existsSync(DEFAULT_REPORTING_DIR)) {
        return [];
    }

    return fs.readdirSync(DEFAULT_REPORTING_DIR)
        .filter(name => name.endsWith('.report.json'))
        .sort()
        .map(name => path.join(DEFAULT_REPORTING_DIR, name));
}

function buildReferences() {
    const hierarchyCatalog = buildEntityHierarchyCatalog(loadJson(DEFAULT_HIERARCHY_FILE), path.relative(REPO_ROOT, DEFAULT_HIERARCHY_FILE));
    const scopingCatalog = buildEntityScopingCatalog(loadJson(DEFAULT_SCOPING_FILE), hierarchyCatalog, path.relative(REPO_ROOT, DEFAULT_SCOPING_FILE));
    const isolationCatalog = buildEntityIsolationCatalog(loadJson(DEFAULT_ISOLATION_FILE), path.relative(REPO_ROOT, DEFAULT_ISOLATION_FILE));
    const rollupCatalog = buildEntityRollupCatalog(loadJson(DEFAULT_ROLLUP_FILE), hierarchyCatalog, path.relative(REPO_ROOT, DEFAULT_ROLLUP_FILE));

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

function main() {
    const targets = process.argv.slice(2);
    const reportingFiles = findReportingFiles(targets);

    if (reportingFiles.length === 0) {
        console.error('[phase2:entity:reporting] no reporting definition files found');
        process.exit(1);
    }

    const references = buildReferences();
    let failureCount = 0;

    for (const reportingFile of reportingFiles) {
        const relativePath = path.relative(REPO_ROOT, reportingFile);
        let document;

        try {
            document = loadJson(reportingFile);
        } catch (error) {
            console.error(`[phase2:entity:reporting] FAIL ${relativePath}: ${error.message}`);
            failureCount += 1;
            continue;
        }

        const errors = validateEntityReportingDocument(document, references, relativePath);
        if (errors.length > 0) {
            console.error(`[phase2:entity:reporting] FAIL ${relativePath}`);
            errors.forEach(error => console.error(`- ${error}`));
            failureCount += 1;
            continue;
        }

        const catalog = buildEntityReportingCatalog(document, references, relativePath);
        const preview = generateEntityReport(catalog, references, {
            principalId: 'usr-group-board',
            reportKey: 'group-executive-summary',
            targetScope: {
                groupId: 'grp-saqr',
            },
        });
        console.log(
            `[phase2:entity:reporting] PASS ${relativePath} (${catalog.reportDefinitions.length} reports; preview=${preview.reportKey}; status=${preview.overallStatus})`
        );
    }

    if (failureCount > 0) {
        process.exit(1);
    }

    console.log(`[phase2:entity:reporting] validated ${reportingFiles.length} reporting definition file(s)`);
}

main();
