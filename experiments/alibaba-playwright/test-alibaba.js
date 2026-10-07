// experiments/alibaba-playwright/test-alibaba.js
//
// الهدف: التحقق من إمكانية استخدام Alibaba عبر Playwright.
// لا يعدّل أي شيء في النظام الحالي.
// يطبع تقريرًا واضحًا بخمس نتائج + حالة القناة.

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SEARCH_TERM = process.argv.slice(2).join(' ') || 'stainless steel water tank 5000L';
const MAX_RESULTS = Math.max(1, Math.min(20, Number(process.env.MAX_RESULTS || 5)));
const NAV_TIMEOUT_MS = 45000;
const RESULT_WAIT_MS = 30000;

const ARTIFACT_DIR = path.join(__dirname, 'artifacts');
const PROFILE_DIR = path.join(__dirname, '.profile-real-browser');
const REQUESTED_BROWSER = (process.env.ALIBABA_BROWSER || 'chrome').toLowerCase();
const EXISTING_USER_DATA_DIR = process.env.CHROME_USER_DATA_DIR || '';
const EXISTING_PROFILE_DIR = process.env.CHROME_PROFILE_DIR || '';
fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
fs.mkdirSync(PROFILE_DIR, { recursive: true });

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
    if (EXISTING_USER_DATA_DIR) {
      log('browser', 'existing Chrome user-data directory requested');
      log('browser', 'IMPORTANT: close all Chrome windows before continuing to avoid profile lock/corruption risk');
    }

    const candidates =
      REQUESTED_BROWSER === 'edge' || REQUESTED_BROWSER === 'msedge'
        ? ['msedge', 'chrome', null]
        : REQUESTED_BROWSER === 'chromium'
          ? [null]
          : ['chrome', 'msedge', null];

    let context = null;
    let selectedBrowser = null;
    let lastLaunchError = null;

    for (const channel of candidates) {
      try {
        selectedBrowser = channel || 'chromium';
        log('browser', `trying real browser channel: ${selectedBrowser}`);
        const userDataDir = EXISTING_USER_DATA_DIR || PROFILE_DIR;
        const launchArgs = [];
        if (EXISTING_USER_DATA_DIR && EXISTING_PROFILE_DIR) {
          launchArgs.push('--profile-directory=' + EXISTING_PROFILE_DIR);
        }
        context = await chromium.launchPersistentContext(userDataDir, {
          channel: channel || undefined,
          headless: false,
          slowMo: 100,
          locale: 'en-US',
          viewport: { width: 1366, height: 900 },
          args: launchArgs
        });
        break;
      } catch (e) {
        lastLaunchError = e;
        log('browser', `failed with ${selectedBrowser}: ${e.message}`);
      }
    }

    if (!context) throw lastLaunchError || new Error('No supported browser channel could be launched');

    browser = context.browser();
    report.browserChannel = selectedBrowser;
    report.profileDir = EXISTING_USER_DATA_DIR || PROFILE_DIR;
    report.profileName = EXISTING_PROFILE_DIR || null;
    report.usingExistingProfile = !!EXISTING_USER_DATA_DIR;
    report.checks.browserLaunch = true;
    log('browser', `OK — using ${selectedBrowser} with dedicated persistent profile`);

    const pages = context.pages();
    const page = pages[0] || await context.newPage();

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
      bodyText.includes('please drag the slider to verify') ||
      bodyText.includes('punish')
    ) {
      report.checks.botOrCaptchaEncountered = true;
      log('guard', 'CAPTCHA / bot wall detected');
      log('guard', 'Solve the verification manually in the opened real browser. Waiting up to 180 seconds...');
      const verificationDeadline = Date.now() + 180000;
      while (Date.now() < verificationDeadline) {
        await page.waitForTimeout(3000);
        const t = (await page.content()).toLowerCase();
        const stillBlocked =
          t.includes('please drag the slider to verify') ||
          t.includes('verify to ensure normal access') ||
          t.includes('captcha') ||
          t.includes('unusual traffic');
        if (!stillBlocked) {
          log('guard', 'Verification appears cleared. Continuing with saved session.');
          break;
        }
      }
    }

    if (
      (bodyText.includes('sign in') || bodyText.includes('log in')) &&
      (bodyText.includes('password') || bodyText.includes('alibaba account'))
    ) {
      report.checks.loginEncountered = true;
      log('guard', 'Login wall possibly detected');
    }

    log('results', 'waiting for Alibaba results...');
    const selectors = [
      '.organic-gallery-offer-outter',
      '.fy23-search-card',
      '[data-content="productItem"]',
      '[class*="search-card"]',
      '[class*="offer"]'
    ];

    await page.waitForTimeout(5000);
    await page.mouse.wheel(0, 1400).catch(() => {});
    await page.waitForTimeout(2500);

    let cardsLoaded = false;
    for (const sel of selectors) {
      try {
        const count = await page.locator(sel).count();
        if (count > 0) {
          cardsLoaded = true;
          break;
        }
      } catch (_) {}
    }

    if (!cardsLoaded) {
      try {
        const productLinks = await page.locator('a[href*="/product-detail/"], a[href*="alibaba.com/product-detail"]').count();
        cardsLoaded = productLinks > 0;
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
      const found = await page.locator(sel).elementHandles();
      if (found.length > 0) {
        cards = found;
        report.selectorUsed = sel;
        report.resultCountDetected = found.length;
        log('results', `selector used: ${sel} (${found.length} cards)`);
        break;
      }
    }

    const results = [];
    if (cards.length > 0) {
      for (let i = 0; i < Math.min(cards.length, MAX_RESULTS); i++) {
        const card = cards[i];
        try {
          const title = await card
            .$eval('h2, .search-card-e-title, [class*="title"]', el => el.innerText.trim())
            .catch(() => null);
          const price = await card
            .$eval('.search-card-e-price-main, [class*="price"]', el => el.innerText.trim())
            .catch(() => null);
          const supplier = await card
            .$eval('.search-card-e-company, [class*="company"]', el => el.innerText.trim())
            .catch(() => null);
          const url = await card.$eval('a[href]', el => el.href).catch(() => null);
          if (title || url) results.push({ title, price, supplier, url });
        } catch (_) {}
      }
    }

    if (results.length < MAX_RESULTS) {
      const fallback = await page.evaluate((max) => {
        const links = [...document.querySelectorAll('a[href*="/product-detail/"], a[href*="alibaba.com/product-detail"]')];
        const seen = new Set();
        const out = [];
        for (const a of links) {
          const href = a.href;
          if (!href || seen.has(href)) continue;
          seen.add(href);
          let root = a;
          for (let i = 0; i < 5 && root && root.parentElement; i++, root = root.parentElement) {
            const txt = (root.innerText || '').trim();
            if (txt.length > 40) break;
          }
          const text = (root && root.innerText ? root.innerText : a.innerText || '').trim();
          const lines = text.split(/\n+/).map(x => x.trim()).filter(Boolean);
          const priceLine = lines.find(x => /(?:US\$|\$|USD)\s*[0-9]|[0-9].*(?:US\$|USD)/i.test(x)) || null;
          const companyLine = lines.find(x => /(?:Co\.,?\s*Ltd|Company|Factory|Manufacturer|Trading)/i.test(x)) || null;
          const title = (a.innerText || lines.find(x => x.length > 20) || '').trim() || null;
          out.push({ title, price: priceLine, supplier: companyLine, url: href });
          if (out.length >= max) break;
        }
        return out;
      }, MAX_RESULTS);

      for (const item of fallback) {
        if (results.length >= MAX_RESULTS) break;
        if (!results.some(x => x.url === item.url)) results.push(item);
      }
      if (fallback.length && !report.selectorUsed) report.selectorUsed = 'product-detail-link-fallback';
      report.resultCountDetected = Math.max(report.resultCountDetected, fallback.length);
    }

    report.checks.resultsDetected = results.length > 0;
    report.checks.selectorsStable = results.length >= Math.min(MAX_RESULTS, 5);
    report.results = results.slice(0, MAX_RESULTS);

    console.log('\n================ REPORT ================');
    console.log(JSON.stringify(report, null, 2));
    console.log('========================================\n');

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    const keepOpenMs = Math.max(0, Number(process.env.KEEP_OPEN_MS || 10000));
    if (keepOpenMs) {
      log('browser', `keeping browser open for ${keepOpenMs}ms for visual check...`);
      await page.waitForTimeout(keepOpenMs);
    }
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
