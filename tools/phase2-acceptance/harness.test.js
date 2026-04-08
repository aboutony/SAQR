const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { runAllScenarios, runScenario } = require('./harness');

describe('Phase 2 acceptance harness', () => {
    it('passes every registered Phase 2 scenario', async () => {
        const results = await runAllScenarios();

        assert.equal(results.length, 3);
        assert.ok(results.every(result => result.pass), JSON.stringify(results, null, 2));
    });

    it('runs a named Phase 2 scenario directly', async () => {
        const result = await runScenario('workflow-maker-checker');

        assert.equal(result.scenario, 'workflow-maker-checker');
        assert.equal(result.pass, true);
    });
});
