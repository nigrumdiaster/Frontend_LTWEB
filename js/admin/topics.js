function getToken() {
    return localStorage.getItem('token');
}

function formatStatusBadge(status) {
    if (status === 'APPROVED') return '<span class="badge badge-success">Đã duyệt</span>';
    if (status === 'REJECTED') return '<span class="badge badge-danger">Từ chối</span>';
    return '<span class="badge badge-role">Chờ duyệt</span>';
}

function safeRemoveTones(str) {
    if (typeof window.removeVietnameseTones === 'function') {
        return window.removeVietnameseTones(str);
    }
    return (str || '').toLowerCase();
}

let registrationPeriods = [];
let departmentsList = [];
const topicApprovalStatuses = [
    { value: '', label: 'Tất cả trạng thái' },
    { value: 'PENDING', label: 'Chờ duyệt (PENDING)' },
    { value: 'APPROVED', label: 'Đã duyệt (APPROVED)' },
    { value: 'REJECTED', label: 'Từ chối (REJECTED)' }
];

let selectedFilterPeriodId = '';
let selectedFilterDepartmentId = '';
let selectedFilterStatus = '';

let selectedCreatePeriodId = '';
let selectedCreateDepartmentId = '';
let selectedEditDepartmentId = '';

let filterPeriodSearchQuery = '';
let filterDepartmentSearchQuery = '';
let filterStatusSearchQuery = '';

let createPeriodSearchQuery = '';
let createDepartmentSearchQuery = '';
let editDepartmentSearchQuery = '';

document.addEventListener('DOMContentLoaded', async () => {
    setupDropdownEvents();
    await initDropdowns();
    loadTopics();

    ['filterPeriodId', 'filterDepartmentId'].forEach(id => {
        document.getElementById(id)?.addEventListener('change', loadTopics);
    });

    const createForm = document.getElementById('createTopicForm');
    if (createForm) createForm.addEventListener('submit', handleCreateTopic);

    const editForm = document.getElementById('editTopicForm');
    if (editForm) editForm.addEventListener('submit', handleEditTopic);

    const approvalForm = document.getElementById('approvalForm');
    if (approvalForm) approvalForm.addEventListener('submit', handleApproval);
});

function setupDropdownEvents() {
    setupSingleSelectDropdown({
        containerId: 'filterStatusContainer',
        triggerId: 'filterStatusTrigger',
        dropdownId: 'filterStatusDropdown',
        searchInputId: 'filterStatusSearchInput',
        onSearch: (q) => {
            filterStatusSearchQuery = q;
            renderFilterStatusDropdown();
        }
    });

    document.addEventListener('click', (e) => {
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

// Nạp danh sách liên quan vào các dropdown có giá trị ID.
async function initDropdowns() {
    await Promise.all([
        populateSelectOptions(
            ['filterPeriodId', 'createPeriodId'],
            '/registration-periods',
            ['Tất cả đợt', 'Chọn đợt đăng ký...'],
            period => period.name || `Đợt ${period.id}`
        ),
        populateSelectOptions(
            ['filterDepartmentId', 'createDepartmentId', 'editDepartmentId'],
            '/departments',
            ['Tất cả bộ môn', 'Chọn bộ môn...', 'Chọn bộ môn...'],
            department => department.name || `Bộ môn ${department.id}`
        )
    ]);
    renderFilterStatusDropdown();
}

async function populateSelectOptions(selectIds, endpoint, placeholders, getLabel) {
    const selects = selectIds.map(id => document.getElementById(id)).filter(Boolean);
    if (selects.length === 0) return;

    try {
        const response = await apiFetchAll(endpoint, { method: 'GET' });
        const result = await response.json();
        if (!response.ok || !result.success || !Array.isArray(result.data)) {
            throw new Error(result.message || `Không thể tải dữ liệu từ ${endpoint}.`);
        }

        selects.forEach((select, index) => {
            select.replaceChildren(
                new Option(placeholders[index], ''),
                ...result.data.map(item => new Option(getLabel(item), item.id))
            );
        });
    } catch (error) {
        console.error(`Lỗi nạp dropdown từ ${endpoint}:`, error);
    }
}

// Filter Period
function renderFilterPeriodDropdown() {
    const label = document.getElementById('filterPeriodLabel');
    const optionsContainer = document.getElementById('filterPeriodOptionsList');
    if (!label || !optionsContainer) return;

    const currentPeriod = registrationPeriods.find(p => String(p.id) === String(selectedFilterPeriodId));
    if (currentPeriod) {
        label.textContent = currentPeriod.name || `Đợt ${currentPeriod.id}`;
        label.classList.remove('placeholder');
    } else {
        label.textContent = 'Tất cả đợt';
        label.classList.add('placeholder');
    }

    const query = safeRemoveTones(filterPeriodSearchQuery);
    const filtered = registrationPeriods.filter(p => {
        const name = safeRemoveTones(p.name || `Đợt ${p.id}`);
        return !query || name.includes(query);
    });

    let html = `
        <div class="select-option-item ${!selectedFilterPeriodId ? 'selected' : ''}" onclick="selectFilterPeriodTopic('')">
            <span>Tất cả đợt</span>
        </div>
    `;

    if (filtered.length === 0 && query) {
        html += '<div class="select-option-empty">Không tìm thấy đợt đăng ký</div>';
    } else {
        html += filtered.map(p => {
            const isSelected = String(p.id) === String(selectedFilterPeriodId);
            return `
                <div class="select-option-item ${isSelected ? 'selected' : ''}" onclick="selectFilterPeriodTopic('${p.id}')">
                    <span>${p.name || `Đợt ${p.id}`}</span>
                </div>
            `;
        }).join('');
    }

    optionsContainer.innerHTML = html;
}

function selectFilterPeriodTopic(id) {
    selectedFilterPeriodId = String(id || '');
    const hidden = document.getElementById('filterPeriodId');
    if (hidden) hidden.value = selectedFilterPeriodId;
    document.getElementById('filterPeriodDropdown')?.classList.remove('open');
    renderFilterPeriodDropdown();
    loadTopics();
}

// Filter Department
function renderFilterDepartmentDropdown() {
    const label = document.getElementById('filterDepartmentLabel');
    const optionsContainer = document.getElementById('filterDepartmentOptionsList');
    if (!label || !optionsContainer) return;

    const currentDept = departmentsList.find(d => String(d.id) === String(selectedFilterDepartmentId));
    if (currentDept) {
        label.textContent = currentDept.name || `Bộ môn ${currentDept.id}`;
        label.classList.remove('placeholder');
    } else {
        label.textContent = 'Tất cả bộ môn';
        label.classList.add('placeholder');
    }

    const query = safeRemoveTones(filterDepartmentSearchQuery);
    const filtered = departmentsList.filter(d => {
        const name = safeRemoveTones(d.name || `Bộ môn ${d.id}`);
        return !query || name.includes(query);
    });

    let html = `
        <div class="select-option-item ${!selectedFilterDepartmentId ? 'selected' : ''}" onclick="selectFilterDeptTopic('')">
            <span>Tất cả bộ môn</span>
        </div>
    `;

    if (filtered.length === 0 && query) {
        html += '<div class="select-option-empty">Không tìm thấy bộ môn</div>';
    } else {
        html += filtered.map(d => {
            const isSelected = String(d.id) === String(selectedFilterDepartmentId);
            return `
                <div class="select-option-item ${isSelected ? 'selected' : ''}" onclick="selectFilterDeptTopic('${d.id}')">
                    <span>${d.name || `Bộ môn ${d.id}`}</span>
                </div>
            `;
        }).join('');
    }

    optionsContainer.innerHTML = html;
}

function selectFilterDeptTopic(id) {
    selectedFilterDepartmentId = String(id || '');
    const hidden = document.getElementById('filterDepartmentId');
    if (hidden) hidden.value = selectedFilterDepartmentId;
    document.getElementById('filterDepartmentDropdown')?.classList.remove('open');
    renderFilterDepartmentDropdown();
    loadTopics();
}

// Filter Status
function renderFilterStatusDropdown() {
    const label = document.getElementById('filterStatusLabel');
    const optionsContainer = document.getElementById('filterStatusOptionsList');
    if (!label || !optionsContainer) return;

    const currentStatus = topicApprovalStatuses.find(s => s.value === selectedFilterStatus);
    if (currentStatus && currentStatus.value) {
        label.textContent = currentStatus.label;
        label.classList.remove('placeholder');
    } else {
        label.textContent = 'Tất cả trạng thái';
        label.classList.add('placeholder');
    }

    const query = safeRemoveTones(filterStatusSearchQuery);
    const filtered = topicApprovalStatuses.filter(s => {
        const text = safeRemoveTones(s.label + ' ' + s.value);
        return !query || text.includes(query);
    });

    let html = '';
    if (filtered.length === 0 && query) {
        html = '<div class="select-option-empty">Không tìm thấy trạng thái</div>';
    } else {
        html = filtered.map(s => {
            const isSelected = s.value === selectedFilterStatus;
            return `
                <div class="select-option-item ${isSelected ? 'selected' : ''}" onclick="selectFilterStatusTopic('${s.value}')">
                    <span>${s.label}</span>
                </div>
            `;
        }).join('');
    }

    optionsContainer.innerHTML = html;
}

function selectFilterStatusTopic(val) {
    selectedFilterStatus = String(val || '');
    const hidden = document.getElementById('filterStatus');
    if (hidden) hidden.value = selectedFilterStatus;
    document.getElementById('filterStatusDropdown')?.classList.remove('open');
    renderFilterStatusDropdown();
    loadTopics();
}

// Create Modal Period
function renderCreatePeriodDropdown() {
    const label = document.getElementById('createPeriodLabel');
    const optionsContainer = document.getElementById('createPeriodOptionsList');
    if (!label || !optionsContainer) return;

    const currentPeriod = registrationPeriods.find(p => String(p.id) === String(selectedCreatePeriodId));
    if (currentPeriod) {
        label.textContent = currentPeriod.name || `Đợt ${currentPeriod.id}`;
        label.classList.remove('placeholder');
    } else {
        label.textContent = 'Chọn đợt đăng ký...';
        label.classList.add('placeholder');
    }

    const query = safeRemoveTones(createPeriodSearchQuery);
    const filtered = registrationPeriods.filter(p => {
        const name = safeRemoveTones(p.name || `Đợt ${p.id}`);
        return !query || name.includes(query);
    });

    if (filtered.length === 0) {
        optionsContainer.innerHTML = '<div class="select-option-empty">Không tìm thấy đợt đăng ký</div>';
        return;
    }

    optionsContainer.innerHTML = filtered.map(p => {
        const isSelected = String(p.id) === String(selectedCreatePeriodId);
        return `
            <div class="select-option-item ${isSelected ? 'selected' : ''}" onclick="selectCreatePeriodTopic('${p.id}')">
                <span>${p.name || `Đợt ${p.id}`}</span>
            </div>
        `;
    }).join('');
}

function selectCreatePeriodTopic(id) {
    selectedCreatePeriodId = String(id || '');
    const hidden = document.getElementById('createPeriodId');
    if (hidden) hidden.value = selectedCreatePeriodId;
    document.getElementById('createPeriodDropdown')?.classList.remove('open');
    renderCreatePeriodDropdown();
}

// Create Modal Department
function renderCreateDepartmentDropdown() {
    const label = document.getElementById('createDepartmentLabel');
    const optionsContainer = document.getElementById('createDepartmentOptionsList');
    if (!label || !optionsContainer) return;

    const currentDept = departmentsList.find(d => String(d.id) === String(selectedCreateDepartmentId));
    if (currentDept) {
        label.textContent = currentDept.name || `Bộ môn ${currentDept.id}`;
        label.classList.remove('placeholder');
    } else {
        label.textContent = 'Chọn bộ môn...';
        label.classList.add('placeholder');
    }

    const query = safeRemoveTones(createDepartmentSearchQuery);
    const filtered = departmentsList.filter(d => {
        const name = safeRemoveTones(d.name || `Bộ môn ${d.id}`);
        return !query || name.includes(query);
    });

    if (filtered.length === 0) {
        optionsContainer.innerHTML = '<div class="select-option-empty">Không tìm thấy bộ môn</div>';
        return;
    }

    optionsContainer.innerHTML = filtered.map(d => {
        const isSelected = String(d.id) === String(selectedCreateDepartmentId);
        return `
            <div class="select-option-item ${isSelected ? 'selected' : ''}" onclick="selectCreateDepartmentTopic('${d.id}')">
                <span>${d.name || `Bộ môn ${d.id}`}</span>
            </div>
        `;
    }).join('');
}

function selectCreateDepartmentTopic(id) {
    selectedCreateDepartmentId = String(id || '');
    const hidden = document.getElementById('createDepartmentId');
    if (hidden) hidden.value = selectedCreateDepartmentId;
    document.getElementById('createDepartmentDropdown')?.classList.remove('open');
    renderCreateDepartmentDropdown();
}

// Edit Modal Department
function renderEditDepartmentDropdown() {
    const label = document.getElementById('editDepartmentLabel');
    const optionsContainer = document.getElementById('editDepartmentOptionsList');
    if (!label || !optionsContainer) return;

    const currentDept = departmentsList.find(d => String(d.id) === String(selectedEditDepartmentId));
    if (currentDept) {
        label.textContent = currentDept.name || `Bộ môn ${currentDept.id}`;
        label.classList.remove('placeholder');
    } else {
        label.textContent = 'Chọn bộ môn...';
        label.classList.add('placeholder');
    }

    const query = safeRemoveTones(editDepartmentSearchQuery);
    const filtered = departmentsList.filter(d => {
        const name = safeRemoveTones(d.name || `Bộ môn ${d.id}`);
        return !query || name.includes(query);
    });

    if (filtered.length === 0) {
        optionsContainer.innerHTML = '<div class="select-option-empty">Không tìm thấy bộ môn</div>';
        return;
    }

    optionsContainer.innerHTML = filtered.map(d => {
        const isSelected = String(d.id) === String(selectedEditDepartmentId);
        return `
            <div class="select-option-item ${isSelected ? 'selected' : ''}" onclick="selectEditDepartmentTopic('${d.id}')">
                <span>${d.name || `Bộ môn ${d.id}`}</span>
            </div>
        `;
    }).join('');
}

function selectEditDepartmentTopic(id) {
    selectedEditDepartmentId = String(id || '');
    const hidden = document.getElementById('editDepartmentId');
    if (hidden) hidden.value = selectedEditDepartmentId;
    document.getElementById('editDepartmentDropdown')?.classList.remove('open');
    renderEditDepartmentDropdown();
}

// 1. GET /api/topics - Lấy danh sách đề tài với bộ lọc
async function loadTopics() {
    showTableMessage('Đang tải dữ liệu...');
    const periodId = document.getElementById('filterPeriodId')?.value || '';
    const departmentId = document.getElementById('filterDepartmentId')?.value || '';
    const status = document.getElementById('filterStatus')?.value || selectedFilterStatus || '';
    const keyword = document.getElementById('filterKeyword')?.value.trim() || '';

    let queryParams = new URLSearchParams();
    if (keyword) queryParams.set('keyword', keyword);
    if (periodId) queryParams.append('periodId', periodId);
    if (departmentId) queryParams.append('departmentId', departmentId);
    if (status) queryParams.append('status', status);

    try {
        const response = await apiFetchTable(`/topics?${queryParams.toString()}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${getToken()}`,
                'Content-Type': 'application/json'
            }
        }, 'topicTableBody', loadTopics);

        const result = await response.json();
        if (response.ok && result.success) {
            let topics = Array.isArray(result.data) ? result.data : [];
            renderTopicsTable(topics);
        } else {
            showTableMessage(`❌ Lỗi: ${result.message || 'Không thể tải danh sách'}`);
        }
    } catch (error) {
        console.error('Lỗi GET /api/topics:', error);
        showTableMessage('❌ Lỗi kết nối đến máy chủ.');
    }
}

const topicDeleteLabels = new Map();

function renderTopicsTable(topics) {
    topicDeleteLabels.clear();
    (topics || []).forEach(topic => topicDeleteLabels.set(String(topic.id), topic.titleVi || topic.titleEn || topic.code));
    const tbody = document.getElementById('topicTableBody');
    if (!tbody) return;

    if (!topics || topics.length === 0) {
        tbody.innerHTML = '<tr><td colspan="100%" class="text-center py-4">Chưa có dữ liệu</td></tr>';
        return;
    }

    tbody.innerHTML = topics.map(t => `
        <tr>
            <td>${t.id}</td>
            <td><strong>${escapeText(t.code || '-')}</strong></td>
            <td>
                <strong style="color: #0f172a;">${escapeText(t.titleVi)}</strong><br>
                <small style="color: #64748b; font-style: italic;">${escapeText(t.titleEn || '-')}</small>
            </td>
            <td>
                <small><strong>BM:</strong> ${escapeText(t.departmentName || '-')}</small><br>
                <small style="color: #4f46e5;">${escapeText(t.periodName || '-')}</small>
            </td>
            <td>
                ${escapeText(t.primaryAdvisorName || '-')}
            </td>
            <td><span class="badge badge-secondary">${escapeText(t.maxStudents ?? '-')} SV</span></td>
            <td>${formatStatusBadge(t.approvalStatus)}</td>
            <td>${renderAssignedGroup(t)}</td>
            <td style="text-align: right; white-space: nowrap;">
                <button onclick="openDetailTopicModal(${t.id})" class="btn btn-sm btn-action-view" title="Xem chi tiết">👁️ Chi tiết</button>
                <button onclick="openApprovalModal(${t.id})" class="btn btn-sm btn-secondary">✔️ Trạng thái</button>
                <button onclick="openEditTopicModal(${t.id})" class="btn btn-sm btn-action-edit">Sửa</button>
                <button onclick="deleteTopic(${t.id})" class="btn btn-sm btn-action-delete">Xóa</button>
            </td>
        </tr>
    `).join('');
}

function showTableMessage(msg) {
    const tbody = document.getElementById('topicTableBody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="100%" class="text-center py-4">${msg}</td></tr>`;
}

function renderAssignedGroup(topic) {
    const label = escapeText(getAssignedGroupLabel(topic));
    const groupId = Number(topic.assignedGroupId);
    return Number.isSafeInteger(groupId) && groupId > 0
        ? `<button type="button" onclick="openRegisteredGroup(${groupId})" class="btn btn-ghost btn-sm" style="color: #1e40af; font-weight: 600; text-align: left; text-decoration: underline;">${label}</button>`
        : `<span style="color: ${topic.isAssigned ? '#b45309' : '#64748b'};">${label}</span>`;
}

let registeredGroupRequest = 0;
let registeredGroupTrigger = null;

function ensureRegisteredGroupModal() {
    let modal = document.getElementById('registeredGroupModal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'registeredGroupModal';
    modal.className = 'modal';
    modal.style.zIndex = '1100';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'registeredGroupTitle');
    modal.innerHTML = `<div class="modal-content" style="max-width: 800px;">
        <div class="modal-header"><h3 id="registeredGroupTitle">Thông tin nhóm đăng ký</h3></div>
        <div id="registeredGroupContent" style="margin: 16px 0; line-height: 1.7;" aria-live="polite"></div>
        <div style="display:flex; justify-content:flex-end;"><button type="button" class="btn btn-secondary" onclick="closeRegisteredGroup()">Đóng</button></div>
    </div>`;
    modal.addEventListener('click', event => { if (event.target === modal) closeRegisteredGroup(); });
    modal.addEventListener('keydown', event => {
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeRegisteredGroup(); }
        if (event.key === 'Tab') {
            const controls = [...modal.querySelectorAll('button, a[href], [tabindex="0"]')].filter(item => item.getClientRects().length);
            const first = controls[0], last = controls.at(-1);
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }
    });
    document.body.append(modal);
    return modal;
}

async function openRegisteredGroup(groupId) {
    const version = ++registeredGroupRequest;
    const modal = ensureRegisteredGroupModal();
    registeredGroupTrigger = document.activeElement;
    const content = document.getElementById('registeredGroupContent');
    content.textContent = 'Đang tải thông tin nhóm…';
    modal.style.display = 'flex';
    modal.querySelector('button').focus();
    try {
        const response = await apiFetch(`/groups/${groupId}`);
        const result = await response.json();
        if (version !== registeredGroupRequest) return;
        if (!response.ok || !result.success || !result.data) throw new Error(result.message || 'Không thể tải thông tin nhóm.');
        const group = result.data;
        const members = Array.isArray(group.members) ? group.members : [];
        const leader = group.leaderName || members.find(member => member.groupRole === 'LEADER')?.studentName || 'Chưa cập nhật';
        const statuses = { FORMING: 'Đang lập nhóm', REGISTERED: 'Đã đăng ký đề tài', APPROVED: 'Đã duyệt', IN_PROGRESS: 'Đang thực hiện', SUBMITTED: 'Đã nộp báo cáo', DEFENDED: 'Đã bảo vệ', COMPLETED: 'Hoàn thành' };
        content.innerHTML = `<p><strong>Tên nhóm:</strong> ${escapeText(group.name || 'Chưa cập nhật')}</p>
            <p><strong>Mã nhóm:</strong> ${escapeText(group.code || `Nhóm #${group.id}`)}</p>
            <p><strong>Đợt đăng ký:</strong> ${escapeText(group.periodName || '-')}</p>
            <p><strong>Đề tài:</strong> ${escapeText(group.topicTitleVi || group.topic?.titleVi || 'Chưa đăng ký')}</p>
            <p><strong>Nhóm trưởng:</strong> ${escapeText(leader)}</p>
            <p><strong>Trạng thái:</strong> ${escapeText(statuses[group.status] || group.status || '-')} · <strong>Số thành viên:</strong> ${members.length}</p>
            <h4 style="margin: 16px 0 8px;">Thành viên nhóm</h4>
            <table class="data-table"><thead><tr><th>Mã SV</th><th>Họ và tên</th><th>Lớp</th><th>Email</th><th>Vai trò</th></tr></thead>
            <tbody>${members.map(member => `<tr><td>${escapeText(member.studentCode || '-')}</td><td>${escapeText(member.studentName || '-')}</td><td>${escapeText(member.studentClass || '-')}</td><td>${escapeText(member.studentEmail || '-')}</td><td>${member.groupRole === 'LEADER' ? 'Nhóm trưởng' : 'Thành viên'}</td></tr>`).join('') || '<tr><td colspan="5">Chưa có thông tin thành viên.</td></tr>'}</tbody></table>`;
    } catch (error) {
        if (version !== registeredGroupRequest) return;
        content.textContent = error.message || 'Không thể tải thông tin nhóm. Vui lòng thử lại.';
    }
}

function closeRegisteredGroup() {
    ++registeredGroupRequest;
    document.getElementById('registeredGroupModal').style.display = 'none';
    if (registeredGroupTrigger?.isConnected) registeredGroupTrigger.focus();
}

// 2. POST /api/topics - Đề xuất đề tài mới
async function handleCreateTopic(e) {
    e.preventDefault();
    const periodVal = document.getElementById('createPeriodId').value;
    const deptVal = document.getElementById('createDepartmentId').value;
    if (!periodVal) {
        await showAlert('Vui lòng chọn đợt đăng ký!');
        return;
    }
    if (!deptVal) {
        await showAlert('Vui lòng chọn bộ môn!');
        return;
    }


    const payload = {
        titleVi: document.getElementById('createTitleVi').value.trim(),
        titleEn: document.getElementById('createTitleEn').value.trim(),
        periodId: parseInt(periodVal, 10),
        departmentId: parseInt(deptVal, 10),
        maxStudents: parseInt(document.getElementById('createMaxStudents').value, 10),
        description: document.getElementById('createDescription').value.trim(),
        requirements: document.getElementById('createRequirements').value.trim()
    };

    try {
        const response = await apiFetch(`/topics`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${getToken()}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        if (response.ok && result.success) {
            await showAlert('✅ Gửi đề xuất đề tài thành công!');
            closeModal('createTopicModal');
            document.getElementById('createTopicForm').reset();
            loadTopics();
        } else {
            await showAlert(result.message || 'Thất bại!');
        }
    } catch (error) {
        console.error('Lỗi POST /api/topics:', error);
        await showAlert('Không thể tạo đề tài. Vui lòng thử lại.', 'error');
    }
}

// 3. GET /api/topics/{id} - Mở Modal Sửa
async function openEditTopicModal(id) {
    try {
        const response = await apiFetch(`/topics/${id}`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });

        const result = await response.json();
        if (response.ok && result.success) {
            const data = result.data;
            document.getElementById('editTopicId').value = data.id;
            document.getElementById('editTitleVi').value = data.titleVi || '';
            document.getElementById('editTitleEn').value = data.titleEn || '';
            
            document.getElementById('editDepartmentId').value = data.departmentId ? String(data.departmentId) : '';

            document.getElementById('editMaxStudents').value = data.maxStudents ?? '';
            document.getElementById('editDescription').value = data.description || '';
            document.getElementById('editRequirements').value = data.requirements || '';

            document.getElementById('editTopicModal').style.display = 'flex';
        } else {
            await showAlert(result.message || 'Không thể tải thông tin đề tài.', 'error');
        }
    } catch (error) {
        console.error('Lỗi GET detail topic:', error);
        await showAlert('Không thể tải thông tin đề tài. Vui lòng thử lại.', 'error');
    }
}

// 4. PUT /api/topics/{id} - Cập nhật đề tài
async function handleEditTopic(e) {
    e.preventDefault();
    const id = document.getElementById('editTopicId').value;
    const deptVal = document.getElementById('editDepartmentId').value;
    if (!deptVal) {
        await showAlert('Vui lòng chọn bộ môn!');
        return;
    }


    const payload = {
        titleVi: document.getElementById('editTitleVi').value.trim(),
        titleEn: document.getElementById('editTitleEn').value.trim(),
        departmentId: parseInt(deptVal, 10),
        maxStudents: parseInt(document.getElementById('editMaxStudents').value, 10),
        description: document.getElementById('editDescription').value.trim(),
        requirements: document.getElementById('editRequirements').value.trim()
    };

    try {
        const response = await apiFetch(`/topics/${id}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${getToken()}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        if (response.ok && result.success) {
            await showAlert('✅ Cập nhật thông tin đề tài thành công!');
            closeModal('editTopicModal');
            loadTopics();
        } else {
            await showAlert(result.message || 'Cập nhật thất bại!');
        }
    } catch (error) {
        console.error('Lỗi PUT /api/topics/{id}:', error);
        await showAlert('Không thể cập nhật đề tài. Vui lòng thử lại.', 'error');
    }
}

// 5. PATCH /api/topics/{id}/approval - Duyệt đề tài
let approvalInitialStatus = '';
let approvalAssigned = false;
let approvalRequestVersion = 0;
let savingApproval = false;

async function openApprovalModal(id) {
    if (savingApproval) return;
    const version = ++approvalRequestVersion;
    try {
        const response = await apiFetch(`/topics/${id}`, { headers: { 'Authorization': `Bearer ${getToken()}` } });
        const result = await response.json();
        if (version !== approvalRequestVersion) return;
        if (!response.ok || !result.success || !result.data) throw new Error(result.message || 'Không thể tải trạng thái đề tài.');
        const topic = result.data;
        approvalInitialStatus = topic.approvalStatus || 'PENDING';
        approvalAssigned = topic.isAssigned === true;
        document.getElementById('approvalTopicId').value = topic.id;
        document.getElementById('rejectionReason').value = topic.rejectionReason || '';
        const select = document.getElementById('approvalStatusSelect');
        [...select.options].forEach(option => { option.disabled = approvalAssigned && option.value !== 'APPROVED'; });
        select.value = approvalInitialStatus;
        document.getElementById('approvalStatusHint').textContent = approvalAssigned
            ? 'Đề tài đã có nhóm đăng ký. Bạn vẫn có thể sửa thông tin; không thể chuyển về chờ duyệt hoặc từ chối khi nhóm còn gắn với đề tài.'
            : 'Bạn có thể thay đổi trạng thái đề tài. Chọn quyết định mới rồi xác nhận.';
        toggleRejectionReason();
        document.getElementById('approvalModal').style.display = 'flex';
    } catch (error) {
        if (version !== approvalRequestVersion) return;
        await showAlert(error.message || 'Không thể tải trạng thái đề tài.', 'error');
    }
}

function selectApprovalStatus(status) {
    document.getElementById('approvalStatusSelect').value = status;
    toggleRejectionReason();
}

function toggleRejectionReason() {
    const status = document.getElementById('approvalStatusSelect').value;
    document.querySelectorAll('input[name="topicApprovalStatus"]').forEach(input => {
        input.checked = input.value === status;
        input.disabled = savingApproval || (approvalAssigned && input.value !== 'APPROVED');
    });
    const group = document.getElementById('rejectionReasonGroup');
    if (group) group.style.display = status === 'REJECTED' ? 'block' : 'none';
    document.getElementById('rejectionReason').required = status === 'REJECTED';
    document.getElementById('approvalSaveButton').disabled = savingApproval || !status || status === approvalInitialStatus || (approvalAssigned && status !== 'APPROVED');
}

async function handleApproval(e) {
    e.preventDefault();
    if (savingApproval) return;
    const id = document.getElementById('approvalTopicId').value;
    const status = document.getElementById('approvalStatusSelect').value;
    const reason = document.getElementById('rejectionReason').value.trim();
    if (!status || status === approvalInitialStatus) return;
    if (approvalAssigned && status !== 'APPROVED') {
        await showAlert('Đề tài đã có nhóm đăng ký, không thể thu hồi phê duyệt hoặc từ chối.', 'error');
        return;
    }
    if (status === 'REJECTED' && !reason) {
        await showAlert('Vui lòng nhập lý do từ chối.');
        return;
    }

    savingApproval = true;
    toggleRejectionReason();
    try {
        const response = await apiFetch(`/topics/${id}/approval`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${getToken()}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                approvalStatus: status,
                rejectionReason: status === 'REJECTED' ? reason : ''
            })
        });

        const result = await response.json();
        if (response.ok && result.success) {
            await showAlert('✅ Đã cập nhật trạng thái phê duyệt!');
            closeModal('approvalModal');
            loadTopics();
        } else {
            await showAlert(result.message || 'Cập nhật thất bại!');
        }
    } catch (error) {
        console.error('Lỗi PATCH approval:', error);
        await showAlert('Không thể cập nhật trạng thái đề tài. Vui lòng thử lại.', 'error');
    } finally {
        savingApproval = false;
        toggleRejectionReason();
    }
}

// 6. DELETE /api/topics/{id} - Xóa đề tài
async function deleteTopic(id) {
    const name = topicDeleteLabels.get(String(id));
    if (!(await confirmAction(`Bạn có chắc muốn xóa đề tài ${name ? `“${name}”` : 'này'}?\n\nNhóm và thành viên được giữ lại, nhưng nhóm sẽ được gỡ khỏi đề tài và trở về trạng thái đang lập nhóm. Thông tin báo cáo đã nộp, điểm, kết quả và các phân công phản biện/hội đồng của đề tài (nếu có) sẽ bị xóa. Thao tác này không thể hoàn tác.`))) return;

    try {
        const response = await apiFetch(`/topics/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });

        const result = await response.json();
        if (response.ok && result.success) {
            await showAlert('✅ Đã xóa đề tài!');
            loadTopics();
        } else {
            await showAlert(result.message || 'Xóa thất bại!');
        }
    } catch (error) {
        console.error('Lỗi DELETE /api/topics/{id}:', error);
        await showAlert('Không thể xóa đề tài. Vui lòng thử lại.', 'error');
    }
}

// Modal Chi tiết Đề tài
async function openDetailTopicModal(id) {
    try {
        const response = await apiFetch(`/topics/${id}`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });

        const result = await response.json();
        if (response.ok && result.success) {
            const t = result.data;
            const container = document.getElementById('detailTopicContent');
            container.innerHTML = `
                <div><strong>Mã đề tài:</strong> ${escapeText(t.code || '-')}</div>
                <div><strong>Tên Tiếng Việt:</strong> ${escapeText(t.titleVi)}</div>
                <div><strong>Tên Tiếng Anh:</strong> ${escapeText(t.titleEn || '-')}</div>
                <div><strong>Đợt đăng ký:</strong> ${escapeText(t.periodName || '-')}</div>
                <div><strong>Bộ môn:</strong> ${escapeText(t.departmentName || '-')}</div>
                <div><strong>Giảng viên hướng dẫn:</strong> ${escapeText(t.primaryAdvisorName || '-')} (${escapeText(t.primaryAdvisorEmail || '-')})</div>
                <div><strong>Số SV tối đa:</strong> ${escapeText(t.maxStudents ?? '-')} Sinh viên</div>
                <div><strong>Trạng thái duyệt:</strong> ${formatStatusBadge(t.approvalStatus)}</div>
                <div><strong>Nhóm đã đăng ký:</strong> ${renderAssignedGroup(t)}</div>
                ${t.rejectionReason ? `<div style="color: #ef4444;"><strong>Lý do từ chối:</strong> ${escapeText(t.rejectionReason)}</div>` : ''}
                <div><strong>Mô tả:</strong> ${escapeText(t.description || 'Chưa có mô tả')}</div>
                <div><strong>Yêu cầu:</strong> ${escapeText(t.requirements || 'Chưa có yêu cầu')}</div>
            `;
            document.getElementById('detailTopicModal').style.display = 'flex';
        } else {
            await showAlert(result.message || 'Không thể tải chi tiết đề tài.', 'error');
        }
    } catch (err) {
        console.error('Lỗi tải chi tiết:', err);
        await showAlert('Không thể tải chi tiết đề tài. Vui lòng thử lại.', 'error');
    }
}

function openCreateTopicModal() {
    const form = document.getElementById('createTopicForm');
    if (form) form.reset();
    document.getElementById('createTopicModal').style.display = 'flex';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

window.selectFilterStatusTopic = selectFilterStatusTopic;
window.loadTopics = loadTopics;
window.openCreateTopicModal = openCreateTopicModal;
window.openEditTopicModal = openEditTopicModal;
window.openApprovalModal = openApprovalModal;
window.toggleRejectionReason = toggleRejectionReason;
window.deleteTopic = deleteTopic;
window.openDetailTopicModal = openDetailTopicModal;
window.closeModal = closeModal;
function resetFilters() {
    document.getElementById('filterPeriodId').value = '';
    document.getElementById('filterDepartmentId').value = '';
    document.getElementById('filterStatus').value = '';
    document.getElementById('filterKeyword').value = '';
    document.getElementById('filterStatusSearchInput').value = '';
    selectedFilterPeriodId = '';
    selectedFilterDepartmentId = '';
    selectedFilterStatus = '';
    filterStatusSearchQuery = '';
    renderFilterStatusDropdown();
    document.querySelectorAll('.filter-card .custom-multiselect-dropdown.open').forEach(dropdown => dropdown.classList.remove('open'));
    loadTopics();
}
