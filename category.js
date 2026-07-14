import { API_URL } from './config.js';
import {
    findCategoryComponent,
    filterCatalogProducts,
    sortProductsByDisplayOrder
} from './product-visibility.js';

const DOM = {
    title: document.getElementById('category-title'),
    description: document.getElementById('category-description'),
    grid: document.getElementById('category-grid'),
    backLink: document.getElementById('category-back-link'),
    header: {
        brandName: document.getElementById('header-brand-name'),
        brandSlogan: document.getElementById('header-brand-slogan'),
        navLinks: document.getElementById('main-nav-links'),
        cartCount: document.getElementById('cart-count')
    },
    footer: {
        gridContainer: document.getElementById('footer-grid-container'),
        copyrightContainer: document.getElementById('footer-copyright-container')
    },
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
    return JSON.parse(localStorage.getItem('cart') || '[]');
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
        ? `<span class="site-catalog-brand">${escapeHtml(publicData.brand)}</span>`
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
    <a href="product.html?id=${encodeURIComponent(productId)}" class="site-catalog-card fade-in-up" data-product-id="${escapeHtml(productId)}">
        <div class="site-catalog-image">
            ${publicData.image_url
                ? `<img src="${escapeHtml(publicData.image_url)}" alt="${escapeHtml(publicData.name)}" loading="lazy" decoding="async">`
                : '<div class="site-catalog-no-image" aria-hidden="true"></div>'}
        </div>
        <div class="site-catalog-body">
            ${brandLabel}
            <h3 class="site-catalog-title">${escapeHtml(publicData.name)}</h3>
            ${cardTagline ? `<p class="site-catalog-tagline">${escapeHtml(cardTagline)}</p>` : ''}
            <div class="site-catalog-price">${priceHTML}</div>
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
        DOM.footer.copyrightContainer.innerHTML = `<p>${escapeHtml(footer.copyright || settings.site_name || 'ДА ОТСЛАБНА')}</p>`;
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
    const categoryId = params.get('category') || params.get('id') || '';
    const componentId = params.get('component') || '';
    if (!categoryId && !componentId) {
        DOM.grid.innerHTML = '<p class="site-category-empty">Липсва категория. <a href="index.html">Към началната страница</a></p>';
        return;
    }

    try {
        const pageDirty = document.cookie.split(';').some(c => c.trim() === 'page_dirty=1');
        if (pageDirty) document.cookie = 'page_dirty=; Max-Age=0; path=/';
        const response = await fetch(`${API_URL}/page_content.json`, {
            cache: pageDirty ? 'no-store' : 'default'
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();

        renderMinimalHeader(data.settings, data.navigation);
        renderMinimalFooter(data.settings, data.footer);

        const cmsCategory = findCategoryComponent(data.page_content, { categoryId, componentId });

        if (!cmsCategory) {
            DOM.grid.innerHTML = '<p class="site-category-empty">Категорията не е намерена. <a href="index.html">Към началната страница</a></p>';
            return;
        }

        const title = cmsCategory.title || categoryId || 'Категория';
        const description = cmsCategory.description || '';

        document.title = `${title} - ДА ОТСЛАБНА`;
        DOM.title.textContent = title;
        DOM.description.textContent = description;
        if (DOM.backLink) {
            DOM.backLink.href = cmsCategory.id ? `index.html#${cmsCategory.id}` : 'index.html';
        }

        const catalogProducts = filterCatalogProducts(
            sortProductsByDisplayOrder(cmsCategory.products)
        );

        if (!catalogProducts.length) {
            DOM.grid.innerHTML = '<p class="site-category-empty">Няма допълнителни продукти в тази категория. Маркирайте продукти като „каталог“ от админ панела.</p>';
            return;
        }

        const cards = catalogProducts.map(generateBasicProductCard).filter(Boolean);
        if (!cards.length) {
            DOM.grid.innerHTML = '<p class="site-category-empty">Продуктите нямат публични данни за показване.</p>';
            return;
        }

        DOM.grid.innerHTML = cards.join('');
    } catch (err) {
        console.error(err);
        DOM.grid.innerHTML = '<p class="site-category-empty">Грешка при зареждане на категорията. <a href="index.html">Към началната страница</a></p>';
    }
}

main();
