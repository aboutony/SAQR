const { assertProviderContract } = require('../../../shared/provider-contract');
const { scrapeSAMA, scrapeSAMADemo } = require('./sama-scraper');
const { scrapeSDAIA, scrapeSDAIADemo } = require('./sdaia-scraper');

function normalizeSourceRegistry(registry) {
    if (registry instanceof Map) {
        return registry;
    }

    return new Map(Object.entries(registry || {}));
}

function createRegulatorySourceProvider({ authority, liveScraper, demoScraper }) {
    return {
        authority,
        async fetchEntries({ mode, browser, logger }) {
            if (mode === 'live') {
                return liveScraper(browser, { logger });
            }

            return demoScraper();
        },
    };
}

function createDefaultRegulatorySourceRegistry() {
    return new Map([
        ['SAMA', createRegulatorySourceProvider({
            authority: 'SAMA',
            liveScraper: scrapeSAMA,
            demoScraper: scrapeSAMADemo,
        })],
        ['SDAIA', createRegulatorySourceProvider({
            authority: 'SDAIA',
            liveScraper: scrapeSDAIA,
            demoScraper: scrapeSDAIADemo,
        })],
    ]);
}

function resolveRegulatorySources(authorities, registry = createDefaultRegulatorySourceRegistry()) {
    const normalizedRegistry = normalizeSourceRegistry(registry);

    return authorities.map((authority) => {
        const provider = normalizedRegistry.get(authority);
        if (!provider) {
            throw new Error(`No regulatory source provider registered for authority: ${authority}`);
        }

        assertProviderContract(`regulatorySource.${authority}`, provider, ['fetchEntries']);
        return provider;
    });
}

function createRegulatorySourceOrchestrator({ sources, logger }) {
    const providers = sources.map((source) => {
        assertProviderContract(`regulatorySource.${source.authority || 'unknown'}`, source, ['fetchEntries']);
        return source;
    });

    return {
        async run({ mode, browser }) {
            const authorityPairs = await Promise.all(providers.map(async (provider) => {
                const entries = await provider.fetchEntries({
                    mode,
                    browser,
                    logger,
                });

                logger?.info('scrape.source_provider_completed', {
                    authority: provider.authority || 'UNKNOWN',
                    mode,
                    resultCount: entries.length,
                });

                return [provider.authority, entries];
            }));

            return {
                byAuthority: Object.fromEntries(authorityPairs),
                entries: authorityPairs.flatMap(([, entries]) => entries),
            };
        },
    };
}

module.exports = {
    createDefaultRegulatorySourceRegistry,
    createRegulatorySourceOrchestrator,
    createRegulatorySourceProvider,
    normalizeSourceRegistry,
    resolveRegulatorySources,
};
