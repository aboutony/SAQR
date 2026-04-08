#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { buildSovereignTopologyCatalog } = require('../../shared/sovereign-topology');
const {
    buildSovereignPolicyCatalog,
    evaluateCrossBorderMovement,
    validateSovereignPolicyDocument,
} = require('../../shared/sovereign-policy');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_TOPOLOGY_FILE = path.join(REPO_ROOT, 'fixtures', 'phase2-sovereign', 'topologies', 'saqr-reference-sovereign-topology.topology.json');
const DEFAULT_POLICY_DIR = path.join(REPO_ROOT, 'fixtures', 'phase2-sovereign', 'policies');

function loadJson(filePath) {
    return JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8'));
}

function findPolicyFiles(targets) {
    if (targets.length > 0) {
        return targets.map((target) => path.resolve(REPO_ROOT, target));
    }

    if (!fs.existsSync(DEFAULT_POLICY_DIR)) {
        return [];
    }

    return fs.readdirSync(DEFAULT_POLICY_DIR)
        .filter((name) => name.endsWith('.policy.json'))
        .sort()
        .map((name) => path.join(DEFAULT_POLICY_DIR, name));
}

function main() {
    const targets = process.argv.slice(2);
    const policyFiles = findPolicyFiles(targets);

    if (policyFiles.length === 0) {
        console.error('[phase2:sovereign:policy] no sovereign policy definition files found');
        process.exit(1);
    }

    const topologyCatalog = buildSovereignTopologyCatalog(
        loadJson(DEFAULT_TOPOLOGY_FILE),
        path.relative(REPO_ROOT, DEFAULT_TOPOLOGY_FILE)
    );

    let failureCount = 0;

    for (const policyFile of policyFiles) {
        const relativePath = path.relative(REPO_ROOT, policyFile);
        let document;

        try {
            document = loadJson(policyFile);
        } catch (error) {
            console.error(`[phase2:sovereign:policy] FAIL ${relativePath}: ${error.message}`);
            failureCount += 1;
            continue;
        }

        const errors = validateSovereignPolicyDocument(document, topologyCatalog, relativePath);
        if (errors.length > 0) {
            console.error(`[phase2:sovereign:policy] FAIL ${relativePath}`);
            errors.forEach((error) => console.error(`- ${error}`));
            failureCount += 1;
            continue;
        }

        const catalog = buildSovereignPolicyCatalog(document, topologyCatalog, relativePath);
        const preview = evaluateCrossBorderMovement(catalog, topologyCatalog, {
            topologyKey: 'per-country-sovereign-cloud',
            dataClass: 'reporting_aggregates',
            sourceBoundaryId: 'sa',
            destinationBoundaryId: 'ae',
            movementKind: 'export',
            brokered: true,
        });

        console.log(
            `[phase2:sovereign:policy] PASS ${relativePath} (${catalog.policyRules.length} policy rules; preview=${preview.dataClass}:${preview.crossBorderMode}:${preview.allowed ? 'allow' : 'deny'})`
        );
    }

    if (failureCount > 0) {
        process.exit(1);
    }

    console.log(`[phase2:sovereign:policy] validated ${policyFiles.length} sovereign policy definition file(s)`);
}

main();
