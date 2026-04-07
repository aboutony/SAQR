const { assertProviderContract } = require('./provider-contract');

function createPostgresAdapter(pool, options = {}) {
    const name = options.name || 'postgres';
    const logger = options.logger || null;

    assertProviderContract(`${name}.pool`, pool, ['query']);

    return {
        name,

        async query(text, params = []) {
            return pool.query(text, params);
        },

        async healthcheck(sql = 'SELECT 1 AS ok') {
            const startedAt = Date.now();
            const result = await pool.query(sql);

            logger?.debug('dependency.db.healthcheck_completed', {
                adapter: name,
                durationMs: Date.now() - startedAt,
            });

            return result;
        },

        async close() {
            if (typeof pool.end === 'function') {
                await pool.end();
            }
        },
    };
}

module.exports = {
    createPostgresAdapter,
};
