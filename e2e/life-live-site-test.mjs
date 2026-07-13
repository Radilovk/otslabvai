#!/usr/bin/env node
/**
 * Real-site smoke test for daotslabna.com/life.html (mobile viewport).
 */
import { chromium } from 'playwright';

const URL = process.env.LIFE_TEST_URL || 'https://daotslabna.com/life.html';
const fails = [];

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  });
  const page = await context.newPage();

  await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForSelector('.hero-content h1', { timeout: 30000 });

  const cssHref = await page.$eval('link[href*="life.css"]', (el) => el.getAttribute('href'));
  if (!cssHref?.includes('20260713d')) {
    fails.push(`Cache bust not updated (expected 20260713d): ${cssHref}`);
  }

  const h1Color = await page.$eval('.hero-content h1', (el) => {
    const s = getComputedStyle(el);
    return {
      color: s.color,
      fill: s.webkitTextFillColor,
      bg: s.backgroundImage,
    };
  });
  if (h1Color.fill === 'rgba(0, 0, 0, 0)' || h1Color.fill === 'transparent') {
    fails.push(`Hero h1 has transparent fill: ${JSON.stringify(h1Color)}`);
  }
  const rgb = h1Color.color.match(/\d+/g)?.map(Number) || [];
  if (rgb.length >= 3 && rgb[0] > 200 && rgb[1] < 120 && rgb[2] > 150) {
    fails.push(`Hero h1 looks pink/warm: ${h1Color.color}`);
  }

  const headerBox1 = await page.$eval('.main-header', (el) => el.getBoundingClientRect().height);
  await page.evaluate(() => window.scrollTo(0, 200));
  await page.waitForTimeout(400);
  const headerBox2 = await page.$eval('.main-header', (el) => el.getBoundingClientRect().height);
  if (Math.abs(headerBox1 - headerBox2) > 2) {
    fails.push(`Header height jumped: ${headerBox1} → ${headerBox2}`);
  }

  const logoSrc = await page.$eval('#header-logo-img', (el) => el.src);
  if (!logoSrc.includes('life-icons/logo')) {
    fails.push(`Header logo not frosted icon: ${logoSrc}`);
  }

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1200);
  const footerLogo = await page.$eval('#footer-logo-img', (el) => ({
    src: el.src,
    visible: el.offsetWidth > 0 && el.offsetHeight > 0,
    natural: el.naturalWidth,
  })).catch(() => ({ visible: false, src: 'missing' }));
  if (!footerLogo.visible || footerLogo.natural === 0) {
    fails.push(`Footer logo not visible: ${JSON.stringify(footerLogo)}`);
  }

  const docWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  const viewWidth = await page.evaluate(() => window.innerWidth);
  if (docWidth > viewWidth + 2) {
    fails.push(`Horizontal overflow: doc=${docWidth} viewport=${viewWidth}`);
  }

  const pinkElements = await page.evaluate(() => {
    const bad = [];
    document.querySelectorAll('h1,h2,h3,h4,p,a,span,strong').forEach((el) => {
      const c = getComputedStyle(el).color;
      const m = c.match(/(\d+)/g);
      if (!m || m.length < 3) return;
      const [r, g, b] = m.map(Number);
      if (r > 210 && g < 140 && b > 140 && el.offsetParent !== null) {
        bad.push({ tag: el.tagName, text: el.textContent?.slice(0, 40), color: c });
      }
    });
    return bad.slice(0, 5);
  });
  if (pinkElements.length) {
    fails.push(`Pink-ish text found: ${JSON.stringify(pinkElements)}`);
  }

  await browser.close();

  if (fails.length) {
    console.error('FAILURES:');
    fails.forEach((f) => console.error(' -', f));
    process.exit(1);
  }
  console.log('OK: daotslabna.com/life.html mobile checks passed');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
