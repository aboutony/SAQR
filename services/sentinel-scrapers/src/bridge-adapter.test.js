const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { createRegulatoryStagingIngestionFlow } = require('./bridge');

describe('Regulatory staging ingestion flow', () => {
    it('counts inserted and duplicate rules through the repository adapter', async () => {
        const seen = new Set();
        const ingestRules = createRegulatoryStagingIngestionFlow({
            repository: {
                async upsertRule(rule) {
                    if (seen.has(rule.contentHash)) {
                        return { inserted: false, duplicate: true };
                    }

                    seen.add(rule.contentHash);
                    return { inserted: true, duplicate: false };
                },
            },
            logger: {
                info() { },
                error() { },
            },
        });

        const result = await ingestRules([
            { authority: 'SAMA', title: 'Rule 1', sourceUrl: 'https://a', contentHash: 'abc' },
            { authority: 'SAMA', title: 'Rule 1 duplicate', sourceUrl: 'https://a', contentHash: 'abc' },
            { authority: 'SDAIA', title: 'Rule 2', sourceUrl: 'https://b', contentHash: 'def' },
        ]);

        assert.deepStrictEqual(result, {
            ingested: 2,
            duplicates: 1,
        });
    });
});
