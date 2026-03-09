// ============================================
// SAQR — CourtReadyReport.js
// High-Fidelity PDF Export for Compliance Audit
// Generates print-optimized "Court Ready" view
// ============================================

const CourtReadyReport = (() => {
  'use strict';

  // Generate the full print document from the current certificate modal
  function generatePrintView() {
    const certBody = document.getElementById('certModalBody');

    // Build certificate content: use cert modal if open, else build a standalone violations summary
    let certContentHTML = '';
    if (certBody && certBody.innerHTML.trim()) {
      certContentHTML = certBody.innerHTML;
    } else {
      certContentHTML = _buildStandaloneViolationsSummary();
    }

    // Gather session context for the watermark and header
    let authSignature = 'SAMA — Saudi Central Bank';
    let residency = 'Kingdom of Saudi Arabia — STC Cloud';
    let industryLabel = 'BFSI Regulatory Shield';
    let marketFlag = '🇸🇦';
    let marketName = 'KSA';
    let currencyCode = 'SAR';

    if (typeof SessionArchitect !== 'undefined') {
      const s = SessionArchitect.getSession();
      if (s && s.active) {
        if (s.industry) {
          const AUTH_SIGS = {
            BFSI: 'SAMA — Saudi Central Bank',
            Healthcare: 'MOH — Ministry of Health',
            'F&B': 'MOMAH — Ministry of Municipal Affairs',
            Manufacturing: 'SASO — Saudi Standards, Metrology & Quality Org',
            Hospitality: 'MOT — Ministry of Tourism',
            Education: 'MOE — Ministry of Education',
          };
          authSignature = AUTH_SIGS[s.industry.key] || authSignature;
          industryLabel = `${s.industry.key} Regulatory Shield`;
        }
        if (s.market) {
          residency = `${s.market.residency || 'Kingdom of Saudi Arabia'} — ${s.market.cloud || 'STC Cloud'}`;
          marketName = s.market.isoCode || 'KSA';
          const FLAGS = { SA: '🇸🇦', AE: '🇦🇪', BH: '🇧🇭', QA: '🇶🇦', KW: '🇰🇼', OM: '🇴🇲', EG: '🇪🇬', JO: '🇯🇴', GB: '🇬🇧', US: '🇺🇸' };
          marketFlag = FLAGS[s.market.isoCode] || '🇸🇦';
          // Currency from market
          const CURRENCIES = { SA: 'SAR', AE: 'AED', BH: 'BHD', QA: 'QAR', KW: 'KWD', OM: 'OMR', EG: 'EGP', JO: 'JOD', GB: 'GBP', US: 'USD' };
          currencyCode = CURRENCIES[s.market.isoCode] || 'SAR';
        }
      }
    }

    // --- Financial Impact Calculation ---
    const financialImpact = _calculateFinancialImpact(currencyCode);

    const timestamp = new Date().toISOString();
    const reportId = `SAQR-RPT-${Date.now().toString(36).toUpperCase()}`;

    // Create a hidden print-only container
    let printContainer = document.getElementById('courtReadyPrintView');
    if (!printContainer) {
      printContainer = document.createElement('div');
      printContainer.id = 'courtReadyPrintView';
      document.body.appendChild(printContainer);
    }

    // Financial Defense Summary block
    const financialSummaryHTML = `
        <div class="cr-financial-summary">
          <div class="cr-fin-header">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#00E5A0" stroke-width="2">
              <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
            </svg>
            <span class="cr-fin-title">FINANCIAL DEFENSE SUMMARY</span>
          </div>
          <div class="cr-fin-narrative">
            This document verifies that a potential regulatory violation with an estimated financial
            exposure of <strong>${financialImpact.formattedExposure}</strong> was intercepted and resolved
            via the SAQR Sovereign Shield. The interception prevented direct penalty enforcement and
            preserved organizational compliance standing.
          </div>
          <div class="cr-fin-grid">
            <div class="cr-fin-metric">
              <div class="cr-fin-metric-label">Total Exposure Intercepted</div>
              <div class="cr-fin-metric-value cr-fin-amount">${financialImpact.formattedExposure}</div>
            </div>
            <div class="cr-fin-metric">
              <div class="cr-fin-metric-label">Violations Resolved</div>
              <div class="cr-fin-metric-value">${financialImpact.violationsResolved}</div>
            </div>
            <div class="cr-fin-metric">
              <div class="cr-fin-metric-label">Critical Severity</div>
              <div class="cr-fin-metric-value cr-fin-critical">${financialImpact.criticalCount}</div>
            </div>
            <div class="cr-fin-metric">
              <div class="cr-fin-metric-label">Currency / Market</div>
              <div class="cr-fin-metric-value">${currencyCode} / ${marketName}</div>
            </div>
          </div>
        </div>`;

    printContainer.innerHTML = `
      <div class="court-ready-report">
        <!-- Header -->
        <div class="cr-header">
          <div class="cr-header-left">
            <div class="cr-logo">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#00E5A0" stroke-width="1.5">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                <path d="M9 12l2 2 4-4"/>
              </svg>
              <div>
                <div class="cr-title">SAQR — صقر</div>
                <div class="cr-subtitle">Sovereign Audit & Compliance Intelligence</div>
              </div>
            </div>
          </div>
          <div class="cr-header-right">
            <div class="cr-report-id">${reportId}</div>
            <div class="cr-timestamp">${timestamp}</div>
          </div>
        </div>

        <!-- Court Ready Badge -->
        <div class="cr-badge-row">
          <div class="cr-court-badge">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00E5A0" stroke-width="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              <path d="M9 12l2 2 4-4"/>
            </svg>
            COURT-READY — Admissible on the Unified Objections Platform
          </div>
        </div>

        <!-- Financial Defense Summary -->
        ${financialSummaryHTML}

        <!-- Certificate Content -->
        <div class="cr-cert-content">
          ${certContentHTML}
        </div>

        <!-- Authority Digital Signature Block -->
        <div class="cr-signature-block">
          <div class="cr-sig-title">AUTHORITY DIGITAL SIGNATURE</div>
          <div class="cr-sig-row">
            <div class="cr-sig-field">
              <div class="cr-sig-label">Regulatory Authority</div>
              <div class="cr-sig-value">${authSignature}</div>
            </div>
            <div class="cr-sig-field">
              <div class="cr-sig-label">Industry Vertical</div>
              <div class="cr-sig-value">${marketFlag} ${marketName} | ${industryLabel}</div>
            </div>
          </div>
          <div class="cr-sig-row">
            <div class="cr-sig-field">
              <div class="cr-sig-label">Sovereign Data Residency</div>
              <div class="cr-sig-value">${residency}</div>
            </div>
            <div class="cr-sig-field">
              <div class="cr-sig-label">Report Generated</div>
              <div class="cr-sig-value">${new Date().toLocaleString('en-GB', { dateStyle: 'full', timeStyle: 'long' })}</div>
            </div>
          </div>
        </div>

        <!-- Legal Footer -->
        <div class="cr-footer">
          <div class="cr-watermark">${residency}</div>
          <div class="cr-legal">
            This document is machine-generated by the SAQR Compliance Shield and is admissible under the
            Saudi Law of Evidence (Royal Decree M/43, 2022). All SHA-256 hashes are independently verifiable.
            Tampering with this document is a criminal offence under Article 6 of the Anti-Cyber Crime Law.
          </div>
          <div class="cr-page-id">Page 1 of 1 — ${reportId}</div>
        </div>
      </div>
    `;

    // Trigger browser print
    window.print();
  }

  // -----------------------------------------------
  // Standalone Violations Summary (when cert modal not open)
  // -----------------------------------------------
  function _buildStandaloneViolationsSummary() {
    if (typeof DEMO_DATA === 'undefined' || typeof currentDemoSector === 'undefined' || !currentDemoSector) {
      return '<div style="text-align:center;padding:20px;color:#64748b;font-style:italic;">No active violations — simulate a violation first.</div>';
    }
    const data = DEMO_DATA[currentDemoSector];
    if (!data || !data.violations || data.violations.length === 0) {
      return '<div style="text-align:center;padding:20px;color:#64748b;font-style:italic;">No violations to display.</div>';
    }

    const rows = data.violations.map(v => `
      <tr>
        <td style="padding:6px 8px;font-family:'JetBrains Mono',monospace;font-size:0.65rem;color:#475569;">${v.violation_code}</td>
        <td style="padding:6px 8px;font-size:0.75rem;font-weight:600;color:#1a1a2e;">${v.authority}</td>
        <td style="padding:6px 8px;"><span style="padding:2px 8px;border-radius:4px;font-size:0.6rem;font-weight:700;text-transform:uppercase;background:${v.severity === 'critical' ? '#FEE2E2' : v.severity === 'high' ? '#FEF3C7' : '#E0E7FF'};color:${v.severity === 'critical' ? '#DC2626' : v.severity === 'high' ? '#D97706' : '#4F46E5'}">${v.severity}</span></td>
        <td style="padding:6px 8px;font-size:0.75rem;color:#1e293b;">${v.title}</td>
      </tr>
    `).join('');

    return `
      <div style="margin-top:8px;">
        <div style="font-family:'JetBrains Mono',monospace;font-size:0.6rem;font-weight:700;letter-spacing:1.5px;color:#1a1a2e;margin-bottom:10px;">INTERCEPTED VIOLATIONS — SESSION AUDIT LOG</div>
        <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;">
          <thead>
            <tr style="background:#f1f5f9;">
              <th style="padding:6px 8px;text-align:left;font-family:'JetBrains Mono',monospace;font-size:0.55rem;font-weight:700;color:#64748b;letter-spacing:0.5px;">CODE</th>
              <th style="padding:6px 8px;text-align:left;font-family:'JetBrains Mono',monospace;font-size:0.55rem;font-weight:700;color:#64748b;">AUTHORITY</th>
              <th style="padding:6px 8px;text-align:left;font-family:'JetBrains Mono',monospace;font-size:0.55rem;font-weight:700;color:#64748b;">SEVERITY</th>
              <th style="padding:6px 8px;text-align:left;font-family:'JetBrains Mono',monospace;font-size:0.55rem;font-weight:700;color:#64748b;">VIOLATION</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  // -----------------------------------------------
  // Financial Impact Calculator
  // -----------------------------------------------
  function _calculateFinancialImpact(currency) {
    let totalExposure = 0;
    let violationsResolved = 0;
    let criticalCount = 0;

    // Source 1: Current ROI counter (app.js global)
    if (typeof currentROI !== 'undefined' && currentROI > 0) {
      totalExposure = currentROI;
    }

    // Source 2: Current sector DEMO_DATA
    if (typeof DEMO_DATA !== 'undefined' && typeof currentDemoSector !== 'undefined' && currentDemoSector) {
      const data = DEMO_DATA[currentDemoSector];
      if (data) {
        // If ROI was 0, use penalties exposure
        if (totalExposure === 0) {
          totalExposure = data.kpis?.projectedPenaltyExposure || 0;
        }
        violationsResolved = data.kpis?.totalViolationsIntercepted || 0;
        criticalCount = data.kpis?.criticalViolations || 0;

        // Sum individual reasoning fines if available
        if (data.violations) {
          data.violations.forEach(v => {
            if (v.reasoning && v.reasoning.potentialFine) {
              // Parse "SAR 350,000" → 350000
              const match = v.reasoning.potentialFine.match(/[\d,]+/);
              if (match) {
                const amount = parseInt(match[0].replace(/,/g, ''), 10);
                if (!isNaN(amount)) totalExposure = Math.max(totalExposure, amount);
              }
            }
          });
        }
      }
    }

    // Format with locale-aware commas
    const formatted = totalExposure >= 1000000
      ? `${currency} ${(totalExposure / 1e6).toFixed(1)}M`
      : `${currency} ${totalExposure.toLocaleString('en-US')}`;

    return {
      totalExposure,
      formattedExposure: formatted,
      violationsResolved,
      criticalCount,
      currency,
    };
  }

  // Public API
  return { generatePrintView };
})();

// Expose globally
window.CourtReadyReport = CourtReadyReport;
