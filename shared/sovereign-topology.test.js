const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {
    buildSovereignTopologyCatalog,
    listTopologyPatterns,
    resolveComponentPlacement,
    validateSovereignTopologyDocument,
} = require('./sovereign-topology');

const REPO_ROOT = path.resolve(__dirname, '..');
const TOPOLOGY_FILE = path.join(REPO_ROOT, 'fixtures', 'phase2-sovereign', 'topologies', 'saqr-reference-sovereign-topology.topology.json');

function loadTopology() {
    return JSON.parse(fs.readFileSync(TOPOLOGY_FILE, 'utf8'));
}

test('sovereign topology model validates and builds the reference catalog', () => {
    const document = loadTopology();
    const errors = validateSovereignTopologyDocument(document, path.relative(REPO_ROOT, TOPOLOGY_FILE));

    assert.deepEqual(errors, []);

    const catalog = buildSovereignTopologyCatalog(document, path.relative(REPO_ROOT, TOPOLOGY_FILE));
    assert.equal(catalog.supportedTopologies.length, 4);
    assert.equal(catalog.componentPlacements.length, 7);
    assert.deepEqual(
        listTopologyPatterns(catalog).map((item) => item.pattern),
        ['on_premises', 'per_cluster', 'per_country', 'single_tenant']
    );
});

test('resolves isolated per-country component placement and shared single-tenant placement', () => {
    const catalog = buildSovereignTopologyCatalog(loadTopology(), path.relative(REPO_ROOT, TOPOLOGY_FILE));

    const perCountryEvidence = resolveComponentPlacement(catalog, 'per-country-sovereign-cloud', 'evidence-vault');
    assert.equal(perCountryEvidence.placementMode, 'dedicated_per_country');
    assert.equal(perCountryEvidence.isolated, true);
    assert.equal(perCountryEvidence.boundaryScope, 'country');

    const singleTenantApi = resolveComponentPlacement(catalog, 'single-tenant-sovereign-cloud', 'api');
    assert.equal(singleTenantApi.placementMode, 'shared_within_topology');
    assert.equal(singleTenantApi.sharedWithinTopology, true);
    assert.equal(singleTenantApi.deploymentTarget, 'sovereign_cloud');
});

test('resolves on-prem and per-cluster placement modes correctly', () => {
    const catalog = buildSovereignTopologyCatalog(loadTopology(), path.relative(REPO_ROOT, TOPOLOGY_FILE));

    const onPremWorkflow = resolveComponentPlacement(catalog, 'client-on-premises', 'workflow-engine');
    assert.equal(onPremWorkflow.placementMode, 'shared_within_topology');
    assert.equal(onPremWorkflow.deploymentTarget, 'on_premises');

    const clusterCv = resolveComponentPlacement(catalog, 'per-cluster-entity-ring', 'cv-watchman');
    assert.equal(clusterCv.placementMode, 'dedicated_per_cluster');
    assert.equal(clusterCv.isolated, true);
    assert.equal(clusterCv.boundaryScope, 'cluster');
});

test('rejects invalid topology definitions and unsupported component placements', () => {
    const invalid = loadTopology();
    invalid.supportedTopologies[0].pattern = 'regional';
    invalid.supportedTopologies[1].sharedComponents.push('evidence-vault');
    invalid.supportedTopologies[1].isolatedComponents.push('evidence-vault');
    invalid.componentPlacements[0].allowedPatterns = ['single_tenant'];
    invalid.componentPlacements[0].defaultPlacement = 'dedicated_per_country';

    const errors = validateSovereignTopologyDocument(invalid, 'invalid-topology');
    assert.match(errors.join(' | '), /unsupported pattern "regional"/);
    assert.match(errors.join(' | '), /both shared and isolated/);
    assert.match(errors.join(' | '), /dedicated_per_country defaultPlacement requires pattern "per_country"/);
});
