// ==========================================
// student/profile.js - Trang cá nhân của sinh viên
// API dùng: GET /api/auth/me
// (Đổi mật khẩu: POST /api/auth/change-password do auth.js xử lý)
// ==========================================
(function () {
    document.addEventListener('DOMContentLoaded', initStudentProfile);

    async function initStudentProfile() {
        // Chưa đăng nhập -> về trang đăng nhập
        if (!localStorage.getItem('token')) {
            window.location.href = '../index.html';
            return;
        }

        try {
            const response = await apiFetch('/auth/me');
            const result = await response.json();

            if (!response.ok || !result.success || !result.data) {
                throw new Error(result.message || 'Không thể tải thông tin tài khoản.');
            }

            const user = result.data;

            // Chuyển về đúng cổng theo vai trò đã xác thực từ backend.
            if (user.role !== 'ROLE_STUDENT') {
                window.location.replace('../' + getHomePageByRole(user.role));
                return;
            }

            localStorage.setItem('user', JSON.stringify(user));
            renderProfile(user);
        } catch (error) {
            console.error('Lỗi tải thông tin cá nhân:', error);
            showError(error.message || 'Không thể kết nối đến máy chủ.');
        }
    }

    function renderProfile(user) {
        setText('profile-username', user.username);
        setText('profile-fullname', user.fullName || user.name);
        setText('profile-email', user.email);
        setText('profile-phone', user.phone);
        setText('profile-code', user.userCode || user.code || user.username);
        setText('profile-role', 'Sinh viên');
        setText('profile-department', user.departmentName);
        setText('profile-class', user.className || user.studentClass);
        setText('profActive', user.active === false ? 'Đã khóa' : 'Đang hoạt động');
        setText('profCreatedAt', formatDate(user.createdAt));
    }

    function formatDate(value) {
        if (!value) return null;
        const date = new Date(value);
        return isNaN(date) ? value : date.toLocaleString('vi-VN');
    }

    function setText(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = value == null || value === '' ? 'Chưa cập nhật' : String(value);
    }

    function showError(message) {
        const el = document.getElementById('profileLoadError');
        if (el) {
            el.textContent = message;
            el.style.display = 'block';
        }
    }
})();
