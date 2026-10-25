const API_BASE_URL = 'http://localhost:8080/api';

function escapeText(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
}

// Các thư mục con của từng cổng (cần '../' để quay về index.html)
const PORTAL_FOLDERS = ['/admin/', '/student/', '/lecturer/'];

function isInPortalFolder() {
    return PORTAL_FOLDERS.some(folder => window.location.pathname.includes(folder));
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    sessionStorage.removeItem('portal-toast');
    window.location.href = isInPortalFolder() ? '../index.html' : 'index.html';
}

// One HTTP request. List callers use the DB default (10) unless specified.
async function apiFetch(endpoint, options = {}) {
    const normalizedEndpoint = endpoint.startsWith('/api/')
        ? endpoint.slice(4)
        : endpoint.startsWith('/api')
            ? endpoint.slice(4) || '/'
            : endpoint.startsWith('/')
                ? endpoint
                : `/${endpoint}`;
    const token = localStorage.getItem('token');
    const headers = new Headers(options.headers || {});

    if (token) headers.set('Authorization', `Bearer ${token}`);

    const response = await fetch(`${API_BASE_URL}${normalizedEndpoint}`, {
        ...options,
        headers
    });

    if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        if (isInPortalFolder()) {
            window.location.href = '../index.html';
        } else if (window.location.pathname !== '/' && !window.location.pathname.endsWith('/index.html')) {
            window.location.href = 'index.html';
        }
    }

    return response;
}

// Explicit opt-in for selectors and lookup data that require a complete list.
async function apiFetchAll(endpoint, options = {}) {
    const response = await apiFetch(endpoint, options);
    if ((options.method || 'GET').toUpperCase() !== 'GET' || !response.ok) return response;

    const separator = endpoint.indexOf('?');
    const pathname = separator < 0 ? endpoint : endpoint.slice(0, separator);
    const query = new URLSearchParams(separator < 0 ? '' : endpoint.slice(separator + 1));
    if (query.has('page') || query.get('limit') === '-1') return response;

    let payload;
    try {
        payload = await response.clone().json();
    } catch {
        return response;
    }
    if (payload?.success === false || !Array.isArray(payload?.data) || !payload.pagination?.hasNext) return response;

    const all = [...payload.data];
    let pagination = payload.pagination;
    let loadedPages = 1;
    while (pagination.hasNext) {
        if (!Number.isInteger(pagination.page) || !Number.isInteger(pagination.size)
                || pagination.page < 0 || pagination.size < 1) {
            throw new Error('Thông tin phân trang không hợp lệ. Vui lòng tải lại danh sách.');
        }
        const nextPage = pagination.page + 1;
        query.set('page', String(nextPage));
        query.set('limit', String(pagination.size));
        const nextResponse = await apiFetch(`${pathname}?${query.toString()}`, options);
        // Never present an incomplete array as a successful complete result.
        if (!nextResponse.ok) return nextResponse;
        const next = await nextResponse.json();
        if (next?.success === false || !Array.isArray(next?.data)
                || typeof next.pagination?.hasNext !== 'boolean'
                || next.pagination?.page !== nextPage || (next.pagination.hasNext && !next.data.length)) {
            throw new Error(next.message || 'Không tải đủ các trang dữ liệu. Vui lòng thử lại.');
        }
        all.push(...next.data);
        pagination = next.pagination;
        loadedPages++;
    }
    const headers = new Headers(response.headers);
    headers.set('Content-Type', 'application/json; charset=UTF-8');
    headers.delete('Content-Length');
    headers.delete('Content-Encoding');
    return new Response(JSON.stringify({ ...payload, data: all,
        pagination: { ...pagination, loadedPages, allPagesLoaded: true }
    }), { status: response.status, statusText: response.statusText, headers });
}

const serverPaginationStates = new WeakMap();

function getServerPagination(target) { return serverPaginationStates.get(target); }

function hideServerPagination(targetId) {
    const target = document.getElementById(targetId);
    const state = target && serverPaginationStates.get(target);
    if (state) { state.controls.hidden = true; state.page = 0; state.key = ''; }
}

// Tables and card lists fetch only the selected server page; filter changes reset page 0.
async function apiFetchTable(endpoint, options, targetId, reload) {
    const target = document.getElementById(targetId);
    if (!target) throw new Error('Không tìm thấy vùng hiển thị danh sách.');
    const anchor = target.closest('table') || target;
    if (anchor.tagName === 'TABLE') anchor.dataset.serverPagination = 'true';
    let state = serverPaginationStates.get(target);
    if (!state) {
        const controls = document.createElement('div');
        controls.className = 'table-pagination';
        controls.setAttribute('role', 'group');
        controls.setAttribute('aria-label', 'Phân trang từ máy chủ');
        anchor.after(controls);
        state = { page: 0, limit: 10, key: '', totalElements: 0, totalPages: 0, busy: false, controls };
        serverPaginationStates.set(target, state);
    }
    if (state.key !== endpoint) { state.page = 0; state.key = endpoint; }
    state.reload = reload;

    const draw = () => {
        const controls = state.controls;
        controls.replaceChildren();
        controls.hidden = state.totalPages < 1;
        const summary = document.createElement('span');
        summary.className = 'table-pagination-summary';
        summary.setAttribute('aria-live', 'polite');
        summary.textContent = `${state.totalElements} dòng · Trang ${state.page + 1}/${Math.max(1, state.totalPages)}`;
        controls.append(summary);
        const navigation = document.createElement('nav');
        navigation.className = 'table-pagination-pages';
        navigation.setAttribute('aria-label', 'Chọn trang của danh sách');
        controls.append(navigation);
        const button = (label, page, disabled, current = false) => {
            const element = document.createElement('button');
            element.type = 'button';
            element.className = 'table-pagination-button';
            element.textContent = label;
            element.disabled = state.busy || disabled;
            if (current) element.setAttribute('aria-current', 'page');
            element.addEventListener('click', async () => {
                if (state.busy) return;
                state.page = page;
                await state.reload();
                controls.querySelector('[aria-current="page"]')?.focus();
            });
            navigation.append(element);
        };
        button('Trước', state.page - 1, state.page === 0);
        const first = Math.max(0, Math.min(state.page - 2, state.totalPages - 5));
        for (let page = first; page < Math.min(state.totalPages, first + 5); page++) {
            button(String(page + 1), page, false, page === state.page);
        }
        button('Sau', state.page + 1, state.page + 1 >= state.totalPages);
    };

    const version = (state.version || 0) + 1;
    state.version = version;
    state.busy = true;
    draw();
    const separator = endpoint.indexOf('?');
    const path = separator < 0 ? endpoint : endpoint.slice(0, separator);
    const query = new URLSearchParams(separator < 0 ? '' : endpoint.slice(separator + 1));
    query.set('page', String(state.page));
    query.set('limit', '10');
    try {
        state.active = apiFetch(`${path}?${query}`, options).then(async response => ({
            response, result: await response.clone().json()
        }));
        const { response, result } = await state.active;
        if (state.version !== version) {
            const latest = await state.active;
            return new Response(JSON.stringify(latest.result), {
                status: latest.response.status, headers: { 'Content-Type': 'application/json' }
            });
        }
        if (response.ok && result.success !== false && result.pagination) {
            state.totalElements = result.pagination.totalElements;
            state.totalPages = result.pagination.totalPages;
            if (state.totalPages > 0 && state.page >= state.totalPages) {
                state.page = state.totalPages - 1;
                return await apiFetchTable(endpoint, options, targetId, reload);
            }
        } else {
            state.totalPages = 0;
        }
        return response;
    } catch (error) {
        if (state.version === version) state.totalPages = 0;
        throw error;
    } finally {
        if (state.version === version) { state.busy = false; draw(); }
    }
}

function debounce(callback, delay = 250) {
    let timer;
    return (...args) => { clearTimeout(timer); timer = setTimeout(() => callback(...args), delay); };
}

function populateFilterOptions(select, values, placeholder, formatLabel = value => value, defaultValue = '') {
    if (!select || select.options.length > 1) return;

    const options = [...new Set(values.filter(value => value != null && value !== '' && value !== defaultValue))];
    select.replaceChildren(
        new Option(placeholder, defaultValue),
        ...options.map(value => new Option(formatLabel(value), value))
    );
}

function removeVietnameseTones(str) {
    if (!str) return '';
    return str
        .toString()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'd')
        .toLowerCase()
        .trim();
}

window.removeVietnameseTones = removeVietnameseTones;

function normalizeSelectSearchText(value) {
    return removeVietnameseTones(value);
}

function enhanceSelect(select) {
    if (select.hasAttribute('data-native-select')) return;
    if (select.closest('.swal2-container')) return;
    if (select.dataset.searchableSelect === 'true' || select.multiple) return;
    select.dataset.searchableSelect = 'true';

    const wrapper = document.createElement('div');
    wrapper.className = 'searchable-select';
    if (select.style.width) wrapper.style.width = select.style.width;
    if (select.style.minWidth) wrapper.style.minWidth = select.style.minWidth;
    if (select.style.maxWidth) wrapper.style.maxWidth = select.style.maxWidth;

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'searchable-select-trigger';
    trigger.setAttribute('role', 'combobox');
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');

    const label = document.createElement('span');
    label.className = 'searchable-select-label';

    const arrow = document.createElement('span');
    arrow.className = 'searchable-select-arrow';
    arrow.setAttribute('aria-hidden', 'true');

    trigger.append(label, arrow);

    const dropdown = document.createElement('div');
    dropdown.className = 'searchable-select-dropdown';

    const search = document.createElement('input');
    search.type = 'search';
    search.className = 'searchable-select-search';
    search.placeholder = 'Tìm kiếm...';
    search.setAttribute('aria-label', 'Tìm kiếm lựa chọn');
    search.autocomplete = 'off';

    const optionsList = document.createElement('div');
    optionsList.className = 'searchable-select-options';
    optionsList.setAttribute('role', 'listbox');

    dropdown.append(search, optionsList);

    select.parentNode.insertBefore(wrapper, select);
    wrapper.append(select, trigger, dropdown);
    select.classList.add('searchable-select-native');
    select.setAttribute('aria-hidden', 'true');
    select.tabIndex = -1;

    function renderOptions() {
        const selectedOption = select.options[select.selectedIndex];
        label.textContent = selectedOption ? selectedOption.textContent.trim() : '';
        trigger.disabled = select.disabled;
        trigger.setAttribute('aria-label', label.textContent || 'Chọn một mục');

        optionsList.replaceChildren();
        [...select.options].forEach(option => {
            if (option.hidden) return;

            const item = document.createElement('button');
            item.type = 'button';
            item.className = 'searchable-select-option';
            item.textContent = option.textContent.trim();
            item.disabled = option.disabled || select.disabled;
            item.setAttribute('role', 'option');
            item.setAttribute('aria-selected', String(option.selected));

            const query = normalizeSelectSearchText(search.value);
            const searchableText = normalizeSelectSearchText(option.textContent);
            item.hidden = Boolean(query) && !searchableText.includes(query);
            item.classList.toggle('selected', option.selected);

            item.addEventListener('click', () => {
                select.value = option.value;
                select.dispatchEvent(new Event('input', { bubbles: true }));
                select.dispatchEvent(new Event('change', { bubbles: true }));
                renderOptions();
                closeDropdown();
                trigger.focus();
            });

            optionsList.append(item);
        });

        const hasVisibleOption = [...optionsList.children].some(item => !item.hidden);
        let emptyMessage = optionsList.querySelector('.searchable-select-empty');
        if (!hasVisibleOption) {
            if (!emptyMessage) {
                emptyMessage = document.createElement('div');
                emptyMessage.className = 'searchable-select-empty';
                emptyMessage.textContent = 'Không tìm thấy lựa chọn phù hợp';
                optionsList.append(emptyMessage);
            }
        } else {
            emptyMessage?.remove();
        }
    }

    function closeDropdown() {
        dropdown.classList.remove('open');
        trigger.setAttribute('aria-expanded', 'false');
    }

    function openDropdown() {
        document.querySelectorAll('.searchable-select-dropdown.open').forEach(openMenu => {
            if (openMenu !== dropdown) {
                openMenu.classList.remove('open');
                openMenu.previousElementSibling?.setAttribute('aria-expanded', 'false');
            }
        });
        renderOptions();
        dropdown.classList.add('open');
        trigger.setAttribute('aria-expanded', 'true');
        search.value = '';
        renderOptions();
        search.focus();
    }

    trigger.addEventListener('click', () => {
        if (dropdown.classList.contains('open')) {
            closeDropdown();
        } else {
            openDropdown();
        }
    });

    search.addEventListener('input', renderOptions);
    search.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
            closeDropdown();
            trigger.focus();
        } else if (event.key === 'Enter') {
            const firstVisibleOption = [...optionsList.querySelectorAll('.searchable-select-option')]
                .find(item => !item.hidden && !item.disabled);
            if (firstVisibleOption) firstVisibleOption.click();
        }
    });

    select.labels?.forEach(labelElement => {
        labelElement.addEventListener('click', event => {
            event.preventDefault();
            if (!trigger.disabled) openDropdown();
        });
    });

    select.addEventListener('change', renderOptions);
    // Assigning a native select value does not emit change. Keep its visible
    // control in sync when API data or a filter reset sets the value directly.
    for (const property of ['value', 'selectedIndex']) {
        const descriptor = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, property);
        Object.defineProperty(select, property, {
            configurable: true,
            get() { return descriptor.get.call(this); },
            set(value) {
                descriptor.set.call(this, value);
                renderOptions();
            }
        });
    }
    select.form?.addEventListener('reset', () => {
        // The reset event fires before the browser restores default values.
        queueMicrotask(() => { search.value = ''; closeDropdown(); renderOptions(); });
    });
    select.addEventListener('invalid', () => {
        openDropdown();
        trigger.focus();
    });

    new MutationObserver(renderOptions).observe(select, {
        attributes: true,
        childList: true,
        subtree: true,
        characterData: true
    });

    renderOptions();
}

function enhancePageSelects(root = document) {
    if (root.matches?.('select')) enhanceSelect(root);
    root.querySelectorAll?.('select').forEach(enhanceSelect);
}

function initializeSearchableSelects() {
    enhancePageSelects();
    new MutationObserver(mutations => {
        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === Node.ELEMENT_NODE) enhancePageSelects(node);
            });
        });
    }).observe(document.body, { childList: true, subtree: true });

    document.addEventListener('click', event => {
        if (!event.target.closest('.searchable-select')) {
            document.querySelectorAll('.searchable-select-dropdown.open').forEach(dropdown => {
                dropdown.classList.remove('open');
                dropdown.previousElementSibling?.setAttribute('aria-expanded', 'false');
            });
        }
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeSearchableSelects, { once: true });
} else {
    initializeSearchableSelects();
}

function initializeResponsiveLayout() {
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
        sidebar.id ||= 'portal-navigation';
        const toolbar = document.createElement('div');
        toolbar.className = 'mobile-toolbar';
        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'mobile-menu-toggle';
        toggle.textContent = '☰ Menu';
        toggle.setAttribute('aria-controls', sidebar.id);
        toggle.setAttribute('aria-expanded', 'false');
        toolbar.append(toggle);
        document.body.prepend(toolbar);
        const backdrop = document.createElement('div');
        backdrop.className = 'sidebar-backdrop';
        backdrop.hidden = true;
        document.body.append(backdrop);
        const mobile = matchMedia('(max-width: 960px)');
        function setOpen(open, restoreFocus = false) {
            document.body.classList.toggle('navigation-open', open);
            toggle.setAttribute('aria-expanded', String(open));
            backdrop.hidden = !open;
            sidebar.inert = mobile.matches && !open;
            if (open) sidebar.querySelector('a, button')?.focus();
            else if (restoreFocus) toggle.focus();
        }
        toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
        backdrop.addEventListener('click', () => setOpen(false, true));
        sidebar.addEventListener('click', event => {
            if (event.target.closest('a') && mobile.matches) setOpen(false);
        });
        document.addEventListener('keydown', event => {
            if (!document.body.classList.contains('navigation-open')) return;
            if (event.key === 'Escape') setOpen(false, true);
            if (event.key === 'Tab') {
                const links = [...sidebar.querySelectorAll('a[href], button:not(:disabled)')]
                    .filter(element => element.getClientRects().length);
                const first = links[0], last = links.at(-1);
                if (event.shiftKey && document.activeElement === first) {
                    event.preventDefault(); toggle.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault(); toggle.focus();
                } else if (document.activeElement === toggle) {
                    event.preventDefault(); (event.shiftKey ? last : first)?.focus();
                }
            }
        });
        mobile.addEventListener('change', () => setOpen(false));
        setOpen(false);
    }
    function wrapTables() {
        document.querySelectorAll('.main-wrapper table, .modal table').forEach(table => {
            if (table.closest('.table-scroll')) return;
            const scroll = document.createElement('div');
            scroll.className = 'table-scroll';
            scroll.tabIndex = 0;
            scroll.setAttribute('role', 'region');
            scroll.setAttribute('aria-label', 'Bảng dữ liệu, cuộn ngang để xem thêm');
            table.before(scroll);
            scroll.append(table);
        });
    }
    wrapTables();
    new MutationObserver(wrapTables).observe(document.body, {childList: true, subtree: true});
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeResponsiveLayout, {once: true});
} else {
    initializeResponsiveLayout();
}
