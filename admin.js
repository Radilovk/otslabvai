// =======================================================
//          1. ИНИЦИАЛИЗАЦИЯ И СЪСТОЯНИЕ
// =======================================================

// API Endpoint
import { API_URL } from './config.js';

function escapeAdminHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

// =======================================================
//          THEME TOGGLE FUNCTIONALITY
// =======================================================
function initThemeToggle() {
    const themeToggle = document.getElementById('theme-toggle');
    
    function setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        try {
            localStorage.setItem('theme', theme);
        } catch (e) {
            console.warn('Could not save theme preference:', e);
        }
    }
    
    function toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
    }
    
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }
}

// Централизирани DOM елементи
const DOM = {
    // Основни
    saveBtn: document.getElementById('save-all-btn'),
    saveStatus: document.getElementById('save-status'),
    // Табове
    tabNav: document.querySelector('.tab-nav'),
    tabPanes: document.querySelectorAll('.tab-pane'),
    // Контейнери
    globalSettingsContainer: document.getElementById('global-settings-container'),
    navigationList: document.getElementById('navigation-list'),
    pageBuilderList: document.getElementById('page-builder-list'),
    footerSettingsContainer: document.getElementById('footer-settings-container'),
    // Поръчки
    ordersTableBody: document.getElementById('orders-table-body'),
    orderSearchInput: document.getElementById('order-search-input'),
    refreshOrdersBtn: document.getElementById('refresh-orders-btn'),
    // Контакти
    contactsTableBody: document.getElementById('contacts-table-body'),
    contactSearchInput: document.getElementById('contact-search-input'),
    refreshContactsBtn: document.getElementById('refresh-contacts-btn'),
    // Промо Кодове
    promoCodesTableBody: document.getElementById('promo-codes-table-body'),
    promoSearchInput: document.getElementById('promo-search-input'),
    addPromoBtn: document.getElementById('add-promo-btn'),
    refreshPromoBtn: document.getElementById('refresh-promo-btn'),
    // Добавяне на компонент
    addComponentDropdown: document.getElementById('add-component-dropdown'),
    addComponentToggleBtn: document.querySelector('[data-action="toggle-add-component-menu"]'),
    // Модал
    modal: {
        container: document.getElementById('modal-container'),
        backdrop: document.getElementById('modal-backdrop'),
        title: document.getElementById('modal-title'),
        body: document.getElementById('modal-body'),
        saveBtn: document.getElementById('save-modal-btn'),
        cancelBtn: document.getElementById('cancel-modal-btn'),
        closeBtn: document.getElementById('close-modal-btn'),
    },
    // Нотификации
    notificationContainer: document.getElementById('notification-container'),
    undoNotification: document.getElementById('undo-notification'),
    undoBtn: document.getElementById('undo-delete-btn'),
    // Шаблони
    templates: {
        listItem: document.getElementById('list-item-template'),
        orderRow: document.getElementById('order-row-template'),
        contactRow: document.getElementById('contact-row-template'),
        promoCodeRow: document.getElementById('promo-code-row-template'),
    }
};

// Глобално състояние
let appData = {};
let ordersData = [];
let filteredOrdersData = [];
let orderSortField = 'timestamp';
let orderSortDir = 'desc';
let contactsData = [];
let filteredContactsData = [];
let activeContactSourceFilter = '';
let contactSortField = 'timestamp';
let contactSortDir = 'desc';
let promoCodesData = [];
let filteredPromoCodesData = [];
let unsavedChanges = false;
let activeUndoAction = null;
let currentModalSaveCallback = null;
let currentProject = localStorage.getItem('adminProject') || 'main';

// localStorage cache key and TTL for contacts (24 hours is enough)
const CONTACTS_CACHE_KEY = 'adminContactsCache';
const CONTACTS_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// =======================================================
//          2. API КОМУНИКАЦИЯ
// =======================================================

function getPageContentEndpoint() {
    return currentProject === 'life' ? 'life_page_content.json' : 'page_content.json';
}

async function fetchData() {
    try {
        // For admin panel, use no-cache to ensure fresh data when explicitly refreshing
        const response = await fetch(`${API_URL}/${getPageContentEndpoint()}`, {
            cache: 'no-cache'
        });
        if (!response.ok) throw new Error(`HTTP грешка! Статус: ${response.status}`);
        return await response.json();
    } catch (error) {
        showNotification('Критична грешка при зареждане на данните.', 'error');
        console.error("Грешка при зареждане на page_content:", error);
        return null;
    }
}

async function fetchOrders() {
    try {
        // For dynamic data like orders, use no-cache to always get fresh data
        const response = await fetch(`${API_URL}/orders`, {
            cache: 'no-cache'
        });
        if (!response.ok) throw new Error(`HTTP грешка! Статус: ${response.status}`);
        const rawOrders = await response.json();
        ordersData = rawOrders.map((order, index) => ({ ...order, id: order.id || `order_${index}_${Date.now()}` }));
        filteredOrdersData = [...ordersData];
    } catch (error) {
        showNotification('Грешка при зареждане на поръчките.', 'error');
        console.error("Грешка при зареждане на поръчки:", error);
        ordersData = [];
        filteredOrdersData = [];
    }
}

async function fetchContacts(forceRefresh = false) {
    try {
        // Use localStorage cache – contacts need only one backend fetch per 24 hours.
        if (!forceRefresh) {
            try {
                const cached = JSON.parse(localStorage.getItem(CONTACTS_CACHE_KEY) || 'null');
                if (cached && (Date.now() - cached.timestamp) < CONTACTS_CACHE_TTL_MS) {
                    contactsData = cached.data;
                    filteredContactsData = [...contactsData];
                    return;
                }
            } catch (e) { /* ignore corrupt cache entry */ }
        }
        const response = await fetch(`${API_URL}/contacts`, {
            cache: 'no-cache'
        });
        if (!response.ok) throw new Error(`HTTP грешка! Статус: ${response.status}`);
        const rawContacts = await response.json();
        contactsData = rawContacts.map((contact, index) => ({ ...contact, id: contact.id || `contact_${index}_${Date.now()}` }));
        filteredContactsData = [...contactsData];
        // Persist to localStorage so we skip the backend for the next 24 hours.
        try {
            localStorage.setItem(CONTACTS_CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data: contactsData }));
        } catch (e) { /* quota exceeded – ignore */ }
    } catch (error) {
        showNotification('Грешка при зареждане на контактите.', 'error');
        console.error("Грешка при зареждане на контакти:", error);
        contactsData = [];
        filteredContactsData = [];
    }
}

// Update localStorage cache when contact statuses change
function updateContactsCache() {
    try {
        localStorage.setItem(CONTACTS_CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data: contactsData }));
    } catch (e) { /* quota exceeded – ignore */ }
}

async function fetchPromoCodes() {
    try {
        // For dynamic data like promo codes, use no-cache to always get fresh data
        const response = await fetch(`${API_URL}/promo-codes`, {
            cache: 'no-cache'
        });
        if (!response.ok) throw new Error(`HTTP грешка! Статус: ${response.status}`);
        const rawPromoCodes = await response.json();
        promoCodesData = rawPromoCodes.map((promo, index) => ({ ...promo, id: promo.id || `promo_${index}_${Date.now()}` }));
        filteredPromoCodesData = [...promoCodesData];
    } catch (error) {
        showNotification('Грешка при зареждане на промо кодовете.', 'error');
        console.error("Грешка при зареждане на промо кодове:", error);
        promoCodesData = [];
        filteredPromoCodesData = [];
    }
}

async function saveData() {
    if (!unsavedChanges) return;

    DOM.saveBtn.disabled = true;
    DOM.saveStatus.textContent = 'Записване...';
    DOM.saveStatus.className = 'save-status is-saving';

    try {
        const response = await fetch(`${API_URL}/${getPageContentEndpoint()}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(appData, null, 2)
        });

        if (response.ok) {
            setUnsavedChanges(false);
            showNotification('Промените са записани успешно.', 'success');
            // Signal the public-facing page that its cached JSON is stale so that
            // the next visit bypasses the browser cache and fetches fresh content.
            const dirtyCookie = currentProject === 'life' ? 'life_dirty=1' : 'page_dirty=1';
            document.cookie = dirtyCookie + '; path=/';
        } else {
            throw new Error(`Грешка от сървъра: ${response.statusText}`);
        }
    } catch (err) {
        showNotification('Грешка при записване на данните.', 'error');
        console.error('Грешка при записване:', err);
        DOM.saveBtn.disabled = false; // Позволи нов опит
        DOM.saveStatus.textContent = 'Грешка при запис!';
        DOM.saveStatus.className = 'save-status is-dirty';
    }
}

// =======================================================
//          3. УПРАВЛЕНИЕ НА СЪСТОЯНИЕТО
// =======================================================

function setUnsavedChanges(isDirty) {
    unsavedChanges = isDirty;
    if (isDirty) {
        DOM.saveBtn.disabled = false;
        DOM.saveStatus.textContent = 'Има незаписани промени.';
        DOM.saveStatus.className = 'save-status is-dirty';
    } else {
        DOM.saveBtn.disabled = true;
        DOM.saveStatus.textContent = 'Всички промени са записани.';
        DOM.saveStatus.className = 'save-status';
    }
}

// =======================================================
//          4. РЕНДИРАНЕ НА ИНТЕРФЕЙСА (VIEW)
// =======================================================

function renderAll() {
    renderGlobalSettings();
    renderNavigation();
    renderPageContent();
    renderFooter();
    filterOrders(); // This will call renderOrders
    filterContacts(); // This will call renderContacts
}

function renderGlobalSettings() {
    DOM.globalSettingsContainer.innerHTML = '';
    const item = createListItem({
        type: 'Настройки на сайта',
        title: appData.settings.site_name,
        actions: [
            { label: 'Редактирай', action: 'edit-global-settings', class: 'btn-secondary' }
        ]
    });
    item.querySelector('.handle').style.display = 'none';
    DOM.globalSettingsContainer.appendChild(item);
}

function renderNavigation() {
    DOM.navigationList.innerHTML = '';
    appData.navigation.forEach((navItem, index) => {
        const item = createListItem({
            id: index,
            type: 'Линк',
            title: navItem.text,
            actions: [
                { label: 'Редактирай', action: 'edit-nav-item', class: 'btn-secondary' },
                { label: 'Изтрий', action: 'delete-nav-item', class: 'btn-danger' }
            ]
        });
        DOM.navigationList.appendChild(item);
    });
    initSortable(DOM.navigationList, appData.navigation);
}

function renderPageContent() {
    DOM.pageBuilderList.innerHTML = '';
    const componentTypes = {
        hero_banner: 'Hero Banner',
        product_category: 'Продуктова Категория',
        info_card: 'Информационен Кард',
        benefits: 'Ползи',
        timeline: 'Времева линия',
        ingredients: 'Съставки',
        testimonials: 'Отзиви',
        faq: 'Често задавани въпроси',
        guarantee: 'Гаранции',
        contact: 'Контакти',
    };
    appData.page_content.forEach(component => {
        const typeLabel = (component.is_hidden && component.type === 'product_category')
            ? `${componentTypes[component.type] || component.type} 🙈 Скрита`
            : (componentTypes[component.type] || component.type);
        const item = createListItem({
            id: component.component_id,
            type: typeLabel,
            title: component.title,
            actions: [
                { label: 'Редактирай', action: 'edit-component', class: 'btn-secondary' },
                { label: 'Изтрий', action: 'delete-component', class: 'btn-danger' }
            ]
        });
        if (component.is_hidden && component.type === 'product_category') {
            item.style.opacity = '0.6';
        }
        DOM.pageBuilderList.appendChild(item);
    });
    initSortable(DOM.pageBuilderList, appData.page_content);
}

function renderFooter() {
    DOM.footerSettingsContainer.innerHTML = '';

    // Copyright item
    const copyrightItem = createListItem({
        type: 'Copyright',
        title: appData.footer.copyright_text,
        actions: [
            { label: 'Редактирай', action: 'edit-footer', class: 'btn-secondary' }
        ]
    });
    copyrightItem.querySelector('.handle').style.display = 'none';
    DOM.footerSettingsContainer.appendChild(copyrightItem);

    // Social media preview card
    const footer = appData.footer;
    const networks = [
        { key: 'social_facebook', label: 'Facebook', color: '#1877f2', icon: '<path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>' },
        { key: 'social_instagram', label: 'Instagram', color: '#e1306c', icon: '<rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>' },
        { key: 'social_youtube', label: 'YouTube', color: '#ff0000', icon: '<path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.95 1.96C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.96-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"></path><polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02"></polygon>' },
        { key: 'social_tiktok', label: 'TikTok', color: '#010101', icon: '<path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"></path>' },
    ];

    const socialCard = document.createElement('div');
    socialCard.className = 'admin-social-card';
    socialCard.innerHTML = `
        <div class="admin-social-header">
            <span class="admin-social-title">📱 Социални мрежи</span>
            <button class="btn btn-secondary btn-sm" data-action="edit-footer">Редактирай</button>
        </div>
        <div class="admin-social-icons">
            ${networks.map(net => {
                const url = footer[net.key] || '';
                const active = url.trim() !== '';
                return `<div class="admin-social-icon-item ${active ? 'active' : 'inactive'}" title="${net.label}: ${active ? url : 'не е зададен'}">
                    <a href="${active ? escapeAdminHtml(url) : '#'}" ${active ? 'target="_blank" rel="noopener noreferrer"' : ''} style="display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:50%;background:${active ? net.color : 'var(--border-color)'};color:#fff;text-decoration:none;opacity:${active ? '1' : '0.35'};">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="${net.key === 'social_instagram' ? 'none' : 'currentColor'}" stroke="${net.key === 'social_instagram' ? 'currentColor' : 'none'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${net.icon}</svg>
                    </a>
                    <span class="admin-social-icon-label">${net.label}</span>
                </div>`;
            }).join('')}
        </div>
        ${(() => {
            const feed = footer.social_feed_platform || '';
            const feedLabels = { facebook: 'Facebook', instagram: 'Instagram', youtube: 'YouTube' };
            return feed ? `<p class="admin-social-feed-status">📺 Показва публикации от: <strong>${feedLabels[feed] || feed}</strong></p>` : '<p class="admin-social-feed-status">📺 Показване на публикации: <em>изключено</em></p>';
        })()}
    `;
    DOM.footerSettingsContainer.appendChild(socialCard);
}

function applyOrderRowColor(row, status) {
    row.classList.remove('order-row-new', 'order-row-processing', 'order-row-shipped');
    if (status === 'Нова') row.classList.add('order-row-new');
    else if (status === 'Обработва се') row.classList.add('order-row-processing');
    else if (status === 'Изпратена') row.classList.add('order-row-shipped');
}

function applyOrderStatusSelectColor(select, status) {
    select.classList.remove('status-new', 'status-processing', 'status-shipped');
    if (status === 'Нова') select.classList.add('status-new');
    else if (status === 'Обработва се') select.classList.add('status-processing');
    else if (status === 'Изпратена') select.classList.add('status-shipped');
}

function applyOrderStatusBadge(badge, status) {
    badge.classList.remove('order-badge-new', 'order-badge-processing', 'order-badge-shipped');
    if (status === 'Нова') { badge.textContent = '🔵 Нова'; badge.classList.add('order-badge-new'); }
    else if (status === 'Обработва се') { badge.textContent = '🟡 Обработва се'; badge.classList.add('order-badge-processing'); }
    else if (status === 'Изпратена') { badge.textContent = '✅ Изпратена'; badge.classList.add('order-badge-shipped'); }
    else { badge.textContent = status || '—'; }
}

function renderOrders() {
    DOM.ordersTableBody.innerHTML = '';
    filteredOrdersData.forEach((order) => {
        const rowTemplate = DOM.templates.orderRow.content.cloneNode(true);
        const customer = order.customer || {};
        const products = (order.products || []).map(p => `${escAdminHtml(p.name)} x${escAdminHtml(p.quantity)}`).join('<br>');
        const productsSummary = (order.products || []).map(p => `${escAdminHtml(p.name)} x${escAdminHtml(p.quantity)}`).join(', ');
        const originalIndex = ordersData.findIndex(o => o.id === order.id);
        const row = rowTemplate.querySelector('tr');
        row.dataset.index = originalIndex;
        row.dataset.orderId = order.id;

        const customerCell = rowTemplate.querySelector('.order-customer');
        customerCell.textContent = `${customer.firstName || ''} ${customer.lastName || ''}`.trim();
        customerCell.dataset.icon = '📦';
        customerCell.classList.add('mobile-key');

        rowTemplate.querySelector('.order-phone').textContent = customer.phone || '';
        rowTemplate.querySelector('.order-email').textContent = customer.email || '';

        const productsCell = rowTemplate.querySelector('.order-products');
        productsCell.innerHTML = products;
        productsCell.dataset.summary = productsSummary;
        productsCell.classList.add('mobile-key');
        
        // Format delivery information
        let deliveryInfo = '';
        if (customer.deliveryMethod === 'courier') {
            deliveryInfo = `${escAdminHtml(customer.courierCompany || 'Куриер')}<br>`;
            if (customer.courierOfficeName) {
                deliveryInfo += escAdminHtml(customer.courierOfficeName);
            }
            if (customer.courierOfficeAddress) {
                deliveryInfo += `<br><small>${escAdminHtml(customer.courierOfficeAddress)}</small>`;
            }
        } else {
            // Personal address delivery
            deliveryInfo = 'До адрес<br>';
            if (customer.address) deliveryInfo += `${escAdminHtml(customer.address)}<br>`;
            if (customer.city) deliveryInfo += escAdminHtml(customer.city);
            if (customer.postcode) deliveryInfo += `, ${escAdminHtml(customer.postcode)}`;
        }
        rowTemplate.querySelector('.order-delivery').innerHTML = deliveryInfo;
        
        // Format date
        const date = new Date(order.timestamp);
        const formattedDate = date.toLocaleString('bg-BG', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        const dateCell = rowTemplate.querySelector('.order-date');
        dateCell.textContent = order.timestamp ? formattedDate : '—';
        dateCell.classList.add('mobile-key');
        
        const status = order.status || 'Нова';
        const statusSelect = rowTemplate.querySelector('.order-status');
        statusSelect.value = status;
        applyOrderRowColor(row, status);
        applyOrderStatusSelectColor(statusSelect, status);
        const badge = rowTemplate.querySelector('.mobile-status-badge');
        if (badge) applyOrderStatusBadge(badge, status);

        DOM.ordersTableBody.appendChild(rowTemplate);
    });
}

function escAdminHtml(str) {
    return String(str == null ? '' : str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function applyContactRowColor(row, status) {
    row.classList.remove('contact-row-new', 'contact-row-viewed', 'contact-row-answered');
    if (status === 'Нов') row.classList.add('contact-row-new');
    else if (status === 'Прегледан') row.classList.add('contact-row-viewed');
    else if (status === 'Отговорен') row.classList.add('contact-row-answered');
}

function applyContactStatusSelectColor(select, status) {
    select.classList.remove('status-new', 'status-viewed', 'status-answered');
    if (status === 'Нов') select.classList.add('status-new');
    else if (status === 'Прегледан') select.classList.add('status-viewed');
    else if (status === 'Отговорен') select.classList.add('status-answered');
}

function applyContactStatusBadge(badge, status) {
    badge.classList.remove('contact-badge-new', 'contact-badge-viewed', 'contact-badge-answered');
    if (status === 'Нов') { badge.textContent = '🔴 Нов'; badge.classList.add('contact-badge-new'); }
    else if (status === 'Прегледан') { badge.textContent = '🟡 Прегледан'; badge.classList.add('contact-badge-viewed'); }
    else if (status === 'Отговорен') { badge.textContent = '✅ Отговорен'; badge.classList.add('contact-badge-answered'); }
    else { badge.textContent = status || '—'; }
}

function renderContacts() {
    DOM.contactsTableBody.innerHTML = '';
    filteredContactsData.forEach((contact) => {
        const rowTemplate = DOM.templates.contactRow.content.cloneNode(true);
        const originalIndex = contactsData.findIndex(c => c.id === contact.id);
        const row = rowTemplate.querySelector('tr');
        row.dataset.index = originalIndex;
        row.dataset.contactId = contact.id;

        rowTemplate.querySelector('.contact-source').textContent = contact.source || '—';

        const nameCell = rowTemplate.querySelector('.contact-name');
        nameCell.textContent = contact.name || '';
        nameCell.dataset.icon = '✉️';
        nameCell.classList.add('mobile-key');

        rowTemplate.querySelector('.contact-email').textContent = contact.email || '';

        const subjectCell = rowTemplate.querySelector('.contact-subject');
        subjectCell.textContent = contact.subject || '(няма тема)';
        subjectCell.classList.add('mobile-key');
        
        // Truncate long messages
        const message = contact.message || '';
        rowTemplate.querySelector('.contact-message').textContent = message.length > 100 ? message.substring(0, 100) + '...' : message;
        
        // Format date
        const date = new Date(contact.timestamp);
        const formattedDate = date.toLocaleString('bg-BG', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        const dateCell = rowTemplate.querySelector('.contact-date');
        dateCell.textContent = formattedDate;
        dateCell.classList.add('mobile-key');
        
        const status = contact.status || 'Нов';
        const statusSelect = rowTemplate.querySelector('.contact-status');
        statusSelect.value = status;
        applyContactRowColor(row, status);
        applyContactStatusSelectColor(statusSelect, status);
        const badge = rowTemplate.querySelector('.mobile-status-badge');
        if (badge) applyContactStatusBadge(badge, status);
        
        DOM.contactsTableBody.appendChild(rowTemplate);
    });
}

function renderPromoCodes() {
    DOM.promoCodesTableBody.innerHTML = '';
    filteredPromoCodesData.forEach((promo) => {
        const rowTemplate = DOM.templates.promoCodeRow.content.cloneNode(true);
        const row = rowTemplate.querySelector('tr');
        row.dataset.promoId = promo.id;
        
        rowTemplate.querySelector('.promo-code').textContent = promo.code || '';
        
        // Format discount
        const discountText = promo.discountType === 'percentage' 
            ? `${promo.discount}%` 
            : `${promo.discount} €`;
        rowTemplate.querySelector('.promo-discount').textContent = discountText;
        
        rowTemplate.querySelector('.promo-description').textContent = promo.description || '';
        
        // Format validity period
        const validFrom = promo.validFrom ? new Date(promo.validFrom).toLocaleDateString('bg-BG') : '';
        const validUntil = promo.validUntil ? new Date(promo.validUntil).toLocaleDateString('bg-BG') : 'Безсрочен';
        rowTemplate.querySelector('.promo-validity').textContent = `${validFrom} - ${validUntil}`;
        
        // Format usage
        const usageText = promo.maxUses 
            ? `${promo.usedCount}/${promo.maxUses}` 
            : `${promo.usedCount}/∞`;
        rowTemplate.querySelector('.promo-usage').textContent = usageText;
        
        // Set active toggle
        const activeToggle = rowTemplate.querySelector('.promo-active-toggle');
        activeToggle.checked = promo.active;
        
        DOM.promoCodesTableBody.appendChild(rowTemplate);
    });
}

function createListItem({ id, type, title, actions = [] }) {
    const template = DOM.templates.listItem.content.cloneNode(true);
    const itemElement = template.querySelector('.list-item');
    if (id !== undefined) itemElement.dataset.id = id;
    template.querySelector('.item-type').textContent = type;
    template.querySelector('.item-title').textContent = title || '(без заглавие)';
    const actionsContainer = template.querySelector('.item-actions');
    actions.forEach(actionInfo => {
        const button = document.createElement('button');
        button.className = `btn btn-sm ${actionInfo.class}`;
        button.textContent = actionInfo.label;
        button.dataset.action = actionInfo.action;
        actionsContainer.appendChild(button);
    });
    return itemElement;
}

function populateAddComponentMenu() {
    DOM.addComponentDropdown.innerHTML = '';
    const componentTemplates = {
        'hero_banner': { label: 'Hero Banner', templateId: 'form-hero-banner-template' },
        'info_card': { label: 'Инфо Кард', templateId: 'form-info-card-template' },
        'product_category': { label: 'Продуктова Категория', templateId: 'form-product-category-template' },
        'benefits': { label: 'Ползи', templateId: 'form-benefits-template' },
        'timeline': { label: 'Времева линия', templateId: 'form-timeline-template' },
        'ingredients': { label: 'Съставки', templateId: 'form-ingredients-template' },
        'testimonials': { label: 'Отзиви', templateId: 'form-testimonials-template' },
        'faq': { label: 'FAQ', templateId: 'form-faq-template' },
        'guarantee': { label: 'Гаранции', templateId: 'form-guarantee-template' },
        'contact': { label: 'Контакти', templateId: 'form-contact-template' },
    };
    for (const [type, info] of Object.entries(componentTemplates)) {
        const link = document.createElement('a');
        link.href = '#';
        link.textContent = `Добави ${info.label}`;
        link.dataset.action = 'add-component';
        link.dataset.componentType = type;
        link.dataset.templateId = info.templateId;
        DOM.addComponentDropdown.appendChild(link);
    }
}

// =======================================================
//          5. УПРАВЛЕНИЕ НА МОДАЛЕН ПРОЗОРЕЦ И ФОРМИ
// =======================================================

function openModal(title, formTemplateId, data, onSave) {
    DOM.modal.title.textContent = title;
    const formTemplate = document.getElementById(formTemplateId);
    if (!formTemplate) {
        console.error(`Шаблон за форма с ID '${formTemplateId}' не е намерен!`);
        showNotification(`Грешка: Шаблон за форма '${formTemplateId}' липсва.`, 'error');
        return;
    }
    DOM.modal.body.innerHTML = '';
    DOM.modal.body.appendChild(formTemplate.content.cloneNode(true));
    if (data) {
        populateForm(DOM.modal.body.querySelector('form'), data);
    }
    currentModalSaveCallback = onSave;
    initModalTabs(DOM.modal.body);
    
    // Special handlers for hero banner background type
    if (formTemplateId === 'form-hero-banner-template') {
        initHeroBackgroundControls();
    }
    
    // Special handlers for global settings theme gradients
    if (formTemplateId === 'form-global-settings-template') {
        initThemeGradientControls();
    }
    
    DOM.modal.container.classList.add('show');
    DOM.modal.backdrop.classList.add('show');
}

function initHeroBackgroundControls() {
    const bgTypeSelect = DOM.modal.body.querySelector('#hero_bg_type');
    const imageGroup = DOM.modal.body.querySelector('#hero_bg_image_group');
    const gradientGroup = DOM.modal.body.querySelector('#hero_bg_gradient_group');
    const gradientInput = DOM.modal.body.querySelector('#hero_bg_gradient');
    const gradientPreview = DOM.modal.body.querySelector('#gradient_preview');
    
    if (!bgTypeSelect) return;
    
    // Show/hide groups based on selection
    function updateBackgroundFields() {
        const type = bgTypeSelect.value;
        imageGroup.style.display = type === 'image' ? 'block' : 'none';
        gradientGroup.style.display = type === 'custom_gradient' ? 'block' : 'none';
    }
    
    // Update gradient preview
    function updateGradientPreview(gradient) {
        if (gradientPreview && gradient) {
            gradientPreview.style.background = gradient;
        }
    }
    
    // Initialize gradient builder
    initGradientBuilder(gradientInput, updateGradientPreview);
    
    // Handle gradient preset buttons
    const presetButtons = DOM.modal.body.querySelectorAll('.btn-gradient-preset');
    presetButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const gradient = btn.dataset.gradient;
            if (gradientInput) {
                gradientInput.value = gradient;
                updateGradientPreview(gradient);
                // Parse and update builder controls
                parseGradientToBuilder(gradient);
            }
        });
    });
    
    // Live preview on gradient input change
    if (gradientInput) {
        gradientInput.addEventListener('input', (e) => {
            updateGradientPreview(e.target.value);
        });
        // Initialize preview with current value
        if (gradientInput.value) {
            updateGradientPreview(gradientInput.value);
        }
    }
    
    bgTypeSelect.addEventListener('change', updateBackgroundFields);
    updateBackgroundFields();
}

// Gradient Builder Implementation
function initGradientBuilder(gradientInput, updatePreviewCallback) {
    const gradientType = DOM.modal.body.querySelector('#gradient_type');
    const gradientAngle = DOM.modal.body.querySelector('#gradient_angle');
    const gradientAngleValue = DOM.modal.body.querySelector('#gradient_angle_value');
    const gradientAngleGroup = DOM.modal.body.querySelector('#gradient_angle_group');
    const colorStopsList = DOM.modal.body.querySelector('#color_stops_list');
    const addColorStopBtn = DOM.modal.body.querySelector('#add_color_stop');
    
    if (!gradientType || !colorStopsList) return;
    
    // State management
    let colorStops = [
        { color: '#667eea', position: 0 },
        { color: '#764ba2', position: 100 }
    ];
    
    // Parse existing gradient if present
    if (gradientInput && gradientInput.value) {
        const parsed = parseGradient(gradientInput.value);
        if (parsed) {
            gradientType.value = parsed.type;
            if (parsed.angle !== null) gradientAngle.value = parsed.angle;
            if (parsed.stops.length > 0) colorStops = parsed.stops;
        }
    }
    
    function updateGradientCSS() {
        let gradient;
        const type = gradientType.value;
        
        // Sort color stops by position
        const sortedStops = [...colorStops].sort((a, b) => a.position - b.position);
        const stopsStr = sortedStops.map(s => `${s.color} ${s.position}%`).join(', ');
        
        if (type === 'linear') {
            const angle = gradientAngle.value;
            gradient = `linear-gradient(${angle}deg, ${stopsStr})`;
        } else {
            gradient = `radial-gradient(circle, ${stopsStr})`;
        }
        
        if (gradientInput) {
            gradientInput.value = gradient;
        }
        if (updatePreviewCallback) {
            updatePreviewCallback(gradient);
        }
    }
    
    function renderColorStops() {
        colorStopsList.innerHTML = '';
        colorStops.forEach((stop, index) => {
            const stopItem = document.createElement('div');
            stopItem.className = 'color-stop-item';
            stopItem.innerHTML = `
                <input type="color" value="${stop.color}" data-index="${index}" class="color-picker">
                <input type="range" min="0" max="100" value="${stop.position}" data-index="${index}" class="position-slider">
                <input type="number" min="0" max="100" value="${stop.position}" data-index="${index}" class="position-input">
                <button type="button" data-index="${index}" class="remove-stop" ${colorStops.length <= 2 ? 'disabled' : ''}>×</button>
            `;
            colorStopsList.appendChild(stopItem);
        });
        
        // Attach event listeners
        colorStopsList.querySelectorAll('.color-picker').forEach(picker => {
            picker.addEventListener('input', (e) => {
                const index = parseInt(e.target.dataset.index);
                colorStops[index].color = e.target.value;
                updateGradientCSS();
            });
        });
        
        colorStopsList.querySelectorAll('.position-slider').forEach(slider => {
            slider.addEventListener('input', (e) => {
                const index = parseInt(e.target.dataset.index);
                const value = parseInt(e.target.value);
                colorStops[index].position = value;
                // Update corresponding number input
                const numberInput = colorStopsList.querySelector(`.position-input[data-index="${index}"]`);
                if (numberInput) numberInput.value = value;
                updateGradientCSS();
            });
        });
        
        colorStopsList.querySelectorAll('.position-input').forEach(input => {
            input.addEventListener('input', (e) => {
                const index = parseInt(e.target.dataset.index);
                const value = parseInt(e.target.value);
                colorStops[index].position = Math.max(0, Math.min(100, value));
                // Update corresponding slider
                const slider = colorStopsList.querySelector(`.position-slider[data-index="${index}"]`);
                if (slider) slider.value = colorStops[index].position;
                updateGradientCSS();
            });
        });
        
        colorStopsList.querySelectorAll('.remove-stop').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                if (colorStops.length > 2) {
                    colorStops.splice(index, 1);
                    renderColorStops();
                    updateGradientCSS();
                }
            });
        });
    }
    
    // Event listeners
    gradientType.addEventListener('change', () => {
        gradientAngleGroup.style.display = gradientType.value === 'linear' ? 'block' : 'none';
        updateGradientCSS();
    });
    
    gradientAngle.addEventListener('input', (e) => {
        gradientAngleValue.textContent = e.target.value;
        updateGradientCSS();
    });
    
    addColorStopBtn.addEventListener('click', () => {
        // Add new color stop in the middle
        const newPosition = 50;
        colorStops.push({ color: '#ffffff', position: newPosition });
        renderColorStops();
        updateGradientCSS();
    });
    
    // Listen for updates from preset selections
    colorStopsList.addEventListener('updateColorStops', (e) => {
        if (e.detail && Array.isArray(e.detail)) {
            colorStops = [...e.detail];
            renderColorStops();
            updateGradientCSS();
        }
    });
    
    // Initial render
    gradientAngleGroup.style.display = gradientType.value === 'linear' ? 'block' : 'none';
    gradientAngleValue.textContent = gradientAngle.value;
    renderColorStops();
    updateGradientCSS();
}

// Parse gradient string to builder controls
function parseGradient(gradientStr) {
    // Linear gradient patterns - supports degrees, directions, and keywords
    const linearMatch = gradientStr.match(/linear-gradient\((?:(\d+)deg|to\s+(\w+)),\s*(.+)\)/);
    // Radial gradient patterns - supports circle, ellipse
    const radialMatch = gradientStr.match(/radial-gradient\((?:circle|ellipse)?,?\s*(.+)\)/);
    
    if (linearMatch) {
        // Extract angle - default to 135 if using 'to right' etc
        let angle = 135;
        if (linearMatch[1]) {
            angle = parseInt(linearMatch[1]);
        } else if (linearMatch[2]) {
            // Convert direction keywords to angles
            const directionMap = {
                'right': 90,
                'left': 270,
                'bottom': 180,
                'top': 0
            };
            angle = directionMap[linearMatch[2]] || 135;
        }
        const stopsStr = linearMatch[3];
        const stops = parseColorStops(stopsStr);
        return { type: 'linear', angle, stops };
    } else if (radialMatch) {
        const stopsStr = radialMatch[1];
        const stops = parseColorStops(stopsStr);
        return { type: 'radial', angle: null, stops };
    }
    
    return null;
}

function parseColorStops(stopsStr) {
    const stops = [];
    // Enhanced regex to support hex, rgb, rgba, hsl, hsla, and named colors
    const regex = /(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\)|[a-z]+)\s+(\d+)%/gi;
    let match;
    
    while ((match = regex.exec(stopsStr)) !== null) {
        stops.push({
            color: match[1],
            position: parseInt(match[2])
        });
    }
    
    // Return default stops if parsing fails
    return stops.length > 0 ? stops : [
        { color: '#667eea', position: 0 },
        { color: '#764ba2', position: 100 }
    ];
}

// Parse gradient string to builder controls (when preset is selected)
function parseGradientToBuilder(gradientStr) {
    // Update the gradient input and preview without re-initializing
    const parsed = parseGradient(gradientStr);
    if (!parsed) return;
    
    const gradientType = DOM.modal.body.querySelector('#gradient_type');
    const gradientAngle = DOM.modal.body.querySelector('#gradient_angle');
    const gradientAngleValue = DOM.modal.body.querySelector('#gradient_angle_value');
    const gradientAngleGroup = DOM.modal.body.querySelector('#gradient_angle_group');
    
    if (gradientType) {
        gradientType.value = parsed.type;
        if (gradientAngleGroup) {
            gradientAngleGroup.style.display = parsed.type === 'linear' ? 'block' : 'none';
        }
    }
    if (gradientAngle && parsed.angle !== null) {
        gradientAngle.value = parsed.angle;
        if (gradientAngleValue) gradientAngleValue.textContent = parsed.angle;
    }
    
    // Update the color stops in the existing builder
    const colorStopsList = DOM.modal.body.querySelector('#color_stops_list');
    if (colorStopsList && parsed.stops.length > 0) {
        // Trigger a custom event to update the builder's internal state
        const event = new CustomEvent('updateColorStops', { detail: parsed.stops });
        colorStopsList.dispatchEvent(event);
    }
}

// Initialize theme gradient controls for global settings
function initThemeGradientControls() {
    const lightGradientInput = DOM.modal.body.querySelector('#theme_light_gradient');
    const darkGradientInput = DOM.modal.body.querySelector('#theme_dark_gradient');
    const lightPreview = DOM.modal.body.querySelector('#gradient_preview_light');
    const darkPreview = DOM.modal.body.querySelector('#gradient_preview_dark');
    
    // Validate gradient string to prevent CSS injection
    function isValidGradient(gradientStr) {
        if (typeof gradientStr !== 'string' || !gradientStr.trim()) return false;
        
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
    
    // Update gradient preview
    function updateGradientPreview(input, preview) {
        if (preview && input && input.value) {
            // Validate before applying
            if (isValidGradient(input.value)) {
                preview.style.background = input.value;
            } else {
                console.warn('Invalid gradient format');
            }
        }
    }
    
    // Initialize previews with current values
    if (lightGradientInput && lightPreview) {
        updateGradientPreview(lightGradientInput, lightPreview);
        
        // Live preview on input change
        lightGradientInput.addEventListener('input', () => {
            updateGradientPreview(lightGradientInput, lightPreview);
        });
    }
    
    if (darkGradientInput && darkPreview) {
        updateGradientPreview(darkGradientInput, darkPreview);
        
        // Live preview on input change
        darkGradientInput.addEventListener('input', () => {
            updateGradientPreview(darkGradientInput, darkPreview);
        });
    }
    
    // Handle gradient preset buttons
    const presetButtons = DOM.modal.body.querySelectorAll('.btn-gradient-preset[data-target]');
    presetButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = btn.dataset.target;
            const gradient = btn.dataset.gradient;
            const targetInput = DOM.modal.body.querySelector(`#${targetId}`);
            
            if (targetInput) {
                targetInput.value = gradient;
                
                // Update the corresponding preview
                if (targetId === 'theme_light_gradient' && lightPreview) {
                    updateGradientPreview(targetInput, lightPreview);
                } else if (targetId === 'theme_dark_gradient' && darkPreview) {
                    updateGradientPreview(targetInput, darkPreview);
                }
            }
        });
    });
}

function closeModal() {
    DOM.modal.container.classList.remove('show');
    DOM.modal.backdrop.classList.remove('show');
    currentModalSaveCallback = null;
    DOM.modal.body.innerHTML = '';
}

// =======================================================
//   ДЕТАЙЛНИ МОДАЛИ ЗА ПОРЪЧКИ И КОНТАКТИ
// =======================================================

function openDetailModal(title, bodyHTML, onSave) {
    DOM.modal.title.textContent = title;
    DOM.modal.body.innerHTML = bodyHTML;
    currentModalSaveCallback = onSave;
    DOM.modal.container.classList.add('show');
    DOM.modal.backdrop.classList.add('show');
}

function showOrderDetailModal(order, originalIndex) {
    const customer = order.customer || {};
    const status = order.status || 'Нова';
    const date = order.timestamp ? new Date(order.timestamp).toLocaleString('bg-BG', {
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    }) : '—';

    const productsRows = (order.products || []).map(p =>
        `<tr><td style="padding:0.3rem 0.5rem 0.3rem 0">${escAdminHtml(p.name)}</td><td style="padding:0.3rem 0.5rem;text-align:right;font-weight:600">x${escAdminHtml(p.quantity)}</td></tr>`
    ).join('');

    let deliveryHTML = '';
    if (customer.deliveryMethod === 'courier') {
        deliveryHTML = `<strong>${escAdminHtml(customer.courierCompany || 'Куриер')}</strong>`;
        if (customer.courierOfficeName) deliveryHTML += `<br>${escAdminHtml(customer.courierOfficeName)}`;
        if (customer.courierOfficeAddress) deliveryHTML += `<br><small style="color:var(--text-secondary)">${escAdminHtml(customer.courierOfficeAddress)}</small>`;
    } else {
        deliveryHTML = 'До адрес';
        if (customer.address) deliveryHTML += `<br>${escAdminHtml(customer.address)}`;
        if (customer.city) deliveryHTML += `<br>${escAdminHtml(customer.city)}`;
        if (customer.postcode) deliveryHTML += `, ${escAdminHtml(customer.postcode)}`;
    }

    const html = `
        <div class="detail-modal-section">
            <h4>👤 Клиент</h4>
            <dl class="detail-modal-grid">
                <dt>Имена</dt><dd>${escAdminHtml((customer.firstName || '') + ' ' + (customer.lastName || ''))}</dd>
                <dt>Телефон</dt><dd>${escAdminHtml(customer.phone || '—')}</dd>
                <dt>Email</dt><dd>${escAdminHtml(customer.email || '—')}</dd>
                <dt>Дата</dt><dd>${escAdminHtml(date)}</dd>
            </dl>
        </div>
        <div class="detail-modal-section">
            <h4>📦 Продукти</h4>
            <table style="width:100%;font-size:0.9rem;border-collapse:collapse">${productsRows}</table>
        </div>
        <div class="detail-modal-section">
            <h4>🚚 Доставка</h4>
            <p style="margin:0;font-size:0.9rem">${deliveryHTML}</p>
        </div>
        <div class="detail-modal-section">
            <h4>📋 Статус</h4>
            <div class="detail-modal-status-row">
                <label for="detail-order-status">Статус:</label>
                <select id="detail-order-status" style="padding:0.5rem 0.75rem;border-radius:6px;border:1px solid var(--border-color);background:var(--bg-secondary);color:var(--text-primary);font-size:0.9rem;flex:1">
                    <option value="Нова"${status === 'Нова' ? ' selected' : ''}>Нова</option>
                    <option value="Обработва се"${status === 'Обработва се' ? ' selected' : ''}>Обработва се</option>
                    <option value="Изпратена"${status === 'Изпратена' ? ' selected' : ''}>Изпратена</option>
                </select>
            </div>
        </div>`;

    openDetailModal(`Поръчка на ${escAdminHtml((customer.firstName || '') + ' ' + (customer.lastName || ''))}`, html, async () => {
        const newStatus = DOM.modal.body.querySelector('#detail-order-status').value;
        ordersData[originalIndex].status = newStatus;
        try {
            await fetch(`${API_URL}/orders`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: ordersData[originalIndex].id, status: newStatus })
            });
            filterOrders();
            showNotification('Статусът е обновен.', 'success');
        } catch (err) {
            showNotification('Грешка при запис на статуса.', 'error');
            console.error('Update order status error:', err);
        }
        closeModal();
    });
}

function showContactDetailModal(contact, originalIndex) {
    const status = contact.status || 'Нов';
    const date = contact.timestamp ? new Date(contact.timestamp).toLocaleString('bg-BG', {
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    }) : '—';

    const html = `
        <div class="detail-modal-section">
            <h4>👤 Подател</h4>
            <dl class="detail-modal-grid">
                <dt>Имена</dt><dd>${escAdminHtml(contact.name || '—')}</dd>
                <dt>Email</dt><dd>${escAdminHtml(contact.email || '—')}</dd>
                <dt>Страница</dt><dd>${escAdminHtml(contact.source || '—')}</dd>
                <dt>Дата</dt><dd>${escAdminHtml(date)}</dd>
            </dl>
        </div>
        <div class="detail-modal-section">
            <h4>💬 Тема</h4>
            <p style="margin:0;font-size:0.95rem;font-weight:600">${escAdminHtml(contact.subject || '(няма тема)')}</p>
        </div>
        <div class="detail-modal-section">
            <h4>📝 Съобщение</h4>
            <div class="detail-modal-message">${escAdminHtml(contact.message || '—')}</div>
        </div>
        <div class="detail-modal-section">
            <h4>📋 Статус</h4>
            <div class="detail-modal-status-row">
                <label for="detail-contact-status">Статус:</label>
                <select id="detail-contact-status" style="padding:0.5rem 0.75rem;border-radius:6px;border:1px solid var(--border-color);background:var(--bg-secondary);color:var(--text-primary);font-size:0.9rem;flex:1">
                    <option value="Нов"${status === 'Нов' ? ' selected' : ''}>Нов</option>
                    <option value="Прегледан"${status === 'Прегледан' ? ' selected' : ''}>Прегледан</option>
                    <option value="Отговорен"${status === 'Отговорен' ? ' selected' : ''}>Отговорен</option>
                </select>
            </div>
        </div>`;

    openDetailModal(`Съобщение от ${escAdminHtml(contact.name || '—')}`, html, async () => {
        const newStatus = DOM.modal.body.querySelector('#detail-contact-status').value;
        contactsData[originalIndex].status = newStatus;
        updateContactsCache();
        filterContacts();
        showNotification('Статусът е обновен.', 'success');
        closeModal();
    });
}


function populateForm(form, data) {
    form.querySelectorAll('[data-field]').forEach(input => {
        const path = input.dataset.field;
        const value = getProperty(data, path);
        if (input.type === 'checkbox') {
            input.checked = !!value;
        } else if (Array.isArray(value)) {
            input.value = value.join(', ');
        } else {
            input.value = value ?? '';
        }
    });

    // Специално за продуктова категория - попълва списъка с продукти
    if (data.products) {
        const productsContainer = form.querySelector('#products-editor');
        if (productsContainer) {
            productsContainer.innerHTML = ''; // Изчистване преди попълване
            data.products.forEach(productData => {
                addNestedItem(productsContainer, 'product-editor-template', productData);
            });
            // Инициализиране на drag-and-drop за продуктите
            initSortableProducts(productsContainer, data.products);
        }
    }
    
    // Специално за hero banner - попълва stats и trust_badges
    if (data.stats) {
        const statsContainer = form.querySelector('[data-sub-container="hero-stats"]');
        if (statsContainer) {
            statsContainer.innerHTML = '';
            data.stats.forEach(stat => {
                addNestedItem(statsContainer, 'hero-stat-editor-template', stat);
            });
        }
    }
    
    if (data.trust_badges) {
        const trustBadgesContainer = form.querySelector('[data-sub-container="hero-trust-badges"]');
        if (trustBadgesContainer) {
            trustBadgesContainer.innerHTML = '';
            data.trust_badges.forEach(badge => {
                addNestedItem(trustBadgesContainer, 'hero-trust-badge-editor-template', badge);
            });
        }
    }
}

function serializeForm(form) {
    const data = {};
    // Debug: console.log('[serializeForm] Starting form serialization');
    form.querySelectorAll('[data-field]').forEach(input => {
        // Пропускаме полета от шаблони за вложени елементи и от вложени елементи
        if (input.closest('.nested-item-template, .nested-sub-item-template, .nested-item, .nested-sub-item')) return;

        const path = input.dataset.field;
        let value;
        if (input.type === 'checkbox') {
            value = input.checked;
        } else if (input.type === 'number') {
            value = input.value ? parseFloat(input.value) : null;
        } else if (path.includes('goals') || path.includes('synergy_products')) {
            value = input.value.split(',').map(s => s.trim()).filter(Boolean);
        } else {
            value = input.value;
        }
        // Debug: if (path === 'title') console.log('[serializeForm] Found title field with value:', value);
        setProperty(data, path, value);
    });
    // Debug: console.log('[serializeForm] Serialized data:', data);

    // Специално за продуктова категория - събира данните от всички продукти
    const productsContainer = form.querySelector('#products-editor');
    if (productsContainer) {
        data.products = [];
        productsContainer.querySelectorAll(':scope > .nested-item[data-type="product"]').forEach((productNode, index) => {
            const productData = {};
            // Сериализираме основните полета на продукта (пропускаме полетата от вложените елементи)
            productNode.querySelectorAll('[data-field]').forEach(input => {
                if (input.closest('.nested-sub-item')) return; // skip variant/effect/ingredient/faq fields
                const path = input.dataset.field;
                let value;
                 if (input.type === 'checkbox') {
                    value = input.checked;
                } else if (input.type === 'number') {
                    value = input.value ? parseFloat(input.value) : null;
                } else if (path.includes('goals') || path.includes('synergy_products')) {
                    value = input.value.split(',').map(s => s.trim()).filter(Boolean);
                } else {
                    value = input.value;
                }
                setProperty(productData, path, value);
            });
            
            // Задаваме display_order според текущата позиция
            productData.display_order = index;

            // Сериализираме вложените списъци
            ['effects', 'about-benefits', 'ingredients', 'faq', 'variants'].forEach(subListName => {
                const subContainer = productNode.querySelector(`[data-sub-container="${subListName}"]`);
                if (subContainer) {
                    const subList = [];
                    let dataType;
                    
                    // Определяме data-type атрибута в зависимост от типа
                    if (subListName === 'effects') {
                        dataType = 'effect';
                    } else if (subListName === 'about-benefits') {
                        dataType = 'about-benefit';
                    } else if (subListName === 'ingredients') {
                        dataType = 'ingredient';
                    } else if (subListName === 'faq') {
                        dataType = 'faq';
                    } else if (subListName === 'variants') {
                        dataType = 'variant';
                    }
                    
                    subContainer.querySelectorAll(`:scope > .nested-sub-item[data-type="${dataType}"]`).forEach(subItemNode => {
                        const subItemData = {};
                        subItemNode.querySelectorAll('[data-field]').forEach(input => {
                            if (input.type === 'checkbox') {
                                subItemData[input.dataset.field] = input.checked;
                            } else {
                                subItemData[input.dataset.field] = (input.type === 'number' ? (input.value ? parseFloat(input.value) : null) : input.value);
                            }
                        });
                        subList.push(subItemData);
                    });
                    
                    // Запазваме данните на правилното място
                    if (subListName === 'effects') {
                        setProperty(productData, `public_data.effects`, subList);
                    } else if (subListName === 'about-benefits') {
                        setProperty(productData, `public_data.about_content.benefits`, subList);
                    } else if (subListName === 'ingredients') {
                        setProperty(productData, `public_data.ingredients`, subList);
                    } else if (subListName === 'faq') {
                        setProperty(productData, `public_data.faq`, subList);
                    } else if (subListName === 'variants') {
                        setProperty(productData, `public_data.variants`, subList);
                    }
                }
            });
            data.products.push(productData);
        });
    }
    
    // Специално за hero banner - събира stats и trust_badges
    const heroStatsContainer = form.querySelector('[data-sub-container="hero-stats"]');
    if (heroStatsContainer) {
        data.stats = [];
        heroStatsContainer.querySelectorAll(':scope > .nested-sub-item[data-type="hero-stat"]').forEach(statNode => {
            const statData = {};
            statNode.querySelectorAll('[data-field]').forEach(input => {
                statData[input.dataset.field] = input.value;
            });
            data.stats.push(statData);
        });
    }
    
    const heroTrustBadgesContainer = form.querySelector('[data-sub-container="hero-trust-badges"]');
    if (heroTrustBadgesContainer) {
        data.trust_badges = [];
        heroTrustBadgesContainer.querySelectorAll(':scope > .nested-sub-item[data-type="hero-trust-badge"]').forEach(badgeNode => {
            const badgeData = {};
            badgeNode.querySelectorAll('[data-field]').forEach(input => {
                badgeData[input.dataset.field] = input.value;
            });
            data.trust_badges.push(badgeData);
        });
    }
    
    return data;
}

function addNestedItem(container, templateId, data) {
    const template = document.getElementById(templateId);
    if (!template) { console.error(`Template ${templateId} not found`); return; }
    
    const newItemFragment = template.content.cloneNode(true);
    const itemElement = newItemFragment.querySelector('.nested-item, .nested-sub-item');
    
    if (data) {
        // Попълваме основните полета
        itemElement.querySelectorAll('[data-field]').forEach(input => {
            const path = input.dataset.field;
            const value = getProperty(data, path);
            if (value !== undefined && value !== null) {
                if (input.type === 'checkbox') {
                    input.checked = !!value;
                } else if (Array.isArray(value)) {
                    input.value = value.join(', ');
                } else {
                    input.value = value;
                }
            }
        });
        // Попълваме вложените списъци
        ['effects', 'about-benefits', 'ingredients', 'faq', 'variants'].forEach(subListName => {
            const subContainer = itemElement.querySelector(`[data-sub-container="${subListName}"]`);
            let subData = null;
            
            // Определяме откъде да вземем данните в зависимост от типа
            if (subListName === 'effects') {
                subData = getProperty(data, `public_data.effects`);
            } else if (subListName === 'about-benefits') {
                subData = getProperty(data, `public_data.about_content.benefits`);
            } else if (subListName === 'ingredients') {
                subData = getProperty(data, `public_data.ingredients`);
            } else if (subListName === 'faq') {
                subData = getProperty(data, `public_data.faq`);
            } else if (subListName === 'variants') {
                subData = getProperty(data, `public_data.variants`);
            }
            
            if (subContainer && Array.isArray(subData)) {
                subData.forEach(subItemData => {
                    // Определяме template ID в зависимост от типа
                    let subTemplateId;
                    if (subListName === 'effects') {
                        subTemplateId = 'effect-editor-template';
                    } else if (subListName === 'about-benefits') {
                        subTemplateId = 'about-benefit-editor-template';
                    } else if (subListName === 'ingredients') {
                        subTemplateId = 'ingredient-editor-template';
                    } else if (subListName === 'faq') {
                        subTemplateId = 'faq-editor-template';
                    } else if (subListName === 'variants') {
                        subTemplateId = 'variant-editor-template';
                    }
                    
                    if (subTemplateId) {
                        addNestedItem(subContainer, subTemplateId, subItemData);
                    }
                });
            }
        });
    } else if (templateId === 'product-editor-template') {
        // Генериране на ID за чисто нов продукт
        const newId = `prod-${Date.now()}`;
        setProperty(data = {}, 'product_id', newId);
        itemElement.querySelector('[data-field="product_id"]').value = newId;
    }

    container.appendChild(newItemFragment);
    initNestedItemUI(itemElement, data); // Инициализираме табове и заглавие
}


// =======================================================
//          6. ГЛАВЕН КОНТРОЛЕР И EVENT LISTENERS
// =======================================================

function setupEventListeners() {
    document.body.addEventListener('click', e => {
        const target = e.target.closest('[data-action]');
        if (!target) return;
        
        e.preventDefault();
        
        const action = target.dataset.action;
        const listItem = target.closest('.list-item');
        const id = listItem?.dataset.id;
        
        handleAction(action, target, id);
    });

    DOM.modal.saveBtn.addEventListener('click', async () => {
        if (currentModalSaveCallback) {
            const form = DOM.modal.body.querySelector('form');
            if (form) {
                const result = currentModalSaveCallback(form);
                const success = (result instanceof Promise) ? await result : result;
                if (success) {
                    setUnsavedChanges(true);
                    renderAll();
                    await saveData();
                }
            } else {
                // Detail modals (orders/contacts) — no form, just invoke callback
                const result = currentModalSaveCallback();
                if (result instanceof Promise) await result;
            }
        }
    });

    [DOM.modal.cancelBtn, DOM.modal.closeBtn, DOM.modal.backdrop].forEach(el => el.addEventListener('click', closeModal));
    
    DOM.tabNav.addEventListener('click', e => {
        const target = e.target.closest('.tab-btn');
        if (!target || target.classList.contains('active')) return;
        
        DOM.tabNav.querySelector('.active').classList.remove('active');
        target.classList.add('active');
        
        DOM.tabPanes.forEach(pane => pane.classList.remove('active'));
        document.getElementById(target.dataset.tab).classList.add('active');
        
        try { localStorage.setItem('adminActiveTab', target.dataset.tab); } catch (e) {}
    });

    DOM.saveBtn.addEventListener('click', saveData);

    DOM.ordersTableBody.addEventListener('change', async e => {
        if (!e.target.classList.contains('order-status')) return;
        const row = e.target.closest('tr');
        const index = Number(row.dataset.index);
        const newStatus = e.target.value;
        ordersData[index].status = newStatus;
        applyOrderRowColor(row, e.target.value);
        applyOrderStatusSelectColor(e.target, newStatus);
        const badge = row.querySelector('.mobile-status-badge');
        if (badge) applyOrderStatusBadge(badge, newStatus);
        try {
            await fetch(`${API_URL}/orders`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: ordersData[index].id, status: newStatus })
            });
            showNotification('Статусът е обновен.', 'success');
        } catch (err) {
            showNotification('Грешка при запис на статуса.', 'error');
            console.error('Update status error:', err);
        }
    });

    // Click on order row → detail modal (only when on mobile, i.e. clicking the card itself not the select)
    DOM.ordersTableBody.addEventListener('click', e => {
        if (e.target.tagName === 'SELECT') return;
        const row = e.target.closest('tr');
        if (!row) return;
        const index = Number(row.dataset.index);
        if (isNaN(index) || index < 0) return;
        showOrderDetailModal(ordersData[index], index);
    });
    
    DOM.orderSearchInput.addEventListener('input', () => filterOrders());
    DOM.refreshOrdersBtn.addEventListener('click', async () => {
        showNotification('Опресняване на поръчките...', 'info');
        await fetchOrders();
        filterOrders();
    });
    
    // Orders sort headers click handler (desktop)
    document.querySelectorAll('.orders-sort-th').forEach(th => {
        th.addEventListener('click', () => {
            const field = th.dataset.sort;
            if (orderSortField === field) {
                orderSortDir = orderSortDir === 'asc' ? 'desc' : 'asc';
            } else {
                orderSortField = field;
                orderSortDir = field === 'timestamp' ? 'desc' : 'asc';
            }
            filterOrders();
        });
    });

    // Mobile sort controls for orders
    const ordersMobileSortField = document.getElementById('orders-mobile-sort-field');
    const ordersMobileSortDir = document.getElementById('orders-mobile-sort-dir');
    if (ordersMobileSortField) {
        ordersMobileSortField.value = orderSortField;
        ordersMobileSortField.addEventListener('change', () => {
            orderSortField = ordersMobileSortField.value;
            filterOrders();
        });
    }
    if (ordersMobileSortDir) {
        ordersMobileSortDir.addEventListener('click', () => {
            orderSortDir = orderSortDir === 'asc' ? 'desc' : 'asc';
            ordersMobileSortDir.textContent = orderSortDir === 'asc' ? '↑' : '↓';
            filterOrders();
        });
    }
    
    DOM.contactsTableBody.addEventListener('change', async e => {
        if (!e.target.classList.contains('contact-status')) return;
        const row = e.target.closest('tr');
        const index = Number(row.dataset.index);
        const newStatus = e.target.value;
        contactsData[index].status = newStatus;
        applyContactRowColor(row, newStatus);
        applyContactStatusSelectColor(e.target, newStatus);
        const badge = row.querySelector('.mobile-status-badge');
        if (badge) applyContactStatusBadge(badge, newStatus);
        // Persist the updated status to localStorage cache
        updateContactsCache();
        showNotification('Статусът е обновен.', 'success');
    });

    // Click on contact row → detail modal
    DOM.contactsTableBody.addEventListener('click', e => {
        if (e.target.tagName === 'SELECT') return;
        const row = e.target.closest('tr');
        if (!row) return;
        const index = Number(row.dataset.index);
        if (isNaN(index) || index < 0) return;
        showContactDetailModal(contactsData[index], index);
    });
    
    DOM.contactSearchInput.addEventListener('input', () => filterContacts());
    DOM.refreshContactsBtn.addEventListener('click', async () => {
        showNotification('Опресняване на контактите...', 'info');
        await fetchContacts(true); // force fetch – bypass the 24-hour cache
        filterContacts();
    });

    document.querySelectorAll('.contacts-sort-th').forEach(th => {
        th.addEventListener('click', () => {
            const field = th.dataset.sort;
            if (contactSortField === field) {
                contactSortDir = contactSortDir === 'asc' ? 'desc' : 'asc';
            } else {
                contactSortField = field;
                contactSortDir = field === 'timestamp' ? 'desc' : 'asc';
            }
            filterContacts();
        });
    });

    // Mobile sort controls for contacts
    const contactsMobileSortField = document.getElementById('contacts-mobile-sort-field');
    const contactsMobileSortDir = document.getElementById('contacts-mobile-sort-dir');
    if (contactsMobileSortField) {
        contactsMobileSortField.value = contactSortField;
        contactsMobileSortField.addEventListener('change', () => {
            contactSortField = contactsMobileSortField.value;
            filterContacts();
        });
    }
    if (contactsMobileSortDir) {
        contactsMobileSortDir.addEventListener('click', () => {
            contactSortDir = contactSortDir === 'asc' ? 'desc' : 'asc';
            contactsMobileSortDir.textContent = contactSortDir === 'asc' ? '↑' : '↓';
            filterContacts();
        });
    }


    document.querySelectorAll('.contact-source-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.contact-source-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeContactSourceFilter = btn.dataset.source;
            filterContacts();
        });
    });
    
    // Promo Codes event listeners
    DOM.refreshPromoBtn.addEventListener('click', async () => {
        showNotification('Опресняване на промо кодовете...', 'info');
        await fetchPromoCodes();
        filterPromoCodes();
    });
    
    DOM.addPromoBtn.addEventListener('click', () => {
        openPromoCodeModal('add');
    });
    
    DOM.promoSearchInput.addEventListener('input', filterPromoCodes);
    
    // Promo codes table actions
    DOM.promoCodesTableBody.addEventListener('click', async (e) => {
        const row = e.target.closest('tr');
        if (!row) return;
        
        const promoId = row.dataset.promoId;
        const promo = promoCodesData.find(p => p.id === promoId);
        
        if (e.target.classList.contains('promo-edit-btn')) {
            openPromoCodeModal('edit', promo);
        } else if (e.target.classList.contains('promo-delete-btn')) {
            if (confirm(`Сигурни ли сте, че искате да изтриете промо кода "${promo.code}"?`)) {
                await deletePromoCode(promoId);
            }
        }
    });
    
    // Promo codes active toggle
    DOM.promoCodesTableBody.addEventListener('change', async (e) => {
        if (e.target.classList.contains('promo-active-toggle')) {
            const row = e.target.closest('tr');
            const promoId = row.dataset.promoId;
            const isActive = e.target.checked;
            await updatePromoCodeStatus(promoId, isActive);
        }
    });
    
    // AI Settings event listeners
    const saveAISettingsBtn = document.getElementById('save-ai-settings-btn');
    const testAISettingsBtn = document.getElementById('test-ai-settings-btn');
    const resetAISettingsBtn = document.getElementById('reset-ai-settings-btn');
    const aiProviderSelect = document.getElementById('ai-provider');
    
    if (saveAISettingsBtn) {
        saveAISettingsBtn.addEventListener('click', saveAISettings);
    }
    if (testAISettingsBtn) {
        testAISettingsBtn.addEventListener('click', testAISettings);
    }
    if (resetAISettingsBtn) {
        resetAISettingsBtn.addEventListener('click', resetAISettings);
    }
    if (aiProviderSelect) {
        aiProviderSelect.addEventListener('change', updateModelPlaceholder);
    }

    DOM.undoBtn.addEventListener('click', () => {
        if (activeUndoAction) {
            activeUndoAction();
            activeUndoAction = null;
            DOM.undoNotification.classList.remove('show');
        }
    });

    // Project selector
    const projectSelector = document.getElementById('project-selector');
    if (projectSelector) {
        projectSelector.value = currentProject;
        projectSelector.addEventListener('change', async (e) => {
            if (unsavedChanges) {
                if (!confirm('Имате незаписани промени. Сигурни ли сте, че искате да превключите проекта?')) {
                    projectSelector.value = currentProject;
                    return;
                }
            }
            currentProject = e.target.value;
            localStorage.setItem('adminProject', currentProject);
            updateAdminHeaderTitle();
            appData = await fetchData();
            if (appData) {
                setUnsavedChanges(false);
                renderAll();
                showNotification(`Превключено към проект: ${currentProject === 'life' ? 'LIFE BioHack' : 'ДА ОТСЛАБНА'}`, 'success');
            }
        });
        updateAdminHeaderTitle();
    }
}

function updateAdminHeaderTitle() {
    document.querySelector('.admin-header h1').textContent = 
        currentProject === 'life' ? 'Админ Панел — LIFE BioHack' : 'Админ Панел — ДА ОТСЛАБНА';
}

function handleAction(action, target, id) {
    const componentType = target.dataset.componentType;
    const templateId = target.dataset.templateId;
    
    switch(action) {
        // Глобални
        case 'edit-global-settings':
            openModal('Редакция на глобални настройки', 'form-global-settings-template', appData.settings,
                (form) => {
                    appData.settings = serializeForm(form);
                    return true;
                });
            break;

        // Навигация
        case 'add-nav-item':
             openModal('Добавяне на нов линк', 'form-nav-item-template', { text: '', link: '#' },
                (form) => {
                    appData.navigation.push(serializeForm(form));
                    return true;
                });
            break;
        case 'edit-nav-item':
            openModal('Редакция на линк', 'form-nav-item-template', appData.navigation[id],
                (form) => {
                    Object.assign(appData.navigation[id], serializeForm(form));
                    return true;
                });
            break;
        case 'delete-nav-item':
            deleteItemWithUndo('nav-item', id, () => renderNavigation());
            break;

        // Съдържание (компоненти)
        case 'toggle-add-component-menu':
            DOM.addComponentDropdown.classList.toggle('show');
            break;
        case 'add-component':
            openModal(`Добавяне на: ${componentType.replace(/_/g, ' ')}`, templateId, null,
                (form) => {
                    const newComponent = serializeForm(form);
                    newComponent.type = componentType;
                    newComponent.component_id = `comp_${Date.now()}`;
                    if(!newComponent.title) newComponent.title = `Нова ${componentType.replace(/_/g, ' ')}`;
                    appData.page_content.push(newComponent);
                    DOM.addComponentDropdown.classList.remove('show');
                    return true;
                });
            break;
        case 'edit-component': {
            const component = id ? appData.page_content.find(c => c.component_id === id) : null;
            if (!component) return;
            const correctedType = component.type.replace(/_/g, '-');
            const editTemplateId = `form-${correctedType}-template`;
            openModal(`Редакция на: ${component.title}`, editTemplateId, component,
                (form) => {
                    const updatedData = serializeForm(form);
                    // Debug: console.log('Updating component:', component.component_id, 'with data:', updatedData);
                    // Debug: if (updatedData.title !== undefined && updatedData.title !== '') {
                    //     console.log('Title being updated from:', component.title, 'to:', updatedData.title);
                    // }
                    Object.assign(component, updatedData);
                    // Debug: console.log('Component after update:', component);
                    return true;
                });
            break;
        }
        case 'delete-component':
             deleteItemWithUndo('component', id, () => renderPageContent());
            break;

        // Футър
        case 'edit-footer':
            openModal('Редакция на футър', 'form-footer-template', appData.footer,
                (form) => {
                    const updatedData = serializeForm(form);
                    Object.assign(appData.footer, updatedData);
                    return true;
                });
            break;
            
        // Вложени елементи в модал
        case 'add-nested-item': {
            const container = target.closest('.modal-body, .nested-item').querySelector(target.dataset.container);
            if (container) {
                addNestedItem(container, target.dataset.template, null);
            }
            break;
        }
        case 'delete-nested-item': {
            const itemToDelete = target.closest('.nested-item, .nested-sub-item');
            if (itemToDelete) {
                itemToDelete.remove();
            }
            break;
        }
        case 'import-product': {
            const fileInput = target.parentElement.querySelector('#product-import-input');
            fileInput.onchange = (e) => handleProductImport(e, target);
            fileInput.click();
            break;
        }
        case 'import-products-csv': {
            const csvFileInput = target.parentElement.querySelector('#product-csv-import-input');
            csvFileInput.onchange = (e) => handleProductCSVImport(e, target);
            csvFileInput.click();
            break;
        }
        case 'import-products-xlsx': {
            const xlsxFileInput = target.parentElement.querySelector('#product-xlsx-import-input');
            xlsxFileInput.onchange = (e) => handleProductXLSXImport(e, target);
            xlsxFileInput.click();
            break;
        }
        case 'export-products-csv': {
            const productsContainer = target.closest('.modal-tab-pane').querySelector('#products-editor');
            exportProductsToCSV(productsContainer);
            break;
        }
        case 'download-csv-template': {
            downloadCSVTemplate();
            break;
        }
        case 'upload-product-image': {
            const fileInput = document.getElementById('image-upload-input');
            const targetFieldPath = target.dataset.targetField;
            const inputElement = target.closest('.form-group').querySelector(`[data-field="${targetFieldPath}"]`);
            
            fileInput.onchange = async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                
                // Validate file type
                if (!file.type.startsWith('image/')) {
                    showNotification('Моля изберете изображение', 'error');
                    return;
                }
                
                // Validate file size (max 2MB)
                if (file.size > 2 * 1024 * 1024) {
                    showNotification('Изображението е твърде голямо. Максимален размер: 2MB', 'error');
                    return;
                }
                
                try {
                    // Show loading state
                    target.disabled = true;
                    target.textContent = '⏳ Качване...';
                    
                    // Upload the file
                    const imageUrl = await uploadImageToGitHub(file);
                    
                    // Update the input field with the URL
                    if (inputElement) {
                        inputElement.value = imageUrl;
                    }
                    
                    showNotification('Изображението е качено успешно!', 'success');
                } catch (error) {
                    console.error('Upload error:', error);
                    showNotification(`Грешка при качване: ${error.message}`, 'error');
                } finally {
                    // Reset button state
                    target.disabled = false;
                    target.textContent = '📤 Upload';
                    // Clear file input
                    fileInput.value = '';
                }
            };
            
            fileInput.click();
            break;
        }
        case 'upload-additional-images': {
            const fileInput = document.getElementById('image-upload-input-multiple');
            const targetFieldPath = target.dataset.targetField;
            const textareaElement = target.closest('.form-group').querySelector(`[data-field="${targetFieldPath}"]`);
            
            fileInput.onchange = async (e) => {
                const files = Array.from(e.target.files);
                if (files.length === 0) return;
                
                // Collect all validation errors
                const validationErrors = [];
                for (const file of files) {
                    if (!file.type.startsWith('image/')) {
                        validationErrors.push(`"${file.name}" не е изображение`);
                    } else if (file.size > 2 * 1024 * 1024) {
                        validationErrors.push(`"${file.name}" е твърде голям (макс. 2MB)`);
                    }
                }
                
                // Show all validation errors if any
                if (validationErrors.length > 0) {
                    showNotification('Грешки при валидация:\n' + validationErrors.join('\n'), 'error');
                    return;
                }
                
                try {
                    // Bulgarian pluralization helper
                    const getImageWord = (count) => {
                        if (count === 1) return 'изображение';
                        return 'изображения';
                    };
                    
                    // Show loading state
                    target.disabled = true;
                    target.textContent = `⏳ Качване на ${files.length} ${getImageWord(files.length)}...`;
                    
                    // Upload all files
                    const uploadPromises = files.map(file => uploadImageToGitHub(file));
                    const imageUrls = await Promise.all(uploadPromises);
                    
                    // Get existing URLs from textarea
                    const existingUrls = textareaElement.value
                        .split('\n')
                        .map(url => url.trim())
                        .filter(url => url);
                    
                    // Append new URLs
                    const allUrls = [...existingUrls, ...imageUrls];
                    textareaElement.value = allUrls.join('\n');
                    
                    showNotification(`${files.length} ${getImageWord(files.length)} ${files.length === 1 ? 'качено' : 'качени'} успешно!`, 'success');
                } catch (error) {
                    console.error('Upload error:', error);
                    showNotification(`Грешка при качване: ${error.message}`, 'error');
                } finally {
                    // Reset button state
                    target.disabled = false;
                    target.textContent = '📤 Upload';
                    // Clear file input
                    fileInput.value = '';
                }
            };
            
            fileInput.click();
            break;
        }
        case 'upload-simple-image': {
            const fileInput = document.getElementById('image-upload-input');
            if (!fileInput) {
                showNotification('Грешка: Елементът за качване не е намерен', 'error');
                console.error('File input #image-upload-input not found');
                break;
            }
            
            const targetFieldPath = target.dataset.targetField;
            // Try to find the input in the same form-group first, then the closest
            // nested-sub-item (for dynamic templates), then the modal form
            const formGroup = target.closest('.form-group');
            const nestedSubItem = target.closest('.nested-sub-item');
            const modalForm = target.closest('.modal-form');
            const inputElement = (formGroup && formGroup.querySelector(`[data-field="${targetFieldPath}"]`)) ||
                                (nestedSubItem && nestedSubItem.querySelector(`[data-field="${targetFieldPath}"]`)) ||
                                (modalForm && modalForm.querySelector(`[data-field="${targetFieldPath}"]`));
            
            if (!inputElement) {
                showNotification('Грешка: Полето за изображение не е намерено', 'error');
                console.error(`Input field with data-field="${targetFieldPath}" not found`);
                break;
            }
            
            fileInput.onchange = async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                
                // Validate file type
                if (!file.type.startsWith('image/')) {
                    showNotification('Моля изберете изображение', 'error');
                    return;
                }
                
                // Validate file size (max 2MB)
                if (file.size > 2 * 1024 * 1024) {
                    showNotification('Изображението е твърде голямо. Максимален размер: 2MB', 'error');
                    return;
                }
                
                try {
                    // Show loading state
                    target.disabled = true;
                    target.textContent = '⏳ Качване...';
                    
                    // Upload the file
                    const imageUrl = await uploadImageToGitHub(file);
                    
                    // Update the input field with the URL
                    inputElement.value = imageUrl;
                    
                    showNotification('Изображението е качено успешно!', 'success');
                } catch (error) {
                    console.error('Upload error:', error);
                    showNotification(`Грешка при качване: ${error.message}`, 'error');
                } finally {
                    // Reset button state
                    target.disabled = false;
                    target.textContent = '📤 Upload';
                    // Clear file input
                    fileInput.value = '';
                }
            };
            
            fileInput.click();
            break;
        }
        case 'ai-assistant': {
            const productEditor = target.closest('.nested-item[data-type="product"]');
            if (!productEditor) return;
            
            handleAIAssistant(productEditor);
            break;
        }
        case 'move-product': {
            const productEditor = target.closest('.nested-item[data-type="product"]');
            if (!productEditor) return;
            
            handleMoveProduct(productEditor);
            break;
        }
    }
}

// =======================================================
//          7. ПОМОЩНИ ФУНКЦИИ (UTILITIES)
// =======================================================

function initSortable(element, dataArray) {
    if(!element) return;
    // Check if Sortable is available (library might be blocked or not loaded)
    if (typeof Sortable === 'undefined') {
        console.warn('Sortable.js library not available - drag and drop will not work');
        return;
    }
    new Sortable(element, {
        handle: '.handle',
        animation: 150,
        ghostClass: 'sortable-ghost',
        onEnd: (evt) => {
            const { oldIndex, newIndex } = evt;
            if (oldIndex === newIndex) return;
            const [movedItem] = dataArray.splice(oldIndex, 1);
            dataArray.splice(newIndex, 0, movedItem);
            setUnsavedChanges(true);
            if(element.id === 'navigation-list') renderNavigation();
        }
    });
}

function initSortableProducts(element, productsArray) {
    if(!element) return;
    // Check if Sortable is available (library might be blocked or not loaded)
    if (typeof Sortable === 'undefined') {
        console.warn('Sortable.js library not available - drag and drop will not work');
        return;
    }
    new Sortable(element, {
        handle: '.handle',
        animation: 150,
        ghostClass: 'sortable-ghost',
        draggable: '.nested-item[data-type="product"]',
        onEnd: (evt) => {
            const { oldIndex, newIndex } = evt;
            if (oldIndex === newIndex) return;
            const [movedItem] = productsArray.splice(oldIndex, 1);
            productsArray.splice(newIndex, 0, movedItem);
            
            // Update display_order for all products
            productsArray.forEach((product, index) => {
                product.display_order = index;
            });
            
            setUnsavedChanges(true);
        }
    });
}

function showNotification(message, type = 'info', duration = 4000) {
    const note = document.createElement('div');
    note.className = `notification ${type}`;
    note.textContent = message;
    DOM.notificationContainer.appendChild(note);
    setTimeout(() => {
        note.classList.add('fade-out');
        note.addEventListener('transitionend', () => note.remove());
    }, duration);
}

function deleteItemWithUndo(itemType, id, renderFunc) {
    let item, index, array;
    if (itemType === 'nav-item') {
        array = appData.navigation;
        index = parseInt(id, 10);
        item = array[index];
    } else if (itemType === 'component') {
        array = appData.page_content;
        index = array.findIndex(c => c.component_id === id);
        item = array[index];
    }
    if (item === undefined) return;
    array.splice(index, 1);
    setUnsavedChanges(true);
    renderFunc();
    DOM.undoNotification.classList.add('show');
    activeUndoAction = () => {
        array.splice(index, 0, item);
        setUnsavedChanges(true);
        renderFunc();
        showNotification('Елементът е възстановен.', 'success');
        activeUndoAction = null;
    };
    setTimeout(() => {
        if(DOM.undoNotification.classList.contains('show')) {
            DOM.undoNotification.classList.remove('show');
            activeUndoAction = null;
        }
    }, 5000);
}

function sortOrders(data) {
    const field = orderSortField;
    const dir = orderSortDir === 'asc' ? 1 : -1;
    return [...data].sort((a, b) => {
        let aVal, bVal;
        if (field === 'timestamp') {
            aVal = new Date(a.timestamp || 0).getTime();
            bVal = new Date(b.timestamp || 0).getTime();
            return dir * (aVal - bVal);
        } else if (field === 'customer') {
            const customerA = a.customer || {};
            const customerB = b.customer || {};
            aVal = `${customerA.firstName || ''} ${customerA.lastName || ''}`.trim();
            bVal = `${customerB.firstName || ''} ${customerB.lastName || ''}`.trim();
        } else if (field === 'status') {
            aVal = a.status || 'Нова';
            bVal = b.status || 'Нова';
        } else {
            aVal = a[field] || '';
            bVal = b[field] || '';
        }
        return dir * aVal.toString().localeCompare(bVal.toString(), 'bg');
    });
}

function updateOrderSortHeaders() {
    document.querySelectorAll('.orders-sort-th').forEach(th => {
        th.classList.remove('sort-asc', 'sort-desc');
        const icon = th.querySelector('.sort-icon');
        if (icon) icon.textContent = '⇅';
        if (th.dataset.sort === orderSortField) {
            th.classList.add(orderSortDir === 'asc' ? 'sort-asc' : 'sort-desc');
            if (icon) icon.textContent = orderSortDir === 'asc' ? '↑' : '↓';
        }
    });
}

function filterOrders() {
    const searchTerm = DOM.orderSearchInput.value.toLowerCase().trim();
    let base;
    if (!searchTerm) {
        base = [...ordersData];
    } else {
        base = ordersData.filter(order => {
            const customer = order.customer || {};
            const fullName = `${customer.firstName || ''} ${customer.lastName || ''}`.toLowerCase();
            const phone = (customer.phone || '').toLowerCase();
            const email = (customer.email || '').toLowerCase();
            return fullName.includes(searchTerm) || phone.includes(searchTerm) || email.includes(searchTerm);
        });
    }
    filteredOrdersData = sortOrders(base);
    updateOrderSortHeaders();
    renderOrders();
}

function sortContacts(data) {
    const field = contactSortField;
    const dir = contactSortDir === 'asc' ? 1 : -1;
    return [...data].sort((a, b) => {
        let aVal = a[field] || '';
        let bVal = b[field] || '';
        if (field === 'timestamp') {
            aVal = new Date(aVal).getTime() || 0;
            bVal = new Date(bVal).getTime() || 0;
            return dir * (aVal - bVal);
        }
        return dir * aVal.toString().localeCompare(bVal.toString(), 'bg');
    });
}

function updateContactSortHeaders() {
    document.querySelectorAll('.contacts-sort-th').forEach(th => {
        th.classList.remove('sort-asc', 'sort-desc');
        const icon = th.querySelector('.sort-icon');
        if (icon) icon.textContent = '⇅';
        if (th.dataset.sort === contactSortField) {
            th.classList.add(contactSortDir === 'asc' ? 'sort-asc' : 'sort-desc');
            if (icon) icon.textContent = contactSortDir === 'asc' ? '↑' : '↓';
        }
    });
}

function filterContacts() {
    const searchTerm = DOM.contactSearchInput.value.toLowerCase().trim();
    let base = activeContactSourceFilter
        ? contactsData.filter(c => (c.source || '') === activeContactSourceFilter)
        : [...contactsData];
    if (searchTerm) {
        base = base.filter(contact => {
            const name = (contact.name || '').toLowerCase();
            const email = (contact.email || '').toLowerCase();
            const subject = (contact.subject || '').toLowerCase();
            const message = (contact.message || '').toLowerCase();
            return name.includes(searchTerm) || email.includes(searchTerm) || 
                   subject.includes(searchTerm) || message.includes(searchTerm);
        });
    }
    filteredContactsData = sortContacts(base);
    updateContactSortHeaders();
    renderContacts();
}

function filterPromoCodes() {
    const searchTerm = DOM.promoSearchInput.value.toLowerCase().trim();
    if (!searchTerm) {
        filteredPromoCodesData = [...promoCodesData];
    } else {
        filteredPromoCodesData = promoCodesData.filter(promo => {
            const code = (promo.code || '').toLowerCase();
            const description = (promo.description || '').toLowerCase();
            return code.includes(searchTerm) || description.includes(searchTerm);
        });
    }
    renderPromoCodes();
}

function initModalTabs(container) {
    const tabNav = container.querySelector('.modal-tab-nav');
    if (!tabNav) return;
    tabNav.addEventListener('click', e => {
        const target = e.target.closest('.modal-tab-btn');
        if (!target || target.classList.contains('active')) return;
        const parent = target.closest('.modal-form, .nested-item');
        parent.querySelector('.modal-tab-btn.active').classList.remove('active');
        parent.querySelector('.modal-tab-pane.active').classList.remove('active');
        target.classList.add('active');
        parent.querySelector(target.dataset.modalTab).classList.add('active');
    });
}

function initNestedItemUI(itemElement, data) {
    if (itemElement.matches('[data-type="product"]')) {
        // Задаваме заглавие на редактора на продукта
        const titleSpan = itemElement.querySelector('.product-editor-title');
        if (titleSpan) {
            titleSpan.textContent = getProperty(data, 'public_data.name') || 'Нов Продукт';
        }
        // Инициализираме вложените табове в продукта
        initModalTabs(itemElement);
        
        // Добавяме collapse/expand функционалност
        const header = itemElement.querySelector('.product-header-clickable');
        if (header) {
            header.addEventListener('click', (e) => {
                // Не затваряме/отваряме ако е кликнато върху бутон или handle
                if (e.target.closest('button, .handle, .ai-assistant-btn, .delete-nested-btn')) {
                    return;
                }
                itemElement.classList.toggle('collapsed');
            });
        }
    }
}

function handleProductImport(event, triggerButton) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const importedData = JSON.parse(e.target.result);
            
            // Валидация
            if (!importedData.product_id || !importedData.public_data || !importedData.system_data) {
                throw new Error("Невалиден формат на JSON файла. Липсват ключови полета.");
            }

            // Изчистваме цената според изискването
            delete importedData.public_data.price;

            // Проверка за уникалност на ID
            const productsContainer = triggerButton.closest('.modal-tab-pane').querySelector('#products-editor');
            const existingIds = Array.from(productsContainer.querySelectorAll('[data-field="product_id"]')).map(input => input.value);
            let newId = importedData.product_id;
            while(existingIds.includes(newId)) {
                newId = `${newId}-copy`;
            }
            importedData.product_id = newId;

            addNestedItem(productsContainer, 'product-editor-template', importedData);
            showNotification('Продуктът е импортиран успешно. Въведете цена.', 'success');

        } catch (error) {
            showNotification(`Грешка при импортиране: ${error.message}`, 'error');
            console.error(error);
        } finally {
            // Изчистваме file input-a, за да може да се избере същия файл отново
            event.target.value = '';
        }
    };
    reader.onerror = () => {
        showNotification('Неуспешно прочитане на файла.', 'error');
    };
    reader.readAsText(file);
}

// =======================================================
//          CSV IMPORT / EXPORT / TEMPLATE
// =======================================================

/**
 * CSV columns definition: { key, header, description }
 * Arrays (effects, benefits, ingredients, faq) are stored as JSON strings in a single cell.
 */
const CSV_COLUMNS = [
    { key: 'product_id',                               header: 'product_id',                               description: 'Уникален идентификатор на продукта (напр. prod-omega-3). Само малки букви, цифри и тирета. Не се променя след създаване.' },
    { key: 'public_data.name',                         header: 'name',                                     description: 'Пълно търговско наименование на продукта.' },
    { key: 'public_data.price',                        header: 'price',                                    description: 'Продажна цена в евро (число с до 2 десетични знака, напр. 29.99).' },
    { key: 'public_data.sale_price',                   header: 'sale_price',                               description: 'Промоционална цена в евро. Оставете празно ако няма промоция. Трябва да е по-малка от основната цена.' },
    { key: 'public_data.tagline',                      header: 'tagline',                                  description: 'Кратък слоган/мото на продукта (до 100 знака).' },
    { key: 'public_data.brand',                        header: 'brand',                                    description: 'Марка/бранд на продукта (напр. OstroVit, AllNutrition, Nordic Naturals).' },
    { key: 'public_data.image_url',                    header: 'image_url',                                description: 'URL на основното изображение на продукта (препоръчителен размер 800x800 px).' },
    { key: 'public_data.additional_images',            header: 'additional_images',                        description: 'URL адреси на допълнителни изображения, разделени с вертикална черта | (pipe).' },
    { key: 'public_data.description',                  header: 'description',                              description: 'Кратко описание на продукта (показва се в списъка с продукти).' },
    { key: 'public_data.packaging.capsules_or_grams',  header: 'packaging_capsules_or_grams',              description: 'Количество в опаковка (напр. "60 капсули", "500 мл").' },
    { key: 'public_data.packaging.doses_per_package',  header: 'packaging_doses_per_package',              description: 'Брой дози в опаковка (напр. "30 дози").' },
    { key: 'public_data.recommended_intake',           header: 'recommended_intake',                       description: 'Препоръчителен начин и честота на прием.' },
    { key: 'public_data.contraindications',            header: 'contraindications',                        description: 'Предупреждения и противопоказания за употреба.' },
    { key: 'public_data.additional_advice',            header: 'additional_advice',                        description: 'Допълнителна информация, съвети и препоръки.' },
    { key: 'public_data.research_note.text',           header: 'research_note_text',                       description: 'Текст на научния/изследователски източник.' },
    { key: 'public_data.research_note.url',            header: 'research_note_url',                        description: 'URL на научния/изследователски източник.' },
    { key: 'public_data.about_content.title',          header: 'about_title',                              description: 'Заглавие на секцията "За продукта".' },
    { key: 'public_data.about_content.description',    header: 'about_description',                        description: 'Подробно описание в секцията "За продукта".' },
    { key: 'public_data.label_url',                    header: 'label_url',                                description: 'URL на етикета/суплемент-фактс страницата на продукта.' },
    { key: 'public_data.effects',                      header: 'effects_json',                             description: 'Масив с ефекти в JSON формат. Пример: [{"label":"Енергия","value":85},{"label":"Фокус","value":70}]. Стойността е число от 0 до 100.' },
    { key: 'public_data.about_content.benefits',       header: 'benefits_json',                            description: 'Масив с ползи в JSON формат. Пример: [{"icon":"✓","title":"Заглавие","description":"Описание"}].' },
    { key: 'public_data.ingredients',                  header: 'ingredients_json',                         description: 'Масив от съставки в JSON формат. Пример: [{"name":"Магнезий","amount":"300мг","benefit":"Подкрепя мускулите"}].' },
    { key: 'public_data.faq',                          header: 'faq_json',                                 description: 'Масив от въпроси/отговори в JSON формат. Пример: [{"question":"Кога?","answer":"Сутрин."}].' },
    { key: 'public_data.variants',                     header: 'variants_json',                            description: 'Масив от варианти в JSON формат. Пример: [{"option_name":"Ягода","sku":"73101","price":29.99,"ean":"","image_url":"","available":true}].' },
    { key: 'system_data.manufacturer',                 header: 'manufacturer',                             description: 'Наименование на производителя.' },
    { key: 'system_data.application_type',             header: 'application_type',                         description: 'Тип приложение: Injectable | Intranasal | Topical | Oral | Injectable / Oral / Topical' },
    { key: 'system_data.inventory',                    header: 'inventory',                                description: 'Наличен брой единици (цяло число >= 0).' },
    { key: 'system_data.goals',                        header: 'goals',                                    description: 'Цели/ефекти, разделени с запетая (напр. "anti-aging, recovery, cognitive").' },
    { key: 'system_data.target_profile',               header: 'target_profile',                           description: 'Описание на идеалния потребителски профил.' },
    { key: 'system_data.protocol_hint',                header: 'protocol_hint',                            description: 'Технически насоки за протокол на приложение (за специалисти).' },
    { key: 'system_data.synergy_products',             header: 'synergy_products',                         description: 'ID-та на синергични продукти, разделени с запетая (напр. "prod-semax, prod-selank").' },
    { key: 'system_data.safety_warnings',              header: 'safety_warnings',                          description: 'Предупреждения за безопасност (за вътрешна употреба).' },
];

/**
 * Escapes a value for safe inclusion in a CSV cell.
 * @param {*} val
 * @returns {string}
 */
function csvEscape(val) {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
        return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
}

/**
 * Parses a single CSV line respecting quoted fields.
 * @param {string} line
 * @returns {string[]}
 */
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuotes) {
            if (ch === '"') {
                if (line[i + 1] === '"') { current += '"'; i++; }
                else { inQuotes = false; }
            } else {
                current += ch;
            }
        } else {
            if (ch === '"') { inQuotes = true; }
            else if (ch === ',') { result.push(current); current = ''; }
            else { current += ch; }
        }
    }
    result.push(current);
    return result;
}

/**
 * Reads a flat product object from a CSV row (using CSV_COLUMNS mapping).
 * @param {string[]} headers - CSV header row
 * @param {string[]} values  - CSV data row
 * @returns {object} product object
 */
function csvRowToProduct(headers, values) {
    const flat = {};
    headers.forEach((h, i) => { flat[h] = values[i] !== undefined ? values[i] : ''; });

    const product = {};
    CSV_COLUMNS.forEach(({ key, header }) => {
        const raw = flat[header];
        if (raw === undefined || raw === '') return;

        // Array fields stored as JSON
        if (header.endsWith('_json')) {
            try {
                setProperty(product, key, JSON.parse(raw));
            } catch (_) {
                // ignore malformed JSON
            }
        } else if (key === 'public_data.additional_images') {
            // pipe-separated URLs → newline-separated string (matches textarea format)
            setProperty(product, key, raw.split('|').map(s => s.trim()).filter(Boolean).join('\n'));
        } else if (key === 'system_data.inventory') {
            const n = parseInt(raw, 10);
            setProperty(product, key, isNaN(n) ? 0 : n);
        } else if (key === 'public_data.price') {
            const n = parseFloat(raw);
            setProperty(product, key, isNaN(n) ? '' : n);
        } else {
            setProperty(product, key, raw);
        }
    });
    return product;
}

/**
 * Reads a product object and returns a CSV row (array of escaped strings).
 * @param {object} product
 * @returns {string[]}
 */
function productToCSVRow(product) {
    return CSV_COLUMNS.map(({ key, header }) => {
        let val = getProperty(product, key);
        if (val === undefined || val === null) return '';

        if (header.endsWith('_json')) {
            return Array.isArray(val) ? JSON.stringify(val) : '';
        }
        if (key === 'public_data.additional_images') {
            // newline-separated → pipe-separated
            if (typeof val === 'string') {
                return val.split('\n').map(s => s.trim()).filter(Boolean).join('|');
            }
            return '';
        }
        return String(val);
    });
}

/**
 * Downloads the CSV template with a header row (field names) and a description row.
 */
function downloadCSVTemplate() {
    const headerRow = CSV_COLUMNS.map(c => csvEscape(c.header)).join(',');
    const descRow   = CSV_COLUMNS.map(c => csvEscape(c.description)).join(',');
    const exampleRow = CSV_COLUMNS.map(({ key, header }) => {
        const examples = {
            'product_id':                     'prod-omega-3',
            'name':                           'Omega-3 Premium',
            'price':                          '29.99',
            'tagline':                        'Чиста омега-3 за здраво сърце',
            'brand':                          'Nordic Naturals',
            'image_url':                      'https://example.com/omega3.jpg',
            'additional_images':              'https://example.com/img2.jpg|https://example.com/img3.jpg',
            'description':                    'Висококачествена омега-3 от дълбоководни риби.',
            'packaging_capsules_or_grams':    '60 капсули',
            'packaging_doses_per_package':    '30 дози',
            'recommended_intake':             '2 капсули дневно с храна.',
            'contraindications':              'Не е подходящо при алергия към риба.',
            'additional_advice':              'Съхранявайте на хладно и сухо място.',
            'research_note_text':             'Изследване в NEJM, 2023',
            'research_note_url':              'https://www.nejm.org/doi/example',
            'about_title':                    'За Omega-3 Premium',
            'about_description':             'Подробно описание на продукта...',
            'label_url':                      'https://example.com/omega3-label.jpg',
            'effects_json':                   '[{"label":"Сърдечно-съдово здраве","value":90},{"label":"Мозъчна функция","value":75}]',
            'benefits_json':                  '[{"icon":"❤️","title":"Сърце","description":"Поддържа здравето на сърцето"}]',
            'ingredients_json':               '[{"name":"EPA","amount":"360мг","benefit":"Противовъзпалително действие"}]',
            'faq_json':                       '[{"question":"Кога да приемам?","answer":"С храна сутрин."}]',
            'variants_json':                  '[{"option_name":"Стандартен","sku":"","price":29.99,"ean":"","image_url":"","available":true}]',
            'manufacturer':                   'Nordic Naturals',
            'application_type':               'Oral',
            'inventory':                      '100',
            'goals':                          'heart-health, cognitive, anti-aging',
            'target_profile':                 'Възрастни над 30 години с активен начин на живот.',
            'protocol_hint':                  '2 капсули/ден с основно хранене, минимален курс 3 месеца.',
            'synergy_products':               'prod-vitamin-d, prod-magnesium',
            'safety_warnings':                'Консултирайте се с лекар при употреба на антикоагуланти.',
        };
        return csvEscape(examples[header] || '');
    }).join(',');

    const csvContent = '\uFEFF' + [headerRow, descRow, exampleRow].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'product_import_template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showNotification('CSV шаблонът е изтеглен.', 'success');
}

/**
 * Handles CSV file import: parses the file and adds products to the editor.
 * @param {Event} event
 * @param {HTMLElement} triggerButton
 */
function handleProductCSVImport(event, triggerButton) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            // Normalise line endings and strip BOM
            const text = e.target.result.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
            const lines = text.split('\n').filter(l => l.trim() !== '');

            if (lines.length < 2) {
                throw new Error('CSV файлът трябва да съдържа поне заглавен ред и един ред с данни.');
            }

            const headers = parseCSVLine(lines[0]);

            // Skip description row if present (second row contains description text for first column)
            // The template file includes a description row as the second row; detect it by checking
            // that its first cell is longer than a product_id would be and does not look like an ID.
            const MIN_DESCRIPTION_CELL_LENGTH = 30;
            let dataStartIndex = 1;
            if (lines.length > 2) {
                const secondRowFirstCell = parseCSVLine(lines[1])[0] || '';
                if (secondRowFirstCell.length > MIN_DESCRIPTION_CELL_LENGTH && !secondRowFirstCell.match(/^prod-/i)) {
                    dataStartIndex = 2;
                }
            }

            const productsContainer = triggerButton.closest('.modal-tab-pane').querySelector('#products-editor');
            const existingIds = Array.from(productsContainer.querySelectorAll('[data-field="product_id"]')).map(inp => inp.value);

            let imported = 0;
            for (let i = dataStartIndex; i < lines.length; i++) {
                const values = parseCSVLine(lines[i]);
                if (values.every(v => v.trim() === '')) continue; // skip empty rows

                const productData = csvRowToProduct(headers, values);

                if (!productData.product_id) {
                    productData.product_id = `prod-import-${Date.now()}-${i}`;
                }

                // Ensure unique ID
                let newId = productData.product_id;
                while (existingIds.includes(newId)) {
                    newId = `${newId}-copy`;
                }
                productData.product_id = newId;
                existingIds.push(newId);

                addNestedItem(productsContainer, 'product-editor-template', productData);
                imported++;
            }

            showNotification(`${imported} продукт(а) са импортирани от CSV.`, 'success');
        } catch (error) {
            showNotification(`Грешка при CSV импорт: ${error.message}`, 'error');
            console.error(error);
        } finally {
            event.target.value = '';
        }
    };
    reader.onerror = () => { showNotification('Неуспешно прочитане на CSV файла.', 'error'); };
    reader.readAsText(file, 'UTF-8');
}

// =======================================================
//          B2B XLSX IMPORT (формат fitness1.bg)
// =======================================================

/**
 * Maps a group of rows from the B2B XLSX file (fitness1.bg format) to a product object.
 * Expected columns: SKU, Product, Option, Price, Discount, B2B price, Currency, EAN, Available, Label, Image
 * Rows in the same group share the same product name (field B); each row becomes a variant (field C).
 * The "Price" column (field D) is used as the customer-facing selling price.
 * The "Label" column (supplement facts image) maps to public_data.label_url (link) AND is added
 * as a second image in public_data.additional_images (gallery).
 * The "Image" column maps to public_data.image_url and variant.image_url.
 * @param {object[]} rows - array of plain objects with column names as keys (same product name)
 * @returns {object} product object compatible with the site's product structure
 */
function b2bXLSXRowToProduct(rows) {
    const firstRow = rows[0];
    const sku = String(firstRow['SKU'] || '').trim();
    const productName = String(firstRow['Product'] || '').trim();
    // "Price" (field D) is the customer-facing price; "B2B price" is our distributor cost.
    const priceStr = String(firstRow['Price'] || '').replace(',', '.').trim();
    const price = parseFloat(priceStr);
    const labelUrl = firstRow['Label'] ? String(firstRow['Label']).trim() : '';
    const imageUrl = firstRow['Image'] ? String(firstRow['Image']).trim() : '';

    // Parse packaging info from product name bracket suffix, e.g. "[60 капсули, 60 Дози]".
    // parts[0] → capsules_or_grams, parts[1] → doses_per_package; missing parts default to ''.
    const packagingMatch = productName.match(/\[([^\]]+)\]/);
    let capsules = '';
    let doses = '';
    if (packagingMatch) {
        const parts = packagingMatch[1].split(',').map(s => s.trim());
        capsules = parts[0] || '';
        doses = parts[1] || '';
    }

    // Derive manufacturer from product name prefix (word ending with '.', e.g. "Oly.")
    const manufacturerMatch = productName.match(/^(\S+\.)\s/);
    const manufacturer = manufacturerMatch ? manufacturerMatch[1] : '';

    const priceValue = isNaN(price) ? null : price;

    // Build variants from all rows in the group (each row = one variant/option).
    const variants = rows.map(row => {
        const variantSku = String(row['SKU'] || '').trim();
        const option = row['Option'] ? String(row['Option']).trim() : '';
        const variantPriceStr = String(row['Price'] || '').replace(',', '.').trim();
        const variantPrice = parseFloat(variantPriceStr);
        const ean = String(row['EAN'] || '').trim();
        const available = String(row['Available'] || '').trim().toLowerCase() === 'yes';
        const variantImageUrl = row['Image'] ? String(row['Image']).trim() : '';
        return {
            sku: variantSku,
            option_name: option,
            price: isNaN(variantPrice) ? priceValue : variantPrice,
            image_url: variantImageUrl,
            ean: ean,
            available: available,
        };
    });

    const anyAvailable = variants.some(v => v.available);

    // Label URL is added both as a link (label_url) and as an image in the gallery
    // (additional_images is a newline-separated string in the textarea).
    const additionalImagesValue = labelUrl || '';

    const product = {
        product_id: `prod-${sku}`,
        public_data: {
            name: productName,
            price: priceValue,
            image_url: imageUrl,
            label_url: labelUrl,
            additional_images: additionalImagesValue,
            packaging: {
                capsules_or_grams: capsules,
                doses_per_package: doses,
            },
            variants: variants,
        },
        system_data: {
            inventory: anyAvailable ? 1 : 0,
            manufacturer: manufacturer,
        },
        display_order: 0,
    };

    return product;
}

/**
 * Handles B2B XLSX file import: parses the file and adds products to the editor.
 * @param {Event} event
 * @param {HTMLElement} triggerButton
 */
function handleProductXLSXImport(event, triggerButton) {
    const file = event.target.files[0];
    if (!file) return;

    if (typeof XLSX === 'undefined') {
        showNotification('XLSX библиотеката не е заредена. Моля, опреснете страницата.', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

            if (rows.length === 0) {
                throw new Error('XLSX файлът не съдържа данни.');
            }

            const productsContainer = triggerButton.closest('.modal-tab-pane').querySelector('#products-editor');
            const existingIds = Array.from(productsContainer.querySelectorAll('[data-field="product_id"]')).map(inp => inp.value);

            // Group consecutive rows by product name (field B). Rows with the same name
            // are treated as different variants (option, field C) of the same product.
            const groups = [];
            rows.forEach(row => {
                if (!row['SKU'] && !row['Product']) return;
                const productName = String(row['Product'] || '').trim();
                if (groups.length > 0 && groups[groups.length - 1].name === productName) {
                    groups[groups.length - 1].rows.push(row);
                } else {
                    groups.push({ name: productName, rows: [row] });
                }
            });

            let imported = 0;
            groups.forEach(group => {
                const productData = b2bXLSXRowToProduct(group.rows);

                // Ensure unique product_id
                let newId = productData.product_id;
                while (existingIds.includes(newId)) {
                    newId = `${newId}-copy`;
                }
                productData.product_id = newId;
                existingIds.push(newId);

                addNestedItem(productsContainer, 'product-editor-template', productData);
                imported++;
            });

            showNotification(`${imported} продукт(а) са импортирани от XLSX.`, 'success');
        } catch (error) {
            showNotification(`Грешка при XLSX импорт: ${error.message}`, 'error');
            console.error(error);
        } finally {
            event.target.value = '';
        }
    };
    reader.onerror = () => { showNotification('Неуспешно прочитане на XLSX файла.', 'error'); };
    reader.readAsArrayBuffer(file);
}

/**
 * Exports all products from the editor container to a CSV file.
 * @param {HTMLElement} productsContainer
 */
function exportProductsToCSV(productsContainer) {
    const productNodes = productsContainer.querySelectorAll(':scope > .nested-item[data-type="product"]');
    if (productNodes.length === 0) {
        showNotification('Няма продукти за експортиране.', 'error');
        return;
    }

    const products = [];
    productNodes.forEach(node => {
        const productData = {};
        node.querySelectorAll('[data-field]').forEach(input => {
            if (input.closest('.nested-sub-item')) return; // skip variant/effect/ingredient/faq fields
            const path = input.dataset.field;
            let value;
            if (input.type === 'checkbox') {
                value = input.checked;
            } else if (input.tagName === 'SELECT') {
                value = input.value;
            } else {
                value = input.value;
            }

            if (path.includes('goals') || path.includes('synergy_products')) {
                value = value.split(',').map(s => s.trim()).filter(Boolean);
            }
            setProperty(productData, path, value);
        });

        // Collect array sub-lists
        const subLists = ['effects', 'about-benefits', 'ingredients', 'faq', 'variants'];
        subLists.forEach(subListName => {
            const subContainer = node.querySelector(`[data-sub-container="${subListName}"]`);
            if (!subContainer) return;
            const items = [];
            subContainer.querySelectorAll(':scope > .nested-sub-item').forEach(subItem => {
                const subData = {};
                subItem.querySelectorAll('[data-field]').forEach(inp => {
                    subData[inp.dataset.field] = inp.type === 'checkbox' ? inp.checked : inp.value;
                });
                items.push(subData);
            });
            if (subListName === 'effects') setProperty(productData, 'public_data.effects', items);
            else if (subListName === 'about-benefits') setProperty(productData, 'public_data.about_content.benefits', items);
            else if (subListName === 'ingredients') setProperty(productData, 'public_data.ingredients', items);
            else if (subListName === 'faq') setProperty(productData, 'public_data.faq', items);
            else if (subListName === 'variants') setProperty(productData, 'public_data.variants', items);
        });

        products.push(productData);
    });

    const headerRow = CSV_COLUMNS.map(c => csvEscape(c.header)).join(',');
    const dataRows = products.map(p => productToCSVRow(p).map(csvEscape).join(','));
    const csvContent = '\uFEFF' + [headerRow, ...dataRows].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const timestamp = new Date().toISOString().slice(0, 10);
    link.download = `products_export_${timestamp}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showNotification(`${products.length} продукт(а) са експортирани.`, 'success');
}

function getProperty(obj, path) {
    if(obj === null || obj === undefined) return undefined;
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
}

function setProperty(obj, path, value) {
    const parts = path.split('.');
    const last = parts.pop();
    const target = parts.reduce((acc, part) => acc[part] = acc[part] || {}, obj);
    target[last] = value;
}

// =======================================================
//          8. IMAGE UPLOAD TO GITHUB
// =======================================================

/**
 * Uploads an image file to GitHub repository
 * @param {File} file - The image file to upload
 * @returns {Promise<string>} - The URL of the uploaded image
 */
async function uploadImageToGitHub(file) {
    // Configuration for GitHub upload
    const GITHUB_OWNER = 'Radilovk';  // Repository owner
    const GITHUB_REPO = 'otslabvai';  // Repository name
    const GITHUB_BRANCH = 'main';      // Branch to upload to
    
    // Try to get token from sessionStorage first (temporary storage for session)
    let GITHUB_TOKEN = sessionStorage.getItem('github_upload_token');
    
    // If not in sessionStorage, try to fetch from backend KV storage
    if (!GITHUB_TOKEN) {
        try {
            const response = await fetch(`${API_URL}/api-token`);
            if (response.ok) {
                const data = await response.json();
                if (data.api_token) {
                    GITHUB_TOKEN = data.api_token;
                    // Cache in sessionStorage for subsequent uploads
                    sessionStorage.setItem('github_upload_token', GITHUB_TOKEN);
                }
            }
        } catch (error) {
            console.warn('Failed to fetch API token from backend:', error);
        }
    }
    
    // If still no token, prompt the user
    if (!GITHUB_TOKEN) {
        GITHUB_TOKEN = prompt(
            'Моля въведете GitHub Personal Access Token:\n\n' +
            '(Token трябва да има \'repo\' permissions)\n' +
            'Token-ът ще бъде запазен само за тази сесия.'
        );
        
        if (!GITHUB_TOKEN) {
            throw new Error('GitHub token е необходим за качване на изображения');
        }
        
        // Store token in sessionStorage (cleared when browser closes)
        sessionStorage.setItem('github_upload_token', GITHUB_TOKEN);
    }
    
    // Generate unique filename
    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filename = `product-${timestamp}-${sanitizedName}`;
    const filepath = `images/products/${filename}`;
    
    // Convert file to base64
    const fileContent = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            // Remove the data:image/...;base64, prefix
            const base64 = reader.result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
    
    // Prepare the API request
    const apiUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filepath}`;
    
    const payload = {
        message: `Upload product image: ${filename}`,
        content: fileContent,
        branch: GITHUB_BRANCH
    };
    
    // Make the API request
    const response = await fetch(apiUrl, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${GITHUB_TOKEN}`,
            'Content-Type': 'application/json',
            'Accept': 'application/vnd.github.v3+json'
        },
        body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
        const error = await response.json();
        
        // If token is invalid, clear it from storage
        if (response.status === 401 || response.status === 403) {
            sessionStorage.removeItem('github_upload_token');
        }
        
        throw new Error(error.message || `GitHub API error: ${response.status}`);
    }
    
    const result = await response.json();
    
    // Return the raw GitHub URL for the image
    const imageUrl = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/${filepath}`;
    
    return imageUrl;
}

/**
 * Handles AI Assistant functionality for product auto-fill
 * @param {HTMLElement} productEditor - The product editor element
 */
async function handleAIAssistant(productEditor) {
    try {
        // Показваме индикатор за зареждане
        const aiBtn = productEditor.querySelector('.ai-assistant-btn');
        const originalText = aiBtn.textContent;
        aiBtn.disabled = true;
        aiBtn.textContent = '⏳ AI обработва...';
        
        // Събираме текущите данни от продуктовия редактор
        const currentData = {
            productName: productEditor.querySelector('[data-field="public_data.name"]')?.value || '',
            price: productEditor.querySelector('[data-field="public_data.price"]')?.value || '',
            tagline: productEditor.querySelector('[data-field="public_data.tagline"]')?.value || '',
            description: productEditor.querySelector('[data-field="public_data.description"]')?.value || '',
            manufacturer: productEditor.querySelector('[data-field="system_data.manufacturer"]')?.value || '',
            application_type: productEditor.querySelector('[data-field="system_data.application_type"]')?.value || '',
            inventory: productEditor.querySelector('[data-field="system_data.inventory"]')?.value || '',
            goals: productEditor.querySelector('[data-field="system_data.goals"]')?.value || '',
            target_profile: productEditor.querySelector('[data-field="system_data.target_profile"]')?.value || '',
            protocol_hint: productEditor.querySelector('[data-field="system_data.protocol_hint"]')?.value || '',
            synergy_products: productEditor.querySelector('[data-field="system_data.synergy_products"]')?.value || '',
            safety_warnings: productEditor.querySelector('[data-field="system_data.safety_warnings"]')?.value || '',
        };
        
        // Проверяваме дали има поне име на продукта
        if (!currentData.productName.trim()) {
            showNotification('Моля, въведете поне име на продукта преди да използвате AI Асистент.', 'error');
            aiBtn.disabled = false;
            aiBtn.textContent = originalText;
            return;
        }
        
        // Извикваме AI API
        const response = await fetch(`${API_URL}/ai-assistant`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                productData: currentData,
                settings: aiSettings
            })
        });
        
        if (!response.ok) {
            let errorMessage = 'AI заявката се провали';
            try {
                const error = await response.json();
                errorMessage = error.error || errorMessage;
            } catch (jsonError) {
                // If response is not JSON, use status text
                errorMessage = `Сървър грешка: ${response.status} ${response.statusText}`;
            }
            throw new Error(errorMessage);
        }
        
        const result = await response.json();
        
        if (!result.success || !result.data) {
            throw new Error('Невалиден отговор от AI');
        }
        
        const aiData = result.data;
        
        // Попълваме празните полета с AI данни
        const fillField = (selector, value) => {
            const input = productEditor.querySelector(selector);
            // Only fill if field is empty and value is not null/undefined
            if (input && !input.value && value !== null && value !== undefined && value !== '') {
                input.value = value;
            }
        };
        
        // Основни публични полета
        fillField('[data-field="public_data.name"]', aiData.name);
        fillField('[data-field="public_data.price"]', aiData.price);
        fillField('[data-field="public_data.tagline"]', aiData.tagline);
        fillField('[data-field="public_data.description"]', aiData.description);
        
        // Марка (Brand)
        fillField('[data-field="public_data.brand"]', aiData.brand);

        // Изображения
        fillField('[data-field="public_data.image_url"]', aiData.image_url);
        
        // Research Note (източник)
        if (aiData.research_note) {
            fillField('[data-field="public_data.research_note.text"]', aiData.research_note.text);
            fillField('[data-field="public_data.research_note.url"]', aiData.research_note.url);
        }
        
        // Опаковка
        if (aiData.packaging_info) {
            fillField('[data-field="public_data.packaging.capsules_or_grams"]', aiData.packaging_info.capsules_or_grams);
            fillField('[data-field="public_data.packaging.doses_per_package"]', aiData.packaging_info.doses_per_package);
        }
        
        // Допълнителна информация - сега има отделни полета
        fillField('[data-field="public_data.recommended_intake"]', aiData.recommended_intake);
        fillField('[data-field="public_data.contraindications"]', aiData.contraindications);
        fillField('[data-field="public_data.additional_advice"]', aiData.additional_advice);
        
        // Системни данни - ВСЕ полета
        fillField('[data-field="system_data.manufacturer"]', aiData.manufacturer);
        fillField('[data-field="system_data.application_type"]', aiData.application_type);
        fillField('[data-field="system_data.inventory"]', aiData.inventory);
        fillField('[data-field="system_data.goals"]', aiData.goals);
        fillField('[data-field="system_data.target_profile"]', aiData.target_profile);
        fillField('[data-field="system_data.protocol_hint"]', aiData.protocol_hint);
        fillField('[data-field="system_data.synergy_products"]', aiData.synergy_products);
        fillField('[data-field="system_data.safety_warnings"]', aiData.safety_warnings);

        // Ensure inventory is always a positive sample value
        const inventoryInput = productEditor.querySelector('[data-field="system_data.inventory"]');
        if (inventoryInput && (!inventoryInput.value || inventoryInput.value === '0')) {
            inventoryInput.value = 10;
        }
        
        // За продукта (About Content)
        if (aiData.about_content) {
            fillField('[data-field="public_data.about_content.title"]', aiData.about_content.title);
            fillField('[data-field="public_data.about_content.description"]', aiData.about_content.description);
            
            // Добавяме ползи (benefits)
            if (aiData.about_content.benefits && Array.isArray(aiData.about_content.benefits)) {
                const benefitsContainer = productEditor.querySelector('[data-sub-container="about-benefits"]');
                if (benefitsContainer) {
                    // Check if there are actual benefit items, not just empty container
                    const existingBenefits = benefitsContainer.querySelectorAll('.nested-sub-item[data-type="about-benefit"]');
                    if (existingBenefits.length === 0) {
                        aiData.about_content.benefits.forEach(benefit => {
                            addNestedItem(benefitsContainer, 'about-benefit-editor-template', benefit);
                        });
                    }
                }
            }
        }
        
        // Добавяме ефекти
        if (aiData.effects && Array.isArray(aiData.effects)) {
            const effectsContainer = productEditor.querySelector('[data-sub-container="effects"]');
            if (effectsContainer) {
                const existingEffects = effectsContainer.querySelectorAll('.nested-sub-item[data-type="effect"]');
                if (existingEffects.length === 0) {
                    aiData.effects.forEach(effect => {
                        addNestedItem(effectsContainer, 'effect-editor-template', effect);
                    });
                }
            }
        }
        
        // Добавяме съставки
        if (aiData.ingredients && Array.isArray(aiData.ingredients)) {
            const ingredientsContainer = productEditor.querySelector('[data-sub-container="ingredients"]');
            if (ingredientsContainer) {
                const existingIngredients = ingredientsContainer.querySelectorAll('.nested-sub-item[data-type="ingredient"]');
                if (existingIngredients.length === 0) {
                    aiData.ingredients.forEach(ingredient => {
                        addNestedItem(ingredientsContainer, 'ingredient-editor-template', ingredient);
                    });
                }
            }
        }
        
        // Добавяме FAQ
        if (aiData.faq && Array.isArray(aiData.faq)) {
            const faqContainer = productEditor.querySelector('[data-sub-container="faq"]');
            if (faqContainer) {
                const existingFaq = faqContainer.querySelectorAll('.nested-sub-item[data-type="faq"]');
                if (existingFaq.length === 0) {
                    aiData.faq.forEach(faqItem => {
                        addNestedItem(faqContainer, 'faq-editor-template', faqItem);
                    });
                }
            }
        }
        
        // Добавяме варианти
        if (aiData.variants && Array.isArray(aiData.variants)) {
            const variantsContainer = productEditor.querySelector('[data-sub-container="variants"]');
            if (variantsContainer) {
                const existingVariants = variantsContainer.querySelectorAll('.nested-sub-item[data-type="variant"]');
                if (existingVariants.length === 0) {
                    aiData.variants.forEach(variant => {
                        addNestedItem(variantsContainer, 'variant-editor-template', variant);
                    });
                }
            }
        }

        // Актуализираме заглавието на продукта само ако е празно или е "Нов Продукт"
        const titleSpan = productEditor.querySelector('.product-editor-title');
        if (titleSpan && aiData.name) {
            const currentTitle = titleSpan.textContent.trim();
            if (!currentTitle || currentTitle === 'Нов Продукт') {
                titleSpan.textContent = aiData.name;
            }
        }
        
        showNotification('✅ AI Асистентът успешно попълни информацията за продукта!', 'success', 6000);
        
    } catch (error) {
        console.error('AI Assistant error:', error);
        showNotification(`❌ Грешка при AI обработка: ${error.message}`, 'error', 6000);
    } finally {
        // Възстановяваме бутона
        const aiBtn = productEditor.querySelector('.ai-assistant-btn');
        if (aiBtn) {
            aiBtn.disabled = false;
            aiBtn.textContent = '🤖 AI Асистент';
        }
    }
}

/**
 * Handles moving a product to a different category
 * @param {HTMLElement} productEditor - The product editor element
 */
function handleMoveProduct(productEditor) {
    // Get all product categories
    const categories = appData.page_content.filter(item => item.type === 'product_category');
    
    if (categories.length < 2) {
        showNotification('Няма други категории, в които да преместите продукта.', 'info');
        return;
    }
    
    // Find the current category
    const currentCategory = categories.find(cat => {
        const productsContainer = document.querySelector(`[data-component-id="${cat.component_id}"] #products-editor`);
        return productsContainer && productsContainer.contains(productEditor);
    });
    
    // Get product data
    const productData = {};
    productEditor.querySelectorAll('[data-field]').forEach(input => {
        if (input.closest('.nested-sub-item')) return; // skip variant/effect/ingredient/faq fields
        const path = input.dataset.field;
        let value;
        if (input.type === 'checkbox') {
            value = input.checked;
        } else if (input.type === 'number') {
            value = input.value !== '' ? parseFloat(input.value) : null;
        } else if (path.includes('goals') || path.includes('synergy_products')) {
            value = input.value.split(',').map(s => s.trim()).filter(Boolean);
        } else {
            value = input.value;
        }
        setProperty(productData, path, value);
    });
    
    // Serialize nested lists (effects, ingredients, etc.)
    ['effects', 'about-benefits', 'ingredients', 'faq', 'variants'].forEach(subListName => {
        const subContainer = productEditor.querySelector(`[data-sub-container="${subListName}"]`);
        if (subContainer) {
            const items = [];
            subContainer.querySelectorAll(':scope > .nested-sub-item').forEach(subItem => {
                const itemData = {};
                subItem.querySelectorAll('[data-field]').forEach(input => {
                    const path = input.dataset.field;
                    let value;
                    if (input.type === 'checkbox') {
                        value = input.checked;
                    } else if (input.type === 'number') {
                        value = input.value !== '' ? parseFloat(input.value) : null;
                    } else {
                        value = input.value;
                    }
                    setProperty(itemData, path, value);
                });
                items.push(itemData);
            });
            
            if (subListName === 'about-benefits') {
                if (!productData.public_data) productData.public_data = {};
                if (!productData.public_data.about_content) productData.public_data.about_content = {};
                productData.public_data.about_content.benefits = items;
            } else {
                if (!productData.public_data) productData.public_data = {};
                productData.public_data[subListName] = items;
            }
        }
    });
    
    const productName = productData.public_data?.name || 'Неименуван продукт';
    
    // Create a simple selection modal
    const modalBody = document.createElement('div');
    modalBody.innerHTML = `
        <form>
            <p style="margin-bottom: 1rem;">Изберете категория, в която да преместите продукта "${productName}":</p>
            <div class="form-group">
                <label>Целева категория</label>
                <select id="target-category-select" class="form-control" style="width: 100%; padding: 0.5rem;">
                    ${categories.map(cat => {
                        const isCurrent = currentCategory && cat.component_id === currentCategory.component_id;
                        return `<option value="${cat.component_id}" ${isCurrent ? 'disabled' : ''}>${cat.title}${isCurrent ? ' (текуща)' : ''}</option>`;
                    }).join('')}
                </select>
            </div>
        </form>
    `;
    
    // Manually set up modal instead of using openModal
    DOM.modal.title.textContent = 'Премести продукт';
    DOM.modal.body.innerHTML = '';
    DOM.modal.body.appendChild(modalBody);
    
    currentModalSaveCallback = () => {
        const targetCategoryId = modalBody.querySelector('#target-category-select').value;
        const targetCategory = categories.find(cat => cat.component_id === targetCategoryId);
        
        if (!targetCategory) {
            showNotification('Невалидна категория.', 'error');
            return false;
        }
        
        // Remove from current category
        if (currentCategory) {
            const productIndex = currentCategory.products.findIndex(p => p.product_id === productData.product_id);
            if (productIndex !== -1) {
                currentCategory.products.splice(productIndex, 1);
                // Update display order for remaining products
                currentCategory.products.forEach((p, idx) => {
                    p.display_order = idx;
                });
            }
        }
        
        // Add to target category
        if (!targetCategory.products) {
            targetCategory.products = [];
        }
        productData.display_order = targetCategory.products.length;
        targetCategory.products.push(productData);
        
        // Remove the product editor from the DOM
        productEditor.remove();
        
        setUnsavedChanges(true);
        showNotification(`Продуктът "${productName}" е преместен успешно в категория "${targetCategory.title}".`, 'success');
        
        return true;
    };
    
    DOM.modal.container.classList.add('show');
    DOM.modal.backdrop.classList.add('show');
}

// =======================================================
//          AI SETTINGS MANAGEMENT
// =======================================================

let aiSettings = null;

/**
 * Load AI settings from localStorage and server
 */
async function loadAISettings() {
    try {
        // Try to load from server first
        const response = await fetch(`${API_URL}/ai-settings`);
        if (response.ok) {
            const serverSettings = await response.json();
            aiSettings = serverSettings;
            
            // Load API key from localStorage (not stored on server for security)
            const storedApiKey = localStorage.getItem('ai_api_key');
            if (storedApiKey) {
                aiSettings.apiKey = storedApiKey;
            }
        }
    } catch (error) {
        console.error('Failed to load AI settings:', error);
    }
    
    // If no settings loaded, use defaults
    if (!aiSettings) {
        aiSettings = {
            provider: 'cloudflare',
            model: '@cf/meta/llama-3.1-70b-instruct',
            apiKey: localStorage.getItem('ai_api_key') || '',
            temperature: 0.3,
            maxTokens: 8192,
            promptTemplate: getDefaultPromptTemplate()
        };
    }
    
    // Populate UI if on AI settings tab
    populateAISettingsUI();
}

/**
 * Save AI settings
 */
async function saveAISettings() {
    try {
        // Collect settings from UI
        const settings = {
            provider: document.getElementById('ai-provider').value,
            model: document.getElementById('ai-model').value,
            temperature: parseFloat(document.getElementById('ai-temperature').value),
            maxTokens: parseInt(document.getElementById('ai-max-tokens').value),
            promptTemplate: document.getElementById('ai-prompt-template').value,
            apiKey: '' // Don't send to server
        };
        
        // Save API key to localStorage only
        const apiKey = document.getElementById('ai-api-key').value;
        if (apiKey) {
            localStorage.setItem('ai_api_key', apiKey);
            settings.apiKey = apiKey;
        }
        
        // Save to server (without API key)
        const serverSettings = { ...settings };
        delete serverSettings.apiKey;
        
        const response = await fetch(`${API_URL}/ai-settings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(serverSettings)
        });
        
        if (!response.ok) {
            throw new Error('Failed to save settings');
        }
        
        aiSettings = settings;
        showNotification('✅ AI настройките са запазени успешно!', 'success');
        
    } catch (error) {
        console.error('Failed to save AI settings:', error);
        showNotification('❌ Грешка при запазване на настройките', 'error');
    }
}

/**
 * Test AI settings
 */
async function testAISettings() {
    try {
        const testBtn = document.getElementById('test-ai-settings-btn');
        testBtn.disabled = true;
        testBtn.textContent = '⏳ Тестване...';
        
        // Collect current settings
        const settings = {
            provider: document.getElementById('ai-provider').value,
            model: document.getElementById('ai-model').value,
            apiKey: document.getElementById('ai-api-key').value || localStorage.getItem('ai_api_key'),
            temperature: parseFloat(document.getElementById('ai-temperature').value),
            maxTokens: parseInt(document.getElementById('ai-max-tokens').value),
            promptTemplate: document.getElementById('ai-prompt-template').value
        };
        
        // Test with a simple product
        const testProduct = {
            productName: 'Витамин C'
        };
        
        const response = await fetch(`${API_URL}/ai-assistant`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                productData: testProduct,
                settings: settings
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Test failed');
        }
        
        const result = await response.json();
        
        if (result.success) {
            showNotification('✅ AI тестът премина успешно! Моделът работи правилно.', 'success', 6000);
        } else {
            throw new Error('Invalid response');
        }
        
    } catch (error) {
        console.error('AI test failed:', error);
        showNotification(`❌ AI тестът се провали: ${error.message}`, 'error', 6000);
    } finally {
        const testBtn = document.getElementById('test-ai-settings-btn');
        testBtn.disabled = false;
        testBtn.textContent = '🧪 Тествай AI';
    }
}

/**
 * Reset AI settings to default
 */
function resetAISettings() {
    if (!confirm('Сигурни ли сте, че искате да възстановите настройките по подразбиране?')) {
        return;
    }
    
    document.getElementById('ai-provider').value = 'cloudflare';
    document.getElementById('ai-model').value = '@cf/meta/llama-3.1-70b-instruct';
    document.getElementById('ai-api-key').value = '';
    document.getElementById('ai-temperature').value = '0.3';
    document.getElementById('ai-max-tokens').value = '4096';
    document.getElementById('ai-prompt-template').value = getDefaultPromptTemplate();
    
    updateModelPlaceholder();
    showNotification('🔄 Настройките са възстановени по подразбиране', 'info');
}

/**
 * Populate AI settings UI
 */
function populateAISettingsUI() {
    if (!aiSettings) return;
    
    const providerSelect = document.getElementById('ai-provider');
    const modelInput = document.getElementById('ai-model');
    const apiKeyInput = document.getElementById('ai-api-key');
    const temperatureInput = document.getElementById('ai-temperature');
    const maxTokensInput = document.getElementById('ai-max-tokens');
    const promptInput = document.getElementById('ai-prompt-template');
    
    if (providerSelect) providerSelect.value = aiSettings.provider;
    if (modelInput) modelInput.value = aiSettings.model;
    if (apiKeyInput && aiSettings.apiKey) apiKeyInput.value = aiSettings.apiKey;
    if (temperatureInput) temperatureInput.value = aiSettings.temperature;
    if (maxTokensInput) maxTokensInput.value = aiSettings.maxTokens;
    if (promptInput) promptInput.value = aiSettings.promptTemplate;
}

/**
 * Update model placeholder based on provider
 */
function updateModelPlaceholder() {
    const provider = document.getElementById('ai-provider').value;
    const modelInput = document.getElementById('ai-model');
    
    const placeholders = {
        'cloudflare': '@cf/meta/llama-3.1-70b-instruct',
        'openai': 'gpt-4 or gpt-3.5-turbo',
        'google': 'gemini-2.0-flash'
    };
    
    if (modelInput) {
        modelInput.placeholder = placeholders[provider] || '';
    }
}

/**
 * Get default prompt template
 */
function getDefaultPromptTemplate() {
    return `Ти си експерт по хранителни добавки и продукти за отслабване. Анализирай следната информация за продукт и попълни всички възможни полета в JSON формат базирайки се на твоите знания за този тип продукти.

Въведена информация:
{{productData}}

Моля попълни JSON обект със следните полета (на български език):
{
  "name": "Пълно име на продукта",
  "brand": "Марка / производителска марка на продукта (напр. OstroVit, Olimp, Scitec Nutrition и т.н.; null ако не е известна)",
  "manufacturer": "Производител (ако е известен)",
  "price": "Приблизителна цена в евро като число (или null ако не знаеш)",
  "tagline": "Кратък маркетингов слоган (до 60 символа)",
  "description": "Подробно маркетингово описание (100-200 думи)",
  "packaging_info": {
    "capsules_or_grams": "Брой капсули или грамаж (напр. '60 капсули' или '500 г')",
    "doses_per_package": "Брой дози в опаковка (напр. '30 дози')"
  },
  "effects": [
    {
      "label": "Ефект 1",
      "value": "Стойност от 0 до 100 (процент)"
    },
    {
      "label": "Ефект 2",
      "value": "Стойност от 0 до 100 (процент)"
    },
    {
      "label": "Ефект 3",
      "value": "Стойност от 0 до 100 (процент)"
    }
  ],
  "about_content": {
    "title": "За продукта",
    "description": "Подробно описание",
    "benefits": [
      {
        "title": "Заглавие на ползата",
        "text": "Подробно описание на ползата"
      }
    ]
  },
  "ingredients": [
    {
      "name": "Съставка 1",
      "amount": "Количество",
      "description": "Описание на съставката"
    }
  ],
  "recommended_intake": "Препоръчителен прием и дозировка",
  "contraindications": "Противопоказания и предупреждения",
  "additional_advice": "Допълнителни съвети и информация",
  "research_note": {
    "text": "Кратко описание на научен/клиничен източник (напр. 'Проучване, публикувано в PubMed, 2021') или null",
    "url": "URL към изследване или официален сайт или null"
  },
  "faq": [
    {
      "question": "Често задаван въпрос 1",
      "answer": "Отговор"
    }
  ],
  "variants": [
    {
      "option_name": "Разфасовка или вкус (напр. '60 капс', '120 капс', 'Ягода', 'Шоколад')",
      "price": "Цена на варианта като число (или null)",
      "available": true
    }
  ],
  "application_type": "Тип приложение - използвай ТОЧНО една от стойностите: 'Injectable', 'Intranasal', 'Topical', 'Oral', 'Injectable / Oral / Topical' (или null ако не е приложимо)",
  "inventory": "Препоръчително количество на склад като цяло число (напр. 50). ВИНАГИ задай положително число, минимум 10",
  "goals": "Цели/ефекти на продукта, разделени със запетая (на английски, напр. 'weight-loss, appetite-control, energy')",
  "target_profile": "Описание на идеалния потребител на продукта",
  "protocol_hint": "Техническа насока за протокол на прием (дозировка, цикличност, комбинации)",
  "safety_warnings": "Предупреждения за безопасност и противопоказания за системни данни"
}

ВАЖНО:
- Отговори САМО с валиден JSON обект
- Не добавяй коментари или друг текст извън JSON
- Използвай български език
- Бъди точен, грамотен и маркетингово компетентен
- Ако липсва информация за поле, използвай null или празен масив []
- Базирай се на твоите знания за подобни продукти
- За "variants": добави 1-3 типични разфасовки/вкуса ако продуктът обичайно се продава в такива; ако не, използвай []

КРИТИЧНО ВАЖНО - ПРАВИЛА ЗА ЛИПСВАЩА ИНФОРМАЦИЯ:
⚠️ НИКОГА не използвай думи като "неуточнено", "не е посочено", "липсва информация", "неизвестно" или подобни в полета за количества, опаковка или други данни
⚠️ Ако липсва информация за количества (capsules_or_grams, doses_per_package, amount), използвай null или празен низ ""
⚠️ Винаги бъди професионален и маркетингово компетентен - не пиши нищо, което би намалило доверието на клиента
⚠️ Ако не знаеш информация, по-добре е да оставиш полето празно (null или "") отколкото да пишеш нещо непрофесионално
✅ Добре: "capsules_or_grams": null или "capsules_or_grams": ""
❌ Лошо: "capsules_or_grams": "неуточнено" или "capsules_or_grams": "не е посочено"`;
}

// =======================================================
//          8. PROMO CODE MANAGEMENT FUNCTIONS
// =======================================================

function openPromoCodeModal(mode, promoData = null) {
    const isEdit = mode === 'edit';
    const title = isEdit ? 'Редакция на промо код' : 'Нов промо код';
    
    DOM.modal.title.textContent = title;
    
    const form = document.createElement('form');
    form.className = 'modal-form';
    form.innerHTML = `
        <div class="form-group">
            <label for="promo-code-input">Код *</label>
            <input type="text" id="promo-code-input" required value="${isEdit ? promoData.code : ''}" ${isEdit ? 'disabled' : ''}>
            ${isEdit ? '<small>Кодът не може да бъде променен</small>' : ''}
        </div>
        <div class="form-group">
            <label for="promo-discount">Отстъпка *</label>
            <input type="number" id="promo-discount" required min="0" max="100" value="${isEdit ? promoData.discount : ''}">
        </div>
        <div class="form-group">
            <label for="promo-discount-type">Тип отстъпка *</label>
            <select id="promo-discount-type">
                <option value="percentage" ${isEdit && promoData.discountType === 'percentage' ? 'selected' : ''}>Процент (%)</option>
                <option value="fixed" ${isEdit && promoData.discountType === 'fixed' ? 'selected' : ''}>Фиксирана сума (€)</option>
            </select>
        </div>
        <div class="form-group">
            <label for="promo-description">Описание</label>
            <textarea id="promo-description" rows="2">${isEdit ? (promoData.description || '') : ''}</textarea>
        </div>
        <div class="form-group">
            <label for="promo-valid-from">Валиден от</label>
            <input type="datetime-local" id="promo-valid-from" value="${isEdit && promoData.validFrom ? new Date(promoData.validFrom).toISOString().slice(0, 16) : ''}">
        </div>
        <div class="form-group">
            <label for="promo-valid-until">Валиден до</label>
            <input type="datetime-local" id="promo-valid-until" value="${isEdit && promoData.validUntil ? new Date(promoData.validUntil).toISOString().slice(0, 16) : ''}">
        </div>
        <div class="form-group">
            <label for="promo-max-uses">Максимален брой използвания</label>
            <input type="number" id="promo-max-uses" min="0" value="${isEdit && promoData.maxUses ? promoData.maxUses : ''}" placeholder="Празно = неограничено">
        </div>
        ${isEdit ? `
        <div class="form-group">
            <label for="promo-used-count">Текущ брой използвания</label>
            <input type="number" id="promo-used-count" min="0" value="${promoData.usedCount || 0}">
        </div>
        ` : ''}
        <div class="form-group">
            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                <input type="checkbox" id="promo-active" ${isEdit ? (promoData.active ? 'checked' : '') : 'checked'}>
                Активен
            </label>
        </div>
    `;
    
    DOM.modal.body.innerHTML = '';
    DOM.modal.body.appendChild(form);
    
    currentModalSaveCallback = async () => {
        const code = document.getElementById('promo-code-input').value.trim().toUpperCase();
        const discount = parseFloat(document.getElementById('promo-discount').value);
        const discountType = document.getElementById('promo-discount-type').value;
        const description = document.getElementById('promo-description').value.trim();
        const validFrom = document.getElementById('promo-valid-from').value;
        const validUntil = document.getElementById('promo-valid-until').value;
        const maxUses = document.getElementById('promo-max-uses').value;
        const active = document.getElementById('promo-active').checked;
        
        // Validation
        if (!code || isNaN(discount)) {
            alert('Моля, попълнете всички задължителни полета.');
            return false;
        }
        
        if (discount < 0) {
            alert('Отстъпката не може да бъде отрицателна.');
            return false;
        }
        
        if (discount === 0) {
            alert('Отстъпката трябва да е по-голяма от 0.');
            return false;
        }
        
        if (discountType === 'percentage' && discount > 100) {
            alert('Процентната отстъпка не може да е повече от 100%.');
            return false;
        }
        
        const promoPayload = {
            code,
            discount,
            discountType,
            description,
            validFrom: validFrom ? new Date(validFrom).toISOString() : null,
            validUntil: validUntil ? new Date(validUntil).toISOString() : null,
            maxUses: maxUses ? parseInt(maxUses) : null,
            active
        };
        
        if (isEdit) {
            promoPayload.id = promoData.id;
            promoPayload.usedCount = parseInt(document.getElementById('promo-used-count').value);
            await updatePromoCode(promoPayload);
        } else {
            await createPromoCode(promoPayload);
        }
        
        return true;
    };
    
    DOM.modal.container.classList.add('open');
    DOM.modal.backdrop.classList.add('open');
}

async function createPromoCode(promoData) {
    try {
        const response = await fetch(`${API_URL}/promo-codes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(promoData)
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Грешка при създаване на промо код');
        }
        
        showNotification('Промо кодът е създаден успешно!', 'success');
        await fetchPromoCodes();
        filterPromoCodes();
    } catch (error) {
        showNotification(error.message, 'error');
        console.error('Грешка при създаване на промо код:', error);
    }
}

async function updatePromoCode(promoData) {
    try {
        const response = await fetch(`${API_URL}/promo-codes`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(promoData)
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Грешка при актуализация на промо код');
        }
        
        showNotification('Промо кодът е актуализиран успешно!', 'success');
        await fetchPromoCodes();
        filterPromoCodes();
    } catch (error) {
        showNotification(error.message, 'error');
        console.error('Грешка при актуализация на промо код:', error);
    }
}

async function deletePromoCode(promoId) {
    try {
        const response = await fetch(`${API_URL}/promo-codes?id=${promoId}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Грешка при изтриване на промо код');
        }
        
        showNotification('Промо кодът е изтрит успешно!', 'success');
        await fetchPromoCodes();
        filterPromoCodes();
    } catch (error) {
        showNotification(error.message, 'error');
        console.error('Грешка при изтриване на промо код:', error);
    }
}

async function updatePromoCodeStatus(promoId, isActive) {
    try {
        const promo = promoCodesData.find(p => p.id === promoId);
        if (!promo) return;
        
        const response = await fetch(`${API_URL}/promo-codes`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: promoId,
                active: isActive
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Грешка при промяна на статус');
        }
        
        showNotification(`Промо кодът е ${isActive ? 'активиран' : 'деактивиран'}!`, 'success');
        await fetchPromoCodes();
        filterPromoCodes();
    } catch (error) {
        showNotification(error.message, 'error');
        console.error('Грешка при промяна на статус:', error);
        // Revert the toggle
        await fetchPromoCodes();
        filterPromoCodes();
    }
}

// =======================================================
//          9. ИНИЦИАЛИЗАЦИЯ НА ПРИЛОЖЕНИЕТО
// =======================================================

async function init() {
    initThemeToggle();
    setupEventListeners();
    populateAddComponentMenu();
    appData = await fetchData();
    await fetchOrders();
    await fetchContacts();
    await fetchPromoCodes();
    await loadAISettings();
    if (appData) {
        renderAll();
        renderPromoCodes();
        try {
            const savedTab = localStorage.getItem('adminActiveTab');
            if (savedTab) {
                const tabBtn = DOM.tabNav.querySelector(`[data-tab="${savedTab}"]`);
                const tabPane = document.getElementById(savedTab);
                if (tabBtn && tabPane) {
                    const currentActive = DOM.tabNav.querySelector('.active');
                    if (currentActive) currentActive.classList.remove('active');
                    tabBtn.classList.add('active');
                    DOM.tabPanes.forEach(pane => pane.classList.remove('active'));
                    tabPane.classList.add('active');
                }
            }
        } catch (e) {}
    } else {
        document.querySelector('.admin-container').innerHTML = '<h1>Грешка при зареждане на данните. Проверете конзолата.</h1>';
    }
}

// Старт на приложението
init();
