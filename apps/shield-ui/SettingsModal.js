// ============================================
// SAQR — SettingsModal v2.0
// Profile / Vertical-Locked Integrations / Sovereignty
// ============================================
const SettingsModal = (() => {
    'use strict';

    let _overlay = null;
    let _activeTab = 'profile';
    let _deployMode = 'enterprise'; // 'enterprise' | 'smb'
    let _sovereignty = { mode: 'cloud' }; // 'cloud' | 'onprem'

    // --- Connector state: tracks active status per key ---
    const _connectorState = {};

    // =============================================
    // VERTICAL_CONNECTOR_MAP — Industry-Specific
    // =============================================
    const VERTICAL_CONNECTOR_MAP = {
        BFSI: [
            { key: 'sama-naqel', icon: '🏛️', label: 'SAMA Naqel API', desc: 'Regulatory Bridge — real-time violation feed from the Saudi Central Bank.' },
            { key: 'swift-20022', icon: '💸', label: 'Swift ISO 20022', desc: 'Payment Stream — cross-border CBPR+ message ingestion.' },
            { key: 'oracle-flex', icon: '🔴', label: 'Oracle FLEXCUBE', desc: 'Core Banking — GL & transaction ledger connector.' },
            { key: 'temenos-t24', icon: '🟣', label: 'Temenos T24', desc: 'Core Banking Engine — Transact module integration.' },
        ],
        Healthcare: [
            { key: 'moh-seha', icon: '🏥', label: 'MOH Seha Network', desc: 'National Health Information Exchange — patient registry sync.' },
            { key: 'hl7-fhir', icon: '🩺', label: 'HL7 / FHIR Gateway', desc: 'Patient Records — R4-compliant clinical data bridge.' },
            { key: 'sfda-track', icon: '💊', label: 'SFDA Track & Trace', desc: 'Pharmacy & Cold Chain — GS1 serialization compliance.' },
        ],
        Manufacturing: [
            { key: 'modon-iot', icon: '🏭', label: 'MODON IoT Edge', desc: 'Factory Sensors — OPC-UA & MQTT telemetry ingestion.' },
            { key: 'mim-portal', icon: '🔧', label: 'MIM Industrial Portal', desc: 'National Compliance — industrial license & audit sync.' },
            { key: 'erp-webhook', icon: '🔗', label: 'Universal ERP Webhook', desc: 'General Ingestion — REST/GraphQL adapter for any ERP.' },
        ],
        Hospitality: [
            { key: 'pms-bridge', icon: '🏨', label: 'PMS Bridge', desc: 'Property Management — Opera/Mews reservation sync.' },
            { key: 'pos-stream', icon: '🧾', label: 'POS Stream', desc: 'Point of Sale — Micros/Lightspeed transaction feed.' },
            { key: 'erp-webhook', icon: '🔗', label: 'Universal ERP Webhook', desc: 'General Ingestion — REST/GraphQL adapter for any ERP.' },
        ],
        Education: [
            { key: 'sis-bridge', icon: '🎓', label: 'SIS Bridge', desc: 'Student Information System — enrollment & transcript sync.' },
            { key: 'lms-stream', icon: '📚', label: 'LMS Data Stream', desc: 'Learning Management — Blackboard/Moodle integration.' },
            { key: 'erp-webhook', icon: '🔗', label: 'Universal ERP Webhook', desc: 'General Ingestion — REST/GraphQL adapter for any ERP.' },
        ],
        'F&B': [
            { key: 'pos-stream', icon: '🧾', label: 'POS Stream', desc: 'Point of Sale — Foodics/iiko transaction feed.' },
            { key: 'sfda-track', icon: '🍽️', label: 'SFDA Food Safety', desc: 'Track & Trace — food safety & HACCP compliance.' },
            { key: 'erp-webhook', icon: '🔗', label: 'Universal ERP Webhook', desc: 'General Ingestion — REST/GraphQL adapter for any ERP.' },
        ],
    };

    // Fallback connectors if industry not found
    const FALLBACK_CONNECTORS = [
        { key: 'erp-webhook', icon: '🔗', label: 'Universal ERP Webhook', desc: 'General Ingestion — REST/GraphQL adapter for any ERP.' },
        { key: 'sap-b1', icon: '🔷', label: 'SAP Business One', desc: 'ERP Connector for HANA — DI API bridge.' },
    ];

    // =============================================
    // Helpers
    // =============================================
    function _getActiveIndustry() {
        const session = (typeof SessionArchitect !== 'undefined') ? SessionArchitect.getSession() : null;
        return session?.industry?.key || sessionStorage.getItem('saqr_domain_locked') || null;
    }

    function _getConnectors() {
        const industry = _getActiveIndustry();
        return VERTICAL_CONNECTOR_MAP[industry] || FALLBACK_CONNECTORS;
    }

    function _isConnectorActive(key) {
        return !!_connectorState[key];
    }

    function _setConnectorActive(key, active) {
        _connectorState[key] = active;
    }

    // =============================================
    // Public API
    // =============================================
    function open() {
        if (_overlay) { _overlay.remove(); }
        _overlay = _buildModal();
        document.body.appendChild(_overlay);
        requestAnimationFrame(() => _overlay.classList.add('active'));
    }

    function close() {
        if (!_overlay) return;
        _overlay.classList.remove('active');
        setTimeout(() => { _overlay?.remove(); _overlay = null; }, 350);
    }

    // -----------------------------------------------
    // Build Modal DOM
    // -----------------------------------------------
    function _buildModal() {
        const el = document.createElement('div');
        el.className = 'settings-overlay';
        el.id = 'settingsOverlay';
        el.innerHTML = `
        <div class="settings-modal">
            <div class="settings-header">
                <div class="settings-header-left">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
                    </svg>
                    <span class="settings-title">SYSTEM SETTINGS</span>
                </div>
                <button class="settings-close" id="settingsCloseBtn" aria-label="Close">&times;</button>
            </div>
            <div class="settings-tabs">
                <button class="settings-tab active" data-tab="profile">👤 Profile</button>
                <button class="settings-tab" data-tab="integrations">🔌 Integrations</button>
                <button class="settings-tab" data-tab="sovereignty">🛡️ Sovereignty</button>
            </div>
            <div class="settings-body" id="settingsBody"></div>
        </div>`;

        // Wire events
        el.querySelector('#settingsCloseBtn').addEventListener('click', close);
        el.addEventListener('click', (e) => { if (e.target === el) close(); });
        el.querySelectorAll('.settings-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                _activeTab = tab.dataset.tab;
                el.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                _renderTab(el.querySelector('#settingsBody'));
            });
        });
        _renderTab(el.querySelector('#settingsBody'));
        return el;
    }

    // -----------------------------------------------
    // Tab Renderers
    // -----------------------------------------------
    function _renderTab(body) {
        if (_activeTab === 'profile') _renderProfile(body);
        else if (_activeTab === 'integrations') _renderIntegrations(body);
        else if (_activeTab === 'sovereignty') _renderSovereignty(body);
    }

    function _renderProfile(body) {
        const identity = (typeof SessionArchitect !== 'undefined') ? SessionArchitect.getIdentity() : null;
        const session = (typeof SessionArchitect !== 'undefined') ? SessionArchitect.getSession() : null;
        const name = identity?.name || 'Unknown';
        const email = identity?.email || '—';
        const role = identity?.role || '—';
        const orgId = identity?.orgId || '—';
        const market = session?.market?.isoCode || '—';
        const industry = session?.industry?.key || '—';
        const siloId = session?.siloId || '—';
        const cloud = session?.sovereignty?.cloud || '—';

        body.innerHTML = `
        <div class="profile-card">
            <div class="profile-avatar">${name.charAt(0).toUpperCase()}</div>
            <div class="profile-info">
                <div class="profile-name">${name}</div>
                <div class="profile-role">${role}</div>
                <div class="profile-email">${email}</div>
            </div>
        </div>
        <div class="profile-details">
            <div class="detail-row"><span class="detail-label">Organization</span><span class="detail-value">${orgId}</span></div>
            <div class="detail-row"><span class="detail-label">Market</span><span class="detail-value">${market}</span></div>
            <div class="detail-row"><span class="detail-label">Vertical</span><span class="detail-value">${industry}</span></div>
            <div class="detail-row"><span class="detail-label">Silo ID</span><span class="detail-value silo-mono">${siloId}</span></div>
            <div class="detail-row"><span class="detail-label">Cloud</span><span class="detail-value">${cloud}</span></div>
        </div>
        <button class="switch-context-btn" id="switchContextBtn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            SWITCH CONTEXT
        </button>`;

        body.querySelector('#switchContextBtn').addEventListener('click', () => {
            if (typeof SessionArchitect !== 'undefined') SessionArchitect.destroySession();
            sessionStorage.clear();
            window.location.href = 'GatewaySelector.html';
        });
    }

    // -----------------------------------------------
    // Integrations Tab — Vertical-Locked
    // -----------------------------------------------
    function _renderIntegrations(body) {
        const industry = _getActiveIndustry() || 'GENERAL';
        const connectors = _getConnectors();

        // Deployment Mode Toggle
        const modeToggle = `
        <div class="deploy-mode-bar">
            <div class="deploy-mode-label">🔧 DEPLOYMENT MODE</div>
            <div class="deploy-mode-options">
                <button class="deploy-mode-btn ${_deployMode === 'enterprise' ? 'deploy-active' : ''}" data-mode="enterprise">
                    <span class="dm-icon">🏢</span> Sovereign Agent
                </button>
                <button class="deploy-mode-btn ${_deployMode === 'smb' ? 'deploy-active' : ''}" data-mode="smb">
                    <span class="dm-icon">☁️</span> Cloud API Bridge
                </button>
            </div>
            <div class="deploy-mode-desc">${_deployMode === 'enterprise'
                ? '⛓️ On-Premise agent for large enterprises. Full data sovereignty, air-gapped deployment.'
                : '🚀 Cloud-to-cloud rapid sync. Ideal for SMBs — zero-infra, instant activation.'}</div>
        </div>`;

        // Vertical badge
        const vertBadge = `
        <div class="vert-connector-badge">
            <span class="vcb-icon">🔒</span>
            <span class="vcb-text">${industry} CONNECTOR HUB</span>
            <span class="vcb-count">${connectors.length} AVAILABLE</span>
        </div>`;

        // Connector cards
        const cards = connectors.map(c => {
            const active = _isConnectorActive(c.key);
            return `
            <div class="integration-card ${active ? 'integration-active' : ''}" data-key="${c.key}">
                <div class="integration-header">
                    <span class="integration-icon">${c.icon}</span>
                    <span class="integration-label">${c.label}</span>
                </div>
                <div class="integration-desc">${c.desc}</div>
                <div class="integration-footer">
                    <span class="integration-status">${active ? '● LIVE' : '○ OFFLINE'}</span>
                    <label class="integration-toggle">
                        <input type="checkbox" ${active ? 'checked' : ''} data-key="${c.key}">
                        <span class="toggle-slider"></span>
                    </label>
                </div>
                ${active ? '<div class="handshake-pulse"></div>' : ''}
            </div>`;
        }).join('');

        body.innerHTML = `${modeToggle}${vertBadge}<div class="integrations-grid">${cards}</div>`;

        // Wire deployment mode toggle
        body.querySelectorAll('.deploy-mode-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                _deployMode = btn.dataset.mode;
                _renderIntegrations(body);
            });
        });

        // Wire connector toggles with handshake animation
        body.querySelectorAll('.integration-toggle input').forEach(input => {
            input.addEventListener('change', (e) => {
                const key = e.target.dataset.key;
                if (e.target.checked) {
                    _triggerHandshake(key, body);
                } else {
                    _setConnectorActive(key, false);
                    _renderIntegrations(body);
                }
            });
        });
    }

    // -----------------------------------------------
    // CDC Handshake Animation
    // -----------------------------------------------
    function _triggerHandshake(key, body) {
        const connector = _getConnectors().find(c => c.key === key);
        if (!connector) return;

        // Find the card and inject handshake overlay
        const card = body.querySelector(`.integration-card[data-key="${key}"]`);
        if (!card) return;

        card.classList.add('integration-handshaking');
        const hsOverlay = document.createElement('div');
        hsOverlay.className = 'int-handshake-overlay';
        hsOverlay.innerHTML = `
            <div class="int-hs-spinner"></div>
            <div class="int-hs-status" id="hsStatus_${key}">Establishing Secure Bridge...</div>
            <div class="int-hs-progress">
                <div class="int-hs-bar" id="hsBar_${key}"></div>
            </div>`;
        card.appendChild(hsOverlay);

        // Animate: 3 stages over 2.4 seconds
        const stages = [
            { delay: 0, text: 'Establishing Secure Bridge...', pct: 20 },
            { delay: 800, text: 'Validating Schema...', pct: 60 },
            { delay: 1600, text: 'Schema Synced ✓', pct: 100 },
        ];
        stages.forEach(s => {
            setTimeout(() => {
                const status = card.querySelector(`#hsStatus_${key}`);
                const bar = card.querySelector(`#hsBar_${key}`);
                if (status) status.textContent = s.text;
                if (bar) bar.style.width = s.pct + '%';
            }, s.delay);
        });

        // Complete
        setTimeout(() => {
            _setConnectorActive(key, true);
            card.classList.remove('integration-handshaking');
            hsOverlay.remove();
            _renderIntegrations(body);
            // Dispatch event for audit stream
            document.dispatchEvent(new CustomEvent('saqr:integration-live', {
                detail: { integration: connector.label, key, mode: _deployMode }
            }));
        }, 2400);
    }

    // -----------------------------------------------
    // Sovereignty Tab
    // -----------------------------------------------
    function _renderSovereignty(body) {
        body.innerHTML = `
        <div class="sovereignty-section">
            <div class="sovereignty-header">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
                <span>DATA RESIDENCY MODE</span>
            </div>
            <div class="sovereignty-options">
                <button class="sovereignty-option ${_sovereignty.mode === 'cloud' ? 'sov-active' : ''}" data-mode="cloud">
                    <span class="sov-icon">☁️</span>
                    <span class="sov-label">KSA STC Cloud</span>
                    <span class="sov-desc">Sovereign cloud hosted within Kingdom borders. TLS 1.3 + AES-256-GCM.</span>
                </button>
                <button class="sovereignty-option ${_sovereignty.mode === 'onprem' ? 'sov-active' : ''}" data-mode="onprem">
                    <span class="sov-icon">🏢</span>
                    <span class="sov-label">On-Premise</span>
                    <span class="sov-desc">Self-hosted within corporate data center. Full air-gap isolation.</span>
                </button>
            </div>
            <div class="sovereignty-status">
                <div class="detail-row"><span class="detail-label">Encryption</span><span class="detail-value">TLS 1.3 + AES-256-GCM</span></div>
                <div class="detail-row"><span class="detail-label">Residency</span><span class="detail-value">${_sovereignty.mode === 'cloud' ? 'Kingdom of Saudi Arabia' : 'Corporate Premises'}</span></div>
                <div class="detail-row"><span class="detail-label">Compliance</span><span class="detail-value">PDPL / NCA ECC</span></div>
            </div>
        </div>`;

        body.querySelectorAll('.sovereignty-option').forEach(opt => {
            opt.addEventListener('click', () => {
                _sovereignty.mode = opt.dataset.mode;
                _renderSovereignty(body);
            });
        });
    }

    return { open, close };
})();
