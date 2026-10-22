(function () {
    const roleLabels = {
        ROLE_ADMIN: 'Quản trị viên',
        ROLE_DEPARTMENT_HEAD: 'Trưởng bộ môn',
        ROLE_LECTURER: 'Giảng viên',
        ROLE_STUDENT: 'Sinh viên'
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeProfile);
    } else {
        initializeProfile();
    }

    function initializeProfile() {
        loadUserProfile();

        const form = document.getElementById('profileChangePasswordForm');
        if (form) form.addEventListener('submit', handleChangePassword);
    }

    async function loadUserProfile() {
        let user = readStoredUser();

        if (user) renderProfile(user);

        try {
            const response = await apiFetch('/auth/me', { method: 'GET' });
            const result = await readResponse(response);
            const profile = result && (result.data || result.user || result);

            if (!response.ok || !profile || typeof profile !== 'object' || result.success === false) {
                throw new Error(getResponseMessage(result, 'Không thể tải thông tin tài khoản mới nhất.'));
            }

            user = profile;
            renderProfile(user);
            try {
                localStorage.setItem('user', JSON.stringify(user));
            } catch (error) {
                console.error('Không thể lưu thông tin cá nhân mới nhất:', error);
            }
        } catch (error) {
            console.error('Lỗi tải thông tin cá nhân:', error);
            if (user) {
                showProfileError('Không thể tải dữ liệu mới nhất từ máy chủ. Đang hiển thị thông tin đã lưu.');
            } else {
                showProfileError(error.message || 'Không thể tải thông tin cá nhân.');
            }
        }
    }

    function readStoredUser() {
        const storedValue = localStorage.getItem('user');
        if (!storedValue) return null;

        try {
            const parsedValue = JSON.parse(storedValue);
            const user = parsedValue && (parsedValue.data || parsedValue.user || parsedValue);
            if (user && typeof user === 'object') return user;
            console.error('Dữ liệu user không có cấu trúc tài khoản hợp lệ.');
        } catch (error) {
            console.error('Không thể đọc dữ liệu user:', error);
        }

        return null;
    }

    function renderProfile(user) {
        setProfileValue('profile-username', user.username);
        setProfileValue('profile-fullname', user.fullName || user.name);
        setProfileValue('profile-email', user.email);
        setProfileValue('profile-phone', user.phone || 'Chưa cập nhật');
        setProfileValue('profile-code', user.userCode || user.code || user.studentLecturerCode || user.username);
        const normalizedRole = String(user.role || '').toUpperCase();
        const role = roleLabels[normalizedRole] || roleLabels[`ROLE_${normalizedRole}`] || user.role;
        setProfileValue('profile-role', role || 'Chưa cập nhật');
        setProfileValue('profile-department', user.departmentName || 'Công nghệ thông tin');
        setProfileValue('profile-class', user.className || user.studentClass || 'N/A');
    }

    function setProfileValue(id, value) {
        const element = document.getElementById(id);
        if (element) element.textContent = value == null || value === '' ? '---' : String(value);
    }

    async function handleChangePassword(event) {
        event.preventDefault();

        const form = document.getElementById('profileChangePasswordForm');
        const oldPassword = document.getElementById('oldPassword').value;
        const newPassword = document.getElementById('newPassword').value;

        if (newPassword.length < 6) {
            await showAlert('Mật khẩu mới phải có ít nhất 6 ký tự.');
            document.getElementById('newPassword').focus();
            return;
        }

        try {
            const response = await apiFetch('/auth/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ oldPassword, newPassword })
            });
            const result = await readResponse(response);

            if (!response.ok || (result && result.success === false)) {
                throw new Error(getResponseMessage(result, 'Đổi mật khẩu thất bại.'));
            }

            await showAlert(getResponseMessage(result, 'Đổi mật khẩu thành công!'));
            closePasswordModal();
            form.reset();
        } catch (error) {
            console.error('Lỗi đổi mật khẩu:', error);
            await showAlert(error.message || 'Không thể đổi mật khẩu. Vui lòng thử lại.');
        }
    }

    async function readResponse(response) {
        const body = await response.text();
        if (!body) return null;

        try {
            return JSON.parse(body);
        } catch (error) {
            if (!response.ok) return { message: body };
            throw new Error('Máy chủ trả về phản hồi không hợp lệ.');
        }
    }

    function getResponseMessage(result, fallback) {
        if (typeof result === 'string' && result) return result;
        if (!result || typeof result !== 'object') return fallback;
        return result.message || result.error || result.details || fallback;
    }

    function showProfileError(message) {
        const errorElement = document.getElementById('profileLoadError');
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
        }
    }
})();
