function getToken() {
    return localStorage.getItem('token');
}

function getAuthHeaders() {
    return {    
        'Authorization': `Bearer ${getToken()}`,
        'Content-Type': 'application/json'
    };
}

let registrationPeriods = [];
let availableLecturers = [];
let selectedFilterPeriodId = '';
let selectedReviewerId = '';

let filterPeriodSearchQuery = '';
let assignReviewerSearchQuery = '';

function safeRemoveTones(str) {
    if (typeof window.removeVietnameseTones === 'function') {
        return window.removeVietnameseTones(str);
    }
    return (str || '').toLowerCase();
}

document.addEventListener('DOMContentLoaded', () => {
    setupDropdownEvents();
    loadRegistrationPeriods();
    document.getElementById('btnLoadAssignments')?.addEventListener('click', loadReviewerAssignments);
    document.getElementById('assignReviewerForm')?.addEventListener('submit', assignReviewer);
});

function setupDropdownEvents() {
    setupSingleSelectDropdown({
        containerId: 'filterPeriodContainer',
        triggerId: 'filterPeriodTrigger',
        dropdownId: 'filterPeriodDropdown',
        searchInputId: 'filterPeriodSearchInput',
        onSearch: (q) => {
            filterPeriodSearchQuery = q;
            renderFilterPeriodSelect();
        }
    });

    setupSingleSelectDropdown({
        containerId: 'assignReviewerContainer',
        triggerId: 'assignReviewerTrigger',
        dropdownId: 'assignReviewerDropdown',
        searchInputId: 'assignReviewerSearchInput',
        onSearch: (q) => {
            assignReviewerSearchQuery = q;
            renderAssignReviewerSelect();
        }
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('#filterPeriodContainer')) {
            document.getElementById('filterPeriodDropdown')?.classList.remove('open');
        }
        if (!e.target.closest('#assignReviewerContainer')) {
            document.getElementById('assignReviewerDropdown')?.classList.remove('open');
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

async function loadRegistrationPeriods() {
    try {
        const response = await apiFetch(`/registration-periods`, {
            method: 'GET',
            headers: getAuthHeaders()
        });
        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || 'Không thể tải danh sách đợt đăng ký.');
        }

        registrationPeriods = result.data || [];
        selectedFilterPeriodId = '';
        const hidden = document.getElementById('filterPeriodId');
        if (hidden) hidden.value = '';
        renderFilterPeriodSelect();
        showReviewerTableMessage('Vui lòng chọn đợt đăng ký để xem danh sách phân công.');
    } catch (error) {
        console.error('Lỗi tải danh sách đợt đăng ký:', error);
        showReviewerTableMessage(error.message || 'Không thể tải danh sách đợt đăng ký.', true);
    }
}

function renderFilterPeriodSelect() {
    const label = document.getElementById('filterPeriodLabel');
    const optionsContainer = document.getElementById('filterPeriodOptionsList');
    if (!label || !optionsContainer) return;

    const currentPeriod = registrationPeriods.find(p => String(p.id) === String(selectedFilterPeriodId));
    if (currentPeriod) {
        label.textContent = currentPeriod.name || currentPeriod.title || `Đợt ${currentPeriod.id}`;
        label.classList.remove('placeholder');
    } else {
        label.textContent = 'Chọn đợt đăng ký...';
        label.classList.add('placeholder');
    }

    const query = safeRemoveTones(filterPeriodSearchQuery);
    const filtered = registrationPeriods.filter(p => {
        const title = safeRemoveTones(p.name || p.title || `Đợt ${p.id}`);
        return !query || title.includes(query);
    });

    if (filtered.length === 0) {
        optionsContainer.innerHTML = '<div class="select-option-empty">Không tìm thấy đợt đăng ký nào</div>';
        return;
    }

    optionsContainer.innerHTML = filtered.map(p => {
        const isSelected = String(p.id) === String(selectedFilterPeriodId);
        return `
            <div class="select-option-item ${isSelected ? 'selected' : ''}" onclick="selectFilterPeriod('${p.id}')">
                <span>${p.name || p.title || `Đợt ${p.id}`}</span>
            </div>
        `;
    }).join('');
}

function selectFilterPeriod(id) {
    selectedFilterPeriodId = String(id);
    const hidden = document.getElementById('filterPeriodId');
    if (hidden) hidden.value = selectedFilterPeriodId;
    document.getElementById('filterPeriodDropdown')?.classList.remove('open');
    renderFilterPeriodSelect();
    loadReviewerAssignments();
}

function renderAssignReviewerSelect() {
    const label = document.getElementById('assignReviewerLabel');
    const optionsContainer = document.getElementById('assignReviewerOptionsList');
    if (!label || !optionsContainer) return;

    const currentLecturer = availableLecturers.find(l => String(l.id) === String(selectedReviewerId));
    if (currentLecturer) {
        label.textContent = `${currentLecturer.fullName} (${currentLecturer.code || currentLecturer.username || currentLecturer.id})`;
        label.classList.remove('placeholder');
    } else {
        label.textContent = 'Chọn giảng viên...';
        label.classList.add('placeholder');
    }

    const query = safeRemoveTones(assignReviewerSearchQuery);
    const filtered = availableLecturers.filter(l => {
        const name = safeRemoveTones(l.fullName || '');
        const code = safeRemoveTones(l.code || l.username || '');
        return !query || name.includes(query) || code.includes(query);
    });

    if (filtered.length === 0) {
        optionsContainer.innerHTML = '<div class="select-option-empty">Không tìm thấy giảng viên nào</div>';
        return;
    }

    optionsContainer.innerHTML = filtered.map(l => {
        const isSelected = String(l.id) === String(selectedReviewerId);
        return `
            <div class="select-option-item ${isSelected ? 'selected' : ''}" onclick="selectAssignReviewer('${l.id}')">
                <span>${l.fullName} (${l.code || l.username || l.id})</span>
            </div>
        `;
    }).join('');
}

function selectAssignReviewer(id) {
    selectedReviewerId = String(id);
    const hidden = document.getElementById('assignReviewerId');
    if (hidden) hidden.value = selectedReviewerId;
    document.getElementById('assignReviewerDropdown')?.classList.remove('open');
    renderAssignReviewerSelect();
}

async function loadReviewerAssignments() {
    const periodId = document.getElementById('filterPeriodId')?.value || selectedFilterPeriodId;
    if (!periodId) {
        showReviewerTableMessage('Vui lòng chọn đợt đăng ký.');
        return;
    }

    showReviewerTableMessage('Đang tải danh sách phân công...');

    try {
        const [assignmentsResponse, topicsResponse] = await Promise.all([
            apiFetch(`/reviewers/period/${encodeURIComponent(periodId)}`, {
                method: 'GET',
                headers: getAuthHeaders()
            }),
            apiFetch(`/topics?periodId=${encodeURIComponent(periodId)}&approvalStatus=APPROVED`, {
                method: 'GET',
                headers: getAuthHeaders()
            })
        ]);
        const result = await assignmentsResponse.json();
        const topicsResult = await topicsResponse.json();

        if (!assignmentsResponse.ok || !result.success) {
            throw new Error(result.message || 'Không thể tải danh sách phân công.');
        }
        if (!topicsResponse.ok || !topicsResult.success) {
            throw new Error(topicsResult.message || 'Không thể tải danh sách đề tài đã duyệt.');
        }

        const assignmentsByTopicId = new Map((result.data || []).map(assignment => [Number(assignment.topicId), assignment]));
        const approvedTopics = (topicsResult.data || []).filter(topic =>
            (topic.approvalStatus || topic.status) === 'APPROVED'
        );
        renderReviewerAssignments(approvedTopics.map(topic => {
            const assignment = assignmentsByTopicId.get(Number(topic.id));
            return {
                ...topic,
                reviewerId: assignment?.reviewerId || null,
                reviewerName: assignment?.reviewerName || null,
                score: assignment?.score ?? null,
                submittedAt: assignment?.submittedAt ?? null
            };
        }));
    } catch (error) {
        console.error('Lỗi GET danh sách phân công GVPB:', error);
        showReviewerTableMessage(error.message || 'Không thể tải danh sách phân công.', true);
    }
}

function renderReviewerAssignments(topics) {
    const tbody = document.getElementById('reviewerTableBody');
    if (!tbody) return;

    if (!topics.length) {
        showReviewerTableMessage('Chưa có dữ liệu');
        return;
    }

    tbody.innerHTML = topics.map(topic => {
        const hasAssigned = Boolean(topic.reviewerId || topic.reviewer?.id);
        const hasReviewResult = topic.score != null || topic.submittedAt != null;
        const reviewerName = hasAssigned
            ? topic.reviewerName || topic.reviewer?.fullName || '-'
            : 'Chưa phân công';
        const statusBadge = !hasAssigned
            ? '<span class="badge" style="background-color: #e2e8f0; color: #475569;">Chưa phân công</span>'
            : hasReviewResult
                ? '<span class="badge badge-success">Đã nộp nhận xét</span>'
                : '<span class="badge" style="background-color: #fef3c7; color: #b45309;">Đang chờ PB chấm</span>';

        return `
            <tr>
                <td><strong>${topic.code || `DT${String(topic.id).padStart(3, '0')}`}</strong></td>
                <td>${topic.titleVi || topic.topicTitle || '-'}</td>
                <td>${topic.primaryAdvisorName || topic.advisorName || '-'}</td>
                <td>${reviewerName}</td>
                <td>${statusBadge}</td>
                <td style="text-align: right;">
                    <button type="button" onclick="openAssignReviewerModal(${topic.periodId}, ${topic.id})" class="btn btn-sm btn-primary">
                        ${topic.reviewerId || topic.reviewer?.id ? 'Đổi GVPB' : 'Phân công'}
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

async function openAssignReviewerModal(periodId, topicId) {
    try {
        const [assignmentsResponse, topicsResponse, usersResponse] = await Promise.all([
            apiFetch(`/reviewers/period/${encodeURIComponent(periodId)}`, {
                method: 'GET',
                headers: getAuthHeaders()
            }),
            apiFetch(`/topics?periodId=${encodeURIComponent(periodId)}&approvalStatus=APPROVED`, {
                method: 'GET',
                headers: getAuthHeaders()
            }),
            apiFetch(`/users`, {
                method: 'GET',
                headers: getAuthHeaders()
            })
        ]);
        const assignmentsResult = await assignmentsResponse.json();
        const topicsResult = await topicsResponse.json();
        const usersResult = await usersResponse.json();

        if (!assignmentsResponse.ok || !assignmentsResult.success) {
            throw new Error(assignmentsResult.message || 'Không thể tải thông tin đề tài.');
        }
        if (!topicsResponse.ok || !topicsResult.success) {
            throw new Error(topicsResult.message || 'Không thể tải danh sách đề tài đã duyệt.');
        }
        if (!usersResponse.ok || !usersResult.success) {
            throw new Error(usersResult.message || 'Không thể tải danh sách giảng viên.');
        }

        const topic = (topicsResult.data || []).find(item => Number(item.id) === Number(topicId));
        if (!topic) throw new Error('Không tìm thấy đề tài trong đợt đã chọn.');
        const existingAssignment = (assignmentsResult.data || []).find(item => Number(item.topicId) === Number(topicId));

        availableLecturers = (usersResult.data || []).filter(user =>
            user.active !== false &&
            (user.role === 'ROLE_LECTURER' || user.role === 'ROLE_DEPARTMENT_HEAD') &&
            Number(user.id) !== Number(topic.primaryAdvisorId)
        );

        selectedReviewerId = existingAssignment?.reviewerId ? String(existingAssignment.reviewerId) : '';
        assignReviewerSearchQuery = '';
        const hiddenReviewer = document.getElementById('assignReviewerId');
        if (hiddenReviewer) hiddenReviewer.value = selectedReviewerId;

        renderAssignReviewerSelect();

        document.getElementById('reviewerHelp').textContent = availableLecturers.length
            ? 'Giảng viên hướng dẫn không được chọn làm giảng viên phản biện.'
            : 'Không có giảng viên phù hợp (có thể do trùng giảng viên hướng dẫn).';
        document.getElementById('assignPeriodId').value = periodId;
        document.getElementById('assignTopicId').value = topicId;
        document.getElementById('assignTopicTitle').textContent = topic.titleVi || topic.topicTitle || '-';
        document.getElementById('assignAdvisorName').textContent = topic.primaryAdvisorName || topic.advisorName || 'Chưa phân công';
        document.getElementById('assignReviewerModal').style.display = 'flex';
    } catch (error) {
        console.error('Lỗi mở form phân công GVPB:', error);
        await showAlert(error.message || 'Không thể mở form phân công.');
    }
}

async function assignReviewer(event) {
    event.preventDefault();

    const reviewerIdVal = document.getElementById('assignReviewerId').value;
    if (!reviewerIdVal) {
        await showAlert('Vui lòng chọn giảng viên phản biện.');
        return;
    }

    const payload = {
        periodId: Number.parseInt(document.getElementById('assignPeriodId').value, 10),
        topicId: Number.parseInt(document.getElementById('assignTopicId').value, 10),
        reviewerId: Number.parseInt(reviewerIdVal, 10)
    };

    try {
        const response = await apiFetch(`/reviewers/assign`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });
        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || 'Không thể lưu phân công GVPB.');
        }

        closeAssignReviewerModal();
        await loadReviewerAssignments();
    } catch (error) {
        console.error('Lỗi POST phân công GVPB:', error);
        await showAlert(error.message || 'Không thể lưu phân công GVPB.');
    }
}

function closeAssignReviewerModal() {
    document.getElementById('assignReviewerModal').style.display = 'none';
}

function showReviewerTableMessage(message, isError = false) {
    const tbody = document.getElementById('reviewerTableBody');
    if (tbody) {
        tbody.innerHTML = `<tr><td colspan="100%" class="text-center py-4${isError ? ' text-danger' : ''}">${message}</td></tr>`;
    }
}

window.selectFilterPeriod = selectFilterPeriod;
window.selectAssignReviewer = selectAssignReviewer;
window.loadReviewerAssignments = loadReviewerAssignments;
window.openAssignReviewerModal = openAssignReviewerModal;
window.closeAssignReviewerModal = closeAssignReviewerModal;

function resetFilters() {
    document.getElementById('filterPeriodId').value = '';
    document.getElementById('filterPeriodSearchInput').value = '';
    selectedFilterPeriodId = '';
    filterPeriodSearchQuery = '';
    renderFilterPeriodSelect();
    document.querySelectorAll('.filter-card .custom-multiselect-dropdown.open').forEach(dropdown => dropdown.classList.remove('open'));
    loadReviewerAssignments();
}
