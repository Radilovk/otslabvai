(function () {
    if (window.scrollY > 60) {
        document.documentElement.classList.add('header-pre-scrolled');
    }

    try {
        var theme = document.documentElement.getAttribute('data-theme') || 'light';
        var cacheKey = theme === 'dark' ? 'lifeCachedLogoDark' : 'lifeCachedLogoLight';
        var cachedUrl = localStorage.getItem(cacheKey);
        if (cachedUrl) {
            var logoImg = document.getElementById('header-logo-img');
            if (logoImg) logoImg.src = cachedUrl;
        }
    } catch (e) { /* localStorage may be unavailable */ }
})();
