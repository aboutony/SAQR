// ============================================
// SAQR Sentinel - SDAIA News Scraper
// Headless Playwright scraper for:
// https://sdaia.gov.sa/en/MediaCenter/News/
// Targets PDPL enforcement circulars and AI governance updates
// ============================================

const crypto = require('crypto');

/**
 * SDAIA News/PDPL scraper.
 * Uses Playwright to navigate the SDAIA media center
 * and extract news headlines plus PDF links.
 *
 * @param {import('playwright').Browser} browser - Playwright browser instance
 * @param {{ logger?: object }} [options]
 * @returns {Promise<Array<{authority: string, title: string, sourceUrl: string, category: string, publishDate: string, contentHash: string, detectedAt: string}>>}
 */
async function scrapeSDAIA(browser, options = {}) {
    const TARGET_URL = 'https://sdaia.gov.sa/en/MediaCenter/News/';
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

        await page.waitForSelector('.news-item, .card, article, .media-item', { timeout: 15000 }).catch(() => {
            logger?.warn('scrape.source_structure_warning', {
                authority: 'SDAIA',
                sourceUrl: TARGET_URL,
                reason: 'No news grid found; source structure may have changed.',
            });
        });

        const entries = await page.evaluate(() => {
            const selectors = [
                '.news-item', '.card', 'article', '.media-item',
                '.news-list li', '.blog-post', '[class*="news"]',
            ];

            const items = [];
            for (const selector of selectors) {
                const elements = document.querySelectorAll(selector);
                if (elements.length === 0) {
                    continue;
                }

                elements.forEach((element) => {
                    const titleEl = element.querySelector('h2, h3, h4, .title, a[class*="title"]') || element.querySelector('a');
                    const dateEl = element.querySelector('.date, time, [class*="date"], small');
                    const linkEl = element.querySelector('a[href]');
                    const pdfEl = element.querySelector('a[href$=".pdf"]');

                    const title = titleEl ? titleEl.textContent.trim() : '';
                    const href = pdfEl ? pdfEl.href : (linkEl ? linkEl.href : '');
                    const dateText = dateEl ? dateEl.textContent.trim() : '';

                    if (title && title.length > 5) {
                        items.push({ title, href, dateText, hasPdf: Boolean(pdfEl) });
                    }
                });
                break;
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

        logger?.info('scrape.source_completed', {
            authority: 'SDAIA',
            sourceUrl: TARGET_URL,
            resultCount: results.length,
        });
    } catch (err) {
        logger?.error('scrape.source_failed', err, {
            authority: 'SDAIA',
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

    return news.map((entry) => {
        const hashInput = `SDAIA|${entry.title}|${entry.date}`;
        const contentHash = crypto.createHash('sha256').update(hashInput).digest('hex');
        return {
            authority: 'SDAIA',
            title: entry.title,
            sourceUrl: 'https://sdaia.gov.sa/en/MediaCenter/News/',
            category: entry.category,
            publishDate: entry.date,
            contentHash,
            detectedAt: new Date().toISOString(),
        };
    });
}

module.exports = { scrapeSDAIA, scrapeSDAIADemo };
