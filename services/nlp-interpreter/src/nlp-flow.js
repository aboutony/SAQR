const { parseCircular } = require('./regulatory-parser');
const { extractObligations } = require('./obligation-extractor');
const { detectDrift } = require('./drift-detector');
const { assertProviderContract } = require('../../../shared/provider-contract');

function createRuleBasedNlpProviders() {
    return {
        parser: {
            parse(rawText, metadata) {
                return parseCircular(rawText, metadata);
            },
        },
        obligationExtractor: {
            extract(sections, authority) {
                return extractObligations(sections, authority);
            },
        },
        driftDetector: {
            detect(baseline, obligations, authority) {
                return detectDrift(baseline, obligations, authority);
            },
        },
    };
}

function mapBaselineRow(row) {
    return {
        obligationId: row.obligation_id,
        authority: row.authority,
        article: row.article,
        obligationText: row.obligation_text,
        obligationType: row.obligation_type,
        parameters: typeof row.parameters === 'string' ? JSON.parse(row.parameters) : row.parameters,
        severity: row.severity,
        confidence: row.confidence,
        sourceSection: row.source_section,
    };
}

function createPostgresNlpRepository(queryAdapter) {
    assertProviderContract('nlp.queryAdapter', queryAdapter, ['query']);

    return {
        async loadBaseline(authority) {
            const result = await queryAdapter.query(
                `SELECT obligation_id, authority, article, obligation_text,
                  obligation_type, parameters, severity, confidence, source_section
           FROM shadow.obligations
           WHERE authority = $1
           ORDER BY id`,
                [authority]
            );

            return result.rows.map(mapBaselineRow);
        },

        async storeDriftAlert(alert) {
            const query = `
        INSERT INTO shadow.instruction_drift
          (alert_id, drift_type, authority, severity, title, description,
           previous_obligation, new_obligation, parameter_diff, detected_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (alert_id) DO NOTHING
        RETURNING id
      `;
            const values = [
                alert.alertId,
                alert.driftType,
                alert.authority,
                alert.severity,
                alert.title,
                alert.description,
                JSON.stringify(alert.previousObligation),
                JSON.stringify(alert.newObligation),
                JSON.stringify(alert.parameterDiff),
                alert.detectedAt,
            ];

            return queryAdapter.query(query, values);
        },

        async storeObligation(obligation, documentId) {
            const query = `
        INSERT INTO shadow.obligations
          (obligation_id, document_id, authority, article, obligation_text,
           obligation_type, parameters, severity, confidence, source_section)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (obligation_id) DO UPDATE SET
          obligation_text = EXCLUDED.obligation_text,
          parameters = EXCLUDED.parameters,
          confidence = EXCLUDED.confidence,
          updated_at = NOW()
        RETURNING id
      `;
            const values = [
                obligation.obligationId,
                documentId,
                obligation.authority,
                obligation.article,
                obligation.obligationText,
                obligation.obligationType,
                JSON.stringify(obligation.parameters),
                obligation.severity,
                obligation.confidence,
                obligation.sourceSection,
            ];

            return queryAdapter.query(query, values);
        },
    };
}

function createNlpIngestionFlow({ parser, obligationExtractor, driftDetector, repository, logger }) {
    const parserProvider = assertProviderContract('nlp.parser', parser, ['parse']);
    const extractorProvider = assertProviderContract('nlp.obligationExtractor', obligationExtractor, ['extract']);
    const driftProvider = assertProviderContract('nlp.driftDetector', driftDetector, ['detect']);
    const repositoryProvider = assertProviderContract('nlp.repository', repository, [
        'loadBaseline',
        'storeDriftAlert',
        'storeObligation',
    ]);

    return async function ingestCircular(rawText, metadata) {
        logger.info('nlp.circular_ingestion.started', {
            authority: metadata.authority || 'UNKNOWN',
            title: metadata.title || 'Untitled',
        });

        const parsed = parserProvider.parse(rawText, metadata);
        logger.info('nlp.circular_ingestion.parsed', {
            authority: parsed.authority,
            sectionCount: parsed.sections.length,
            language: parsed.language,
            documentId: parsed.documentId,
        });

        const obligations = extractorProvider.extract(parsed.sections, parsed.authority);
        logger.info('nlp.circular_ingestion.obligations_extracted', {
            authority: parsed.authority,
            obligationCount: obligations.length,
            documentId: parsed.documentId,
        });

        let baseline = [];
        try {
            baseline = await repositoryProvider.loadBaseline(parsed.authority);
            logger.info('nlp.circular_ingestion.baseline_loaded', {
                authority: parsed.authority,
                baselineCount: baseline.length,
            });
        } catch (error) {
            logger.warn('nlp.circular_ingestion.baseline_unavailable', {
                authority: parsed.authority,
                error,
            });
        }

        const drifts = driftProvider.detect(baseline, obligations, parsed.authority);
        if (drifts.length > 0) {
            logger.audit('nlp.drift_detected_batch', {
                authority: parsed.authority,
                driftCount: drifts.length,
                documentId: parsed.documentId,
            });

            for (const drift of drifts) {
                logger.audit('nlp.drift_detected', {
                    authority: drift.authority,
                    alertId: drift.alertId,
                    severity: drift.severity,
                    title: drift.title,
                });
                await repositoryProvider.storeDriftAlert(drift);
            }
        } else {
            logger.info('nlp.circular_ingestion.no_drift_detected', {
                authority: parsed.authority,
                documentId: parsed.documentId,
            });
        }

        for (const obligation of obligations) {
            await repositoryProvider.storeObligation(obligation, parsed.documentId);
        }

        logger.info('nlp.circular_ingestion.persisted', {
            authority: parsed.authority,
            obligationCount: obligations.length,
            driftCount: drifts.length,
            documentId: parsed.documentId,
        });

        return { parsed, obligations, drifts };
    };
}

module.exports = {
    createNlpIngestionFlow,
    createPostgresNlpRepository,
    createRuleBasedNlpProviders,
};
