#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MANIFEST_RELATIVE_PATH = 'docs/handoff/saqr-phase1-handoff-manifest.yaml';
const REQUIRED_HANDOFF_DOCS = [
    'docs/handoff/README.md',
    'docs/handoff/SAQR_Phase1_Handoff_Summary.md',
    'docs/handoff/SAQR_Phase1_Delivery_Worklist.md',
    'docs/handoff/SAQR_Phase1_Validation_Guide.md',
    'docs/handoff/saqr-phase1-handoff-manifest.yaml',
];
const REQUIRED_TOP_LEVEL_FIELDS = [
    'phase',
    'audience',
    'packageType',
    'readinessVerdict',
    'entrypoints',
    'repoBackedArtifacts',
    'deliveryOwnedItems',
    'externalPrerequisites',
    'validationCommands',
    'knownLimitations',
];

function resolveRepoPath(relativePath) {
    return path.join(REPO_ROOT, ...String(relativePath).split(/[\\/]/));
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

function readManifest() {
    const manifestPath = resolveRepoPath(MANIFEST_RELATIVE_PATH);
    const raw = fs.readFileSync(manifestPath, 'utf8');

    try {
        return JSON.parse(raw);
    } catch (error) {
        throw new Error(`Failed to parse ${MANIFEST_RELATIVE_PATH} as machine-readable YAML/JSON: ${error.message}`);
    }
}

function validateTopLevelFields(manifest) {
    const keys = Object.keys(manifest);
    const missing = REQUIRED_TOP_LEVEL_FIELDS.filter(field => !keys.includes(field));
    const extras = keys.filter(field => !REQUIRED_TOP_LEVEL_FIELDS.includes(field));

    assert(missing.length === 0, `Handoff manifest is missing fields: ${missing.join(', ')}`);
    assert(extras.length === 0, `Handoff manifest has unexpected fields: ${extras.join(', ')}`);
}

function validateArrayOfObjects(name, value) {
    assert(Array.isArray(value) && value.length > 0, `${name} must be a non-empty array`);
    value.forEach((entry, index) => {
        assert(entry && typeof entry === 'object' && !Array.isArray(entry), `${name}[${index}] must be an object`);
    });
}

function validateManifestShape(manifest) {
    validateTopLevelFields(manifest);

    assert(manifest.phase === 'Phase 1', 'phase must equal "Phase 1"');
    assert(typeof manifest.audience === 'string' && manifest.audience.length > 0, 'audience must be a non-empty string');
    assert(manifest.packageType === 'repo-handoff', 'packageType must equal "repo-handoff"');

    assert(manifest.readinessVerdict && typeof manifest.readinessVerdict === 'object', 'readinessVerdict must be an object');
    assert(
        manifest.readinessVerdict.status === 'delivery-handoff-ready',
        'readinessVerdict.status must equal "delivery-handoff-ready"'
    );
    assert(
        manifest.readinessVerdict.directClientGoLiveReady === false,
        'readinessVerdict.directClientGoLiveReady must be false'
    );
    assert(
        typeof manifest.readinessVerdict.statement === 'string' && manifest.readinessVerdict.statement.length > 0,
        'readinessVerdict.statement must be a non-empty string'
    );

    validateArrayOfObjects('entrypoints', manifest.entrypoints);
    validateArrayOfObjects('repoBackedArtifacts', manifest.repoBackedArtifacts);
    validateArrayOfObjects('deliveryOwnedItems', manifest.deliveryOwnedItems);
    validateArrayOfObjects('externalPrerequisites', manifest.externalPrerequisites);
    validateArrayOfObjects('validationCommands', manifest.validationCommands);
    assert(Array.isArray(manifest.knownLimitations) && manifest.knownLimitations.length > 0, 'knownLimitations must be a non-empty array');

    manifest.entrypoints.forEach((entry, index) => {
        assert(typeof entry.path === 'string' && entry.path.length > 0, `entrypoints[${index}].path must be a non-empty string`);
    });

    manifest.repoBackedArtifacts.forEach((entry, index) => {
        assert(typeof entry.category === 'string' && entry.category.length > 0, `repoBackedArtifacts[${index}].category must be a non-empty string`);
        assert(Array.isArray(entry.paths) && entry.paths.length > 0, `repoBackedArtifacts[${index}].paths must be a non-empty array`);
        entry.paths.forEach((artifactPath, pathIndex) => {
            assert(
                typeof artifactPath === 'string' && artifactPath.length > 0,
                `repoBackedArtifacts[${index}].paths[${pathIndex}] must be a non-empty string`
            );
        });
    });

    manifest.deliveryOwnedItems.forEach((entry, index) => {
        assert(typeof entry.area === 'string' && entry.area.length > 0, `deliveryOwnedItems[${index}].area must be a non-empty string`);
        assert(Array.isArray(entry.items) && entry.items.length > 0, `deliveryOwnedItems[${index}].items must be a non-empty array`);
    });

    manifest.externalPrerequisites.forEach((entry, index) => {
        assert(typeof entry.name === 'string' && entry.name.length > 0, `externalPrerequisites[${index}].name must be a non-empty string`);
        assert(typeof entry.owner === 'string' && entry.owner.length > 0, `externalPrerequisites[${index}].owner must be a non-empty string`);
        assert(Array.isArray(entry.requiredFor) && entry.requiredFor.length > 0, `externalPrerequisites[${index}].requiredFor must be a non-empty array`);
    });

    manifest.validationCommands.forEach((entry, index) => {
        assert(typeof entry.command === 'string' && entry.command.length > 0, `validationCommands[${index}].command must be a non-empty string`);
        assert(
            typeof entry.expectedSignal === 'string' && entry.expectedSignal.length > 0,
            `validationCommands[${index}].expectedSignal must be a non-empty string`
        );
    });
}

function collectReferencedPaths(manifest) {
    const referencedPaths = new Set(REQUIRED_HANDOFF_DOCS);

    manifest.entrypoints.forEach((entry) => {
        referencedPaths.add(entry.path);
    });

    manifest.repoBackedArtifacts.forEach((entry) => {
        entry.paths.forEach((artifactPath) => referencedPaths.add(artifactPath));
    });

    return [...referencedPaths].sort();
}

function validateReferencedFiles(pathsToCheck) {
    const missing = pathsToCheck.filter(relativePath => !fs.existsSync(resolveRepoPath(relativePath)));
    assert(missing.length === 0, `Handoff package references missing files: ${missing.join(', ')}`);
}

function main() {
    const manifest = readManifest();
    validateManifestShape(manifest);

    const referencedPaths = collectReferencedPaths(manifest);
    validateReferencedFiles(referencedPaths);

    console.log(
        `[phase1:handoff] PASS handoff package verification (${referencedPaths.length} referenced paths, ${manifest.deliveryOwnedItems.length} delivery areas)`
    );
}

main();

