/**
 * Resolve cart lines from site page_content / life_page_content
 * (manual products + legacy imports outside prod-pf-* ids).
 */

export const SITE_CONTENT_KEYS = {
  main: { kvKey: 'page_content', fallback: 'static_backend_page_content.json' },
  life: { kvKey: 'life_page_content', fallback: 'static_backend_life_page_content.json' }
};

/** @returns {'main' | 'life' | null} */
export function normalizeSiteProject(project) {
  const p = String(project || 'portfolio').trim().toLowerCase();
  if (p === 'life') return 'life';
  if (p === 'main' || p === 'daotslabna') return 'main';
  return null;
}

/**
 * Split cart id into site product_id and optional variant sku.
 * @returns {{ productId: string | null, variantSku: string | null }}
 */
export function parseSiteCartRef(rawId) {
  const id = String(rawId || '').trim();
  if (!id) return { productId: null, variantSku: null };

  const pf = id.match(/^prod-pf-(\d+)(?:_(.+))?$/);
  if (pf) return { productId: `prod-pf-${pf[1]}`, variantSku: pf[2] || null };

  const parts = id.match(/^(.+)_([^_]+)$/);
  if (parts && parts[1].startsWith('prod-')) {
    return { productId: parts[1], variantSku: parts[2] };
  }

  return { productId: id, variantSku: null };
}

/**
 * @returns {{ product: object, variantSku: string | null } | null}
 */
export function findSiteProduct(pageContent, rawId) {
  const { productId, variantSku } = parseSiteCartRef(rawId);
  if (!productId || !Array.isArray(pageContent?.page_content)) return null;

  for (const comp of pageContent.page_content) {
    if (comp.type !== 'product_category' || !Array.isArray(comp.products)) continue;
    for (const product of comp.products) {
      if (product.product_id === productId) {
        return { product, variantSku };
      }
    }
  }
  return null;
}

export function isSiteProductAvailable(product, variantSku) {
  const variants = product.public_data?.variants || [];
  if (variants.length) {
    if (variantSku) {
      const v = variants.find((x) => String(x.sku) === String(variantSku));
      return Boolean(v && v.available !== false);
    }
    return variants.some((v) => v.available !== false);
  }
  const inv = Number(product.system_data?.inventory);
  if (Number.isFinite(inv) && inv <= 0) return false;
  return true;
}

/**
 * Build normalized order line fields from a site product.
 * @returns {object | null}
 */
export function siteProductToOrderLine(product, variantSku, qty) {
  const pub = product.public_data || {};
  const variants = pub.variants || [];
  let name = String(pub.name || product.product_id);
  let retailPrice = Number(pub.price) || 0;
  let skuId = product.product_id;
  let barcode = '';
  let image = pub.image_url || '';
  let pack = '';
  let option = '';

  if (variants.length) {
    const v = variantSku
      ? variants.find((x) => String(x.sku) === String(variantSku))
      : variants.find((x) => x.available !== false) || variants[0];
    if (!v || v.available === false) return null;
    retailPrice = Number(v.price) || retailPrice;
    skuId = String(v.sku || variantSku || product.product_id);
    barcode = v.ean || '';
    image = v.image_url || image;
    option = v.option_name || '';
  }

  const label = [name, pack, option].filter(Boolean).join(' – ');
  return {
    sku_id: skuId,
    barcode,
    name: label,
    pack,
    option,
    quantity: qty,
    b2b_price: 0,
    retail_price: retailPrice,
    catalog_retail_price: retailPrice,
    compare_at_price: 0,
    pricing_mode: 'site',
    image
  };
}

/**
 * Same shape as resolveCartSku() in portfolio-api for shared validation.
 * @returns {Promise<object | null>}
 */
export async function resolveSiteCartSku(env, project, rawId) {
  const siteProject = normalizeSiteProject(project);
  if (!siteProject || !env?.PAGE_CONTENT) return null;

  const keys = SITE_CONTENT_KEYS[siteProject];
  let raw = await env.PAGE_CONTENT.get(keys.kvKey);
  if (raw === null) raw = await env.PAGE_CONTENT.get(keys.fallback);
  if (!raw) return null;

  const pageContent = JSON.parse(raw);
  const found = findSiteProduct(pageContent, rawId);
  if (!found || !isSiteProductAvailable(found.product, found.variantSku)) return null;

  const line = siteProductToOrderLine(found.product, found.variantSku, 1);
  if (!line) return null;

  const pub = found.product.public_data || {};
  return {
    group_id: found.product.system_data?.portfolio?.group_id || null,
    group_name: pub.name || found.product.product_id,
    brand: pub.brand || '',
    image: line.image,
    variant: {
      sku_id: line.sku_id,
      barcode: line.barcode,
      pack: line.pack,
      option: line.option,
      available: true,
      b2b_price: line.b2b_price,
      retail_price: line.retail_price,
      compare_at_price: line.compare_at_price,
      pricing_mode: 'site'
    }
  };
}

/** Cart ids that require portfolio catalog meta (F1-backed lines). */
export function isCatalogBackedCartId(rawId) {
  const id = String(rawId || '').trim();
  if (!id) return false;
  if (/^prod-pf-\d+/.test(id)) return true;
  const { variantSku } = parseSiteCartRef(id);
  if (variantSku && /^\d+$/.test(variantSku)) return true;
  if (/^\d+$/.test(id)) return true;
  return false;
}

export function cartRequiresCatalogMeta(products) {
  if (!Array.isArray(products)) return false;
  return products.some((p) => isCatalogBackedCartId(p.sku_id || p.id));
}
