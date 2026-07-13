import { API_URL } from './config.js';
import { LIFE_CATEGORY_DEFS, collectProductsForCategory } from './life-category-assign.js';
import { rewriteAllProductImages } from './life-img.js';

const DOM = {
    title: document.getElementById('category-title'),
    description: document.getElementById('category-description'),
    grid: document.getElementById('category-grid'),
    backLink: document.getElementById('category-back-link'),
    header: {
        logoImg: document.getElementById('header-logo-img'),
        brandName: document.getElementById('header-brand-name'),
        brandSlogan: document.getElementById('header-brand-slogan'),
        navLinks: document.getElementById('main-nav-links'),
        cartCount: document.getElementById('cart-count')
    },
    footer: {
        gridContainer: document.getElementById('footer-grid-container'),
        copyrightContainer: document.getElementById('footer-copyright-container')
    },
    backToTopBtn: document.getElementById('back-to-top'),
    menuToggle: document.querySelector('.menu-toggle'),
    navLinksContainer: document.querySelector('.nav-links'),
    navOverlay: document.querySelector('.nav-overlay'),
    body: document.body
};

function escapeHtml(unsafe) {
    if (unsafe === null || unsafe === undefined) return '';
    return String(unsafe)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function getCart() {
    return JSON.parse(localStorage.getItem('lifeCart') || '[]');
}

function updateCartCount() {
    const count = getCart().reduce((acc, item) => acc + item.quantity, 0);
    if (DOM.header.cartCount) DOM.header.cartCount.textContent = count;
    const menuCount = document.getElementById('cart-count-menu');
    if (menuCount) menuCount.textContent = count;
}

function generateBasicProductCard(product) {
    if (!product.public_data) return '';

    const publicData = product.public_data;
    const productId = product.product_id;
    const variants = publicData.variants || [];
    const availableVariants = variants.filter(v => v.available !== false && typeof v.price === 'number');
    const brandLabel = publicData.brand
        ? `<span class="life-catalog-brand">${escapeHtml(publicData.brand)}</span>`
        : '';

    const salePrice = publicData.sale_price;
    const hasSale = typeof salePrice === 'number' && salePrice > 0 && salePrice < Number(publicData.price) && availableVariants.length === 0;

    let priceHTML;
    if (!hasSale && availableVariants.length > 1) {
        const prices = availableVariants.map(v => v.price);
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        priceHTML = minPrice < maxPrice
            ? `<span class="price-from">от</span> ${Number(minPrice).toFixed(2)} €`
            : `${Number(minPrice).toFixed(2)} €`;
    } else if (!hasSale && availableVariants.length === 1) {
        priceHTML = `${Number(availableVariants[0].price).toFixed(2)} €`;
    } else if (hasSale) {
        priceHTML = `<span class="price-original">${Number(publicData.price).toFixed(2)} €</span><span class="price-sale">${Number(salePrice).toFixed(2)} €</span>`;
    } else {
        priceHTML = typeof publicData.price === 'number' ? `${Number(publicData.price).toFixed(2)} €` : '';
    }

    const cardTagline = publicData.tagline
        || (publicData.description ? `${String(publicData.description).split(/[\n]/)[0].slice(0, 120)}` : '');

    return `
    <a href="life-product.html?id=${encodeURIComponent(productId)}" class="life-catalog-card fade-in-up" data-product-id="${escapeHtml(productId)}">
        <div class="life-catalog-image">
            ${publicData.image_url
                ? `<img src="${escapeHtml(publicData.image_url)}" alt="${escapeHtml(publicData.name)}" loading="lazy" decoding="async">`
                : '<div class="life-catalog-no-image" aria-hidden="true"></div>'}
        </div>
        <div class="life-catalog-body">
            ${brandLabel}
            <h3 class="life-catalog-title">${escapeHtml(publicData.name)}</h3>
            ${cardTagline ? `<p class="life-catalog-tagline">${escapeHtml(cardTagline)}</p>` : ''}
            <div class="life-catalog-price">${priceHTML}</div>
        </div>
    </a>`;
}

function initMobileMenu() {
    const closeMenu = () => {
        DOM.menuToggle?.classList.remove('active');
        DOM.navLinksContainer?.classList.remove('active');
        DOM.navOverlay?.classList.remove('active');
        DOM.body.classList.remove('nav-open');
    };

    if (!DOM.menuToggle || !DOM.navLinksContainer || !DOM.navOverlay) return;

    DOM.menuToggle.addEventListener('click', () => {
        DOM.menuToggle.classList.toggle('active');
        DOM.navLinksContainer.classList.toggle('active');
        DOM.navOverlay.classList.toggle('active');
        DOM.body.classList.toggle('nav-open');
    });
    DOM.navOverlay.addEventListener('click', closeMenu);
    DOM.navLinksContainer.addEventListener('click', (e) => {
        if (e.target.closest('.nav-dropdown-toggle')) return;
        if (e.target.tagName === 'A' || e.target.closest('button')) closeMenu();
    });
}

function renderMinimalFooter(settings, footer) {
    if (!DOM.footer.gridContainer || !footer?.columns) return;
    DOM.footer.gridContainer.innerHTML = footer.columns.slice(0, 2).map(col => {
        if (col.type === 'links') {
            const links = (col.links || []).map(link => `<li><a href="${escapeHtml(link.url)}">${escapeHtml(link.text)}</a></li>`).join('');
            return `<div class="footer-column"><h4>${escapeHtml(col.title)}</h4><ul>${links}</ul></div>`;
        }
        return '';
    }).join('');
    if (DOM.footer.copyrightContainer) {
        DOM.footer.copyrightContainer.innerHTML = `<p>${escapeHtml(footer.copyright || settings.site_name || 'Life Protocols')}</p>`;
    }
}

function renderMinimalHeader(settings, navigation) {
    if (settings?.site_name && DOM.header.brandName) DOM.header.brandName.textContent = settings.site_name;
    if (settings?.site_slogan && DOM.header.brandSlogan) {
        DOM.header.brandSlogan.textContent = settings.site_slogan;
        DOM.header.brandSlogan.style.display = settings.site_slogan ? 'block' : 'none';
    }
    if (!DOM.header.navLinks || !Array.isArray(navigation)) return;

    const pageLinks = navigation.filter(item => !item.link?.startsWith('#'));
    const navHTML = pageLinks.map(item => `<li><a href="${escapeHtml(item.link)}">${escapeHtml(item.text)}</a></li>`).join('');
    const persistent = DOM.header.navLinks.querySelector('.cart-link-mobile');
    DOM.header.navLinks.innerHTML = navHTML;
    if (persistent) DOM.header.navLinks.appendChild(persistent);
}

async function main() {
    initMobileMenu();
    updateCartCount();

    const params = new URLSearchParams(window.location.search);
    const categoryId = params.get('category') || params.get('id');
    if (!categoryId) {
        DOM.grid.innerHTML = '<p class="life-category-empty">Липсва категория. <a href="life.html">Към началната страница</a></p>';
        return;
    }

    try {
        const response = await fetch(`${API_URL}/life_page_content.json`, { cache: 'default' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();

        renderMinimalHeader(data.settings, data.navigation);
        renderMinimalFooter(data.settings, data.footer);
        rewriteAllProductImages(data.page_content);

        const catDef = LIFE_CATEGORY_DEFS.find(d => d.id === categoryId)
            || { id: categoryId, title: categoryId, description: '' };
        const cmsCategory = (data.page_content || []).find(
            c => c.type === 'product_category' && (c.id === categoryId || c.category_id === categoryId)
        );

        const title = cmsCategory?.title || catDef.title;
        const description = cmsCategory?.description || catDef.description || '';

        document.title = `${title} - Life Protocols`;
        DOM.title.textContent = title;
        DOM.description.textContent = description;
        if (DOM.backLink) DOM.backLink.href = cmsCategory?.id ? `life.html#${cmsCategory.id}` : 'life.html';

        let products = collectProductsForCategory(data.page_content, catDef);
        if (!products.length && cmsCategory?.products?.length) {
            products = [...cmsCategory.products].sort((a, b) => (a.display_order ?? 999999) - (b.display_order ?? 999999));
        }

        // Каталог страница: само продукти извън началната витрина (show_on_homepage === false)
        const catalogProducts = products.filter(p => p.system_data?.show_on_homepage === false);
        const displayProducts = catalogProducts.length ? catalogProducts : products;

        if (!displayProducts.length) {
            DOM.grid.innerHTML = '<p class="life-category-empty">Няма допълнителни продукти в тази категория.</p>';
            return;
        }

        DOM.grid.innerHTML = displayProducts.map(generateBasicProductCard).join('');
    } catch (err) {
        console.error(err);
        DOM.grid.innerHTML = '<p class="life-category-empty">Грешка при зареждане на категорията. <a href="life.html">Към началната страница</a></p>';
    }
}

main();
