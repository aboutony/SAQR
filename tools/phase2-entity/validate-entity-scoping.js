#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { buildEntityHierarchyCatalog } = require('../../shared/entity-hierarchy');
const {
    buildEntityScopingCatalog,
    validateEntityScopingDocument,
} = require('../../shared/entity-scoping');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_HIERARCHY_FILE = path.join(REPO_ROOT, 'fixtures', 'phase2-entity', 'hierarchies', 'saqr-reference-group.hierarchy.json');
const DEFAULT_SCOPING_DIR = path.join(REPO_ROOT, 'fixtures', 'phase2-entity', 'scoping');

function loadJson(filePath) {
    return JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8'));
}

function findScopingFiles(targets) {
    if (targets.length > 0) {
        return targets.map(target => path.resolve(REPO_ROOT, target));
    }

    if (!fs.existsSync(DEFAULT_SCOPING_DIR)) {
        return [];
    }

    return fs.readdirSync(DEFAULT_SCOPING_DIR)
        .filter(name => name.endsWith('.scoping.json'))
        .sort()
        .map(name => path.join(DEFAULT_SCOPING_DIR, name));
}

function summarizePrincipals(scopingCatalog) {
    return scopingCatalog.principals
        .map(principal => `${principal.principalId}:${principal.grants.length}`)
        .join(', ');
}

function main() {
    const targets = process.argv.slice(2);
    const scopingFiles = findScopingFiles(targets);

    if (scopingFiles.length === 0) {
        console.error('[phase2:entity:scope] no scoping definition files found');
        process.exit(1);
    }

    let hierarchyCatalog;
    try {
        hierarchyCatalog = buildEntityHierarchyCatalog(
            loadJson(DEFAULT_HIERARCHY_FILE),
            path.relative(REPO_ROOT, DEFAULT_HIERARCHY_FILE)
        );
    } catch (error) {
        console.error(`[phase2:entity:scope] FAIL hierarchy: ${error.message}`);
        process.exit(1);
    }

    let failureCount = 0;

    for (const scopingFile of scopingFiles) {
        const relativePath = path.relative(REPO_ROOT, scopingFile);
        let document;

        try {
            document = loadJson(scopingFile);
        } catch (error) {
            console.error(`[phase2:entity:scope] FAIL ${relativePath}: ${error.message}`);
            failureCount += 1;
            continue;
        }

        const errors = validateEntityScopingDocument(document, hierarchyCatalog, relativePath);
        if (errors.length > 0) {
            console.error(`[phase2:entity:scope] FAIL ${relativePath}`);
            errors.forEach(error => console.error(`- ${error}`));
            failureCount += 1;
            continue;
        }

        const scopingCatalog = buildEntityScopingCatalog(document, hierarchyCatalog, relativePath);
        console.log(
            `[phase2:entity:scope] PASS ${relativePath} (${scopingCatalog.principals.length} principals; ${summarizePrincipals(scopingCatalog)})`
        );
    }

    if (failureCount > 0) {
        process.exit(1);
    }

    console.log(`[phase2:entity:scope] validated ${scopingFiles.length} scoping definition file(s)`);
}

main();
