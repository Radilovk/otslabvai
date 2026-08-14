(function () {
  // Hero: set once from localStorage before first paint.
  // Do NOT re-swap in JS modules unless the image URL actually changed
  // (same lesson as life-header-preinit.js — triple swap causes flicker).
  try {
    var raw = localStorage.getItem('portfolio_hero_branding_v1');
    if (!raw) return;
    var d = JSON.parse(raw);
    var url = d && d.hero_image ? String(d.hero_image) : '';
    if (!url) return;
    document.documentElement.setAttribute('data-pf-hero-image', url);
    document.documentElement.classList.add('pf-hero-preinit');
    var link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = url;
    document.head.appendChild(link);
  } catch (e) { /* ignore */ }
})();
