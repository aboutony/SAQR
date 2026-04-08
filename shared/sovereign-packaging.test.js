const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { buildSovereignTopologyCatalog } = require('./sovereign-topology');
const { buildSovereignPolicyCatalog } = require('./sovereign-policy');
const {
    buildSovereignPackagingCatalog,
    resolveSovereignPackagingProfile,
    validateSovereignPackagingDocument,
} = require('./sovereign-packaging');

const REPO_ROOT = path.resolve(__dirname, '..');
const TOPOLOGY_FILE = path.join(REPO_ROOT, 'fixtures', 'phase2-sovereign', 'topologies', 'saqr-reference-sovereign-topology.topology.json');
const POLICY_FILE = path.join(REPO_ROOT, 'fixtures', 'phase2-sovereign', 'policies', 'saqr-reference-sovereign-policy.policy.json');
const PACKAGING_FILE = path.join(REPO_ROOT, 'fixtures', 'phase2-sovereign', 'packaging', 'saqr-reference-sovereign-packaging.package.json');

function loadJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function buildReferences() {
    const topologyCatalog = buildSovereignTopologyCatalog(loadJson(TOPOLOGY_FILE), path.relative(REPO_ROOT, TOPOLOGY_FILE));
    const policyCatalog = buildSovereignPolicyCatalog(loadJson(POLICY_FILE), topologyCatalog, path.relative(REPO_ROOT, POLICY_FILE));
    return { topologyCatalog, policyCatalog };
}

test('sovereign packaging model validates and builds the reference catalog', () => {
    const { topologyCatalog, policyCatalog } = buildReferences();
    const document = loadJson(PACKAGING_FILE);
    const errors = validateSovereignPackagingDocument(document, topologyCatalog, policyCatalog, path.relative(REPO_ROOT, PACKAGING_FILE));

    assert.deepEqual(errors, []);

    const catalog = buildSovereignPackagingCatalog(document, topologyCatalog, policyCatalog, path.relative(REPO_ROOT, PACKAGING_FILE));
    assert.equal(catalog.packageProfiles.length, 4);
    assert.equal(catalog.packageProfiles[0].componentBindings.length, 7);
});

test('resolves a per-country packaging profile with topology and policy defaults', () => {
    const { topologyCatalog, policyCatalog } = buildReferences();
    const catalog = buildSovereignPackagingCatalog(loadJson(PACKAGING_FILE), topologyCatalog, policyCatalog, path.relative(REPO_ROOT, PACKAGING_FILE));

    const profile = resolveSovereignPackagingProfile(catalog, topologyCatalog, policyCatalog, 'per-country-sovereign-cloud');
    assert.equal(profile.topologyPattern, 'per_country');
    assert.equal(profile.deploymentTarget, 'sovereign_cloud');
    assert.match(profile.composeFiles[1], /per-country-sovereign-cloud/);
    assert.equal(profile.componentBindings.find((binding) => binding.componentKey === 'workflow-engine').distributionMode, 'embedded_module');
    assert.equal(
        profile.componentBindings.find((binding) => binding.componentKey === 'evidence-vault').policyDefaults.evidenceRecords.crossBorderMode,
        'prohibited'
    );
});

test('rejects invalid packaging definitions and missing component bindings', () => {
    const { topologyCatalog, policyCatalog } = buildReferences();
    const invalid = loadJson(PACKAGING_FILE);
    invalid.packageProfiles[0].topologyKey = 'regional-stack';
    invalid.packageProfiles[1].componentBindings = invalid.packageProfiles[1].componentBindings.filter((binding) => binding.componentKey !== 'api');
    invalid.packageProfiles[2].composeFiles = [];

    const errors = validateSovereignPackagingDocument(invalid, topologyCatalog, policyCatalog, 'invalid-packaging');
    assert.match(errors.join(' | '), /unknown topologyKey "regional-stack"/);
    assert.match(errors.join(' | '), /must bind component "api"/);
    assert.match(errors.join(' | '), /composeFiles must be a non-empty array/);
});
