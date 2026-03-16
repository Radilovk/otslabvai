// =======================================================
//          PRODUCT DETAIL PAGE SCRIPT
// =======================================================

import { API_URL } from './config.js';

const DOM = {
    productContent: document.getElementById('product-detail-content'),
    addToCartBtn: document.getElementById('add-to-cart-detail-btn'),
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
    toastContainer: document.getElementById('toast-container')
};

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
//          CART MANAGEMENT
// =======================================================

const getCart = () => JSON.parse(localStorage.getItem('cart') || '[]');
const saveCart = cart => localStorage.setItem('cart', JSON.stringify(cart));

const updateCartCount = () => {
    if (!DOM.header.cartCount) return;
    const count = getCart().reduce((acc, item) => acc + item.quantity, 0);
    DOM.header.cartCount.textContent = count;
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
    showToast(`${name} е добавен в количката!`, 'success');
    
    // Update button state
    if (DOM.addToCartBtn) {
        DOM.addToCartBtn.classList.add('added');
        const originalHTML = DOM.addToCartBtn.innerHTML;
        DOM.addToCartBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: inline-block; vertical-align: middle; margin-right: 6px;">
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            Добавено в количката
        `;
        setTimeout(() => {
            DOM.addToCartBtn.classList.remove('added');
            DOM.addToCartBtn.innerHTML = originalHTML;
        }, 2000);
    }
};

// =======================================================
//          RENDER FUNCTIONS
// =======================================================

const generateEffectBar = effect => `
    <div class="effect-bar-group">
        <div class="effect-label">${escapeHtml(effect.label)}</div>
        <div class="effect-bar-container">
            <div class="effect-bar animated" style="width: ${Number(effect.value)}%">${(effect.value / 10).toFixed(1)} / 10</div>
        </div>
    </div>`;

function renderProductDetail(product) {
    if (!product.public_data) {
        DOM.productContent.innerHTML = `
            <div style="text-align: center; padding: 60px 20px;">
                <h2>Продуктът не може да бъде зареден</h2>
                <p>Моля, опитайте отново по-късно.</p>
                <a href="index.html" class="btn btn-primary">Назад към продуктите</a>
            </div>
        `;
        return;
    }

    const publicData = product.public_data;
    const systemData = product.system_data || {};
    const inventory = systemData.inventory ?? 0;
    const productId = product.product_id;

    // Update page title
    document.title = `${publicData.name} - Ефективни Решения за Отслабване`;

    // Generate About Content section
    const aboutContentHTML = publicData.about_content ? `
        <div class="product-about-section">
            <h3>${escapeHtml(publicData.about_content.title || 'За продукта')}</h3>
            <p>${escapeHtml(publicData.about_content.description)}</p>
            ${publicData.about_content.benefits && publicData.about_content.benefits.length > 0 ? `
                <div class="product-benefits-full">
                    ${publicData.about_content.benefits.map(benefit => `
                        <div class="benefit-item">
                            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                                <polyline points="22 4 12 14.01 9 11.01"></polyline>
                            </svg>
                            <div>
                                <h4>${escapeHtml(benefit.title)}</h4>
                                <p>${escapeHtml(benefit.text)}</p>
                            </div>
                        </div>
                    `).join('')}
                </div>
            ` : ''}
        </div>
    ` : '';

    // Generate Ingredients section
    const ingredientsHTML = publicData.ingredients && publicData.ingredients.length > 0 ? `
        <div class="product-ingredients-section">
            <h3>Активни съставки</h3>
            <p class="section-subtitle">Натиснете на всяка съставка, за да разкриете нейната роля в формулата</p>
            <div class="ingredients-grid-full">
                ${publicData.ingredients.map(ingredient => `
                    <div class="ingredient-card-full" tabindex="0">
                        <div class="card-inner">
                            <div class="card-front">
                                <h5>${escapeHtml(ingredient.name)}</h5>
                                <span>${escapeHtml(ingredient.amount)}</span>
                            </div>
                            <div class="card-back">
                                <p>${escapeHtml(ingredient.description)}</p>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    ` : '';

    // Generate FAQ section
    const faqHTML = publicData.faq && publicData.faq.length > 0 ? `
        <div class="product-faq-section">
            <h3>Често задавани въпроси</h3>
            <div class="faq-container-full">
                ${publicData.faq.map((faq, index) => {
                    const faqId = `faq-${productId}-${index}`;
                    return `
                    <div class="faq-item-full">
                        <div class="faq-question-full" role="button" aria-expanded="false" aria-controls="${faqId}" tabindex="0">
                            <h4>${escapeHtml(faq.question)}</h4>
                            <span class="faq-toggle-full">+</span>
                        </div>
                        <div class="faq-answer-full" id="${faqId}">
                            <p>${escapeHtml(faq.answer)}</p>
                        </div>
                    </div>
                `;
                }).join('')}
            </div>
        </div>
    ` : '';

    // Generate Target Profile section (Ideal User Profile)
    const targetProfileHTML = systemData.target_profile ? `
        <div class="product-target-profile-section">
            <h3>Идеален профил на потребителя</h3>
            <p class="target-profile-text">${escapeHtml(systemData.target_profile)}</p>
        </div>
    ` : '';

    // Generate Protocol Hint section (Technical Protocol Guidelines)
    const protocolHintHTML = systemData.protocol_hint ? `
        <div class="product-protocol-hint-section">
            <h3>Прием</h3>
            <p class="protocol-hint-text">${escapeHtml(systemData.protocol_hint)}</p>
        </div>
    ` : '';

    // Generate Safety Warnings section
    const safetyWarningsHTML = systemData.safety_warnings ? `
        <div class="product-safety-warnings-section">
            <h3>Предупреждения за безопасност</h3>
            <div class="safety-warnings-content">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="warning-icon" aria-hidden="true">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                    <line x1="12" y1="9" x2="12" y2="13"></line>
                    <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
                <p class="safety-warnings-text">${escapeHtml(systemData.safety_warnings)}</p>
            </div>
        </div>
    ` : '';

    // Determine stock status class
    let stockClass = '';
    let stockText = '';
    if (inventory <= 0) {
        stockClass = 'out-of-stock';
        stockText = 'Изчерпано';
    } else if (inventory <= 30) {
        stockClass = 'low-stock';
        stockText = `Само ${inventory} бр. налични!`;
    } else {
        stockText = `Налично: ${inventory} бр.`;
    }

    // Prepare image gallery
    let imagesHTML = '';
    if (publicData.image_url) {
        // Collect all images
        const images = [publicData.image_url];
        
        // Add additional images if they exist
        if (publicData.additional_images) {
            let additionalImages = [];
            if (typeof publicData.additional_images === 'string') {
                // Split by newlines and filter out empty lines
                additionalImages = publicData.additional_images.split('\n').map(url => url.trim()).filter(url => url);
            } else if (Array.isArray(publicData.additional_images)) {
                additionalImages = publicData.additional_images;
            }
            images.push(...additionalImages);
        }
        
        if (images.length > 0) {
            imagesHTML = `
                <div class="product-detail-image">
                    <div class="product-image-gallery">
                        <div class="main-product-image" data-zoom-image="${escapeHtml(images[0])}">
                            <img src="${escapeHtml(images[0])}" alt="${escapeHtml(publicData.name)}" loading="lazy" decoding="async" id="main-product-img">
                        </div>
                        ${images.length > 1 ? `
                            <div class="image-thumbnails">
                                ${images.map((img, idx) => `
                                    <div class="thumbnail ${idx === 0 ? 'active' : ''}" data-image="${escapeHtml(img)}">
                                        <img src="${escapeHtml(img)}" alt="${escapeHtml(publicData.name)} - Изглед ${idx + 1}" loading="lazy" decoding="async">
                                    </div>
                                `).join('')}
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        }
    }

    // Generate variant selector HTML
    const variants = publicData.variants || [];
    // A variant is available when available is not explicitly set to false (undefined/null/true = available)
    const isVariantAvailable = v => v.available !== false;
    // Index of the initially active variant (first available one)
    const firstAvailableIdx = variants.findIndex(isVariantAvailable);
    const initActiveIdx = firstAvailableIdx >= 0 ? firstAvailableIdx : 0;
    // Base price for delta calculation (the product's own base price)
    const basePrice = publicData.price;
    let variantSelectorHTML = '';
    if (variants.length === 1) {
        // Single variant: display as static text with "Количество" heading
        const v = variants[0];
        variantSelectorHTML = `
            <div class="product-variant-selector product-variant-selector--single">
                <h2>Количество</h2>
                <span class="variant-single-display">${escapeHtml(v.option_name || '')}</span>
            </div>
        `;
    } else if (variants.length > 1) {
        // Multiple variants: dropdown selector with "Варианти:" heading above
        variantSelectorHTML = `
            <div class="product-variant-selector product-variant-selector--multi">
                <h2 class="variant-section-heading">Варианти:</h2>
                <div class="variant-dropdown-wrapper">
                    <select id="variant-select" class="variant-dropdown" aria-label="Избери вариант">
                        ${variants.map((v, idx) => {
                            const isUnavailable = !isVariantAvailable(v);
                            const delta = (typeof v.price === 'number' && typeof basePrice === 'number') ? v.price - basePrice : null;
                            const deltaStr = (delta !== null && Math.abs(delta) > 0.005)
                                ? ` (${delta > 0 ? '+' : ''}${delta.toFixed(2)} €)`
                                : '';
                            const soldOutStr = isUnavailable ? ' — Изчерпано' : '';
                            return `<option value="${idx}"
                                data-variant-sku="${escapeHtml(v.sku || '')}"
                                data-variant-price="${typeof v.price === 'number' ? v.price : ''}"
                                data-variant-image="${escapeHtml(v.image_url || '')}"
                                data-variant-name="${escapeHtml(v.option_name || 'Стандартна')}"
                                data-variant-available="${isUnavailable ? 'false' : 'true'}"
                                ${idx === initActiveIdx ? 'selected' : ''}
                            >${escapeHtml(v.option_name || 'Стандартна')}${deltaStr}${soldOutStr}</option>`;
                        }).join('')}
                    </select>
                    <span class="variant-dropdown-arrow" aria-hidden="true"></span>
                </div>
            </div>
        `;
    }

    // Brand display
    const brandHTML = publicData.brand ? `<span class="product-detail-brand">${escapeHtml(publicData.brand)}</span>` : '';

    // Label (nutrition facts) link
    const labelHTML = publicData.label_url ? `
        <div class="product-label-link">
            <a href="${escapeHtml(publicData.label_url)}" target="_blank" rel="noopener"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-1px;margin-right:4px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg> Хранителна информация</a>
        </div>
    ` : '';

    // Build the product detail HTML
    // Use the initial variant price for display if variants are present
    const initActiveVariant = variants.length > 0 ? variants[initActiveIdx] : null;
    const initialDisplayPrice = (initActiveVariant && typeof initActiveVariant.price === 'number')
        ? Number(initActiveVariant.price).toFixed(2)
        : Number(publicData.price).toFixed(2);
    // Compute initial delta for display (shown if first active variant differs from base price)
    const initDelta = (initActiveVariant && typeof initActiveVariant.price === 'number' && typeof basePrice === 'number')
        ? initActiveVariant.price - basePrice : 0;
    const initDeltaHTML = (Math.abs(initDelta) > 0.005)
        ? `<span class="product-price-delta" id="product-price-delta">${initDelta > 0 ? '+' : ''}${initDelta.toFixed(2)} €</span>`
        : `<span class="product-price-delta" id="product-price-delta" style="display:none;"></span>`;

    // Sale / promotion price (only applies when no variants override pricing)
    const salePriceRaw = publicData.sale_price;
    const hasSale = typeof salePriceRaw === 'number' && salePriceRaw > 0 && salePriceRaw < Number(publicData.price) && variants.length === 0;
    const salePriceDisplay = hasSale ? Number(salePriceRaw).toFixed(2) : null;
    // Build the displayed price span — sale overrides the plain price when no variants
    const priceSpanContent = hasSale
        ? `<span class="price-original">${Number(publicData.price).toFixed(2)} €</span><span class="price-sale">${salePriceDisplay} €</span>`
        : `${initialDisplayPrice} €`;
    const priceSpanClass = hasSale ? 'product-detail-price has-sale' : 'product-detail-price';

    const effectsHTML = (publicData.effects && publicData.effects.length > 0) ? `
            <div class="product-detail-effects">
                <h2>Ефекти</h2>
                <div class="effects-container">
                    ${publicData.effects.map(generateEffectBar).join('')}
                </div>
            </div>
        ` : '';

    const saleBadgeHTML = hasSale
        ? `<span class="product-badge sale" style="position:static;display:inline-flex;align-items:center;margin-bottom:8px;"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:4px;"><path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"></path><circle cx="7.5" cy="7.5" r="1.5" fill="currentColor" stroke="none"></circle></svg>ПРОМО</span>`
        : '';

    const productHTML = `
        <div class="product-detail-header">
            ${brandHTML}
            ${saleBadgeHTML}
            <h1>${escapeHtml(publicData.name)}</h1>
            <p class="tagline">${escapeHtml(publicData.tagline)}</p>
            <div class="product-detail-meta">
                <div class="price-group">
                    <span class="${priceSpanClass}" id="product-price-display">${priceSpanContent}</span>
                    ${initDeltaHTML}
                </div>
                <span class="product-detail-stock ${stockClass}">${stockText}</span>
            </div>
        </div>

        ${imagesHTML}

        ${labelHTML}

        ${effectsHTML}

        ${variantSelectorHTML}

        <div class="product-detail-description">
            <h2>Описание</h2>
            <p>${escapeHtml(publicData.description)}</p>
            ${publicData.research_note && publicData.research_note.url ? `
                <div class="research-note">
                    Източник: <a href="${escapeHtml(publicData.research_note.url)}" target="_blank" rel="noopener">${escapeHtml(publicData.research_note.text)}</a>
                </div>
            ` : ''}
        </div>

        ${aboutContentHTML}
        ${ingredientsHTML}
        ${safetyWarningsHTML}
        ${protocolHintHTML}
        ${targetProfileHTML}
        ${faqHTML}
    `;

    DOM.productContent.innerHTML = productHTML;

    // Setup variant selector interaction
    if (variants.length > 1) {
        const variantSelect = DOM.productContent.querySelector('#variant-select');
        if (variantSelect) {
            variantSelect.addEventListener('change', () => {
                const selectedOption = variantSelect.options[variantSelect.selectedIndex];
                const isAvailable = selectedOption.dataset.variantAvailable !== 'false';

                // Update price display and delta
                // When a variant has no price, fall back to the base product price
                const variantPrice = parseFloat(selectedOption.dataset.variantPrice);
                const displayPrice = isNaN(variantPrice) ? basePrice : variantPrice;
                const priceDisplay = document.getElementById('product-price-display');
                const deltaDisplay = document.getElementById('product-price-delta');
                if (priceDisplay && typeof displayPrice === 'number') {
                    priceDisplay.textContent = `${Number(displayPrice).toFixed(2)} €`;
                    if (deltaDisplay) {
                        const delta = displayPrice - (basePrice || 0);
                        if (Math.abs(delta) > 0.005) {
                            deltaDisplay.textContent = `${delta > 0 ? '+' : ''}${delta.toFixed(2)} €`;
                            deltaDisplay.style.display = '';
                        } else {
                            deltaDisplay.style.display = 'none';
                        }
                    }
                }

                // Update main image if variant has a different image
                const variantImage = selectedOption.dataset.variantImage;
                if (variantImage && /^https?:\/\//.test(variantImage)) {
                    const mainImg = document.getElementById('main-product-img');
                    if (mainImg) mainImg.src = variantImage;
                    const mainImgContainer = DOM.productContent.querySelector('.main-product-image');
                    if (mainImgContainer) mainImgContainer.dataset.zoomImage = variantImage;
                }

                // Update add to cart button data and availability
                if (DOM.addToCartBtn) {
                    // Use base price as fallback when variant has no price
                    DOM.addToCartBtn.dataset.price = isNaN(variantPrice) ? (basePrice || 0) : variantPrice;
                    const variantSku = selectedOption.dataset.variantSku;
                    DOM.addToCartBtn.dataset.id = variantSku ? `${productId}_${variantSku}` : productId;
                    const variantName = selectedOption.dataset.variantName;
                    DOM.addToCartBtn.dataset.name = `${publicData.name} - ${variantName}`;
                    if (selectedOption.dataset.variantImage) {
                        DOM.addToCartBtn.dataset.image = selectedOption.dataset.variantImage;
                    }
                    DOM.addToCartBtn.disabled = !isAvailable;
                    DOM.addToCartBtn.textContent = isAvailable ? 'Добави в количката' : 'Изчерпано';
                }
            });
        }
    }

    // Setup add to cart button
    if (DOM.addToCartBtn) {
        // Use first available variant for initial state (if variants exist)
        // When all variants are unavailable, fall back to index 0 but keep button disabled
        const initVariant = initActiveVariant;
        const initAvailable = initVariant ? isVariantAvailable(initVariant) : inventory > 0;
        DOM.addToCartBtn.disabled = !initAvailable;
        if (!initAvailable) {
            DOM.addToCartBtn.textContent = 'Изчерпано';
        }
        if (initVariant) {
            DOM.addToCartBtn.dataset.id = initVariant.sku ? `${productId}_${initVariant.sku}` : productId;
            DOM.addToCartBtn.dataset.name = variants.length > 1 ? `${publicData.name} - ${initVariant.option_name || 'Стандартна'}` : publicData.name;
            DOM.addToCartBtn.dataset.price = typeof initVariant.price === 'number' ? initVariant.price : publicData.price;
        } else {
            DOM.addToCartBtn.dataset.id = productId;
            DOM.addToCartBtn.dataset.name = publicData.name;
            DOM.addToCartBtn.dataset.price = hasSale ? salePriceRaw : publicData.price;
        }
        DOM.addToCartBtn.dataset.inventory = inventory;
        DOM.addToCartBtn.dataset.image = (initVariant && initVariant.image_url) || publicData.image_url || '';

        // Always attach the listener; the disabled attribute prevents it from firing when unavailable
        DOM.addToCartBtn.addEventListener('click', () => {
            addToCart(
                DOM.addToCartBtn.dataset.id,
                DOM.addToCartBtn.dataset.name,
                DOM.addToCartBtn.dataset.price,
                DOM.addToCartBtn.dataset.inventory,
                DOM.addToCartBtn.dataset.image
            );
        });
    }

    // Initialize interactive elements
    initializeProductInteractions();
    
    // Add structured data for SEO
    addProductStructuredData(product, publicData);
}

// Add structured data (JSON-LD) for product SEO
function addProductStructuredData(product, publicData) {
    // Remove existing structured data if any
    const existingScript = document.querySelector('script[type="application/ld+json"][data-type="product"]');
    if (existingScript) {
        existingScript.remove();
    }
    
    const inventory = product.private_data?.inventory ?? 0;
    const availability = inventory > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock";
    
    // Note: AggregateRating removed as there is no actual review system
    // Effects scores are internal metrics, not user reviews
    
    const structuredData = {
        "@context": "https://schema.org",
        "@type": "Product",
        "name": publicData.name,
        "description": publicData.description,
        "image": publicData.image_url,
        "brand": {
            "@type": "Brand",
            "name": publicData.brand || "ДА ОТСЛАБНА"
        },
        "offers": {
            "@type": "Offer",
            "url": window.location.href,
            "priceCurrency": "BGN",
            "price": publicData.price.toFixed(2),
            "availability": availability,
            "seller": {
                "@type": "Organization",
                "name": "ДА ОТСЛАБНА"
            }
        }
    };
    
    // Add breadcrumb structured data
    const breadcrumbData = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {
                "@type": "ListItem",
                "position": 1,
                "name": "Начало",
                "item": window.location.origin + "/"
            },
            {
                "@type": "ListItem",
                "position": 2,
                "name": "Продукти",
                "item": window.location.origin + "/"
            },
            {
                "@type": "ListItem",
                "position": 3,
                "name": publicData.name
            }
        ]
    };
    
    // Inject structured data scripts
    const productScript = document.createElement('script');
    productScript.type = 'application/ld+json';
    productScript.setAttribute('data-type', 'product');
    productScript.textContent = JSON.stringify(structuredData);
    document.head.appendChild(productScript);
    
    const breadcrumbScript = document.createElement('script');
    breadcrumbScript.type = 'application/ld+json';
    breadcrumbScript.setAttribute('data-type', 'breadcrumb');
    breadcrumbScript.textContent = JSON.stringify(breadcrumbData);
    document.head.appendChild(breadcrumbScript);
    
    // Update page meta tags dynamically
    updateProductMetaTags(publicData);
}

// Update meta tags dynamically for product pages
function updateProductMetaTags(publicData) {
    // Update title
    document.title = `${publicData.name} - ДА ОТСЛАБНА`;
    
    // Update or create meta description
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
        metaDesc = document.createElement('meta');
        metaDesc.name = 'description';
        document.head.appendChild(metaDesc);
    }
    const description = publicData.tagline || publicData.description.substring(0, 155);
    metaDesc.content = description;
    
    // Update Open Graph tags
    updateOrCreateMetaTag('property', 'og:title', publicData.name);
    updateOrCreateMetaTag('property', 'og:description', description);
    updateOrCreateMetaTag('property', 'og:image', publicData.image_url);
    updateOrCreateMetaTag('property', 'og:url', window.location.href);
    
    // Update Twitter Card tags
    updateOrCreateMetaTag('name', 'twitter:title', publicData.name);
    updateOrCreateMetaTag('name', 'twitter:description', description);
    updateOrCreateMetaTag('name', 'twitter:image', publicData.image_url);
}

function updateOrCreateMetaTag(attribute, value, content) {
    let meta = document.querySelector(`meta[${attribute}="${value}"]`);
    if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute(attribute, value);
        document.head.appendChild(meta);
    }
    meta.content = content;
}

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
    // On the product page, category anchor links are prefixed with index.html
    if (categoryItems.length > 0) {
        const dropdownItems = categoryItems.map(item => {
            const href = `index.html${item.link}`;
            return `<li role="none"><a href="${href}" role="menuitem">${item.text}</a></li>`;
        }).join('');
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
 */
function buildNavigationItems(navigation, pageContent) {
    const navItems = [];
    
    if (Array.isArray(pageContent)) {
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
    
    if (Array.isArray(navigation)) {
        navigation.forEach(item => {
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
                 <a href="index.html" class="logo-container footer-logo-container">
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
//          INTERACTIVE ELEMENTS
// =======================================================

function initializeProductInteractions() {
    // Ingredient Card Flip
    document.querySelectorAll('.ingredient-card-full').forEach(card => {
        const toggleFlip = () => {
            card.classList.toggle('is-flipped');
        };

        card.addEventListener('click', toggleFlip);

        card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleFlip();
            }
        });
    });

    // FAQ Accordion
    document.querySelectorAll('.faq-item-full').forEach(item => {
        const question = item.querySelector('.faq-question-full');
        
        if (!question) return;
        
        const toggleFAQ = () => {
            const isActive = item.classList.contains('active');
            
            // Close all other FAQ items
            document.querySelectorAll('.faq-item-full').forEach(otherItem => {
                if (otherItem !== item) {
                    otherItem.classList.remove('active');
                    const otherQuestion = otherItem.querySelector('.faq-question-full');
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
        
        question.addEventListener('click', toggleFAQ);
        
        question.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleFAQ();
            }
        });
    });
    
    // Image Gallery - Thumbnail switching
    const thumbnails = document.querySelectorAll('.thumbnail');
    const mainImage = document.getElementById('main-product-img');
    const mainImageContainer = document.querySelector('.main-product-image');
    
    thumbnails.forEach(thumbnail => {
        thumbnail.addEventListener('click', () => {
            const newImageUrl = thumbnail.dataset.image;
            
            // Update active thumbnail
            thumbnails.forEach(t => t.classList.remove('active'));
            thumbnail.classList.add('active');
            
            // Update main image
            if (mainImage && newImageUrl) {
                mainImage.src = newImageUrl;
            }
            
            // Update zoom data attribute
            if (mainImageContainer && newImageUrl) {
                mainImageContainer.dataset.zoomImage = newImageUrl;
            }
        });
    });
    
    // Image Zoom functionality
    const zoomModal = document.getElementById('image-zoom-modal');
    const zoomedImage = document.getElementById('zoomed-image');
    const zoomClose = document.getElementById('zoom-close');
    
    if (mainImageContainer && zoomModal && zoomedImage) {
        mainImageContainer.addEventListener('click', () => {
            const imageUrl = mainImageContainer.dataset.zoomImage || mainImage?.src;
            if (imageUrl) {
                zoomedImage.src = imageUrl;
                zoomModal.classList.add('active');
                document.body.style.overflow = 'hidden';
            }
        });
        
        const closeZoom = () => {
            zoomModal.classList.remove('active');
            document.body.style.overflow = '';
        };
        
        if (zoomClose) {
            zoomClose.addEventListener('click', (e) => {
                e.stopPropagation();
                closeZoom();
            });
        }
        
        zoomModal.addEventListener('click', closeZoom);
        
        // Prevent closing when clicking on the image itself
        if (zoomedImage) {
            zoomedImage.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }
        
        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && zoomModal.classList.contains('active')) {
                closeZoom();
            }
        });
    }
}

// =======================================================
//          GLOBAL INTERACTIONS
// =======================================================

function initializeGlobalScripts() {
    // Sticky Header on Scroll
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
    });

    // Mobile Menu
    const closeMenu = () => {
        DOM.menuToggle.classList.remove('active');
        DOM.navLinksContainer.classList.remove('active');
        DOM.navOverlay.classList.remove('active');
        DOM.body.classList.remove('nav-open');
    };
    
    if (DOM.menuToggle) {
        DOM.menuToggle.addEventListener('click', () => {
            DOM.menuToggle.classList.toggle('active');
            DOM.navLinksContainer.classList.toggle('active');
            DOM.navOverlay.classList.toggle('active');
            DOM.body.classList.toggle('nav-open');
        });
    }
    
    if (DOM.navOverlay) {
        DOM.navOverlay.addEventListener('click', closeMenu);
    }
    
    if (DOM.navLinksContainer) {
        DOM.navLinksContainer.addEventListener('click', e => {
            // Don't close the mobile nav when the user is toggling the categories dropdown
            if (e.target.closest('.nav-dropdown-toggle')) return;
            if (e.target.tagName === 'A' || e.target.closest('button')) {
                closeMenu();
            }
        });
    }

    // Theme Toggle
    const themeToggle = document.getElementById('theme-toggle');
    
    function setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        try {
            localStorage.setItem('theme', theme);
        } catch (e) {
            console.warn('Could not save theme preference:', e);
        }
        
        // Update logo for the new theme
        updateLogoForTheme();
        
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

    updateCartCount();
}

// =======================================================
//          MAIN INITIALIZATION
// =======================================================

async function main() {
    // Initialize logo immediately using cached values if available
    initializeLogoFromCache();
    
    initializeGlobalScripts();
    
    // Get product ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id');
    
    if (!productId) {
        DOM.productContent.innerHTML = `
            <div style="text-align: center; padding: 60px 20px;">
                <h2>Продуктът не е намерен</h2>
                <p>Моля, изберете продукт от нашия каталог.</p>
                <a href="index.html" class="btn btn-primary">Назад към продуктите</a>
            </div>
        `;
        return;
    }
    
    try {
        // Load page data
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

        // Render header and footer
        renderHeader(data.settings, data.navigation, data.page_content);
        renderFooter(data.settings, data.footer);

        // Find the product
        let product = null;
        for (const component of data.page_content) {
            if (component.type === 'product_category' && component.products) {
                product = component.products.find(p => p.product_id === productId);
                if (product) break;
            }
        }

        if (product) {
            renderProductDetail(product);
        } else {
            DOM.productContent.innerHTML = `
                <div style="text-align: center; padding: 60px 20px;">
                    <h2>Продуктът не е намерен</h2>
                    <p>Моля, изберете продукт от нашия каталог.</p>
                    <a href="index.html" class="btn btn-primary">Назад към продуктите</a>
                </div>
            `;
        }

    } catch (error) {
        console.error("Error loading product:", error);
        DOM.productContent.innerHTML = `
            <div style="text-align: center; padding: 60px 20px;">
                <h2>Грешка при зареждане</h2>
                <p>Моля, опитайте отново по-късно.</p>
                <a href="index.html" class="btn btn-primary">Назад към продуктите</a>
            </div>
        `;
    }
}

// Start the application
main();
