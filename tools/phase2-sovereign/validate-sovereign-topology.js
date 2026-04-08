#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const {
    buildSovereignTopologyCatalog,
    listTopologyPatterns,
    resolveComponentPlacement,
    validateSovereignTopologyDocument,
} = require('../../shared/sovereign-topology');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_TOPOLOGY_DIR = path.join(REPO_ROOT, 'fixtures', 'phase2-sovereign', 'topologies');

function loadJson(filePath) {
    return JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8'));
}

function findTopologyFiles(targets) {
    if (targets.length > 0) {
        return targets.map((target) => path.resolve(REPO_ROOT, target));
    }

    if (!fs.existsSync(DEFAULT_TOPOLOGY_DIR)) {
        return [];
    }

    return fs.readdirSync(DEFAULT_TOPOLOGY_DIR)
        .filter((name) => name.endsWith('.topology.json'))
        .sort()
        .map((name) => path.join(DEFAULT_TOPOLOGY_DIR, name));
}

function main() {
    const targets = process.argv.slice(2);
    const topologyFiles = findTopologyFiles(targets);

    if (topologyFiles.length === 0) {
        console.error('[phase2:sovereign] no sovereign topology definition files found');
        process.exit(1);
    }

    let failureCount = 0;

    for (const topologyFile of topologyFiles) {
        const relativePath = path.relative(REPO_ROOT, topologyFile);
        let document;

        try {
            document = loadJson(topologyFile);
        } catch (error) {
            console.error(`[phase2:sovereign] FAIL ${relativePath}: ${error.message}`);
            failureCount += 1;
            continue;
        }

        const errors = validateSovereignTopologyDocument(document, relativePath);
        if (errors.length > 0) {
            console.error(`[phase2:sovereign] FAIL ${relativePath}`);
            errors.forEach((error) => console.error(`- ${error}`));
            failureCount += 1;
            continue;
        }

        const catalog = buildSovereignTopologyCatalog(document, relativePath);
        const topologySummary = listTopologyPatterns(catalog).map((item) => item.pattern).join(', ');
        const preview = resolveComponentPlacement(catalog, 'per-country-sovereign-cloud', 'evidence-vault');

        console.log(
            `[phase2:sovereign] PASS ${relativePath} (${catalog.supportedTopologies.length} topologies; patterns=${topologySummary}; preview=${preview.componentKey}:${preview.placementMode})`
        );
    }

    if (failureCount > 0) {
        process.exit(1);
    }

    console.log(`[phase2:sovereign] validated ${topologyFiles.length} sovereign topology definition file(s)`);
}

main();
