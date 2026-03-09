// ============================================
// SAQR — VerticalPruner v1.0
// Hard Purge: Strips non-relevant industry DOM
// elements and labels from the dashboard
// ============================================
const VerticalPruner = (() => {
    'use strict';

    // Vertical-specific labels that should ONLY appear in their industry
    const VERTICAL_LABELS = {
        BFSI: ['SWIFT', 'ISO 20022', 'AML', 'Core Ledger', 'SAMA', 'CMA', 'FLEXCUBE', 'Temenos'],
        Healthcare: ['HL7', 'FHIR', 'EMR', 'Cold-Chain', 'MOH', 'SFDA', 'CHI', 'Seha'],
        Manufacturing: ['PLC', 'SCADA', 'OPC-UA', 'MQTT', 'MODON', 'MIM', 'SASO', 'Quality Sensors'],
        'F&B': ['HACCP', 'Temp Sensors', 'POS Logs', 'Hygiene', 'Balady', 'Foodics', 'Cold Chain'],
        Hospitality: ['PMS', 'Opera', 'Guest Privacy', 'Tourism', 'Civil Defense', 'Occupancy'],
        Education: ['SIS', 'LMS', 'Student Vault', 'Academic Meta', 'MOE', 'ETEC', 'PDPL'],
    };

    /**
     * init() — Call on dashboard load to enforce industry silo.
     * Removes:
     *   1. Any element with [data-industry] not matching the locked vertical
     *   2. Any pipeline/packet label text belonging to other verticals
     *   3. Any <style>/<link> with [data-industry] not matching
     */
    function init() {
        const locked = _getLockedIndustry();
        if (!locked) {
            console.log('[VerticalPruner] No industry lock detected — skipping purge');
            return;
        }

        console.log(`[VerticalPruner] Enforcing silo: ${locked}`);
        let pruned = 0;

        // 1. Remove data-industry elements
        document.querySelectorAll('[data-industry]').forEach(el => {
            if (el.dataset.industry.toUpperCase() !== locked.toUpperCase()) {
                el.remove();
                pruned++;
            }
        });

        // 2. Remove style/link tags for other industries
        document.querySelectorAll('style[data-industry], link[data-industry]').forEach(el => {
            if (el.dataset.industry.toUpperCase() !== locked.toUpperCase()) {
                el.remove();
                pruned++;
            }
        });

        // 3. Prune packet-animation labels from other verticals
        const otherLabels = _getOtherVerticalLabels(locked);
        document.querySelectorAll('.packet-label, .pipeline-label, .cdc-source-label').forEach(el => {
            const text = el.textContent.trim();
            if (otherLabels.some(label => text.includes(label))) {
                el.remove();
                pruned++;
            }
        });

        console.log(`[VerticalPruner] Purged ${pruned} non-relevant elements`);
        return pruned;
    }

    /**
     * Get the locked industry from session
     */
    function _getLockedIndustry() {
        // Check sessionStorage flag first
        const locked = sessionStorage.getItem('saqr_domain_locked');
        if (locked) return locked;

        // Fall back to SessionArchitect
        if (typeof SessionArchitect !== 'undefined') {
            const session = SessionArchitect.getSession();
            if (session?.industry?.key) return session.industry.key;
        }
        return null;
    }

    /**
     * Get labels from all OTHER verticals (not the locked one)
     */
    function _getOtherVerticalLabels(lockedIndustry) {
        const labels = [];
        for (const [industry, terms] of Object.entries(VERTICAL_LABELS)) {
            if (industry.toUpperCase() !== lockedIndustry.toUpperCase()) {
                labels.push(...terms);
            }
        }
        return labels;
    }

    /**
     * getActiveLabels() — Returns the label set for the current vertical
     */
    function getActiveLabels() {
        const locked = _getLockedIndustry();
        if (!locked) return [];
        return VERTICAL_LABELS[locked] || [];
    }

    return { init, getActiveLabels, VERTICAL_LABELS };
})();
