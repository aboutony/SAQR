const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { createNlpIngestionFlow, createRuleBasedNlpProviders } = require('./nlp-flow');

function createLogger() {
    const events = [];

    return {
        events,
        info(event, fields = {}) {
            events.push({ level: 'info', event, fields });
        },
        warn(event, fields = {}) {
            events.push({ level: 'warn', event, fields });
        },
        audit(event, fields = {}) {
            events.push({ level: 'audit', event, fields });
        },
        error(event, fields = {}) {
            events.push({ level: 'error', event, fields });
        },
    };
}

const SAMPLE_CIRCULAR = `
Circular No. 402/2026

Article 1: Consumer disclosures must use font size minimum 14pt.
Article 2: Cash advance fees shall not exceed SAR 75 per transaction.
Article 3: Customers must be notified within 10 business days.
`;

describe('NLP provider contracts', () => {
    it('rejects repositories that do not implement the required contract', () => {
        const { parser, obligationExtractor, driftDetector } = createRuleBasedNlpProviders();
        const logger = createLogger();

        assert.throws(
            () => createNlpIngestionFlow({
                parser,
                obligationExtractor,
                driftDetector,
                repository: { loadBaseline() { return []; } },
                logger,
            }),
            /storeDriftAlert/
        );
    });

    it('runs the ingestion flow through provider interfaces', async () => {
        const logger = createLogger();
        const storedObligations = [];
        const parser = {
            parse(rawText, metadata) {
                assert.equal(rawText, SAMPLE_CIRCULAR);
                return {
                    authority: metadata.authority,
                    language: 'en',
                    documentId: 'DOC-TEST-001',
                    sections: [{ heading: 'Article 1', text: 'Obligation text' }],
                };
            },
        };
        const obligationExtractor = {
            extract(sections, authority) {
                assert.equal(sections.length, 1);
                assert.equal(authority, 'SAMA');
                return [
                    {
                        obligationId: 'OBL-SAMA-001',
                        authority: 'SAMA',
                        article: 'Article 1',
                        obligationText: 'Consumer disclosures must use font size minimum 14pt.',
                        obligationType: 'threshold',
                        parameters: { fontSize: 14 },
                        severity: 'high',
                        confidence: 0.94,
                        sourceSection: 'Article 1',
                    },
                ];
            },
        };
        const driftDetector = {
            detect(baseline, obligations, authority) {
                assert.deepStrictEqual(baseline, []);
                assert.equal(obligations.length, 1);
                assert.equal(authority, 'SAMA');
                return [];
            },
        };
        const repository = {
            async loadBaseline(authority) {
                assert.equal(authority, 'SAMA');
                return [];
            },
            async storeDriftAlert() {
                throw new Error('No drift expected in this scenario');
            },
            async storeObligation(obligation, documentId) {
                storedObligations.push({ obligation, documentId });
            },
        };

        const ingestCircular = createNlpIngestionFlow({
            parser,
            obligationExtractor,
            driftDetector,
            repository,
            logger,
        });

        const result = await ingestCircular(SAMPLE_CIRCULAR, {
            authority: 'SAMA',
            title: 'Consumer Protection Circular',
        });

        assert.equal(result.parsed.authority, 'SAMA');
        assert.equal(result.obligations.length, 1);
        assert.equal(storedObligations.length, result.obligations.length);
        assert.equal(result.drifts.length, 0);
        assert.ok(logger.events.some((entry) => entry.event === 'nlp.circular_ingestion.persisted'));
    });
});
