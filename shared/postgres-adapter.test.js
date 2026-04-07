const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { createPostgresAdapter } = require('./postgres-adapter');

describe('Postgres adapter', () => {
    it('delegates queries to the underlying pool', async () => {
        const calls = [];
        const adapter = createPostgresAdapter({
            async query(text, params) {
                calls.push({ text, params });
                return { rows: [{ ok: true }] };
            },
        }, { name: 'test-db' });

        const result = await adapter.query('SELECT $1::int AS value', [7]);
        assert.deepStrictEqual(result.rows, [{ ok: true }]);
        assert.deepStrictEqual(calls, [
            { text: 'SELECT $1::int AS value', params: [7] },
        ]);
    });

    it('runs a healthcheck query', async () => {
        let queryCount = 0;
        const adapter = createPostgresAdapter({
            async query(text) {
                queryCount += 1;
                assert.equal(text, 'SELECT 1 AS ok');
                return { rows: [{ ok: 1 }] };
            },
        }, { name: 'health-db' });

        const result = await adapter.healthcheck();
        assert.equal(queryCount, 1);
        assert.equal(result.rows[0].ok, 1);
    });

    it('closes the underlying pool when supported', async () => {
        let closed = false;
        const adapter = createPostgresAdapter({
            async query() {
                return { rows: [] };
            },
            async end() {
                closed = true;
            },
        }, { name: 'close-db' });

        await adapter.close();
        assert.equal(closed, true);
    });
});
