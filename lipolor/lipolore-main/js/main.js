'use strict';

/**
 * Executes a function when the DOM is fully loaded.
 * @param {Function} fn The function to execute.
 */
function onReady(fn) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', fn);
    } else {
        fn();
    }
}

/**
 * Language Manager - Handles multi-language support
 */
const LanguageManager = {
    currentLang: 'en',
    defaultLang: 'en',
    
    // Flag emojis for each language
    flagEmojis: {
        'en': '🇬🇧',
        'fr': '🇫🇷',
        'es': '🇪🇸',
        'ru': '🇷🇺'
    },
    
    /**
     * Initialize language system
     */
    init: function() {
        // Load saved language preference or detect from browser
        const savedLang = localStorage.getItem('lipolore_language');
        const browserLang = navigator.language.split('-')[0]; // Get 'en' from 'en-US'
        
        // Determine initial language
        if (savedLang && translations[savedLang]) {
            this.currentLang = savedLang;
        } else if (translations[browserLang]) {
            this.currentLang = browserLang;
        }
        
        // Apply the language
        this.applyLanguage(this.currentLang);
        
        // Set up language switcher buttons
        this.setupLanguageSwitcher();
        this.setupLanguageDropdown();
    },
    
    /**
     * Apply language to all elements with data-i18n attribute
     */
    applyLanguage: function(lang) {
        if (!translations[lang]) {
            lang = this.defaultLang;
        }
        
        this.currentLang = lang;
        localStorage.setItem('lipolore_language', lang);
        
        // Update HTML lang attribute
        document.documentElement.setAttribute('lang', lang);
        
        // Update all translatable elements
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            if (translations[lang][key]) {
                // Handle different element types
                if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                    if (element.hasAttribute('placeholder')) {
                        element.setAttribute('placeholder', translations[lang][key]);
                    } else {
                        element.value = translations[lang][key];
                    }
                } else {
                    element.textContent = translations[lang][key];
                }
            }
        });
        
        // Update active language button (old style)
        document.querySelectorAll('.lang-btn').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-lang') === lang);
        });
        
        // Update active language option in dropdown
        document.querySelectorAll('.lang-option').forEach(option => {
            option.classList.toggle('active', option.getAttribute('data-lang') === lang);
        });
        
        // Update dropdown button flag
        const dropdownBtn = document.querySelector('.lang-dropdown-btn');
        if (dropdownBtn) {
            const flagIcon = dropdownBtn.querySelector('.flag-icon');
            if (flagIcon && this.flagEmojis[lang]) {
                flagIcon.textContent = this.flagEmojis[lang];
            }
        }
    },
    
    /**
     * Set up language switcher event listeners (for old button style)
     */
    setupLanguageSwitcher: function() {
        document.querySelectorAll('.lang-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const lang = btn.getAttribute('data-lang');
                if (lang && translations[lang]) {
                    this.applyLanguage(lang);
                }
            });
        });
    },
    
    /**
     * Set up language dropdown functionality
     */
    setupLanguageDropdown: function() {
        const dropdownBtn = document.querySelector('.lang-dropdown-btn');
        const dropdownMenu = document.querySelector('.lang-dropdown-menu');
        
        if (!dropdownBtn || !dropdownMenu) return;
        
        // Toggle dropdown on button click
        dropdownBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isExpanded = dropdownBtn.getAttribute('aria-expanded') === 'true';
            
            if (isExpanded) {
                this.closeDropdown();
            } else {
                this.openDropdown();
            }
        });
        
        // Handle language selection
        document.querySelectorAll('.lang-option').forEach(option => {
            option.addEventListener('click', (e) => {
                e.preventDefault();
                const lang = option.getAttribute('data-lang');
                if (lang && translations[lang]) {
                    this.applyLanguage(lang);
                    this.closeDropdown();
                }
            });
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!dropdownBtn.contains(e.target) && !dropdownMenu.contains(e.target)) {
                this.closeDropdown();
            }
        });
        
        // Close dropdown on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeDropdown();
            }
        });
    },
    
    /**
     * Open language dropdown
     */
    openDropdown: function() {
        const dropdownBtn = document.querySelector('.lang-dropdown-btn');
        const dropdownMenu = document.querySelector('.lang-dropdown-menu');
        
        if (dropdownBtn && dropdownMenu) {
            dropdownBtn.setAttribute('aria-expanded', 'true');
            dropdownMenu.classList.add('show');
        }
    },
    
    /**
     * Close language dropdown
     */
    closeDropdown: function() {
        const dropdownBtn = document.querySelector('.lang-dropdown-btn');
        const dropdownMenu = document.querySelector('.lang-dropdown-menu');
        
        if (dropdownBtn && dropdownMenu) {
            dropdownBtn.setAttribute('aria-expanded', 'false');
            dropdownMenu.classList.remove('show');
        }
    }
};

/**
 * Initializes all the interactive scripts for the Lipolore website.
 */
function initializeWebsite() {

    /**
     * Adjusts the header and body positions based on the promo banner height.
     * This ensures the banner never overlaps the header on any screen size.
     */
    function adjustHeaderPosition() {
        const promoBanner = document.querySelector('.promo-banner');
        const header = document.querySelector('.main-header');
        const body = document.body;
        
        if (!promoBanner || !header) return;
        
        // Get the actual height of the promo banner
        const bannerHeight = promoBanner.offsetHeight;
        
        // Position the header right below the banner using inline style
        // (inline style is necessary for dynamic positioning)
        header.style.top = `${bannerHeight}px`;
        
        // Get the actual header height for accurate body padding calculation
        const headerHeight = header.offsetHeight;
        
        // Adjust body padding to account for both banner and header
        body.style.paddingTop = `${bannerHeight + headerHeight}px`;
    }

    /**
     * Handles the sticky header functionality.
     * Adds a 'scrolled' class to the header when the user scrolls down.
     */
    function handleStickyHeader() {
        const header = document.querySelector('.main-header');
        if (!header) return;

        const stickyThreshold = 50; // Pixels to scroll before header becomes sticky

        window.addEventListener('scroll', () => {
            if (window.scrollY > stickyThreshold) {
                header.classList.add('scrolled');
            } else {
                header.classList.remove('scrolled');
            }
        });
    }
    
    /**
     * -- CORRECTED --
     * Handles the "reveal on scroll" animations using the Intersection Observer API.
     * It finds elements with 'animate-on-scroll' and adds 'visible' when they enter the viewport.
     */
    function handleScrollAnimations() {
        // Select all elements that should be animated
        const animatedElements = document.querySelectorAll('.animate-on-scroll');
        
        if (!animatedElements.length) return;

        const observerOptions = {
            root: null, // observes intersections relative to the viewport
            threshold: 0.1, // Trigger when 10% of the element is visible
        };

        const revealObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach((entry, index) => {
                // If the element is in the viewport
                if (entry.isIntersecting) {
                    
                    // Add a staggered delay to timeline items for a nicer effect
                    if (entry.target.classList.contains('timeline-item')) {
                        entry.target.style.transitionDelay = `${index * 0.15}s`;
                    }

                    // Add the 'visible' class to trigger the CSS transition
                    entry.target.classList.add('visible');
                    
                    // Stop observing the element once it has been revealed
                    observer.unobserve(entry.target);
                }
            });
        }, observerOptions);

        // Start observing each element
        animatedElements.forEach(el => {
            revealObserver.observe(el);
        });
    }

    /**
     * Handles the interactive flip functionality for the ingredient cards.
     */
    function handleIngredientCardFlip() {
        const cards = document.querySelectorAll('.ingredient-card');
        cards.forEach(card => {
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
    }

    /**
     * Manages the quantity selector in the order form (if present).
     */
    function handleQuantitySelector() {
        const form = document.getElementById('order-form');
        if (!form) return;

        const quantityInput = form.querySelector('#quantity');
        const decreaseBtn = form.querySelector('.quantity-btn[data-action="decrease"]');
        const increaseBtn = form.querySelector('.quantity-btn[data-action="increase"]');

        if (!quantityInput || !decreaseBtn || !increaseBtn) return;

        decreaseBtn.addEventListener('click', () => {
            let currentValue = parseInt(quantityInput.value, 10);
            if (currentValue > 1) {
                quantityInput.value = currentValue - 1;
            }
        });

        increaseBtn.addEventListener('click', () => {
            let currentValue = parseInt(quantityInput.value, 10);
            quantityInput.value = currentValue + 1;
        });
    }
    
    /**
     * Handles form submission with basic validation simulation.
     */
    function handleFormSubmission() {
        const form = document.getElementById('order-form');
        if (!form) return;
        
        form.addEventListener('submit', (e) => {
            e.preventDefault(); // Prevent actual form submission
            
            const currentLang = LanguageManager.currentLang;
            const t = translations[currentLang];
            
            // Basic validation check
            const name = form.querySelector('#name').value.trim();
            const email = form.querySelector('#email').value.trim();
            const message = form.querySelector('#message').value.trim();

            if (!name || !email || !message) {
                alert(t.form_error || 'Please fill in all required fields.');
                return;
            }
            
            // On success
            alert(t.form_success || 'Thank you for your inquiry! Our team will contact you shortly.');
            form.reset(); // Clear the form fields
        });
    }
    
    /**
     * Manages the mobile navigation toggle.
     */
    function handleMobileNavigation() {
        const toggleButton = document.querySelector('.mobile-nav-toggle');
        const header = document.querySelector('.main-header');
        const mainNav = document.querySelector('.main-nav');

        if (!toggleButton || !header || !mainNav) return;

        toggleButton.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent click from bubbling up to the document
            header.classList.toggle('nav-open');
        });

        // Close menu when a link is clicked
        mainNav.addEventListener('click', (e) => {
            if (e.target.tagName === 'A') {
                header.classList.remove('nav-open');
            }
        });
        
        // Close menu when clicking outside of it
        document.addEventListener('click', (e) => {
            const isClickInsideNav = mainNav.contains(e.target);
            const isClickOnToggleButton = toggleButton.contains(e.target);

            if (!isClickInsideNav && !isClickOnToggleButton && header.classList.contains('nav-open')) {
                header.classList.remove('nav-open');
            }
        });
    }

    /**
     * Handles FAQ accordion functionality with keyboard accessibility.
     */
    function handleFAQAccordion() {
        const faqItems = document.querySelectorAll('.faq-item');
        
        faqItems.forEach(item => {
            const question = item.querySelector('.faq-question');
            
            if (!question) return;
            
            const toggleFAQ = () => {
                const isActive = item.classList.contains('active');
                
                // Close all other FAQ items
                faqItems.forEach(otherItem => {
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
    }


    // --- Initialize all functions ---
    LanguageManager.init(); // Initialize language support first
    adjustHeaderPosition(); // Adjust header position based on banner height
    handleStickyHeader();
    handleScrollAnimations();
    handleIngredientCardFlip();
    handleQuantitySelector();
    handleFormSubmission();
    handleMobileNavigation();
    handleFAQAccordion();
    
    // Re-adjust header position on window resize with debouncing for better performance
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(adjustHeaderPosition, 100);
    });
}

// Run the initialization script once the DOM is ready.
onReady(initializeWebsite);
