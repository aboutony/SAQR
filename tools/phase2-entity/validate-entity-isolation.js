#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const {
    buildEntityIsolationCatalog,
    validateEntityIsolationDocument,
} = require('../../shared/entity-isolation');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_ISOLATION_DIR = path.join(REPO_ROOT, 'fixtures', 'phase2-entity', 'isolation');

function loadJson(filePath) {
    return JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8'));
}

function findIsolationFiles(targets) {
    if (targets.length > 0) {
        return targets.map(target => path.resolve(REPO_ROOT, target));
    }

    if (!fs.existsSync(DEFAULT_ISOLATION_DIR)) {
        return [];
    }

    return fs.readdirSync(DEFAULT_ISOLATION_DIR)
        .filter(name => name.endsWith('.isolation.json'))
        .sort()
        .map(name => path.join(DEFAULT_ISOLATION_DIR, name));
}

function summarizePolicies(catalog) {
    return catalog.resourcePolicies
        .map(policy => `${policy.resourceType}:${policy.partitionLevel}`)
        .join(', ');
}

function main() {
    const targets = process.argv.slice(2);
    const isolationFiles = findIsolationFiles(targets);

    if (isolationFiles.length === 0) {
        console.error('[phase2:entity:isolation] no isolation definition files found');
        process.exit(1);
    }

    let failureCount = 0;

    for (const isolationFile of isolationFiles) {
        const relativePath = path.relative(REPO_ROOT, isolationFile);
        let document;

        try {
            document = loadJson(isolationFile);
        } catch (error) {
            console.error(`[phase2:entity:isolation] FAIL ${relativePath}: ${error.message}`);
            failureCount += 1;
            continue;
        }

        const errors = validateEntityIsolationDocument(document, relativePath);
        if (errors.length > 0) {
            console.error(`[phase2:entity:isolation] FAIL ${relativePath}`);
            errors.forEach(error => console.error(`- ${error}`));
            failureCount += 1;
            continue;
        }

        const catalog = buildEntityIsolationCatalog(document, relativePath);
        console.log(
            `[phase2:entity:isolation] PASS ${relativePath} (${catalog.resourcePolicies.length} policies; ${summarizePolicies(catalog)})`
        );
    }

    if (failureCount > 0) {
        process.exit(1);
    }

    console.log(`[phase2:entity:isolation] validated ${isolationFiles.length} isolation definition file(s)`);
}

main();
