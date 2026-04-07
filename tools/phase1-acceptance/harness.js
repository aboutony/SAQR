const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const {
    createCdcMessageProcessor,
    createDebeziumMessageDecoder,
    createMerkleBatchProcessor,
} = require('../../services/evidence-vault/src/cdc-flow');
const { createComplianceEvaluationService } = require('../../services/evidence-vault/src/compliance-engine');
const {
    createNlpIngestionFlow,
    createRuleBasedNlpProviders,
} = require('../../services/nlp-interpreter/src/nlp-flow');
const {
    createRegulatorySourceOrchestrator,
    createRegulatorySourceProvider,
} = require('../../services/sentinel-scrapers/src/source-adapters');
const { createRegulatoryStagingIngestionFlow } = require('../../services/sentinel-scrapers/src/bridge');
const {
    createCvScanFlow,
    createEvidenceFactory,
} = require('../../services/cv-watchman/src/cv-flow');
const { VmsAdapter } = require('../../services/cv-watchman/src/vms/vms-adapter');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

function readJson(relativePath) {
    return JSON.parse(fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8'));
}

function loadManifest() {
    return readJson('fixtures/phase1-acceptance/manifest.json');
}

function createHarnessLogger() {
    const events = [];
    const logger = {
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
        error(event, error, fields = {}) {
            events.push({ level: 'error', event, error: error?.message || String(error), fields });
        },
        child(context = {}) {
            return {
                ...logger,
                info(event, fields = {}) {
                    events.push({ level: 'info', event, fields: { ...context, ...fields } });
                },
                warn(event, fields = {}) {
                    events.push({ level: 'warn', event, fields: { ...context, ...fields } });
                },
                audit(event, fields = {}) {
                    events.push({ level: 'audit', event, fields: { ...context, ...fields } });
                },
                error(event, error, fields = {}) {
                    events.push({
                        level: 'error',
                        event,
                        error: error?.message || String(error),
                        fields: { ...context, ...fields },
                    });
                },
            };
        },
    };

    return logger;
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

async function runCdcScenario(relativePath) {
    const fixture = readJson(relativePath);
    const logger = createHarnessLogger();
    const result = createScenarioResult('cdc', fixture.fixtureId);
    const complianceService = createComplianceEvaluationService();
    const storedCdcEvents = [];
    const storedEvidence = [];
    let storedMerkleBatch = null;

    const repository = {
        async storeCdcEvent(event, timestampRecord, hash) {
            storedCdcEvents.push({ event, timestampRecord, hash });
            return storedCdcEvents.length;
        },
        async storeViolationEvidence(violation, timestampRecord) {
            const payload = {
                ...violation,
                ntpTimestamp: timestampRecord.timestamp,
            };
            const hash = crypto.createHash('sha256')
                .update(JSON.stringify(payload))
                .digest('hex');

            storedEvidence.push({
                violation,
                hash,
            });

            return {
                evidenceId: storedEvidence.length,
                hash,
                inserted: true,
            };
        },
        async loadEvidenceHashesForDate() {
            return storedEvidence.map(entry => entry.hash);
        },
        async storeMerkleBatch(batch) {
            storedMerkleBatch = batch;
        },
    };

    const processMessage = createCdcMessageProcessor({
        messageDecoder: createDebeziumMessageDecoder(),
        timestampAuthority: {
            async getTimestamp() {
                return fixture.timestampRecord;
            },
        },
        complianceEvaluator: {
            detect(table, operation, record) {
                return complianceService.evaluate({
                    table,
                    operation,
                    afterState: record,
                    now: new Date(fixture.timestampRecord.timestamp),
                });
            },
        },
        repository,
        logger,
    });

    for (const eventFixture of fixture.events) {
        const evidenceCountBefore = storedEvidence.length;

        await processMessage({
            value: Buffer.from(JSON.stringify(eventFixture.message)),
        });

        const actualCodes = storedEvidence
            .slice(evidenceCountBefore)
            .map(entry => entry.violation.violationCode);

        addCheck(
            result,
            `${eventFixture.name}.violation_codes`,
            JSON.stringify(sortStrings(actualCodes)) === JSON.stringify(sortStrings(eventFixture.expectedViolationCodes)),
            {
                expected: sortStrings(eventFixture.expectedViolationCodes),
                actual: sortStrings(actualCodes),
            }
        );
    }

    const computeDailyMerkle = createMerkleBatchProcessor({
        repository,
        logger,
    });

    const merkleResult = await computeDailyMerkle(fixture.timestampRecord.timestamp.split('T')[0]);

    addCheck(result, 'cdc.total_events', storedCdcEvents.length === fixture.expected.totalCdcEvents, {
        expected: fixture.expected.totalCdcEvents,
        actual: storedCdcEvents.length,
    });
    addCheck(result, 'cdc.total_evidence', storedEvidence.length === fixture.expected.totalEvidenceRecords, {
        expected: fixture.expected.totalEvidenceRecords,
        actual: storedEvidence.length,
    });
    addCheck(result, 'cdc.merkle_batch_created', Boolean(merkleResult) === fixture.expected.merkleBatch, {
        expected: fixture.expected.merkleBatch,
        actual: Boolean(merkleResult),
    });

    result.summary = {
        storedCdcEvents: storedCdcEvents.length,
        storedEvidence: storedEvidence.length,
        storedMerkleBatch,
        loggerEvents: logger.events.length,
    };

    return result;
}

async function runNlpScenario(relativePath) {
    const fixture = readJson(relativePath);
    const logger = createHarnessLogger();
    const result = createScenarioResult('nlp', fixture.fixtureId);
    const storedObligations = [];
    const storedDrifts = [];
    const expectedDriftTypes = fixture.expected.mustIncludeDriftTypes || [];
    const expectedParameterKeys = fixture.expected.mustIncludeParameterKeys || [];
    const { parser, obligationExtractor, driftDetector } = createRuleBasedNlpProviders();

    const ingestCircular = createNlpIngestionFlow({
        parser,
        obligationExtractor,
        driftDetector,
        repository: {
            async loadBaseline() {
                return fixture.baseline;
            },
            async storeDriftAlert(alert) {
                storedDrifts.push(alert);
            },
            async storeObligation(obligation, documentId) {
                storedObligations.push({
                    ...obligation,
                    documentId,
                });
            },
        },
        logger,
    });

    const ingestionResult = await ingestCircular(fixture.rawText, fixture.metadata);
    const driftTypes = [...new Set(storedDrifts.map(alert => alert.driftType))];
    const parameterKeys = [...new Set(storedDrifts.flatMap(alert => Object.keys(alert.parameterDiff || {})))];

    addCheck(result, 'nlp.minimum_obligations', storedObligations.length >= fixture.expected.minimumObligationCount, {
        expected: fixture.expected.minimumObligationCount,
        actual: storedObligations.length,
    });
    addCheck(result, 'nlp.drift_count', storedDrifts.length === fixture.expected.driftCount, {
        expected: fixture.expected.driftCount,
        actual: storedDrifts.length,
    });
    addCheck(
        result,
        'nlp.drift_types',
        expectedDriftTypes.every(type => driftTypes.includes(type)),
        {
            expected: expectedDriftTypes,
            actual: driftTypes,
        }
    );
    addCheck(
        result,
        'nlp.parameter_keys',
        expectedParameterKeys.every(key => parameterKeys.includes(key)),
        {
            expected: expectedParameterKeys,
            actual: parameterKeys,
        }
    );

    result.summary = {
        documentId: ingestionResult.parsed.documentId,
        obligations: storedObligations.length,
        drifts: storedDrifts.length,
        driftTypes,
        loggerEvents: logger.events.length,
    };

    return result;
}

async function runSentinelScenario(relativePath) {
    const fixture = readJson(relativePath);
    const logger = createHarnessLogger();
    const result = createScenarioResult('sentinel', fixture.fixtureId);
    const stagedRules = [];
    const seenHashes = new Set();

    const sources = fixture.sources.map((source) => createRegulatorySourceProvider({
        authority: source.authority,
        liveScraper: async () => source.entries,
        demoScraper: () => source.entries,
    }));

    const orchestrator = createRegulatorySourceOrchestrator({
        sources,
        logger,
    });

    const ingestRules = createRegulatoryStagingIngestionFlow({
        repository: {
            async upsertRule(rule) {
                if (seenHashes.has(rule.contentHash)) {
                    return { inserted: false, duplicate: true };
                }

                seenHashes.add(rule.contentHash);
                stagedRules.push(rule);
                return { inserted: true, duplicate: false };
            },
        },
        logger,
    });

    const orchestrated = await orchestrator.run({
        mode: fixture.mode,
        browser: null,
    });
    const ingestSummary = await ingestRules(orchestrated.entries);

    addCheck(
        result,
        'sentinel.authorities',
        JSON.stringify(sortStrings(Object.keys(orchestrated.byAuthority))) === JSON.stringify(sortStrings(fixture.expected.authorities)),
        {
            expected: sortStrings(fixture.expected.authorities),
            actual: sortStrings(Object.keys(orchestrated.byAuthority)),
        }
    );
    addCheck(result, 'sentinel.total_entries', orchestrated.entries.length === fixture.expected.totalEntries, {
        expected: fixture.expected.totalEntries,
        actual: orchestrated.entries.length,
    });
    addCheck(result, 'sentinel.ingested', ingestSummary.ingested === fixture.expected.ingested, {
        expected: fixture.expected.ingested,
        actual: ingestSummary.ingested,
    });
    addCheck(result, 'sentinel.duplicates', ingestSummary.duplicates === fixture.expected.duplicates, {
        expected: fixture.expected.duplicates,
        actual: ingestSummary.duplicates,
    });

    result.summary = {
        stagedRules: stagedRules.length,
        ingestSummary,
        loggerEvents: logger.events.length,
    };

    return result;
}

async function runCvScenario(relativePath) {
    const fixture = readJson(relativePath);
    const logger = createHarnessLogger();
    const result = createScenarioResult('cv', fixture.fixtureId);
    const storedEvidence = [];
    const maintenanceAlerts = [];
    const evidenceFactory = createEvidenceFactory();

    const customRegistry = {
        [fixture.providerType]: () => ({
            async authenticate() {
                return true;
            },
            async getCameras() {
                return fixture.cameras;
            },
            async grabFrame(cameraId) {
                const frame = fixture.frames.find(entry => entry.cameraId === cameraId);
                if (!frame) return null;

                return {
                    buffer: Buffer.from(frame.bufferBase64, 'base64'),
                    timestamp: frame.timestamp,
                    cameraId: frame.cameraId,
                    source: frame.source,
                    width: frame.width,
                    height: frame.height,
                };
            },
            async getStatus() {
                return 'connected';
            },
        }),
    };

    const adapter = new VmsAdapter({
        type: fixture.providerType,
        registry: customRegistry,
        logger,
    });
    await adapter.connect();

    const runScanCycle = createCvScanFlow({
        frameSource: adapter,
        detectionEngine: {
            detect(frame) {
                return fixture.detectionsByCamera[frame.cameraId] || [];
            },
        },
        evidenceFactory,
        evidenceRepository: {
            async record(evidence) {
                storedEvidence.push(evidence);
            },
        },
        maintenanceNotifier: {
            notify(evidence) {
                maintenanceAlerts.push(evidence);
            },
        },
        logger,
    });

    const detectionCount = await runScanCycle();

    addCheck(result, 'cv.camera_count', adapter.getCameras().length === fixture.expected.cameraCount, {
        expected: fixture.expected.cameraCount,
        actual: adapter.getCameras().length,
    });
    addCheck(result, 'cv.detection_count', detectionCount === fixture.expected.detectionCount, {
        expected: fixture.expected.detectionCount,
        actual: detectionCount,
    });
    addCheck(result, 'cv.persisted_evidence', storedEvidence.length === fixture.expected.persistedEvidenceCount, {
        expected: fixture.expected.persistedEvidenceCount,
        actual: storedEvidence.length,
    });
    addCheck(result, 'cv.maintenance_alerts', maintenanceAlerts.length === fixture.expected.maintenanceAlerts, {
        expected: fixture.expected.maintenanceAlerts,
        actual: maintenanceAlerts.length,
    });

    result.summary = {
        cameraIds: adapter.getCameras().map(camera => camera.id),
        persistedEvidenceCount: storedEvidence.length,
        maintenanceAlerts: maintenanceAlerts.length,
        loggerEvents: logger.events.length,
    };

    return result;
}

const SCENARIO_RUNNERS = {
    cdc: runCdcScenario,
    nlp: runNlpScenario,
    sentinel: runSentinelScenario,
    cv: runCvScenario,
};

async function runScenario(name) {
    const manifest = loadManifest();
    const scenario = manifest.scenarios[name];

    if (!scenario) {
        throw new Error(`Unknown acceptance scenario: ${name}`);
    }

    return SCENARIO_RUNNERS[name](scenario.fixture);
}

async function runAllScenarios() {
    const manifest = loadManifest();
    const scenarioNames = Object.keys(manifest.scenarios);
    const results = [];

    for (const name of scenarioNames) {
        results.push(await runScenario(name));
    }

    return results;
}

module.exports = {
    REPO_ROOT,
    loadManifest,
    runAllScenarios,
    runScenario,
};
