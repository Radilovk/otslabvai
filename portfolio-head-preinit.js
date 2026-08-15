(function () {
  var WORKER_API = 'https://port.radilov-k.workers.dev';

  function apiUrl() {
    var host = location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return location.port === '8080' ? 'http://localhost:8080/backend' : location.origin;
    }
    if (host.endsWith('.workers.dev')) return location.origin;
    return WORKER_API;
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
    if (branding.hero_image) {
      document.documentElement.setAttribute('data-pf-hero', branding.hero_image);
      try { localStorage.setItem('pf-hero-src', branding.hero_image); } catch (e) { /* ignore */ }
      var link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = branding.hero_image;
      document.head.appendChild(link);
    }
  } else {
    try {
      var cached = localStorage.getItem('pf-hero-src');
      if (cached) document.documentElement.setAttribute('data-pf-hero', cached);
    } catch (e) { /* ignore */ }
  }
})();
