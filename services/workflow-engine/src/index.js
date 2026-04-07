const { createWorkflowExecutionService, validateNormalizedEvent, matchRule, SYSTEM_ACTOR } = require('./runtime');
const { createInMemoryActorDirectory } = require('./actor-directory');
const { createWorkflowGovernanceService, SYSTEM_ACTOR: GOVERNANCE_SYSTEM_ACTOR } = require('./governance');
const { createWorkflowAuditLedgerService } = require('./audit-ledger');

module.exports = {
    GOVERNANCE_SYSTEM_ACTOR,
    SYSTEM_ACTOR,
    createWorkflowAuditLedgerService,
    createWorkflowExecutionService,
    createWorkflowGovernanceService,
    createInMemoryActorDirectory,
    validateNormalizedEvent,
    matchRule,
};

if (require.main === module) {
    console.log('SAQR Workflow Engine module loaded. Use this package from code or run npm test for runtime validation.');
}
