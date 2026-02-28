// ============================================
// SAQR CV Watchman — Milestone XProtect Client
// REST API integration for frame grabbing
// ============================================

/**
 * Milestone XProtect Management Server API client.
 * Pulls frames via the Milestone RESTful Image Server API
 * without creating latency on the client security network.
 *
 * Rate limit: max 1 frame/sec per camera (configurable).
 */
class MilestoneClient {
    /**
     * @param {object} config
     * @param {string} config.host - Management Server hostname
     * @param {number} config.port - Default 80/443
     * @param {string} config.username
     * @param {string} config.password
     * @param {boolean} config.useTLS - Use HTTPS
     * @param {number} config.maxFps - Max frames per second per camera
     */
    constructor(config = {}) {
        this.host = config.host || 'localhost';
        this.port = config.port || 443;
        this.username = config.username || '';
        this.password = config.password || '';
        this.useTLS = config.useTLS !== false;
        this.maxFps = config.maxFps || 1;
        this.baseUrl = `${this.useTLS ? 'https' : 'http'}://${this.host}:${this.port}`;
        this.token = null;
        this.lastGrabTime = new Map(); // cameraId → timestamp
        this.type = 'milestone';
    }

    /**
     * Authenticate with Management Server.
     * @returns {Promise<boolean>}
     */
    async authenticate() {
        try {
            // Milestone uses Windows Authentication or Basic Auth
            // POST /API/IDP/connect/token for modern versions
            const response = await fetch(`${this.baseUrl}/API/IDP/connect/token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    grant_type: 'password',
                    username: this.username,
                    password: this.password,
                    client_id: 'GrantValidatorClient',
                }),
            });

            if (!response.ok) throw new Error(`Auth failed: ${response.status}`);
            const data = await response.json();
            this.token = data.access_token;
            console.log('✅ Milestone XProtect authenticated');
            return true;
        } catch (err) {
            console.error('❌ Milestone auth failed:', err.message);
            return false;
        }
    }

    /**
     * Get list of available cameras.
     * @returns {Promise<Array<{id: string, name: string, enabled: boolean}>>}
     */
    async getCameras() {
        try {
            const response = await fetch(`${this.baseUrl}/API/rest/v1/cameras`, {
                headers: this._authHeaders(),
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            return (data.array || data).map(cam => ({
                id: cam.id || cam.Id,
                name: cam.name || cam.Name || 'Unknown',
                enabled: cam.enabled !== false,
                type: 'milestone',
            }));
        } catch (err) {
            console.warn('Milestone getCameras:', err.message);
            return [];
        }
    }

    /**
     * Grab a single frame from a camera.
     * Respects rate limit to avoid network congestion.
     * @param {string} cameraId
     * @returns {Promise<{buffer: Buffer, timestamp: string, cameraId: string}|null>}
     */
    async grabFrame(cameraId) {
        // Rate limiting
        const now = Date.now();
        const lastGrab = this.lastGrabTime.get(cameraId) || 0;
        const minInterval = 1000 / this.maxFps;
        if (now - lastGrab < minInterval) {
            return null; // Throttled
        }
        this.lastGrabTime.set(cameraId, now);

        try {
            // Milestone Image Server API: /API/rest/v1/cameras/{id}/media
            const response = await fetch(
                `${this.baseUrl}/API/rest/v1/cameras/${cameraId}/media?width=1920&height=1080`,
                { headers: this._authHeaders() }
            );

            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const buffer = Buffer.from(await response.arrayBuffer());

            return {
                buffer,
                timestamp: new Date().toISOString(),
                cameraId,
                source: 'milestone',
                width: 1920,
                height: 1080,
            };
        } catch (err) {
            console.warn(`Milestone grabFrame(${cameraId}):`, err.message);
            return null;
        }
    }

    /**
     * Get system status.
     */
    async getStatus() {
        try {
            const response = await fetch(`${this.baseUrl}/API/rest/v1/status`, {
                headers: this._authHeaders(),
            });
            return response.ok ? 'connected' : 'error';
        } catch {
            return 'disconnected';
        }
    }

    _authHeaders() {
        return {
            'Authorization': `Bearer ${this.token}`,
            'Accept': 'application/json',
        };
    }
}

module.exports = { MilestoneClient };
