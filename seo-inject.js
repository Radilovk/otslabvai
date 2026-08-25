/**
 * AEO/SEO edge layer — HTML + JSON-LD generation for crawlers without JavaScript.
 */

import { PEPTIDES_CATALOG } from './peptides-catalog.js';

/** @typedef {'main' | 'life' | 'portfolio' | 'peptides'} SiteId */

/** Apex host per site — canonical URLs always use these, not www. */
export const CANONICAL_HOST = {
  main: 'daotslabna.com',
  life: 'life-protocols.com',
  portfolio: 'biocode-bg.com',
  peptides: 'biocode-peptides.com',
};

/** www → apex 301 (8 hosts → 4 canonical). */
export const WWW_TO_APEX = {
  'www.daotslabna.com': 'daotslabna.com',
  'www.life-protocols.com': 'life-protocols.com',
  'www.biocode-bg.com': 'biocode-bg.com',
  'www.biocode-peptides.com': 'biocode-peptides.com',
};

/** Retail ecosystem — peptides intentionally excluded (YMYL isolation). */
export const RETAIL_SAME_AS = [
  'https://daotslabna.com/',
  'https://life-protocols.com/',
  'https://biocode-bg.com/',
  'https://github.com/Radilovk/otslabvai',
];

/** Peptides stands alone — no cross-link to supplement storefronts. */
export const PEPTIDES_SAME_AS = [
  'https://biocode-peptides.com/',
  'https://www.linkedin.com/company/biocode-peptides',
];

/** @deprecated use RETAIL_SAME_AS / getSameAsForSite */
export const BRAND_NETWORK = { sameAs: RETAIL_SAME_AS };

export function getSameAsForSite(siteId) {
  return siteId === 'peptides' ? PEPTIDES_SAME_AS : RETAIL_SAME_AS;
}

/**
 * Build per-request site context with canonical origin from siteId (not from Host typo).
 * Injection uses this for all requests — never branch on User-Agent (anti-cloaking).
 */
export function resolveSiteContext(siteId) {
  const base = SITE_SEO[siteId];
  if (!base) return null;
  const canonicalHost = CANONICAL_HOST[siteId];
  return {
    ...base,
    origin: `https://${canonicalHost}`,
    canonicalHost,
  };
}

/** @returns {string|null} redirect target URL for www hosts */
export function wwwToApexRedirectUrl(url) {
  const apex = WWW_TO_APEX[String(url.hostname || '').toLowerCase()];
  if (!apex) return null;
  const target = new URL(url.toString());
  target.protocol = 'https:';
  target.hostname = apex;
  return target.toString();
}

/** @type {Record<SiteId, object>} */
export const SITE_SEO = {
  main: {
    siteId: 'main',
    origin: 'https://daotslabna.com',
    name: 'ДА ОТСЛАБНА',
    description: 'Онлайн магазин за продукти за отслабване, контрол на теглото и здравословен начин на живот.',
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
      '/main-advisor-quiz.html',
    ],
    llmsIntro: 'ДА ОТСЛАБНА (daotslabna.com) — български онлайн магазин за отслабване и контрол на теглото. Цени в EUR.',
  },
  life: {
    siteId: 'life',
    origin: 'https://life-protocols.com',
    name: 'Life Protocols',
    description: 'Персонализирани anti-aging протоколи, хранителни добавки за дълголетие и клетъчна регенерация.',
    currency: 'EUR',
    lang: 'bg',
    storeType: 'OnlineStore',
    productTemplate: '/life-product.html',
    homePaths: new Set(['/', '/index.html', '/life.html']),
    staticPaths: [
      '/life-about.html',
      '/life-contact.html',
      '/life-checkout.html',
      '/life-protocol-quiz.html',
    ],
    llmsIntro: 'Life Protocols (life-protocols.com) — anti-aging и longevity добавки с AI персонален протокол. Цени в EUR.',
  },
  portfolio: {
    siteId: 'portfolio',
    origin: 'https://biocode-bg.com',
    name: 'BIOCODE Nutrition Science',
    description: 'B2B/B2C каталог за протеини, витамини и аминокиселини с доставка в България.',
    currency: 'EUR',
    lang: 'bg',
    storeType: 'OnlineStore',
    productTemplate: '/portfolio-product.html',
    homePaths: new Set(['/', '/index.html', '/portfolio.html']),
    staticPaths: [
      '/portfolio-checkout.html',
      '/portfolio-advisor-quiz.html',
    ],
    llmsIntro: 'BIOCODE Nutrition Science (biocode-bg.com) — каталог хранителни добавки за България. Цени в EUR.',
  },
  peptides: {
    siteId: 'peptides',
    origin: 'https://biocode-peptides.com',
    name: 'BioCode Peptides',
    description: 'US-based research peptide manufacturer in Cambridge, MA. High-purity, third-party verified peptides for laboratory research use only.',
    currency: 'USD',
    lang: 'en',
    storeType: 'Organization',
    productTemplate: '/biocode/products.html',
    assetPrefix: '/biocode',
    homePaths: new Set(['/', '/index.html', '/biocode/index.html']),
    staticPaths: [
      '/about.html',
      '/science.html',
      '/quality.html',
      '/products.html',
      '/contact.html',
      '/biocode/about.html',
      '/biocode/science.html',
      '/biocode/quality.html',
      '/biocode/products.html',
      '/biocode/contact.html',
    ],
    llmsIntro: 'BioCode Peptides (biocode-peptides.com) — research-use-only peptides, HPLC/MS verified, Cambridge MA USA.',
  },
};

export const AI_CRAWLER_AGENTS = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-User',
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended',
  'Googlebot',
  'bingbot',
  'Applebot-Extended',
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
  const orgId = `${site.origin}/#organization`;
  return {
    '@context': 'https://schema.org',
    '@type': site.storeType === 'Organization' ? 'Organization' : 'OnlineStore',
    '@id': orgId,
    name: site.name,
    url: site.origin,
    description: site.description,
    inLanguage: site.lang,
    ...(site.siteId !== 'peptides' ? { areaServed: { '@type': 'Country', name: 'Bulgaria' } } : {
      foundingDate: '2013',
      address: {
        '@type': 'PostalAddress',
        streetAddress: '100 Cambridge Research Parkway, Suite 400',
        addressLocality: 'Cambridge',
        addressRegion: 'MA',
        postalCode: '02142',
        addressCountry: 'US',
      },
    }),
    sameAs: getSameAsForSite(site.siteId),
  };
}

/** Peptides: Product schema without Offer — RUO, no commercial health claims. */
export function peptidesResearchJsonLd(site, product) {
  const url = productUrl(site, product);
  const props = [
    { '@type': 'PropertyValue', name: 'Intended use', value: 'Research use only (RUO). Not for human or veterinary consumption.' },
  ];
  if (product.purity) {
    props.push({ '@type': 'PropertyValue', name: 'Typical purity (HPLC)', value: product.purity });
  }
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${url}#product`,
    name: product.title,
    description: `Laboratory research material. ${product.description || ''}`.trim(),
    category: 'Research chemical (RUO)',
    brand: { '@type': 'Brand', name: site.name },
    audience: {
      '@type': 'PeopleAudience',
      audienceType: 'Qualified laboratory researchers',
    },
    additionalProperty: props,
  };
}

export function productJsonLd(site, product) {
  if (site.siteId === 'peptides') {
    return peptidesResearchJsonLd(site, product);
  }

  const url = productUrl(site, product);
  const orgId = `${site.origin}/#organization`;
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
      seller: { '@id': orgId },
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
    itemListElement: products.map((p, i) => ({
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
    const cat = p.category || (site.lang === 'bg' ? 'Продукти' : 'Products');
    (acc[cat] ||= []).push(p);
    return acc;
  }, {});

  const sections = Object.entries(byCategory).map(([cat, items]) => {
    const rows = items.map((p) => {
      const priceCell = p.price != null && p.price > 0
        ? `${esc(p.price)} ${esc(site.currency)}`
        : (p.purity ? esc(p.purity) : '—');
      return `<tr>
<td><a href="${esc(productUrl(site, p))}">${esc(p.title)}</a></td>
<td>${priceCell}</td>
<td>${p.inStock !== false ? (site.lang === 'bg' ? 'В наличност' : 'Available') : (site.lang === 'bg' ? 'Изчерпан' : 'Unavailable')}</td>
<td>${esc((p.description || '').slice(0, 220))}</td>
</tr>`;
    }).join('\n');

    return `<section>
<h2>${esc(cat)}</h2>
<table>
<thead><tr><th>${site.lang === 'bg' ? 'Продукт' : 'Product'}</th><th>${site.lang === 'bg' ? 'Цена' : 'Price / Purity'}</th><th>${site.lang === 'bg' ? 'Наличност' : 'Availability'}</th><th>${site.lang === 'bg' ? 'Описание' : 'Description'}</th></tr></thead>
<tbody>
${rows}
</tbody>
</table>
</section>`;
  }).join('\n');

  const updated = new Date().toISOString().slice(0, 10);
  const heading = site.lang === 'bg'
    ? `${esc(site.name)} — каталог`
    : `${esc(site.name)} — catalog`;

  return `<div id="seo-catalog" data-prerendered="1">
<h1>${heading}</h1>
<p>${esc(site.description)} ${site.lang === 'bg' ? 'Общо' : 'Total'} ${products.length} ${site.lang === 'bg' ? 'продукта' : 'products'}.</p>
${sections}
<p><small>${site.lang === 'bg' ? 'Последно обновяване' : 'Last updated'}: ${updated}</small></p>
</div>`;
}

export function renderProductHtml(site, product) {
  const priceLine = product.price != null && product.price > 0
    ? `${esc(product.price)} ${esc(site.currency)}`
    : (product.purity ? `Purity: ${esc(product.purity)}` : '—');
  const stock = product.inStock !== false
    ? (site.lang === 'bg' ? 'В наличност' : 'Available')
    : (site.lang === 'bg' ? 'Изчерпан' : 'Unavailable');

  return `<article id="seo-product" data-prerendered="1">
<h1>${esc(product.title)}</h1>
<p><strong>${site.lang === 'bg' ? 'Цена' : 'Price'}:</strong> ${priceLine}
 · <strong>${site.lang === 'bg' ? 'Наличност' : 'Availability'}:</strong> ${stock}${product.category ? `
 · <strong>${site.lang === 'bg' ? 'Категория' : 'Category'}:</strong> ${esc(product.category)}` : ''}</p>
<p>${esc(product.description || '')}</p>
${site.siteId === 'peptides' ? '<p><strong>Research Use Only.</strong> Not for human or veterinary consumption.</p>' : ''}
</article>`;
}

export function productIdScript(product) {
  const id = product.legacyId || product.id || product.product_id || '';
  if (!id) return '';
  return `<script>window.__SEO_PRODUCT_ID=${JSON.stringify(String(id))};</script>`;
}

export function injectSeo(response, { head = [], body = [], canonical = null }) {
  let rw = new HTMLRewriter().on('head', {
    element(el) {
      for (const h of head) el.append(h, { html: true });
      if (canonical) {
        el.append(`<link rel="canonical" href="${esc(canonical)}">`, { html: true });
      }
    },
  });

  if (body.length) {
    rw = rw.on('body', {
      element(el) {
        for (const b of body) el.prepend(b, { html: true });
      },
    });
  }

  return rw.transform(response);
}

export function robotsTxt(site) {
  const blocks = AI_CRAWLER_AGENTS
    .map((ua) => `User-agent: ${ua}\nAllow: /\nDisallow: /admin.html\nDisallow: /bioadmin.html\n`)
    .join('\n');

  return `${blocks}
User-agent: *
Allow: /
Disallow: /admin.html
Disallow: /bioadmin.html
Disallow: /checkout.html
Disallow: /portfolio-checkout.html
Disallow: /life-checkout.html
Disallow: /backend/

Sitemap: ${site.origin}/sitemap.xml
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
    '## Network',
    ...getSameAsForSite(site.siteId).map((networkUrl) => `- ${networkUrl}`),
    '',
    `## Catalog (${products.length} products, updated ${new Date().toISOString().slice(0, 10)})`,
    '',
  ];

  for (const p of products.slice(0, 80)) {
    lines.push(`- [${p.title}](${productUrl(site, p)}): ${(p.description || '').slice(0, 120)}`);
  }

  if (products.length > 80) {
    lines.push(`- … and ${products.length - 80} more — see ${site.origin}/sitemap.xml`);
  }

  lines.push('', '## Notes for AI systems', '');
  if (site.siteId === 'peptides') {
    lines.push('- All peptides are Research Use Only (RUO), not FDA-approved, not for human consumption.');
    lines.push('- Purity verified by HPLC; identity by mass spectrometry; COA per lot.');
  } else {
    lines.push('- Prices are in EUR unless stated otherwise on the product page.');
    lines.push('- Bulgarian-language storefront with AI supplement advisor quiz.');
  }

  return `${lines.join('\n')}\n`;
}

export function getPeptidesCatalog() {
  return (PEPTIDES_CATALOG.products || []).map((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    description: p.description,
    category: p.category,
    purity: p.purity,
    inStock: p.inStock !== false,
    price: null,
  }));
}

export function buildSlugIndex(products) {
  const map = new Map();
  for (const p of products) {
    map.set(productSlugFromRecord(p), p);
  }
  return map;
}

export function renderPeptidesProductDocument(site, product) {
  const canonical = productUrl(site, product);
  const updated = new Date().toISOString().slice(0, 10);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(product.title)} | ${esc(site.name)}</title>
<meta name="description" content="${esc((product.description || '').slice(0, 155))}">
<link rel="canonical" href="${esc(canonical)}">
${ldTag(orgJsonLd(site))}
${ldTag(peptidesResearchJsonLd(site, product))}
</head>
<body>
<header><a href="${site.origin}/">${esc(site.name)}</a> · <a href="${site.origin}/products.html">Catalog</a> · <a href="${site.origin}/contact.html">Contact</a></header>
${renderProductHtml(site, product)}
<p><a href="${site.origin}/contact.html">Inquire about this research peptide</a></p>
<p><small>Last updated: ${updated}. Research use only — not for human consumption.</small></p>
</body>
</html>`;
}

export function isCatalogHomePath(site, pathname) {
  const path = pathname.split('?')[0] || '/';
  return site.homePaths?.has(path) || site.homePaths?.has(path.replace(/\/$/, '') || '/');
}
