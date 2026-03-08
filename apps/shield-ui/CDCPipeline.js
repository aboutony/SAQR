// ============================================
// SAQR — CDCPipeline
// Industry-Aware Change Data Capture Engine
// Synchronizes data source labels per vertical
// ============================================

const CDCPipeline = (() => {
    'use strict';

    // -----------------------------------------------
    // Industry-Specific Data Sources
    // -----------------------------------------------
    const DATA_SOURCES = {
        BFSI: {
            primary: [
                { id: 'cbl', name: 'Core Banking Ledger', icon: '🏦', format: 'ISO 20022', frequency: 'Real-Time' },
                { id: 'swift', name: 'SWIFT Transaction Streams', icon: '💸', format: 'MT/MX', frequency: 'Real-Time' },
                { id: 'atm', name: 'ATM Telemetry Feed', icon: '🏧', format: 'ISO 8583', frequency: '5s Interval' },
                { id: 'kyc', name: 'KYC/AML Watchlist', icon: '🔍', format: 'Structured', frequency: 'Daily Sync' },
            ],
            secondary: [
                { id: 'cr', name: 'Credit Risk Scores', icon: '📊', format: 'FICO/Simah', frequency: 'Hourly' },
                { id: 'fee', name: 'Fee Schedule Registry', icon: '💰', format: 'JSON', frequency: 'On Change' },
            ],
        },
        Healthcare: {
            primary: [
                { id: 'emr', name: 'Electronic Medical Records', icon: '🏥', format: 'HL7 FHIR', frequency: 'Real-Time' },
                { id: 'pharm', name: 'Pharmacy Dispensing Log', icon: '💊', format: 'GS1-128', frequency: 'Per Transaction' },
                { id: 'cold', name: 'Cold Chain Sensor Data', icon: '🌡️', format: 'IoT MQTT', frequency: '30s Interval' },
                { id: 'lab', name: 'Lab Results Pipeline', icon: '🔬', format: 'HL7 v2.x', frequency: 'Real-Time' },
            ],
            secondary: [
                { id: 'ins', name: 'Insurance Claims Stream', icon: '📋', format: 'NPHIES', frequency: 'Batch (4h)' },
                { id: 'lic', name: 'Practitioner License DB', icon: '🪪', format: 'Structured', frequency: 'Daily Sync' },
            ],
        },
        'F&B': {
            primary: [
                { id: 'pos', name: 'POS Transaction Log', icon: '🧾', format: 'ZATCA e-Invoice', frequency: 'Real-Time' },
                { id: 'inv', name: 'Inventory & Shelf Life', icon: '📦', format: 'GS1 DataBar', frequency: 'Hourly' },
                { id: 'temp', name: 'Food Temperature Monitors', icon: '🌡️', format: 'IoT MQTT', frequency: '60s Interval' },
            ],
            secondary: [
                { id: 'lic', name: 'Commercial License Registry', icon: '📄', format: 'Structured', frequency: 'Monthly' },
                { id: 'insp', name: 'Inspection Reports', icon: '📝', format: 'PDF/XML', frequency: 'On Event' },
            ],
        },
        Hospitality: {
            primary: [
                { id: 'pms', name: 'Property Management System', icon: '🏨', format: 'HTNG/OTA', frequency: 'Real-Time' },
                { id: 'guest', name: 'Guest Registration Stream', icon: '👤', format: 'SADAD/NIC', frequency: 'Per Check-In' },
                { id: 'safety', name: 'Fire & Safety Sensors', icon: '🔥', format: 'IoT MQTT', frequency: '10s Interval' },
            ],
            secondary: [
                { id: 'tour', name: 'Tourism License DB', icon: '🗂️', format: 'Structured', frequency: 'Daily Sync' },
                { id: 'rev', name: 'Revenue & Tax Ledger', icon: '💰', format: 'ZATCA e-Invoice', frequency: 'Real-Time' },
            ],
        },
        Education: {
            primary: [
                { id: 'sis', name: 'Student Information System', icon: '🎓', format: 'SIS/LMS API', frequency: 'Real-Time' },
                { id: 'acrd', name: 'Accreditation Records', icon: '📜', format: 'Structured', frequency: 'Quarterly' },
                { id: 'staff', name: 'Staff Credentials DB', icon: '👨‍🏫', format: 'HRMS', frequency: 'Daily Sync' },
            ],
            secondary: [
                { id: 'exam', name: 'Exam & Assessment Data', icon: '📝', format: 'ETEC Format', frequency: 'Per Session' },
                { id: 'fin', name: 'Tuition & Aid Ledger', icon: '💰', format: 'Structured', frequency: 'Monthly' },
            ],
        },
        Manufacturing: {
            primary: [
                { id: 'plc', name: 'Production Floor Logs', icon: '🏭', format: 'OPC-UA/MQTT', frequency: 'Real-Time' },
                { id: 'sens', name: 'Safety Sensor Metadata', icon: '⚙️', format: 'IoT MQTT', frequency: '5s Interval' },
                { id: 'qc', name: 'Quality Control Pipeline', icon: '✅', format: 'ISO 9001 XML', frequency: 'Per Batch' },
                { id: 'scm', name: 'Supply Chain Manifests', icon: '🚛', format: 'GS1 EPCIS', frequency: 'Real-Time' },
            ],
            secondary: [
                { id: 'env', name: 'Emissions & Waste Log', icon: '🌿', format: 'EPA/SASO', frequency: 'Hourly' },
                { id: 'maint', name: 'Maintenance Schedule', icon: '🔧', format: 'CMMS', frequency: 'On Event' },
            ],
        },
    };

    // -----------------------------------------------
    // Pipeline States
    // -----------------------------------------------
    const PIPELINE_STATES = {
        IDLE: { label: 'Idle', color: '#6B7280', icon: '⏸️' },
        INGESTING: { label: 'Ingesting', color: '#3B82F6', icon: '⬇️' },
        PROCESSING: { label: 'Processing', color: '#F59E0B', icon: '⚙️' },
        COMPARING: { label: 'Comparing', color: '#8B5CF6', icon: '🔄' },
        SYNCED: { label: 'Synced', color: '#00E5A0', icon: '✅' },
        ERROR: { label: 'Error', color: '#EF4444', icon: '❌' },
    };

    let _currentIndustry = 'BFSI';
    let _pipelineState = 'IDLE';
    let _lastSync = null;
    let _listeners = [];

    // -----------------------------------------------
    // Core Functions
    // -----------------------------------------------
    function setIndustry(industryKey) {
        _currentIndustry = industryKey;
        console.log(`[CDCPipeline] Industry set: ${industryKey}`);
    }

    function getSources(industryKey) {
        const key = industryKey || _currentIndustry;
        return DATA_SOURCES[key] || DATA_SOURCES.BFSI;
    }

    function getAllSourceLabels(industryKey) {
        const sources = getSources(industryKey);
        return [...sources.primary, ...(sources.secondary || [])];
    }

    function getPipelineState() {
        return { state: _pipelineState, ...PIPELINE_STATES[_pipelineState] };
    }

    // Simulate a CDC sync cycle
    function simulateSync(industryKey) {
        const key = industryKey || _currentIndustry;
        const sources = getSources(key);

        _pipelineState = 'INGESTING';
        _emit('state:changed', getPipelineState());

        setTimeout(() => {
            _pipelineState = 'PROCESSING';
            _emit('state:changed', getPipelineState());
        }, 800);

        setTimeout(() => {
            _pipelineState = 'COMPARING';
            _emit('state:changed', getPipelineState());
        }, 1600);

        setTimeout(() => {
            _pipelineState = 'SYNCED';
            _lastSync = new Date().toISOString();
            _emit('state:changed', getPipelineState());
            _emit('sync:complete', {
                industry: key,
                sources: sources.primary.length + (sources.secondary || []).length,
                timestamp: _lastSync,
            });
            console.log(`[CDCPipeline] Sync complete: ${key} — ${sources.primary.length} primary sources ingested`);
        }, 2400);

        return sources;
    }

    // -----------------------------------------------
    // Event System
    // -----------------------------------------------
    function on(event, fn) { _listeners.push({ event, fn }); }
    function _emit(event, data) {
        _listeners.filter(l => l.event === event).forEach(l => l.fn(data));
    }

    // -----------------------------------------------
    // Public API
    // -----------------------------------------------
    return {
        setIndustry,
        getSources,
        getAllSourceLabels,
        getPipelineState,
        simulateSync,
        on,
        DATA_SOURCES,
        PIPELINE_STATES,
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = CDCPipeline;
}
