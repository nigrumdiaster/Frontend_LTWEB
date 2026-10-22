function getAuthHeaders() {
    return {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
    };
}

let councilLecturers = [];
let registrationPeriods = [];
let selectedFilterPeriodId = '';
let selectedCouncilPeriodId = '';
let selectedChairmanId = null;
let selectedSecretaryId = null;
let selectedMemberIds = [];

let filterPeriodSearchQuery = '';
let councilPeriodSearchQuery = '';
let chairmanSearchQuery = '';
let secretarySearchQuery = '';
let memberSearchQuery = '';

function safeRemoveTones(str) {
    if (typeof removeVietnameseTones === 'function') {
        return removeVietnameseTones(str);
    }
    return (str || '')
        .toString()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[đĐ]/g, 'd')
        .toLowerCase()
        .trim();
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btnOpenCreateCouncil').addEventListener('click', openCreateCouncilModal);
    document.getElementById('btnLoadCouncils').addEventListener('click', loadCouncils);
    document.getElementById('createCouncilForm').addEventListener('submit', createCouncil);
    document.getElementById('assignTopicsForm').addEventListener('submit', assignTopics);

    setupAllSearchableSelects();
    loadPageData();
});

function closeAllDropdowns() {
    document.querySelectorAll('.custom-multiselect-dropdown.open').forEach(d => d.classList.remove('open'));
    document.querySelectorAll('.custom-multiselect-box.active').forEach(b => b.classList.remove('active'));
}

function setupAllSearchableSelects() {
    // 1. Filter Period Select
    setupSingleSearchableSelect({
        triggerId: 'filterPeriodTrigger',
        dropdownId: 'filterPeriodDropdown',
        searchInputId: 'filterPeriodSearchInput',
        onSearch: (q) => {
            filterPeriodSearchQuery = q;
            renderFilterPeriodSelect();
        }
    });

    // 2. Council Period Select (in modal)
    setupSingleSearchableSelect({
        triggerId: 'councilPeriodTrigger',
        dropdownId: 'councilPeriodDropdown',
        searchInputId: 'councilPeriodSearchInput',
        onSearch: (q) => {
            councilPeriodSearchQuery = q;
            renderCouncilPeriodSelect();
        }
    });

    // 3. Chairman Select
    setupSingleSearchableSelect({
        triggerId: 'councilChairmanTrigger',
        dropdownId: 'councilChairmanDropdown',
        searchInputId: 'councilChairmanSearchInput',
        onSearch: (q) => {
            chairmanSearchQuery = q;
            renderChairmanSelect();
        }
    });

    // 4. Secretary Select
    setupSingleSearchableSelect({
        triggerId: 'councilSecretaryTrigger',
        dropdownId: 'councilSecretaryDropdown',
        searchInputId: 'councilSecretarySearchInput',
        onSearch: (q) => {
            secretarySearchQuery = q;
            renderSecretarySelect();
        }
    });

    // 5. Council Members Multi-select
    setupSingleSearchableSelect({
        triggerId: 'councilMembersTrigger',
        dropdownId: 'councilMembersDropdown',
        searchInputId: 'councilMemberSearchInput',
        ignoreClickSelector: '.multiselect-tag-remove',
        onSearch: (q) => {
            memberSearchQuery = q;
            renderMemberOptionsList();
        }
    });

    // Outside click closes any dropdown
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.custom-multiselect-container')) {
            closeAllDropdowns();
        }
    });
}

function setupSingleSearchableSelect({ triggerId, dropdownId, searchInputId, ignoreClickSelector, onSearch }) {
    const trigger = document.getElementById(triggerId);
    const dropdown = document.getElementById(dropdownId);
    const searchInput = document.getElementById(searchInputId);

    if (trigger && dropdown) {
        trigger.addEventListener('click', (e) => {
            if (ignoreClickSelector && e.target.closest(ignoreClickSelector)) {
                return;
            }
            const isCurrentlyOpen = dropdown.classList.contains('open');
            closeAllDropdowns();
            if (!isCurrentlyOpen) {
                dropdown.classList.add('open');
                trigger.classList.add('active');
                if (searchInput) {
                    setTimeout(() => searchInput.focus(), 60);
                }
            }
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            if (onSearch) onSearch(e.target.value.trim());
        });
        searchInput.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }
}

async function loadPageData() {
    try {
        const [periodsResponse, usersResponse] = await Promise.all([
            apiFetch(`/registration-periods`, { headers: getAuthHeaders() }),
            apiFetch(`/users`, { headers: getAuthHeaders() })
        ]);
        const [periodsResult, usersResult] = await Promise.all([periodsResponse.json(), usersResponse.json()]);

        if (!periodsResponse.ok || !periodsResult.success) {
            throw new Error(periodsResult.message || 'Không thể tải danh sách đợt đăng ký.');
        }
        if (!usersResponse.ok || !usersResult.success) {
            throw new Error(usersResult.message || 'Không thể tải danh sách giảng viên.');
        }

        registrationPeriods = periodsResult.data || [];
        councilLecturers = (usersResult.data || []).filter(user =>
            user.active !== false && (user.role === 'ROLE_LECTURER' || user.role === 'ROLE_DEPARTMENT_HEAD')
        );

        selectedFilterPeriodId = '';
        const hiddenFilter = document.getElementById('filterPeriodId');
        if (hiddenFilter) hiddenFilter.value = '';

        renderAllSelects();
        showCouncilMessage('Vui lòng chọn đợt đăng ký để xem danh sách hội đồng.');
    } catch (error) {
        console.error('Lỗi tải dữ liệu trang hội đồng:', error);
        showCouncilMessage(error.message || 'Không thể tải dữ liệu cần thiết.', true);
    }
}

function renderAllSelects() {
    renderFilterPeriodSelect();
    renderCouncilPeriodSelect();
    renderLecturerRolesSelects();
}

function renderLecturerRolesSelects() {
    renderChairmanSelect();
    renderSecretarySelect();
    renderCouncilMembersMultiSelect();
}

// 1. FILTER PERIOD
function renderFilterPeriodSelect() {
    const label = document.getElementById('filterPeriodLabel');
    const optionsContainer = document.getElementById('filterPeriodOptionsList');
    if (!optionsContainer) return;

    const currentPeriod = registrationPeriods.find(p => String(p.id) === String(selectedFilterPeriodId));
    if (label) {
        if (currentPeriod) {
            label.textContent = currentPeriod.name || currentPeriod.title || `Đợt ${currentPeriod.id}`;
            label.classList.remove('placeholder');
        } else {
            label.textContent = 'Chọn đợt đăng ký...';
            label.classList.add('placeholder');
        }
    }

    const query = safeRemoveTones(filterPeriodSearchQuery);
    let filtered = registrationPeriods;
    if (query) {
        filtered = filtered.filter(p => {
            const name = safeRemoveTones(p.name || p.title || `Đợt ${p.id}`);
            return name.includes(query);
        });
    }

    if (filtered.length === 0) {
        optionsContainer.innerHTML = '<div style="padding: 10px; color: #64748b; font-size: 13px; text-align: center;">Không tìm thấy đợt phù hợp</div>';
        return;
    }

    optionsContainer.innerHTML = filtered.map(p => {
        const isSelected = String(p.id) === String(selectedFilterPeriodId);
        const name = p.name || p.title || `Đợt ${p.id}`;
        return `
            <div class="select-option-item ${isSelected ? 'selected' : ''}" onclick="selectFilterPeriod('${p.id}')">
                <span>${isSelected ? '✓ ' : ''}${name}</span>
            </div>
        `;
    }).join('');
}

function selectFilterPeriod(id) {
    selectedFilterPeriodId = String(id);
    const hidden = document.getElementById('filterPeriodId');
    if (hidden) hidden.value = selectedFilterPeriodId;
    closeAllDropdowns();
    renderFilterPeriodSelect();
    loadCouncils();
}

// 2. COUNCIL PERIOD (IN MODAL)
function renderCouncilPeriodSelect() {
    const label = document.getElementById('councilPeriodLabel');
    const optionsContainer = document.getElementById('councilPeriodOptionsList');
    if (!optionsContainer) return;

    const currentPeriod = registrationPeriods.find(p => String(p.id) === String(selectedCouncilPeriodId));
    if (label) {
        label.textContent = currentPeriod ? (currentPeriod.name || currentPeriod.title || `Đợt ${currentPeriod.id}`) : 'Chọn đợt đăng ký...';
    }

    const query = safeRemoveTones(councilPeriodSearchQuery);
    let filtered = registrationPeriods;
    if (query) {
        filtered = filtered.filter(p => {
            const name = safeRemoveTones(p.name || p.title || `Đợt ${p.id}`);
            return name.includes(query);
        });
    }

    if (filtered.length === 0) {
        optionsContainer.innerHTML = '<div style="padding: 10px; color: #64748b; font-size: 13px; text-align: center;">Không tìm thấy đợt phù hợp</div>';
        return;
    }

    optionsContainer.innerHTML = filtered.map(p => {
        const isSelected = String(p.id) === String(selectedCouncilPeriodId);
        const name = p.name || p.title || `Đợt ${p.id}`;
        return `
            <div class="select-option-item ${isSelected ? 'selected' : ''}" onclick="selectCouncilPeriod('${p.id}')">
                <span>${isSelected ? '✓ ' : ''}${name}</span>
            </div>
        `;
    }).join('');
}

function selectCouncilPeriod(id) {
    selectedCouncilPeriodId = String(id);
    const hidden = document.getElementById('councilPeriodId');
    if (hidden) hidden.value = selectedCouncilPeriodId;
    closeAllDropdowns();
    renderCouncilPeriodSelect();
}

// 3. CHAIRMAN SELECT (SEARCH KHÔNG DẤU)
function renderChairmanSelect() {
    const label = document.getElementById('councilChairmanLabel');
    const optionsContainer = document.getElementById('councilChairmanOptionsList');
    if (!optionsContainer) return;

    const currentLecturer = councilLecturers.find(l => l.id === selectedChairmanId);
    if (label) {
        if (currentLecturer) {
            label.textContent = `${currentLecturer.fullName} (${currentLecturer.code || currentLecturer.username || currentLecturer.id})`;
            label.classList.remove('placeholder');
        } else {
            label.textContent = 'Chọn Chủ tịch...';
            label.classList.add('placeholder');
        }
    }

    const query = safeRemoveTones(chairmanSearchQuery);
    let filtered = councilLecturers;
    if (query) {
        filtered = filtered.filter(l => {
            const fullName = safeRemoveTones(l.fullName || '');
            const code = safeRemoveTones(l.code || l.username || '');
            return fullName.includes(query) || code.includes(query);
        });
    }

    if (filtered.length === 0) {
        optionsContainer.innerHTML = '<div style="padding: 10px; color: #64748b; font-size: 13px; text-align: center;">Không tìm thấy giảng viên phù hợp</div>';
        return;
    }

    optionsContainer.innerHTML = filtered.map(l => {
        const isSelected = l.id === selectedChairmanId;
        const isSecretary = l.id === selectedSecretaryId;
        const isMember = selectedMemberIds.includes(l.id);
        const isDisabled = isSecretary || isMember;

        let badge = '';
        if (isSecretary) badge = '<span class="multiselect-role-badge">Đang là Thư ký</span>';
        else if (isMember) badge = '<span class="multiselect-role-badge">Đang là Ủy viên</span>';

        const classes = [
            'select-option-item',
            isSelected ? 'selected' : '',
            isDisabled ? 'disabled' : ''
        ].filter(Boolean).join(' ');

        return `
            <div class="${classes}" onclick="selectChairman(${l.id})">
                <span style="flex: 1; min-width: 0;">${isSelected ? '✓ ' : ''}${l.fullName} (${l.code || l.username || l.id})</span>
                ${badge}
            </div>
        `;
    }).join('');
}

function selectChairman(id) {
    if (id === selectedSecretaryId || selectedMemberIds.includes(id)) {
        return;
    }
    selectedChairmanId = (selectedChairmanId === id) ? null : id;
    const hidden = document.getElementById('councilChairmanId');
    if (hidden) hidden.value = selectedChairmanId || '';
    closeAllDropdowns();
    renderLecturerRolesSelects();
}

// 4. SECRETARY SELECT (SEARCH KHÔNG DẤU)
function renderSecretarySelect() {
    const label = document.getElementById('councilSecretaryLabel');
    const optionsContainer = document.getElementById('councilSecretaryOptionsList');
    if (!optionsContainer) return;

    const currentLecturer = councilLecturers.find(l => l.id === selectedSecretaryId);
    if (label) {
        if (currentLecturer) {
            label.textContent = `${currentLecturer.fullName} (${currentLecturer.code || currentLecturer.username || currentLecturer.id})`;
            label.classList.remove('placeholder');
        } else {
            label.textContent = 'Chọn Thư ký...';
            label.classList.add('placeholder');
        }
    }

    const query = safeRemoveTones(secretarySearchQuery);
    let filtered = councilLecturers;
    if (query) {
        filtered = filtered.filter(l => {
            const fullName = safeRemoveTones(l.fullName || '');
            const code = safeRemoveTones(l.code || l.username || '');
            return fullName.includes(query) || code.includes(query);
        });
    }

    if (filtered.length === 0) {
        optionsContainer.innerHTML = '<div style="padding: 10px; color: #64748b; font-size: 13px; text-align: center;">Không tìm thấy giảng viên phù hợp</div>';
        return;
    }

    optionsContainer.innerHTML = filtered.map(l => {
        const isSelected = l.id === selectedSecretaryId;
        const isChairman = l.id === selectedChairmanId;
        const isMember = selectedMemberIds.includes(l.id);
        const isDisabled = isChairman || isMember;

        let badge = '';
        if (isChairman) badge = '<span class="multiselect-role-badge">Đang là Chủ tịch</span>';
        else if (isMember) badge = '<span class="multiselect-role-badge">Đang là Ủy viên</span>';

        const classes = [
            'select-option-item',
            isSelected ? 'selected' : '',
            isDisabled ? 'disabled' : ''
        ].filter(Boolean).join(' ');

        return `
            <div class="${classes}" onclick="selectSecretary(${l.id})">
                <span style="flex: 1; min-width: 0;">${isSelected ? '✓ ' : ''}${l.fullName} (${l.code || l.username || l.id})</span>
                ${badge}
            </div>
        `;
    }).join('');
}

function selectSecretary(id) {
    if (id === selectedChairmanId || selectedMemberIds.includes(id)) {
        return;
    }
    selectedSecretaryId = (selectedSecretaryId === id) ? null : id;
    const hidden = document.getElementById('councilSecretaryId');
    if (hidden) hidden.value = selectedSecretaryId || '';
    closeAllDropdowns();
    renderLecturerRolesSelects();
}

// 5. COUNCIL MEMBERS MULTI-SELECT (SEARCH KHÔNG DẤU)
function renderCouncilMembersMultiSelect() {
    renderMemberTags();
    renderMemberOptionsList();
    syncHiddenMemberInputs();
}

function renderMemberTags() {
    const tagsContainer = document.getElementById('councilMembersTags');
    if (!tagsContainer) return;

    if (selectedMemberIds.length === 0) {
        tagsContainer.innerHTML = '<span class="multiselect-placeholder">Chọn ủy viên hội đồng (tối đa 3)...</span>';
        return;
    }

    const lecturerMap = new Map(councilLecturers.map(l => [l.id, l]));
    tagsContainer.innerHTML = selectedMemberIds.map(id => {
        const lecturer = lecturerMap.get(id);
        const name = lecturer ? `${lecturer.fullName} (${lecturer.code || lecturer.username || lecturer.id})` : `GV #${id}`;
        return `
            <span class="multiselect-tag">
                <span>${name}</span>
                <span class="multiselect-tag-remove" onclick="removeMemberSelection(${id}, event)" title="Bỏ chọn">&times;</span>
            </span>
        `;
    }).join('');
}

function renderMemberOptionsList() {
    const optionsContainer = document.getElementById('councilMembersOptionsList');
    if (!optionsContainer) return;

    const isLimitReached = selectedMemberIds.length >= 3;
    const query = safeRemoveTones(memberSearchQuery);

    let filtered = councilLecturers;
    if (query) {
        filtered = filtered.filter(l => {
            const fullName = safeRemoveTones(l.fullName || '');
            const code = safeRemoveTones(l.code || l.username || '');
            return fullName.includes(query) || code.includes(query);
        });
    }

    if (filtered.length === 0) {
        optionsContainer.innerHTML = '<div style="padding: 10px; color: #64748b; font-size: 13px; text-align: center;">Không tìm thấy giảng viên phù hợp</div>';
        return;
    }

    optionsContainer.innerHTML = filtered.map(lecturer => {
        const isSelected = selectedMemberIds.includes(lecturer.id);
        const isChairman = lecturer.id === selectedChairmanId;
        const isSecretary = lecturer.id === selectedSecretaryId;
        const isDisabled = isChairman || isSecretary || (!isSelected && isLimitReached);

        let roleBadge = '';
        if (isChairman) {
            roleBadge = '<span class="multiselect-role-badge">Đang là Chủ tịch</span>';
        } else if (isSecretary) {
            roleBadge = '<span class="multiselect-role-badge">Đang là Thư ký</span>';
        } else if (!isSelected && isLimitReached) {
            roleBadge = '<span class="multiselect-limit-badge">Tối đa 3 người</span>';
        }

        const classes = [
            'multiselect-option',
            isSelected ? 'selected' : '',
            isDisabled ? 'disabled' : ''
        ].filter(Boolean).join(' ');

        return `
            <div class="${classes}" onclick="toggleMemberSelection(${lecturer.id}, event)">
                <input type="checkbox" ${isSelected ? 'checked' : ''} ${isDisabled ? 'disabled' : ''} tabindex="-1">
                <span style="flex: 1; min-width: 0;">${lecturer.fullName} (${lecturer.code || lecturer.username || lecturer.id})</span>
                ${roleBadge}
            </div>
        `;
    }).join('');
}

function toggleMemberSelection(id, event) {
    if (event) event.stopPropagation();

    if (id === selectedChairmanId || id === selectedSecretaryId) {
        return;
    }

    const index = selectedMemberIds.indexOf(id);
    if (index > -1) {
        selectedMemberIds.splice(index, 1);
    } else {
        if (selectedMemberIds.length >= 3) {
            showAlert('Hội đồng chỉ được có tối đa 3 Ủy viên (tổng quy mô hội đồng tối đa 5 người bao gồm Chủ tịch, Thư ký và tối đa 3 Ủy viên).');
            return;
        }
        selectedMemberIds.push(id);
    }

    renderLecturerRolesSelects();
}

function removeMemberSelection(id, event) {
    if (event) event.stopPropagation();
    selectedMemberIds = selectedMemberIds.filter(mId => mId !== id);
    renderLecturerRolesSelects();
}

function syncHiddenMemberInputs() {
    const hiddenContainer = document.getElementById('councilMembersHiddenInputs');
    if (!hiddenContainer) return;
    hiddenContainer.innerHTML = selectedMemberIds.map(id =>
        `<input type="checkbox" name="councilMemberId" value="${id}" checked>`
    ).join('');
}

async function loadCouncils() {
    const periodId = document.getElementById('filterPeriodId')?.value || selectedFilterPeriodId;
    if (!periodId) {
        showCouncilMessage('Vui lòng chọn đợt đăng ký.');
        return;
    }

    showCouncilMessage('Đang tải danh sách hội đồng...');
    try {
        const response = await apiFetch(`/councils/period/${encodeURIComponent(periodId)}`, {
            method: 'GET',
            headers: getAuthHeaders()
        });
        const result = await response.json();
        if (!response.ok || !result.success) {
            throw new Error(result.message || 'Không thể tải danh sách hội đồng.');
        }
        renderCouncils(result.data || []);
    } catch (error) {
        console.error('Lỗi GET hội đồng theo đợt:', error);
        showCouncilMessage(error.message || 'Không thể tải danh sách hội đồng.', true);
    }
}

function renderCouncils(councils) {
    const tbody = document.getElementById('councilTableBody');
    if (!councils.length) {
        showCouncilMessage('Chưa có dữ liệu');
        return;
    }

    tbody.innerHTML = councils.map(council => `
        <tr>
            <td><strong>HD${String(council.id).padStart(3, '0')}</strong></td>
            <td>${council.name}</td>
            <td>${council.defenseDate || '-'}</td>
            <td>${council.location || '-'}</td>
            <td>${council.chairmanName || '-'}</td>
            <td>${(council.topicIds || []).length}</td>
            <td style="text-align: right; white-space: nowrap;">
                <button type="button" onclick="viewCouncilDetail(${council.id})" class="btn btn-sm btn-action-view">👁️ Chi tiết</button>
                <button type="button" onclick="openAssignTopicsModal(${council.id})" class="btn btn-sm btn-primary">📌 Gán đề tài</button>
            </td>
        </tr>
    `).join('');
}

function showCouncilMessage(message, isError = false) {
    const tbody = document.getElementById('councilTableBody');
    if (tbody) {
        tbody.innerHTML = `<tr><td colspan="100%" class="text-center py-4${isError ? ' text-danger' : ''}">${message}</td></tr>`;
    }
}

function openCreateCouncilModal() {
    const form = document.getElementById('createCouncilForm');
    form.reset();

    selectedCouncilPeriodId = selectedFilterPeriodId ? String(selectedFilterPeriodId) : '';
    const councilPeriodInput = document.getElementById('councilPeriodId');
    if (councilPeriodInput) councilPeriodInput.value = selectedCouncilPeriodId;

    selectedChairmanId = null;
    selectedSecretaryId = null;
    selectedMemberIds = [];

    filterPeriodSearchQuery = '';
    councilPeriodSearchQuery = '';
    chairmanSearchQuery = '';
    secretarySearchQuery = '';
    memberSearchQuery = '';

    ['filterPeriodSearchInput', 'councilPeriodSearchInput', 'councilChairmanSearchInput', 'councilSecretarySearchInput', 'councilMemberSearchInput'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });

    const chairmanInput = document.getElementById('councilChairmanId');
    if (chairmanInput) chairmanInput.value = '';
    const secretaryInput = document.getElementById('councilSecretaryId');
    if (secretaryInput) secretaryInput.value = '';

    closeAllDropdowns();
    renderAllSelects();

    document.getElementById('createCouncilModal').style.display = 'flex';
}

async function createCouncil(event) {
    event.preventDefault();
    const periodId = Number.parseInt(document.getElementById('councilPeriodId')?.value || selectedCouncilPeriodId, 10);
    const chairmanId = Number.parseInt(document.getElementById('councilChairmanId')?.value || selectedChairmanId, 10);
    const secretaryId = Number.parseInt(document.getElementById('councilSecretaryId')?.value || selectedSecretaryId, 10);
    const memberIds = [...selectedMemberIds];

    if (!periodId) {
        await showAlert('Vui lòng chọn đợt đăng ký.');
        return;
    }
    if (!chairmanId) {
        await showAlert('Vui lòng chọn Chủ tịch hội đồng.');
        return;
    }
    if (!secretaryId) {
        await showAlert('Vui lòng chọn Thư ký hội đồng.');
        return;
    }
    if (chairmanId === secretaryId) {
        await showAlert('Chủ tịch và Thư ký phải là hai giảng viên khác nhau.');
        return;
    }
    if (memberIds.includes(chairmanId) || memberIds.includes(secretaryId)) {
        await showAlert('Chủ tịch, Thư ký và Ủy viên phải là các giảng viên khác nhau.');
        return;
    }
    if (memberIds.length === 0) {
        await showAlert('Hội đồng phải có ít nhất 1 Ủy viên (tổng quy mô hội đồng từ 3 đến 5 người).');
        return;
    }
    if (memberIds.length > 3) {
        await showAlert('Hội đồng chỉ được có tối đa 3 Ủy viên.');
        return;
    }

    const payload = {
        name: document.getElementById('councilName').value.trim(),
        periodId,
        defenseDate: document.getElementById('councilDefenseDate').value,
        location: document.getElementById('councilLocation').value.trim(),
        notes: document.getElementById('councilNotes').value.trim(),
        members: [
            { lecturerId: chairmanId, councilRole: 'CHAIRMAN' },
            { lecturerId: secretaryId, councilRole: 'SECRETARY' },
            ...memberIds.map(lecturerId => ({ lecturerId, councilRole: 'MEMBER' }))
        ]
    };

    try {
        const response = await apiFetch(`/councils`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (!response.ok || !result.success) {
            throw new Error(result.message || 'Không thể thành lập hội đồng.');
        }
        closeCreateCouncilModal();
        selectedFilterPeriodId = String(periodId);
        const filterInput = document.getElementById('filterPeriodId');
        if (filterInput) filterInput.value = selectedFilterPeriodId;
        renderFilterPeriodSelect();
        await loadCouncils();
    } catch (error) {
        console.error('Lỗi POST tạo hội đồng:', error);
        await showAlert(error.message || 'Không thể thành lập hội đồng.');
    }
}


async function viewCouncilDetail(councilId) {
    try {
        const response = await apiFetch(`/councils/${encodeURIComponent(councilId)}`, {
            method: 'GET',
            headers: getAuthHeaders()
        });
        const result = await response.json();
        if (!response.ok || !result.success || !result.data) {
            throw new Error(result.message || 'Không thể tải chi tiết hội đồng.');
        }

        const council = result.data;
        const topics = council.topics || [];
        const members = council.members || [];
        const committeeMembers = members
            .filter(member => member.councilRole === 'MEMBER')
            .map(member => member.lecturerName)
            .filter(Boolean)
            .join(', ') || '-';
        document.getElementById('councilDetailContent').innerHTML = `
            <div style="background: #f8fafc; padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0;">
                <p><strong>Tên hội đồng:</strong> ${council.name}</p>
                <p><strong>Đợt đăng ký:</strong> ${council.periodName || '-'}</p>
                <p><strong>Ngày bảo vệ:</strong> ${council.defenseDate || '-'}</p>
                <p><strong>Địa điểm:</strong> ${council.location || '-'}</p>
                <p><strong>Chủ tịch:</strong> ${council.chairmanName || '-'}</p>
                <p><strong>Thư ký:</strong> ${council.secretaryName || '-'}</p>
                <p><strong>Ủy viên:</strong> ${committeeMembers}</p>
                <p><strong>Ghi chú:</strong> ${council.notes || '-'}</p>
            </div>
        `;
        document.getElementById('councilDetailTopicsBody').innerHTML = topics.length
            ? topics.map(topic => `
                <tr>
                    <td><strong>${topic.code || `DT${String(topic.id).padStart(3, '0')}`}</strong></td>
                    <td>${topic.titleVi || topic.title || '-'}</td>
                    <td>${topic.primaryAdvisorName || topic.advisorName || '-'}</td>
                    <td>${topic.assignedGroupName || topic.studentGroupName || topic.group?.name || '-'}</td>
                    <td>${topic.defenseTime || council.defenseTime || council.defenseDate || '-'}</td>
                </tr>
            `).join('')
            : '<tr><td colspan="100%" class="text-center py-4">Chưa có dữ liệu</td></tr>';
        document.getElementById('councilDetailModal').style.display = 'flex';
    } catch (error) {
        console.error('Lỗi GET chi tiết hội đồng:', error);
        await showAlert(error.message || 'Không thể tải chi tiết hội đồng.');
    }
}

async function openAssignTopicsModal(councilId) {
    try {
        const response = await apiFetch(`/councils/${encodeURIComponent(councilId)}`, {
            method: 'GET',
            headers: getAuthHeaders()
        });
        const result = await response.json();
        if (!response.ok || !result.success || !result.data) {
            throw new Error(result.message || 'Không thể tải thông tin hội đồng.');
        }

        const council = result.data;
        const topicsResponse = await apiFetch(`/topics?periodId=${encodeURIComponent(council.periodId)}`, {
            method: 'GET',
            headers: getAuthHeaders()
        });
        const topicsResult = await topicsResponse.json();
        if (!topicsResponse.ok || !topicsResult.success) {
            throw new Error(topicsResult.message || 'Không thể tải danh sách đề tài.');
        }

        const currentIds = new Set(council.topicIds || []);
        const topics = topicsResult.data || [];
        const topicsList = document.getElementById('councilTopicsList');
        topicsList.innerHTML = topics.map(topic => `
            <label style="display: flex; align-items: flex-start; gap: 10px; padding: 8px 12px; border-radius: 6px; border: 1px solid #e2e8f0; background: #ffffff; cursor: pointer; margin-bottom: 4px;">
                <input type="checkbox" name="councilTopicId" value="${topic.id}" ${currentIds.has(topic.id) ? 'checked' : ''} style="width: 18px; height: 18px; min-width: 18px; max-width: 18px; margin: 0; padding: 0; margin-top: 2px; flex-shrink: 0; cursor: pointer;">
                <span style="font-size: 13.5px; color: #1e293b;"><strong>${topic.code || `DT${String(topic.id).padStart(3, '0')}`}</strong> — ${topic.titleVi || topic.title || ''}</span>
            </label>
        `).join('') || '<span style="color: #64748b;">Đợt này chưa có đề tài.</span>';
        document.getElementById('assignCouncilId').value = council.id;
        document.getElementById('assignCouncilName').textContent = council.name;
        document.getElementById('assignCouncilNotes').value = council.notes || '';
        document.getElementById('assignDefenseTime').value = getDefenseDateTimeInputValue(council);
        document.getElementById('assignTopicsModal').style.display = 'flex';
    } catch (error) {
        console.error('Lỗi mở modal gán đề tài:', error);
        await showAlert(error.message || 'Không thể mở form gán đề tài.');
    }
}

async function assignTopics(event) {
    event.preventDefault();
    const councilId = document.getElementById('assignCouncilId').value;
    const topicIds = Array.from(document.querySelectorAll('input[name="councilTopicId"]:checked'))
        .map(input => Number.parseInt(input.value, 10));
    const defenseTime = document.getElementById('assignDefenseTime').value;
    if (!defenseTime) {
        await showAlert('Vui lòng chọn thời gian bảo vệ.');
        return;
    }
    const payload = {
        topicIds,
        defenseDate: defenseTime.replace('T', ' '),
        defenseTime: new Date(defenseTime).toISOString(),
        notes: document.getElementById('assignCouncilNotes').value.trim()
    };

    try {
        const response = await apiFetch(`/councils/${encodeURIComponent(councilId)}/assign-topics`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (!response.ok || !result.success) {
            throw new Error(result.message || 'Không thể gán đề tài cho hội đồng.');
        }
        closeAssignTopicsModal();
        await loadCouncils();
    } catch (error) {
        console.error('Lỗi POST gán đề tài:', error);
        await showAlert(error.message || 'Không thể gán đề tài cho hội đồng.');
    }
}

function getDefenseDateTimeInputValue(council) {
    const storedDateTime = council.defenseDate && council.defenseDate.includes('T')
        ? council.defenseDate
        : council.defenseDate && council.defenseDate.includes(' ')
            ? council.defenseDate.replace(' ', 'T')
            : council.defenseTime;
    if (storedDateTime && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(storedDateTime)) {
        return storedDateTime.slice(0, 16);
    }
    if (storedDateTime) {
        const parsedDate = new Date(storedDateTime);
        if (!Number.isNaN(parsedDate.getTime())) {
            const localDate = new Date(parsedDate.getTime() - parsedDate.getTimezoneOffset() * 60000);
            return localDate.toISOString().slice(0, 16);
        }
    }
    return council.defenseDate ? `${council.defenseDate.slice(0, 10)}T09:00` : '';
}

function closeCreateCouncilModal() {
    document.getElementById('createCouncilModal').style.display = 'none';
}

function closeAssignTopicsModal() {
    document.getElementById('assignTopicsModal').style.display = 'none';
}

function closeCouncilDetailModal() {
    document.getElementById('councilDetailModal').style.display = 'none';
}

window.viewCouncilDetail = viewCouncilDetail;
window.openAssignTopicsModal = openAssignTopicsModal;
window.closeCreateCouncilModal = closeCreateCouncilModal;
window.closeAssignTopicsModal = closeAssignTopicsModal;
window.closeCouncilDetailModal = closeCouncilDetailModal;
window.removeMemberSelection = removeMemberSelection;
window.toggleMemberSelection = toggleMemberSelection;
window.selectChairman = selectChairman;
window.selectSecretary = selectSecretary;
window.selectCouncilPeriod = selectCouncilPeriod;
window.selectFilterPeriod = selectFilterPeriod;


function resetFilters() {
    document.getElementById('filterPeriodId').value = '';
    document.getElementById('filterPeriodSearchInput').value = '';
    selectedFilterPeriodId = '';
    filterPeriodSearchQuery = '';
    renderFilterPeriodSelect();
    document.querySelectorAll('.filter-card .custom-multiselect-dropdown.open').forEach(dropdown => dropdown.classList.remove('open'));
    loadCouncils();
}
