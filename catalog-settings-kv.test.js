import {
  mergeSettingsForCatalogSync,
  persistSettingsAfterCatalogSync,
  mergeIndexEmbeddedSettings,
} from './catalog-settings-kv.mjs';

describe('catalog-settings-kv', () => {
  const defaults = {
    hero_image: 'images/portfolio-hero.jpg',
    hero_slides: [],
    site_name: 'Default',
  };

  test('mergeSettingsForCatalogSync preserves KV hero', () => {
    const merged = mergeSettingsForCatalogSync(defaults, {
      hero_image: 'images/hero-custom.jpg',
      hero_slides: [{ id: 'a', image: 'images/hero-custom.jpg' }],
    });
    expect(merged.hero_image).toBe('images/hero-custom.jpg');
    expect(merged.hero_slides).toHaveLength(1);
    expect(merged.global_markup_percent).toBe(30);
  });

  test('persistSettingsAfterCatalogSync only patches sync timestamps', () => {
    const fresh = {
      hero_image: 'images/new.jpg',
      hero_slides: [{ id: 'x', image: 'images/new.jpg' }],
      site_name: 'Admin',
      global_markup_percent: 25,
    };
    const out = persistSettingsAfterCatalogSync(fresh, {
      last_sync: '2026-08-18T00:00:00.000Z',
      last_sync_count: 42,
    });
    expect(out.hero_image).toBe('images/new.jpg');
    expect(out.site_name).toBe('Admin');
    expect(out.global_markup_percent).toBe(25);
    expect(out.last_sync).toBe('2026-08-18T00:00:00.000Z');
    expect(out.last_sync_count).toBe(42);
  });

  test('mergeIndexEmbeddedSettings prefers fresh KV hero over stale build snapshot', () => {
    const built = {
      hero_image: 'images/portfolio-hero.jpg',
      hero_slides: [],
      site_name: 'Stale',
    };
    const fresh = {
      hero_image: 'images/hero-live.jpg',
      hero_slides: [{ id: '1', image: 'images/hero-live.jpg' }],
      site_name: 'Live',
    };
    const out = mergeIndexEmbeddedSettings(built, fresh);
    expect(out.hero_image).toBe('images/hero-live.jpg');
    expect(out.hero_slides).toHaveLength(1);
    expect(out.site_name).toBe('Live');
  });
});
