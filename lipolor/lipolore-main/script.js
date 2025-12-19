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
 * Initializes all the interactive scripts for the Lipolore website.
 */
function initializeWebsite() {

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
     * Manages the quantity selector in the order form.
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
            
            // Basic validation check
            const name = form.querySelector('#name').value.trim();
            const phone = form.querySelector('#phone').value.trim();
            const address = form.querySelector('#address').value.trim();

            if (!name || !phone || !address) {
                alert('Please fill in all required fields: Name, Phone, and Address.');
                return;
            }
            
            // On success
            alert('Thank you for your order! Our team will contact you shortly to confirm the details.');
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


    // --- Initialize all functions ---
    handleStickyHeader();
    handleScrollAnimations();
    handleIngredientCardFlip();
    handleQuantitySelector();
    handleFormSubmission();
    handleMobileNavigation();
}

// Run the initialization script once the DOM is ready.
onReady(initializeWebsite);