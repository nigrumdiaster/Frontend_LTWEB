// Format hiển thị Tiếng Việt cho Type và Status
function formatType(type) {
    const typeMap = {
        'COURSE_PROJECT': 'Đồ án môn học',
        'SCIENTIFIC_RESEARCH': 'NCKH',
        'SPECIALIZED_PROJECT': 'TL chuyên ngành',
        'GRADUATION_THESIS': 'Khóa luận tốt nghiệp'
    };
    return typeMap[type] || type;
}

function formatStatusBadge(status) {
    const statusMap = {
        'DRAFT': { text: 'Nháp', class: 'badge-secondary' },
        'PHASE1_LECTURER_REGISTRATION': { text: 'ĐK Giảng viên', class: 'badge-role' },
        'PHASE1_REVIEWING': { text: 'Duyệt đề tài GV', class: 'badge-role' },
        'PHASE2_STUDENT_REGISTRATION': { text: 'ĐK Sinh viên', class: 'badge-success' },
        'IN_PROGRESS': { text: 'Đang thực hiện', class: 'badge-success' },
        'REVIEWING': { text: 'Đang phản biện', class: 'badge-role' },
        'DEFENSE': { text: 'Bảo vệ hội đồng', class: 'badge-role' },
        'COMPLETED': { text: 'Hoàn thành', class: 'badge-success' },
        'CANCELLED': { text: 'Đã hủy', class: 'badge-danger' }
    };
    const item = statusMap[status] || { text: status, class: '' };
    return `<span class="badge ${item.class}">${item.text}</span>`;
}

function formatDateDisplay(isoStr) {
    if (!isoStr) return '-';
    const date = new Date(isoStr);
    return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function getToken() {
    return localStorage.getItem('token');
}

document.addEventListener('DOMContentLoaded', () => {
    loadRegistrationPeriods();

    const createForm = document.getElementById('createPeriodForm');
    if (createForm) createForm.addEventListener('submit', handleCreateRegistrationPeriod);

    const editForm = document.getElementById('editPeriodForm');
    if (editForm) editForm.addEventListener('submit', handleEditRegistrationPeriod);

    const statusForm = document.getElementById('statusForm');
    if (statusForm) statusForm.addEventListener('submit', handleUpdateStatus);
});

// 1. GET /api/registration-periods
async function loadRegistrationPeriods() {
    showTableMessage('Đang tải dữ liệu...');
    const type = document.getElementById('filterType')?.value || '';
    const status = document.getElementById('filterStatus')?.value || '';

    let queryParams = new URLSearchParams();
    if (type) queryParams.append('type', type);
    if (status) queryParams.append('status', status);

    try {
        const response = await apiFetch(`/registration-periods?${queryParams.toString()}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${getToken()}`,
                'Content-Type': 'application/json'
            }
        });

        const result = await response.json();
        if (response.ok && result.success) {
            const periods = Array.isArray(result.data) ? result.data : [];
            populateFilterOptions(
                document.getElementById('filterType'),
                periods.map(period => period.type),
                'Tất cả loại đợt',
                formatType
            );
            populateFilterOptions(
                document.getElementById('filterStatus'),
                periods.map(period => period.status),
                'Tất cả trạng thái',
                status => status.replace(/_/g, ' ')
            );
            renderRegistrationPeriodsTable(periods);
        } else {
            showTableMessage(`❌ Lỗi: ${result.message || 'Không thể tải danh sách'}`);
        }
    } catch (error) {
        console.error('Lỗi GET /api/registration-periods:', error);
        showTableMessage('❌ Không kết nối được tới Server.');
    }
}

function renderRegistrationPeriodsTable(periods) {
    const tbody = document.getElementById('periodTableBody');
    if (!tbody) return;

    if (!periods || periods.length === 0) {
        tbody.innerHTML = '<tr><td colspan="100%" class="text-center py-4">Chưa có dữ liệu</td></tr>';
        return;
    }

    tbody.innerHTML = periods.map(p => `
        <tr>
            <td>${p.id}</td>
            <td>
                <strong>${p.name}</strong><br>
                <small style="color: var(--primary); font-weight: 600;">${formatType(p.type)}</small>
            </td>
            <td>${p.semester} - ${p.academicYear}</td>
            <td>
                <small>Từ: ${formatDateDisplay(p.lecturerRegStart)}</small><br>
                <small>Đến: ${formatDateDisplay(p.lecturerRegEnd)}</small>
            </td>
            <td>
                <small>Từ: ${formatDateDisplay(p.studentRegStart)}</small><br>
                <small>Đến: ${formatDateDisplay(p.studentRegEnd)}</small>
            </td>
            <td>
                <small>PB: ${p.reviewerDeadline || '-'}</small><br>
                <small>BV: ${p.defenseDate || '-'}</small>
            </td>
            <td>${formatStatusBadge(p.status)}</td>
            <td style="text-align: right;">
                <button onclick="openStatusModal(${p.id}, '${p.status}')" class="btn btn-sm btn-ghost" title="Đổi trạng thái">🔄 Trạng thái</button>
                <button onclick="openEditRegistrationPeriodModal(${p.id})" class="btn btn-sm btn-action-edit">Sửa</button>
                <button onclick="deleteRegistrationPeriod(${p.id})" class="btn btn-sm btn-action-delete">Xóa</button>
            </td>
        </tr>
    `).join('');
}

function showTableMessage(msg) {
    const tbody = document.getElementById('periodTableBody');
    if (tbody) {
        tbody.innerHTML = `<tr><td colspan="100%" class="text-center py-4">${msg}</td></tr>`;
    }
}

// 2. POST /api/registration-periods
async function handleCreateRegistrationPeriod(e) {
    e.preventDefault();

    const payload = {
        name: document.getElementById('createName').value.trim(),
        type: document.getElementById('createType').value,
        semester: document.getElementById('createSemester').value.trim(),
        academicYear: document.getElementById('createAcademicYear').value.trim(),
        description: document.getElementById('createDescription').value.trim(),
        lecturerRegStart: new Date(document.getElementById('createLecturerRegStart').value).toISOString(),
        lecturerRegEnd: new Date(document.getElementById('createLecturerRegEnd').value).toISOString(),
        studentRegStart: new Date(document.getElementById('createStudentRegStart').value).toISOString(),
        studentRegEnd: new Date(document.getElementById('createStudentRegEnd').value).toISOString(),
        reviewerDeadline: document.getElementById('createReviewerDeadline').value,
        defenseDate: document.getElementById('createDefenseDate').value
    };

    try {
        const response = await apiFetch(`/registration-periods`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${getToken()}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        if (response.ok && result.success) {
            await showAlert('✅ Tạo đợt đăng ký mới thành công!');
            closeModal('createPeriodModal');
            document.getElementById('createPeriodForm').reset();
            loadRegistrationPeriods();
        } else {
            await showAlert(result.message || 'Tạo thất bại!');
        }
    } catch (error) {
        console.error('Lỗi POST /api/registration-periods:', error);
    }
}

// 3. GET /api/registration-periods/{id} & OPEN EDIT MODAL
async function openEditRegistrationPeriodModal(id) {
    try {
        const response = await apiFetch(`/registration-periods/${id}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${getToken()}`,
                'Content-Type': 'application/json'
            }
        });

        const result = await response.json();
        if (response.ok && result.success) {
            const data = result.data;
            document.getElementById('editPeriodId').value = data.id;
            document.getElementById('editName').value = data.name || '';
            document.getElementById('editType').value = data.type;
            document.getElementById('editSemester').value = data.semester || '';
            document.getElementById('editAcademicYear').value = data.academicYear || '';
            document.getElementById('editDescription').value = data.description || '';

            if (data.lecturerRegStart) document.getElementById('editLecturerRegStart').value = data.lecturerRegStart.slice(0, 16);
            if (data.lecturerRegEnd) document.getElementById('editLecturerRegEnd').value = data.lecturerRegEnd.slice(0, 16);
            if (data.studentRegStart) document.getElementById('editStudentRegStart').value = data.studentRegStart.slice(0, 16);
            if (data.studentRegEnd) document.getElementById('editStudentRegEnd').value = data.studentRegEnd.slice(0, 16);
            
            document.getElementById('editReviewerDeadline').value = data.reviewerDeadline || '';
            document.getElementById('editDefenseDate').value = data.defenseDate || '';

            document.getElementById('editPeriodModal').style.display = 'flex';
        }
    } catch (error) {
        console.error('Lỗi GET detail period:', error);
    }
}

// 4. PUT /api/registration-periods/{id}
async function handleEditRegistrationPeriod(e) {
    e.preventDefault();
    const id = document.getElementById('editPeriodId').value;

    const payload = {
        name: document.getElementById('editName').value.trim(),
        type: document.getElementById('editType').value,
        semester: document.getElementById('editSemester').value.trim(),
        academicYear: document.getElementById('editAcademicYear').value.trim(),
        description: document.getElementById('editDescription').value.trim(),
        lecturerRegStart: new Date(document.getElementById('editLecturerRegStart').value).toISOString(),
        lecturerRegEnd: new Date(document.getElementById('editLecturerRegEnd').value).toISOString(),
        studentRegStart: new Date(document.getElementById('editStudentRegStart').value).toISOString(),
        studentRegEnd: new Date(document.getElementById('editStudentRegEnd').value).toISOString(),
        reviewerDeadline: document.getElementById('editReviewerDeadline').value,
        defenseDate: document.getElementById('editDefenseDate').value
    };

    try {
        const response = await apiFetch(`/registration-periods/${id}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${getToken()}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        if (response.ok && result.success) {
            await showAlert('✅ Cập nhật đợt đăng ký thành công!');
            closeModal('editPeriodModal');
            loadRegistrationPeriods();
        } else {
            await showAlert(result.message || 'Cập nhật thất bại!');
        }
    } catch (error) {
        console.error('Lỗi PUT /api/registration-periods/{id}:', error);
    }
}

// 5. PATCH /api/registration-periods/{id}/status
function openStatusModal(id, currentStatus) {
    document.getElementById('statusPeriodId').value = id;
    document.getElementById('updateStatusSelect').value = currentStatus;
    document.getElementById('statusModal').style.display = 'flex';
}

async function handleUpdateStatus(e) {
    e.preventDefault();
    const id = document.getElementById('statusPeriodId').value;
    const newStatus = document.getElementById('updateStatusSelect').value;

    try {
        const response = await apiFetch(`/registration-periods/${id}/status`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${getToken()}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: newStatus })
        });

        const result = await response.json();
        if (response.ok && result.success) {
            await showAlert('✅ Đổi trạng thái thành công!');
            closeModal('statusModal');
            loadRegistrationPeriods();
        } else {
            await showAlert(result.message || 'Cập nhật trạng thái thất bại!');
        }
    } catch (error) {
        console.error('Lỗi PATCH status:', error);
    }
}

// 6. DELETE /api/registration-periods/{id}
async function deleteRegistrationPeriod(id) {
    if (!(await confirmAction(`Bạn có chắc chắn muốn xóa đợt đăng ký ID = ${id}?`))) return;

    try {
        const response = await apiFetch(`/registration-periods/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${getToken()}`,
                'Content-Type': 'application/json'
            }
        });

        const result = await response.json();
        if (response.ok && result.success) {
            await showAlert('✅ Đã xóa đợt đăng ký!');
            loadRegistrationPeriods();
        } else {
            await showAlert(result.message || 'Xóa thất bại!');
        }
    } catch (error) {
        console.error('Lỗi DELETE /api/registration-periods/{id}:', error);
    }
}

function openCreateModal() {
    document.getElementById('createPeriodModal').style.display = 'flex';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}
function resetFilters() {
    document.getElementById('filterType').value = '';
    document.getElementById('filterStatus').value = '';
    document.querySelectorAll('.filter-card .custom-multiselect-dropdown.open').forEach(dropdown => dropdown.classList.remove('open'));
    loadRegistrationPeriods();
}
