// ============================================
// SAQR Sentinel - SAMA Circular Scraper
// Headless Playwright scraper for:
// https://www.sama.gov.sa/en-US/Circulars/Pages/BankCirculars.aspx
// ============================================

const crypto = require('crypto');

/**
 * SAMA Bank Circulars scraper.
 * Uses Playwright to navigate the JS-rendered SharePoint page
 * and extract the latest circular entries.
 *
 * @param {import('playwright').Browser} browser - Playwright browser instance
 * @param {{ logger?: object }} [options]
 * @returns {Promise<Array<{authority: string, title: string, sourceUrl: string, category: string, publishDate: string, contentHash: string, detectedAt: string}>>}
 */
async function scrapeSAMA(browser, options = {}) {
    const TARGET_URL = 'https://www.sama.gov.sa/en-US/Circulars/Pages/BankCirculars.aspx';
    const results = [];
    const logger = options.logger || null;

    let page;
    try {
        const context = await browser.newContext({
            userAgent: 'SAQR-Sentinel/1.0 (Compliance Monitor; KSA)',
            locale: 'en-US',
        });
        page = await context.newPage();

        await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 30000 });

        await page.waitForSelector('tr.item, .ms-listviewtable tr, table tr', { timeout: 15000 }).catch(() => {
            logger?.warn('scrape.source_structure_warning', {
                authority: 'SAMA',
                sourceUrl: TARGET_URL,
                reason: 'No table rows found; source structure may have changed.',
            });
        });

        const entries = await page.evaluate(() => {
            const rows = document.querySelectorAll('tr.item, .ms-listviewtable tbody tr');
            const items = [];

            rows.forEach((row) => {
                const cells = row.querySelectorAll('td');
                if (cells.length < 2) {
                    return;
                }

                const link = row.querySelector('a');
                const title = link ? link.textContent.trim() : cells[0].textContent.trim();
                const href = link ? link.href : '';
                const dateText = cells[cells.length - 1]?.textContent.trim() || '';
                const category = cells.length > 2 ? cells[1]?.textContent.trim() : 'General';

                if (title && title.length > 5) {
                    items.push({ title, href, dateText, category });
                }
            });

            return items.slice(0, 20);
        });

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

        logger?.info('scrape.source_completed', {
            authority: 'SAMA',
            sourceUrl: TARGET_URL,
            resultCount: results.length,
        });
    } catch (err) {
        logger?.error('scrape.source_failed', err, {
            authority: 'SAMA',
            sourceUrl: TARGET_URL,
        });
    } finally {
        if (page) {
            await page.close().catch(() => { });
        }
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

    return circulars.map((circular) => {
        const hashInput = `SAMA|${circular.title}|${circular.date}`;
        const contentHash = crypto.createHash('sha256').update(hashInput).digest('hex');
        return {
            authority: 'SAMA',
            title: circular.title,
            sourceUrl: 'https://www.sama.gov.sa/en-US/Circulars/Pages/BankCirculars.aspx',
            category: circular.category,
            publishDate: circular.date,
            contentHash,
            detectedAt: new Date().toISOString(),
        };
    });
}

module.exports = { scrapeSAMA, scrapeSAMADemo };
