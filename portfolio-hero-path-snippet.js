/** Sync with portfolio-hero-path.js — non-module, loaded before portfolio-head-preinit.js */
(function () {
  var RAW = /raw\.githubusercontent\.com\/Radilovk\/otslabvai\/main\/(images\/[^?#]+)/i;
  function normalizeHeroImagePath(url) {
    var p = String(url || '').trim();
    if (!p) return '';
    var m = p.match(RAW);
    if (m) return m[1];
    if (p.indexOf('/images/') === 0) return p.slice(1);
    if (p.indexOf('images/') === 0) return p;
    return p;
  }
  function heroSrc(path) {
    var rel = normalizeHeroImagePath(path);
    if (!rel || rel.indexOf('images/') !== 0) return '/images/portfolio-hero.jpg';
    return '/' + rel;
  }
  window.pfHeroSrc = heroSrc;
  window.pfNormalizeHeroPath = normalizeHeroImagePath;
})();
