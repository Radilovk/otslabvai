import { CATALOG_KV } from './catalog-kv-keys.js';
import { planCatalogPrune, recordGroupChunks } from './catalog-prune.mjs';

describe('catalog-prune', () => {
  test('does not delete live index versions or their group chunks', () => {
    const pointer = {
      i: 'v3',
      history: {
        index: ['v1', 'v2', 'v3'],
        stock: ['s1'],
        groups: [
          { v: 'v1', i: 0 },
          { v: 'v2', i: 0 },
          { v: 'v3', i: 0 },
          { v: 'v3', i: 1 },
        ],
      },
    };
    const plan = planCatalogPrune(pointer, 5);
    expect(plan.indexKeys).toEqual([]);
    expect(plan.stockKeys).toEqual([]);
    expect(plan.groupKeys).toEqual([]);
    expect(plan.history.groups).toHaveLength(4);
  });

  test('deletes only versions dropped from retained index history', () => {
    const pointer = {
      i: 'v5',
      history: {
        index: ['v1', 'v2', 'v3', 'v4', 'v5'],
        stock: [],
        groups: [
          { v: 'v1', i: 0 },
          { v: 'v2', i: 0 },
          { v: 'v3', i: 0 },
          { v: 'v4', i: 0 },
          { v: 'v5', i: 0 },
        ],
      },
    };
    const plan = planCatalogPrune(pointer, 3);
    expect(plan.indexKeys).toEqual([
      CATALOG_KV.index('v1'),
      CATALOG_KV.index('v2'),
    ]);
    expect(plan.groupKeys).toEqual([
      CATALOG_KV.groups('v1', 0),
      CATALOG_KV.groups('v2', 0),
    ]);
    expect(plan.history.index).toEqual(['v3', 'v4', 'v5']);
    expect(plan.history.groups.map((e) => e.v)).toEqual(['v3', 'v4', 'v5']);
  });

  test('cleans orphaned group entries not tied to retained index versions', () => {
    const pointer = {
      i: 'v3',
      history: {
        index: ['v2', 'v3'],
        stock: [],
        groups: [
          { v: 'v1', i: 0 },
          { v: 'v1', i: 1 },
          { v: 'v2', i: 0 },
          { v: 'v3', i: 0 },
        ],
      },
    };
    const plan = planCatalogPrune(pointer, 5);
    expect(plan.indexKeys).toEqual([]);
    expect(plan.groupKeys).toEqual([
      CATALOG_KV.groups('v1', 0),
      CATALOG_KV.groups('v1', 1),
    ]);
    expect(plan.history.groups).toHaveLength(2);
  });

  test('stock trim deletes only excess stock versions', () => {
    const pointer = {
      i: 'v1',
      history: {
        index: ['v1'],
        stock: ['s1', 's2', 's3', 's4', 's5', 's6'],
        groups: [{ v: 'v1', i: 0 }],
      },
    };
    const plan = planCatalogPrune(pointer, 3);
    expect(plan.stockKeys).toEqual([
      CATALOG_KV.stock('s1'),
      CATALOG_KV.stock('s2'),
      CATALOG_KV.stock('s3'),
    ]);
    expect(plan.history.stock).toEqual(['s4', 's5', 's6']);
    expect(plan.indexKeys).toEqual([]);
    expect(plan.groupKeys).toEqual([]);
  });

  test('recordGroupChunks avoids duplicate history entries', () => {
    const history = { groups: [{ v: 'v1', i: 0 }] };
    recordGroupChunks(history, 'v1', 2);
    expect(history.groups).toEqual([{ v: 'v1', i: 0 }, { v: 'v1', i: 1 }]);
    recordGroupChunks(history, 'v1', 2);
    expect(history.groups).toHaveLength(2);
  });
});
