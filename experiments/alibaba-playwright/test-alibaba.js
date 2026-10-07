// experiments/alibaba-playwright/test-alibaba.js
//
// الهدف: التحقق من إمكانية استخدام Alibaba عبر Playwright.
// لا يعدّل أي شيء في النظام الحالي.
// يطبع تقريرًا واضحًا بخمس نتائج + حالة القناة.

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SEARCH_TERM = process.argv.slice(2).join(' ') || 'stainless steel water tank 5000L';
const MAX_RESULTS = 5;
const NAV_TIMEOUT_MS = 45000;
const RESULT_WAIT_MS = 30000;

const ARTIFACT_DIR = path.join(__dirname, 'artifacts');
fs.mkdirSync(ARTIFACT_DIR, { recursive: true });

function log(section, msg) {
  console.log(`[${section}] ${msg}`);
}

async function main() {
  const report = {
    startedAt: new Date().toISOString(),
    searchTerm: SEARCH_TERM,
    checks: {
      browserLaunch: false,
      navigationSuccess: false,
      searchPageLoaded: false,
      resultsDetected: false,
      selectorsStable: false,
      botOrCaptchaEncountered: false,
      loginEncountered: false,
    },
    selectorUsed: null,
    resultCountDetected: 0,
    finalUrl: null,
    pageTitle: null,
    artifacts: {},
    results: [],
    error: null,
  };

  let browser;
  try {
    log('browser', 'launching chromium (headful for first run)...');
    browser = await chromium.launch({
      headless: false,
      slowMo: 100,
    });
    report.checks.browserLaunch = true;
    log('browser', 'OK');

    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      locale: 'en-US',
      viewport: { width: 1366, height: 900 },
    });

    const page = await context.newPage();

    const searchUrl =
      'https://www.alibaba.com/trade/search?SearchText=' +
      encodeURIComponent(SEARCH_TERM);

    log('nav', `going to: ${searchUrl}`);
    const resp = await page.goto(searchUrl, {
      waitUntil: 'domcontentloaded',
      timeout: NAV_TIMEOUT_MS,
    });

    report.checks.navigationSuccess = !!resp && resp.status() < 400;
    report.finalUrl = page.url();
    report.pageTitle = await page.title().catch(() => null);
    log('nav', `status=${resp ? resp.status() : 'no-response'}`);

    const html = await page.content();
    const bodyText = html.toLowerCase();

    if (
      bodyText.includes('captcha') ||
      bodyText.includes('unusual traffic') ||
      bodyText.includes('verify you are human') ||
      bodyText.includes('punish')
    ) {
      report.checks.botOrCaptchaEncountered = true;
      log('guard', 'CAPTCHA / bot wall detected');
    }

    if (
      (bodyText.includes('sign in') || bodyText.includes('log in')) &&
      (bodyText.includes('password') || bodyText.includes('alibaba account'))
    ) {
      report.checks.loginEncountered = true;
      log('guard', 'Login wall possibly detected');
    }

    log('results', 'waiting for result cards...');
    const selectors = [
      '.organic-gallery-offer-outter',
      '.fy23-search-card',
      '[data-content="productItem"]',
    ];

    let cardsLoaded = false;
    for (const sel of selectors) {
      try {
        await page.waitForSelector(sel, { timeout: Math.ceil(RESULT_WAIT_MS / selectors.length) });
        cardsLoaded = true;
        break;
      } catch (_) {}
    }
    report.checks.searchPageLoaded = cardsLoaded;

    const stamp = Date.now();
    const screenshotPath = path.join(ARTIFACT_DIR, `alibaba-${stamp}.png`);
    const htmlPath = path.join(ARTIFACT_DIR, `alibaba-${stamp}.html`);
    const reportPath = path.join(ARTIFACT_DIR, `report-${stamp}.json`);

    await page.screenshot({ path: screenshotPath, fullPage: false });
    fs.writeFileSync(htmlPath, await page.content());
    report.artifacts = { screenshotPath, htmlPath, reportPath };
    log('artifact', `screenshot: ${screenshotPath}`);
    log('artifact', `html:       ${htmlPath}`);

    let cards = [];
    for (const sel of selectors) {
      const found = await page.$$(sel);
      if (found.length > 0) {
        cards = found;
        report.selectorUsed = sel;
        report.resultCountDetected = found.length;
        log('results', `selector used: ${sel} (${found.length} cards)`);
        break;
      }
    }

    report.checks.resultsDetected = cards.length > 0;
    report.checks.selectorsStable = cards.length >= MAX_RESULTS;

    const results = [];
    for (let i = 0; i < Math.min(cards.length, MAX_RESULTS); i++) {
      const card = cards[i];
      try {
        const title = await card
          .$eval(
            'h2, .search-card-e-title, [class*="title"]',
            (el) => el.innerText.trim()
          )
          .catch(() => null);

        const price = await card
          .$eval(
            '.search-card-e-price-main, [class*="price"]',
            (el) => el.innerText.trim()
          )
          .catch(() => null);

        const supplier = await card
          .$eval(
            '.search-card-e-company, [class*="company"]',
            (el) => el.innerText.trim()
          )
          .catch(() => null);

        const url = await card
          .$eval('a', (el) => el.href)
          .catch(() => null);

        results.push({ title, price, supplier, url });
      } catch (e) {
        results.push({ error: String(e) });
      }
    }

    report.results = results;

    console.log('\n================ REPORT ================');
    console.log(JSON.stringify(report, null, 2));
    console.log('========================================\n');

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    log('browser', 'keeping browser open for 10s for visual check...');
    await page.waitForTimeout(10000);
  } catch (err) {
    report.error = err && err.stack ? err.stack : String(err);
    console.error('\n[ERROR]', err);
    try {
      const stamp = Date.now();
      fs.writeFileSync(
        path.join(ARTIFACT_DIR, `report-error-${stamp}.json`),
        JSON.stringify(report, null, 2)
      );
    } catch (_) {}
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

main();
