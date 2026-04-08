#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { buildEntityHierarchyCatalog } = require('../../shared/entity-hierarchy');
const {
    buildEntityRollupCatalog,
    buildPortfolioRollup,
    validateEntityRollupDocument,
} = require('../../shared/entity-rollup');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_HIERARCHY_FILE = path.join(REPO_ROOT, 'fixtures', 'phase2-entity', 'hierarchies', 'saqr-reference-group.hierarchy.json');
const DEFAULT_ROLLUP_DIR = path.join(REPO_ROOT, 'fixtures', 'phase2-entity', 'rollups');

function loadJson(filePath) {
    return JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8'));
}

function findRollupFiles(targets) {
    if (targets.length > 0) {
        return targets.map(target => path.resolve(REPO_ROOT, target));
    }

    if (!fs.existsSync(DEFAULT_ROLLUP_DIR)) {
        return [];
    }

    return fs.readdirSync(DEFAULT_ROLLUP_DIR)
        .filter(name => name.endsWith('.rollup.json'))
        .sort()
        .map(name => path.join(DEFAULT_ROLLUP_DIR, name));
}

function main() {
    const targets = process.argv.slice(2);
    const rollupFiles = findRollupFiles(targets);

    if (rollupFiles.length === 0) {
        console.error('[phase2:entity:rollup] no roll-up definition files found');
        process.exit(1);
    }

    let hierarchyCatalog;
    try {
        hierarchyCatalog = buildEntityHierarchyCatalog(
            loadJson(DEFAULT_HIERARCHY_FILE),
            path.relative(REPO_ROOT, DEFAULT_HIERARCHY_FILE)
        );
    } catch (error) {
        console.error(`[phase2:entity:rollup] FAIL hierarchy: ${error.message}`);
        process.exit(1);
    }

    let failureCount = 0;

    for (const rollupFile of rollupFiles) {
        const relativePath = path.relative(REPO_ROOT, rollupFile);
        let document;

        try {
            document = loadJson(rollupFile);
        } catch (error) {
            console.error(`[phase2:entity:rollup] FAIL ${relativePath}: ${error.message}`);
            failureCount += 1;
            continue;
        }

        const errors = validateEntityRollupDocument(document, hierarchyCatalog, relativePath);
        if (errors.length > 0) {
            console.error(`[phase2:entity:rollup] FAIL ${relativePath}`);
            errors.forEach(error => console.error(`- ${error}`));
            failureCount += 1;
            continue;
        }

        const rollupCatalog = buildEntityRollupCatalog(document, hierarchyCatalog, relativePath);
        const preview = buildPortfolioRollup(rollupCatalog, hierarchyCatalog, 'grp-saqr');
        console.log(
            `[phase2:entity:rollup] PASS ${relativePath} (${rollupCatalog.controlDefinitions.length} controls; group overall=${preview.overallStatus}; nodes=${preview.nodeCount})`
        );
    }

    if (failureCount > 0) {
        process.exit(1);
    }

    console.log(`[phase2:entity:rollup] validated ${rollupFiles.length} roll-up definition file(s)`);
}

main();
