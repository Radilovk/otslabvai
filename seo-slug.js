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
