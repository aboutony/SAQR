const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { buildSovereignTopologyCatalog } = require('./sovereign-topology');
const {
    buildSovereignPolicyCatalog,
    evaluateCrossBorderMovement,
    resolveSovereignPolicy,
    validateSovereignPolicyDocument,
} = require('./sovereign-policy');

const REPO_ROOT = path.resolve(__dirname, '..');
const TOPOLOGY_FILE = path.join(REPO_ROOT, 'fixtures', 'phase2-sovereign', 'topologies', 'saqr-reference-sovereign-topology.topology.json');
const POLICY_FILE = path.join(REPO_ROOT, 'fixtures', 'phase2-sovereign', 'policies', 'saqr-reference-sovereign-policy.policy.json');

function loadJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function buildReferences() {
    const topologyCatalog = buildSovereignTopologyCatalog(loadJson(TOPOLOGY_FILE), path.relative(REPO_ROOT, TOPOLOGY_FILE));
    const policyDocument = loadJson(POLICY_FILE);
    const policyCatalog = buildSovereignPolicyCatalog(policyDocument, topologyCatalog, path.relative(REPO_ROOT, POLICY_FILE));
    return { topologyCatalog, policyDocument, policyCatalog };
}

test('sovereign policy model validates and builds the reference catalog', () => {
    const { topologyCatalog, policyDocument } = buildReferences();
    const errors = validateSovereignPolicyDocument(policyDocument, topologyCatalog, path.relative(REPO_ROOT, POLICY_FILE));

    assert.deepEqual(errors, []);

    const policyCatalog = buildSovereignPolicyCatalog(policyDocument, topologyCatalog, path.relative(REPO_ROOT, POLICY_FILE));
    assert.equal(policyCatalog.policyRules.length, 16);
    assert.equal(policyCatalog.topologyRef.modelKey, topologyCatalog.modelKey);
});

test('resolves effective sovereign policy per topology and data class', () => {
    const { topologyCatalog, policyCatalog } = buildReferences();

    const evidencePolicy = resolveSovereignPolicy(policyCatalog, topologyCatalog, 'per-country-sovereign-cloud', 'evidence_records');
    assert.equal(evidencePolicy.residencyRequirement, 'country_boundary');
    assert.equal(evidencePolicy.encryptionBoundary, 'country_managed_kms');
    assert.equal(evidencePolicy.crossBorderMode, 'prohibited');

    const onPremSecretPolicy = resolveSovereignPolicy(policyCatalog, topologyCatalog, 'client-on-premises', 'credential_secrets');
    assert.equal(onPremSecretPolicy.residencyRequirement, 'premises_boundary');
    assert.equal(onPremSecretPolicy.encryptionBoundary, 'customer_managed_hsm');
});

test('enforces cross-border prohibition and brokered export behavior', () => {
    const { topologyCatalog, policyCatalog } = buildReferences();

    const evidenceDecision = evaluateCrossBorderMovement(policyCatalog, topologyCatalog, {
        topologyKey: 'per-country-sovereign-cloud',
        dataClass: 'evidence_records',
        sourceBoundaryId: 'sa',
        destinationBoundaryId: 'ae',
        movementKind: 'replication',
    });
    assert.equal(evidenceDecision.allowed, false);
    assert.match(evidenceDecision.reason, /prohibited/);

    const reportingDenied = evaluateCrossBorderMovement(policyCatalog, topologyCatalog, {
        topologyKey: 'per-country-sovereign-cloud',
        dataClass: 'reporting_aggregates',
        sourceBoundaryId: 'sa',
        destinationBoundaryId: 'ae',
        movementKind: 'export',
        brokered: false,
    });
    assert.equal(reportingDenied.allowed, false);
    assert.match(reportingDenied.reason, /brokered export/);

    const reportingAllowed = evaluateCrossBorderMovement(policyCatalog, topologyCatalog, {
        topologyKey: 'per-country-sovereign-cloud',
        dataClass: 'reporting_aggregates',
        sourceBoundaryId: 'sa',
        destinationBoundaryId: 'ae',
        movementKind: 'export',
        brokered: true,
    });
    assert.equal(reportingAllowed.allowed, true);
});

test('allows same-boundary movement and approval-gated cross-border workflow movement', () => {
    const { topologyCatalog, policyCatalog } = buildReferences();

    const sameBoundary = evaluateCrossBorderMovement(policyCatalog, topologyCatalog, {
        topologyKey: 'single-tenant-sovereign-cloud',
        dataClass: 'workflow_runtime',
        sourceBoundaryId: 'tenant-a',
        destinationBoundaryId: 'tenant-a',
        movementKind: 'replication',
    });
    assert.equal(sameBoundary.allowed, true);

    const approvalRequired = evaluateCrossBorderMovement(policyCatalog, topologyCatalog, {
        topologyKey: 'single-tenant-sovereign-cloud',
        dataClass: 'workflow_runtime',
        sourceBoundaryId: 'tenant-a',
        destinationBoundaryId: 'tenant-b',
        movementKind: 'support_access',
        approvalGranted: false,
    });
    assert.equal(approvalRequired.allowed, false);
    assert.match(approvalRequired.reason, /explicit approval/);

    const approvalGranted = evaluateCrossBorderMovement(policyCatalog, topologyCatalog, {
        topologyKey: 'single-tenant-sovereign-cloud',
        dataClass: 'workflow_runtime',
        sourceBoundaryId: 'tenant-a',
        destinationBoundaryId: 'tenant-b',
        movementKind: 'support_access',
        approvalGranted: true,
    });
    assert.equal(approvalGranted.allowed, true);
});

test('rejects invalid policy definitions and missing topology coverage', () => {
    const topologyCatalog = buildSovereignTopologyCatalog(loadJson(TOPOLOGY_FILE), path.relative(REPO_ROOT, TOPOLOGY_FILE));
    const invalid = loadJson(POLICY_FILE);

    invalid.policyRules = invalid.policyRules.filter((rule) => rule.policyKey !== 'per-country-evidence-records');
    invalid.policyRules[0].encryptionBoundary = 'tenant_managed_kms';
    invalid.policyRules[1].topologyPatterns.push('regional');

    const errors = validateSovereignPolicyDocument(invalid, topologyCatalog, 'invalid-policy');
    assert.match(errors.join(' | '), /unsupported value "regional"/);
    assert.match(errors.join(' | '), /must cover dataClass "evidence_records" for topology pattern "per_country"/);
});
