// ============================================
// SAQR CV Watchman — Unified VMS Adapter
// Routes to Milestone or Genetec by config
// ============================================

const { MilestoneClient } = require('./milestone-client');
const { GenetecClient } = require('./genetec-client');

/**
 * Unified VMS adapter. Provides a single interface
 * regardless of which VMS vendor is deployed at the site.
 */
class VmsAdapter {
    /**
     * @param {object} config
     * @param {string} config.type - 'milestone' | 'genetec' | 'demo'
     * @param {object} config.connection
     */
    constructor(config = {}) {
        this.type = config.type || 'demo';
        this.cameras = new Map(); // id → camera metadata

        switch (this.type) {
            case 'milestone':
                this.client = new MilestoneClient(config.connection || {});
                break;
            case 'genetec':
                this.client = new GenetecClient(config.connection || {});
                break;
            case 'demo':
            default:
                this.client = new DemoVmsClient();
                break;
        }
    }

    /**
     * Initialize connection and discover cameras.
     */
    async connect() {
        console.log(`🎥 VMS Adapter: Connecting to ${this.type}...`);
        const authenticated = await this.client.authenticate();
        if (!authenticated && this.type !== 'demo') {
            console.error(`❌ VMS ${this.type} authentication failed`);
            return false;
        }

        const cams = await this.client.getCameras();
        for (const cam of cams) {
            this.cameras.set(cam.id, cam);
        }
        console.log(`✅ VMS connected: ${cams.length} cameras discovered`);
        return true;
    }

    /**
     * Grab a frame from a specific camera.
     * @param {string} cameraId
     */
    async grabFrame(cameraId) {
        return this.client.grabFrame(cameraId);
    }

    /**
     * Grab frames from all registered cameras.
     * @returns {Promise<Array>}
     */
    async grabAllFrames() {
        const results = [];
        for (const [id] of this.cameras) {
            const frame = await this.grabFrame(id);
            if (frame) results.push(frame);
        }
        return results;
    }

    /**
     * Get all camera metadata.
     */
    getCameras() {
        return Array.from(this.cameras.values());
    }

    /**
     * Get adapter status.
     */
    async getStatus() {
        return this.client.getStatus();
    }

    /**
     * Register a camera manually (for demo/test scenarios).
     */
    registerCamera(camera) {
        this.cameras.set(camera.id, camera);
    }
}

// -----------------------------------------------
// Demo VMS Client (for local development)
// -----------------------------------------------
class DemoVmsClient {
    constructor() {
        this.type = 'demo';
        this.lastGrabTime = new Map();
    }

    async authenticate() {
        console.log('🎬 Demo VMS: No auth required');
        return true;
    }

    async getCameras() {
        return [
            { id: 'CAM-BRANCH-01', name: 'Main Entrance — Riyadh Branch', enabled: true, type: 'demo' },
            { id: 'CAM-BRANCH-02', name: 'Storefront — Riyadh Branch', enabled: true, type: 'demo' },
            { id: 'CAM-BRANCH-03', name: 'Parking Lot — Riyadh Branch', enabled: true, type: 'demo' },
            { id: 'CAM-SITE-01', name: 'Street View — Jeddah Site', enabled: true, type: 'demo' },
            { id: 'CAM-SITE-02', name: 'Interior Hall — Jeddah Site', enabled: true, type: 'demo' },
        ];
    }

    async grabFrame(cameraId) {
        const now = Date.now();
        const lastGrab = this.lastGrabTime.get(cameraId) || 0;
        if (now - lastGrab < 1000) return null;
        this.lastGrabTime.set(cameraId, now);

        // Generate a synthetic "frame" — 64 bytes representing a hash-able snapshot
        const syntheticBuffer = Buffer.alloc(64);
        syntheticBuffer.write(`SAQR-FRAME-${cameraId}-${now}`, 0, 'utf8');

        return {
            buffer: syntheticBuffer,
            timestamp: new Date().toISOString(),
            cameraId,
            source: 'demo',
            width: 1920,
            height: 1080,
        };
    }

    async getStatus() {
        return 'connected';
    }
}

module.exports = { VmsAdapter, DemoVmsClient };
