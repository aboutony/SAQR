// ============================================
// SAQR — SettingsModal
// Profile / Integrations / Sovereignty
// ============================================
const SettingsModal = (() => {
    'use strict';

    let _overlay = null;
    let _activeTab = 'profile';
    let _integrations = {
        'sap-b1': { label: 'SAP Business One', icon: '🔷', desc: 'ERP Connector for HANA', active: false },
        'oracle': { label: 'Oracle EBS', icon: '🔴', desc: 'Cloud ERP Integration', active: false },
        'temenos': { label: 'Temenos T24', icon: '🟣', desc: 'Core Banking Engine', active: false },
        'sama-naqel': { label: 'SAMA Naqel API', icon: '🏛️', desc: 'Regulatory Data Feed', active: false },
    };
    let _sovereignty = { mode: 'cloud' }; // 'cloud' | 'onprem'

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

    function _renderIntegrations(body) {
        const cards = Object.entries(_integrations).map(([key, int]) => `
        <div class="integration-card ${int.active ? 'integration-active' : ''}" data-key="${key}">
            <div class="integration-header">
                <span class="integration-icon">${int.icon}</span>
                <span class="integration-label">${int.label}</span>
            </div>
            <div class="integration-desc">${int.desc}</div>
            <div class="integration-footer">
                <span class="integration-status">${int.active ? '● LIVE' : '○ OFFLINE'}</span>
                <label class="integration-toggle">
                    <input type="checkbox" ${int.active ? 'checked' : ''} data-key="${key}">
                    <span class="toggle-slider"></span>
                </label>
            </div>
            ${int.active ? '<div class="handshake-pulse"></div>' : ''}
        </div>`).join('');

        body.innerHTML = `<div class="integrations-grid">${cards}</div>`;

        body.querySelectorAll('.integration-toggle input').forEach(input => {
            input.addEventListener('change', (e) => {
                const key = e.target.dataset.key;
                _integrations[key].active = e.target.checked;
                _renderIntegrations(body);
                // Dispatch event for audit stream
                if (e.target.checked) {
                    document.dispatchEvent(new CustomEvent('saqr:integration-live', {
                        detail: { integration: _integrations[key].label, key }
                    }));
                }
            });
        });
    }

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
