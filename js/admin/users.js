function getToken() {
    return localStorage.getItem('token');
}

function getAuthHeaders() {
    return {
        'Authorization': `Bearer ${getToken()}`,
        'Content-Type': 'application/json'
    };
}

function formatRoleName(role) {
    const roleMap = {
        'ROLE_ADMIN': 'Quản trị viên',
        'ROLE_DEAN': 'Trưởng khoa',
        'ROLE_DEPARTMENT_HEAD': 'Trưởng bộ môn',
        'ROLE_LECTURER': 'Giảng viên',
        'ROLE_STUDENT': 'Sinh viên'
    };
    return roleMap[role] || role;
}

document.addEventListener('DOMContentLoaded', async () => {
    if (!getToken()) {
        showTableMessage('⚠️ Bạn chưa đăng nhập hoặc phiên làm việc đã hết hạn. Vui lòng <a href="../index.html" style="color: var(--primary); font-weight: 600;">Đăng nhập lại</a>.');
        return;
    }

    checkUserPermission();
    await loadDepartmentOptions();
    loadUsers();

    const userForm = document.getElementById('userForm');
    if (userForm) userForm.addEventListener('submit', handleSaveUser);
});

async function loadDepartmentOptions() {
    try {
        const response = await apiFetch('/departments', {
            method: 'GET',
            headers: getAuthHeaders()
        });
        const result = await response.json();
        if (!response.ok || !result.success || !Array.isArray(result.data)) {
            throw new Error(result.message || 'Không thể tải danh sách bộ môn.');
        }

        [
            { id: 'filterDepartmentId', placeholder: 'Tất cả bộ môn' },
            { id: 'userDeptId', placeholder: 'Chọn bộ môn...' }
        ].forEach(({ id, placeholder }) => {
            const select = document.getElementById(id);
            if (!select) return;
            select.replaceChildren(
                new Option(placeholder, ''),
                ...result.data.map(department => new Option(department.name || `Bộ môn ${department.id}`, department.id))
            );
        });
    } catch (error) {
        console.error('Lỗi khi tải danh sách bộ môn:', error);
    }
}

async function checkUserPermission() {
    try {
        const response = await apiFetch(`/auth/me`, {
            method: 'GET',
            headers: getAuthHeaders()
        });
        const result = await response.json();

        if (response.ok && result.success) {
            const btnCreate = document.getElementById('btnOpenCreateUser');
            if (btnCreate && result.data.role !== 'ROLE_ADMIN' && result.data.role !== 'ROLE_DEAN') {
                btnCreate.style.display = 'none';
            }
        }
    } catch (error) {
        console.error('Lỗi khi kiểm tra phân quyền:', error);
    }
}

async function loadUsers() {
    showTableMessage('Đang tải dữ liệu...');
    const role = document.getElementById('filterRole')?.value || '';
    const departmentId = document.getElementById('filterDepartmentId')?.value || '';
    const keyword = document.getElementById('filterKeyword')?.value || '';
    const queryParams = new URLSearchParams();

    if (role) queryParams.append('role', role);
    if (departmentId) queryParams.append('departmentId', departmentId);

    try {
        const response = await apiFetch(`/users?${queryParams.toString()}`, {
            method: 'GET',
            headers: getAuthHeaders()
        });

        if (response.status === 401 || response.status === 403) {
            showTableMessage('🔒 Không có quyền truy cập hoặc Token hết hạn. Vui lòng <a href="../index.html" style="color: var(--primary); font-weight: 600;">Đăng nhập lại</a>.');
            return;
        }

        const result = await response.json();
        if (response.ok && result.success) {
            const users = Array.isArray(result.data) ? result.data : [];
            populateFilterOptions(
                document.getElementById('filterRole'),
                users.map(user => user.role),
                'Tất cả vai trò',
                formatRoleName
            );
            const query = removeVietnameseTones(keyword);
            renderUserTable(users.filter(user => !query ||
                [user.fullName, user.username, user.email, user.code]
                    .some(value => removeVietnameseTones(value).includes(query))));
        } else {
            showTableMessage(`❌ Lỗi: ${result.message || 'Không thể tải danh sách người dùng'}`);
        }
    } catch (error) {
        console.error('Lỗi kết nối API:', error);
        showTableMessage('❌ Không kết nối được đến Server (http://localhost:8080). Hãy chắc chắn Backend Spring Boot đang chạy.');
    }
}

const userDeleteLabels = new Map();

function renderUserTable(users) {
    userDeleteLabels.clear();
    (users || []).forEach(user => userDeleteLabels.set(String(user.id),
        user.fullName && user.username ? `${user.fullName} (${user.username})` : user.fullName || user.username || user.code));
    const tbody = document.getElementById('userTableBody');
    if (!tbody) return;

    if (!users || users.length === 0) {
        showTableMessage('Chưa có dữ liệu');
        return;
    }

    tbody.innerHTML = users.map(user => `
        <tr>
            <td>${user.id}</td>
            <td><strong>${user.code || '-'}</strong></td>
            <td>${user.fullName || ''}</td>
            <td>${user.username || ''}</td>
            <td>${user.email || ''}<br><small style="color: var(--text-muted);">${user.phone || ''}</small></td>
            <td><span class="badge badge-role">${formatRoleName(user.role)}</span></td>
            <td>${user.departmentName || '-'}<br><small style="color: var(--text-muted);">${user.studentClass || ''}</small></td>
            <td>
                <span class="badge ${user.active ? 'badge-success' : 'badge-danger'}">
                    ${user.active ? 'Hoạt động' : 'Đã khóa'}
                </span>
            </td>
            <td style="text-align: right;">
                <button onclick="editUser(${user.id})" class="btn btn-sm btn-action-edit">Sửa</button>
                <button onclick="deleteUser(${user.id})" class="btn btn-sm btn-action-delete">Xóa</button>
            </td>
        </tr>
    `).join('');
}

function showTableMessage(msg) {
    const tbody = document.getElementById('userTableBody');
    if (tbody) {
        tbody.innerHTML = `<tr><td colspan="100%" class="text-center py-4">${msg}</td></tr>`;
    }
}

async function loadLecturersByDept() {
    const departmentId = document.getElementById('filterDepartmentId')?.value;
    if (!departmentId || departmentId < 1) {
        await showAlert('Vui lòng chọn bộ môn!');
        return;
    }

    try {
        const response = await apiFetch(`/users/lecturers/department/${departmentId}`, {
            method: 'GET',
            headers: getAuthHeaders()
        });
        const result = await response.json();

        if (response.ok && result.success) {
            renderUserTable(result.data);
        } else {
            await showAlert(result.message || 'Lỗi khi tải danh sách Giảng viên!');
        }
    } catch (error) {
        console.error('Lỗi API GET Lecturers:', error);
        await showAlert('Không thể tải danh sách Giảng viên.');
    }
}

function openCreateModal() {
    const form = document.getElementById('userForm');
    const modal = document.getElementById('userModal');
    if (!form || !modal) return;

    form.reset();
    document.getElementById('userId').value = '';
    document.getElementById('userActive').value = 'true';
    document.getElementById('userModalTitle').textContent = 'Tạo Tài Khoản Mới';
    document.getElementById('userCreateCredentials').style.display = '';
    document.getElementById('userUsername').required = true;
    document.getElementById('userPassword').required = true;
    document.getElementById('userSaveButton').textContent = 'Tạo Mới';
    modal.style.display = 'flex';
}

async function editUser(id) {
    try {
        const response = await apiFetch(`/users/${id}`, {
            method: 'GET',
            headers: getAuthHeaders()
        });
        const result = await response.json();

        if (!response.ok || !result.success || !result.data) {
            await showAlert(result.message || 'Không thể tải thông tin người dùng.');
            return;
        }

        const data = result.data;
        document.getElementById('userId').value = data.id;
        document.getElementById('userFullName').value = data.fullName || '';
        document.getElementById('userEmail').value = data.email || '';
        document.getElementById('userPhone').value = data.phone || '';
        document.getElementById('userCode').value = data.code || '';
        document.getElementById('userRole').value = data.role || 'ROLE_STUDENT';
        document.getElementById('userDeptId').value = data.departmentId ?? '';
        document.getElementById('userStudentClass').value = data.studentClass || '';
        document.getElementById('userActive').value = String(data.active !== false);
        document.getElementById('userModalTitle').textContent = 'Cập Nhật Người Dùng';
        document.getElementById('userCreateCredentials').style.display = 'none';
        document.getElementById('userUsername').required = false;
        document.getElementById('userPassword').required = false;
        document.getElementById('userSaveButton').textContent = 'Cập Nhật';
        document.getElementById('userModal').style.display = 'flex';
    } catch (error) {
        console.error('Lỗi GET user detail:', error);
        await showAlert('Không thể tải thông tin người dùng.');
    }
}

async function handleSaveUser(e) {
    e.preventDefault();

    const id = document.getElementById('userId').value;
    const departmentValue = document.getElementById('userDeptId').value;
    const payload = {
        fullName: document.getElementById('userFullName').value.trim(),
        email: document.getElementById('userEmail').value.trim(),
        phone: document.getElementById('userPhone').value.trim(),
        code: document.getElementById('userCode').value.trim(),
        role: document.getElementById('userRole').value,
        departmentId: departmentValue ? Number.parseInt(departmentValue, 10) : null,
        studentClass: document.getElementById('userStudentClass').value.trim(),
        active: document.getElementById('userActive').value === 'true'
    };

    if (!id) {
        payload.username = document.getElementById('userUsername').value.trim();
        payload.password = document.getElementById('userPassword').value;
    }

    const isUpdate = Boolean(id);
    try {
        const response = await apiFetch(isUpdate ? `/users/${id}` : `/users`, {
            method: isUpdate ? 'PUT' : 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });
        const result = await response.json();

        if (response.ok && result.success) {
            await showAlert(isUpdate ? 'Cập nhật người dùng thành công!' : 'Tạo người dùng thành công!');
            closeUserModal();
            await loadUsers();
        } else {
            await showAlert(result.message || (isUpdate ? 'Cập nhật thất bại!' : 'Tạo thất bại!'));
        }
    } catch (error) {
        console.error(`Lỗi ${isUpdate ? 'PUT' : 'POST'} /api/users:`, error);
        await showAlert('Không thể lưu thông tin người dùng.');
    }
}

async function deleteUser(id) {
    const name = userDeleteLabels.get(String(id));
    if (!(await confirmAction(`Bạn có chắc chắn muốn xóa tài khoản ${name ? `“${name}”` : 'này'}?`))) return;

    try {
        const response = await apiFetch(`/users/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        const result = await response.json();

        if (response.ok && result.success) {
            await showAlert('Đã xóa tài khoản thành công!');
            await loadUsers();
        } else {
            await showAlert(result.message || 'Thao tác thất bại!');
        }
    } catch (error) {
        console.error('Lỗi DELETE /api/users/{id}:', error);
        await showAlert('Không thể xóa tài khoản.');
    }
}

function closeUserModal() {
    const modal = document.getElementById('userModal');
    if (modal) modal.style.display = 'none';
}

window.editUser = editUser;
window.deleteUser = deleteUser;
window.openCreateModal = openCreateModal;
window.closeUserModal = closeUserModal;
window.loadUsers = loadUsers;
window.loadLecturersByDept = loadLecturersByDept;

function resetFilters() {
    ['filterRole', 'filterDepartmentId'].forEach(id => {
        const select = document.getElementById(id);
        select.value = '';
        select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    document.getElementById('filterKeyword').value = '';
    document.querySelectorAll('.filter-card .custom-multiselect-dropdown.open').forEach(dropdown => dropdown.classList.remove('open'));
    loadUsers();
}
