// =======================================================
//          1. ИНИЦИАЛИЗАЦИЯ И ГЛОБАЛНИ ЕЛЕМЕНТИ
// =======================================================

import { API_URL } from './config.js';

const DOM = {
    mainContainer: document.getElementById('main-content-container'),
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
    body: document.body,
    questModal: {
        backdrop: document.getElementById('quest-modal-backdrop'),
        container: document.getElementById('quest-modal-container'),
        iframe: document.getElementById('quest-modal-iframe')
    },
    toastContainer: document.getElementById('toast-container')
};

const promoBanner = document.querySelector('.promo-banner');

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

const updatePromoBannerOffset = () => {
    const bannerHeight = promoBanner ? promoBanner.getBoundingClientRect().height : 0;
    document.documentElement.style.setProperty('--promo-banner-height', `${bannerHeight}px`);
    document.documentElement.style.setProperty('--double-promo-banner-height', `${bannerHeight}px`);
};

updatePromoBannerOffset();
window.addEventListener('resize', debounce(updatePromoBannerOffset, 150));
window.addEventListener('load', updatePromoBannerOffset);

// HTML escaping utility to prevent XSS attacks
function escapeHtml(unsafe) {
    if (unsafe === null || unsafe === undefined) return '';
    return String(unsafe)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


// =======================================================
//          2. ГЕНЕРАТОРИ НА HTML (GENERATOR FUNCTIONS)
// =======================================================

const generateEffectBar = effect => `
    <div class="effect-bar-group">
        <div class="effect-label">${escapeHtml(effect.label)}</div>
        <div class="effect-bar-container">
            <div class="effect-bar" data-width="${Number(effect.value)}%">${(effect.value / 10).toFixed(1)} / 10</div>
        </div>
    </div>`;

// --- START: MODIFIED FUNCTION ---
// Product cards are now clickable links that navigate to product detail page
const generateProductCard = (product) => {
    // Проверка за сигурност: ако продуктът няма public_data, не го рендираме.
    if (!product.public_data) {
        console.warn(`Продукт с ID '${product.product_id}' няма 'public_data' и няма да бъде рендиран.`);
        return '';
    }

    const publicData = product.public_data;
    const inventory = product.system_data?.inventory ?? 0;
    const productId = product.product_id;
    const variants = publicData.variants || [];
    const availableVariants = variants.filter(v => v.available !== false && typeof v.price === 'number');
    const variantBadge = variants.length > 1 
        ? `<span class="variant-badge">${variants.length} вкуса</span>` 
        : '';
    const brandLabel = publicData.brand 
        ? `<span class="brand-label">${escapeHtml(publicData.brand)}</span>` 
        : '';

    // For products with multiple variants at different prices, show "от X.XX €"
    let priceDisplay;
    if (availableVariants.length > 1) {
        const prices = availableVariants.map(v => v.price);
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        if (minPrice < maxPrice) {
            priceDisplay = `<span class="price-from">от</span> ${Number(minPrice).toFixed(2)} €`;
        } else {
            priceDisplay = `${Number(minPrice).toFixed(2)} €`;
        }
    } else if (availableVariants.length === 1) {
        priceDisplay = `${Number(availableVariants[0].price).toFixed(2)} €`;
    } else {
        priceDisplay = typeof publicData.price === 'number' ? `${Number(publicData.price).toFixed(2)} €` : '';
    }

    return `
    <a href="product.html?id=${encodeURIComponent(productId)}" class="product-card fade-in-up" data-product-id="${escapeHtml(productId)}" data-brand="${escapeHtml(publicData.brand || '')}" data-price="${Number(publicData.price)}" data-goals="${escapeHtml((product.system_data?.goals || []).join(','))}">
        ${publicData.image_url ? `<div class="product-image">${variantBadge}<img src="${escapeHtml(publicData.image_url)}" alt="${escapeHtml(publicData.name)} - ${escapeHtml(publicData.tagline)}" loading="lazy" decoding="async"></div>` : ''}
        <div class="card-content">
            ${brandLabel}
            <div class="product-title"><h3>${escapeHtml(publicData.name)}</h3><p>${escapeHtml(publicData.tagline)}</p></div>
            <div class="product-price">${priceDisplay}</div>
            <div class="effects-container">
                ${(publicData.effects || []).map(generateEffectBar).join('')}
            </div>
        </div>
    </a>`;
}
// --- END: MODIFIED FUNCTION ---


// Helper function to generate SVG icons for stats
const getStatIconSVG = (iconName) => {
    const icons = {
        'users': '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path>',
        'chart': '<line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line>',
        'leaf': '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"></path><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"></path>',
        'heart': '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>',
        'star': '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>',
        'shield': '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>',
        'award': '<circle cx="12" cy="8" r="7"></circle><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline>',
        'trophy': '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path><path d="M4 22h16"></path><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path>'
    };
    
    return icons[iconName] || '';
};

const generateHeroHTML = component => {
    // Build style attribute for custom background
    let heroStyle = '';
    let heroClass = '';
    
    // Check background_type field to determine what to apply
    const bgType = component.background_type || 'default';
    
    if (bgType === 'image' && component.background_image) {
        // Validate URL to prevent CSS injection and XSS
        const imageUrl = escapeHtml(component.background_image);
        // Explicitly block dangerous protocols
        const hasDangerousProtocol = imageUrl.toLowerCase().startsWith('data:') || 
                                     imageUrl.toLowerCase().startsWith('javascript:') ||
                                     imageUrl.toLowerCase().startsWith('vbscript:');
        // Only allow safe URLs
        const isValidUrl = !hasDangerousProtocol && (
            imageUrl.startsWith('https://') || 
            imageUrl.startsWith('http://') ||
            (imageUrl.startsWith('/') && (imageUrl.startsWith('/images/') || imageUrl.startsWith('/assets/')))
        );
        if (isValidUrl) {
            heroClass = ' hero-custom-bg';
            heroStyle = ` data-bg-image="true" style="background-image: url('${imageUrl}');"`;
        }
    } else if (bgType === 'custom_gradient' && component.background_gradient) {
        // Validate gradient - strict character set for security
        const gradient = escapeHtml(component.background_gradient);
        // Only allow safe characters: alphanumeric, spaces, commas, periods, %, #, (), and hyphens
        const gradientPattern = /^(linear-gradient|radial-gradient|conic-gradient|repeating-linear-gradient|repeating-radial-gradient)\([a-zA-Z0-9\s,%.#()-]+\)$/;
        if (gradientPattern.test(gradient)) {
            heroClass = ' hero-custom-bg';
            heroStyle = ` style="background: ${gradient};"`;
        }
    }
    // If bgType is 'default' or validation fails, use the default theme-based gradient (no custom class/style)
    
    // Validate CSS selector for scroll targets (prevent XSS in onclick)
    // Use allowlist approach - only permit known safe selectors
    function validateSelector(selector) {
        const allowedSelectors = [
            '#products', '#weight-loss-products', '#fat-burners', '#all-products',
            '#benefits', '#timeline', '#ingredients', '#testimonials',
            '#faq', '#guarantee', '#contact', '#hero', '#about'
        ];
        return allowedSelectors.includes(selector) ? selector : '#products';
    }
    
    // Get buttons configuration with defaults
    const buttons = component.buttons || {};
    const primaryBtn = buttons.primary || { text: 'Разгледай продуктите', action: 'scroll', target: '#products' };
    const secondaryBtn = buttons.secondary || { text: 'Научи повече', action: 'link', target: 'about-us.html' };
    
    // Generate primary button (scroll or link)
    let primaryButtonHTML = '';
    if (primaryBtn.action === 'link') {
        primaryButtonHTML = `<a href="${escapeHtml(primaryBtn.target)}" class="btn-hero-primary">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px;">
                <circle cx="9" cy="21" r="1"></circle>
                <circle cx="20" cy="21" r="1"></circle>
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
            </svg>
            ${escapeHtml(primaryBtn.text)}
        </a>`;
    } else {
        // Validate selector for security before using in onclick
        const safeSelector = validateSelector(primaryBtn.target);
        primaryButtonHTML = `<button class="btn-hero-primary" onclick="document.querySelector('${safeSelector}')?.scrollIntoView({behavior: 'smooth'})">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px;">
                <circle cx="9" cy="21" r="1"></circle>
                <circle cx="20" cy="21" r="1"></circle>
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
            </svg>
            ${escapeHtml(primaryBtn.text)}
        </button>`;
    }
    
    // Generate secondary button (scroll or link)
    let secondaryButtonHTML = '';
    if (secondaryBtn.action === 'link') {
        secondaryButtonHTML = `<a href="${escapeHtml(secondaryBtn.target)}" class="btn-hero-secondary">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px;">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="16" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
            ${escapeHtml(secondaryBtn.text)}
        </a>`;
    } else {
        // Validate selector for security before using in onclick
        const safeSelector = validateSelector(secondaryBtn.target);
        secondaryButtonHTML = `<button class="btn-hero-secondary" onclick="document.querySelector('${safeSelector}')?.scrollIntoView({behavior: 'smooth'})">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px;">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="16" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
            ${escapeHtml(secondaryBtn.text)}
        </button>`;
    }
    
    // Get stats configuration with defaults
    const stats = component.stats || [
        { value: '2,840+', label: 'Доволни клиенти', icon: 'users' },
        { value: '98%', label: 'Успеваемост', icon: 'chart' },
        { value: '100%', label: 'Естествени съставки', icon: 'leaf' }
    ];
    
    const statsHTML = stats.map(stat => `
        <div class="stat-item">
            ${stat.icon ? `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="stat-icon">
                ${getStatIconSVG(stat.icon)}
            </svg>` : ''}
            <strong>${escapeHtml(stat.value)}</strong>
            <span>${escapeHtml(stat.label)}</span>
        </div>
    `).join('');
    
    // Get trust badges configuration with defaults
    const trustBadges = component.trust_badges || [
        { text: 'Клинично тествано' },
        { text: 'GMP сертифицирано' },
        { text: '30 дни гаранция' }
    ];
    
    const trustBadgesHTML = trustBadges.map(badge => `
        <div class="trust-badge">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: inline-block; vertical-align: middle; margin-right: 4px;">
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            ${escapeHtml(badge.text)}
        </div>
    `).join('');
    
    return `
    <header class="hero-section${heroClass}"${heroStyle}>
        <div class="container">
            <div class="hero-content">
                <h1>${escapeHtml(component.title)}</h1>
                <p>${escapeHtml(component.subtitle)}</p>
                <div class="hero-cta-group">
                    ${primaryButtonHTML}
                    ${secondaryButtonHTML}
                </div>
                <div class="hero-stats">
                    ${statsHTML}
                </div>
                <div class="hero-trust-badges">
                    ${trustBadgesHTML}
                </div>
            </div>
        </div>
    </header>`;
};

// --- START: MODIFIED FUNCTION ---
const generateProductCategoryHTML = (component, index) => {
    const isCollapsible = component.options.is_collapsible;
    const isExpanded = component.options.is_expanded_by_default;
    const sectionId = component.id || component.component_id || `category-${index}`;
    const productGridId = `product-grid-${sectionId}`;
    const enableFilters = component.options && component.options.enable_filters;
    
    // Sort products by display_order if it exists, otherwise maintain current order
    const sortedProducts = (component.products || []).slice().sort((a, b) => {
        const orderA = a.display_order !== undefined ? a.display_order : 999999;
        const orderB = b.display_order !== undefined ? b.display_order : 999999;
        return orderA - orderB;
    });

    // Build filter bar HTML if enabled
    let filterBarHTML = '';
    if (enableFilters) {
        // Extract unique brands
        const brands = [...new Set(sortedProducts.map(p => p.public_data?.brand).filter(Boolean))].sort();
        // Extract unique goals
        const goalsSet = new Set();
        sortedProducts.forEach(p => {
            (p.system_data?.goals || []).forEach(g => goalsSet.add(g));
        });
        const goals = [...goalsSet].sort();

        filterBarHTML = `
        <div class="product-filter-bar" data-grid-id="${productGridId}">
            <div class="filter-row">
                <div class="filter-group">
                    <label for="filter-brand-${index}">Марка</label>
                    <select id="filter-brand-${index}" class="filter-select" data-filter="brand">
                        <option value="">Всички марки</option>
                        ${brands.map(b => `<option value="${escapeHtml(b)}">${escapeHtml(b)}</option>`).join('')}
                    </select>
                </div>
                <div class="filter-group">
                    <label for="filter-goal-${index}">Цел</label>
                    <select id="filter-goal-${index}" class="filter-select" data-filter="goal">
                        <option value="">Всички цели</option>
                        ${goals.map(g => `<option value="${escapeHtml(g)}">${escapeHtml(g)}</option>`).join('')}
                    </select>
                </div>
                <div class="filter-group">
                    <label for="filter-sort-${index}">Подреди по</label>
                    <select id="filter-sort-${index}" class="filter-select" data-filter="sort">
                        <option value="default">По подразбиране</option>
                        <option value="price-asc">Цена (ниска → висока)</option>
                        <option value="price-desc">Цена (висока → ниска)</option>
                        <option value="effectiveness">Ефективност</option>
                    </select>
                </div>
                <div class="filter-group">
                    <label for="filter-search-${index}">Търсене</label>
                    <input type="text" id="filter-search-${index}" class="filter-input" data-filter="search" placeholder="Търси продукт...">
                </div>
            </div>
            <div class="filter-results-count" id="filter-count-${productGridId}"></div>
        </div>`;
    }

    // For filterable categories with many products, show limited initially
    const INITIAL_SHOW = enableFilters ? 24 : sortedProducts.length;
    const initialProducts = sortedProducts.slice(0, INITIAL_SHOW);
    const hasMore = sortedProducts.length > INITIAL_SHOW;
    
    return `
    <section id="${sectionId}" class="category-section fade-in-up ${isCollapsible ? '' : 'not-collapsible'}">
        <div class="container">
             <div class="category-header" ${isCollapsible ? `role="button" aria-expanded="${isExpanded}" aria-controls="${productGridId}" tabindex="0"` : ''}>
                <h2 class="category-title">
                    ${component.title}
                    ${isCollapsible ? '<span class="category-expand-icon"></span>' : ''}
                </h2>
                ${component.image ? `<div class="category-image-wrapper"><img src="${component.image}" alt="${component.title}" loading="lazy"></div>` : ''}
                ${component.description ? `<p class="category-description">${component.description}</p>` : ''}
            </div>
            ${filterBarHTML}
            <div class="product-grid" id="${productGridId}" ${enableFilters ? `data-all-products='${encodeProductsForAttr(sortedProducts)}' data-page-size="24"` : ''}>
                ${initialProducts.map(generateProductCard).join('')}
            </div>
            ${hasMore ? `<div class="load-more-container" id="load-more-${productGridId}">
                <button class="btn-load-more" data-grid-id="${productGridId}">Зареди още продукти (${sortedProducts.length - INITIAL_SHOW} остават)</button>
            </div>` : ''}
        </div>
    </section>`;
}

// Encode products data for the filterable grid (stores as base64 JSON to avoid HTML issues)
function encodeProductsForAttr(products) {
    try {
        // Store minimal data needed for filtering
        const minimalProducts = products.map(p => ({
            product_id: p.product_id,
            name: p.public_data?.name || '',
            price: p.public_data?.price || 0,
            brand: p.public_data?.brand || '',
            image_url: p.public_data?.image_url || '',
            tagline: p.public_data?.tagline || '',
            effects: p.public_data?.effects || [],
            goals: p.system_data?.goals || [],
            variants: p.public_data?.variants || [],
            inventory: p.system_data?.inventory ?? 0
        }));
        return btoa(new TextEncoder().encode(JSON.stringify(minimalProducts)).reduce((s, b) => s + String.fromCharCode(b), ''));
    } catch (e) {
        return '';
    }
}
// --- END: MODIFIED FUNCTION ---

const generateInfoCardHTML = component => `
    <section ${component.id ? `id="${component.id}"` : ''} class="info-card-section fade-in-up ${'image-align-' + (component.options.image_align || 'left')}">
        <div class="container">
            <div class="info-card-image">
                <img src="${component.image}" alt="${component.title}" loading="lazy">
            </div>
            <div class="info-card-content">
                <h2>${component.title}</h2>
                <p>${component.content}</p>
                ${component.button && component.button.text ? `<a href="${component.button.url}" class="btn-primary">${component.button.text}</a>` : ''}
            </div>
        </div>
    </section>`;

const generateBenefitsHTML = component => `
    <section id="benefits" class="section-padding">
        <div class="container">
            <div class="section-title animate-on-scroll">
                <h2>${component.title}</h2>
                ${component.subtitle ? `<p>${component.subtitle}</p>` : ''}
            </div>
            <div class="about-grid">
                ${component.image ? `<div class="about-image-placeholder animate-on-scroll">
                    <img src="${component.image}" alt="${component.title}" style="width:100%; height:100%; object-fit:cover;">
                </div>` : ''}
                <div class="about-content">
                    ${component.content_title ? `<h3 class="animate-on-scroll">${component.content_title}</h3>` : ''}
                    <div class="benefits">
                        ${(component.benefits || []).map(benefit => `
                            <div class="benefit-item animate-on-scroll">
                                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    ${benefit.icon === 'check' ? '<polyline points="20 6 9 17 4 12"></polyline>' : 
                                      benefit.icon === 'fire' ? '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path>' :
                                      '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>'}
                                </svg>
                                <div>
                                    <h4>${benefit.title}</h4>
                                    <p>${benefit.text}</p>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        </div>
    </section>`;

const generateTimelineHTML = component => `
    <section id="effects" class="section-padding section-bg">
        <div class="container">
            <div class="section-title animate-on-scroll">
                <h2>${component.title}</h2>
                ${component.subtitle ? `<p>${component.subtitle}</p>` : ''}
            </div>
            <div class="timeline">
                ${(component.steps || []).map((step, index) => `
                    <div class="timeline-item animate-on-scroll">
                        <div class="timeline-content">
                            <h4>${index + 1}. ${step.title}</h4>
                            <p>${step.text}</p>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    </section>`;

const generateIngredientsHTML = component => `
    <section id="ingredients" class="section-padding">
        <div class="container">
            <div class="section-title animate-on-scroll">
                <h2>${component.title}</h2>
                ${component.subtitle ? `<p>${component.subtitle}</p>` : ''}
            </div>
            <div class="ingredients-grid">
                ${(component.ingredients || []).map(ingredient => `
                    <div class="ingredient-card animate-on-scroll" tabindex="0">
                        <div class="card-inner">
                            <div class="card-front">
                                <h5>${ingredient.name}</h5>
                                <span>${ingredient.amount}</span>
                            </div>
                            <div class="card-back">
                                <p>${ingredient.description}</p>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    </section>`;

const generateTestimonialsHTML = component => `
    <section id="testimonials" class="section-padding">
        <div class="container">
            <div class="section-title animate-on-scroll">
                <h2>${component.title}</h2>
                ${component.subtitle ? `<p>${component.subtitle}</p>` : ''}
            </div>
            <div class="testimonials-grid">
                ${(component.testimonials || []).map(testimonial => `
                    <div class="testimonial-card animate-on-scroll">
                        <div class="stars" aria-label="${testimonial.rating} out of 5 stars">${'★'.repeat(testimonial.rating)}${'☆'.repeat(5 - testimonial.rating)}</div>
                        <p class="testimonial-text">"${testimonial.text}"</p>
                        <div class="testimonial-author">
                            <strong>${testimonial.author}</strong>
                            ${testimonial.location ? `<span>${testimonial.location}</span>` : ''}
                        </div>
                        ${testimonial.result ? `<div class="result-badge">${testimonial.result}</div>` : ''}
                    </div>
                `).join('')}
            </div>
        </div>
    </section>`;

const generateFAQHTML = component => `
    <section id="faq" class="section-padding">
        <div class="container">
            <div class="section-title animate-on-scroll">
                <h2>${component.title}</h2>
                ${component.subtitle ? `<p>${component.subtitle}</p>` : ''}
            </div>
            <div class="faq-container">
                ${(component.questions || []).map(faq => `
                    <div class="faq-item animate-on-scroll">
                        <div class="faq-question" role="button" aria-expanded="false" tabindex="0">
                            <h4>${faq.question}</h4>
                            <span class="faq-toggle">+</span>
                        </div>
                        <div class="faq-answer">
                            <p>${faq.answer}</p>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    </section>`;

const generateGuaranteeHTML = component => `
    <section class="guarantee-section section-padding">
        <div class="container">
            <div class="section-title animate-on-scroll">
                <h2>${component.title}</h2>
                ${component.subtitle ? `<p>${component.subtitle}</p>` : ''}
            </div>
            <div class="guarantee-grid">
                ${(component.items || []).map(item => {
                    const iconSVG = {
                        'shield': '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>',
                        'truck': '<rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle>',
                        'certificate': '<circle cx="12" cy="8" r="7"></circle><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline>',
                        'support': '<path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"></path><circle cx="6.5" cy="11.5" r="1.5"></circle><circle cx="9.5" cy="7.5" r="1.5"></circle><circle cx="14.5" cy="7.5" r="1.5"></circle><circle cx="17.5" cy="11.5" r="1.5"></circle>'
                    };
                    return `
                    <div class="guarantee-card animate-on-scroll">
                        <div class="guarantee-icon">
                            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                ${iconSVG[item.icon] || iconSVG['shield']}
                            </svg>
                        </div>
                        <h4>${item.title}</h4>
                        <p>${item.description}</p>
                    </div>
                `}).join('')}
            </div>
        </div>
    </section>`;

const generateContactHTML = component => `
    <section id="order" class="section-padding">
        <div class="container">
            <div class="section-title animate-on-scroll">
                <h2>${component.title}</h2>
                ${component.subtitle ? `<p>${component.subtitle}</p>` : ''}
            </div>
            <div class="order-grid">
                <div class="contact-details animate-on-scroll">
                    <h4>Информация за контакт</h4>
                    <p>За повече информация и поръчки, свържете се с нас.</p>
                    <ul>
                        ${component.email ? `<li><strong>Имейл:</strong> ${component.email}</li>` : ''}
                        ${component.phone ? `<li><strong>Телефон:</strong> ${component.phone}</li>` : ''}
                        ${component.address ? `<li><strong>Адрес:</strong> ${component.address}</li>` : ''}
                    </ul>
                    ${component.social ? `
                        <h4>Последвайте ни</h4>
                        <div class="social-links">
                            ${component.social.facebook ? `<a href="${component.social.facebook}" aria-label="Facebook">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path></svg>
                            </a>` : ''}
                            ${component.social.instagram ? `<a href="${component.social.instagram}" aria-label="Instagram">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
                            </a>` : ''}
                        </div>
                    ` : ''}
                </div>
                <form id="order-form" class="order-form animate-on-scroll">
                    <h4>Свържете се с нас</h4>
                    <div class="form-group">
                        <label for="contact-name">Име *</label>
                        <input type="text" id="contact-name" name="name" required>
                    </div>
                    <div class="form-group">
                        <label for="contact-email">Имейл *</label>
                        <input type="email" id="contact-email" name="email" required>
                    </div>
                    <div class="form-group">
                        <label for="contact-phone">Телефон</label>
                        <input type="tel" id="contact-phone" name="phone">
                    </div>
                    <div class="form-group">
                        <label for="contact-message">Съобщение *</label>
                        <textarea id="contact-message" name="message" rows="5" required></textarea>
                    </div>
                    <button type="submit" class="btn btn-primary btn-full">Изпрати запитване</button>
                </form>
            </div>
        </div>
    </section>`;


// =======================================================
//          3. УПРАВЛЕНИЕ НА КОЛИЧКА (CART LOGIC)
// =======================================================

const getCart = () => JSON.parse(localStorage.getItem('cart') || '[]');
const saveCart = cart => localStorage.setItem('cart', JSON.stringify(cart));

const saveNavigationState = (productId = null) => {
    sessionStorage.setItem('indexScrollPosition', window.scrollY.toString());
    if (productId) {
        sessionStorage.setItem('lastViewedProduct', productId);
    } else {
        sessionStorage.removeItem('lastViewedProduct');
    }
    const categoryStates = {};
    document.querySelectorAll('.category-section[id] .category-header[aria-expanded]').forEach(header => {
        const section = header.closest('.category-section');
        if (section && section.id) categoryStates[section.id] = header.getAttribute('aria-expanded');
    });
    sessionStorage.setItem('categoryStates', JSON.stringify(categoryStates));
};

const updateCartCount = () => {
    const count = getCart().reduce((acc, item) => acc + item.quantity, 0);
    
    // Update header cart count
    if (DOM.header.cartCount) {
        DOM.header.cartCount.textContent = count;
    }
    
    // Update mobile fixed cart count
    const cartCountMobile = document.getElementById('cart-count-mobile');
    if (cartCountMobile) {
        cartCountMobile.textContent = count;
    }
    
    // Update mobile menu cart count
    const cartCountMenu = document.getElementById('cart-count-menu');
    if (cartCountMenu) {
        cartCountMenu.textContent = count;
    }
};

const showToast = (message, type = 'info', duration = 3000) => {
    if (!DOM.toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    DOM.toastContainer.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('fade-out');
        toast.addEventListener('transitionend', () => toast.remove());
    }, duration);
};

const showAddToCartFeedback = (productId) => {
    const card = document.querySelector(`.product-card[data-product-id="${productId}"]`);
    if (!card) return;
    const btn = card.querySelector('.add-to-cart-btn');
    if (!btn || btn.classList.contains('added')) return;
    
    btn.classList.add('added');
    const originalHTML = btn.innerHTML;
    btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: inline-block; vertical-align: middle; margin-right: 4px;"><polyline points="20 6 9 17 4 12"></polyline></svg>Добавено`;
    
    setTimeout(() => {
        btn.classList.remove('added');
        btn.innerHTML = originalHTML;
    }, 2000);
}

const addToCart = (id, name, price, inventory, image) => {
    const maxQty = Number(inventory) || 0;
    const cart = getCart();
    const idx = cart.findIndex(i => i.id === id);
    if (idx > -1) {
        if (maxQty && cart[idx].quantity >= maxQty) {
            showToast('Няма достатъчна наличност.', 'error');
            return;
        }
        cart[idx].quantity++;
        // Update image if it's missing in existing cart item
        if (!cart[idx].image && image) {
            cart[idx].image = image;
        }
    } else {
        if (maxQty === 0) {
            showToast('Продуктът е изчерпан.', 'error');
            return;
        }
        cart.push({ id, name, price: Number(price), quantity: 1, inventory: maxQty, image: image || '' });
    }
    saveCart(cart);
    updateCartCount();
    showAddToCartFeedback(id);
};


// =======================================================
//          4. РЕНДЪРИ НА СЪДЪРЖАНИЕ (RENDERERS)
// =======================================================

function renderHeader(settings, navigation, pageContent) {
    document.title = settings.site_name;
    
    // Store logo URLs for theme switching
    window.logoSettings = {
        lightLogo: settings.logo_url_light || settings.logo_url.replace('logo.png', 'logoblack.png'),
        darkLogo: settings.logo_url_dark || settings.logo_url
    };
    
    // Cache logo URLs in localStorage for instant loading on next visit
    try {
        localStorage.setItem('cachedLogoLight', window.logoSettings.lightLogo);
        localStorage.setItem('cachedLogoDark', window.logoSettings.darkLogo);
    } catch (e) {
        console.warn('Could not cache logo URLs:', e);
    }
    
    // Set initial logo based on current theme
    updateLogoForTheme();
    
    DOM.header.logoImg.alt = `${settings.site_name} Logo`;
    DOM.header.logoImg.style.display = 'block'; // Show the logo
    DOM.header.brandName.textContent = settings.site_name;
    DOM.header.brandSlogan.textContent = settings.site_slogan;

    // Build navigation: auto-generate from product categories + keep non-category links
    const navItems = buildNavigationItems(navigation, pageContent);

    // Separate category anchor-links from static page links
    const categoryItems = navItems.filter(item => item.link && item.link.startsWith('#'));
    const pageItems = navItems.filter(item => !item.link || !item.link.startsWith('#'));

    let navItemsHTML = '';

    // Group all category items under a single "Категории" dropdown
    if (categoryItems.length > 0) {
        const dropdownItems = categoryItems.map(item =>
            `<li role="none"><a href="${item.link}" role="menuitem">${item.text}</a></li>`
        ).join('');
        navItemsHTML += `<li class="nav-item has-dropdown">` +
            `<button class="nav-dropdown-toggle" aria-expanded="false" aria-haspopup="true">` +
            `Категории` +
            `<svg class="dropdown-arrow" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"></polyline></svg>` +
            `</button>` +
            `<ul class="nav-dropdown-menu" role="menu">${dropdownItems}</ul>` +
            `</li>`;
    }

    // Add non-category page links as flat items
    navItemsHTML += pageItems.map(item =>
        `<li><a href="${item.link}">${item.text}</a></li>`
    ).join('');

    const persistentLis = DOM.header.navLinks.querySelectorAll('li:nth-last-child(-n+2)');
    DOM.header.navLinks.innerHTML = navItemsHTML;
    persistentLis.forEach(li => DOM.header.navLinks.appendChild(li));

    // Activate dropdown behaviour after DOM is updated
    initNavDropdowns();

    updateCartCount();
}

/**
 * Builds navigation items by auto-including all product categories from page_content.
 * Product categories are derived from actual page_content components (source of truth),
 * then non-category links from the static navigation array are appended.
 * This ensures the menu always stays in sync with the actual categories.
 */
function buildNavigationItems(navigation, pageContent) {
    const navItems = [];
    
    if (Array.isArray(pageContent)) {
        // Extract visible product categories from page_content (the source of truth)
        pageContent.forEach(component => {
            if (component.type === 'product_category' && component.title && !component.is_hidden) {
                const anchor = component.id || component.component_id;
                if (anchor) {
                    navItems.push({
                        text: component.title,
                        link: `#${anchor}`
                    });
                }
            }
        });
    }
    
    // Add non-category links from static navigation (e.g., "За нас", "Контакти")
    if (Array.isArray(navigation)) {
        navigation.forEach(item => {
            // Skip items that point to a product category section (already added above)
            if (item.link && item.link.startsWith('#')) return;
            navItems.push(item);
        });
    }
    
    return navItems;
}

/**
 * Initialises hover (desktop) and click (mobile) behaviour for .has-dropdown nav items.
 * Must be called after the nav HTML has been injected into the DOM.
 */
let _navDropdownOutsideClickAttached = false;
function initNavDropdowns() {
    document.querySelectorAll('.nav-item.has-dropdown').forEach(parent => {
        const toggle = parent.querySelector('.nav-dropdown-toggle');
        const menu = parent.querySelector('.nav-dropdown-menu');
        if (!toggle || !menu) return;

        // Desktop: open on hover
        parent.addEventListener('mouseenter', () => {
            if (window.innerWidth > 992) {
                menu.classList.add('open');
                toggle.setAttribute('aria-expanded', 'true');
            }
        });
        parent.addEventListener('mouseleave', () => {
            if (window.innerWidth > 992) {
                menu.classList.remove('open');
                toggle.setAttribute('aria-expanded', 'false');
            }
        });

        // Mobile / click: toggle open/close
        toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = menu.classList.contains('open');
            // Close any other open dropdown first
            document.querySelectorAll('.nav-item.has-dropdown .nav-dropdown-menu.open').forEach(m => {
                m.classList.remove('open');
                const t = m.previousElementSibling;
                if (t) t.setAttribute('aria-expanded', 'false');
            });
            if (!isOpen) {
                menu.classList.add('open');
                toggle.setAttribute('aria-expanded', 'true');
            }
        });
    });

    // Attach the outside-click handler only once, regardless of how many times
    // renderHeader() is called; the handler always queries the live DOM.
    if (!_navDropdownOutsideClickAttached) {
        _navDropdownOutsideClickAttached = true;
        document.addEventListener('click', () => {
            document.querySelectorAll('.nav-item.has-dropdown .nav-dropdown-menu.open').forEach(menu => {
                menu.classList.remove('open');
                const toggle = menu.previousElementSibling;
                if (toggle) toggle.setAttribute('aria-expanded', 'false');
            });
        });
    }
}

function renderPromoBanner(settings) {
    const promoBanner = document.querySelector('.promo-banner');
    if (!promoBanner) return;
    
    const promoContent = promoBanner.querySelector('.promo-content p');
    if (!promoContent) return;
    
    // Get the promo text from settings
    const promoText = settings.promo_banner?.text || 'СПЕЦИАЛНА ОФЕРТА: До 30% отстъпка при поръчка над 100 €!';
    
    // Keep the icon and strong tag, update only the text
    promoContent.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: inline-block; vertical-align: middle; margin-right: 4px;">
            <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path>
        </svg>
        ${escapeHtml(promoText)} <span class="promo-timer" id="promo-timer"></span>
    `;
}

// Helper function to initialize logo from cached settings
function initializeLogoFromCache() {
    if (window.__initialLogoSettings && !window.logoSettings) {
        window.logoSettings = {
            lightLogo: window.__initialLogoSettings.lightLogo,
            darkLogo: window.__initialLogoSettings.darkLogo
        };
        updateLogoForTheme();
        return true;
    }
    return false;
}

// Helper function to update logo based on current theme
function updateLogoForTheme() {
    // Try to use cached logo settings first for instant display
    if (!window.logoSettings && window.__initialLogoSettings) {
        window.logoSettings = {
            lightLogo: window.__initialLogoSettings.lightLogo,
            darkLogo: window.__initialLogoSettings.darkLogo
        };
    }
    
    if (!window.logoSettings) return;
    
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const logoUrl = currentTheme === 'dark' ? window.logoSettings.darkLogo : window.logoSettings.lightLogo;
    
    if (DOM.header.logoImg) {
        DOM.header.logoImg.src = encodeURI(logoUrl);
    }
    
    // Also update footer logo if it exists
    const footerLogo = document.querySelector('.footer-logo-container img');
    if (footerLogo) {
        footerLogo.src = encodeURI(logoUrl);
    }
}

function renderMainContent(pageContent) {
    if (!DOM.mainContainer) return;
    
    let contentHtml = '';
    pageContent.forEach((component, index) => {
        // Filter out the individual analysis info card (containing analyzis.png image)
        // Note: The filename 'analyzis.png' is intentionally kept as-is to match the existing asset
        if (component.type === 'info_card' && component.image && component.image.includes('analyzis.png')) {
            return; // Skip rendering this component
        }
        
        // Skip hidden product categories
        if (component.type === 'product_category' && component.is_hidden) {
            return;
        }
        
        switch (component.type) {
            case 'hero_banner':
                contentHtml += generateHeroHTML(component);
                break;
            case 'product_category':
                contentHtml += generateProductCategoryHTML(component, index);
                break;
            case 'info_card':
                contentHtml += generateInfoCardHTML(component);
                break;
            case 'benefits':
                contentHtml += generateBenefitsHTML(component);
                break;
            case 'timeline':
                contentHtml += generateTimelineHTML(component);
                break;
            case 'ingredients':
                contentHtml += generateIngredientsHTML(component);
                break;
            case 'testimonials':
                contentHtml += generateTestimonialsHTML(component);
                break;
            case 'faq':
                contentHtml += generateFAQHTML(component);
                break;
            case 'guarantee':
                contentHtml += generateGuaranteeHTML(component);
                break;
            case 'contact':
                contentHtml += generateContactHTML(component);
                break;
            default:
                console.warn('Unknown component type:', component.type);
        }
    });

    DOM.mainContainer.innerHTML = contentHtml;
}

function renderFooter(settings, footer) {
    // Store logo URLs if not already done
    if (!window.logoSettings) {
        window.logoSettings = {
            lightLogo: settings.logo_url_light || settings.logo_url.replace('logo.png', 'logoblack.png'),
            darkLogo: settings.logo_url_dark || settings.logo_url
        };
    }
    
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const logoUrl = currentTheme === 'dark' ? window.logoSettings.darkLogo : window.logoSettings.lightLogo;
    
    const columnsHTML = footer.columns.map(col => {
        if (col.type === 'logo') {
            return `<div class="footer-column">
                 <a href="#" class="logo-container footer-logo-container">
                    <img src="${logoUrl}" alt="${settings.site_name} Logo">
                    <div><span class="brand-name">${settings.site_name}</span><span class="brand-slogan">${settings.site_slogan}</span></div>
                </a>
            </div>`;
        }
        if (col.type === 'links') {
            const links = col.links.map(link => `<li><a href="${link.url}">${link.text}</a></li>`).join('');
            return `<div class="footer-column"><h4>${col.title}</h4><ul>${links}</ul></div>`;
        }
        return '';
    }).join('');
    DOM.footer.gridContainer.innerHTML = columnsHTML;
    DOM.footer.copyrightContainer.innerHTML = footer.copyright_text;
}


// =======================================================
//          5. ИНИЦИАЛИЗАЦИЯ НА СЪБИТИЯ (INITIALIZERS)
// =======================================================

function initializePageInteractions(settings = {}) {
    // Handle category header click (for collapsible categories)
    document.body.addEventListener('click', e => {
        const toggleAccordion = (header) => {
            const isExpanded = header.getAttribute('aria-expanded') === 'true';
            header.setAttribute('aria-expanded', !isExpanded);
        };

        const categoryHeader = e.target.closest('.category-section:not(.not-collapsible) .category-header');
        if (categoryHeader) {
            toggleAccordion(categoryHeader);
            return;
        }
        
        // Product cards are now links, no click handler needed here
    });

    document.body.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
            const accordionHeader = e.target.closest('[role="button"][aria-expanded]');
            // Only handle category headers, not product cards
            if (accordionHeader && accordionHeader.classList.contains('category-header')) {
                e.preventDefault();
                const isExpanded = accordionHeader.getAttribute('aria-expanded') === 'true';
                accordionHeader.setAttribute('aria-expanded', !isExpanded);
            }
        }
    });


    document.querySelectorAll('.product-card').forEach(card => {
        card.addEventListener('mousemove', e => {
            const rect = card.getBoundingClientRect();
            card.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
            card.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
        });
    });

    const scrollObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                if (entry.target.classList.contains('product-card')) {
                    entry.target.querySelectorAll('.effect-bar').forEach(bar => {
                        bar.style.width = bar.dataset.width;
                        bar.classList.add('animated');
                    });
                }
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });
    document.querySelectorAll('.fade-in-up').forEach(el => scrollObserver.observe(el));

    // --- Save scroll position and category states before navigating to product page ---
    document.body.addEventListener('click', (e) => {
        const productCard = e.target.closest('.product-card');
        if (productCard) {
            const productId = productCard.getAttribute('data-product-id');
            saveNavigationState(productId);
        }
    });

    // --- Ingredient Card Flip (Lipolor style) - supports both mini and full versions ---
    document.querySelectorAll('.ingredient-card, .ingredient-card-mini, .ingredient-card-full').forEach(card => {
        const toggleFlip = () => {
            // Close all other cards first
            document.querySelectorAll('.ingredient-card.is-flipped, .ingredient-card-mini.is-flipped, .ingredient-card-full.is-flipped').forEach(otherCard => {
                if (otherCard !== card) {
                    otherCard.classList.remove('is-flipped');
                }
            });
            
            // Toggle current card
            card.classList.toggle('is-flipped');
        };

        card.addEventListener('click', toggleFlip);

        // For accessibility: allow flipping with Enter or Space key
        card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleFlip();
            }
        });
    });

    // --- FAQ Accordion Handler (Reusable function) ---
    function initFAQAccordion(itemSelector, questionSelector) {
        document.querySelectorAll(itemSelector).forEach(item => {
            const question = item.querySelector(questionSelector);
            
            if (!question) return;
            
            const toggleFAQ = () => {
                const isActive = item.classList.contains('active');
                
                // Close all other FAQ items in the same product card
                const parentCard = item.closest('.product-card');
                if (parentCard) {
                    parentCard.querySelectorAll(itemSelector).forEach(otherItem => {
                        if (otherItem !== item) {
                            otherItem.classList.remove('active');
                            const otherQuestion = otherItem.querySelector(questionSelector);
                            if (otherQuestion) {
                                otherQuestion.setAttribute('aria-expanded', 'false');
                            }
                        }
                    });
                }
                
                // Toggle current item
                if (isActive) {
                    item.classList.remove('active');
                    question.setAttribute('aria-expanded', 'false');
                } else {
                    item.classList.add('active');
                    question.setAttribute('aria-expanded', 'true');
                }
            };
            
            // Click event
            question.addEventListener('click', toggleFAQ);
            
            // Keyboard event for accessibility
            question.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleFAQ();
                }
            });
        });
    }

    // Initialize all FAQ accordion types
    initFAQAccordion('.faq-item-mini', '.faq-question-mini');
    initFAQAccordion('.faq-item-full', '.faq-question-full');

    // --- FAQ Accordion (Lipolor style) ---
    document.querySelectorAll('.faq-item').forEach(item => {
        const question = item.querySelector('.faq-question');
        
        if (!question) return;
        
        const toggleFAQ = () => {
            const isActive = item.classList.contains('active');
            
            // Close all other FAQ items
            document.querySelectorAll('.faq-item').forEach(otherItem => {
                if (otherItem !== item) {
                    otherItem.classList.remove('active');
                    const otherQuestion = otherItem.querySelector('.faq-question');
                    if (otherQuestion) {
                        otherQuestion.setAttribute('aria-expanded', 'false');
                    }
                }
            });
            
            // Toggle current item
            if (isActive) {
                item.classList.remove('active');
                question.setAttribute('aria-expanded', 'false');
            } else {
                item.classList.add('active');
                question.setAttribute('aria-expanded', 'true');
            }
        };
        
        // Click event
        question.addEventListener('click', toggleFAQ);
        
        // Keyboard event for accessibility
        question.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleFAQ();
            }
        });
    });

    // --- Contact Form Submission (Lipolor style) ---
    const orderForm = document.getElementById('order-form');
    if (orderForm) {
        orderForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const name = orderForm.querySelector('#contact-name')?.value.trim();
            const email = orderForm.querySelector('#contact-email')?.value.trim();
            const message = orderForm.querySelector('#contact-message')?.value.trim();

            if (!name || !email || !message) {
                showToast('Моля, попълнете всички задължителни полета.', 'error');
                return;
            }
            
            showToast('Благодарим за вашето запитване! Ще се свържем с вас скоро.', 'success');
            orderForm.reset();
        });
    }
}

function initializeGlobalScripts() {
    // --- Sticky Header on Scroll (Lipolor style) ---
    const header = document.querySelector('.main-header');
    
    function handleStickyHeader() {
        const stickyThreshold = 50;
        if (window.scrollY > stickyThreshold) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    }
    
    window.addEventListener('scroll', () => {
        handleStickyHeader();
        DOM.backToTopBtn.classList.toggle('visible', window.scrollY > 300);
    });

    // --- Scroll Animations (Lipolor style) ---
    function handleScrollAnimations() {
        const animatedElements = document.querySelectorAll('.animate-on-scroll');
        
        if (!animatedElements.length) return;

        const observerOptions = {
            root: null,
            threshold: 0.1,
        };

        const revealObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    // Add staggered delay for timeline items
                    if (entry.target.classList.contains('timeline-item')) {
                        const elementIndex = Array.from(animatedElements).indexOf(entry.target);
                        entry.target.style.transitionDelay = `${elementIndex * 0.15}s`;
                    }
                    
                    entry.target.classList.add('visible');
                    revealObserver.unobserve(entry.target);
                }
            });
        }, observerOptions);

        animatedElements.forEach(el => {
            revealObserver.observe(el);
        });
    }
    
    // Initialize scroll animations
    handleScrollAnimations();

    const closeMenu = () => {
        DOM.menuToggle.classList.remove('active');
        DOM.navLinksContainer.classList.remove('active');
        DOM.navOverlay.classList.remove('active');
        DOM.body.classList.remove('nav-open');
    };
    DOM.menuToggle.addEventListener('click', () => {
        DOM.menuToggle.classList.toggle('active');
        DOM.navLinksContainer.classList.toggle('active');
        DOM.navOverlay.classList.toggle('active');
        DOM.body.classList.toggle('nav-open');
    });
    DOM.navOverlay.addEventListener('click', closeMenu);
    DOM.navLinksContainer.addEventListener('click', e => {
        // Don't close the mobile nav when the user is toggling the categories dropdown
        if (e.target.closest('.nav-dropdown-toggle')) return;
        if (e.target.tagName === 'A' || e.target.closest('button')) {
            closeMenu();
        }
    });

    // --- Quest Modal ---
    // Only initialize quest modal if elements exist
    if (DOM.questModal.backdrop && DOM.questModal.container && DOM.questModal.iframe) {
        function openQuestModal(url) {
            DOM.questModal.iframe.src = url || 'quest.html';
            DOM.questModal.container.classList.add('show');
            DOM.questModal.backdrop.classList.add('show');
            DOM.body.classList.add('modal-open');
        }
        function closeQuestModal() {
            DOM.questModal.container.classList.remove('show');
            DOM.questModal.backdrop.classList.remove('show');
            DOM.questModal.iframe.src = '';
            DOM.body.classList.remove('modal-open');
        }
        DOM.questModal.backdrop.addEventListener('click', closeQuestModal);
        document.addEventListener('click', e => {
            const questLink = e.target.closest('a[href$="quest.html"]');
            if (questLink) {
                e.preventDefault();
                openQuestModal(questLink.getAttribute('href'));
            }
        });
    }

    // --- Theme Toggle ---
    const themeToggle = document.getElementById('theme-toggle');
    const themeToggleMobile = document.getElementById('theme-toggle-mobile');
    
    function setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        try {
            localStorage.setItem('theme', theme);
        } catch (e) {
            console.warn('Could not save theme preference:', e);
        }
        
        // Update logo for the new theme
        updateLogoForTheme();
        
        // Show toast notification
        const themeLabel = theme === 'dark' ? 'Тъмна тема' : 'Светла тема';
        showToast(`${themeLabel} активирана`, 'info');
    }
    
    function toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
    }
    
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }
    
    if (themeToggleMobile) {
        themeToggleMobile.addEventListener('click', toggleTheme);
    }
    
    // Listen for system theme changes
    if (window.matchMedia) {
        const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
        
        darkModeQuery.addEventListener('change', (e) => {
            // Only auto-switch if user hasn't manually set a preference
            try {
                const savedTheme = localStorage.getItem('theme');
                if (!savedTheme) {
                    const newTheme = e.matches ? 'dark' : 'light';
                    document.documentElement.setAttribute('data-theme', newTheme);
                }
            } catch (e) {
                console.warn('Could not check theme preference:', e);
            }
        });
    }

    updateCartCount();
}

function initializeScrollSpy() {
    const sections = document.querySelectorAll('section[id]');
    if (sections.length === 0) return;

    const navLinks = document.querySelectorAll('.nav-links a');
    
    const observer = new IntersectionObserver(entries => {
        let lastVisibleSectionId = null;
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                lastVisibleSectionId = entry.target.id;
            }
        });

        navLinks.forEach(link => {
            link.classList.remove('active');
            const href = link.getAttribute('href');
            if (href === `#${lastVisibleSectionId}`) {
                link.classList.add('active');
            }
        });
    }, { rootMargin: '-40% 0px -60% 0px' });

    sections.forEach(section => observer.observe(section));
}

// =======================================================
//          Apply Theme Gradients
// =======================================================
function applyThemeGradients(settings) {
    if (!settings || !settings.theme_gradients) return;
    
    const { light, dark } = settings.theme_gradients;
    const root = document.documentElement;
    
    // Validate and apply light theme gradient
    if (light && isValidGradient(light)) {
        root.style.setProperty('--theme-gradient-light', light);
    }
    
    // Validate and apply dark theme gradient
    if (dark && isValidGradient(dark)) {
        root.style.setProperty('--theme-gradient-dark', dark);
    }
}

// Validate gradient string to prevent CSS injection
function isValidGradient(gradientStr) {
    if (typeof gradientStr !== 'string') return false;
    
    // Only allow gradient functions
    const validPrefixes = ['linear-gradient', 'radial-gradient', 'conic-gradient', 'repeating-linear-gradient', 'repeating-radial-gradient'];
    const hasValidPrefix = validPrefixes.some(prefix => gradientStr.trim().startsWith(prefix + '('));
    
    if (!hasValidPrefix) return false;
    
    // Check for potentially dangerous characters or patterns
    const dangerousPatterns = [
        '<script', 'javascript:', 'expression(', 'url(', '@import', 'behavior:'
    ];
    
    const lowerStr = gradientStr.toLowerCase();
    if (dangerousPatterns.some(pattern => lowerStr.includes(pattern))) {
        console.warn('Potentially unsafe gradient string blocked:', gradientStr);
        return false;
    }
    
    return true;
}


// =======================================================
//          7. ГЛАВНА ИЗПЪЛНЯВАЩА ФУНКЦИЯ (MAIN)
// =======================================================
async function main() {
    // Initialize logo immediately using cached values if available
    initializeLogoFromCache();
    
    initializeGlobalScripts();
    
    try {
        // Try to use mock data for testing if API fails
        let response, data;
        try {
            response = await fetch(`${API_URL}/page_content.json`, {
                cache: 'default' // Use browser cache with proper revalidation
            });
            if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
            data = await response.json();
        } catch (apiError) {
            console.warn('API failed, trying mock data:', apiError);
            response = await fetch('page_content_mock.json', {
                cache: 'default'
            });
            if (!response.ok) throw new Error('Mock data also unavailable');
            data = await response.json();
        }

        // Check if this is the index page (has main-content-container)
        const isIndexPage = DOM.mainContainer !== null;
        
        if (isIndexPage) {
            DOM.mainContainer.innerHTML = ''; 
        }
        
        renderHeader(data.settings, data.navigation, data.page_content);
        renderPromoBanner(data.settings);
        
        if (isIndexPage) {
            renderMainContent(data.page_content);
            // Extract products for search functionality
            extractProductsForSearch(data.page_content);
        }
        
        renderFooter(data.settings, data.footer);
        
        if (isIndexPage) {
            DOM.mainContainer.classList.add('is-loaded');
        }

        initializePageInteractions(data.settings);
        applyThemeGradients(data.settings);
        
        // Initialize search functionality
        initializeSearch();
        
        // Initialize product filters for filterable categories
        if (isIndexPage) {
            initProductFilters();
        }
        
        if (isIndexPage) {
            initializeScrollSpy();
            initializeMarketingFeatures();
            initPremiumEffects();

            // Restore category expanded states and scroll position if returning from product page
            const savedScrollPosition = sessionStorage.getItem('indexScrollPosition');
            const savedCategoryStates = sessionStorage.getItem('categoryStates');
            const lastViewedProduct = sessionStorage.getItem('lastViewedProduct');
            // Validate product ID format to prevent selector injection (alphanumeric, hyphens, underscores only)
            const safeLastViewedProduct = /^[a-zA-Z0-9_-]+$/.test(lastViewedProduct) ? lastViewedProduct : null;
            if (savedScrollPosition || savedCategoryStates || safeLastViewedProduct) {
                // Disable smooth scroll and transitions immediately so restoration is instant
                document.documentElement.style.scrollBehavior = 'auto';
                document.body.classList.add('no-transition');

                // Delay to allow lazy-loaded images to finish initial layout before scrolling
                const RESTORE_DELAY_MS = 200;

                const doRestore = () => {
                    // Reveal all animated elements instantly (no-transition is active) so the
                    // restored scroll position shows fully-visible content, not opacity-0 elements.
                    document.querySelectorAll('.fade-in-up').forEach(el => el.classList.add('is-visible'));

                    if (savedCategoryStates) {
                        try {
                            const categoryStates = JSON.parse(savedCategoryStates);
                            Object.entries(categoryStates).forEach(([id, expanded]) => {
                                const section = document.getElementById(id);
                                if (section) {
                                    const header = section.querySelector('.category-header[aria-expanded]');
                                    if (header) header.setAttribute('aria-expanded', expanded);
                                }
                            });
                            // Force synchronous layout so grids are at full height before scroll
                            document.body.offsetHeight;
                        } catch (_) { /* Ignore malformed sessionStorage data */ }
                        sessionStorage.removeItem('categoryStates');
                    }

                    // Prefer scrolling to the exact product card element (resilient to image-loading layout shifts)
                    const productCard = safeLastViewedProduct
                        ? document.querySelector(`.product-card[data-product-id="${CSS.escape(safeLastViewedProduct)}"]`)
                        : null;
                    if (productCard) {
                        productCard.scrollIntoView({ behavior: 'instant', block: 'center' });
                        sessionStorage.removeItem('lastViewedProduct');
                        sessionStorage.removeItem('indexScrollPosition');
                    } else if (savedScrollPosition) {
                        window.scrollTo({ top: parseInt(savedScrollPosition, 10), behavior: 'instant' });
                        sessionStorage.removeItem('indexScrollPosition');
                        sessionStorage.removeItem('lastViewedProduct');
                    }

                    // Re-enable transitions and smooth scroll after a frame
                    requestAnimationFrame(() => {
                        document.body.classList.remove('no-transition');
                        document.documentElement.style.scrollBehavior = '';
                    });
                };

                setTimeout(doRestore, RESTORE_DELAY_MS);
            }
        }

    } catch (error) {
        console.error("Fatal Error: Could not load or render page content.", error);
        if (DOM.mainContainer) {
            DOM.mainContainer.innerHTML =
                `<div class="container" style="text-align: center; color: var(--text-secondary); padding: 5rem 1rem;">
                    <h2>Грешка при зареждане на съдържанието</h2>
                    <p>Не успяхме да се свържем със сървъра. Моля, опреснете страницата или опитайте по-късно.</p>
                 </div>`;
        }
    }
}

// =======================================================
//          MARKETING FEATURES INITIALIZATION
// =======================================================

function initializeMarketingFeatures() {
    // 1. Countdown Timer for Promo
    initPromoTimer();
    
    // 2. Sticky CTA Button
    initStickyCTA();
    
    // 3. Product Badges
    addProductBadges();
    
    // 6. Exit Intent Modal
    initExitIntentModal();
}

// Promo Timer - Shows countdown to create urgency
function initPromoTimer() {
    const timerElement = document.getElementById('promo-timer');
    if (!timerElement) return;
    
    // Set end time to midnight today (or customize)
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    
    function updateTimer() {
        const now = new Date();
        const diff = midnight - now;
        
        if (diff <= 0) {
            timerElement.textContent = 'Офертата изтече!';
            return;
        }
        
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        
        timerElement.textContent = `⏰ ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    
    updateTimer();
    setInterval(updateTimer, 1000);
}

// Sticky CTA - Shows when user scrolls past hero
function initStickyCTA() {
    const stickyCTA = document.getElementById('sticky-cta');
    if (!stickyCTA) return;
    
    let lastScrollY = window.scrollY;
    
    function checkScroll() {
        const currentScrollY = window.scrollY;
        const heroHeight = document.querySelector('.hero-section')?.offsetHeight || 600;
        
        // Show when scrolled past hero and scrolling up
        if (currentScrollY > heroHeight && currentScrollY < lastScrollY) {
            stickyCTA.classList.add('visible');
        } else if (currentScrollY <= heroHeight || currentScrollY > lastScrollY + 50) {
            stickyCTA.classList.remove('visible');
        }
        
        lastScrollY = currentScrollY;
    }
    
    window.addEventListener('scroll', debounce(checkScroll, 100));
}

// Add product badges based on criteria
function addProductBadges() {
    const products = document.querySelectorAll('.product-card');
    
    products.forEach((card, index) => {
        const productId = card.getAttribute('data-product-id');
        if (!productId) return;
        
        let badge = null;
        
        // First product - Bestseller
        if (index === 0) {
            badge = createBadge('Най-продаван', 'bestseller', 'star');
        }
        // Second product - New
        else if (index === 1) {
            badge = createBadge('Ново', 'new', 'sparkles');
        }
        // Third product - Limited offer
        else if (index === 2) {
            badge = createBadge('Ограничена оферта', 'limited', 'fire');
        }
        
        if (badge) {
            card.style.position = 'relative';
            card.insertBefore(badge, card.firstChild);
        }
    });
}

function createBadge(text, type, iconType) {
    const badge = document.createElement('div');
    badge.className = `product-badge ${type}`;
    
    // Create SVG icon based on type
    let iconSVG = '';
    if (iconType === 'star') {
        iconSVG = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: inline-block; vertical-align: middle; margin-right: 4px;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>';
    } else if (iconType === 'sparkles') {
        iconSVG = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none" style="display: inline-block; vertical-align: middle; margin-right: 4px;"><path d="M9.813 3.25a.75.75 0 0 1 .437.695v4.945c0 .174.106.331.268.395l.625.25a.75.75 0 0 1 0 1.398l-.625.25a.422.422 0 0 0-.268.395v4.945a.75.75 0 0 1-1.187.607l-4.382-3.024a.422.422 0 0 1 0-.695l4.382-3.024a.75.75 0 0 1 .75-.142zm9 0a.75.75 0 0 1 .437.695v4.945c0 .174.106.331.268.395l.625.25a.75.75 0 0 1 0 1.398l-.625.25a.422.422 0 0 0-.268.395v4.945a.75.75 0 0 1-1.187.607l-4.382-3.024a.422.422 0 0 1 0-.695l4.382-3.024a.75.75 0 0 1 .75-.142z"></path></svg>';
    } else if (iconType === 'fire') {
        iconSVG = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: inline-block; vertical-align: middle; margin-right: 4px;"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path></svg>';
    }
    
    badge.innerHTML = iconSVG + text;
    return badge;
}

// Exit Intent Modal - Shows when user is about to leave
function initExitIntentModal() {
    const modal = document.getElementById('exit-intent-modal');
    if (!modal) return;
    
    let hasShown = false;
    const closeBtn = modal.querySelector('.exit-modal-close');
    
    // Configuration constants
    const EXIT_MODAL_DELAY_MS = 30000; // 30 seconds
    const MOUSE_LEAVE_THRESHOLD_Y = 0; // Top of viewport
    
    // Close modal function
    const closeModal = () => {
        modal.classList.remove('active');
        hasShown = true;
        localStorage.setItem('exitModalShown', 'true');
    };
    
    // Check if already shown in this session
    if (localStorage.getItem('exitModalShown')) {
        hasShown = true;
    }
    
    // Close button click
    if (closeBtn) {
        closeBtn.addEventListener('click', closeModal);
    }
    
    // Close on overlay click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });
    
    // Exit intent detection - only trigger when mouse leaves from top of viewport
    document.addEventListener('mouseleave', (e) => {
        // Check if mouse actually left the viewport from the top
        if (e.clientY <= MOUSE_LEAVE_THRESHOLD_Y && !hasShown && e.relatedTarget === null) {
            modal.classList.add('active');
        }
    });
    
    // Also show after configured delay if not shown yet
    setTimeout(() => {
        if (!hasShown) {
            modal.classList.add('active');
        }
    }, EXIT_MODAL_DELAY_MS);
    
    // Keyboard escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('active')) {
            closeModal();
        }
    });
}

// =======================================================
//          8. SITE SEARCH FUNCTIONALITY
// =======================================================

// Global variable to store all products for search
let allProducts = [];

// Initialize search functionality
function initializeSearch() {
    const searchToggle = document.getElementById('search-toggle');
    const searchDropdown = document.getElementById('search-dropdown');
    const searchInput = document.getElementById('site-search-input');
    const searchClear = document.getElementById('search-clear');
    const searchResults = document.getElementById('search-results');

    if (!searchToggle || !searchDropdown || !searchInput) return;

    // Toggle search dropdown
    searchToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const isExpanded = searchToggle.getAttribute('aria-expanded') === 'true';
        
        if (isExpanded) {
            closeSearch();
        } else {
            openSearch();
        }
    });

    // Open search function
    function openSearch() {
        searchDropdown.classList.add('active');
        searchToggle.setAttribute('aria-expanded', 'true');
        setTimeout(() => searchInput.focus(), 100);
    }

    // Close search function
    function closeSearch() {
        searchDropdown.classList.remove('active');
        searchToggle.setAttribute('aria-expanded', 'false');
        searchInput.value = '';
        searchClear.style.display = 'none';
        searchResults.innerHTML = '';
    }

    // Close search when clicking outside
    document.addEventListener('click', (e) => {
        if (!searchDropdown.contains(e.target) && e.target !== searchToggle && !searchToggle.contains(e.target)) {
            closeSearch();
        }
    });

    // Prevent closing when clicking inside dropdown
    searchDropdown.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    // Search input handler
    searchInput.addEventListener('input', debounce((e) => {
        const query = e.target.value.trim();
        
        if (query.length > 0) {
            searchClear.style.display = 'flex';
            performSearch(query);
        } else {
            searchClear.style.display = 'none';
            searchResults.innerHTML = '';
        }
    }, 300));

    // Clear button handler
    searchClear.addEventListener('click', () => {
        searchInput.value = '';
        searchClear.style.display = 'none';
        searchResults.innerHTML = '';
        searchInput.focus();
    });

    // Keyboard navigation
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeSearch();
        } else if (e.key === 'Enter') {
            const firstResult = searchResults.querySelector('.search-result-item');
            if (firstResult) {
                firstResult.click();
            }
        }
    });
}

// Perform search through products
function performSearch(query) {
    const searchResults = document.getElementById('search-results');
    if (!searchResults) return;

    const lowerQuery = query.toLowerCase();
    
    // Filter products that match the search query
    const results = allProducts.filter(product => {
        const name = product.public_data?.name?.toLowerCase() || '';
        const tagline = product.public_data?.tagline?.toLowerCase() || '';
        const description = product.public_data?.description?.toLowerCase() || '';
        
        return name.includes(lowerQuery) || 
               tagline.includes(lowerQuery) || 
               description.includes(lowerQuery);
    });

    // Display results
    if (results.length === 0) {
        searchResults.innerHTML = `
            <div class="search-no-results">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="11" cy="11" r="8"></circle>
                    <path d="m21 21-4.35-4.35"></path>
                </svg>
                <p>Не са намерени продукти за "${escapeHtml(query)}"</p>
            </div>
        `;
    } else {
        searchResults.innerHTML = results.map(product => {
            const publicData = product.public_data;
            const productId = product.product_id;
            const price = Number(publicData.price).toFixed(2);
            
            // Highlight matching text
            const highlightText = (text) => {
                if (!text) return '';
                const regex = new RegExp(`(${escapeHtml(query)})`, 'gi');
                return escapeHtml(text).replace(regex, '<mark>$1</mark>');
            };

            return `
                <a href="product.html?id=${encodeURIComponent(productId)}" class="search-result-item">
                    ${publicData.image_url ? `
                        <img src="${escapeHtml(publicData.image_url)}" 
                             alt="${escapeHtml(publicData.name)}" 
                             class="search-result-image"
                             loading="lazy">
                    ` : ''}
                    <div class="search-result-info">
                        <div class="search-result-name">${highlightText(publicData.name)}</div>
                        <div class="search-result-tagline">${escapeHtml(publicData.tagline || '')}</div>
                    </div>
                    <div class="search-result-price">${price} €</div>
                </a>
            `;
        }).join('');

        // Add click handlers to close search when result is clicked
        searchResults.querySelectorAll('.search-result-item').forEach(item => {
            item.addEventListener('click', () => {
                saveNavigationState();
            });
        });
    }
}

// Extract all products from page content for search
function extractProductsForSearch(pageContent) {
    allProducts = [];
    
    if (!pageContent) return;

    pageContent.forEach(component => {
        if (component.type === 'product_category' && component.products) {
            allProducts.push(...component.products);
        }
    });
}

// =======================================================
//          PRODUCT FILTER & SORT SYSTEM
// =======================================================

function initProductFilters() {
    document.querySelectorAll('.product-filter-bar').forEach(filterBar => {
        const gridId = filterBar.dataset.gridId;
        const grid = document.getElementById(gridId);
        if (!grid) return;

        const brandSelect = filterBar.querySelector('[data-filter="brand"]');
        const goalSelect = filterBar.querySelector('[data-filter="goal"]');
        const sortSelect = filterBar.querySelector('[data-filter="sort"]');
        const searchInput = filterBar.querySelector('[data-filter="search"]');
        const countEl = document.getElementById(`filter-count-${gridId}`);

        // Get all product cards in this grid
        function getAllCards() {
            return Array.from(grid.querySelectorAll('.product-card'));
        }

        function applyFilters() {
            const brand = brandSelect ? brandSelect.value : '';
            const goal = goalSelect ? goalSelect.value : '';
            const sortBy = sortSelect ? sortSelect.value : 'default';
            const search = searchInput ? searchInput.value.toLowerCase().trim() : '';

            const cards = getAllCards();
            let visibleCount = 0;

            cards.forEach(card => {
                const cardBrand = card.dataset.brand || '';
                const cardGoals = card.dataset.goals || '';
                const cardName = card.querySelector('h3')?.textContent?.toLowerCase() || '';

                let visible = true;
                if (brand && cardBrand !== brand) visible = false;
                if (goal && !cardGoals.split(',').includes(goal)) visible = false;
                if (search && !cardName.includes(search)) visible = false;

                card.style.display = visible ? '' : 'none';
                if (visible) visibleCount++;
            });

            // Sort visible cards
            if (sortBy !== 'default') {
                const visibleCards = cards.filter(c => c.style.display !== 'none');
                visibleCards.sort((a, b) => {
                    if (sortBy === 'price-asc') {
                        return parseFloat(a.dataset.price || 0) - parseFloat(b.dataset.price || 0);
                    } else if (sortBy === 'price-desc') {
                        return parseFloat(b.dataset.price || 0) - parseFloat(a.dataset.price || 0);
                    } else if (sortBy === 'effectiveness') {
                        const aEffects = a.querySelectorAll('.effect-bar');
                        const bEffects = b.querySelectorAll('.effect-bar');
                        const aMax = aEffects.length > 0 ? Math.max(...Array.from(aEffects).map(e => parseFloat(e.dataset.width) || 0)) : 0;
                        const bMax = bEffects.length > 0 ? Math.max(...Array.from(bEffects).map(e => parseFloat(e.dataset.width) || 0)) : 0;
                        return bMax - aMax;
                    }
                    return 0;
                });
                visibleCards.forEach(card => grid.appendChild(card));
            }

            if (countEl) {
                countEl.textContent = `Показани: ${visibleCount} от ${cards.length} продукта`;
            }
        }

        if (brandSelect) brandSelect.addEventListener('change', applyFilters);
        if (goalSelect) goalSelect.addEventListener('change', applyFilters);
        if (sortSelect) sortSelect.addEventListener('change', applyFilters);
        if (searchInput) searchInput.addEventListener('input', debounce(applyFilters, 300));

        // Initial count
        const totalCards = getAllCards().length;
        if (countEl) {
            countEl.textContent = `Показани: ${totalCards} от ${totalCards} продукта`;
        }
    });

    // Load More button handlers
    document.querySelectorAll('.btn-load-more').forEach(btn => {
        btn.addEventListener('click', () => {
            const gridId = btn.dataset.gridId;
            const grid = document.getElementById(gridId);
            if (!grid) return;

            // Decode all products data
            const encodedData = grid.dataset.allProducts;
            if (!encodedData) return;

            try {
                const allProductsData = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(encodedData), c => c.charCodeAt(0))));
                if (!Array.isArray(allProductsData)) return;
                
                const currentCount = grid.querySelectorAll('.product-card').length;
                const pageSize = parseInt(grid.dataset.pageSize) || 24;
                const nextBatch = allProductsData.slice(currentCount, currentCount + pageSize);

                // Generate cards for next batch
                nextBatch.forEach(p => {
                    if (!p || !p.product_id) return;
                    const product = {
                        product_id: String(p.product_id),
                        public_data: {
                            name: String(p.name || ''),
                            price: Number(p.price) || 0,
                            brand: String(p.brand || ''),
                            image_url: String(p.image_url || ''),
                            tagline: String(p.tagline || ''),
                            effects: Array.isArray(p.effects) ? p.effects : [],
                            variants: Array.isArray(p.variants) ? p.variants : []
                        },
                        system_data: {
                            inventory: Number(p.inventory) || 0,
                            goals: Array.isArray(p.goals) ? p.goals : []
                        }
                    };
                    const cardHTML = generateProductCard(product);
                    grid.insertAdjacentHTML('beforeend', cardHTML);
                });

                // Animate new cards
                grid.querySelectorAll('.product-card:not(.visible)').forEach(card => {
                    card.classList.add('visible');
                });

                // Update or hide button
                const remaining = allProductsData.length - (currentCount + nextBatch.length);
                if (remaining <= 0) {
                    btn.parentElement.style.display = 'none';
                } else {
                    btn.textContent = `Зареди още продукти (${remaining} остават)`;
                }

                // Re-apply filters if any are active
                const filterBar = document.querySelector(`.product-filter-bar[data-grid-id="${gridId}"]`);
                if (filterBar) {
                    const countEl = document.getElementById(`filter-count-${gridId}`);
                    const totalCards = grid.querySelectorAll('.product-card').length;
                    if (countEl) {
                        countEl.textContent = `Показани: ${totalCards} от ${allProductsData.length} продукта`;
                    }
                }
            } catch (e) {
                console.error('Error loading more products:', e);
            }
        });
    });
}

// Prevent the browser from auto-restoring scroll position so our custom restoration takes effect
if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
}

// ── PREMIUM VISUAL EFFECTS ──

// Ripple effect on button click
function initRippleEffect() {
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-primary, .btn-hero-primary, .btn-premium');
        if (!btn) return;

        const ripple = document.createElement('span');
        ripple.className = 'ripple';

        const rect = btn.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        ripple.style.cssText = `
            width: ${size}px;
            height: ${size}px;
            left: ${e.clientX - rect.left - size / 2}px;
            top: ${e.clientY - rect.top - size / 2}px;
        `;

        btn.appendChild(ripple);
        ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
    });
}

// Animated counter for stat numbers
function animateStat(el) {
    const raw = el.textContent.trim();
    const match = raw.match(/^([\d,]+)/);
    if (!match) return;

    const target   = parseInt(match[1].replace(/,/g, ''), 10);
    const suffix   = raw.slice(match[1].length);
    const duration = 1400;
    const startTs  = performance.now();

    const tick = (now) => {
        const t      = Math.min((now - startTs) / duration, 1);
        const eased  = 1 - Math.pow(1 - t, 3);
        const current = Math.round(target * eased);
        el.textContent = current.toLocaleString('en-US') + suffix;
        if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
}

function initCounterAnimation() {
    const statItems = document.querySelectorAll('.stat-item strong');
    if (!statItems.length) return;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting || entry.target.dataset.animated) return;
            entry.target.dataset.animated = 'true';
            animateStat(entry.target);
        });
    }, { threshold: 0.6 });

    statItems.forEach(el => observer.observe(el));
}

// 3-D tilt effect on product cards
function initCard3DTilt() {
    if (window.matchMedia('(hover: none)').matches) return;

    let currentTiltCard = null;

    document.addEventListener('mousemove', (e) => {
        const card = e.target.closest('.product-card:not(.skeleton-card)');
        if (!card) {
            if (currentTiltCard) {
                currentTiltCard.classList.remove('tilting');
                currentTiltCard.style.transform = '';
                currentTiltCard = null;
            }
            return;
        }

        const rect = card.getBoundingClientRect();
        const x  = e.clientX - rect.left;
        const y  = e.clientY - rect.top;
        const cx = rect.width  / 2;
        const cy = rect.height / 2;
        const rotX = ((y - cy) / cy) * -5;
        const rotY = ((x - cx) / cx) *  5;

        card.classList.add('tilting');
        card.style.transform  = `perspective(900px) rotateX(${rotX}deg) rotateY(${rotY}deg) translateZ(6px)`;
        card.style.transition = 'none';
        card.style.setProperty('--mouse-x', `${x}px`);
        card.style.setProperty('--mouse-y', `${y}px`);
        currentTiltCard = card;
    }, { passive: true });

    document.addEventListener('mouseleave', (e) => {
        const card = e.target.closest('.product-card');
        if (card) {
            card.classList.remove('tilting');
            card.style.transform  = '';
            card.style.transition = '';
            if (currentTiltCard === card) currentTiltCard = null;
        }
    }, true);
}

// Magnetic pull on hero CTA buttons
function initMagneticButtons() {
    if (window.matchMedia('(hover: none)').matches) return;

    function attachMagnetic(selector, strength) {
        document.querySelectorAll(selector).forEach(btn => {
            let cachedRect = null;
            btn.addEventListener('mouseenter', () => {
                cachedRect = btn.getBoundingClientRect();
            });
            btn.addEventListener('mousemove', (e) => {
                if (!cachedRect) cachedRect = btn.getBoundingClientRect();
                const dx = e.clientX - (cachedRect.left + cachedRect.width  / 2);
                const dy = e.clientY - (cachedRect.top  + cachedRect.height / 2);
                btn.style.transform = `translate(${dx * strength}px, ${dy * strength}px)`;
            });
            btn.addEventListener('mouseleave', () => {
                btn.style.transform = '';
                cachedRect = null;
            });
        });
    }

    attachMagnetic('.btn-hero-primary',   0.2);
    attachMagnetic('.btn-hero-secondary', 0.15);
}

// Glowing divider lines between major content sections
function initSectionGlowLines() {
    const container = document.getElementById('main-content-container');
    if (!container) return;

    const sections = container.querySelectorAll('.category-section, .hero-features-section');
    sections.forEach(section => {
        if (section.previousElementSibling &&
            !section.previousElementSibling.classList.contains('section-glow-line')) {
            const line = document.createElement('div');
            line.className = 'section-glow-line';
            section.parentNode.insertBefore(line, section);
        }
    });
}

// Initialize all premium effects (call after content is rendered)
function initPremiumEffects() {
    initRippleEffect();
    initCard3DTilt();
    initMagneticButtons();
    initCounterAnimation();
    initSectionGlowLines();
}

// Старт на приложението
main();
