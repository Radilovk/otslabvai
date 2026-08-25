/**
 * Resolve catalog product images from Fitness1 / Sila fields and HTML descriptions.
 */

export function isLikelyImageUrl(url) {
  const s = String(url || '').trim();
  if (!s) return false;
  if (/^https?:\/\//i.test(s)) return true;
  if (s.startsWith('//')) return true;
  return false;
}

export function hasCatalogImage(image) {
  return isLikelyImageUrl(image);
}

/** First <img src="..."> from Fitness1 HTML descriptions. */
export function extractFirstImageFromHtml(html) {
  const text = String(html || '');
  if (!text) return '';
  const match = text.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match ? match[1].trim() : '';
}

/**
 * @param {{ image?: string, label?: string, description?: string }} fields
 */
export function resolveCatalogImage(fields = {}) {
  const image = String(fields.image || '').trim();
  if (isLikelyImageUrl(image)) return image;

  const label = String(fields.label || '').trim();
  if (isLikelyImageUrl(label)) return label;

  return extractFirstImageFromHtml(fields.description);
}

/**
 * Ensure group + variant image fields are populated when possible.
 * @param {object} group
 */
export function applyGroupImageFallbacks(group) {
  if (!group) return group;

  const resolved = resolveCatalogImage({
    image: group.image,
    label: group.label,
    description: group.description,
  });
  if (resolved) group.image = resolved;

  if (group.variants) {
    for (const variant of group.variants) {
      const variantImage = resolveCatalogImage({
        image: variant.image,
        label: group.label,
        description: group.description,
      });
      variant.image = variantImage || group.image || '';
    }
  }

  return group;
}

/** Groups that should appear in the public portfolio catalog. */
export function groupsWithCatalogImages(groups) {
  return (groups || [])
    .map((g) => applyGroupImageFallbacks({ ...g, variants: (g.variants || []).map((v) => ({ ...v })) }))
    .filter((g) => hasCatalogImage(g.image));
}
