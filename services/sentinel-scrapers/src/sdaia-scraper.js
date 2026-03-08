// ============================================
// SAQR Sentinel — SDAIA News Scraper
// Headless Playwright scraper for:
// https://sdaia.gov.sa/en/MediaCenter/News/
// Targets PDPL enforcement circulars and AI governance updates
// ============================================

const crypto = require('crypto');

/**
 * SDAIA News/PDPL Scraper
 * Uses Playwright to navigate the SDAIA media center
 * and extract news headlines + PDF links.
 *
 * @param {import('playwright').Browser} browser - Playwright browser instance
 * @returns {Promise<Array<{authority: string, title: string, sourceUrl: string, category: string, publishDate: string, contentHash: string, detectedAt: string}>>}
 */
async function scrapeSDAIA(browser) {
    const TARGET_URL = 'https://sdaia.gov.sa/en/MediaCenter/News/';
    const results = [];

    let page;
    try {
        const context = await browser.newContext({
            userAgent: 'SAQR-Sentinel/1.0 (Compliance Monitor; KSA)',
            locale: 'en-US',
        });
        page = await context.newPage();

        await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 30000 });

        // Wait for news grid to render
        await page.waitForSelector('.news-item, .card, article, .media-item', { timeout: 15000 }).catch(() => {
            console.log('[SDAIA] No news grid found — page may have changed structure');
        });

        // Extract news entries from the grid
        const entries = await page.evaluate(() => {
            // Try multiple selectors for resilience
            const selectors = [
                '.news-item', '.card', 'article', '.media-item',
                '.news-list li', '.blog-post', '[class*="news"]'
            ];

            let items = [];
            for (const sel of selectors) {
                const elements = document.querySelectorAll(sel);
                if (elements.length > 0) {
                    elements.forEach(el => {
                        const titleEl = el.querySelector('h2, h3, h4, .title, a[class*="title"]') || el.querySelector('a');
                        const dateEl = el.querySelector('.date, time, [class*="date"], small');
                        const linkEl = el.querySelector('a[href]');
                        const pdfEl = el.querySelector('a[href$=".pdf"]');

                        const title = titleEl ? titleEl.textContent.trim() : '';
                        const href = pdfEl ? pdfEl.href : (linkEl ? linkEl.href : '');
                        const dateText = dateEl ? dateEl.textContent.trim() : '';

                        if (title && title.length > 5) {
                            items.push({ title, href, dateText, hasPdf: !!pdfEl });
                        }
                    });
                    break; // Use first matching selector
                }
            }

            return items.slice(0, 20);
        });

        for (const entry of entries) {
            const hashInput = `SDAIA|${entry.title}|${entry.href}`;
            const contentHash = crypto.createHash('sha256').update(hashInput).digest('hex');

            results.push({
                authority: 'SDAIA',
                title: entry.title,
                sourceUrl: entry.href || TARGET_URL,
                category: entry.hasPdf ? 'PDPL Enforcement' : 'AI Governance',
                publishDate: entry.dateText || null,
                contentHash,
                detectedAt: new Date().toISOString(),
            });
        }

        console.log(`[SDAIA] Scraped ${results.length} news entries from ${TARGET_URL}`);
    } catch (err) {
        console.error(`[SDAIA] Scraper error: ${err.message}`);
    } finally {
        if (page) await page.close().catch(() => { });
    }

    return results;
}

/**
 * Simulated SDAIA scraper for demo/testing.
 */
function scrapeSDAIADemo() {
    const news = [
        { title: 'SDAIA Issues Updated PDPL Implementation Guidelines for Financial Sector', category: 'PDPL Enforcement', date: '2026-03-01' },
        { title: 'National Data Governance Framework: Compliance Deadline Extended to Q2 2026', category: 'AI Governance', date: '2026-02-26' },
        { title: 'PDPL Penalty Notice: SAR 5M Fine for Cross-Border Data Transfer Violation', category: 'PDPL Enforcement', date: '2026-02-22' },
        { title: 'New AI Ethics Standards Published for Public Sector Deployment', category: 'AI Governance', date: '2026-02-18' },
        { title: 'Data Protection Officer Registration Portal Now Mandatory', category: 'PDPL Enforcement', date: '2026-02-14' },
    ];

    return news.map(n => {
        const hashInput = `SDAIA|${n.title}|${n.date}`;
        const contentHash = crypto.createHash('sha256').update(hashInput).digest('hex');
        return {
            authority: 'SDAIA',
            title: n.title,
            sourceUrl: 'https://sdaia.gov.sa/en/MediaCenter/News/',
            category: n.category,
            publishDate: n.date,
            contentHash,
            detectedAt: new Date().toISOString(),
        };
    });
}

module.exports = { scrapeSDAIA, scrapeSDAIADemo };
