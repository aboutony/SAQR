// ============================================
// SAQR Evidence Vault — SHA-256 Hashing Engine
// Saudi Law of Evidence (Royal Decree M/43, 2022) compliant
// ============================================

const crypto = require('crypto');

/**
 * Computes SHA-256 hash of any payload.
 * The hash includes a deterministic serialisation to ensure
 * reproducible hashes across different systems.
 *
 * @param {object|string} payload - Data to hash
 * @returns {string} 64-character lowercase hex SHA-256 digest
 */
function computeHash(payload) {
  const canonical = typeof payload === 'string'
    ? payload
    : JSON.stringify(payload, Object.keys(payload).sort());

  return crypto
    .createHash('sha256')
    .update(canonical, 'utf8')
    .digest('hex');
}

/**
 * Computes the hash of a CDC event, including its NTP timestamp.
 * The timestamp is baked into the hash to create a tamper-evident
 * time-bound record.
 *
 * @param {object} event - CDC change event
 * @param {string} ntpTimestamp - ISO 8601 NTP-synced timestamp
 * @returns {string} SHA-256 hash
 */
function hashCdcEvent(event, ntpTimestamp) {
  const hashPayload = {
    source: event.source_system || event.source?.db || 'unknown',
    table: event.source_table || event.source?.table || 'unknown',
    operation: event.op || event.operation,
    before: event.before || null,
    after: event.after || null,
    ntp_timestamp: ntpTimestamp,
  };
  return computeHash(hashPayload);
}

/**
 * Computes Merkle root from a list of leaf hashes.
 * Used for daily batch integrity proofs.
 *
 * @param {string[]} hashes - Array of SHA-256 hex strings
 * @returns {string} Merkle root hash
 */
function computeMerkleRoot(hashes) {
  if (hashes.length === 0) {
    return computeHash('EMPTY_BATCH');
  }
  if (hashes.length === 1) {
    return hashes[0];
  }

  const nextLevel = [];
  for (let i = 0; i < hashes.length; i += 2) {
    const left = hashes[i];
    const right = i + 1 < hashes.length ? hashes[i + 1] : left; // duplicate last if odd
    nextLevel.push(computeHash(left + right));
  }
  return computeMerkleRoot(nextLevel);
}

/**
 * Verifies a hash against a payload.
 *
 * @param {object|string} payload - Original payload
 * @param {string} expectedHash - Expected SHA-256 hex digest
 * @returns {boolean}
 */
function verifyHash(payload, expectedHash) {
  return computeHash(payload) === expectedHash;
}

module.exports = {
  computeHash,
  hashCdcEvent,
  computeMerkleRoot,
  verifyHash,
};
