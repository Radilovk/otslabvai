/**
 * AEO/GEO edge layer — HTML + JSON-LD for crawlers without JavaScript.
 * Serves daotslabna.com, life-protocols.com, biocode-bg.com.
 */

/** @typedef {'main' | 'life' | 'portfolio'} SiteId */

export const BRAND_NETWORK = {
  sameAs: [
    'https://daotslabna.com/',
    'https://life-protocols.com/',
    'https://biocode-bg.com/',
    'https://github.com/Radilovk/otslabvai',
  ],
};

/** @type {Record<SiteId, object>} */
export const SITE_SEO = {
  main: {
    siteId: 'main',
    origin: 'https://daotslabna.com',
    name: 'ДА ОТСЛАБНА',
    description: 'Онлайн магазин за продукти за отслабване, контрол на теглото и здравословен начин на живот в България. Цени в EUR, доставка с наложен платеж.',
    currency: 'EUR',
    lang: 'bg',
    storeType: 'OnlineStore',
    productTemplate: '/product.html',
    homePaths: new Set(['/', '/index.html']),
    staticPaths: [
      '/about-us.html',
      '/contact.html',
      '/shipping.html',
      '/terms.html',
      '/policy.html',
      '/quest.html',
      '/faq.html',
      '/main-advisor-quiz.html',
    ],
    llmsIntro: 'ДА ОТСЛАБНА (daotslabna.com) — български онлайн магазин за отслабване и контрол на теглото. Цени в EUR, доставка в цяла България.',
    securityContact: 'radilov.k@gmail.com',
  },
  life: {
    siteId: 'life',
    origin: 'https://life-protocols.com',
    name: 'Life Protocols',
    description: 'Персонализирани anti-aging протоколи, хранителни добавки за дълголетие и клетъчна регенерация. AI персонален протокол, цени в EUR.',
    currency: 'EUR',
    lang: 'bg',
    storeType: 'OnlineStore',
    productTemplate: '/life-product.html',
    homePaths: new Set(['/', '/life.html']),
    staticPaths: [
      '/life-about.html',
      '/life-contact.html',
      '/life-protocol-quiz.html',
      '/faq.html',
    ],
    llmsIntro: 'Life Protocols (life-protocols.com) — anti-aging и longevity добавки с AI персонален протокол. Цени в EUR, доставка в България.',
    securityContact: 'office@biocode.com',
  },
  portfolio: {
    siteId: 'portfolio',
    origin: 'https://biocode-bg.com',
    name: 'BIOCODE Nutrition Science',
    description: 'B2B/B2C каталог за протеини, витамини и аминокиселини с доставка в България. Цени в EUR.',
    currency: 'EUR',
    lang: 'bg',
    storeType: 'OnlineStore',
    productTemplate: '/portfolio-product.html',
    homePaths: new Set(['/', '/portfolio.html']),
    staticPaths: [
      '/portfolio-advisor-quiz.html',
      '/faq.html',
    ],
    llmsIntro: 'BIOCODE Nutrition Science (biocode-bg.com) — каталог хранителни добавки за България. Цени в EUR.',
    securityContact: 'office@biocode.com',
  },
};

export const AI_CRAWLER_AGENTS = [
  'OAI-SearchBot',
  'ChatGPT-User',
  'GPTBot',
  'PerplexityBot',
  'Claude-SearchBot',
  'ClaudeBot',
  'anthropic-ai',
  'Google-Extended',
  'Googlebot',
  'bingbot',
  'Applebot-Extended',
];

export const ROBOTS_META = 'index, follow, max-snippet:-1';

/** EU Content Signals + Cloudflare Agent Readiness (AEO: allow search + RAG, block training). */
export const CONTENT_SIGNALS = 'search=yes,ai-input=yes,ai-train=no,use=reference';

export const ROBOTS_GLOBAL_DISALLOW = [
  '/admin.html',
  '/bioadmin.html',
  '/checkout.html',
  '/portfolio-checkout.html',
  '/life-checkout.html',
  '/backend/',
];

export const esc = (s = '') => String(s)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

export const slugify = (s = '') => String(s)
  .toLowerCase()
  .trim()
  .normalize('NFD')
  .replace(/\p{M}/gu, '')
  .replace(/[^\p{L}\p{N}]+/gu, '-')
  .replace(/^-|-$/g, '');

export function productSlugFromRecord(product) {
  if (product.slug) return product.slug;
  const name = product.title || product.name || product.public_data?.name || '';
  const fromName = slugify(name);
  if (fromName) return fromName;
  return String(product.id || product.product_id || '').replace(/^prod-/, '');
}

export function productUrl(site, product) {
  const slug = productSlugFromRecord(product);
  return `${site.origin}/products/${slug}`;
}

export function orgJsonLd(site) {
  return {
    '@context': 'https://schema.org',
    '@type': site.storeType === 'Organization' ? 'Organization' : 'OnlineStore',
    '@id': `${site.origin}/#organization`,
    name: site.name,
    url: site.origin,
    description: site.description,
    inLanguage: site.lang,
    areaServed: { '@type': 'Country', name: 'Bulgaria' },
    sameAs: BRAND_NETWORK.sameAs,
  };
}

export function productJsonLd(site, product) {
  const url = productUrl(site, product);
  /** @type {Record<string, unknown>} */
  const payload = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${url}#product`,
    name: product.title,
    description: product.description || '',
    ...(product.image ? { image: [product.image] } : {}),
    ...(product.category ? { category: product.category } : {}),
    ...(product.id ? { sku: String(product.id) } : {}),
    brand: { '@type': 'Brand', name: site.name },
  };

  if (product.price != null && product.price > 0) {
    payload.offers = {
      '@type': 'Offer',
      url,
      price: product.price,
      priceCurrency: site.currency,
      availability: product.inStock !== false
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      seller: { '@id': `${site.origin}/#organization` },
    };
  }

  return payload;
}

export function itemListJsonLd(site, products) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Каталог — ${site.name}`,
    numberOfItems: products.length,
    itemListElement: products.slice(0, 100).map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: productUrl(site, p),
      name: p.title,
    })),
  };
}

export function ldTag(obj) {
  return `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;
}

export function renderCatalogHtml(site, products) {
  const byCategory = products.reduce((acc, p) => {
    const cat = p.category || 'Продукти';
    (acc[cat] ||= []).push(p);
    return acc;
  }, {});

  const sections = Object.entries(byCategory).map(([cat, items]) => {
    const rows = items.map((p) => {
      const priceCell = p.price != null && p.price > 0
        ? `${esc(p.price)} ${esc(site.currency)}`
        : '—';
      return `<tr>
<td><a href="${esc(productUrl(site, p))}">${esc(p.title)}</a></td>
<td>${priceCell}</td>
<td>${p.inStock !== false ? 'В наличност' : 'Изчерпан'}</td>
<td>${esc((p.description || '').slice(0, 220))}</td>
</tr>`;
    }).join('\n');

    return `<section>
<h2>${esc(cat)}</h2>
<table>
<thead><tr><th>Продукт</th><th>Цена</th><th>Наличност</th><th>Описание</th></tr></thead>
<tbody>
${rows}
</tbody>
</table>
</section>`;
  }).join('\n');

  const updated = new Date().toISOString().slice(0, 10);

  return `<div id="seo-catalog" data-prerendered="1">
<h1>${esc(site.name)} — каталог</h1>
<p>${esc(site.description)} Общо ${products.length} продукта.</p>
${sections}
<p><small>Последно обновяване: ${updated}</small></p>
</div>`;
}

export function renderProductHtml(site, product) {
  const priceLine = product.price != null && product.price > 0
    ? `${esc(product.price)} ${esc(site.currency)}`
    : '—';
  const stock = product.inStock !== false ? 'В наличност' : 'Изчерпан';

  return `<article id="seo-product" data-prerendered="1">
<h1>${esc(product.title)}</h1>
<p><strong>Цена:</strong> ${priceLine}
 · <strong>Наличност:</strong> ${stock}${product.category ? `
 · <strong>Категория:</strong> ${esc(product.category)}` : ''}</p>
<p>${esc(product.description || '')}</p>
</article>`;
}

export function productIdScript(product) {
  const id = product.legacyId || product.id || product.product_id || '';
  if (!id) return '';
  return `<script>window.__SEO_PRODUCT_ID=${JSON.stringify(String(id))};</script>`;
}

class HeadBodyEnhancer {
  constructor({ head = [], body = [], canonical = null, robotsContent = ROBOTS_META }) {
    this.head = head;
    this.body = body;
    this.canonical = canonical;
    this.robotsContent = robotsContent;
    this.foundCanonical = false;
    this.foundRobots = false;
    this.skipRobots = false;
  }

  headElement(el) {
    for (const h of this.head) el.append(h, { html: true });
    if (this.canonical && !this.foundCanonical) {
      el.append(`<link rel="canonical" href="${esc(this.canonical)}">`, { html: true });
    }
    if (!this.foundRobots && !this.skipRobots) {
      el.append(`<meta name="robots" content="${esc(this.robotsContent)}">`, { html: true });
    }
  }

  canonicalElement(el) {
    this.foundCanonical = true;
    if (this.canonical) el.setAttribute('href', this.canonical);
  }

  robotsElement(el) {
    this.foundRobots = true;
    const current = el.getAttribute('content') || '';
    if (/noindex/i.test(current)) {
      this.skipRobots = true;
      return;
    }
    el.setAttribute('content', this.robotsContent);
  }

  bodyElement(el) {
    for (const b of this.body) el.prepend(b, { html: true });
  }
}

export function injectSeo(response, options = {}) {
  const enhancer = new HeadBodyEnhancer(options);
  // @ts-ignore HTMLRewriter is a Cloudflare Workers runtime global
  return new HTMLRewriter()
    .on('head', { element: (el) => enhancer.headElement(el) })
    .on('link[rel="canonical"]', { element: (el) => enhancer.canonicalElement(el) })
    .on('meta[name="robots"]', { element: (el) => enhancer.robotsElement(el) })
    .on('body', { element: (el) => enhancer.bodyElement(el) })
    .transform(response);
}

export function robotsTxt(site) {
  const adminDisallow = 'Disallow: /admin.html\nDisallow: /bioadmin.html\n';
  const blocks = AI_CRAWLER_AGENTS
    .map((ua) => `User-agent: ${ua}\nAllow: /\n${adminDisallow}`)
    .join('\n');

  const globalDisallow = ROBOTS_GLOBAL_DISALLOW.map((p) => `Disallow: ${p}`).join('\n');

  return `# AI search optimized — 2026
# Content Signals: search + ai-input allowed; ai-train blocked (EU 2019/790)

User-agent: *
Content-Signal: ${CONTENT_SIGNALS}
Allow: /
Allow: /llms.txt
Allow: /llms-full.txt
Allow: /.well-known/
Allow: /auth.md
Allow: /a2a/v1
${globalDisallow}

${blocks}
User-agent: CCBot
Disallow: /

Sitemap: ${site.origin}/sitemap.xml
Agentmap: ${site.origin}/.well-known/ai-catalog.json
`;
}

export function sitemapXml(site, products, extraPaths = []) {
  const today = new Date().toISOString().slice(0, 10);
  const paths = new Set(extraPaths);
  for (const p of site.staticPaths || []) paths.add(p);
  for (const p of site.homePaths || []) paths.add(p);

  const urls = [
    ...Array.from(paths).map((p) => {
      const loc = p.startsWith('http') ? p : `${site.origin}${p === '/' ? '/' : p}`;
      return { loc, pri: (p === '/' || site.homePaths?.has(p)) ? '1.0' : '0.6' };
    }),
    ...products.map((p) => ({ loc: productUrl(site, p), pri: '0.8' })),
  ];

  const seen = new Set();
  const unique = urls.filter((u) => {
    if (seen.has(u.loc)) return false;
    seen.add(u.loc);
    return true;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${unique.map((u) => `  <url><loc>${esc(u.loc)}</loc><lastmod>${today}</lastmod><priority>${u.pri}</priority></url>`).join('\n')}
</urlset>`;
}

export function llmsTxt(site, products) {
  const lines = [
    `# ${site.name}`,
    '',
    `> ${site.llmsIntro || site.description}`,
    '',
    '## Основни страници',
    `- [Начало](${site.origin}/): ${site.description.slice(0, 120)}`,
    `- [FAQ](${site.origin}/faq.html): Често задавани въпроси за ${site.name}`,
    `- [Sitemap](${site.origin}/sitemap.xml): Пълен списък URL`,
    `- [API catalog](${site.origin}/.well-known/api-catalog): Machine-readable API discovery (RFC 9727)`,
    `- [llms-full.txt](${site.origin}/llms-full.txt): Разширен каталог за AI агенти`,
    '',
    '## Мрежа от сайтове',
    ...BRAND_NETWORK.sameAs.map((url) => `- ${url}`),
    '',
    `## Каталог (${products.length} продукта, обновено ${new Date().toISOString().slice(0, 10)})`,
    '',
  ];

  for (const p of products.slice(0, 80)) {
    lines.push(`- [${p.title}](${productUrl(site, p)}): ${(p.description || '').slice(0, 120)}`);
  }

  if (products.length > 80) {
    lines.push(`- … още ${products.length - 80} — виж ${site.origin}/sitemap.xml`);
  }

  lines.push('', '## За AI системи', '');
  lines.push('- Цените са в EUR, освен ако на страницата е посочено друго.');
  lines.push('- Български език, доставка в цяла България, плащане с наложен платеж.');
  lines.push(`- Официален домейн: ${site.origin}`);
  lines.push(`- Content-Signal: ${CONTENT_SIGNALS}`);

  return `${lines.join('\n')}\n`;
}

/** Extended llms.txt — full product list for agent ingestion. */
export function llmsFullTxt(site, products) {
  const lines = [
    `# ${site.name} — llms-full.txt`,
    '',
    `> ${site.llmsIntro || site.description}`,
    '',
    '## Основни страници',
    `- [Начало](${site.origin}/): ${site.description}`,
    `- [FAQ](${site.origin}/faq.html): Често задавани въпроси`,
    `- [Sitemap](${site.origin}/sitemap.xml)`,
    `- [API catalog](${site.origin}/.well-known/api-catalog)`,
    '',
    `## Пълен каталог (${products.length} продукта, ${new Date().toISOString().slice(0, 10)})`,
    '',
  ];

  for (const p of products) {
    lines.push(`- [${p.title}](${productUrl(site, p)}): ${(p.description || '').slice(0, 240)}`);
  }

  lines.push('', '## За AI системи', '');
  lines.push(`- Content-Signal: ${CONTENT_SIGNALS}`);
  lines.push(`- Източник: ${site.origin}`);

  return `${lines.join('\n')}\n`;
}

export function buildSlugIndex(products) {
  const map = new Map();
  for (const p of products) {
    map.set(productSlugFromRecord(p), p);
  }
  return map;
}

export function isCatalogHomePath(site, pathname) {
  const path = pathname.split('?')[0] || '/';
  return site.homePaths?.has(path) || site.homePaths?.has(path.replace(/\/$/, '') || '/');
}

export function publicCanonical(site, pathname) {
  const path = pathname.split('?')[0] || '/';
  if (path === '/' || path === '') return `${site.origin}/`;
  return `${site.origin}${path}`;
}
