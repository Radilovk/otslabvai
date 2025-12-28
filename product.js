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
    const inventory = product.system_data?.inventory ?? 0;
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

    // Determine stock status class
    let stockClass = '';
    let stockText = '';
    if (inventory <= 0) {
        stockClass = 'out-of-stock';
        stockText = 'Изчерпано';
    } else if (inventory <= 30) {
        stockClass = 'low-stock';
        stockText = `⚠️ Само ${inventory} бр. налични!`;
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
                            <img src="${escapeHtml(images[0])}" alt="${escapeHtml(publicData.name)}" loading="lazy" id="main-product-img">
                        </div>
                        ${images.length > 1 ? `
                            <div class="image-thumbnails">
                                ${images.map((img, idx) => `
                                    <div class="thumbnail ${idx === 0 ? 'active' : ''}" data-image="${escapeHtml(img)}">
                                        <img src="${escapeHtml(img)}" alt="${escapeHtml(publicData.name)} - Изглед ${idx + 1}">
                                    </div>
                                `).join('')}
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        }
    }

    // Build the product detail HTML
    const productHTML = `
        <div class="product-detail-header">
            <h1>${escapeHtml(publicData.name)}</h1>
            <p class="tagline">${escapeHtml(publicData.tagline)}</p>
            <div class="product-detail-meta">
                <span class="product-detail-price">${Number(publicData.price).toFixed(2)} лв.</span>
                <span class="product-detail-stock ${stockClass}">${stockText}</span>
            </div>
        </div>

        ${imagesHTML}

        ${(publicData.effects && publicData.effects.length > 0) ? `
            <div class="product-detail-effects">
                <h2>Ефекти</h2>
                <div class="effects-container">
                    ${publicData.effects.map(generateEffectBar).join('')}
                </div>
            </div>
        ` : ''}

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
        ${faqHTML}
    `;

    DOM.productContent.innerHTML = productHTML;

    // Setup add to cart button
    if (DOM.addToCartBtn) {
        DOM.addToCartBtn.disabled = inventory <= 0;
        DOM.addToCartBtn.dataset.id = productId;
        DOM.addToCartBtn.dataset.name = publicData.name;
        DOM.addToCartBtn.dataset.price = publicData.price;
        DOM.addToCartBtn.dataset.inventory = inventory;
        
        if (inventory > 0) {
            DOM.addToCartBtn.addEventListener('click', () => {
                addToCart(
                    DOM.addToCartBtn.dataset.id,
                    DOM.addToCartBtn.dataset.name,
                    DOM.addToCartBtn.dataset.price,
                    DOM.addToCartBtn.dataset.inventory
                );
            });
        } else {
            DOM.addToCartBtn.textContent = 'Изчерпано';
        }
    }

    // Initialize interactive elements
    initializeProductInteractions();
}

function renderHeader(settings, navigation) {
    document.title = settings.site_name;
    DOM.header.logoImg.src = encodeURI(settings.logo_url);
    DOM.header.logoImg.alt = `${settings.site_name} Logo`;
    DOM.header.logoImg.style.display = 'block'; // Show the logo
    DOM.header.brandName.textContent = settings.site_name;
    DOM.header.brandSlogan.textContent = settings.site_slogan;

    const navItemsHTML = navigation.map(item => `<li><a href="index.html${item.link}">${item.text}</a></li>`).join('');
    const persistentLis = DOM.header.navLinks.querySelectorAll('li:nth-last-child(-n+2)');
    DOM.header.navLinks.innerHTML = navItemsHTML;
    persistentLis.forEach(li => DOM.header.navLinks.appendChild(li));

    updateCartCount();
}

function renderFooter(settings, footer) {
    const columnsHTML = footer.columns.map(col => {
        if (col.type === 'logo') {
            return `<div class="footer-column">
                 <a href="index.html" class="logo-container footer-logo-container">
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
            response = await fetch(`${API_URL}/page_content.json?v=${Date.now()}`);
            if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
            data = await response.json();
        } catch (apiError) {
            console.warn('API failed, trying mock data:', apiError);
            response = await fetch(`page_content_mock.json?v=${Date.now()}`);
            if (!response.ok) throw new Error('Mock data also unavailable');
            data = await response.json();
        }

        // Render header and footer
        renderHeader(data.settings, data.navigation);
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
