// ============================================
// SAQR Shield UI — Enterprise Dashboard Logic
// Three.js 3D Shield + Demo Mode + BiDi + All Engines
// ============================================

// -----------------------------------------------
// Gateway Session Enforcement
// Redirect to GatewaySelector if no active session
// -----------------------------------------------
(function enforceGateway() {
  if (typeof SessionArchitect !== 'undefined') {
    const session = SessionArchitect.getSession();
    if (!session || !session.active) {
      window.location.href = 'GatewaySelector.html';
      return;
    }
  }
})();

const API_BASE = 'http://localhost:3001';

// -----------------------------------------------
// Internationalisation (i18n)
// -----------------------------------------------
const i18n = {
  en: {
    'nav.live': 'LIVE MONITORING',
    'hero.status': 'SHIELD ACTIVE',
    'hero.roi.title': 'Penalties Intercepted',
    'hero.roi.subtitle': 'Total savings from proactive compliance',
    'hero.roi.target': 'Target: SAR 2M',
    'kpi.intercepted': 'Violations Intercepted',
    'kpi.critical': 'Critical Severity',
    'kpi.exposure': 'Penalty Exposure',
    'kpi.drift': 'Instruction Drift Alerts',
    'panel.violations': 'Violation Evidence Log',
    'panel.drift': 'Instruction Drift',
    'panel.integrity': 'Evidence Integrity',
    'panel.breakdown': 'Authority Breakdown',
    'panel.pipeline': 'CDC Pipeline',
    'table.timestamp': 'Timestamp',
    'table.code': 'Code',
    'table.authority': 'Authority',
    'table.severity': 'Severity',
    'table.title': 'Title',
    'table.awaiting': 'Awaiting CDC events...',
    'drift.empty': 'No drift alerts — regulations stable',
    'integrity.residency': 'Residency',
    'panel.gallery': 'Visual Evidence Gallery',
    'gallery.empty': 'No visual detections yet — cameras scanning',
    'demo.banking': 'Banking (SAMA)',
    'demo.healthcare': 'Healthcare (MOH/SFDA)',
    'demo.fnb': 'F&B / Retail (MOMAH)',
    'demo.select': 'Select Sector',
    'heartbeat.status': 'SYSTEM ACTIVE',
    'heartbeat.detail': 'Monitoring 242 Real-Time Regulations',
    'heartbeat.stable': 'SYSTEM STABLE',
    'heartbeat.stable.detail': 'Monitoring 242 Active Regulations',
    'cert.title': 'Evidence Hash Certificate',
    'cert.hash': 'SHA-256 Integrity Hash',
    'cert.ntp': 'NTP Timestamp (Authoritative)',
    'cert.merkle': 'Merkle Audit Trail',
    'cert.law': 'Legal Framework',
    'cert.law.value': 'Saudi Law of Evidence (Royal Decree M/43, 2022)',
    'cert.residency': 'Data Residency',
    'cert.residency.value': 'Kingdom of Saudi Arabia — STC Cloud',
    'cert.courtready': '✅ COURT-READY — Admissible on the Unified Objections Platform',
    'cert.verify': 'Click to Verify',
    'remediation.title': '🔧 Internal Remediation Ticket',
    'remediation.status': 'AUTO-DISPATCHED',
    'exec.simulate': '⚡ Simulate Violation',
    'exec.resolve': '✓ Resolution Verified',
    'exec.resolved.label': 'RESOLVED',
    'heartbeat.syncAgo': 'Last Sync: 2m ago',
    'heartbeat.verified': 'Source Verified via STC Cloud (KSA)',
  },
  ar: {
    'nav.live': 'مراقبة مباشرة',
    'hero.status': 'الدرع نشط',
    'hero.roi.title': 'الغرامات المعترضة',
    'hero.roi.subtitle': 'إجمالي الوفورات من الامتثال الاستباقي',
    'hero.roi.target': 'الهدف: 2 مليون ريال',
    'kpi.intercepted': 'المخالفات المعترضة',
    'kpi.critical': 'خطورة حرجة',
    'kpi.exposure': 'التعرض للغرامات',
    'kpi.drift': 'تنبيهات الانحراف التنظيمي',
    'panel.violations': 'سجل أدلة المخالفات',
    'panel.drift': 'الانحراف التنظيمي',
    'panel.integrity': 'سلامة الأدلة',
    'panel.breakdown': 'تحليل حسب الجهة',
    'panel.pipeline': 'خط أنابيب CDC',
    'table.timestamp': 'الوقت',
    'table.code': 'الكود',
    'table.authority': 'الجهة',
    'table.severity': 'الخطورة',
    'table.title': 'العنوان',
    'table.awaiting': '...في انتظار أحداث CDC',
    'drift.empty': 'لا توجد تنبيهات — الأنظمة مستقرة',
    'integrity.residency': 'الإقامة',
    'panel.gallery': 'معرض الأدلة البصرية',
    'gallery.empty': 'لا توجد كشوفات بصرية — الكاميرات تعمل',
    'demo.banking': 'المصرفية (ساما)',
    'demo.healthcare': 'الرعاية الصحية (وزارة الصحة/الهيئة)',
    'demo.fnb': 'المطاعم / التجزئة (أمانة)',
    'demo.select': 'اختر القطاع',
    'heartbeat.status': 'النظام نشط',
    'heartbeat.detail': 'مراقبة 242 لائحة تنظيمية',
    'heartbeat.stable': 'النظام مستقر',
    'heartbeat.stable.detail': 'مراقبة 242 لائحة نشطة',
    'cert.title': 'شهادة بصمة الدليل',
    'cert.hash': 'بصمة التكامل SHA-256',
    'cert.ntp': 'الطابع الزمني NTP (موثوق)',
    'cert.merkle': 'مسار تدقيق ميركل',
    'cert.law': 'الإطار القانوني',
    'cert.law.value': 'نظام الإثبات السعودي (المرسوم الملكي م/43، 2022)',
    'cert.residency': 'إقامة البيانات',
    'cert.residency.value': 'المملكة العربية السعودية — سحابة STC',
    'cert.courtready': '✅ جاهز للمحكمة — مقبول في منصة الاعتراضات الموحدة',
    'cert.verify': 'انقر للتحقق',
    'remediation.title': '🔧 تذكرة إصلاح داخلية',
    'remediation.status': 'تم الإرسال تلقائياً',
    'exec.simulate': '⚡ محاكاة مخالفة',
    'exec.resolve': '✓ تم التحقق من الحل',
    'exec.resolved.label': 'تم الحل',
    'heartbeat.syncAgo': 'آخر مزامنة: 2 دقيقة',
    'heartbeat.verified': 'تم التحقق من المصدر عبر سحابة STC (المملكة)',
  },
};

let currentLang = localStorage.getItem('saqr-lang') || 'en';
let currentTheme = localStorage.getItem('saqr-theme') || 'dark';
let currentFilters = { authority: '', severity: '' };
let currentDemoSector = null;
let demoPhase = 'green'; // 'green' | 'violation' | 'resolved'
let demoViolationTimer = null;
let pendingInterception = 0; // SAR amount of the just-intercepted fine

// -----------------------------------------------
// Theme Toggle
// -----------------------------------------------
function setTheme(theme) {
  currentTheme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('saqr-theme', theme);
  if (window.shieldMaterial) {
    const color = theme === 'dark' ? 0x00E5A0 : 0x0D9668;
    window.shieldMaterial.color.setHex(color);
    window.shieldMaterial.emissive.setHex(color);
  }
}

document.getElementById('themeToggle').addEventListener('click', () => {
  setTheme(currentTheme === 'dark' ? 'light' : 'dark');
});

// -----------------------------------------------
// Language Toggle (BiDi)
// -----------------------------------------------
function setLanguage(lang) {
  currentLang = lang;
  const html = document.documentElement;
  html.setAttribute('lang', lang === 'ar' ? 'ar' : 'en');
  html.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
  document.getElementById('langLabel').textContent = lang === 'ar' ? 'EN' : 'AR';
  localStorage.setItem('saqr-lang', lang);

  const strings = i18n[lang] || i18n.en;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (strings[key]) el.textContent = strings[key];
  });

  // Re-render demo if active
  if (currentDemoSector) activateDemoSector(currentDemoSector);
}

document.getElementById('langToggle').addEventListener('click', () => {
  setLanguage(currentLang === 'en' ? 'ar' : 'en');
});

// -----------------------------------------------
// NTP Clock
// -----------------------------------------------
function updateClock() {
  const now = new Date();
  document.getElementById('ntpTimestamp').textContent =
    `${now.toLocaleTimeString('en-GB', { hour12: false })} NTP`;
}
setInterval(updateClock, 1000);
updateClock();

// -----------------------------------------------
// Three.js — 3D Shield Visualisation
// -----------------------------------------------
let shieldScene, shieldCamera, shieldRenderer, shieldMesh;
let violationIntensity = 0;

// -----------------------------------------------
// Smooth Shield Color Lerp (2-second transitions)
// -----------------------------------------------
let shieldColorCurrent = { r: 0, g: 0.898, b: 0.627 }; // green
let shieldColorTarget = { r: 0, g: 0.898, b: 0.627 };
let shieldLerpStart = 0;
const SHIELD_LERP_DURATION = 2000; // 2 seconds

function hexToRGB(hex) {
  return {
    r: ((hex >> 16) & 0xFF) / 255,
    g: ((hex >> 8) & 0xFF) / 255,
    b: (hex & 0xFF) / 255,
  };
}

function lerpColor(a, b, t) {
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  };
}

function initShield() {
  const canvas = document.getElementById('shieldCanvas');
  const container = document.getElementById('shieldContainer');
  if (!canvas || !container || typeof THREE === 'undefined') return;

  const w = container.clientWidth;
  const h = container.clientHeight || 200;

  shieldScene = new THREE.Scene();
  shieldCamera = new THREE.PerspectiveCamera(40, w / h, 0.1, 100);
  shieldCamera.position.set(0, 0, 5);

  shieldRenderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  shieldRenderer.setSize(w, h);
  shieldRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  shieldRenderer.setClearColor(0x000000, 0);

  const shieldGeo = new THREE.OctahedronGeometry(1.3, 1);

  const accentColor = currentTheme === 'dark' ? 0x00E5A0 : 0x0D9668;
  window.shieldMaterial = new THREE.MeshStandardMaterial({
    color: accentColor,
    emissive: accentColor,
    emissiveIntensity: 0.35,
    metalness: 0.6,
    roughness: 0.25,
    wireframe: false,
    transparent: true,
    opacity: 0.55,
  });

  shieldMesh = new THREE.Mesh(shieldGeo, window.shieldMaterial);
  shieldScene.add(shieldMesh);

  const wireGeo = new THREE.OctahedronGeometry(1.35, 1);
  const wireMat = new THREE.MeshBasicMaterial({
    color: accentColor,
    wireframe: true,
    transparent: true,
    opacity: 0.3,
  });
  const wireMesh = new THREE.Mesh(wireGeo, wireMat);
  shieldScene.add(wireMesh);
  window.shieldWireMaterial = wireMat;

  const ringGeo = new THREE.TorusGeometry(1.7, 0.03, 16, 64);
  const ringMat = new THREE.MeshBasicMaterial({
    color: accentColor,
    transparent: true,
    opacity: 0.25,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  shieldScene.add(ring);
  window.shieldRing = ring;
  window.shieldRingMaterial = ringMat;

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
  shieldScene.add(ambientLight);

  const pointLight = new THREE.PointLight(accentColor, 1.5, 20);
  pointLight.position.set(3, 3, 5);
  shieldScene.add(pointLight);
  window.shieldPointLight = pointLight;

  const pointLight2 = new THREE.PointLight(0x3B82F6, 0.8, 20);
  pointLight2.position.set(-3, -2, 3);
  shieldScene.add(pointLight2);

  function animate() {
    requestAnimationFrame(animate);

    const speed = 0.003 + violationIntensity * 0.012;
    shieldMesh.rotation.y += speed;
    shieldMesh.rotation.x += speed * 0.4;
    wireMesh.rotation.y += speed * 1.05;
    wireMesh.rotation.x += speed * 0.45;
    ring.rotation.z += 0.002;
    ring.rotation.x = Math.sin(Date.now() * 0.0005) * 0.3;

    const pulse = 0.3 + Math.sin(Date.now() * 0.003) * 0.1 * (1 + violationIntensity * 2);
    window.shieldMaterial.emissiveIntensity = pulse;

    // Smooth color lerp tick
    tickShieldLerp();

    shieldRenderer.render(shieldScene, shieldCamera);
  }
  animate();

  const resizeObserver = new ResizeObserver(() => {
    const nw = container.clientWidth;
    const nh = container.clientHeight || 200;
    shieldCamera.aspect = nw / nh;
    shieldCamera.updateProjectionMatrix();
    shieldRenderer.setSize(nw, nh);
  });
  resizeObserver.observe(container);
}

function setShieldColor(hexColor, instant = false) {
  if (!window.shieldMaterial) return;
  const target = hexToRGB(hexColor);
  if (instant) {
    // Instantaneous — used only during init before canvas visible
    shieldColorCurrent = { ...target };
    shieldColorTarget = { ...target };
    applyShieldRGB(target);
  } else {
    // 2-second smooth interpolation
    shieldColorTarget = target;
    shieldLerpStart = performance.now();
  }
}

function applyShieldRGB(c) {
  const threeColor = new THREE.Color(c.r, c.g, c.b);
  window.shieldMaterial.color.copy(threeColor);
  window.shieldMaterial.emissive.copy(threeColor);
  if (window.shieldWireMaterial) window.shieldWireMaterial.color.copy(threeColor);
  if (window.shieldRingMaterial) window.shieldRingMaterial.color.copy(threeColor);
  if (window.shieldPointLight) window.shieldPointLight.color.copy(threeColor);
}

function tickShieldLerp() {
  if (!window.shieldMaterial) return;
  const now = performance.now();
  const elapsed = now - shieldLerpStart;
  const t = Math.min(elapsed / SHIELD_LERP_DURATION, 1);
  const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; // easeInOutQuad
  shieldColorCurrent = lerpColor(shieldColorCurrent, shieldColorTarget, eased);
  applyShieldRGB(shieldColorCurrent);
}

function updateShieldStatus(criticalCount, totalCount) {
  violationIntensity = Math.min(criticalCount / 5, 1);

  const label = document.getElementById('shieldStatusText');

  if (criticalCount > 0) {
    label.textContent = currentLang === 'ar'
      ? `⚠️ ${criticalCount} تنبيهات حرجة`
      : `⚠️ ${criticalCount} CRITICAL ALERTS`;
    setShieldColor(0xEF4444);
  } else if (totalCount > 0) {
    label.textContent = currentLang === 'ar'
      ? `🛡️ ${totalCount} مخالفات معترضة`
      : `🛡️ ${totalCount} INTERCEPTED`;
    const c = currentTheme === 'dark' ? 0xF59E0B : 0xD97706;
    setShieldColor(c);
  } else {
    const strings = i18n[currentLang];
    label.textContent = strings['hero.status'];
    const c = currentTheme === 'dark' ? 0x00E5A0 : 0x0D9668;
    setShieldColor(c);
  }
}

// -----------------------------------------------
// ROI Counter Animation
// -----------------------------------------------
let currentROI = 0;

function animateROI(targetValue) {
  const el = document.getElementById('roiValue');
  const bar = document.getElementById('roiBar');
  if (!el) return;

  const start = currentROI;
  const duration = 1500;
  const startTime = performance.now();
  const maxTarget = 2000000;

  function update(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 4);
    const current = start + (targetValue - start) * eased;

    el.textContent = formatCurrency(current);
    if (bar) bar.style.width = `${Math.min((current / maxTarget) * 100, 100)}%`;

    if (progress < 1) requestAnimationFrame(update);
    else currentROI = targetValue;
  }
  requestAnimationFrame(update);
}

function formatCurrency(value) {
  if (value >= 1000000) return `${(value / 1000000).toFixed(2)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
  return Math.round(value).toLocaleString();
}

function animateValue(elementId, endValue) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const dur = 700, st = performance.now();
  function upd(now) {
    const p = Math.min((now - st) / dur, 1);
    el.textContent = Math.round(endValue * (1 - Math.pow(1 - p, 3))).toLocaleString();
    if (p < 1) requestAnimationFrame(upd);
  }
  requestAnimationFrame(upd);
}

// -----------------------------------------------
// SHA-256 Hash Utility (for demo evidence)
// -----------------------------------------------
async function sha256(message) {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function generateDemoHash(seed) {
  // Synchronous deterministic pseudo-hash for demo display
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  const hex = (n) => ((n >>> 0).toString(16)).padStart(8, '0');
  let result = '';
  for (let i = 0; i < 8; i++) {
    h ^= (i * 0x27d4eb2d);
    h = Math.imul(h, 0x01000193);
    result += hex(h);
  }
  return result;
}

function fmtTs(iso) {
  const d = new Date(iso);
  return `${d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} ${d.toLocaleTimeString('en-GB', { hour12: false })}`;
}

// -----------------------------------------------
// Demo Mode — Sector Data Engine
// -----------------------------------------------
const DEMO_DATA = {
  banking: {
    kpis: { totalViolationsIntercepted: 47, criticalViolations: 3, projectedPenaltyExposure: 1450000 },
    violations: [
      {
        id: 1, evidence_type: 'cdc_violation', violation_code: 'SAMA-CP-001', authority: 'SAMA', severity: 'critical', title: 'SME Fee Cap Breach — Old Rate Still Active', description: 'CDC detected core banking system charging 2.5% admin fee, exceeding new SAMA-mandated 1% cap for SME loans.', ntp_timestamp: '2026-02-28T09:45:12.000Z', sha256_hash: generateDemoHash('SAMA-CP-001-sme-fee-cap'),
        reasoning: { pipeline: 'Phase A — Rule Engine', source: 'SAMA Circular No. 402/2026', constraint: 'Max admin fee: 1%', cdcValue: 'CDC stream: admin_fee_rate = 2.5%', verdict: 'OUT OF COMPLIANCE — 2.5× above cap', potentialFine: 'SAR 500,000', hashedLink: generateDemoHash('LINK-SAMA-402-sme') }
      },
      {
        id: 2, evidence_type: 'cdc_violation', violation_code: 'SAMA-CP-002', authority: 'SAMA', severity: 'critical', title: 'Exceeded Approved Fee Cap — Personal Loan Admin Fee', description: 'Fee schedule shows SAR 1,500 admin fee; SAMA circular caps at SAR 1,000 effective 2026-01-01.', ntp_timestamp: '2026-02-28T09:32:05.000Z', sha256_hash: generateDemoHash('SAMA-CP-002-fee-cap'),
        reasoning: { pipeline: 'Phase A — Rule Engine', source: 'SAMA Circular No. 402/2026, Article 4', constraint: 'Max admin fee: SAR 1,000', cdcValue: 'CDC stream: admin_fee_amount = SAR 1,500', verdict: 'OUT OF COMPLIANCE — SAR 500 above cap', potentialFine: 'SAR 500,000', hashedLink: generateDemoHash('LINK-SAMA-402-fee') }
      },
      {
        id: 3, evidence_type: 'cdc_violation', violation_code: 'SAMA-CP-003', authority: 'SAMA', severity: 'high', title: 'Cooling-Off Period Violation', description: 'Customer cancellation request received during 10-day cooling-off period was not processed within 48 hours.', ntp_timestamp: '2026-02-28T08:15:30.000Z', sha256_hash: generateDemoHash('SAMA-CP-003-cooling'),
        reasoning: { pipeline: 'Phase A — Rule Engine', source: 'SAMA Consumer Protection Principles 2026', constraint: 'Max processing time: 10 business days', cdcValue: 'CDC stream: processing_time = 14 days', verdict: 'OUT OF COMPLIANCE — 4 days overdue', potentialFine: 'SAR 250,000', hashedLink: generateDemoHash('LINK-SAMA-CP-cooling') }
      },
      {
        id: 4, evidence_type: 'cdc_violation', violation_code: 'SAMA-CP-001', authority: 'SAMA', severity: 'high', title: 'Disclosure Font Size Below 14pt', description: 'Digital channel product disclosure rendered at 11pt; SAMA minimum is 14pt for Arabic text.', ntp_timestamp: '2026-02-28T07:50:18.000Z', sha256_hash: generateDemoHash('SAMA-CP-001-font'),
        reasoning: { pipeline: 'Phase A — Rule Engine', source: 'SAMA Circular No. 402/2026, Article 2', constraint: 'Min font size: 14pt', cdcValue: 'CDC stream: font_size_pt = 11', verdict: 'OUT OF COMPLIANCE — 3pt below minimum', potentialFine: 'SAR 100,000', hashedLink: generateDemoHash('LINK-SAMA-402-font') }
      },
      {
        id: 5, evidence_type: 'cdc_violation', violation_code: 'SAMA-CP-002', authority: 'SAMA', severity: 'medium', title: 'Cash Advance Fee Exceeds Schedule', description: 'Credit card cash advance fee of SAR 100 exceeds approved schedule maximum of SAR 75.', ntp_timestamp: '2026-02-27T16:22:44.000Z', sha256_hash: generateDemoHash('SAMA-CP-002-cash'),
        reasoning: { pipeline: 'Phase A — Rule Engine', source: 'SAMA Circular No. 402/2026, Article 4', constraint: 'Max cash advance fee: SAR 75', cdcValue: 'CDC stream: cash_advance_fee = SAR 100', verdict: 'OUT OF COMPLIANCE — SAR 25 above cap', potentialFine: 'SAR 100,000', hashedLink: generateDemoHash('LINK-SAMA-402-cash') }
      },
    ],
    driftAlerts: [
      { id: 1, alert_id: 'DRIFT-SAMA-001', drift_type: 'added', authority: 'SAMA', severity: 'critical', title: 'NEW: SME Fee Cap Circular (Feb 2026)', description: 'SAMA issued new circular mandating 1% maximum admin fee for SME products. Effective immediately. Previous cap was 2.5%.', detected_at: '2026-02-28T09:00:00.000Z' },
      { id: 2, alert_id: 'DRIFT-SAMA-002', drift_type: 'parameter_change', authority: 'SAMA', severity: 'high', title: 'MODIFIED: Cooling-Off Period Extended to 14 Days', description: 'SAMA Consumer Protection update extends cooling-off from 10 to 14 calendar days for all retail credit products.', detected_at: '2026-02-27T14:30:00.000Z' },
      { id: 3, alert_id: 'DRIFT-SAMA-003', drift_type: 'modified', authority: 'SAMA', severity: 'high', title: 'UPDATED: Disclosure Language Requirements', description: 'All product disclosures must now be in both Arabic and English. Arabic-only no longer sufficient for digital channels.', detected_at: '2026-02-26T11:00:00.000Z' },
    ],
    cvDetections: [],
    breakdown: { SAMA: 47, MOMAH: 0, SFDA: 0 },
    roiTarget: 1450000,
    shieldState: 'amber',
  },

  healthcare: {
    kpis: { totalViolationsIntercepted: 31, criticalViolations: 5, projectedPenaltyExposure: 820000 },
    violations: [
      { id: 1, evidence_type: 'visual_audit', violation_code: 'SFDA-HC-001', authority: 'SFDA', severity: 'critical', title: 'Cold Chain Breach — Vaccine Storage at 12°C', description: 'CV Watchman detected refrigeration unit displaying 12°C; SFDA mandate is 2–8°C. Time-stamped evidence captured.', ntp_timestamp: '2026-02-28T10:02:15.000Z', sha256_hash: generateDemoHash('SFDA-HC-001-cold') },
      { id: 2, evidence_type: 'visual_audit', violation_code: 'MOH-HY-001', authority: 'SFDA', severity: 'critical', title: 'Hygiene Protocol Breach — No PPE in Sterile Zone', description: 'Camera CAM-STR-02 detected personnel in sterile preparation area without required PPE (gloves, mask).', ntp_timestamp: '2026-02-28T09:48:30.000Z', sha256_hash: generateDemoHash('MOH-HY-001-ppe') },
      { id: 3, evidence_type: 'visual_audit', violation_code: 'SFDA-HC-002', authority: 'SFDA', severity: 'high', title: 'Expired Product on Display Shelf', description: 'YOLOv8 detected pharmaceutical product with expiry date 2025-12-31 still on active shelf.', ntp_timestamp: '2026-02-28T08:33:12.000Z', sha256_hash: generateDemoHash('SFDA-HC-002-expiry') },
      { id: 4, evidence_type: 'visual_audit', violation_code: 'MOH-HY-002', authority: 'SFDA', severity: 'high', title: 'Waste Segregation Violation', description: 'Medical waste container in pharmacy area not color-coded per MOH waste management circular.', ntp_timestamp: '2026-02-28T07:15:45.000Z', sha256_hash: generateDemoHash('MOH-HY-002-waste') },
    ],
    driftAlerts: [
      { id: 1, alert_id: 'DRIFT-SFDA-001', drift_type: 'added', authority: 'SFDA', severity: 'critical', title: 'NEW: Cold Chain Monitoring Mandate', description: 'SFDA requires continuous IoT / visual monitoring of all cold storage units. Manual logs no longer sufficient.', detected_at: '2026-02-28T08:00:00.000Z' },
      { id: 2, alert_id: 'DRIFT-MOH-001', drift_type: 'parameter_change', authority: 'MOH', severity: 'high', title: 'UPDATED: PPE Requirements in Sterile Zones', description: 'MOH updated sterile zone requirements. N95 masks now mandatory (replacing surgical masks).', detected_at: '2026-02-27T09:00:00.000Z' },
    ],
    cvDetections: [
      { id: 1, evidence_id: 'CVE-HC-001', camera_id: 'CAM-COLD-01', source: 'genetec', violation_code: 'SFDA-HC-001', category: 'structural', confidence: 0.94, bbox: { x: 0.3, y: 0.2, width: 0.4, height: 0.35 }, severity: 'critical', name_en: 'Cold Chain Temperature Breach', name_ar: 'خرق سلسلة التبريد', ntp_timestamp: '2026-02-28T10:02:15.000Z' },
      { id: 2, evidence_id: 'CVE-HC-002', camera_id: 'CAM-STR-02', source: 'milestone', violation_code: 'MOH-HY-001', category: 'visual', confidence: 0.91, bbox: { x: 0.15, y: 0.1, width: 0.55, height: 0.7 }, severity: 'critical', name_en: 'PPE Violation — Sterile Zone', name_ar: 'مخالفة معدات الوقاية — منطقة معقمة', ntp_timestamp: '2026-02-28T09:48:30.000Z' },
      { id: 3, evidence_id: 'CVE-HC-003', camera_id: 'CAM-SHELF-01', source: 'genetec', violation_code: 'SFDA-HC-002', category: 'visual', confidence: 0.87, bbox: { x: 0.4, y: 0.3, width: 0.3, height: 0.2 }, severity: 'high', name_en: 'Expired Product on Shelf', name_ar: 'منتج منتهي الصلاحية على الرف', ntp_timestamp: '2026-02-28T08:33:12.000Z' },
    ],
    breakdown: { SAMA: 0, MOMAH: 0, SFDA: 31 },
    roiTarget: 820000,
    shieldState: 'red',
  },

  fnb: {
    kpis: { totalViolationsIntercepted: 24, criticalViolations: 1, projectedPenaltyExposure: 680000 },
    violations: [
      { id: 1, evidence_type: 'visual_audit', violation_code: 'MOMAH-BR-001', authority: 'MOMAH', severity: 'critical', title: 'Damaged Commercial Signage — 60% Burnout', description: 'YOLOv8 detected primary signage with 60% LED burnout at front-facing storefront. MOMAH requires 90% illumination.', ntp_timestamp: '2026-02-28T09:55:00.000Z', sha256_hash: generateDemoHash('MOMAH-BR-001-sign') },
      { id: 2, evidence_type: 'visual_audit', violation_code: 'MOMAH-BR-002', authority: 'MOMAH', severity: 'high', title: 'Sidewalk Encroachment — Display Beyond Boundary', description: 'Outdoor merchandise display extends 1.2m beyond licensed boundary. MOMAH permits 0.5m maximum.', ntp_timestamp: '2026-02-28T09:30:22.000Z', sha256_hash: generateDemoHash('MOMAH-BR-002-sidewalk') },
      { id: 3, evidence_type: 'visual_audit', violation_code: 'MOMAH-BR-003', authority: 'MOMAH', severity: 'high', title: 'Expired Commercial License — Branch JED-001', description: 'License expiry date 2026-03-15 approaching. System auto-flagged for pre-emptive renewal.', ntp_timestamp: '2026-02-28T08:00:00.000Z', sha256_hash: generateDemoHash('MOMAH-BR-003-license') },
      { id: 4, evidence_type: 'visual_audit', violation_code: 'MOMAH-BR-001', authority: 'MOMAH', severity: 'medium', title: 'Non-Bilingual Signage', description: 'Secondary signage in English only. MOMAH requires Arabic as primary language on all commercial signage.', ntp_timestamp: '2026-02-27T14:10:05.000Z', sha256_hash: generateDemoHash('MOMAH-BR-001-bilingual') },
    ],
    driftAlerts: [
      { id: 1, alert_id: 'DRIFT-MOMAH-001', drift_type: 'parameter_change', authority: 'MOMAH', severity: 'high', title: 'NEW: Signage Illumination Threshold Increased', description: 'MOMAH updated minimum illumination threshold from 80% to 90% for all commercial signage. Effective immediately.', detected_at: '2026-02-28T07:00:00.000Z' },
    ],
    cvDetections: [
      { id: 1, evidence_id: 'CVE-FB-001', camera_id: 'CAM-FRONT-01', source: 'milestone', violation_code: 'MOMAH-BR-001', category: 'signage', confidence: 0.92, bbox: { x: 0.1, y: 0.05, width: 0.8, height: 0.25 }, severity: 'critical', name_en: 'Burnt-Out Signage (60%)', name_ar: 'لوحة إعلانية محترقة (60%)', ntp_timestamp: '2026-02-28T09:55:00.000Z' },
      { id: 2, evidence_id: 'CVE-FB-002', camera_id: 'CAM-SIDE-02', source: 'milestone', violation_code: 'MOMAH-BR-002', category: 'structural', confidence: 0.88, bbox: { x: 0.6, y: 0.4, width: 0.35, height: 0.5 }, severity: 'high', name_en: 'Sidewalk Encroachment', name_ar: 'تعدي على الرصيف', ntp_timestamp: '2026-02-28T09:30:22.000Z' },
      { id: 3, evidence_id: 'CVE-FB-003', camera_id: 'CAM-FRONT-01', source: 'milestone', violation_code: 'MOMAH-BR-001', category: 'signage', confidence: 0.79, bbox: { x: 0.2, y: 0.1, width: 0.6, height: 0.15 }, severity: 'medium', name_en: 'Non-Bilingual Signage', name_ar: 'لوحة غير ثنائية اللغة', ntp_timestamp: '2026-02-27T14:10:05.000Z' },
    ],
    breakdown: { SAMA: 0, MOMAH: 24, SFDA: 0 },
    roiTarget: 680000,
    shieldState: 'amber',
    remediation: {
      ticketId: 'REM-2026-0147',
      site: 'Jeddah Corniche — JED-001',
      issue: 'Damaged Commercial Signage — 60% Burnout',
      dispatchedTo: 'Facilities Team — Zone 3',
      eta: '4 hours',
    },
  },
};

// -----------------------------------------------
// Demo Mode — Activation (Executive: Baseline Green)
// -----------------------------------------------
function activateDemoSector(sector) {
  currentDemoSector = sector;
  const data = DEMO_DATA[sector];
  if (!data) return;

  // Cancel any pending violation timers
  if (demoViolationTimer) { clearTimeout(demoViolationTimer); demoViolationTimer = null; }
  demoPhase = 'green';
  pendingInterception = 0;

  const strings = i18n[currentLang] || i18n.en;

  // Update demo selector visual
  document.querySelectorAll('.demo-sector-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.sector === sector);
  });

  // --- BASELINE GREEN STATE ---
  // Heartbeat → "SYSTEM STABLE"
  setHeartbeatMode('stable');

  // Shield → Healthy green (instant on first load, smooth thereafter)
  const greenHex = currentTheme === 'dark' ? 0x00E5A0 : 0x0D9668;
  setShieldColor(greenHex, true);
  violationIntensity = 0;
  const statusLabel = document.getElementById('shieldStatusText');
  if (statusLabel) statusLabel.textContent = strings['hero.status'];

  // KPIs → True Zero (clean slate for maximum ROI impact)
  document.getElementById('kpiInterceptedValue').textContent = '0';
  document.getElementById('kpiCriticalValue').textContent = '0';
  document.getElementById('kpiDriftValue').textContent = '0';
  document.getElementById('kpiExposureValue').textContent = 'SAR 0';

  // ROI → SAR 0 (will jump dramatically on Simulate)
  currentROI = 0;
  document.getElementById('roiValue').textContent = formatCurrency(0);
  const roiBar = document.getElementById('roiBar');
  if (roiBar) roiBar.style.width = '0%';

  // Violations Table → Completely empty
  const tbody = document.getElementById('violationsTableBody');
  if (tbody) {
    tbody.innerHTML = '';
  }

  // Drift Panel → Empty
  const driftBody = document.getElementById('driftBody');
  if (driftBody) {
    driftBody.innerHTML = `<div class="drift-empty">${strings['drift.empty']}</div>`;
  }

  // CV Gallery → Empty
  const grid = document.getElementById('cvGalleryGrid');
  if (grid) {
    grid.innerHTML = `<div class="gallery-empty">${strings['gallery.empty']}</div>`;
  }

  // Breakdown → Zeroed
  document.getElementById('samaCount').textContent = '0';
  document.getElementById('momahCount').textContent = '0';
  document.getElementById('sfdaCount').textContent = '0';
  document.getElementById('samaBar').style.width = '0%';
  document.getElementById('momahBar').style.width = '0%';
  document.getElementById('sfdaBar').style.width = '0%';

  // Merkle root
  const merkleEl = document.getElementById('merkleRoot');
  if (merkleEl) {
    const demoRoot = generateDemoHash(`merkle-root-${sector}-${Date.now()}`);
    merkleEl.textContent = demoRoot.substring(0, 22) + '…';
    merkleEl.title = demoRoot;
  }

  // Hide remediation panel
  const remPanel = document.getElementById('remediationPanel');
  if (remPanel) remPanel.style.display = 'none';

  // Pipeline status active
  document.querySelectorAll('.pipeline-stage').forEach(s => s.classList.add('active'));

  // Update exec controls
  updateExecControls();
}

// -----------------------------------------------
// Executive Controls — Heartbeat Mode
// -----------------------------------------------
function setHeartbeatMode(mode) {
  const strings = i18n[currentLang] || i18n.en;
  const labelEl = document.querySelector('.heartbeat-label');
  const detailEl = document.querySelector('.heartbeat-detail');
  const bar = document.getElementById('regulatoryHeartbeat');
  if (!labelEl || !detailEl || !bar) return;

  if (mode === 'stable') {
    labelEl.textContent = strings['heartbeat.stable'];
    detailEl.textContent = strings['heartbeat.stable.detail'];
    bar.classList.remove('heartbeat-alert');
    bar.classList.add('heartbeat-stable');
  } else {
    labelEl.textContent = strings['heartbeat.status'];
    detailEl.textContent = strings['heartbeat.detail'];
    bar.classList.remove('heartbeat-stable');
    bar.classList.add('heartbeat-alert');
  }
}

// -----------------------------------------------
// Executive Controls — Simulate Violation
// -----------------------------------------------
function simulateViolation() {
  if (!currentDemoSector || demoPhase !== 'green') return;
  demoPhase = 'violation';

  const data = DEMO_DATA[currentDemoSector];
  if (!data) return;
  const strings = i18n[currentLang] || i18n.en;

  // Heartbeat → "SYSTEM ACTIVE" (alert mode)
  setHeartbeatMode('active');

  // Shield → Smooth transition to amber/red (2-second lerp)
  if (data.shieldState === 'red') {
    setShieldColor(0xEF4444);
    violationIntensity = 0.8;
    updateShieldStatus(data.kpis.criticalViolations, data.kpis.totalViolationsIntercepted);
  } else {
    const c = currentTheme === 'dark' ? 0xF59E0B : 0xD97706;
    setShieldColor(c);
    violationIntensity = 0.4;
    updateShieldStatus(data.kpis.criticalViolations, data.kpis.totalViolationsIntercepted);
  }

  // KPIs — animate to violation values
  animateValue('kpiInterceptedValue', data.kpis.totalViolationsIntercepted);
  animateValue('kpiCriticalValue', data.kpis.criticalViolations);
  animateValue('kpiDriftValue', data.driftAlerts.length);
  const exp = data.kpis.projectedPenaltyExposure;
  document.getElementById('kpiExposureValue').textContent =
    `SAR ${exp >= 1000000 ? `${(exp / 1e6).toFixed(1)}M` : exp >= 1000 ? `${(exp / 1000).toFixed(0)}K` : exp}`;

  // ROI Jump — dramatic rolling animation from SAR 0 → intercepted amount
  pendingInterception = exp;
  animateROI(data.roiTarget);

  // Populate violations table with staggered slide-in + NEW badge + Intelligence Reveal
  const tbody = document.getElementById('violationsTableBody');
  if (tbody) {
    tbody.innerHTML = data.violations.map((v, i) => {
      const hasReasoning = v.reasoning;
      const reasoningRow = hasReasoning ? `
      <tr class="intelligence-reveal" id="reveal-${v.id}" style="display:none">
        <td colspan="6">
          <div class="intelligence-panel">
            <div class="intel-header">🧠 <span class="intel-title">${currentLang === 'ar' ? 'تحليل الذكاء' : 'Intelligence Reveal'}</span></div>
            <div class="intel-grid">
              <div class="intel-row"><span class="intel-label">Pipeline</span><span class="intel-value">${v.reasoning.pipeline}</span></div>
              <div class="intel-row"><span class="intel-label">${currentLang === 'ar' ? 'المصدر' : 'Source Circular'}</span><span class="intel-value intel-source">${v.reasoning.source}</span></div>
              <div class="intel-row"><span class="intel-label">${currentLang === 'ar' ? 'القيد' : 'Constraint'}</span><span class="intel-value">${v.reasoning.constraint}</span></div>
              <div class="intel-row"><span class="intel-label">${currentLang === 'ar' ? 'البيانات الحية' : 'Live CDC Data'}</span><span class="intel-value intel-cdc">${v.reasoning.cdcValue}</span></div>
              <div class="intel-row intel-verdict"><span class="intel-label">${currentLang === 'ar' ? 'الحكم' : 'Verdict'}</span><span class="intel-value intel-fail">❌ ${v.reasoning.verdict}</span></div>
              <div class="intel-row"><span class="intel-label">${currentLang === 'ar' ? 'التعرض المالي' : 'Potential Fine'}</span><span class="intel-value intel-fine">${v.reasoning.potentialFine}</span></div>
              <div class="intel-row"><span class="intel-label">${currentLang === 'ar' ? 'رابط الدليل' : 'Hashed Link'}</span><span class="intel-value hash-cell" title="${v.reasoning.hashedLink}">${v.reasoning.hashedLink.substring(0, 24)}…</span></div>
            </div>
          </div>
        </td>
      </tr>` : '';
      return `
      <tr class="violation-slide-in ${hasReasoning ? 'has-intel' : ''}" style="animation-delay:${i * 120}ms" onclick="${hasReasoning ? `toggleIntelReveal(${v.id})` : `openDemoCertificate(${v.id}, '${currentDemoSector}')`}">
        <td class="timestamp-cell">${fmtTs(v.ntp_timestamp)}</td>
        <td><code style="font-size:0.68rem;color:var(--text-secondary)">${v.violation_code}</code></td>
        <td><span class="authority-badge authority-${v.authority}">${v.authority}</span></td>
        <td><span class="severity-badge severity-${v.severity}">${v.severity}</span>${i === 0 ? '<span class="new-badge">NEW</span>' : ''}${hasReasoning ? '<span class="intel-badge">🧠</span>' : ''}</td>
        <td style="max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${v.title}</td>
        <td class="hash-cell" title="${v.sha256_hash}">${v.sha256_hash.substring(0, 14)}…</td>
      </tr>
      ${reasoningRow}`;
    }).join('');
  }

  // Drift alerts
  const driftBody = document.getElementById('driftBody');
  if (driftBody) {
    if (data.driftAlerts.length === 0) {
      driftBody.innerHTML = `<div class="drift-empty">${strings['drift.empty']}</div>`;
    } else {
      driftBody.innerHTML = data.driftAlerts.map(d => `
        <div class="drift-alert drift-${d.severity === 'critical' ? 'critical' : d.drift_type === 'added' ? 'added' : ''}" onclick="openCertificate('${d.alert_id}', '${d.title}', '${d.detected_at}')">
          <div class="drift-alert-type" style="color: var(--accent-${d.severity === 'critical' ? 'red' : d.drift_type === 'added' ? 'blue' : 'amber'});">${d.drift_type.toUpperCase()} — ${d.authority}</div>
          <div class="drift-alert-title">${d.title}</div>
          <div class="drift-alert-desc">${(d.description || '').substring(0, 140)}</div>
          <div class="cert-verify-hint">${strings['cert.verify']} →</div>
        </div>
      `).join('');
    }
  }

  // CV Gallery
  const grid = document.getElementById('cvGalleryGrid');
  if (grid) {
    if (data.cvDetections.length === 0) {
      grid.innerHTML = `<div class="gallery-empty">${strings['gallery.empty']}</div>`;
    } else {
      grid.innerHTML = data.cvDetections.map(d => {
        const bbox = typeof d.bbox === 'string' ? JSON.parse(d.bbox) : (d.bbox || {});
        const catEmoji = d.category === 'signage' ? '💡' : d.category === 'visual' ? '👁️' : '🔧';
        return `
          <div class="gallery-card" onclick="openCertificate('${d.evidence_id}', '${d.name_en}', '${d.ntp_timestamp}')">
            <div class="gallery-frame">
              <span class="gallery-frame-placeholder">${catEmoji}</span>
              ${bbox.x !== undefined ? `<div class="gallery-bbox" style="left:${bbox.x * 100}%;top:${bbox.y * 100}%;width:${bbox.width * 100}%;height:${bbox.height * 100}%"></div>` : ''}
              <span class="gallery-confidence">${(d.confidence * 100).toFixed(1)}%</span>
            </div>
            <div class="gallery-meta">
              <div class="gallery-meta-title">${d.name_en}</div>
              <div class="gallery-meta-title-ar">${d.name_ar || ''}</div>
              <div class="gallery-meta-row">
                <span class="severity-badge severity-${d.severity}">${d.severity}</span>
                <span class="category-badge category-${d.category}">${d.category}</span>
              </div>
              <div class="gallery-camera">📹 ${d.camera_id}</div>
              <div class="cert-verify-hint">${strings['cert.verify']} →</div>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  // Breakdown Bars
  const total = Math.max(data.breakdown.SAMA + data.breakdown.MOMAH + data.breakdown.SFDA, 1);
  document.getElementById('samaCount').textContent = data.breakdown.SAMA;
  document.getElementById('momahCount').textContent = data.breakdown.MOMAH;
  document.getElementById('sfdaCount').textContent = data.breakdown.SFDA;
  document.getElementById('samaBar').style.width = `${(data.breakdown.SAMA / total) * 100}%`;
  document.getElementById('momahBar').style.width = `${(data.breakdown.MOMAH / total) * 100}%`;
  document.getElementById('sfdaBar').style.width = `${(data.breakdown.SFDA / total) * 100}%`;

  // Remediation ticket (F&B only)
  const remPanel = document.getElementById('remediationPanel');
  if (remPanel) {
    if (data.remediation) {
      const r = data.remediation;
      remPanel.style.display = 'block';
      remPanel.innerHTML = `
        <div class="panel-header">
          <h2 class="panel-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/>
            </svg>
            <span>${strings['remediation.title']}</span>
          </h2>
          <span class="remediation-status">${strings['remediation.status']}</span>
        </div>
        <div class="panel-body">
          <div class="remediation-detail"><span class="remediation-label">Ticket</span><span class="remediation-value code">${r.ticketId}</span></div>
          <div class="remediation-detail"><span class="remediation-label">Site</span><span class="remediation-value">${r.site}</span></div>
          <div class="remediation-detail"><span class="remediation-label">Issue</span><span class="remediation-value">${r.issue}</span></div>
          <div class="remediation-detail"><span class="remediation-label">Dispatched To</span><span class="remediation-value">${r.dispatchedTo}</span></div>
          <div class="remediation-detail"><span class="remediation-label">ETA</span><span class="remediation-value">${r.eta}</span></div>
        </div>
      `;
    } else {
      remPanel.style.display = 'none';
    }
  }

  // Update exec controls
  updateExecControls();
}

// -----------------------------------------------
// Executive Controls — Resolve & Reset
// -----------------------------------------------
function resolveViolation() {
  if (!currentDemoSector || demoPhase !== 'violation') return;
  demoPhase = 'resolved';

  const data = DEMO_DATA[currentDemoSector];
  const strings = i18n[currentLang] || i18n.en;

  // Shield → Smooth 2-second interpolation back to green
  const greenHex = currentTheme === 'dark' ? 0x00E5A0 : 0x0D9668;
  setShieldColor(greenHex);
  violationIntensity = 0;
  const statusLabel = document.getElementById('shieldStatusText');
  if (statusLabel) {
    statusLabel.textContent = currentLang === 'ar' ? '✅ تم الحل' : '✅ RESOLVED';
  }

  // Heartbeat → "SYSTEM STABLE" again
  setHeartbeatMode('stable');

  // Add intercepted fine to Total Savings Hub
  if (pendingInterception > 0) {
    const newTotal = currentROI + pendingInterception;
    animateROI(newTotal);
    pendingInterception = 0;
  }

  // KPIs → Reset critical & exposure to 0
  animateValue('kpiCriticalValue', 0);
  document.getElementById('kpiExposureValue').textContent = 'SAR 0';

  // Move alerts from Active to Archived (visual: grey out table rows)
  const tbody = document.getElementById('violationsTableBody');
  if (tbody) {
    tbody.querySelectorAll('tr').forEach(row => {
      row.style.opacity = '0.4';
      row.style.pointerEvents = 'none';
    });
    // Prepend an "Archived" header
    const archiveRow = document.createElement('tr');
    archiveRow.innerHTML = `<td colspan="6" style="text-align:center;padding:8px;font-family:var(--font-mono);font-size:0.65rem;color:var(--accent-primary);letter-spacing:1px">📦 ${currentLang === 'ar' ? 'تم أرشفة جميع التنبيهات' : 'ALL ALERTS ARCHIVED — Evidence Sealed'}</td>`;
    tbody.insertBefore(archiveRow, tbody.firstChild);
  }

  // Update remediation panel to show RESOLVED
  const remPanel = document.getElementById('remediationPanel');
  if (remPanel && remPanel.style.display === 'block') {
    const statusEl = remPanel.querySelector('.remediation-status');
    if (statusEl) {
      statusEl.textContent = strings['exec.resolved.label'];
      statusEl.style.background = 'var(--accent-primary-15)';
      statusEl.style.color = 'var(--accent-primary)';
      statusEl.style.borderColor = 'var(--accent-primary-30)';
    }
  }

  // Update exec controls
  updateExecControls();
}

// -----------------------------------------------
// Executive Controls — UI State Manager
// -----------------------------------------------
function updateExecControls() {
  const strings = i18n[currentLang] || i18n.en;
  const simulateBtn = document.getElementById('execSimulateBtn');
  const resolveBtn = document.getElementById('execResolveBtn');
  if (!simulateBtn || !resolveBtn) return;

  // Update button labels
  simulateBtn.querySelector('.exec-btn-text').textContent = strings['exec.simulate'];
  resolveBtn.querySelector('.exec-btn-text').textContent = strings['exec.resolve'];

  if (demoPhase === 'green') {
    simulateBtn.disabled = false;
    simulateBtn.classList.remove('exec-btn-disabled');
    resolveBtn.disabled = true;
    resolveBtn.classList.add('exec-btn-disabled');
  } else if (demoPhase === 'violation') {
    simulateBtn.disabled = true;
    simulateBtn.classList.add('exec-btn-disabled');
    resolveBtn.disabled = false;
    resolveBtn.classList.remove('exec-btn-disabled');
  } else {
    // resolved — allow re-simulate
    simulateBtn.disabled = false;
    simulateBtn.classList.remove('exec-btn-disabled');
    resolveBtn.disabled = true;
    resolveBtn.classList.add('exec-btn-disabled');
  }
}

// -----------------------------------------------
// simulateInterception() — The "Moment of Interception"
// Clean named wrapper for sales demos. Same as
// simulateViolation but semantically framed as
// "intercepting" a penalty before it hits the client.
// -----------------------------------------------
function simulateInterception() {
  // Ensure we're on a sector with True Zero baseline
  if (!currentDemoSector) activateDemoSector('banking');
  // If already in violation state, reset to green first
  if (demoPhase !== 'green') {
    activateDemoSector(currentDemoSector);
    // Allow the green baseline to render, then trigger
    setTimeout(() => simulateViolation(), 400);
    return;
  }
  simulateViolation();
}

window.simulateViolation = simulateViolation;
window.resolveViolation = resolveViolation;
window.simulateInterception = simulateInterception;

// -----------------------------------------------
// Certificate Modal (Click-to-Verify)
// -----------------------------------------------
function openCertificate(evidenceId, title, timestamp) {
  const strings = i18n[currentLang] || i18n.en;
  const hash = generateDemoHash(`${evidenceId}-${timestamp}`);
  const merkleProof = generateDemoHash(`merkle-proof-${evidenceId}`);

  document.getElementById('certModalTitle').textContent = strings['cert.title'];
  document.getElementById('certModalBody').innerHTML = `
    <div class="cert-card">
      <div class="cert-shield-icon">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          <path d="M9 12l2 2 4-4"/>
        </svg>
      </div>
      <div class="cert-badge-courtready">${strings['cert.courtready']}</div>

      <div class="cert-field">
        <div class="cert-field-label">Evidence ID</div>
        <div class="cert-field-value code">${evidenceId}</div>
      </div>
      <div class="cert-field">
        <div class="cert-field-label">${currentLang === 'ar' ? 'العنوان' : 'Violation'}</div>
        <div class="cert-field-value">${title}</div>
      </div>
      <div class="cert-field">
        <div class="cert-field-label">${strings['cert.hash']}</div>
        <div class="cert-field-value code hash-full">${hash}</div>
      </div>
      <div class="cert-field">
        <div class="cert-field-label">${strings['cert.ntp']}</div>
        <div class="cert-field-value code">${timestamp}</div>
      </div>
      <div class="cert-field">
        <div class="cert-field-label">${strings['cert.merkle']}</div>
        <div class="cert-field-value code hash-full">${merkleProof}</div>
      </div>
      <div class="cert-divider"></div>
      <div class="cert-field">
        <div class="cert-field-label">${strings['cert.law']}</div>
        <div class="cert-field-value">${strings['cert.law.value']}</div>
      </div>
      <div class="cert-field">
        <div class="cert-field-label">${strings['cert.residency']}</div>
        <div class="cert-field-value cert-residency">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" stroke-width="2">
            <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
          ${strings['cert.residency.value']}
        </div>
      </div>
    </div>
  `;
  document.getElementById('certModal').classList.add('visible');
}

function openDemoCertificate(id, sector) {
  const data = DEMO_DATA[sector];
  if (!data) return;
  const v = data.violations.find(v => v.id === id);
  if (!v) return;
  openCertificate(`EV-${v.violation_code}-${v.id}`, v.title, v.ntp_timestamp);
}

window.openCertificate = openCertificate;
window.openDemoCertificate = openDemoCertificate;

function closeCertModal() { document.getElementById('certModal').classList.remove('visible'); }

// -----------------------------------------------
// Legacy Evidence Modal (wired for non-demo)
// -----------------------------------------------
async function openEvidence(id) {
  const data = await fetchAPI(`/api/evidence/${id}`);
  if (!data) return;
  document.getElementById('modalTitle').textContent = `Evidence #${data.id} — ${data.violation_code}`;
  document.getElementById('modalBody').innerHTML = `
    <div class="modal-field"><div class="modal-field-label">Violation</div><div class="modal-field-value">${data.title}</div></div>
    <div class="modal-field"><div class="modal-field-label">Description</div><div class="modal-field-value">${data.description || '—'}</div></div>
    ${data.description_ar ? `<div class="modal-field"><div class="modal-field-label">الوصف</div><div class="modal-field-value" style="direction:rtl">${data.description_ar}</div></div>` : ''}
    <div class="modal-field"><div class="modal-field-label">SHA-256</div><div class="modal-field-value code">${data.sha256_hash}</div></div>
    <div class="modal-field"><div class="modal-field-label">NTP Timestamp</div><div class="modal-field-value code">${data.ntp_timestamp}</div></div>
    ${data.min_penalty_sar !== undefined ? `
    <div class="modal-penalty-range">
      <div class="penalty-item"><div class="penalty-label">Min Penalty</div><div class="penalty-value">SAR ${Number(data.min_penalty_sar).toLocaleString()}</div></div>
      <div class="penalty-item"><div class="penalty-label">Max Penalty</div><div class="penalty-value">SAR ${Number(data.max_penalty_sar).toLocaleString()}</div></div>
    </div>`: ''}
    <div class="modal-field" style="margin-top:14px"><div class="modal-field-label">Raw Payload</div><pre class="modal-field-value code" style="white-space:pre-wrap;font-size:0.65rem;max-height:180px;overflow-y:auto">${JSON.stringify(data.raw_payload, null, 2)}</pre></div>
  `;
  document.getElementById('evidenceModal').classList.add('visible');
}
window.openEvidence = openEvidence;

function closeModal() { document.getElementById('evidenceModal').classList.remove('visible'); }
document.getElementById('modalClose').addEventListener('click', closeModal);
document.getElementById('evidenceModal').addEventListener('click', e => { if (e.target === e.currentTarget) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeModal(); closeCertModal(); } });

// Certificate modal close
document.getElementById('certModalClose').addEventListener('click', closeCertModal);
document.getElementById('certModal').addEventListener('click', e => { if (e.target === e.currentTarget) closeCertModal(); });

// Filters
document.getElementById('filterAuthority').addEventListener('change', e => { currentFilters.authority = e.target.value; if (!currentDemoSector) loadViolations(); });
document.getElementById('filterSeverity').addEventListener('change', e => { currentFilters.severity = e.target.value; if (!currentDemoSector) loadViolations(); });

// CV Filter
const cvFilter = document.getElementById('filterCvCategory');
if (cvFilter) cvFilter.addEventListener('change', e => { if (!currentDemoSector) { cvCategoryFilter = e.target.value; loadCvGallery(); } });

// Demo selector buttons
document.querySelectorAll('.demo-sector-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const sector = btn.dataset.sector;
    activateDemoSector(sector);
  });
});

// -----------------------------------------------
// API Helpers (for live mode)
// -----------------------------------------------
async function fetchAPI(endpoint) {
  try {
    const res = await fetch(`${API_BASE}${endpoint}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn(`API (${endpoint}):`, err.message);
    return null;
  }
}

// -----------------------------------------------
// Live Mode Loaders (used when no demo sector active)
// -----------------------------------------------
async function loadKPIs() {
  const data = await fetchAPI('/api/dashboard/kpis');
  if (!data) return;
  animateValue('kpiInterceptedValue', data.totalViolationsIntercepted);
  animateValue('kpiCriticalValue', data.criticalViolations);
  const exp = data.projectedPenaltyExposure;
  document.getElementById('kpiExposureValue').textContent =
    `SAR ${exp >= 1000000 ? `${(exp / 1e6).toFixed(1)}M` : exp >= 1000 ? `${(exp / 1000).toFixed(0)}K` : exp}`;
  animateROI(exp);
  updateShieldStatus(data.criticalViolations, data.totalViolationsIntercepted);
}

async function loadDriftAlerts() {
  const data = await fetchAPI('/api/drift-alerts');
  const body = document.getElementById('driftBody');
  const kpi = document.getElementById('kpiDriftValue');
  if (!body) return;

  if (!data || data.length === 0) {
    const str = (i18n[currentLang] || i18n.en)['drift.empty'];
    body.innerHTML = `<div class="drift-empty">${str}</div>`;
    if (kpi) kpi.textContent = '0';
    return;
  }

  if (kpi) animateValue('kpiDriftValue', data.length);

  body.innerHTML = data.slice(0, 5).map(d => `
    <div class="drift-alert drift-${d.severity === 'critical' ? 'critical' : d.drift_type === 'added' ? 'added' : ''}">
      <div class="drift-alert-type" style="color: var(--accent-${d.severity === 'critical' ? 'red' : d.drift_type === 'added' ? 'blue' : 'amber'});">${d.drift_type.toUpperCase()} — ${d.authority}</div>
      <div class="drift-alert-title">${d.title}</div>
      <div class="drift-alert-desc">${(d.description || '').substring(0, 140)}</div>
    </div>
  `).join('');
}

async function loadViolations() {
  const params = new URLSearchParams({ page: 1, limit: 20 });
  if (currentFilters.authority) params.append('authority', currentFilters.authority);
  if (currentFilters.severity) params.append('severity', currentFilters.severity);

  const data = await fetchAPI(`/api/violations?${params}`);
  const tbody = document.getElementById('violationsTableBody');
  if (!data || !tbody) return;

  if (data.data.length === 0) {
    const str = (i18n[currentLang] || i18n.en)['table.awaiting'];
    tbody.innerHTML = `<tr class="loading-row"><td colspan="6"><div class="loading-spinner"></div><span>${str}</span></td></tr>`;
    return;
  }

  tbody.innerHTML = data.data.map(v => `
    <tr onclick="openEvidence(${v.id})">
      <td class="timestamp-cell">${fmtTs(v.ntp_timestamp)}</td>
      <td><code style="font-size:0.68rem;color:var(--text-secondary)">${v.violation_code}</code></td>
      <td><span class="authority-badge authority-${v.authority}">${v.authority}</span></td>
      <td><span class="severity-badge severity-${v.severity}">${v.severity}</span></td>
      <td style="max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${v.title}</td>
      <td class="hash-cell" title="${v.sha256_hash}">${v.sha256_hash.substring(0, 14)}…</td>
    </tr>
  `).join('');
}

async function loadBreakdown() {
  const data = await fetchAPI('/api/dashboard/breakdown');
  if (!data) return;
  let st = 0, mt = 0;
  data.forEach(r => { if (r.authority === 'SAMA') st += +r.count; if (r.authority === 'MOMAH') mt += +r.count; });
  const mx = Math.max(st, mt, 1);
  document.getElementById('samaCount').textContent = st;
  document.getElementById('momahCount').textContent = mt;
  document.getElementById('samaBar').style.width = `${(st / mx) * 100}%`;
  document.getElementById('momahBar').style.width = `${(mt / mx) * 100}%`;
}

async function loadMerkle() {
  const data = await fetchAPI('/api/merkle-log');
  const el = document.getElementById('merkleRoot');
  if (!el) return;
  if (!data || data.length === 0) { el.textContent = '—'; return; }
  el.textContent = data[0].merkle_root.substring(0, 22) + '…';
  el.title = data[0].merkle_root;
}

let cvCategoryFilter = '';
async function loadCvGallery() {
  const params = new URLSearchParams({ limit: 12 });
  if (cvCategoryFilter) params.append('category', cvCategoryFilter);
  const data = await fetchAPI(`/api/cv/detections?${params}`);
  const grid = document.getElementById('cvGalleryGrid');
  if (!grid) return;

  if (!data || data.length === 0) {
    const str = (i18n[currentLang] || i18n.en)['gallery.empty'];
    grid.innerHTML = `<div class="gallery-empty">${str}</div>`;
    return;
  }

  grid.innerHTML = data.map(d => {
    const bbox = typeof d.bbox === 'string' ? JSON.parse(d.bbox) : (d.bbox || {});
    const categoryEmoji = d.category === 'signage' ? '💡' : d.category === 'visual' ? '🏗️' : '🔧';
    return `
      <div class="gallery-card">
        <div class="gallery-frame">
          <span class="gallery-frame-placeholder">${categoryEmoji}</span>
          ${bbox.x !== undefined ? `<div class="gallery-bbox" style="left:${bbox.x * 100}%;top:${bbox.y * 100}%;width:${bbox.width * 100}%;height:${bbox.height * 100}%"></div>` : ''}
          <span class="gallery-confidence">${(d.confidence * 100).toFixed(1)}%</span>
        </div>
        <div class="gallery-meta">
          <div class="gallery-meta-title">${d.name_en || d.violation_code}</div>
          <div class="gallery-meta-title-ar">${d.name_ar || ''}</div>
          <div class="gallery-meta-row">
            <span class="severity-badge severity-${d.severity}">${d.severity}</span>
            <span class="category-badge category-${d.category}">${d.category}</span>
          </div>
          <div class="gallery-camera">📹 ${d.camera_id}</div>
        </div>
      </div>
    `;
  }).join('');
}

// -----------------------------------------------
// Init
// -----------------------------------------------
async function initDashboard() {
  if (currentDemoSector) return; // Skip live fetch in demo mode
  await Promise.all([loadKPIs(), loadViolations(), loadBreakdown(), loadMerkle(), loadDriftAlerts(), loadCvGallery()]);
}

// Apply saved preferences
setTheme(currentTheme);
setLanguage(currentLang);

// Init 3D shield after DOM is ready
setTimeout(initShield, 100);

// Auto-activate Banking demo in Baseline Green on load
setTimeout(() => activateDemoSector('banking'), 500);

// Exec control buttons
document.getElementById('execSimulateBtn')?.addEventListener('click', simulateViolation);
document.getElementById('execResolveBtn')?.addEventListener('click', resolveViolation);

// Live polling (only when NOT in demo mode)
setInterval(() => {
  if (!currentDemoSector) initDashboard();
}, 10000);

// -----------------------------------------------
// Heartbeat "Last Sync" Ticker
// -----------------------------------------------
let heartbeatSyncMinutes = 2;
setInterval(() => {
  heartbeatSyncMinutes++;
  const syncEl = document.getElementById('heartbeatSync');
  if (syncEl) {
    if (currentLang === 'ar') {
      syncEl.textContent = `آخر مزامنة: ${heartbeatSyncMinutes} دقيقة`;
    } else {
      syncEl.textContent = `Last Sync: ${heartbeatSyncMinutes}m ago`;
    }
  }
  // Reset after "simulated re-sync" every 5 minutes
  if (heartbeatSyncMinutes >= 5) heartbeatSyncMinutes = 0;
}, 60000);

// -----------------------------------------------
// Sentinel Detection: Toast Notification System
// -----------------------------------------------
function showToast(authority, title, subtitle) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const strings = i18n[currentLang] || i18n.en;
  const toastTitle = currentLang === 'ar'
    ? `تم رصد تعميم جديد من ${authority}`
    : `New ${authority} Circular Detected`;
  const toastSubtitle = subtitle || (currentLang === 'ar' ? 'جاري تحليل التأثير...' : 'Analyzing Impact...');

  const toast = document.createElement('div');
  toast.className = 'toast-notification';
  toast.innerHTML = `
    <div class="toast-icon">🔔</div>
    <div class="toast-body">
      <div class="toast-title">${toastTitle}</div>
      <div class="toast-message">${title}</div>
      <div class="toast-subtitle">${toastSubtitle}</div>
    </div>
    <button class="toast-close" onclick="this.closest('.toast-notification').classList.add('toast-dismiss'); setTimeout(() => this.closest('.toast-notification')?.remove(), 300);">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
  `;

  container.appendChild(toast);

  // Auto-dismiss after 8 seconds
  setTimeout(() => {
    toast.classList.add('toast-dismiss');
    setTimeout(() => toast.remove(), 300);
  }, 8000);
}

// -----------------------------------------------
// Sentinel Detection: Authority Amber Pulse
// -----------------------------------------------
function setAuthorityAmber(authorityCode) {
  const node = document.querySelector(`.authority-node[data-authority="${authorityCode}"]`);
  if (!node) return;
  node.classList.add('authority-amber');

  // Auto-revert to green after 30 seconds
  setTimeout(() => {
    node.classList.remove('authority-amber');
  }, 30000);
}

// -----------------------------------------------
// Intelligence Reveal — Toggle Panel
// -----------------------------------------------
function toggleIntelReveal(violationId) {
  const row = document.getElementById(`reveal-${violationId}`);
  if (!row) return;
  if (row.style.display === 'none') {
    // Close all other reveals first
    document.querySelectorAll('.intelligence-reveal').forEach(r => {
      r.style.display = 'none';
    });
    row.style.display = 'table-row';
    row.querySelector('.intelligence-panel')?.classList.add('intel-slide-in');
  } else {
    row.style.display = 'none';
  }
}

window.toggleIntelReveal = toggleIntelReveal;

// -----------------------------------------------
// simulateSentinelDetection() — Demo Function
// Callable from browser console to demonstrate
// the Sentinel Engine detection flow live.
// Usage: simulateSentinelDetection('SAMA', 'New SME Fee Cap Circular (Feb 2026)')
// -----------------------------------------------
function simulateSentinelDetection(authority, title) {
  authority = authority || 'SAMA';
  title = title || 'New SME Fee Cap Circular — 1% Maximum Admin Fee';

  console.log(`[SENTINEL] 🔔 Detection: ${authority} — "${title}"`);

  // 1. Flash the authority icon amber
  setAuthorityAmber(authority);

  // 2. Show toast notification
  showToast(authority, title);

  // 3. Reset the Last Sync to "just now"
  heartbeatSyncMinutes = 0;
  const syncEl = document.getElementById('heartbeatSync');
  if (syncEl) {
    syncEl.textContent = currentLang === 'ar' ? 'آخر مزامنة: الآن' : 'Last Sync: just now';
  }
}

window.simulateSentinelDetection = simulateSentinelDetection;
window.showToast = showToast;

// -----------------------------------------------
// Sentinel Heartbeat Poller — Checks staging API
// every 30 seconds for new regulatory detections.
// Falls back silently if API is unreachable.
// -----------------------------------------------
let lastSeenStagingId = 0;
setInterval(async () => {
  try {
    const res = await fetch(`${API_BASE}/api/v1/sources/staging/recent?hours=1`);
    if (!res.ok) return;
    const data = await res.json();
    if (!data.entries || data.entries.length === 0) return;

    // Check for new entries since last poll
    data.entries.forEach(entry => {
      if (entry.id > lastSeenStagingId) {
        lastSeenStagingId = Math.max(lastSeenStagingId, entry.id);
        setAuthorityAmber(entry.authority);
        showToast(entry.authority, entry.title);
      }
    });
  } catch {
    // API unreachable — silent fallback (demo mode)
  }
}, 30000);

console.log('🦅 SAQR Shield UI v7 — Sentinel Engine + Sovereign Bridge');
console.log('🛡️  7 Authorities | simulateInterception() | simulateSentinelDetection()');

// -----------------------------------------------
// Gateway Session Context — Apply on Load
// -----------------------------------------------
(function applyGatewaySession() {
  if (typeof SessionArchitect === 'undefined') return;
  const session = SessionArchitect.getSession();
  if (!session || !session.active) return;

  console.log(`[Gateway] Session active — Silo: ${session.siloId}`);
  console.log(`[Gateway] Industry: ${session.industry.key} → ${session.industry.schema}`);
  console.log(`[Gateway] Market: ${session.market.isoCode} (${session.market.residency})`);
  console.log(`[Gateway] Sentinels: ${session.market.scrapers.join(', ')}`);
  console.log(`[Gateway] Language: ${session.language.code} → ${session.language.locale}`);

  // 1. Apply language from session
  if (session.language.code === 'ar') {
    setLanguage('ar');
  } else {
    setLanguage('en');
  }

  // 2. Dynamic Session Header
  const FLAGS = { SA: '🇸🇦', AE: '🇦🇪', BH: '🇧🇭', QA: '🇶🇦', KW: '🇰🇼', OM: '🇴🇲', EG: '🇪🇬', JO: '🇯🇴', GB: '🇬🇧', US: '🇺🇸', DE: '🇩🇪', FR: '🇫🇷', SG: '🇸🇬', IN: '🇮🇳', MY: '🇲🇾' };
  const COUNTRY_NAMES = { SA: 'KSA', AE: 'UAE', BH: 'BHR', QA: 'QAT', KW: 'KWT', OM: 'OMN', EG: 'EGY', JO: 'JOR', GB: 'GBR', US: 'USA', DE: 'DEU', FR: 'FRA', SG: 'SGP', IN: 'IND', MY: 'MYS' };

  const sessionFlag = document.getElementById('sessionFlag');
  const sessionMarket = document.getElementById('sessionMarket');
  const sessionIndustry = document.getElementById('sessionIndustry');

  if (sessionFlag) sessionFlag.textContent = FLAGS[session.market.isoCode] || '🌐';
  if (sessionMarket) sessionMarket.textContent = COUNTRY_NAMES[session.market.isoCode] || session.market.isoCode;
  if (sessionIndustry) sessionIndustry.textContent = `${session.industry.key} Regulatory Shield`;

  // Also update the legacy market badge if it exists
  const badge = document.getElementById('gatewayMarketBadge');
  const flagEl = document.getElementById('marketFlag');
  const codeEl = document.getElementById('marketCode');
  if (badge && flagEl && codeEl) {
    flagEl.textContent = FLAGS[session.market.isoCode] || '🌐';
    codeEl.textContent = session.market.isoCode;
    badge.style.display = 'flex';
  }

  // 3. Dynamic Authority Grid (AuthorityMapper)
  if (typeof AuthorityMapper !== 'undefined') {
    const grid = document.getElementById('authorityGrid');
    if (grid) {
      grid.innerHTML = AuthorityMapper.renderGrid(session.market.isoCode, session.industry.key);
      console.log(`[AuthorityMapper] Grid populated: ${session.market.isoCode} × ${session.industry.key}`);
    }

    // Update regulation counter
    const regInfo = AuthorityMapper.getRegCount(session.industry.key);
    const detailEl = document.getElementById('heartbeatDetail');
    if (detailEl) {
      detailEl.textContent = `Monitoring ${regInfo.count} Active Regulations`;
    }

    // Update heartbeat label
    const labelEl = document.getElementById('heartbeatLabel');
    if (labelEl) labelEl.textContent = 'SYSTEM STABLE';
  }

  // 4. Auto-select the matching demo sector from session industry
  if (session.industry.demoSector) {
    const sectorMap = { banking: 'banking', healthcare: 'healthcare', fnb: 'fnb' };
    const sector = sectorMap[session.industry.demoSector];
    if (sector && DEMO_DATA[sector]) {
      activateDemoSector(sector);
    }
  }

  // 5. Initialize Neural Translation Matrix
  if (typeof TranslatorCore !== 'undefined') {
    TranslatorCore.init();
  }
})();

// -----------------------------------------------
// Neural Translation Matrix — Toggle & Integration
// -----------------------------------------------
(function initNTM() {
  if (typeof TranslatorCore === 'undefined') return;

  const ntmBtn = document.getElementById('ntmToggle');
  if (!ntmBtn) return;

  ntmBtn.addEventListener('click', () => {
    const nowActive = TranslatorCore.toggle();
    ntmBtn.classList.toggle('ntm-active', nowActive);

    if (nowActive) {
      ntmTranslateViolations();
    } else {
      // Re-render the current sector to restore originals
      if (currentDemoSector && demoPhase === 'violation') {
        simulateViolation();
      }
    }
  });
})();

/**
 * NTM: Translate all visible violation and Intelligence Reveal text.
 * Called after simulateViolation() when NTM is enabled.
 */
function ntmTranslateViolations() {
  if (typeof TranslatorCore === 'undefined' || !TranslatorCore.isEnabled()) return;

  const lang = TranslatorCore.getTargetLang();
  if (lang === 'en' || lang === 'ar') return; // en is source, ar has its own i18n

  let uid = 0;

  // 1. Translate violation titles in the table
  document.querySelectorAll('#violationsTableBody tr:not(.intelligence-reveal) td:nth-child(5)').forEach(td => {
    const original = td.textContent.trim();
    if (!original) return;
    const translated = TranslatorCore.translate(original, lang);
    if (translated !== original) {
      td.innerHTML = TranslatorCore.wrapTranslatable(original, translated, `vt-${uid++}`);
    }
  });

  // 2. Translate Intelligence Reveal panels
  document.querySelectorAll('.intelligence-panel').forEach(panel => {
    panel.querySelectorAll('.intel-value').forEach(el => {
      if (el.classList.contains('hash-cell')) return; // Don't translate hashes
      if (el.classList.contains('intel-fine')) return; // Don't translate SAR amounts

      const original = el.textContent.trim();
      if (!original) return;
      const translated = TranslatorCore.translate(original, lang);
      if (translated !== original) {
        el.innerHTML = TranslatorCore.wrapTranslatable(original, translated, `ir-${uid++}`);
      }
    });

    // Translate Intel labels
    panel.querySelectorAll('.intel-label').forEach(el => {
      const original = el.textContent.trim();
      if (!original) return;
      const translated = TranslatorCore.translate(original, lang);
      if (translated !== original) {
        el.innerHTML = TranslatorCore.wrapTranslatable(original, translated, `il-${uid++}`);
      }
    });
  });

  // 3. Translate drift alert titles
  document.querySelectorAll('.drift-alert-title').forEach(el => {
    const original = el.textContent.trim();
    if (!original) return;
    const translated = TranslatorCore.translate(original, lang);
    if (translated !== original) {
      el.innerHTML = TranslatorCore.wrapTranslatable(original, translated, `da-${uid++}`);
    }
  });

  console.log(`[NTM] Translated ${uid} elements → ${lang}`);
}

// Hook NTM into simulateViolation — call translation after rendering
const _origSimulateViolation = simulateViolation;
simulateViolation = function () {
  _origSimulateViolation.apply(this, arguments);
  // Allow DOM to settle, then translate
  setTimeout(() => ntmTranslateViolations(), 200);
};

// -----------------------------------------------
// WorkflowManager — Remediation Panel Integration
// -----------------------------------------------
(function initWorkflow() {
  if (typeof WorkflowManager === 'undefined') return;

  const slideout = document.getElementById('remediationSlideout');
  const fab = document.getElementById('remFab');
  const fabBadge = document.getElementById('remFabBadge');
  const closeBtn = document.getElementById('remCloseBtn');
  const ticketList = document.getElementById('remTicketList');
  const ticketCount = document.getElementById('remTicketCount');

  if (!slideout || !fab) return;

  // Toggle panel
  fab.addEventListener('click', () => {
    slideout.classList.toggle('open');
  });
  if (closeBtn) closeBtn.addEventListener('click', () => {
    slideout.classList.remove('open');
  });

  // Update badge count
  function updateBadge() {
    const active = WorkflowManager.getActiveTickets();
    const count = active.length;
    fabBadge.textContent = count;
    fabBadge.style.display = count > 0 ? 'flex' : 'none';
    if (ticketCount) ticketCount.textContent = count;
  }

  // Render ticket cards
  function renderTickets() {
    const tickets = WorkflowManager.getTickets();
    if (!ticketList) return;

    if (tickets.length === 0) {
      ticketList.innerHTML = '<div class="rem-empty">No active remediation tickets</div>';
      return;
    }

    ticketList.innerHTML = tickets.map(t => {
      const stateDef = WorkflowManager.getStateDef(t.state);
      const mttr = WorkflowManager.getMTTR(t);
      const stateOrder = stateDef ? stateDef.order : 0;

      // MTTR bar color
      let mttrClass = 'green';
      if (mttr.isOverdue) mttrClass = 'overdue';
      else if (mttr.isCritical) mttrClass = 'red';
      else if (mttr.percentage > 50) mttrClass = 'amber';

      // Progress steps (6 stages)
      const progressHTML = [0, 1, 2, 3, 4, 5].map(i => {
        if (i < stateOrder) return '<div class="rem-progress-step done"></div>';
        if (i === stateOrder && t.state !== 'CLOSED') return '<div class="rem-progress-step active"></div>';
        if (t.state === 'CLOSED') return '<div class="rem-progress-step done"></div>';
        return '<div class="rem-progress-step"></div>';
      }).join('');

      const assigneeHTML = t.assignee
        ? `<div class="rem-assignee"><span class="rem-assignee-icon">${t.assignee.charAt(0)}</span>${t.assignee}</div>`
        : '';

      const showMTTR = t.state !== 'CLOSED' && t.state !== 'VERIFIED';

      return `
        <div class="rem-ticket" data-ticket-id="${t.id}">
          <div class="rem-ticket-header">
            <span class="rem-ticket-id">${t.id}</span>
            <span class="rem-state-badge rem-state-${t.state}">${stateDef ? stateDef.icon : ''} ${stateDef ? stateDef.label : t.state}</span>
          </div>
          <div class="rem-ticket-title">${t.title}</div>
          <div class="rem-ticket-meta">
            <span class="rem-authority-badge">${t.authority}</span>
            <span class="rem-severity-badge severity-${t.severity}">${t.severity.toUpperCase()}</span>
            ${t.cdcVerified ? '<span class="rem-severity-badge" style="color:var(--accent-primary)">✓ CDC</span>' : ''}
          </div>
          ${showMTTR ? `
          <div class="mttr-container" data-mttr-ticket="${t.id}">
            <div class="mttr-bar"><div class="mttr-fill ${mttrClass}" style="width:${mttr.percentage}%"></div></div>
            <div class="mttr-countdown ${mttrClass}" data-mttr-display="${t.id}">${mttr.formatted}</div>
          </div>` : ''}
          ${assigneeHTML}
          <div class="rem-progress">${progressHTML}</div>
        </div>`;
    }).join('');

    updateBadge();
  }

  // Listen for changes
  WorkflowManager.on('tickets:changed', () => renderTickets());

  // Live MTTR countdown timer (updates every second)
  setInterval(() => {
    document.querySelectorAll('[data-mttr-display]').forEach(el => {
      const ticketId = el.getAttribute('data-mttr-display');
      const ticket = WorkflowManager.getTicketById(ticketId);
      if (!ticket || ticket.state === 'CLOSED' || ticket.state === 'VERIFIED') return;

      const mttr = WorkflowManager.getMTTR(ticket);
      el.textContent = mttr.formatted;

      // Update classes
      el.classList.remove('green', 'amber', 'red', 'overdue');
      const container = el.closest('.mttr-container');
      const fill = container ? container.querySelector('.mttr-fill') : null;

      if (mttr.isOverdue) {
        el.classList.add('overdue');
        if (fill) { fill.className = 'mttr-fill red'; fill.style.width = '100%'; }
      } else if (mttr.isCritical) {
        el.classList.add('red');
        if (fill) { fill.className = 'mttr-fill red'; fill.style.width = mttr.percentage + '%'; }
      } else if (mttr.percentage > 50) {
        el.classList.add('amber');
        if (fill) { fill.className = 'mttr-fill amber'; fill.style.width = mttr.percentage + '%'; }
      } else {
        if (fill) { fill.className = 'mttr-fill green'; fill.style.width = mttr.percentage + '%'; }
      }
    });
  }, 1000);

  // Hook into simulateViolation to auto-create tickets
  const _origSimViolationWF = simulateViolation;
  simulateViolation = function () {
    _origSimViolationWF.apply(this, arguments);

    // Create tickets from current sector's violations
    setTimeout(() => {
      if (!currentDemoSector || !DEMO_DATA[currentDemoSector]) return;
      const data = DEMO_DATA[currentDemoSector];

      data.violations.forEach(v => {
        // Don't create duplicate tickets
        const existing = WorkflowManager.getTickets().find(t => t.violationId === v.id);
        if (!existing) {
          WorkflowManager.createTicket(v);
        }
      });

      // Auto-demo: advance the first ticket through lifecycle
      const tickets = WorkflowManager.getActiveTickets();
      if (tickets.length > 0) {
        WorkflowManager.demoAdvance(tickets[0].id, 2500);
      }

      // Auto-open the panel
      slideout.classList.add('open');
    }, 500);
  };

  console.log('[Workflow] Remediation panel initialized — FAB active');
})();

// -----------------------------------------------
// Dispatcher — Notification Hub Integration
// -----------------------------------------------
(function initDispatcher() {
  if (typeof Dispatcher === 'undefined') return;

  const bell = document.getElementById('notifBell');
  const badge = document.getElementById('notifBadge');
  const dropdown = document.getElementById('notifDropdown');
  const notifList = document.getElementById('notifList');
  const markAllBtn = document.getElementById('notifMarkAll');

  if (!bell || !dropdown) return;

  // Bind to WorkflowManager if available
  if (typeof WorkflowManager !== 'undefined') {
    Dispatcher.bindWorkflow(WorkflowManager);
  }

  // Toggle dropdown
  bell.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('open');
    if (dropdown.classList.contains('open')) {
      renderNotifications();
    }
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.notif-bell-wrapper')) {
      dropdown.classList.remove('open');
    }
  });

  // Mark all read
  if (markAllBtn) {
    markAllBtn.addEventListener('click', () => {
      Dispatcher.markAllRead();
      bell.classList.remove('has-unread');
      renderNotifications();
    });
  }

  // Render notification items
  function renderNotifications() {
    const notifications = Dispatcher.getNotifications();
    if (!notifList) return;

    if (notifications.length === 0) {
      notifList.innerHTML = '<div class="notif-empty">No notifications yet</div>';
      return;
    }

    notifList.innerHTML = notifications.slice(0, 20).map(n => {
      const channelLabels = n.channels.map(c => c.icon).join(' ');
      const timeAgo = _relativeTime(n.timestamp);

      return `
        <div class="notif-item ${n.read ? '' : 'unread'} priority-${n.typeDef.priority}"
             data-notif-id="${n.id}" onclick="Dispatcher.markRead('${n.id}')">
          <span class="notif-icon">${n.typeDef.icon}</span>
          <div class="notif-content">
            <div class="notif-item-title">${n.title}</div>
            <div class="notif-item-message">${n.message}</div>
            <div class="notif-item-meta">
              <span class="notif-item-time">${timeAgo}</span>
              <span class="notif-item-channels">${channelLabels}</span>
            </div>
          </div>
          ${n.read ? '' : '<div class="notif-unread-dot"></div>'}
        </div>`;
    }).join('');
  }

  // Update badge on unread changes
  Dispatcher.on('unread:changed', (count) => {
    if (badge) {
      badge.textContent = count > 9 ? '9+' : count;
      badge.style.display = count > 0 ? 'flex' : 'none';
    }
    bell.classList.toggle('has-unread', count > 0);
  });

  // Re-render dropdown when new notification arrives and it's open
  Dispatcher.on('notification', () => {
    if (dropdown.classList.contains('open')) {
      renderNotifications();
    }
  });

  // Relative time formatter
  function _relativeTime(iso) {
    const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (seconds < 10) return 'just now';
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  }

  console.log('[Dispatcher] Notification hub initialized — bell active');
})();
