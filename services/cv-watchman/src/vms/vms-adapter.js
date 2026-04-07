// ============================================
// SAQR CV Watchman - Unified VMS Adapter
// Routes to built-in or injected providers
// ============================================

const { MilestoneClient } = require('./milestone-client');
const { GenetecClient } = require('./genetec-client');
const { assertProviderContract } = require('../../../../shared/provider-contract');

function normalizeProviderRegistry(registry) {
    if (registry instanceof Map) {
        return registry;
    }

    return new Map(Object.entries(registry || {}));
}

function createDefaultVmsProviderRegistry() {
    return new Map([
        ['milestone', connection => new MilestoneClient(connection)],
        ['genetec', connection => new GenetecClient(connection)],
        ['demo', connection => new DemoVmsClient(connection.logger)],
    ]);
}

function createVmsProvider({ type = 'demo', connection = {}, registry = createDefaultVmsProviderRegistry() }) {
    const normalizedRegistry = normalizeProviderRegistry(registry);
    const factory = normalizedRegistry.get(type);

    if (typeof factory !== 'function') {
        throw new Error(`Unsupported VMS adapter type: ${type}`);
    }

    const provider = factory(connection);
    return assertProviderContract(`vms.provider.${type}`, provider, [
        'authenticate',
        'getCameras',
        'grabFrame',
        'getStatus',
    ]);
}

class VmsAdapter {
    constructor(config = {}) {
        this.type = config.type || 'demo';
        this.logger = config.logger || null;
        this.cameras = new Map();
        this.registry = normalizeProviderRegistry(config.registry || createDefaultVmsProviderRegistry());

        if (!this.registry.has(this.type)) {
            throw new Error(`Unsupported VMS adapter type: ${this.type}`);
        }

        const connection = {
            ...(config.connection || {}),
            logger: this.logger ? this.logger.child({ component: 'vms', provider: this.type }) : null,
        };

        this.client = createVmsProvider({
            type: this.type,
            connection,
            registry: this.registry,
        });
    }

    async connect() {
        this.logger?.info('dependency.vms.connection_started', {
            provider: this.type,
        });

        const authenticated = await this.client.authenticate();
        if (!authenticated && this.type !== 'demo') {
            this.logger?.error('dependency.vms.authentication_failed', new Error('VMS authentication failed'), {
                provider: this.type,
            });
            return false;
        }

        const cameras = await this.client.getCameras();
        for (const camera of cameras) {
            this.cameras.set(camera.id, camera);
        }

        this.logger?.info('dependency.vms.discovery_completed', {
            provider: this.type,
            cameraCount: cameras.length,
        });
        return true;
    }

    async grabFrame(cameraId) {
        return this.client.grabFrame(cameraId);
    }

    async grabAllFrames() {
        const results = [];
        for (const [id] of this.cameras) {
            const frame = await this.grabFrame(id);
            if (frame) {
                results.push(frame);
            }
        }
        return results;
    }

    getCameras() {
        return Array.from(this.cameras.values());
    }

    async getStatus() {
        return this.client.getStatus();
    }

    registerCamera(camera) {
        this.cameras.set(camera.id, camera);
    }
}

class DemoVmsClient {
    constructor(logger = null) {
        this.type = 'demo';
        this.logger = logger || null;
        this.lastGrabTime = new Map();
    }

    async authenticate() {
        this.logger?.info('dependency.vms.demo_auth_bypassed');
        return true;
    }

    async getCameras() {
        return [
            { id: 'CAM-BRANCH-01', name: 'Main Entrance - Riyadh Branch', enabled: true, type: 'demo' },
            { id: 'CAM-BRANCH-02', name: 'Storefront - Riyadh Branch', enabled: true, type: 'demo' },
            { id: 'CAM-BRANCH-03', name: 'Parking Lot - Riyadh Branch', enabled: true, type: 'demo' },
            { id: 'CAM-SITE-01', name: 'Street View - Jeddah Site', enabled: true, type: 'demo' },
            { id: 'CAM-SITE-02', name: 'Interior Hall - Jeddah Site', enabled: true, type: 'demo' },
        ];
    }

    async grabFrame(cameraId) {
        const now = Date.now();
        const lastGrab = this.lastGrabTime.get(cameraId) || 0;
        if (now - lastGrab < 1000) {
            return null;
        }
        this.lastGrabTime.set(cameraId, now);

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

module.exports = {
    VmsAdapter,
    DemoVmsClient,
    createDefaultVmsProviderRegistry,
    createVmsProvider,
    normalizeProviderRegistry,
};
