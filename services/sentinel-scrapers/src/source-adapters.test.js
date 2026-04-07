const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
    createDefaultRegulatorySourceRegistry,
    createRegulatorySourceOrchestrator,
    createRegulatorySourceProvider,
    resolveRegulatorySources,
} = require('./source-adapters');

describe('Regulatory source adapters', () => {
    it('resolves the default source registry for configured authorities', () => {
        const sources = resolveRegulatorySources(['SAMA', 'SDAIA'], createDefaultRegulatorySourceRegistry());

        assert.equal(sources.length, 2);
        assert.equal(sources[0].authority, 'SAMA');
        assert.equal(sources[1].authority, 'SDAIA');
    });

    it('runs source providers through the orchestrator and flattens results', async () => {
        const customSource = createRegulatorySourceProvider({
            authority: 'CUSTOM',
            liveScraper: async () => [{ authority: 'CUSTOM', title: 'Live rule' }],
            demoScraper: () => [{ authority: 'CUSTOM', title: 'Demo rule' }],
        });

        const orchestrator = createRegulatorySourceOrchestrator({
            sources: [customSource],
            logger: {
                info() { },
            },
        });

        const live = await orchestrator.run({ mode: 'live', browser: {} });
        assert.equal(live.entries.length, 1);
        assert.equal(live.byAuthority.CUSTOM[0].title, 'Live rule');

        const demo = await orchestrator.run({ mode: 'demo' });
        assert.equal(demo.entries.length, 1);
        assert.equal(demo.byAuthority.CUSTOM[0].title, 'Demo rule');
    });

    it('throws when an authority has no registered provider', () => {
        assert.throws(
            () => resolveRegulatorySources(['UNKNOWN'], createDefaultRegulatorySourceRegistry()),
            /No regulatory source provider registered/
        );
    });
});
