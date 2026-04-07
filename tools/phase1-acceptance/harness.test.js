const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { runAllScenarios, runScenario } = require('./harness');

describe('Phase 1 acceptance harness', () => {
    it('passes every registered scenario', async () => {
        const results = await runAllScenarios();

        assert.equal(results.length, 4);
        assert.ok(results.every(result => result.pass), JSON.stringify(results, null, 2));
    });

    it('runs a named scenario directly', async () => {
        const result = await runScenario('cdc');

        assert.equal(result.scenario, 'cdc');
        assert.equal(result.pass, true);
    });
});
