// ============================================
// SAQR CV Watchman — Genetec Security Center Client
// Web SDK integration for frame grabbing
// ============================================

/**
 * Genetec Security Center Web SDK client.
 * Same interface as MilestoneClient for unified VMS adapter.
 */
class GenetecClient {
    /**
     * @param {object} config
     * @param {string} config.host - Security Center hostname
     * @param {number} config.port - Web SDK port (default 4590)
     * @param {string} config.username
     * @param {string} config.password
     * @param {string} config.appId - Application registration ID
     * @param {number} config.maxFps
     */
    constructor(config = {}) {
        this.host = config.host || 'localhost';
        this.port = config.port || 4590;
        this.username = config.username || '';
        this.password = config.password || '';
        this.appId = config.appId || 'SAQR-Watchman';
        this.maxFps = config.maxFps || 1;
        this.baseUrl = `https://${this.host}:${this.port}/WebSdk`;
        this.sessionId = null;
        this.lastGrabTime = new Map();
        this.type = 'genetec';
    }

    /**
     * Authenticate and create a session.
     * @returns {Promise<boolean>}
     */
    async authenticate() {
        try {
            const authString = Buffer.from(`${this.username}:${this.password}`).toString('base64');
            const response = await fetch(`${this.baseUrl}/Authentication`, {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${authString}`,
                    'Content-Type': 'application/json',
                    'X-Application-Id': this.appId,
                },
                body: JSON.stringify({ ApplicationId: this.appId }),
            });

            if (!response.ok) throw new Error(`Auth failed: ${response.status}`);
            const data = await response.json();
            this.sessionId = data.SessionId || data.Token;
            console.log('✅ Genetec Security Center authenticated');
            return true;
        } catch (err) {
            console.error('❌ Genetec auth failed:', err.message);
            return false;
        }
    }

    /**
     * Get list of available cameras.
     */
    async getCameras() {
        try {
            const response = await fetch(`${this.baseUrl}/Entities?EntityType=Camera`, {
                headers: this._authHeaders(),
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            return (data.Entities || data).map(cam => ({
                id: cam.Guid || cam.Id,
                name: cam.Name || 'Unknown',
                enabled: cam.IsOnline !== false,
                type: 'genetec',
            }));
        } catch (err) {
            console.warn('Genetec getCameras:', err.message);
            return [];
        }
    }

    /**
     * Grab a single frame from a camera.
     */
    async grabFrame(cameraId) {
        const now = Date.now();
        const lastGrab = this.lastGrabTime.get(cameraId) || 0;
        const minInterval = 1000 / this.maxFps;
        if (now - lastGrab < minInterval) return null;
        this.lastGrabTime.set(cameraId, now);

        try {
            const response = await fetch(
                `${this.baseUrl}/Cameras/${cameraId}/Snapshot?Width=1920&Height=1080`,
                { headers: this._authHeaders() }
            );

            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const buffer = Buffer.from(await response.arrayBuffer());

            return {
                buffer,
                timestamp: new Date().toISOString(),
                cameraId,
                source: 'genetec',
                width: 1920,
                height: 1080,
            };
        } catch (err) {
            console.warn(`Genetec grabFrame(${cameraId}):`, err.message);
            return null;
        }
    }

    /**
     * Get system status.
     */
    async getStatus() {
        try {
            const response = await fetch(`${this.baseUrl}/SystemStatus`, {
                headers: this._authHeaders(),
            });
            return response.ok ? 'connected' : 'error';
        } catch {
            return 'disconnected';
        }
    }

    _authHeaders() {
        return {
            'X-Session-Id': this.sessionId,
            'X-Application-Id': this.appId,
            'Accept': 'application/json',
        };
    }
}

module.exports = { GenetecClient };
