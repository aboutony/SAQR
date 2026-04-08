const fs = require('fs');
const path = require('path');

const {
    createInMemoryActorDirectory,
    createWorkflowAuditLedgerService,
    createWorkflowExecutionService,
    createWorkflowGovernanceService,
} = require('../../services/workflow-engine/src');
const { buildEntityHierarchyCatalog } = require('../../shared/entity-hierarchy');
const { buildEntityScopingCatalog } = require('../../shared/entity-scoping');
const { buildEntityIsolationCatalog, evaluateIsolationAccess } = require('../../shared/entity-isolation');
const { buildEntityRollupCatalog } = require('../../shared/entity-rollup');
const { buildEntityReportingCatalog, generateEntityReport } = require('../../shared/entity-reporting');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

function readJson(relativePath) {
    return JSON.parse(fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8'));
}

function loadManifest() {
    return readJson('fixtures/phase2-acceptance/manifest.json');
}

function createScenarioResult(name, fixtureId) {
    return {
        scenario: name,
        fixtureId,
        pass: true,
        checks: [],
        summary: {},
    };
}

function addCheck(result, name, passed, details = {}) {
    result.checks.push({
        name,
        passed,
        ...details,
    });

    if (!passed) {
        result.pass = false;
    }
}

function sortStrings(values) {
    return [...values].sort((left, right) => left.localeCompare(right));
}

function createClock(startAt) {
    let current = new Date(startAt).getTime();
    return () => {
        current += 1000;
        return new Date(current);
    };
}

function approvalRecordFromFixture(record) {
    if (record && typeof record === 'object') {
        return structuredClone(record);
    }

    return {
        approvalRecordId: 'APR-P2-DEFAULT',
        approvedBy: {
            actorType: 'user',
            actorId: 'admin-01',
            displayName: 'Admin 01',
            roleKey: 'admin',
        },
        approvedAt: '2026-04-08T08:00:00.000Z',
    };
}

function publishWorkflowDefinition(relativePath, approvalRecord, clock) {
    const definition = readJson(relativePath);
    const governance = createWorkflowGovernanceService({
        definitions: [definition],
        clock,
    });

    governance.publishWorkflowVersion(definition.workflowKey, definition.version, {
        approvalRecord: approvalRecordFromFixture(approvalRecord),
    });

    return {
        definition,
        governance,
    };
}

function actorIds(assignments) {
    return assignments.map(entry => entry.actor.actorId);
}

function eventTimestamp(fixture) {
    return fixture.event?.occurredAt || fixture.event?.ingestedAt || '2026-04-08T08:00:00.000Z';
}

function executeWorkflowCommand(runtime, instanceId, command) {
    if (command.type === 'advance') {
        return runtime.advanceInstance(instanceId, {
            outcome: command.outcome,
            actor: command.actor,
            notes: command.notes,
            payload: command.payload || {},
            evidenceRefs: command.evidenceRefs || [],
        });
    }

    if (command.type === 'approve') {
        return runtime.recordApprovalDecision(instanceId, {
            actor: command.actor,
            decision: command.decision,
            notes: command.notes || '',
            payload: command.payload || {},
            evidenceRefs: command.evidenceRefs || [],
        });
    }

    if (command.type === 'escalate') {
        return runtime.escalateApprovalToCommittee(instanceId, {
            actor: command.actor,
            reason: command.reason || 'committee_escalation',
        });
    }

    throw new Error(`unsupported workflow command type "${command.type}"`);
}

async function runWorkflowScenario(name, relativePath) {
    const fixture = readJson(relativePath);
    const result = createScenarioResult(name, fixture.fixtureId);
    const clock = createClock(eventTimestamp(fixture));
    const actorDirectory = createInMemoryActorDirectory(fixture.actorDirectory || {});
    const { governance, definition } = publishWorkflowDefinition(
        fixture.workflowDefinition,
        fixture.publishApprovalRecord,
        clock
    );
    const runtime = createWorkflowExecutionService({
        definitions: governance.getPublishedDefinitions(),
        actorDirectory,
        clock,
    });

    const matches = runtime.matchEvent(fixture.event);
    addCheck(result, `${name}.matched_workflow`, matches.length === 1 && matches[0].workflowKey === fixture.expected.workflowKey, {
        expected: fixture.expected.workflowKey,
        actual: matches.map(match => match.workflowKey),
    });

    const started = runtime.startForEvent(fixture.event);
    addCheck(result, `${name}.instance_started`, started.length === 1, {
        expected: 1,
        actual: started.length,
    });

    if (started.length === 0) {
        result.summary = {
            workflowKey: definition.workflowKey,
            error: 'No workflow instance started.',
        };
        return result;
    }

    const instanceId = started[0].instance.instanceId;
    const assignmentSnapshots = {};
    if (fixture.captureStartAssignmentsAs) {
        assignmentSnapshots[fixture.captureStartAssignmentsAs] = actorIds(runtime.resolveCurrentAssignments(instanceId));
    }

    for (const command of fixture.commands || []) {
        executeWorkflowCommand(runtime, instanceId, command);
        if (command.captureAssignmentsAs) {
            assignmentSnapshots[command.captureAssignmentsAs] = actorIds(runtime.resolveCurrentAssignments(instanceId));
        }
    }

    const finalInstance = runtime.getInstance(instanceId);
    const ledger = createWorkflowAuditLedgerService({
        runtime,
        governance,
    });
    const auditView = ledger.getInstanceAuditView(instanceId);
    const decisionHistory = ledger.getDecisionHistory(instanceId);
    const evidenceLinks = ledger.listEvidenceLinks(instanceId);
    const runtimeAuditEntryTypes = [...new Set(auditView.runtimeAuditLedger.map(entry => entry.entryType))];
    const governanceAuditEntryTypes = [...new Set(auditView.governanceAuditLedger.map(entry => entry.entryType))];
    const combinedSourceTypes = [...new Set(auditView.combinedAuditLedger.map(entry => entry.sourceType))];
    const evidenceRefIds = evidenceLinks.map(link => link.refId);

    addCheck(result, `${name}.final_state`, finalInstance.state === fixture.expected.finalState, {
        expected: fixture.expected.finalState,
        actual: finalInstance.state,
    });
    addCheck(result, `${name}.final_current_step`, finalInstance.currentStepKey === fixture.expected.finalCurrentStepKey, {
        expected: fixture.expected.finalCurrentStepKey,
        actual: finalInstance.currentStepKey,
    });
    addCheck(result, `${name}.decision_count`, decisionHistory.length === fixture.expected.decisionCount, {
        expected: fixture.expected.decisionCount,
        actual: decisionHistory.length,
    });
    addCheck(result, `${name}.approval_mode`, decisionHistory.every(item => item.approvalMode === fixture.expected.approvalMode), {
        expected: fixture.expected.approvalMode,
        actual: [...new Set(decisionHistory.map(item => item.approvalMode))],
    });

    Object.entries(fixture.expected.assignmentSnapshots || {}).forEach(([snapshotKey, expectedActors]) => {
        addCheck(
            result,
            `${name}.${snapshotKey}`,
            JSON.stringify(sortStrings(assignmentSnapshots[snapshotKey] || [])) === JSON.stringify(sortStrings(expectedActors)),
            {
                expected: sortStrings(expectedActors),
                actual: sortStrings(assignmentSnapshots[snapshotKey] || []),
            }
        );
    });

    (fixture.expected.runtimeAuditEntryTypes || []).forEach((entryType) => {
        addCheck(result, `${name}.runtime_audit.${entryType}`, runtimeAuditEntryTypes.includes(entryType), {
            expected: entryType,
            actual: runtimeAuditEntryTypes,
        });
    });

    (fixture.expected.governanceAuditEntryTypes || []).forEach((entryType) => {
        addCheck(result, `${name}.governance_audit.${entryType}`, governanceAuditEntryTypes.includes(entryType), {
            expected: entryType,
            actual: governanceAuditEntryTypes,
        });
    });

    (fixture.expected.combinedSourceTypes || []).forEach((sourceType) => {
        addCheck(result, `${name}.combined_source.${sourceType}`, combinedSourceTypes.includes(sourceType), {
            expected: sourceType,
            actual: combinedSourceTypes,
        });
    });

    (fixture.expected.evidenceRefIds || []).forEach((refId) => {
        addCheck(result, `${name}.evidence_ref.${refId}`, evidenceRefIds.includes(refId), {
            expected: refId,
            actual: evidenceRefIds,
        });
    });

    result.summary = {
        workflowKey: definition.workflowKey,
        instanceId,
        finalState: finalInstance.state,
        finalCurrentStepKey: finalInstance.currentStepKey,
        decisionCount: decisionHistory.length,
        assignmentSnapshots,
        runtimeAuditEntries: auditView.runtimeAuditLedger.length,
        governanceAuditEntries: auditView.governanceAuditLedger.length,
        evidenceLinkCount: evidenceLinks.length,
    };

    return result;
}

async function runEntityReportingScenario(relativePath) {
    const fixture = readJson(relativePath);
    const result = createScenarioResult('entity-reporting', fixture.fixtureId);

    const hierarchyDocument = readJson(fixture.hierarchyFixture);
    const hierarchyCatalog = buildEntityHierarchyCatalog(hierarchyDocument, fixture.hierarchyFixture);
    const scopingDocument = readJson(fixture.scopingFixture);
    const scopingCatalog = buildEntityScopingCatalog(scopingDocument, hierarchyCatalog, fixture.scopingFixture);
    const isolationDocument = readJson(fixture.isolationFixture);
    const isolationCatalog = buildEntityIsolationCatalog(isolationDocument, fixture.isolationFixture);
    const rollupDocument = readJson(fixture.rollupFixture);
    const rollupCatalog = buildEntityRollupCatalog(rollupDocument, hierarchyCatalog, fixture.rollupFixture);
    const reportingDocument = readJson(fixture.reportingFixture);
    const reportingCatalog = buildEntityReportingCatalog(reportingDocument, {
        hierarchyRef: hierarchyDocument,
        scopingRef: scopingDocument,
        isolationRef: isolationDocument,
        rollupRef: rollupDocument,
    }, fixture.reportingFixture);

    const report = generateEntityReport(reportingCatalog, {
        hierarchyCatalog,
        scopingCatalog,
        isolationCatalog,
        rollupCatalog,
    }, fixture.commands.executiveReport);
    const sameEntityWorkflowRead = evaluateIsolationAccess(
        scopingCatalog,
        hierarchyCatalog,
        isolationCatalog,
        fixture.commands.sameEntityWorkflowRead.principalId,
        fixture.commands.sameEntityWorkflowRead.resourceType,
        fixture.commands.sameEntityWorkflowRead.action,
        fixture.commands.sameEntityWorkflowRead.resourceScope
    );
    const crossEntityWorkflowRead = evaluateIsolationAccess(
        scopingCatalog,
        hierarchyCatalog,
        isolationCatalog,
        fixture.commands.crossEntityWorkflowRead.principalId,
        fixture.commands.crossEntityWorkflowRead.resourceType,
        fixture.commands.crossEntityWorkflowRead.action,
        fixture.commands.crossEntityWorkflowRead.resourceScope
    );
    const groupReportDenied = evaluateIsolationAccess(
        scopingCatalog,
        hierarchyCatalog,
        isolationCatalog,
        fixture.commands.groupReportDenied.principalId,
        fixture.commands.groupReportDenied.resourceType,
        fixture.commands.groupReportDenied.action,
        fixture.commands.groupReportDenied.resourceScope
    );

    addCheck(result, 'entity-reporting.report_boundary_mode', report.boundaryMode === fixture.expected.reportBoundaryMode, {
        expected: fixture.expected.reportBoundaryMode,
        actual: report.boundaryMode,
    });
    addCheck(result, 'entity-reporting.report_overall_status', report.overallStatus === fixture.expected.reportOverallStatus, {
        expected: fixture.expected.reportOverallStatus,
        actual: report.overallStatus,
    });
    addCheck(result, 'entity-reporting.report_node_count', report.nodeCount === fixture.expected.reportNodeCount, {
        expected: fixture.expected.reportNodeCount,
        actual: report.nodeCount,
    });

    const controlHighlightKeys = report.controlHighlights.map(item => item.controlKey);
    const nodeHighlightIds = report.nodeHighlights.map(item => item.nodeId);

    (fixture.expected.controlHighlightKeys || []).forEach((controlKey) => {
        addCheck(result, `entity-reporting.control_highlight.${controlKey}`, controlHighlightKeys.includes(controlKey), {
            expected: controlKey,
            actual: controlHighlightKeys,
        });
    });

    (fixture.expected.nodeHighlightIds || []).forEach((nodeId) => {
        addCheck(result, `entity-reporting.node_highlight.${nodeId}`, nodeHighlightIds.includes(nodeId), {
            expected: nodeId,
            actual: nodeHighlightIds,
        });
    });

    addCheck(result, 'entity-reporting.same_entity_workflow_boundary', sameEntityWorkflowRead.allowed && sameEntityWorkflowRead.boundaryMode === fixture.expected.sameEntityWorkflowBoundaryMode, {
        expected: fixture.expected.sameEntityWorkflowBoundaryMode,
        actual: sameEntityWorkflowRead,
    });
    addCheck(result, 'entity-reporting.cross_entity_workflow_denied', crossEntityWorkflowRead.allowed === fixture.expected.crossEntityWorkflowAllowed && String(crossEntityWorkflowRead.reason || '').includes(fixture.expected.crossEntityWorkflowReasonContains), {
        expected: {
            allowed: fixture.expected.crossEntityWorkflowAllowed,
            reasonContains: fixture.expected.crossEntityWorkflowReasonContains,
        },
        actual: crossEntityWorkflowRead,
    });
    addCheck(result, 'entity-reporting.group_report_denied', groupReportDenied.allowed === fixture.expected.groupReportDeniedAllowed && String(groupReportDenied.reason || '').includes(fixture.expected.groupReportDeniedReasonContains), {
        expected: {
            allowed: fixture.expected.groupReportDeniedAllowed,
            reasonContains: fixture.expected.groupReportDeniedReasonContains,
        },
        actual: groupReportDenied,
    });

    result.summary = {
        reportKey: report.reportKey,
        boundaryMode: report.boundaryMode,
        overallStatus: report.overallStatus,
        nodeCount: report.nodeCount,
        controlHighlightKeys,
        nodeHighlightIds,
        sameEntityWorkflowRead,
        crossEntityWorkflowRead,
        groupReportDenied,
    };

    return result;
}

async function runScenario(scenario) {
    const manifest = loadManifest();
    const entry = manifest.scenarios[scenario];
    if (!entry) {
        throw new Error(`unknown Phase 2 acceptance scenario "${scenario}"`);
    }

    if (scenario === 'workflow-maker-checker' || scenario === 'workflow-committee') {
        return runWorkflowScenario(scenario, entry.fixture);
    }

    if (scenario === 'entity-reporting') {
        return runEntityReportingScenario(entry.fixture);
    }

    throw new Error(`scenario "${scenario}" is registered but has no runner`);
}

async function runAllScenarios() {
    const manifest = loadManifest();
    const results = [];
    for (const scenario of Object.keys(manifest.scenarios)) {
        results.push(await runScenario(scenario));
    }
    return results;
}

module.exports = {
    loadManifest,
    runAllScenarios,
    runScenario,
};
