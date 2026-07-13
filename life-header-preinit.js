(function () {
    if (window.scrollY > 60) {
        document.documentElement.classList.add('header-pre-scrolled');
    }

    try {
        // Invalidate stale logo URLs cached before frosted-icon rebrand
        var LOGO_CACHE_VERSION = '20260713b';
        if (localStorage.getItem('lifeLogoCacheVersion') !== LOGO_CACHE_VERSION) {
            localStorage.removeItem('lifeCachedLogoLight');
            localStorage.removeItem('lifeCachedLogoDark');
            localStorage.setItem('lifeLogoCacheVersion', LOGO_CACHE_VERSION);
        }

        var theme = document.documentElement.getAttribute('data-theme') || 'light';
        var cacheKey = theme === 'dark' ? 'lifeCachedLogoDark' : 'lifeCachedLogoLight';
        var cachedUrl = localStorage.getItem(cacheKey);
        if (cachedUrl && cachedUrl.indexOf('IMG_20260314') !== -1) {
            cachedUrl = null;
        }
        if (cachedUrl) {
            var logoImg = document.getElementById('header-logo-img');
            if (logoImg) logoImg.src = cachedUrl;
        }
    } catch (e) { /* localStorage may be unavailable */ }
})();
