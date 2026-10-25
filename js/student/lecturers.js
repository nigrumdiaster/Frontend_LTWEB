// Trang danh sách giảng viên (sinh viên)
// API: GET /api/users/lecturers/department/{departmentId}
// Dùng apiFetch (config.js) -> tự gắn Bearer token và tự chuyển về index.html khi 401.

document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('btnResetFilters').addEventListener('click', () => {
        document.getElementById('deptSelect').value = '';
        document.getElementById('searchInput').value = '';
        loadLecturers();
    });

    const tbody = document.getElementById('lecturerTableBody');
    const deptSelect = document.getElementById('deptSelect');
    const searchInput = document.getElementById('searchInput');
    const countEl = document.getElementById('lecturerCount');
    const errorEl = document.getElementById('lecturerLoadError');
    let allLecturers = [];

    if (!localStorage.getItem('token')) {
        await showAlert('Bạn chưa đăng nhập!');
        window.location.href = '../index.html';
        return;
    }

    function getCurrentUser() {
        try {
            return JSON.parse(localStorage.getItem('user'));
        } catch (e) {
            return null;
        }
    }

    function escapeHtml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function showError(msg) {
        errorEl.textContent = msg || '';
        errorEl.style.display = msg ? 'block' : 'none';
    }

    function render() {
        const list = allLecturers;

        if (list.length === 0) {
            tbody.innerHTML = '<tr><td colspan="100%" class="text-center py-4">Chưa có dữ liệu</td></tr>';
        } else {
            tbody.innerHTML = list.map((l, i) => `
                <tr style="border-top: 1px solid #e2e8f0;">
                    <td style="padding: 10px 12px;">${i + 1}</td>
                    <td style="padding: 10px 12px; font-weight: 600;">${escapeHtml(l.code)}</td>
                    <td style="padding: 10px 12px;">${escapeHtml(l.fullName)}</td>
                    <td style="padding: 10px 12px;">${escapeHtml(l.email)}</td>
                    <td style="padding: 10px 12px;">${escapeHtml(l.phone || '-')}</td>
                    <td style="padding: 10px 12px;">${escapeHtml(l.departmentName || '-')}</td>
                    <td style="padding: 10px 12px; color: ${l.active ? '#15803d' : '#b91c1c'};">${l.active ? 'Hoạt động' : 'Đã khóa'}</td>
                </tr>`).join('');
        }
        countEl.textContent = `Hiển thị ${list.length} / ${getServerPagination(tbody)?.totalElements ?? allLecturers.length} giảng viên`;
    }

    async function loadLecturers() {
        if (!deptSelect.value) {
            hideServerPagination('lecturerTableBody');
            allLecturers = [];
            tbody.innerHTML = '<tr><td colspan="100%" class="text-center py-4">Chưa có dữ liệu</td></tr>';
            countEl.textContent = '';
            return;
        }

        showError('');
        tbody.innerHTML = '<tr><td colspan="100%" class="text-center py-4">Đang tải dữ liệu...</td></tr>';
        try {
            const response = await apiFetchTable(`/users/lecturers/department/${encodeURIComponent(deptSelect.value)}?keyword=${encodeURIComponent(searchInput.value.trim())}`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            }, 'lecturerTableBody', loadLecturers);
            const result = await response.json();

            if (response.ok && result.success) {
                allLecturers = Array.isArray(result.data) ? result.data : [];
                render();
            } else {
                throw new Error(result.message || 'Không thể tải danh sách giảng viên.');
            }
        } catch (error) {
            console.error('Lỗi tải danh sách giảng viên:', error);
            allLecturers = [];
            tbody.innerHTML = '';
            countEl.textContent = '';
            showError(error.message || 'Lỗi kết nối máy chủ!');
        }
    }

    // Đổ danh sách bộ môn (GET /api/departments); lỗi thì giữ lựa chọn mặc định
    async function loadDepartments() {
        try {
            const response = await apiFetchAll('/departments', { method: 'GET' });
            const result = await response.json();
            const depts = response.ok && Array.isArray(result.data) ? result.data : [];
            if (depts.length) {
                deptSelect.innerHTML = depts.map(d =>
                    `<option value="${d.id}">${escapeHtml(d.name || d.departmentName || ('Bộ môn ' + d.id))}</option>`).join('');
            }
        } catch (e) {
            console.warn('Không tải được danh sách bộ môn:', e);
            showError(e.message || 'Không thể tải danh sách bộ môn.');
        }

        // Chọn sẵn bộ môn của sinh viên đang đăng nhập
        const user = getCurrentUser();
        if (user && user.departmentId && [...deptSelect.options].some(o => o.value == user.departmentId)) {
            deptSelect.value = user.departmentId;
        }
    }

    document.getElementById('btnReload').addEventListener('click', loadLecturers);
    deptSelect.addEventListener('change', loadLecturers);
    searchInput.addEventListener('input', debounce(loadLecturers));

    loadDepartments().then(loadLecturers);
});