/**
 * Deep layout audit – detects overflow, horizontal scroll, image issues.
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';

const BASE = process.env.PORTFOLIO_URL || 'http://127.0.0.1:8790';
const OUT = '/opt/cursor/artifacts/portfolio-audit';
mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { name: 'iphone-se', width: 320, height: 568 },
  { name: 'iphone-14', width: 390, height: 844 },
  { name: 'iphone-14-pro-max', width: 430, height: 932 },
  { name: 'ipad', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'desktop-wide', width: 1920, height: 1080 },
];

const PAGES = [
  { path: '/portfolio.html', wait: '.pf-product-card', name: 'catalog' },
  { path: '/portfolio-product.html?group_id=18390', wait: '.pf-product-info h1', name: 'product' },
  { path: '/portfolio-checkout.html', wait: '#checkout-form', name: 'checkout' },
];

async function auditPage(page, vp, pageInfo) {
  const issues = [];
  await page.goto(`${BASE}${pageInfo.path}`, { waitUntil: 'networkidle' });
  try {
    await page.waitForSelector(pageInfo.wait, { timeout: 12000 });
  } catch {
    issues.push(`Page did not load: ${pageInfo.wait}`);
  }
  await page.waitForTimeout(800);

  const metrics = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const scrollW = document.documentElement.scrollWidth;
    const overflows = [];
    document.querySelectorAll('*').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return;
      if (r.right > vw + 2) {
        const cls = el.className?.toString?.() || el.tagName;
        if (typeof cls === 'string' && cls.length < 80) {
          overflows.push({ cls, right: Math.round(r.right), vw, w: Math.round(r.width) });
        }
      }
    });
    const imgs = [...document.querySelectorAll('img')].map((img) => {
      const r = img.getBoundingClientRect();
      const p = img.parentElement?.getBoundingClientRect();
      return {
        src: img.src?.slice(-40),
        w: Math.round(r.width),
        h: Math.round(r.height),
        parentW: p ? Math.round(p.width) : 0,
        overflowsParent: p ? r.width > p.width + 2 : false,
        overflowsViewport: r.width > vw + 2,
        naturalW: img.naturalWidth,
        naturalH: img.naturalHeight,
      };
    });
    return {
      vw,
      scrollW,
      hasHScroll: scrollW > vw + 1,
      overflows: overflows.slice(0, 15),
      imgs: imgs.filter((i) => i.w > 0),
    };
  });

  if (metrics.hasHScroll) {
    issues.push(`HORIZONTAL SCROLL: scrollWidth=${metrics.scrollW} > viewport=${metrics.vw}`);
  }
  metrics.overflows.forEach((o) => {
    issues.push(`Overflow: .${o.cls} width=${o.w} right=${o.right} > vw=${o.vw}`);
  });
  metrics.imgs.filter((i) => i.overflowsViewport).forEach((i) => {
    issues.push(`Image overflows viewport: ${i.w}px wide (vw=${metrics.vw})`);
  });
  metrics.imgs.filter((i) => i.overflowsParent).forEach((i) => {
    issues.push(`Image overflows parent: ${i.w}px > parent ${i.parentW}px`);
  });

  await page.screenshot({ path: `${OUT}/${vp.name}-${pageInfo.name}.png`, fullPage: true });

  return { vp: vp.name, page: pageInfo.name, issues, imgCount: metrics.imgs.length, metrics };
}

const browser = await chromium.launch();
const all = [];

for (const vp of VIEWPORTS) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await context.newPage();
  for (const p of PAGES) {
    all.push(await auditPage(page, vp, p));
  }
  await context.close();
}

await browser.close();

const report = all.map((r) => ({
  viewport: r.vp,
  page: r.page,
  issues: r.issues,
  images: r.imgCount,
}));
writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));

console.log('\n=== LAYOUT AUDIT ===\n');
let total = 0;
for (const r of report) {
  if (r.issues.length) {
    console.log(`\n[${r.viewport}] ${r.page}:`);
    r.issues.forEach((i) => { console.log('  ✗', i); total++; });
  }
}
if (!total) console.log('No issues found');
else console.log(`\nTotal issues: ${total}`);
process.exit(total > 0 ? 1 : 0);
