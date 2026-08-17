(function () {
  var WORKER_API = 'https://port.radilov-k.workers.dev';
  var GITHUB_RAW = 'https://raw.githubusercontent.com/Radilovk/otslabvai/main';

  function apiUrl() {
    var host = location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return location.port === '8080' ? 'http://localhost:8080/backend' : location.origin;
    }
    if (host.endsWith('.workers.dev')) return location.origin;
    return WORKER_API;
  }

  function resolveHero(path) {
    var p = String(path || '').trim();
    if (!p) return '';
    if (/^https?:\/\//i.test(p)) return p;
    if (p.charAt(0) === '/') p = p.slice(1);
    if (p.indexOf('images/') === 0) return GITHUB_RAW + '/' + p;
    return p;
  }

  try {
    var s = localStorage.getItem('theme');
    var t = s || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', t);
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'light');
  }

  try {
    var c = JSON.parse(localStorage.getItem('portfolioCart') || '[]');
    var n = c.reduce(function (sum, i) { return sum + (i.quantity || 0); }, 0);
    if (n > 0) document.documentElement.setAttribute('data-pf-cart', String(n));
  } catch (e) { /* ignore */ }

  var branding = null;
  try {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', apiUrl() + '/c/now', false);
    xhr.send(null);
    if (xhr.status >= 200 && xhr.status < 300) {
      branding = JSON.parse(xhr.responseText).branding || null;
    }
  } catch (e) { /* offline */ }

  if (branding) {
    window.__pfBranding = branding;
    var heroImg = resolveHero(branding.hero_image);
    if (Array.isArray(branding.hero_slides)) {
      for (var i = 0; i < branding.hero_slides.length; i++) {
        var slide = branding.hero_slides[i];
        if (slide && slide.image) { heroImg = resolveHero(slide.image); break; }
      }
    }
    if (heroImg) {
      document.documentElement.setAttribute('data-pf-hero', heroImg);
      var link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = heroImg;
      document.head.appendChild(link);
    }
  }
})();
