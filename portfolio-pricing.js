/**
 * Portfolio pricing vs Fitness1 – standard catalog rules + F1 promo undercut + promo-code overrides.
 */

function roundPrice(value) {
  return Math.round(value * 100) / 100;
}

/** @type {{ min_profit_eur: number, f1_promo_undercut_eur: number, standard_mode: string, below_regular_percent: number, above_b2b_percent: number }} */
export const DEFAULT_PRICING_POLICY = {
  min_profit_eur: 0.01,
  f1_promo_undercut_eur: 0.10,
  standard_mode: 'below_regular',
  below_regular_percent: 3,
  above_b2b_percent: 30
};

export function normalizePricingPolicy(policy, settings = null) {
  const fromSettings = policy || settings?.pricing_policy || {};
  const globalMarkup = Number(settings?.global_markup_percent);
  return {
    ...DEFAULT_PRICING_POLICY,
    ...fromSettings,
    above_b2b_percent: Number(fromSettings.above_b2b_percent ?? globalMarkup ?? DEFAULT_PRICING_POLICY.above_b2b_percent),
    below_regular_percent: Number(fromSettings.below_regular_percent ?? DEFAULT_PRICING_POLICY.below_regular_percent),
    f1_promo_undercut_eur: Number(fromSettings.f1_promo_undercut_eur ?? DEFAULT_PRICING_POLICY.f1_promo_undercut_eur),
    min_profit_eur: Number(fromSettings.min_profit_eur ?? DEFAULT_PRICING_POLICY.min_profit_eur)
  };
}

/** Active F1 end-customer price (promo sale wins over regular list price). */
export function getF1CustomerPrice(regularPrice, salePrice) {
  const regular = Number(regularPrice) || 0;
  const sale = Number(salePrice) || 0;
  if (sale > 0 && (regular <= 0 || sale < regular)) return roundPrice(sale);
  if (regular > 0) return roundPrice(regular);
  return 0;
}

/** F1 runs a visible promo (sale below regular). */
export function isF1PromoActive(regularPrice, salePrice) {
  const regular = Number(regularPrice) || 0;
  const sale = Number(salePrice) || 0;
  return sale > 0 && regular > 0 && sale < regular;
}

/**
 * Largest price strictly below reference after undercut (2-decimal EUR).
 * @param {number} reference
 * @param {number} [undercutEur]
 */
export function priceStrictlyBelow(reference, undercutEur = DEFAULT_PRICING_POLICY.f1_promo_undercut_eur) {
  const ref = Number(reference) || 0;
  if (!(ref > 0)) return 0;
  const step = Math.max(Number(undercutEur) || 0.01, 0.01);
  let candidate = roundPrice(ref - step);
  if (candidate >= ref) candidate = roundPrice(ref - 0.01);
  if (candidate <= 0) return 0;
  return candidate;
}

function priceBelowRegular(regular, percentBelow, floor) {
  const regularPrice = Number(regular) || 0;
  if (!(regularPrice > 0)) return 0;
  const pct = Math.max(0, Math.min(99, Number(percentBelow) || 0));
  let target = roundPrice(regularPrice * (1 - pct / 100));
  if (target >= regularPrice) target = roundPrice(regularPrice - 0.01);
  return Math.max(floor, target);
}

function resolveF1PromoPrice(b2b, regular, sale, policy) {
  const floor = roundPrice(b2b + policy.min_profit_eur);
  const f1Ref = getF1CustomerPrice(regular, sale);
  let competitive = priceStrictlyBelow(f1Ref, policy.f1_promo_undercut_eur);
  competitive = Math.max(floor, competitive);
  if (competitive >= f1Ref) competitive = roundPrice(f1Ref - 0.01);
  if (competitive < floor) competitive = floor;

  const belowF1 = competitive < f1Ref;
  const compareAt = Number(regular) > competitive ? Number(regular) : f1Ref;

  return {
    retail_price: competitive,
    compare_at_price: belowF1 ? compareAt : 0,
    is_on_promo: true,
    f1_reference_price: f1Ref,
    pricing_mode: belowF1 ? 'f1_promo' : 'floor'
  };
}

function resolveStandardPrice(b2b, regular, policy, markupRetail) {
  const floor = roundPrice(b2b + policy.min_profit_eur);
  const regularPrice = Number(regular) || 0;

  if (policy.standard_mode === 'below_regular' && regularPrice > floor) {
    const retail = priceBelowRegular(regularPrice, policy.below_regular_percent, floor);
    return {
      retail_price: retail,
      compare_at_price: retail < regularPrice ? regularPrice : 0,
      is_on_promo: retail < regularPrice,
      f1_reference_price: regularPrice,
      pricing_mode: 'below_regular'
    };
  }

  const markupFn = typeof markupRetail === 'function' ? markupRetail : null;
  let retail = markupFn ? Number(markupFn()) || 0 : 0;
  if (!(retail > 0)) {
    retail = roundPrice(b2b * (1 + (Number(policy.above_b2b_percent) || 0) / 100));
  }
  retail = Math.max(floor, retail);

  return {
    retail_price: retail,
    compare_at_price: regularPrice > retail ? regularPrice : 0,
    is_on_promo: false,
    f1_reference_price: regularPrice,
    pricing_mode: 'above_b2b'
  };
}

/**
 * @typedef {object} VariantPricingInput
 * @property {number} b2b
 * @property {number} [regular]
 * @property {number} [sale]
 * @property {object} [override]
 * @property {() => number} [markupRetail]
 * @property {object} [policy]
 * @property {object} [settings]
 */

/**
 * @param {VariantPricingInput} input
 * @returns {{
 *   retail_price: number,
 *   compare_at_price: number,
 *   is_on_promo: boolean,
 *   f1_reference_price: number,
 *   pricing_mode: string
 * }}
 */
export function resolveVariantPricing(input) {
  const policy = normalizePricingPolicy(input.policy, input.settings);
  const b2b = Number(input.b2b) || 0;
  const regular = Number(input.regular) || 0;
  const sale = Number(input.sale) || 0;
  const floor = roundPrice(b2b + policy.min_profit_eur);

  if (input.override && typeof input.override.fixed_price === 'number') {
    const fixed = roundPrice(input.override.fixed_price);
    const onPromo = isF1PromoActive(regular, sale);
    return {
      retail_price: Math.max(floor, fixed),
      compare_at_price: onPromo && regular > fixed ? regular : (regular > fixed ? regular : 0),
      is_on_promo: onPromo || (regular > fixed),
      f1_reference_price: getF1CustomerPrice(regular, sale),
      pricing_mode: 'fixed_override'
    };
  }

  if (isF1PromoActive(regular, sale)) {
    return resolveF1PromoPrice(b2b, regular, sale, policy);
  }

  return resolveStandardPrice(b2b, regular, policy, input.markupRetail);
}

/**
 * Personal promo-code pricing (optional % below regular or % above b2b).
 * @param {object} variant - catalog variant with b2b/regular/retail
 * @param {object|null} promo - { pricing_mode, pricing_percent }
 * @param {object} [policy]
 */
export function applyPromoCodePrice(variant, promo, policy = DEFAULT_PRICING_POLICY) {
  const base = roundPrice(Number(variant?.retail_price) || 0);
  if (!promo?.pricing_mode || promo.pricing_mode === 'none') return base;

  const normalized = normalizePricingPolicy(policy);
  const b2b = Number(variant?.b2b_price) || 0;
  const regular = Number(variant?.regular_price) || 0;
  const floor = roundPrice(b2b + normalized.min_profit_eur);
  const pct = Math.max(0, Number(promo.pricing_percent) || 0);

  if (promo.pricing_mode === 'below_regular' && regular > floor) {
    return priceBelowRegular(regular, pct, floor);
  }
  if (promo.pricing_mode === 'above_b2b') {
    return Math.max(floor, roundPrice(b2b * (1 + pct / 100)));
  }
  return base;
}

/**
 * Promo: give away a share of the margin (retail − b2b) as discount.
 * @param {number} retail - catalog retail price
 * @param {number} b2b - delivery / B2B cost
 * @param {number} marginPercent - 0–100, share of margin discounted (100 → price = b2b)
 */
export function applyMarginSharePrice(retail, b2b, marginPercent) {
  const retailPrice = Number(retail) || 0;
  const wholesale = Number(b2b) || 0;
  if (!(retailPrice > wholesale) || !(wholesale > 0)) return roundPrice(retailPrice);

  const margin = retailPrice - wholesale;
  const share = Math.max(0, Math.min(100, Number(marginPercent) || 0));
  return roundPrice(Math.max(wholesale, retailPrice - margin * (share / 100)));
}

/** True when promo changes per-line prices instead of a cart-level discount. */
export function promoUsesLinePricing(promo) {
  if (!promo) return false;
  if (promo.pricing_mode && promo.pricing_mode !== 'none') return true;
  return promo.discountType === 'margin_percentage';
}

/**
 * Apply promo to a catalog variant (personal pricing or margin share).
 * @param {object} variant
 * @param {object|null} promo
 * @param {object} [policy]
 */
export function resolvePromoLinePrice(variant, promo, policy = DEFAULT_PRICING_POLICY) {
  const catalogRetail = Number(variant?.retail_price) || 0;
  if (!promo) return catalogRetail;

  if (promo.discountType === 'margin_percentage') {
    return applyMarginSharePrice(catalogRetail, variant?.b2b_price, promo.discount);
  }
  return applyPromoCodePrice(variant, promo, policy);
}

/** Summarize promo savings when line prices were adjusted. */
export function sumLinePricingSavings(items) {
  if (!Array.isArray(items)) return 0;
  return roundPrice(items.reduce((sum, item) => {
    const catalog = Number(item.catalog_retail_price ?? item.retail_price) || 0;
    const current = Number(item.retail_price) || 0;
    const qty = Number(item.quantity) || 1;
    return sum + Math.max(0, catalog - current) * qty;
  }, 0));
}

/** Product page – single selected variant. */
export function summarizeGroupPricing(variants) {
  const list = (variants || []).filter(
    (v) => v.available !== false && (Number(v.retail_price) || 0) > 0
  );

  if (!list.length) {
    return {
      min_price: 0,
      max_price: 0,
      has_promo: false,
      compare_at_price: 0,
      default_sku_id: null
    };
  }

  const minPrice = Math.min(...list.map((v) => Number(v.retail_price)));
  const maxPrice = Math.max(...list.map((v) => Number(v.retail_price)));

  const cheapestAtMin = list.filter((v) => Number(v.retail_price) === minPrice);
  const anchor = cheapestAtMin.find(
    (v) => v.is_on_promo && (Number(v.compare_at_price) || 0) > Number(v.retail_price)
  ) || cheapestAtMin[0];

  const hasPromo = list.some(
    (v) => (v.is_on_promo || v.pricing_mode === 'f1_promo') &&
      (Number(v.compare_at_price) || 0) > (Number(v.retail_price) || 0)
  );

  const compareAt = anchor?.is_on_promo &&
    (Number(anchor.compare_at_price) || 0) > Number(anchor.retail_price)
    ? Number(anchor.compare_at_price)
    : 0;

  return {
    min_price: minPrice,
    max_price: maxPrice,
    has_promo: hasPromo,
    compare_at_price: compareAt,
    default_sku_id: anchor?.sku_id ? String(anchor.sku_id) : null
  };
}

function packSortKey(pack) {
  const s = String(pack || '').trim();
  const m = s.match(/([\d,.]+)/);
  if (m) {
    const n = parseFloat(m[1].replace(',', '.'));
    if (!Number.isNaN(n)) return n;
  }
  return Number.POSITIVE_INFINITY;
}

/** Unique pack labels from available variants, sorted by size. */
export function collectAvailablePacks(variants) {
  const packs = [...new Set(
    (variants || [])
      .filter((v) => v.available !== false)
      .map((v) => String(v.pack || '').trim())
      .filter(Boolean)
  )];
  return packs.sort((a, b) => packSortKey(a) - packSortKey(b) || a.localeCompare(b, 'bg'));
}

/**
 * Compact pack line for catalog cards, e.g. "0.9 / 2.3 кг" or "60 / 90 капс".
 * @param {string[]} packs
 */
export function formatPacksDisplay(packs) {
  const list = (packs || []).map((p) => String(p).trim()).filter(Boolean);
  if (!list.length) return '';
  if (list.length === 1) return list[0];

  const parsed = list.map((p) => {
    const m = p.match(/^([\d,.]+)\s*(.*)$/u);
    return m ? { num: m[1], unit: m[2].trim() } : { num: p, unit: '' };
  });
  const unit = parsed[0].unit;
  if (unit && parsed.every((p) => p.unit === unit)) {
    return `${parsed.map((p) => p.num).join(' / ')} ${unit}`;
  }
  return list.join(' / ');
}

export function formatEur(amount) {
  return `${(Number(amount) || 0).toFixed(2)} €`;
}

/** Product page – single selected variant. */
export function formatVariantPriceHtml(variant) {
  if (!variant) return '—';
  const retail = Number(variant.retail_price) || 0;
  const compare = Number(variant.compare_at_price) || 0;
  const current = formatEur(retail);
  if (variant.is_on_promo && compare > retail) {
    return `<span class="pf-price-compare">${formatEur(compare)}</span><span class="pf-price-sale">${current}</span>`;
  }
  return current;
}

/**
 * Catalog card – group index row (min/max from available variants).
 * Strikethrough uses compare only from the cheapest available variant, never a mismatched SKU.
 */
export function formatGroupPriceHtml(stats) {
  const min = Number(stats?.min_price) || 0;
  const max = Number(stats?.max_price) || 0;
  const compare = Number(stats?.compare_at_price) || 0;
  const showCompare = stats?.has_promo && compare > min;

  if (min === max) {
    const current = formatEur(min);
    if (showCompare) {
      return `<span class="pf-price-compare">${formatEur(compare)}</span><span class="pf-price-sale">${current}</span>`;
    }
    return current;
  }

  const fromPrice = `<span class="from">от</span> ${formatEur(min)}`;
  if (showCompare) {
    return `<span class="pf-price-compare">${formatEur(compare)}</span><span class="pf-price-sale">${fromPrice}</span>`;
  }
  return fromPrice;
}
