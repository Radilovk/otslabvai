(function () {
    // Pre-apply scrolled glass state before first paint (avoids flash on reload mid-page)
    if (window.scrollY > 80) {
        document.documentElement.classList.add('header-pre-scrolled');
    }

    // Logo: keep static HTML src — do NOT swap from localStorage/CMS here.
    // Triple logo swap (HTML → cache → CMS) caused header flicker and layout jump.
})();
