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

const generateVariantItem = variant => `
    <li class="variant-item">
        <strong>${escapeHtml(variant.title)}</strong>
        <span>${escapeHtml(variant.description)}</span>
        <a href="${escapeHtml(variant.url)}" class="variant-link" target="_blank" rel="noopener">Виж продукта</a>
    </li>`;

const generateEffectBar = effect => `
    <div class="effect-bar-group">
        <div class="effect-label">${escapeHtml(effect.label)}</div>
        <div class="effect-bar-container">
            <div class="effect-bar" data-width="${Number(effect.value)}%">${(effect.value / 10).toFixed(1)} / 10</div>
        </div>
    </div>`;

// --- START: MODIFIED FUNCTION ---
const generateProductCard = (product) => {
    // Проверка за сигурност: ако продуктът няма public_data, не го рендираме.
    if (!product.public_data) {
        console.warn(`Продукт с ID '${product.product_id}' няма 'public_data' и няма да бъде рендиран.`);
        return '';
    }

    const publicData = product.public_data;
    const inventory = product.system_data?.inventory ?? 0;
    const productId = product.product_id; // Използваме надеждния уникален ID
    const cardDetailsId = `card-details-${productId}`;

    return `
    <article class="product-card fade-in-up" data-product-id="${escapeHtml(productId)}">
        ${publicData.image_url ? `<div class="product-image"><img src="${escapeHtml(publicData.image_url)}" alt="${escapeHtml(publicData.name)}" loading="lazy"></div>` : ''}
        <div class="card-header" role="button" aria-expanded="false" aria-controls="${escapeHtml(cardDetailsId)}" tabindex="0">
            <div class="product-title"><h3>${escapeHtml(publicData.name)}</h3><p>${escapeHtml(publicData.tagline)}</p></div>
            <div class="product-price">${Number(publicData.price).toFixed(2)} лв.</div>
            <div class="product-stock ${inventory > 0 ? '' : 'out-of-stock'}">${inventory > 0 ? `Налично: ${inventory}` : 'Изчерпано'}</div>
            <div class="effects-container">
                ${(publicData.effects || []).map(generateEffectBar).join('')}
            </div>
            <span class="expand-icon"></span>
        </div>
        <div class="card-details" id="${escapeHtml(cardDetailsId)}">
            <p>${escapeHtml(publicData.description)}</p>
            ${publicData.research_note && publicData.research_note.url ? `<div class="research-note">Източник: <a href="${escapeHtml(publicData.research_note.url)}" target="_blank" rel="noopener">${escapeHtml(publicData.research_note.text)}</a></div>` : ''}
            <h4 class="details-section-title">Налични форми:</h4>
            <ul class="product-variants">
                ${(publicData.variants || []).map(generateVariantItem).join('')}
            </ul>
            <button class="add-to-cart-btn" data-id="${escapeHtml(productId)}" data-name="${escapeHtml(publicData.name)}" data-price="${escapeHtml(publicData.price)}" data-inventory="${inventory}" ${inventory > 0 ? '' : 'disabled'}>Добави в количката</button>
        </div>
    </article>`;
}
// --- END: MODIFIED FUNCTION ---


const generateHeroHTML = component => `
    <header class="hero-section">
        <canvas id="neuron-canvas"></canvas>
        <div class="container">
            <div class="hero-content">
                <h1>${component.title}</h1>
                <p>${component.subtitle}</p>
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
    <section class="info-card-section fade-in-up ${'image-align-' + (component.options.image_align || 'left')}">
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
    const questionnaireLink = '<li><a href="quest.html">Въпросник</a></li>';
    const persistentLis = DOM.header.navLinks.querySelectorAll('li:nth-last-child(-n+2)');
    DOM.header.navLinks.innerHTML = navItemsHTML + questionnaireLink;
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

function initializePageInteractions() {
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

        const cardHeader = e.target.closest('.product-card .card-header');
        if (cardHeader && !e.target.closest('.add-to-cart-btn')) {
            toggleAccordion(cardHeader);
            return;
        }
        
        const addToCartBtn = e.target.closest('.add-to-cart-btn');
        if (addToCartBtn) {
            e.stopPropagation();
            addToCart(
                addToCartBtn.dataset.id,
                addToCartBtn.dataset.name,
                addToCartBtn.dataset.price,
                addToCartBtn.dataset.inventory
            );
            return;
        }
    });

    document.body.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
            const accordionHeader = e.target.closest('[role="button"][aria-expanded]');
            if (accordionHeader) {
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

    // --- Ingredient Card Flip (Lipolor style) ---
    document.querySelectorAll('.ingredient-card').forEach(card => {
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

    // Initialize Canvas
    initializeCanvasAnimation();
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
    lastHeight = 0;

function initializeCanvasAnimation(forceReinit = false) {
    canvas = document.getElementById('neuron-canvas');
    if (!canvas) return;

    ctx = canvas.getContext('2d');

    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
    }
    
    // Respect user preference for reduced motion
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) return;

    // --- Helper Functions ---
    class Particle {
        constructor(x, y, dirX, dirY, size, color) { this.x = x; this.y = y; this.directionX = dirX; this.directionY = dirY; this.size = size; this.color = color; }
        draw() { ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2, false); ctx.fillStyle = this.color; ctx.fill(); }
        update() { if (this.x > canvas.width || this.x < 0) this.directionX = -this.directionX; if (this.y > canvas.height || this.y < 0) this.directionY = -this.directionY; this.x += this.directionX; this.y += this.directionY; this.draw(); }
    }

    function initParticles() {
        particles = [];
        const baseCount = Math.floor((canvas.width * canvas.height) / 12000);
        const particleCount = Math.max(10, Math.floor(baseCount * (window.innerWidth < 768 ? 0.6 : 1)));
        const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
        for (let i = 0; i < particleCount; i++) {
            particles.push(new Particle(Math.random() * canvas.width, Math.random() * canvas.height, (Math.random() * 0.4) - 0.2, (Math.random() * 0.4) - 0.2, Math.random() * 2 + 1, accentColor));
        }
    }

    function resizeCanvas() {
        const parent = canvas.parentElement;
        if (!parent) return;
        const width = parent.offsetWidth;
        const height = parent.offsetHeight;
        if (width === lastWidth && height === lastHeight) return;

        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        lastWidth = width;
        lastHeight = height;
    }

    function connect() {
        const accentRgb = getComputedStyle(document.documentElement).getPropertyValue('--accent-rgb').trim();
        const connectDistance = Math.min(canvas.width, canvas.height) / 5;
        const connectArea = connectDistance * connectDistance;

        for (let a = 0; a < particles.length; a++) {
            for (let b = a + 1; b < particles.length; b++) {
                let distance = ((particles[a].x - particles[b].x) ** 2) + ((particles[a].y - particles[b].y) ** 2);
                if (distance < connectArea) {
                    let opacityValue = 1 - (distance / (connectArea * 1.1));
                    ctx.strokeStyle = `rgba(${accentRgb}, ${opacityValue})`;
                    ctx.lineWidth = 1;
                    ctx.beginPath(); ctx.moveTo(particles[a].x, particles[a].y); ctx.lineTo(particles[b].x, particles[b].y); ctx.stroke();
                }
            }
        }
    }

    function animate() {
        animationFrameId = requestAnimationFrame(animate);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (let i = 0; i < particles.length; i++) particles[i].update();
        connect();
    }
    
    // --- Execution Logic ---
    if (particles.length === 0 || forceReinit) {
        resizeCanvas();
        initParticles();
    }
    
    animate();

    const debouncedResize = debounce(resizeCanvas, 100);
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

        initializePageInteractions();
        initializeScrollSpy();

    } catch (error) {
        console.error("Fatal Error: Could not load or render page content.", error);
        DOM.mainContainer.innerHTML =
            `<div class="container" style="text-align: center; color: var(--text-secondary); padding: 5rem 1rem;">
                <h2>Грешка при зареждане на съдържанието</h2>
                <p>Не успяхме да се свържем със сървъра. Моля, опреснете страницата или опитайте по-късно.</p>
             </div>`;
    }
}

// Старт на приложението
main();
