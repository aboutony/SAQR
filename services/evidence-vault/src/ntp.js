// ============================================
// SAQR Evidence Vault — NTP Timestamp Service
// Provides authoritative timestamps for evidence records
// ============================================

const dgram = require('dgram');

const NTP_EPOCH_OFFSET = 2208988800n; // seconds between 1900 and 1970

/**
 * Fetches the current time from an NTP server.
 * Falls back to system time if NTP is unreachable (with a warning).
 *
 * @param {string} [server='pool.ntp.org'] - NTP server address
 * @param {number} [timeoutMs=3000] - Timeout in milliseconds
 * @returns {Promise<{ timestamp: string, source: string, epochMs: number }>}
 */
async function getNtpTimestamp(server = 'pool.ntp.org', timeoutMs = 3000) {
    try {
        const ntpTime = await queryNtp(server, timeoutMs);
        return {
            timestamp: ntpTime.toISOString(),
            source: `ntp://${server}`,
            epochMs: ntpTime.getTime(),
        };
    } catch (err) {
        console.warn(`⚠️  NTP query failed (${server}): ${err.message}. Falling back to system clock.`);
        const now = new Date();
        return {
            timestamp: now.toISOString(),
            source: 'system_clock_fallback',
            epochMs: now.getTime(),
        };
    }
}

/**
 * Low-level NTP query using UDP (RFC 5905 simplified).
 *
 * @param {string} server
 * @param {number} timeoutMs
 * @returns {Promise<Date>}
 */
function queryNtp(server, timeoutMs) {
    return new Promise((resolve, reject) => {
        const client = dgram.createSocket('udp4');
        const ntpPacket = Buffer.alloc(48);
        ntpPacket[0] = 0x1b; // LI=0, VN=3, Mode=3 (client)

        const timeout = setTimeout(() => {
            client.close();
            reject(new Error(`NTP timeout after ${timeoutMs}ms`));
        }, timeoutMs);

        client.on('message', (msg) => {
            clearTimeout(timeout);
            client.close();

            // Extract transmit timestamp (bytes 40-47)
            const seconds = msg.readUInt32BE(40);
            const fraction = msg.readUInt32BE(44);

            const epochSeconds = BigInt(seconds) - NTP_EPOCH_OFFSET;
            const ms = Number(epochSeconds) * 1000 + Math.floor((fraction / 0x100000000) * 1000);

            resolve(new Date(ms));
        });

        client.on('error', (err) => {
            clearTimeout(timeout);
            client.close();
            reject(err);
        });

        client.send(ntpPacket, 123, server);
    });
}

module.exports = { getNtpTimestamp };
