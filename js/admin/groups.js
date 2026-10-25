function getToken() {
    return localStorage.getItem('token');
}

let registrationPeriods = [];
let groupStatuses = [];
let selectedPeriodId = '';
let selectedStatus = '';

let filterPeriodSearchQuery = '';
let filterStatusSearchQuery = '';

function safeRemoveTones(str) {
    if (typeof window.removeVietnameseTones === 'function') {
        return window.removeVietnameseTones(str);
    }
    return (str || '').toLowerCase();
}

document.addEventListener('DOMContentLoaded', () => {
    setupDropdownEvents();
    loadRegistrationPeriodsDropdown();
    loadGroups();

    document.getElementById('filterGroupForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        loadGroups();
    });
});

function setupDropdownEvents() {
    setupSingleSelectDropdown({
        containerId: 'filterPeriodContainer',
        triggerId: 'filterPeriodTrigger',
        dropdownId: 'filterPeriodDropdown',
        searchInputId: 'filterPeriodSearchInput',
        onSearch: (q) => {
            filterPeriodSearchQuery = q;
            renderPeriodDropdown();
        }
    });

    setupSingleSelectDropdown({
        containerId: 'filterStatusContainer',
        triggerId: 'filterStatusTrigger',
        dropdownId: 'filterStatusDropdown',
        searchInputId: 'filterStatusSearchInput',
        onSearch: (q) => {
            filterStatusSearchQuery = q;
            renderStatusDropdown();
        }
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('#filterPeriodContainer')) {
            document.getElementById('filterPeriodDropdown')?.classList.remove('open');
        }
        if (!e.target.closest('#filterStatusContainer')) {
            document.getElementById('filterStatusDropdown')?.classList.remove('open');
        }
    });
}

function setupSingleSelectDropdown({ containerId, triggerId, dropdownId, searchInputId, onSearch }) {
    const trigger = document.getElementById(triggerId);
    const dropdown = document.getElementById(dropdownId);
    const searchInput = document.getElementById(searchInputId);

    if (!trigger || !dropdown) return;

    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = dropdown.classList.contains('open');
        document.querySelectorAll('.custom-multiselect-dropdown.open').forEach(d => {
            if (d !== dropdown) d.classList.remove('open');
        });

        if (isOpen) {
            dropdown.classList.remove('open');
        } else {
            dropdown.classList.add('open');
            if (searchInput) {
                searchInput.value = '';
                if (onSearch) onSearch('');
                setTimeout(() => searchInput.focus(), 50);
            }
        }
    });

    if (searchInput) {
        searchInput.addEventListener('click', (e) => e.stopPropagation());
        searchInput.addEventListener('input', (e) => {
            if (onSearch) onSearch(e.target.value.trim());
        });
    }
}

// 1. TẢI DROPDOWN ĐỢT ĐĂNG KÝ
async function loadRegistrationPeriodsDropdown() {
    try {
        const response = await apiFetchAll(`/registration-periods`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        const result = await response.json();
        if (!response.ok || !result.success) {
            throw new Error(result.message || 'Không thể tải danh sách đợt đăng ký.');
        }
        registrationPeriods = result.data || [];
        renderPeriodDropdown();
    } catch (err) {
        console.error('Lỗi load periods dropdown:', err);
        await showAlert(err.message || 'Không thể tải danh sách đợt đăng ký.');
    }
}

function renderPeriodDropdown() {
    const label = document.getElementById('filterPeriodLabel');
    const optionsContainer = document.getElementById('filterPeriodOptionsList');
    if (!label || !optionsContainer) return;

    const currentPeriod = registrationPeriods.find(p => String(p.id) === String(selectedPeriodId));
    if (currentPeriod) {
        label.textContent = currentPeriod.name || currentPeriod.title || `Đợt ${currentPeriod.id}`;
        label.classList.remove('placeholder');
    } else {
        label.textContent = '-- Tất cả đợt đăng ký --';
        label.classList.add('placeholder');
    }

    const query = safeRemoveTones(filterPeriodSearchQuery);
    const filtered = registrationPeriods.filter(p => {
        const title = safeRemoveTones(p.name || p.title || `Đợt ${p.id}`);
        return !query || title.includes(query);
    });

    let html = `
        <div class="select-option-item ${!selectedPeriodId ? 'selected' : ''}" onclick="selectPeriodFilter('')">
            <span>-- Tất cả đợt đăng ký --</span>
        </div>
    `;

    if (filtered.length === 0 && query) {
        html += '<div class="select-option-empty">Không tìm thấy đợt đăng ký nào</div>';
    } else {
        html += filtered.map(p => {
            const isSelected = String(p.id) === String(selectedPeriodId);
            return `
                <div class="select-option-item ${isSelected ? 'selected' : ''}" onclick="selectPeriodFilter('${p.id}')">
                    <span>${p.name || p.title || `Đợt ${p.id}`}</span>
                </div>
            `;
        }).join('');
    }

    optionsContainer.innerHTML = html;
}

function selectPeriodFilter(id) {
    selectedPeriodId = String(id || '');
    const hidden = document.getElementById('filterPeriod');
    if (hidden) hidden.value = selectedPeriodId;
    document.getElementById('filterPeriodDropdown')?.classList.remove('open');
    renderPeriodDropdown();
    loadGroups();
}

function updateStatusListFromGroups(groups) {
    const statusMap = {
        'FORMING': 'Đang lập nhóm (FORMING)',
        'REGISTERED': 'Đã đăng ký ĐT (REGISTERED)',
        'APPROVED': 'Đã duyệt ĐT (APPROVED)',
        'IN_PROGRESS': 'Đang thực hiện (IN_PROGRESS)',
        'SUBMITTED': 'Đã nộp báo cáo (SUBMITTED)',
        'DEFENDED': 'Đã bảo vệ (DEFENDED)',
        'COMPLETED': 'Hoàn thành (COMPLETED)'
    };

    const detected = new Set(groups.map(g => g.status).filter(Boolean));
    Object.keys(statusMap).forEach(s => detected.add(s));

    groupStatuses = Array.from(detected).map(s => ({
        value: s,
        label: statusMap[s] || s.replace(/_/g, ' ')
    }));

    renderStatusDropdown();
}

function renderStatusDropdown() {
    const label = document.getElementById('filterStatusLabel');
    const optionsContainer = document.getElementById('filterStatusOptionsList');
    if (!label || !optionsContainer) return;

    const currentStatus = groupStatuses.find(s => s.value === selectedStatus);
    if (currentStatus) {
        label.textContent = currentStatus.label;
        label.classList.remove('placeholder');
    } else {
        label.textContent = '-- Tất cả trạng thái --';
        label.classList.add('placeholder');
    }

    const query = safeRemoveTones(filterStatusSearchQuery);
    const filtered = groupStatuses.filter(s => {
        const text = safeRemoveTones(s.label + ' ' + s.value);
        return !query || text.includes(query);
    });

    let html = `
        <div class="select-option-item ${!selectedStatus ? 'selected' : ''}" onclick="selectStatusFilter('')">
            <span>-- Tất cả trạng thái --</span>
        </div>
    `;

    if (filtered.length === 0 && query) {
        html += '<div class="select-option-empty">Không tìm thấy trạng thái nào</div>';
    } else {
        html += filtered.map(s => {
            const isSelected = s.value === selectedStatus;
            return `
                <div class="select-option-item ${isSelected ? 'selected' : ''}" onclick="selectStatusFilter('${s.value}')">
                    <span>${s.label}</span>
                </div>
            `;
        }).join('');
    }

    optionsContainer.innerHTML = html;
}

function selectStatusFilter(val) {
    selectedStatus = String(val || '');
    const hidden = document.getElementById('filterStatus');
    if (hidden) hidden.value = selectedStatus;
    document.getElementById('filterStatusDropdown')?.classList.remove('open');
    renderStatusDropdown();
    loadGroups();
}

// 2. TẢI DANH SÁCH NHÓM (GET /api/groups?periodId=...&status=...)
async function loadGroups() {
    const periodId = document.getElementById('filterPeriod')?.value || selectedPeriodId || '';
    const status = document.getElementById('filterStatus')?.value || selectedStatus || '';

    let queryParams = [];
    if (periodId) queryParams.push(`periodId=${encodeURIComponent(periodId)}`);
    if (status) queryParams.push(`status=${encodeURIComponent(status)}`);
    const queryString = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';

    const tbody = document.getElementById('groupTableBody');
    if (tbody) {
        tbody.innerHTML = '<tr><td colspan="100%" class="text-center py-4">Đang tải dữ liệu...</td></tr>';
    }

    try {
        const response = await apiFetchTable(`/groups${queryString}`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        }, 'groupTableBody', loadGroups);
        const result = await response.json();

        if (response.ok && result.success) {
            const groups = Array.isArray(result.data) ? result.data : [];
            updateStatusListFromGroups(groups);
            renderGroupTable(groups);
        } else {
            if (tbody) tbody.innerHTML = '<tr><td colspan="100%" class="text-center py-4">Không thể tải danh sách nhóm.</td></tr>';
        }
    } catch (err) {
        console.error('Lỗi load groups:', err);
        if (tbody) tbody.innerHTML = '<tr><td colspan="100%" class="text-center py-4 text-danger">Lỗi kết nối máy chủ!</td></tr>';
    }
}

// 3. HIỂN THỊ DANH SÁCH NHÓM LÊN BẢNG
function renderGroupTable(groups) {
    const tbody = document.getElementById('groupTableBody');
    if (!tbody) return;

    if (groups.length === 0) {
        tbody.innerHTML = '<tr><td colspan="100%" class="text-center py-4">Không tìm thấy nhóm sinh viên nào.</td></tr>';
        return;
    }

    tbody.innerHTML = groups.map(g => {
        const leaderName = g.leader?.fullName || g.leaderName || 'Chưa có';
        const leaderCode = g.members?.find(m => m.groupRole === 'LEADER')?.studentCode || g.leader?.code || g.leaderCode || '';
        const leaderDisplay = leaderCode ? `${leaderName} (${leaderCode})` : leaderName;

        const periodName = g.period?.name || g.periodName || `Đợt ${g.periodId || ''}`;
        const topicTitle = g.topicTitleVi || g.topic?.titleVi || g.topic?.title || g.topic?.name;
        const topicDisplay = topicTitle ? escapeText(topicTitle) : '<span style="color: #94a3b8;">Chưa đăng ký</span>';

        const statusBadge = getStatusBadgeHtml(g.status);

        return `
            <tr>
                <td><strong style="color: #1e40af;">${escapeText(g.code || g.groupCode || `N${g.id}`)}</strong></td>
                <td>
                    <div style="font-weight: 500;">${escapeText(leaderDisplay)}</div>
                    <small style="color: #64748b;">Sĩ số: ${g.memberCount ?? g.members?.length ?? 0} SV</small>
                </td>
                <td>${escapeText(periodName)}</td>
                <td>${topicDisplay}</td>
                <td>${getGroupReportHtml(g)}</td>
                <td>${statusBadge}</td>
                <td style="text-align: right;">
                    <button class="btn btn-sm btn-action-view" onclick="viewGroupDetail(${g.id})">
                        Chi tiết
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// 4. XEM CHI TIẾT NHÓM (GET /api/groups/{id})
async function viewGroupDetail(groupId) {
    try {
        const response = await apiFetch(`/groups/${groupId}`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        const result = await response.json();

        if (response.ok && result.success && result.data) {
            const g = result.data;

            document.getElementById('modalGroupCode').textContent = g.code || g.groupCode || `N${g.id}`;
            document.getElementById('modalPeriodName').textContent = g.period?.name || g.periodName || `Đợt ${g.periodId || ''}`;
            document.getElementById('modalTopicTitle').textContent = g.topicTitleVi || g.topic?.titleVi || g.topic?.title || g.topic?.name || 'Chưa đăng ký';
            document.getElementById('modalAdvisorName').textContent = g.topic?.primaryAdvisorName || 'Chưa phân công';
            document.getElementById('modalGroupStatus').innerHTML = getStatusBadgeHtml(g.status);

            document.getElementById('modalReportStatus').innerHTML = getGroupReportHtml(g);

            const members = Array.isArray(g.members) ? g.members : [];
            const tbody = document.getElementById('modalMembersTableBody');
            tbody.innerHTML = members.map(m => `
                <tr>
                    <td><strong>${escapeText(m.studentCode || m.code || '-')}</strong></td>
                    <td>${escapeText(m.studentName || m.fullName || '-')}</td>
                    <td>${escapeText(m.studentClass || '-')}</td>
                    <td><small>${escapeText(m.studentEmail || m.email || '-')}</small></td>
                    <td>${(m.groupRole === 'LEADER' || m.isLeader) ? '<span class="badge badge-success">Nhóm trưởng</span>' : '<span class="badge badge-secondary">Thành viên</span>'}</td>
                </tr>
            `).join('') || '<tr><td colspan="5" class="text-center py-4">Chưa có thành viên.</td></tr>';

            document.getElementById('groupDetailModal').style.display = 'flex';
        } else {
            await showAlert(result.message || 'Không thể lấy chi tiết nhóm!');
        }
    } catch (err) {
        console.error('Lỗi viewGroupDetail:', err);
        await showAlert('Không thể tải chi tiết nhóm. Vui lòng thử lại.');
    }
}

function getGroupReportHtml(group) {
    const reportUrl = group.reportUrl || group.reportFileUrl;
    if (reportUrl) {
        try {
            const url = new URL(reportUrl, window.location.href);
            if (['http:', 'https:'].includes(url.protocol)) {
                return `<a href="${escapeText(url.href)}" target="_blank" rel="noopener noreferrer">📄 Xem báo cáo</a>`;
            }
        } catch { /* Treat invalid links as unavailable. */ }
    }
    return '<span style="color: #94a3b8;">Chưa nộp báo cáo</span>';
}

function closeGroupModal() {
    document.getElementById('groupDetailModal').style.display = 'none';
}

function getStatusBadgeHtml(status) {
    if (!status) return '<span class="badge badge-secondary">FORMING</span>';
    const s = status.toUpperCase();
    if (s === 'FORMING') return '<span class="badge badge-secondary">Đang lập nhóm</span>';
    if (s === 'REGISTERED') return '<span class="badge badge-primary">Đã đăng ký ĐT</span>';
    if (s === 'APPROVED') return '<span class="badge badge-success">Đã duyệt ĐT</span>';
    if (s === 'IN_PROGRESS') return '<span class="badge badge-warning">Đang thực hiện</span>';
    if (s === 'SUBMITTED') return '<span class="badge badge-success">Đã nộp báo cáo</span>';
    if (s === 'DEFENDED') return '<span class="badge badge-info">Đã bảo vệ</span>';
    if (s === 'COMPLETED') return '<span class="badge badge-success">Hoàn thành</span>';
    return `<span class="badge badge-secondary">${escapeText(status)}</span>`;
}

window.selectPeriodFilter = selectPeriodFilter;
window.selectStatusFilter = selectStatusFilter;
window.viewGroupDetail = viewGroupDetail;
window.closeGroupModal = closeGroupModal;
function resetFilters() {
    document.getElementById('filterPeriod').value = '';
    document.getElementById('filterStatus').value = '';
    document.getElementById('filterPeriodSearchInput').value = '';
    document.getElementById('filterStatusSearchInput').value = '';
    selectedPeriodId = '';
    selectedStatus = '';
    filterPeriodSearchQuery = '';
    filterStatusSearchQuery = '';
    renderPeriodDropdown();
    renderStatusDropdown();
    document.querySelectorAll('.filter-card .custom-multiselect-dropdown.open').forEach(dropdown => dropdown.classList.remove('open'));
    loadGroups();
}
