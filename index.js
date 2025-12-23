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
    const productId = product.product_id; // Използваме надеждния уникален ID

    return `
    <a href="product.html?id=${encodeURIComponent(productId)}" class="product-card fade-in-up" data-product-id="${escapeHtml(productId)}">
        ${publicData.image_url ? `<div class="product-image"><img src="${escapeHtml(publicData.image_url)}" alt="${escapeHtml(publicData.name)}" loading="lazy"></div>` : ''}
        <div class="card-content">
            <div class="product-title"><h3>${escapeHtml(publicData.name)}</h3><p>${escapeHtml(publicData.tagline)}</p></div>
            <div class="product-price">${Number(publicData.price).toFixed(2)} лв.</div>
            <div class="product-stock ${inventory > 0 ? '' : 'out-of-stock'}">${inventory > 0 ? `Налично: ${inventory}` : 'Изчерпано'}</div>
            <div class="effects-container">
                ${(publicData.effects || []).map(generateEffectBar).join('')}
            </div>
        </div>
    </a>`;
}
// --- END: MODIFIED FUNCTION ---


const generateHeroHTML = component => `
    <header class="hero-section">
        <canvas id="neuron-canvas"></canvas>
        <div class="container">
            <div class="hero-content">
                <h1>${component.title}</h1>
                <p>${component.subtitle}</p>
                <div class="hero-cta-group">
                    <button class="btn-hero-primary" onclick="document.getElementById('products')?.scrollIntoView({behavior: 'smooth'})">
                        🛒 Разгледай продуктите
                    </button>
                    <button class="btn-hero-secondary" onclick="document.getElementById('benefits')?.scrollIntoView({behavior: 'smooth'})">
                        ℹ️ Научи повече
                    </button>
                </div>
                <div class="hero-stats">
                    <div class="stat-item">
                        <strong>2,840+</strong>
                        <span>Доволни клиенти</span>
                    </div>
                    <div class="stat-item">
                        <strong>98%</strong>
                        <span>Успеваемост</span>
                    </div>
                    <div class="stat-item">
                        <strong>100%</strong>
                        <span>Естествени съставки</span>
                    </div>
                </div>
                <div class="hero-trust-badges">
                    <div class="trust-badge">✓ Клинично тествано</div>
                    <div class="trust-badge">✓ GMP сертифицирано</div>
                    <div class="trust-badge">✓ 30 дни гаранция</div>
                </div>
            </div>
        </div>
    </header>`;

// --- START: MODIFIED FUNCTION ---
const generateProductCategoryHTML = (component, index) => {
    const isCollapsible = component.options.is_collapsible;
    const isExpanded = component.options.is_expanded_by_default;
    const productGridId = `product-grid-${component.id || index}`;
    return `
    <section id="${component.id}" class="category-section fade-in-up ${isCollapsible ? '' : 'not-collapsible'}">
        <div class="container">
             <div class="category-header" ${isCollapsible ? `role="button" aria-expanded="${isExpanded}" aria-controls="${productGridId}" tabindex="0"` : ''}>
                <h2 class="category-title">
                    ${component.title}
                    ${isCollapsible ? '<span class="category-expand-icon"></span>' : ''}
                </h2>
                ${component.image ? `<div class="category-image-wrapper"><img src="${component.image}" alt="${component.title}" loading="lazy"></div>` : ''}
            </div>
            <div class="product-grid" id="${productGridId}">
                ${(component.products || []).map(generateProductCard).join('')}
            </div>
        </div>
    </section>`;
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

const showAddToCartFeedback = (productId) => {
    const card = document.querySelector(`.product-card[data-product-id="${productId}"]`);
    if (!card) return;
    const btn = card.querySelector('.add-to-cart-btn');
    if (!btn || btn.classList.contains('added')) return;
    
    btn.classList.add('added');
    btn.textContent = 'Добавено ✓';
    
    setTimeout(() => {
        btn.classList.remove('added');
        btn.textContent = 'Добави в количката';
    }, 2000);
}

const addToCart = (id, name, price, inventory) => {
    const maxQty = Number(inventory) || 0;
    const cart = getCart();
    const idx = cart.findIndex(i => i.id === id);
    if (idx > -1) {
        if (maxQty && cart[idx].quantity >= maxQty) {
            showToast('Няма достатъчна наличност.', 'error');
            return;
        }
        cart[idx].quantity++;
    } else {
        if (maxQty === 0) {
            showToast('Продуктът е изчерпан.', 'error');
            return;
        }
        cart.push({ id, name, price: Number(price), quantity: 1, inventory: maxQty });
    }
    saveCart(cart);
    updateCartCount();
    showAddToCartFeedback(id);
};


// =======================================================
//          4. РЕНДЪРИ НА СЪДЪРЖАНИЕ (RENDERERS)
// =======================================================

function renderHeader(settings, navigation) {
    document.title = settings.site_name;
    DOM.header.logoImg.src = encodeURI(settings.logo_url);
    DOM.header.logoImg.alt = `${settings.site_name} Logo`;
    DOM.header.brandName.textContent = settings.site_name;
    DOM.header.brandSlogan.textContent = settings.site_slogan;

    const navItemsHTML = navigation.map(item => `<li><a href="${item.link}">${item.text}</a></li>`).join('');
    const persistentLis = DOM.header.navLinks.querySelectorAll('li:nth-last-child(-n+2)');
    DOM.header.navLinks.innerHTML = navItemsHTML;
    persistentLis.forEach(li => DOM.header.navLinks.appendChild(li));

    updateCartCount();
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
    const columnsHTML = footer.columns.map(col => {
        if (col.type === 'logo') {
            return `<div class="footer-column">
                 <a href="#" class="logo-container footer-logo-container">
                    <img src="${settings.logo_url}" alt="${settings.site_name} Logo">
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

    // --- Save scroll position before navigating to product page (using event delegation) ---
    document.body.addEventListener('click', (e) => {
        const productCard = e.target.closest('.product-card');
        if (productCard) {
            sessionStorage.setItem('indexScrollPosition', window.scrollY.toString());
        }
    });

    // --- Ingredient Card Flip (Lipolor style) - supports both mini and full versions ---
    document.querySelectorAll('.ingredient-card, .ingredient-card-mini, .ingredient-card-full').forEach(card => {
        const toggleFlip = () => {
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

    // Initialize Canvas with selected animation type
    const animationType = settings.background_animation || 'rising-success';
    initializeCanvasAnimation(animationType);
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
        if (e.target.tagName === 'A' || e.target.closest('button')) {
            closeMenu();
        }
    });

    // --- Quest Modal ---
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

    // --- Theme Toggle ---
    const themeToggle = document.getElementById('theme-toggle');
    
    function setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        try {
            localStorage.setItem('theme', theme);
        } catch (e) {
            console.warn('Could not save theme preference:', e);
        }
        
        // Reinitialize canvas animation with new colors
        if (typeof initializeCanvasAnimation === 'function') {
            initializeCanvasAnimation(currentAnimationType, true);
        }
        
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
                    
                    // Reinitialize canvas animation with new colors
                    if (typeof initializeCanvasAnimation === 'function') {
                        initializeCanvasAnimation(currentAnimationType, true);
                    }
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
//          6. CANVAS АНИМАЦИЯ (CANVAS LOGIC)
// =======================================================
let animationFrameId;
let canvas, ctx,
    particles = [],
    lastWidth = 0,
    lastHeight = 0,
    currentAnimationType = 'rising-success';

function initializeCanvasAnimation(animationType = 'rising-success', forceReinit = false) {
    canvas = document.getElementById('neuron-canvas');
    if (!canvas) return;

    ctx = canvas.getContext('2d');

    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
    }
    
    // Respect user preference for reduced motion
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) return;
    
    // --- Mobile Detection Constants ---
    const isMobile = window.innerWidth < 768;
    const isSmallMobile = window.innerWidth < 480;
    
    // Disable animations on very small screens for better performance
    // CSS will handle hiding the canvas via display:none, we just exit early
    if (isSmallMobile) {
        return;
    }

    currentAnimationType = animationType;

    // --- Common Helper Functions ---
    function resizeCanvas() {
        const parent = canvas.parentElement;
        if (!parent) return;
        const width = parent.offsetWidth;
        const height = parent.offsetHeight;
        if (width === lastWidth && height === lastHeight) return;

        // Optimize DPR for mobile devices - use lower resolution for better performance
        const dpr = isMobile ? Math.min(window.devicePixelRatio || 1, 1.5) : (window.devicePixelRatio || 1);
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        lastWidth = width;
        lastHeight = height;
    }

    // =======================================================
    //   АНИМАЦИЯ 1: Rising Success (Възходящ успех)
    //   Психологически ефект: Прогрес, постигане на цели
    // =======================================================
    const risingSuccessAnimation = {
        init: function() {
            particles = [];
            const baseCount = Math.floor((canvas.width * canvas.height) / 15000);
            // Further reduce particles on mobile for better performance
            const particleMultiplier = isSmallMobile ? 0.3 : (isMobile ? 0.5 : 1);
            const particleCount = Math.max(isSmallMobile ? 4 : 8, Math.floor(baseCount * particleMultiplier));
            const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
            
            for (let i = 0; i < particleCount; i++) {
                particles.push({
                    x: Math.random() * canvas.width,
                    y: canvas.height + Math.random() * 100,
                    speed: Math.random() * 0.5 + 0.3,
                    size: Math.random() * 3 + 1,
                    opacity: Math.random() * 0.5 + 0.3,
                    color: accentColor,
                    wobble: Math.random() * Math.PI * 2,
                    wobbleSpeed: Math.random() * 0.02 + 0.01
                });
            }
        },
        animate: function() {
            const accentRgb = getComputedStyle(document.documentElement).getPropertyValue('--accent-rgb').trim();
            
            particles.forEach(p => {
                p.y -= p.speed;
                p.wobble += p.wobbleSpeed;
                p.x += Math.sin(p.wobble) * 0.5;
                
                // Fade out as it rises
                if (p.y < canvas.height * 0.3) {
                    p.opacity -= 0.005;
                }
                
                // Reset particle
                if (p.y < -10 || p.opacity <= 0) {
                    p.y = canvas.height + 10;
                    p.x = Math.random() * canvas.width;
                    p.opacity = Math.random() * 0.5 + 0.3;
                    p.wobble = Math.random() * Math.PI * 2;
                }
                
                // Draw particle with glow (optimized)
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(${accentRgb}, ${p.opacity})`;
                ctx.fill();
                
                // Optional subtle glow for better performance - disable on mobile
                if (p.opacity > 0.3 && !isMobile) {
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, p.size + 2, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(${accentRgb}, ${p.opacity * 0.3})`;
                    ctx.fill();
                }
            });
        }
    };

    // =======================================================
    //   АНИМАЦИЯ 2: Energy Pulse (Енергиен пулс)
    //   Психологически ефект: Виталност, динамичност, сила
    // =======================================================
    const energyPulseAnimation = {
        init: function() {
            particles = [];
            const ringCount = 5;
            const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
            
            for (let i = 0; i < ringCount; i++) {
                particles.push({
                    radius: (i * canvas.height / (ringCount * 2)),
                    maxRadius: canvas.height * 1.5,
                    speed: 0.5 + (i * 0.1),
                    opacity: 0.4,
                    color: accentColor
                });
            }
        },
        animate: function() {
            const accentRgb = getComputedStyle(document.documentElement).getPropertyValue('--accent-rgb').trim();
            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;
            
            particles.forEach(ring => {
                ring.radius += ring.speed;
                ring.opacity = 0.4 * (1 - ring.radius / ring.maxRadius);
                
                if (ring.radius > ring.maxRadius) {
                    ring.radius = 0;
                    ring.opacity = 0.4;
                }
                
                // Draw expanding ring
                ctx.beginPath();
                ctx.arc(centerX, centerY, ring.radius, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(${accentRgb}, ${ring.opacity})`;
                ctx.lineWidth = 2;
                ctx.stroke();
            });
        }
    };

    // =======================================================
    //   АНИМАЦИЯ 3: Trust Flow (Поток на доверие)
    //   Психологически ефект: Спокойствие, стабилност, надеждност
    // =======================================================
    const trustFlowAnimation = {
        init: function() {
            particles = [];
            const waveCount = 6;
            const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
            
            for (let i = 0; i < waveCount; i++) {
                particles.push({
                    y: (canvas.height / waveCount) * i,
                    amplitude: 30 + Math.random() * 20,
                    frequency: 0.002 + Math.random() * 0.001,
                    phase: Math.random() * Math.PI * 2,
                    speed: 0.01 + Math.random() * 0.01,
                    opacity: 0.15 + Math.random() * 0.1,
                    color: accentColor
                });
            }
        },
        animate: function() {
            const accentRgb = getComputedStyle(document.documentElement).getPropertyValue('--accent-rgb').trim();
            const step = Math.max(3, Math.floor(canvas.width / 200)); // Dynamic step based on canvas width
            
            particles.forEach(wave => {
                wave.phase += wave.speed;
                
                ctx.beginPath();
                ctx.moveTo(0, wave.y);
                
                for (let x = 0; x < canvas.width; x += step) {
                    const y = wave.y + Math.sin(x * wave.frequency + wave.phase) * wave.amplitude;
                    ctx.lineTo(x, y);
                }
                
                ctx.strokeStyle = `rgba(${accentRgb}, ${wave.opacity})`;
                ctx.lineWidth = 2;
                ctx.stroke();
            });
        }
    };

    // =======================================================
    //   АНИМАЦИЯ 4: Goal Achievement (Постигане на цели)
    //   Психологически ефект: Фокус, целенасоченост, резултати
    // =======================================================
    const goalAchievementAnimation = {
        init: function() {
            particles = [];
            const particleCount = Math.floor((canvas.width * canvas.height) / 20000);
            const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
            
            for (let i = 0; i < Math.max(5, particleCount); i++) {
                const angle = Math.random() * Math.PI * 2;
                const distance = Math.random() * Math.min(canvas.width, canvas.height) / 2;
                
                particles.push({
                    startX: Math.random() * canvas.width,
                    startY: Math.random() * canvas.height,
                    targetX: canvas.width / 2,
                    targetY: canvas.height / 2,
                    x: Math.random() * canvas.width,
                    y: Math.random() * canvas.height,
                    progress: Math.random(),
                    speed: 0.005 + Math.random() * 0.005,
                    size: Math.random() * 2 + 1,
                    opacity: 0.5,
                    color: accentColor
                });
            }
        },
        animate: function() {
            const accentRgb = getComputedStyle(document.documentElement).getPropertyValue('--accent-rgb').trim();
            
            particles.forEach(p => {
                p.progress += p.speed;
                
                if (p.progress >= 1) {
                    p.progress = 0;
                    p.startX = Math.random() * canvas.width;
                    p.startY = Math.random() * canvas.height;
                    p.opacity = 0.5;
                }
                
                // Easing function for smooth movement
                const eased = 1 - Math.pow(1 - p.progress, 3);
                p.x = p.startX + (p.targetX - p.startX) * eased;
                p.y = p.startY + (p.targetY - p.startY) * eased;
                p.opacity = 0.5 * (1 - p.progress);
                
                // Draw particle
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(${accentRgb}, ${p.opacity})`;
                ctx.fill();
                
                // Draw trail
                if (p.progress > 0.1) {
                    const prevProgress = Math.max(0, p.progress - 0.1);
                    const prevEased = 1 - Math.pow(1 - prevProgress, 3);
                    const prevX = p.startX + (p.targetX - p.startX) * prevEased;
                    const prevY = p.startY + (p.targetY - p.startY) * prevEased;
                    
                    ctx.beginPath();
                    ctx.moveTo(prevX, prevY);
                    ctx.lineTo(p.x, p.y);
                    ctx.strokeStyle = `rgba(${accentRgb}, ${p.opacity * 0.3})`;
                    ctx.lineWidth = 1;
                    ctx.stroke();
                }
            });
        }
    };

    // =======================================================
    //   АНИМАЦИЯ 5: Transformation Bubbles (Трансформационни балони)
    //   Психологически ефект: Промяна, лекота, постигане
    // =======================================================
    const transformationBubblesAnimation = {
        init: function() {
            particles = [];
            const baseCount = Math.floor((canvas.width * canvas.height) / 18000);
            // Further reduce particles on mobile for better performance
            const particleMultiplier = isSmallMobile ? 0.3 : (isMobile ? 0.5 : 1);
            const particleCount = Math.max(isSmallMobile ? 3 : 6, Math.floor(baseCount * particleMultiplier));
            const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
            
            for (let i = 0; i < particleCount; i++) {
                particles.push({
                    x: Math.random() * canvas.width,
                    y: canvas.height + Math.random() * 100,
                    baseSize: Math.random() * 15 + 10,
                    size: 0,
                    maxSize: Math.random() * 15 + 10,
                    speed: Math.random() * 0.3 + 0.2,
                    opacity: Math.random() * 0.3 + 0.2,
                    growthPhase: Math.random() * Math.PI * 2,
                    color: accentColor,
                    drift: (Math.random() - 0.5) * 0.3
                });
            }
        },
        animate: function() {
            const accentRgb = getComputedStyle(document.documentElement).getPropertyValue('--accent-rgb').trim();
            
            particles.forEach(p => {
                p.y -= p.speed;
                p.x += p.drift;
                p.growthPhase += 0.05;
                p.size = p.maxSize * (0.5 + Math.sin(p.growthPhase) * 0.5);
                
                // Pop effect near top
                if (p.y < canvas.height * 0.2) {
                    p.opacity -= 0.01;
                }
                
                // Reset bubble
                if (p.y < -50 || p.opacity <= 0) {
                    p.y = canvas.height + 10;
                    p.x = Math.random() * canvas.width;
                    p.opacity = Math.random() * 0.3 + 0.2;
                    p.maxSize = Math.random() * 15 + 10;
                    p.growthPhase = 0;
                }
                
                // Draw bubble with highlight
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(${accentRgb}, ${p.opacity})`;
                ctx.lineWidth = 2;
                ctx.stroke();
                
                // Inner glow - disable on mobile for better performance
                if (!isMobile) {
                    ctx.beginPath();
                    ctx.arc(p.x - p.size * 0.3, p.y - p.size * 0.3, p.size * 0.3, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity * 0.3})`;
                    ctx.fill();
                }
            });
        }
    };

    // Animation registry
    const animations = {
        'rising-success': risingSuccessAnimation,
        'energy-pulse': energyPulseAnimation,
        'trust-flow': trustFlowAnimation,
        'goal-achievement': goalAchievementAnimation,
        'transformation-bubbles': transformationBubblesAnimation
    };

    // Frame skipping for mobile performance optimization
    let frameCount = 0;
    const frameSkip = isMobile ? 2 : 1; // Skip every other frame on mobile

    function animate() {
        const currentAnimation = animations[currentAnimationType];
        if (!currentAnimation) return; // Early exit if no valid animation
        
        animationFrameId = requestAnimationFrame(animate);
        
        // Frame skipping for mobile performance
        frameCount = (frameCount + 1) % 100; // Reset periodically to prevent overflow
        if (frameCount % frameSkip !== 0) return;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        currentAnimation.animate();
    }
    
    // --- Execution Logic ---
    if (particles.length === 0 || forceReinit) {
        resizeCanvas();
        const currentAnimation = animations[currentAnimationType];
        if (currentAnimation) {
            currentAnimation.init();
        }
    }
    
    animate();

    const debouncedResize = debounce(() => {
        resizeCanvas();
        const currentAnimation = animations[currentAnimationType];
        if (currentAnimation) {
            currentAnimation.init();
        }
    }, 100);
    window.addEventListener('resize', debouncedResize);
}


// =======================================================
//          7. ГЛАВНА ИЗПЪЛНЯВАЩА ФУНКЦИЯ (MAIN)
// =======================================================
async function main() {
    initializeGlobalScripts();
    
    try {
        // Try to use mock data for testing if API fails
        let response, data;
        try {
            response = await fetch(`${API_URL}/page_content.json?v=${Date.now()}`);
            if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
            data = await response.json();
        } catch (apiError) {
            console.warn('API failed, trying mock data:', apiError);
            response = await fetch(`page_content_mock.json?v=${Date.now()}`);
            if (!response.ok) throw new Error('Mock data also unavailable');
            data = await response.json();
        }

        DOM.mainContainer.innerHTML = ''; 
        
        renderHeader(data.settings, data.navigation);
        renderMainContent(data.page_content);
        renderFooter(data.settings, data.footer);
        
        DOM.mainContainer.classList.add('is-loaded');

        initializePageInteractions(data.settings);
        initializeScrollSpy();
        initializeMarketingFeatures();

        // Restore scroll position if returning from product page
        // Small timeout to ensure DOM is fully rendered before scrolling
        const savedScrollPosition = sessionStorage.getItem('indexScrollPosition');
        if (savedScrollPosition) {
            setTimeout(() => {
                window.scrollTo(0, parseInt(savedScrollPosition, 10));
                sessionStorage.removeItem('indexScrollPosition');
            }, 100);
        }

    } catch (error) {
        console.error("Fatal Error: Could not load or render page content.", error);
        DOM.mainContainer.innerHTML =
            `<div class="container" style="text-align: center; color: var(--text-secondary); padding: 5rem 1rem;">
                <h2>Грешка при зареждане на съдържанието</h2>
                <p>Не успяхме да се свържем със сървъра. Моля, опреснете страницата или опитайте по-късно.</p>
             </div>`;
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
    
    // 5. Stock Urgency Indicators
    updateStockUrgency();
    
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
            badge = createBadge('⭐ Най-продаван', 'bestseller');
        }
        // Second product - New
        else if (index === 1) {
            badge = createBadge('🆕 Ново', 'new');
        }
        // Third product - Limited offer
        else if (index === 2) {
            badge = createBadge('🔥 Ограничена оферта', 'limited');
        }
        
        if (badge) {
            card.style.position = 'relative';
            card.insertBefore(badge, card.firstChild);
        }
    });
}

function createBadge(text, type) {
    const badge = document.createElement('div');
    badge.className = `product-badge ${type}`;
    badge.textContent = text;
    return badge;
}

// Update stock urgency styling
function updateStockUrgency() {
    const stockElements = document.querySelectorAll('.product-stock');
    
    stockElements.forEach(stock => {
        const text = stock.textContent;
        const match = text.match(/Налично:\s*(\d+)/);
        
        if (match) {
            const quantity = parseInt(match[1]);
            
            if (quantity > 0 && quantity <= 30) {
                stock.classList.add('low-stock');
                stock.textContent = `⚠️ Само ${quantity} бр. налични!`;
            } else if (quantity > 30) {
                stock.classList.add('in-stock');
            }
        }
    });
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

// Старт на приложението
main();
