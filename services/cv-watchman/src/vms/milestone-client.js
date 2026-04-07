// ============================================
// SAQR CV Watchman - Milestone XProtect Client
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
     * @param {object} [config.logger]
     */
    constructor(config = {}) {
        this.host = config.host || 'localhost';
        this.port = config.port || 443;
        this.username = config.username || '';
        this.password = config.password || '';
        this.useTLS = config.useTLS !== false;
        this.maxFps = config.maxFps || 1;
        this.logger = config.logger || null;
        this.baseUrl = `${this.useTLS ? 'https' : 'http'}://${this.host}:${this.port}`;
        this.token = null;
        this.lastGrabTime = new Map();
        this.type = 'milestone';
    }

    /**
     * Authenticate with Management Server.
     * @returns {Promise<boolean>}
     */
    async authenticate() {
        try {
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

            if (!response.ok) {
                throw new Error(`Auth failed: ${response.status}`);
            }

            const data = await response.json();
            this.token = data.access_token;
            this.logger?.info('dependency.vms.provider_authenticated', {
                provider: this.type,
            });
            return true;
        } catch (err) {
            this.logger?.error('dependency.vms.provider_auth_failed', err, {
                provider: this.type,
                host: this.host,
                port: this.port,
            });
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
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const data = await response.json();
            return (data.array || data).map((camera) => ({
                id: camera.id || camera.Id,
                name: camera.name || camera.Name || 'Unknown',
                enabled: camera.enabled !== false,
                type: 'milestone',
            }));
        } catch (err) {
            this.logger?.warn('dependency.vms.camera_discovery_failed', {
                provider: this.type,
                reason: err.message,
            });
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
        const now = Date.now();
        const lastGrab = this.lastGrabTime.get(cameraId) || 0;
        const minInterval = 1000 / this.maxFps;
        if (now - lastGrab < minInterval) {
            return null;
        }
        this.lastGrabTime.set(cameraId, now);

        try {
            const response = await fetch(
                `${this.baseUrl}/API/rest/v1/cameras/${cameraId}/media?width=1920&height=1080`,
                { headers: this._authHeaders() }
            );

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

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
            this.logger?.warn('cv.frame_grab_failed', {
                provider: this.type,
                cameraId,
                reason: err.message,
            });
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
            Authorization: `Bearer ${this.token}`,
            Accept: 'application/json',
        };
    }
}

module.exports = { MilestoneClient };
