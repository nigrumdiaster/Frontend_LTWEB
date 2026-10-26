// Trang cá nhân giảng viên: GET /api/auth/me

const ROLE_LABELS = {
    ROLE_ADMIN: 'Quản trị viên',
    ROLE_DEAN: 'Trưởng khoa',
    ROLE_LECTURER: 'Giảng viên',
    ROLE_DEPARTMENT_HEAD: 'Trưởng bộ môn',
    ROLE_STUDENT: 'Sinh viên'
};

document.addEventListener('DOMContentLoaded', async () => {
    const errorEl = document.getElementById('profileLoadError');
    const set = (id, value, fallback = '-') => {
        const el = document.getElementById(id);
        if (el) el.textContent = (value === null || value === undefined || value === '') ? fallback : value;
    };

    try {
        const { ok, result } = await callAPI('/auth/me', { method: 'GET' });
        if (!ok || !result.data) throw new Error(result.message || 'Không thể tải thông tin tài khoản.');
        const d = result.data;

        try {
            localStorage.setItem('user', JSON.stringify(d));
        } catch (storageError) {
            console.error('Không thể lưu thông tin cá nhân:', storageError);
        }

        set('profile-username', d.username);
        set('profile-fullname', d.fullName || d.name);
        set('profile-email', d.email);
        set('profile-phone', d.phone);
        set('profile-code', d.userCode || d.code || d.username);
        set('profile-role', ROLE_LABELS[d.role] || d.role);
        set('profile-department', d.departmentName, 'Chưa cập nhật');
        set('profActive', d.active === undefined ? '-' : (d.active ? 'Đang hoạt động' : 'Đã khóa'));
        set('profCreatedAt', d.createdAt ? fmtDateTime(d.createdAt) : '-');
    } catch (error) {
        console.error('Lỗi tải thông tin cá nhân:', error);
        errorEl.textContent = error.message || 'Lỗi kết nối máy chủ!';
        errorEl.style.display = 'block';
    }
});
