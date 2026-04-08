#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { buildSovereignTopologyCatalog } = require('../../shared/sovereign-topology');
const { buildSovereignPolicyCatalog } = require('../../shared/sovereign-policy');
const {
    buildSovereignPackagingCatalog,
    resolveSovereignPackagingProfile,
    validateSovereignPackagingDocument,
} = require('../../shared/sovereign-packaging');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_TOPOLOGY_FILE = path.join(REPO_ROOT, 'fixtures', 'phase2-sovereign', 'topologies', 'saqr-reference-sovereign-topology.topology.json');
const DEFAULT_POLICY_FILE = path.join(REPO_ROOT, 'fixtures', 'phase2-sovereign', 'policies', 'saqr-reference-sovereign-policy.policy.json');
const DEFAULT_PACKAGING_DIR = path.join(REPO_ROOT, 'fixtures', 'phase2-sovereign', 'packaging');

function loadJson(filePath) {
    return JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8'));
}

function findPackagingFiles(targets) {
    if (targets.length > 0) {
        return targets.map((target) => path.resolve(REPO_ROOT, target));
    }

    if (!fs.existsSync(DEFAULT_PACKAGING_DIR)) {
        return [];
    }

    return fs.readdirSync(DEFAULT_PACKAGING_DIR)
        .filter((name) => name.endsWith('.package.json'))
        .sort()
        .map((name) => path.join(DEFAULT_PACKAGING_DIR, name));
}

function ensureArtifactsExist(relativePaths, errors, contextLabel) {
    relativePaths.forEach((relativePath) => {
        const absolutePath = path.resolve(REPO_ROOT, relativePath);
        if (!fs.existsSync(absolutePath)) {
            errors.push(`${contextLabel} references missing artifact "${relativePath}"`);
        }
    });
}

function main() {
    const targets = process.argv.slice(2);
    const packagingFiles = findPackagingFiles(targets);

    if (packagingFiles.length === 0) {
        console.error('[phase2:sovereign:packaging] no sovereign packaging definition files found');
        process.exit(1);
    }

    const topologyCatalog = buildSovereignTopologyCatalog(
        loadJson(DEFAULT_TOPOLOGY_FILE),
        path.relative(REPO_ROOT, DEFAULT_TOPOLOGY_FILE)
    );
    const policyCatalog = buildSovereignPolicyCatalog(
        loadJson(DEFAULT_POLICY_FILE),
        topologyCatalog,
        path.relative(REPO_ROOT, DEFAULT_POLICY_FILE)
    );

    let failureCount = 0;

    for (const packagingFile of packagingFiles) {
        const relativePath = path.relative(REPO_ROOT, packagingFile);
        let document;

        try {
            document = loadJson(packagingFile);
        } catch (error) {
            console.error(`[phase2:sovereign:packaging] FAIL ${relativePath}: ${error.message}`);
            failureCount += 1;
            continue;
        }

        const errors = validateSovereignPackagingDocument(document, topologyCatalog, policyCatalog, relativePath);
        (document.packageProfiles || []).forEach((profile) => {
            const profileArtifacts = [
                ...(Array.isArray(profile.composeFiles) ? profile.composeFiles : []),
                ...(Array.isArray(profile.envTemplates) ? profile.envTemplates : []),
                ...(Array.isArray(profile.kustomizeFiles) ? profile.kustomizeFiles : []),
                ...((Array.isArray(profile.componentBindings) ? profile.componentBindings : []).map((binding) => binding.runtimeArtifact)),
            ];
            ensureArtifactsExist(profileArtifacts, errors, `package profile "${profile.profileKey || '<unknown>'}"`);
        });

        if (errors.length > 0) {
            console.error(`[phase2:sovereign:packaging] FAIL ${relativePath}`);
            errors.forEach((error) => console.error(`- ${error}`));
            failureCount += 1;
            continue;
        }

        const catalog = buildSovereignPackagingCatalog(document, topologyCatalog, policyCatalog, relativePath);
        const preview = resolveSovereignPackagingProfile(catalog, topologyCatalog, policyCatalog, 'per-country-sovereign-cloud');

        console.log(
            `[phase2:sovereign:packaging] PASS ${relativePath} (${catalog.packageProfiles.length} profiles; preview=${preview.profileKey}; topology=${preview.topologyPattern})`
        );
    }

    if (failureCount > 0) {
        process.exit(1);
    }

    console.log(`[phase2:sovereign:packaging] validated ${packagingFiles.length} sovereign packaging definition file(s)`);
}

main();
