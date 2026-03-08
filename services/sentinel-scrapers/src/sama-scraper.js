// ============================================
// SAQR Sentinel — SAMA Circular Scraper
// Headless Playwright scraper for:
// https://www.sama.gov.sa/en-US/Circulars/Pages/BankCirculars.aspx
// ============================================

const crypto = require('crypto');

/**
 * SAMA Bank Circulars Scraper
 * Uses Playwright to navigate the JS-rendered SharePoint page
 * and extract the latest circular entries.
 *
 * @param {import('playwright').Browser} browser - Playwright browser instance
 * @returns {Promise<Array<{authority: string, title: string, sourceUrl: string, category: string, publishDate: string, contentHash: string, detectedAt: string}>>}
 */
async function scrapeSAMA(browser) {
    const TARGET_URL = 'https://www.sama.gov.sa/en-US/Circulars/Pages/BankCirculars.aspx';
    const results = [];

    let page;
    try {
        const context = await browser.newContext({
            userAgent: 'SAQR-Sentinel/1.0 (Compliance Monitor; KSA)',
            locale: 'en-US',
        });
        page = await context.newPage();

        // Navigate with extended timeout for government portals
        await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 30000 });

        // Wait for the circular table to render (SharePoint dynamic content)
        await page.waitForSelector('tr.item, .ms-listviewtable tr, table tr', { timeout: 15000 }).catch(() => {
            console.log('[SAMA] No table rows found — page may have changed structure');
        });

        // Extract circular entries
        const entries = await page.evaluate(() => {
            const rows = document.querySelectorAll('tr.item, .ms-listviewtable tbody tr');
            const items = [];

            rows.forEach(row => {
                const cells = row.querySelectorAll('td');
                if (cells.length < 2) return;

                // Extract title from first link or first cell
                const link = row.querySelector('a');
                const title = link ? link.textContent.trim() : cells[0].textContent.trim();
                const href = link ? link.href : '';

                // Try to get date from last or second cell
                const dateText = cells[cells.length - 1]?.textContent.trim() || '';

                // Try to get category
                const category = cells.length > 2 ? cells[1]?.textContent.trim() : 'General';

                if (title && title.length > 5) {
                    items.push({ title, href, dateText, category });
                }
            });

            return items.slice(0, 20); // Latest 20 entries max
        });

        // Process entries with hashing
        for (const entry of entries) {
            const hashInput = `SAMA|${entry.title}|${entry.href}`;
            const contentHash = crypto.createHash('sha256').update(hashInput).digest('hex');

            results.push({
                authority: 'SAMA',
                title: entry.title,
                sourceUrl: entry.href || TARGET_URL,
                category: entry.category || 'Bank Circular',
                publishDate: entry.dateText || null,
                contentHash,
                detectedAt: new Date().toISOString(),
            });
        }

        console.log(`[SAMA] Scraped ${results.length} circulars from ${TARGET_URL}`);
    } catch (err) {
        console.error(`[SAMA] Scraper error: ${err.message}`);
    } finally {
        if (page) await page.close().catch(() => { });
    }

    return results;
}

/**
 * Simulated SAMA scraper for demo/testing without network access.
 * Returns realistic mock data matching the real scraper output format.
 */
function scrapeSAMADemo() {
    const circulars = [
        { title: 'Circular: Maximum Limit for Admin Fees on SME Products', category: 'Consumer Protection', date: '2026-02-28' },
        { title: 'Circular: Updated Cooling-Off Period for Retail Credit Products', category: 'Consumer Protection', date: '2026-02-25' },
        { title: 'Circular: Digital Channel Disclosure Requirements (Bilingual)', category: 'Digital Banking', date: '2026-02-20' },
        { title: 'Circular: Anti-Fraud Monitoring Enhancement Requirements', category: 'AML/CTF', date: '2026-02-15' },
        { title: 'Circular: Open Banking API Standard v3.1 Compliance Deadline', category: 'Open Banking', date: '2026-02-10' },
    ];

    return circulars.map(c => {
        const hashInput = `SAMA|${c.title}|${c.date}`;
        const contentHash = crypto.createHash('sha256').update(hashInput).digest('hex');
        return {
            authority: 'SAMA',
            title: c.title,
            sourceUrl: `https://www.sama.gov.sa/en-US/Circulars/Pages/BankCirculars.aspx`,
            category: c.category,
            publishDate: c.date,
            contentHash,
            detectedAt: new Date().toISOString(),
        };
    });
}

module.exports = { scrapeSAMA, scrapeSAMADemo };
