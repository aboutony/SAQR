#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const {
    buildEntityHierarchyCatalog,
    validateEntityHierarchyDocument,
} = require('../../shared/entity-hierarchy');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_HIERARCHY_DIR = path.join(REPO_ROOT, 'fixtures', 'phase2-entity', 'hierarchies');

function findHierarchyFiles(targets) {
    if (targets.length > 0) {
        return targets.map(target => path.resolve(REPO_ROOT, target));
    }

    if (!fs.existsSync(DEFAULT_HIERARCHY_DIR)) {
        return [];
    }

    return fs.readdirSync(DEFAULT_HIERARCHY_DIR)
        .filter(name => name.endsWith('.hierarchy.json'))
        .sort()
        .map(name => path.join(DEFAULT_HIERARCHY_DIR, name));
}

function loadHierarchyDocument(filePath) {
    const absolutePath = path.resolve(filePath);
    return JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
}

function summarizeLevels(catalog) {
    const counts = new Map();
    for (const node of catalog.nodes) {
        counts.set(node.level, (counts.get(node.level) || 0) + 1);
    }

    return ['group', 'entity', 'businessUnit', 'site', 'silo']
        .filter(level => counts.has(level))
        .map(level => `${level}=${counts.get(level)}`)
        .join(', ');
}

function main() {
    const targets = process.argv.slice(2);
    const hierarchyFiles = findHierarchyFiles(targets);

    if (hierarchyFiles.length === 0) {
        console.error('[phase2:entity] no hierarchy definition files found');
        process.exit(1);
    }

    let failureCount = 0;

    for (const hierarchyFile of hierarchyFiles) {
        const relativePath = path.relative(REPO_ROOT, hierarchyFile);
        let document;

        try {
            document = loadHierarchyDocument(hierarchyFile);
        } catch (error) {
            console.error(`[phase2:entity] FAIL ${relativePath}: ${error.message}`);
            failureCount += 1;
            continue;
        }

        const errors = validateEntityHierarchyDocument(document, relativePath);
        if (errors.length > 0) {
            console.error(`[phase2:entity] FAIL ${relativePath}`);
            errors.forEach(error => console.error(`- ${error}`));
            failureCount += 1;
            continue;
        }

        const catalog = buildEntityHierarchyCatalog(document, relativePath);
        console.log(
            `[phase2:entity] PASS ${relativePath} (${catalog.nodes.length} nodes; ${summarizeLevels(catalog)})`
        );
    }

    if (failureCount > 0) {
        process.exit(1);
    }

    console.log(`[phase2:entity] validated ${hierarchyFiles.length} hierarchy definition file(s)`);
}

main();
