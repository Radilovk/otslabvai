// =======================================================
//          1. ИНИЦИАЛИЗАЦИЯ И СЪСТОЯНИЕ
// =======================================================

// API Endpoint
import { API_URL } from './config.js';

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
    }
};

// Глобално състояние
let appData = {};
let ordersData = [];
let filteredOrdersData = [];
let contactsData = [];
let filteredContactsData = [];
let unsavedChanges = false;
let activeUndoAction = null;
let currentModalSaveCallback = null;

// =======================================================
//          2. API КОМУНИКАЦИЯ
// =======================================================

async function fetchData() {
    try {
        // For admin panel, use no-cache to ensure fresh data when explicitly refreshing
        const response = await fetch(`${API_URL}/page_content.json`, {
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

async function fetchContacts() {
    try {
        // For dynamic data like contacts, use no-cache to always get fresh data
        const response = await fetch(`${API_URL}/contacts`, {
            cache: 'no-cache'
        });
        if (!response.ok) throw new Error(`HTTP грешка! Статус: ${response.status}`);
        const rawContacts = await response.json();
        contactsData = rawContacts.map((contact, index) => ({ ...contact, id: contact.id || `contact_${index}_${Date.now()}` }));
        filteredContactsData = [...contactsData];
    } catch (error) {
        showNotification('Грешка при зареждане на контактите.', 'error');
        console.error("Грешка при зареждане на контакти:", error);
        contactsData = [];
        filteredContactsData = [];
    }
}

async function saveData() {
    if (!unsavedChanges) return;

    DOM.saveBtn.disabled = true;
    DOM.saveStatus.textContent = 'Записване...';
    DOM.saveStatus.className = 'save-status is-saving';

    try {
        const response = await fetch(`${API_URL}/page_content.json`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(appData, null, 2)
        });

        if (response.ok) {
            setUnsavedChanges(false);
            showNotification('Промените са записани успешно.', 'success');
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
        const item = createListItem({
            id: component.component_id,
            type: componentTypes[component.type] || component.type,
            title: component.title,
            actions: [
                { label: 'Редактирай', action: 'edit-component', class: 'btn-secondary' },
                { label: 'Изтрий', action: 'delete-component', class: 'btn-danger' }
            ]
        });
        DOM.pageBuilderList.appendChild(item);
    });
    initSortable(DOM.pageBuilderList, appData.page_content);
}

function renderFooter() {
    DOM.footerSettingsContainer.innerHTML = '';
     const item = createListItem({
        type: 'Copyright',
        title: appData.footer.copyright_text,
        actions: [
            { label: 'Редактирай', action: 'edit-footer', class: 'btn-secondary' }
        ]
    });
    item.querySelector('.handle').style.display = 'none';
    DOM.footerSettingsContainer.appendChild(item);
}

function renderOrders() {
    DOM.ordersTableBody.innerHTML = '';
    filteredOrdersData.forEach((order) => {
        const rowTemplate = DOM.templates.orderRow.content.cloneNode(true);
        const customer = order.customer || {};
        const products = (order.products || []).map(p => `${p.name} x${p.quantity}`).join('<br>');
        const originalIndex = ordersData.findIndex(o => o.id === order.id);
        const row = rowTemplate.querySelector('tr');
        row.dataset.index = originalIndex;
        rowTemplate.querySelector('.order-customer').textContent = `${customer.firstName || ''} ${customer.lastName || ''}`;
        rowTemplate.querySelector('.order-phone').textContent = customer.phone || '';
        rowTemplate.querySelector('.order-email').textContent = customer.email || '';
        rowTemplate.querySelector('.order-products').innerHTML = products;
        
        // Format delivery information
        let deliveryInfo = '';
        if (customer.deliveryMethod === 'courier') {
            deliveryInfo = `${customer.courierCompany || 'Куриер'}<br>`;
            if (customer.courierOfficeName) {
                deliveryInfo += customer.courierOfficeName;
            }
            if (customer.courierOfficeAddress) {
                deliveryInfo += `<br><small>${customer.courierOfficeAddress}</small>`;
            }
        } else {
            // Personal address delivery
            deliveryInfo = 'До адрес<br>';
            if (customer.address) deliveryInfo += `${customer.address}<br>`;
            if (customer.city) deliveryInfo += `${customer.city}`;
            if (customer.postcode) deliveryInfo += `, ${customer.postcode}`;
        }
        rowTemplate.querySelector('.order-delivery').innerHTML = deliveryInfo;
        
        const statusSelect = rowTemplate.querySelector('.order-status');
        statusSelect.value = order.status || 'Нова';
        DOM.ordersTableBody.appendChild(rowTemplate);
    });
}

function renderContacts() {
    DOM.contactsTableBody.innerHTML = '';
    filteredContactsData.forEach((contact) => {
        const rowTemplate = DOM.templates.contactRow.content.cloneNode(true);
        const originalIndex = contactsData.findIndex(c => c.id === contact.id);
        const row = rowTemplate.querySelector('tr');
        row.dataset.index = originalIndex;
        
        rowTemplate.querySelector('.contact-name').textContent = contact.name || '';
        rowTemplate.querySelector('.contact-email').textContent = contact.email || '';
        rowTemplate.querySelector('.contact-subject').textContent = contact.subject || '(няма тема)';
        
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
        rowTemplate.querySelector('.contact-date').textContent = formattedDate;
        
        const statusSelect = rowTemplate.querySelector('.contact-status');
        statusSelect.value = contact.status || 'Нов';
        
        DOM.contactsTableBody.appendChild(rowTemplate);
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
    console.log('[serializeForm] Starting form serialization');
    form.querySelectorAll('[data-field]').forEach(input => {
        // Пропускаме полета от шаблони за вложени елементи
        if (input.closest('.nested-item-template, .nested-sub-item-template')) return;

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
        if (path === 'title') {
            console.log('[serializeForm] Found title field with value:', value);
        }
        setProperty(data, path, value);
    });
    console.log('[serializeForm] Serialized data:', data);

    // Специално за продуктова категория - събира данните от всички продукти
    const productsContainer = form.querySelector('#products-editor');
    if (productsContainer) {
        data.products = [];
        productsContainer.querySelectorAll(':scope > .nested-item[data-type="product"]').forEach(productNode => {
            const productData = {};
            // Сериализираме основните полета на продукта
            productNode.querySelectorAll('[data-field]').forEach(input => {
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

            // Сериализираме вложените списъци
            ['effects', 'about-benefits', 'ingredients', 'faq'].forEach(subListName => {
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
                    }
                    
                    subContainer.querySelectorAll(`:scope > .nested-sub-item[data-type="${dataType}"]`).forEach(subItemNode => {
                        const subItemData = {};
                        subItemNode.querySelectorAll('[data-field]').forEach(input => {
                            subItemData[input.dataset.field] = (input.type === 'number' ? (input.value ? parseFloat(input.value) : null) : input.value);
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
                if(Array.isArray(value)) {
                    input.value = value.join(', ');
                } else {
                    input.value = value;
                }
            }
        });
        // Попълваме вложените списъци
        ['effects', 'about-benefits', 'ingredients', 'faq'].forEach(subListName => {
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

    DOM.modal.saveBtn.addEventListener('click', () => {
        if (currentModalSaveCallback) {
            const form = DOM.modal.body.querySelector('form');
            if (form) {
                const success = currentModalSaveCallback(form);
                if (success) {
                    setUnsavedChanges(true);
                    renderAll();
                    closeModal();
                }
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
    });

    DOM.saveBtn.addEventListener('click', saveData);

    DOM.ordersTableBody.addEventListener('change', async e => {
        if (!e.target.classList.contains('order-status')) return;
        const row = e.target.closest('tr');
        const index = Number(row.dataset.index);
        const newStatus = e.target.value;
        ordersData[index].status = newStatus;
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
    
    DOM.orderSearchInput.addEventListener('input', () => filterOrders());
    DOM.refreshOrdersBtn.addEventListener('click', async () => {
        showNotification('Опресняване на поръчките...', 'info');
        await fetchOrders();
        filterOrders();
    });
    
    DOM.contactsTableBody.addEventListener('change', async e => {
        if (!e.target.classList.contains('contact-status')) return;
        const row = e.target.closest('tr');
        const index = Number(row.dataset.index);
        const newStatus = e.target.value;
        contactsData[index].status = newStatus;
        // Note: We're updating status locally, but there's no PUT endpoint for contacts
        // If needed, you could add one similar to orders
        showNotification('Статусът е обновен локално.', 'success');
    });
    
    DOM.contactSearchInput.addEventListener('input', () => filterContacts());
    DOM.refreshContactsBtn.addEventListener('click', async () => {
        showNotification('Опресняване на контактите...', 'info');
        await fetchContacts();
        filterContacts();
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
                    console.log('Updating component:', component.component_id, 'with data:', updatedData);
                    // Explicitly preserve title if it exists in updatedData
                    if (updatedData.title !== undefined && updatedData.title !== '') {
                        console.log('Title being updated from:', component.title, 'to:', updatedData.title);
                    }
                    Object.assign(component, updatedData);
                    console.log('Component after update:', component);
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
        case 'ai-assistant': {
            const productEditor = target.closest('.nested-item[data-type="product"]');
            if (!productEditor) return;
            
            handleAIAssistant(productEditor);
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

function filterOrders() {
    const searchTerm = DOM.orderSearchInput.value.toLowerCase().trim();
    if (!searchTerm) {
        filteredOrdersData = [...ordersData];
    } else {
        filteredOrdersData = ordersData.filter(order => {
            const customer = order.customer || {};
            const fullName = `${customer.firstName || ''} ${customer.lastName || ''}`.toLowerCase();
            const phone = (customer.phone || '').toLowerCase();
            const email = (customer.email || '').toLowerCase();
            return fullName.includes(searchTerm) || phone.includes(searchTerm) || email.includes(searchTerm);
        });
    }
    renderOrders();
}

function filterContacts() {
    const searchTerm = DOM.contactSearchInput.value.toLowerCase().trim();
    if (!searchTerm) {
        filteredContactsData = [...contactsData];
    } else {
        filteredContactsData = contactsData.filter(contact => {
            const name = (contact.name || '').toLowerCase();
            const email = (contact.email || '').toLowerCase();
            const subject = (contact.subject || '').toLowerCase();
            const message = (contact.message || '').toLowerCase();
            return name.includes(searchTerm) || email.includes(searchTerm) || 
                   subject.includes(searchTerm) || message.includes(searchTerm);
        });
    }
    renderContacts();
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
        
        // Основни полета
        fillField('[data-field="public_data.name"]', aiData.name);
        fillField('[data-field="public_data.price"]', aiData.price);
        fillField('[data-field="public_data.tagline"]', aiData.tagline);
        fillField('[data-field="public_data.description"]', aiData.description);
        
        // Опаковка
        if (aiData.packaging_info) {
            fillField('[data-field="public_data.packaging.capsules_or_grams"]', aiData.packaging_info.capsules_or_grams);
            fillField('[data-field="public_data.packaging.doses_per_package"]', aiData.packaging_info.doses_per_package);
        }
        
        // Системни данни
        fillField('[data-field="system_data.manufacturer"]', aiData.manufacturer);
        
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
            maxTokens: 4096,
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
        'google': 'gemini-pro'
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
  "manufacturer": "Производител (ако е известен)",
  "price": "Приблизителна цена в лева като число (или null ако не знаеш)",
  "tagline": "Кратък маркетингов слоган (до 60 символа)",
  "description": "Подробно маркетингово описание (100-200 думи)",
  "packaging_info": {
    "capsules_or_grams": "Брой капсули или грамаж",
    "doses_per_package": "Брой дози в опаковка"
  },
  "effects": [
    {
      "label": "Ефект 1",
      "value": "Стойност от 0 до 10"
    },
    {
      "label": "Ефект 2", 
      "value": "Стойност от 0 до 10"
    },
    {
      "label": "Ефект 3",
      "value": "Стойност от 0 до 10"
    }
  ],
  "about_content": {
    "title": "За продукта",
    "description": "Подробно описание",
    "benefits": [
      {
        "icon": "✓",
        "text": "Полза 1"
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
  "faq": [
    {
      "question": "Често задаван въпрос 1",
      "answer": "Отговор"
    }
  ]
}

ВАЖНО:
- Отговори САМО с валиден JSON обект
- Не добавяй коментари или друг текст извън JSON
- Използвай български език
- Бъди точен, грамотен и маркетингово компетентен
- Ако липсва информация за поле, използвай null или празен масив []
- Базирай се на твоите знания за подобни продукти`;
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
    await loadAISettings();
    if (appData) {
        renderAll();
    } else {
        document.querySelector('.admin-container').innerHTML = '<h1>Грешка при зареждане на данните. Проверете конзолата.</h1>';
    }
}

// Старт на приложението
init();
