const fs = require('fs');
const path = require('path');
const {
    createInMemoryActorDirectory,
    createWorkflowAuditLedgerService,
    createWorkflowExecutionService,
    createWorkflowGovernanceService,
} = require('../../../services/workflow-engine/src');
const { loadWorkflowDefinition, validateWorkflowDefinition } = require('../../../tools/phase2-workflow/validator');

const DEFAULT_WORKFLOW_DEFINITIONS_DIR = path.resolve(__dirname, '..', '..', '..', 'fixtures', 'phase2-workflow', 'workflows');

function clone(value) {
    return structuredClone(value);
}

function publishSeedDefinition(definition) {
    return {
        ...clone(definition),
        status: 'published',
    };
}

function createDefaultActorDirectory() {
    return createInMemoryActorDirectory({
        users: [
            { actorType: 'user', actorId: 'analyst-01', displayName: 'Analyst 01', roleKey: 'analyst' },
            { actorType: 'user', actorId: 'analyst-02', displayName: 'Analyst 02', roleKey: 'analyst' },
            { actorType: 'user', actorId: 'auditor-01', displayName: 'Auditor 01', roleKey: 'auditor' },
            { actorType: 'user', actorId: 'admin-01', displayName: 'Admin 01', roleKey: 'admin' },
            { actorType: 'user', actorId: 'board-01', displayName: 'Board 01', roleKey: 'board' },
            { actorType: 'user', actorId: 'board-02', displayName: 'Board 02', roleKey: 'board' },
            { actorType: 'user', actorId: 'board-03', displayName: 'Board 03', roleKey: 'board' },
            { actorType: 'user', actorId: 'risk-01', displayName: 'Risk 01', roleKey: 'analyst' },
            { actorType: 'user', actorId: 'ops-01', displayName: 'Ops 01', roleKey: 'viewer' },
            { actorType: 'user', actorId: 'delegate-01', displayName: 'Delegate 01', roleKey: 'admin' },
        ],
        roles: {
            analyst: ['analyst-01', 'analyst-02', 'risk-01'],
            auditor: ['auditor-01'],
            admin: ['admin-01', 'delegate-01'],
            board: ['board-01', 'board-02', 'board-03'],
            viewer: ['ops-01'],
        },
        queues: {
            'compliance-analysts': ['analyst-01', 'analyst-02'],
            'risk-triage': ['risk-01'],
            'site-operations': ['ops-01'],
        },
        delegates: {
            'user:auditor-01': ['delegate-01'],
        },
    });
}

function listWorkflowDefinitionFiles(definitionsDir = DEFAULT_WORKFLOW_DEFINITIONS_DIR) {
    return fs.readdirSync(definitionsDir, { withFileTypes: true })
        .filter(entry => entry.isFile() && entry.name.endsWith('.workflow.json'))
        .map(entry => path.join(definitionsDir, entry.name))
        .sort((left, right) => left.localeCompare(right));
}

function loadBundledWorkflowDefinitions(definitionsDir = DEFAULT_WORKFLOW_DEFINITIONS_DIR) {
    return listWorkflowDefinitionFiles(definitionsDir).map(filePath => loadWorkflowDefinition(filePath));
}

function listDefinitionFixtureMetadata(definitionsDir = DEFAULT_WORKFLOW_DEFINITIONS_DIR) {
    return listWorkflowDefinitionFiles(definitionsDir).map((filePath) => {
        const document = loadWorkflowDefinition(filePath);
        return {
            filePath,
            fileName: path.basename(filePath),
            workflowKey: document.workflowKey,
            version: document.version,
            sourceStatus: document.status,
            fixtureMode: 'authoring_definition',
        };
    });
}

function flattenDefinitions(governance) {
    return governance.listWorkflowKeys().flatMap(workflowKey => governance.listWorkflowVersions(workflowKey));
}

function createWorkflowContractService({
    definitions = null,
    definitionsDir = DEFAULT_WORKFLOW_DEFINITIONS_DIR,
    actorDirectory = createDefaultActorDirectory(),
    autoPublishSeedDefinitions = true,
    runtimeClock = () => new Date(),
    governanceClock = () => new Date(),
} = {}) {
    const sourceDefinitions = definitions
        ? definitions.map(clone)
        : loadBundledWorkflowDefinitions(definitionsDir);
    const governanceDefinitions = autoPublishSeedDefinitions
        ? sourceDefinitions.map(publishSeedDefinition)
        : sourceDefinitions;

    const governance = createWorkflowGovernanceService({
        definitions: governanceDefinitions,
        clock: governanceClock,
    });
    const runtime = createWorkflowExecutionService({
        definitions: governance.getPublishedDefinitions(),
        actorDirectory,
        clock: runtimeClock,
    });
    const auditLedger = createWorkflowAuditLedgerService({
        runtime,
        governance,
    });

    function syncPublishedDefinitions() {
        runtime.registerDefinitions(governance.getPublishedDefinitions());
    }

    function listDefinitionFixtures() {
        return listDefinitionFixtureMetadata(definitionsDir).map(clone);
    }

    function listDefinitions({ status = null, workflowKey = null } = {}) {
        return flattenDefinitions(governance)
            .filter((definition) => {
                if (status && definition.status !== status) return false;
                if (workflowKey && definition.workflowKey !== workflowKey) return false;
                return true;
            })
            .map(clone);
    }

    function getWorkflowDefinition(workflowKey, { version = null, publishedOnly = false } = {}) {
        if (publishedOnly) {
            return governance.getPublishedWorkflow(workflowKey);
        }
        if (Number.isInteger(version)) {
            return governance.getWorkflowVersion(workflowKey, version);
        }

        const versions = governance.listWorkflowVersions(workflowKey);
        return versions.length > 0 ? versions[versions.length - 1] : null;
    }

    function validateDefinitionDocument(document, sourceName = '<memory>') {
        const errors = validateWorkflowDefinition(document, sourceName);
        return {
            valid: errors.length === 0,
            errors,
        };
    }

    function matchEvent(event) {
        return runtime.matchEvent(event);
    }

    function startForEvent(event, { actor = null } = {}) {
        return runtime.startForEvent(event, { actor });
    }

    function createDraftVersion(workflowKey, options = {}) {
        return governance.createDraftVersion(workflowKey, options);
    }

    function publishWorkflowVersion(workflowKey, version, options = {}) {
        const published = governance.publishWorkflowVersion(workflowKey, version, options);
        syncPublishedDefinitions();
        return published;
    }

    function rollbackWorkflowVersion(workflowKey, targetVersion, options = {}) {
        const published = governance.rollbackWorkflowVersion(workflowKey, targetVersion, options);
        syncPublishedDefinitions();
        return published;
    }

    return {
        createDraftVersion,
        getDecisionHistory: auditLedger.getDecisionHistory,
        getInstance: runtime.getInstance,
        getInstanceAuditView: auditLedger.getInstanceAuditView,
        getWorkflowDefinition,
        listAuditLedger: auditLedger.listAuditLedger,
        listDecisionHistory: auditLedger.getDecisionHistory,
        listDefinitionFixtures,
        listDefinitions,
        listEvidenceLinks: auditLedger.listEvidenceLinks,
        listGovernanceHistory: governance.listChangeHistory,
        listInstances: runtime.listInstances,
        matchEvent,
        publishWorkflowVersion,
        rollbackWorkflowVersion,
        startForEvent,
        validateDefinitionDocument,
    };
}

module.exports = {
    DEFAULT_WORKFLOW_DEFINITIONS_DIR,
    createDefaultActorDirectory,
    createWorkflowContractService,
    listDefinitionFixtureMetadata,
    listWorkflowDefinitionFiles,
    loadBundledWorkflowDefinitions,
};
