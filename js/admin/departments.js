function getToken() {
    return localStorage.getItem('token');
}

// Gọi tự động khi trang vừa nạp xong
document.addEventListener('DOMContentLoaded', async () => {
    await Promise.all([loadDepartments(), loadLecturerOptions()]);

    const createForm = document.getElementById('createDeptForm');
    if (createForm) {
        createForm.addEventListener('submit', handleCreateDepartment);
    }

    const editForm = document.getElementById('editDeptForm');
    if (editForm) {
        editForm.addEventListener('submit', handleEditDepartment);
    }
});

async function loadLecturerOptions() {
    try {
        const response = await apiFetchAll('/users?role=ROLE_LECTURER', { method: 'GET' });
        const result = await response.json();
        if (!response.ok || !result.success || !Array.isArray(result.data)) {
            throw new Error(result.message || 'Không thể tải danh sách giảng viên.');
        }

        ['createHeadLecturerId', 'editHeadLecturerId'].forEach(id => {
            const select = document.getElementById(id);
            if (!select) return;
            select.replaceChildren(
                new Option('Chọn giảng viên...', ''),
                ...result.data.map(lecturer => new Option(
                    lecturer.fullName || lecturer.name || lecturer.username || `Giảng viên ${lecturer.id}`,
                    lecturer.id
                ))
            );
        });
    } catch (error) {
        console.error('Lỗi khi tải danh sách giảng viên:', error);
    }
}

// 1. GET /api/departments - Lấy danh sách bộ môn
async function loadDepartments() {
    showTableMessage('Đang tải dữ liệu...');
    try {
        const response = await apiFetchTable(`/departments`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${getToken()}`,
                'Content-Type': 'application/json'
            }
        }, 'deptTableBody', loadDepartments);

        const result = await response.json();

        if (response.ok && result.success) {
            renderDepartmentsTable(result.data);
        } else {
            showTableMessage(`❌ Lỗi: ${result.message || 'Không thể tải danh sách bộ môn'}`);
        }
    } catch (error) {
        console.error('Lỗi GET /api/departments:', error);
        showTableMessage('❌ Không thể kết nối đến máy chủ!');
    }
}

// 2. Render dữ liệu vào thẻ <tbody>
const departmentDeleteLabels = new Map();

function renderDepartmentsTable(departments) {
    departmentDeleteLabels.clear();
    (departments || []).forEach(department => departmentDeleteLabels.set(String(department.id), department.name || department.code));
    const tbody = document.getElementById('deptTableBody');
    if (!tbody) return;

    if (!departments || departments.length === 0) {
        tbody.innerHTML = '<tr><td colspan="100%" class="text-center py-4">Chưa có dữ liệu</td></tr>';
        return;
    }

    tbody.innerHTML = departments.map(d => `
        <tr>
            <td>${d.id}</td>
            <td><strong>${escapeText(d.code || '-')}</strong></td>
            <td><strong>${escapeText(d.name || '-')}</strong></td>
            <td>${escapeText(d.description || '-')}</td>
            <td>${d.headLecturerName ? `${escapeText(d.headLecturerName)} <small style="color: #64748b;">(ID: ${d.headLecturerId})</small>` : '<em style="color:#94a3b8;">Chưa gán</em>'}</td>
            <td>${escapeText(d.createdAt || '-')}</td>
            <td style="text-align: right;">
                <button onclick="openEditDeptModal(${d.id})" class="btn btn-sm btn-action-edit">Sửa</button>
                <button onclick="deleteDepartment(${d.id})" class="btn btn-sm btn-action-delete">Xóa</button>
            </td>
        </tr>
    `).join('');
}

function showTableMessage(msg) {
    const tbody = document.getElementById('deptTableBody');
    if (tbody) {
        tbody.innerHTML = `<tr><td colspan="100%" class="text-center py-4">${msg}</td></tr>`;
    }
}

// 3. POST /api/departments - Tạo bộ môn mới
async function handleCreateDepartment(e) {
    e.preventDefault();
    const headIdVal = document.getElementById('createHeadLecturerId')?.value;

    const payload = {
        code: document.getElementById('createDeptCode').value.trim(),
        name: document.getElementById('createDeptName').value.trim(),
        description: document.getElementById('createDeptDesc').value.trim(),
        headLecturerId: headIdVal ? parseInt(headIdVal) : null
    };

    try {
        const response = await apiFetch(`/departments`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${getToken()}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        if (response.ok && result.success) {
            await showAlert('✅ Tạo bộ môn mới thành công!');
            closeModal('createDeptModal');
            document.getElementById('createDeptForm').reset();
            loadDepartments();
        } else {
            await showAlert(result.message || 'Tạo thất bại!');
        }
    } catch (error) {
        console.error('Lỗi POST /api/departments:', error);
        await showAlert('Không thể tạo bộ môn. Vui lòng thử lại.', 'error');
    }
}

// 4. GET /api/departments/{id} - Mở modal sửa bộ môn
async function openEditDeptModal(id) {
    try {
        const response = await apiFetch(`/departments/${id}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${getToken()}`,
                'Content-Type': 'application/json'
            }
        });

        const result = await response.json();
        if (response.ok && result.success) {
            const d = result.data;
            document.getElementById('editDeptId').value = d.id;
            document.getElementById('editDeptCode').value = d.code || '';
            document.getElementById('editDeptName').value = d.name || '';
            document.getElementById('editDeptDesc').value = d.description || '';
            document.getElementById('editHeadLecturerId').value = d.headLecturerId || '';

            document.getElementById('editDeptModal').style.display = 'flex';
        }
    } catch (error) {
        console.error('Lỗi GET detail dept:', error);
        await showAlert('Không thể tải thông tin bộ môn. Vui lòng thử lại.', 'error');
    }
}

// 5. PUT /api/departments/{id} - Cập nhật bộ môn
async function handleEditDepartment(e) {
    e.preventDefault();
    const id = document.getElementById('editDeptId').value;
    const headIdVal = document.getElementById('editHeadLecturerId')?.value;

    const payload = {
        code: document.getElementById('editDeptCode').value.trim(),
        name: document.getElementById('editDeptName').value.trim(),
        description: document.getElementById('editDeptDesc').value.trim(),
        headLecturerId: headIdVal ? parseInt(headIdVal) : null
    };

    try {
        const response = await apiFetch(`/departments/${id}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${getToken()}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        if (response.ok && result.success) {
            await showAlert('✅ Cập nhật bộ môn thành công!');
            closeModal('editDeptModal');
            loadDepartments();
        } else {
            await showAlert(result.message || 'Cập nhật thất bại!');
        }
    } catch (error) {
        console.error('Lỗi PUT /api/departments:', error);
        await showAlert('Không thể cập nhật bộ môn. Vui lòng thử lại.', 'error');
    }
}

// 6. DELETE /api/departments/{id} - Xóa bộ môn
async function deleteDepartment(id) {
    const name = departmentDeleteLabels.get(String(id));
    if (!(await confirmAction(`Bạn có chắc chắn muốn xóa bộ môn ${name ? `“${name}”` : 'này'}?`))) return;

    try {
        const response = await apiFetch(`/departments/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${getToken()}`,
                'Content-Type': 'application/json'
            }
        });

        const result = await response.json();
        if (response.ok && result.success) {
            await showAlert('✅ Đã xóa bộ môn!');
            loadDepartments();
        } else {
            await showAlert(result.message || 'Xóa thất bại!');
        }
    } catch (error) {
        console.error('Lỗi DELETE /api/departments:', error);
        await showAlert('Không thể xóa bộ môn. Vui lòng thử lại.', 'error');
    }
}

function openCreateDeptModal() {
    const modal = document.getElementById('createDeptModal');
    if (modal) modal.style.display = 'flex';
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'none';
}
