export const CATALOG_KV = {
  POINTER: 'catalog_pointer',
  HASHES: 'catalog_hashes',
  index: (v) => `catalog_index_${v}`,
  stock: (v) => `catalog_stock_${v}`,
  groups: (v, i) => `catalog_groups_${v}_${i}`,
};
