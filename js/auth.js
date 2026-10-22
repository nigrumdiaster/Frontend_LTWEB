// Global Event Listener
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Khởi tạo sự kiện Form Login
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    // 2. Khởi tạo sự kiện Form Register
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        loadRegisterDepartments();
        registerForm.addEventListener('submit', handleRegister);
        toggleStudentClassInput(); // Tự động ẩn/hiện ô lớp sinh viên đúng trạng thái ban đầu
    }

    // 3. Khởi tạo sự kiện Form Change Password
    const changePasswordForm = document.getElementById('changePasswordForm');
    if (changePasswordForm) {
        changePasswordForm.addEventListener('submit', handleChangePassword);
    }
});

async function loadRegisterDepartments() {
    const select = document.getElementById('departmentId');
    if (!select) return;

    try {
        const response = await apiFetch('/departments', { method: 'GET' });
        const result = await response.json();
        if (!response.ok || !result.success || !Array.isArray(result.data)) {
            throw new Error(result.message || 'Không thể tải danh sách bộ môn.');
        }

        select.replaceChildren(
            new Option('Chọn bộ môn...', ''),
            ...result.data.map(department => new Option(department.name || `Bộ môn ${department.id}`, department.id))
        );
    } catch (error) {
        console.error('Lỗi khi tải danh sách bộ môn đăng ký:', error);
        const status = document.getElementById('departmentStatus');
        if (status) status.textContent = 'Không thể tải danh sách bộ môn. Bạn vẫn có thể đăng ký và bổ sung sau.';
    }
}

// Trang đích sau khi đăng nhập theo vai trò
function getHomePageByRole(role) {
    if (role === 'ROLE_STUDENT') return 'student/profile.html';
    if (role === 'ROLE_LECTURER') return 'lecturer/profile.html';
    return 'admin/profile.html';
}

// ==========================================
// 1. XỬ LÝ ĐĂNG NHẬP (POST /api/auth/login)
// ==========================================
async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    try {
        const response = await apiFetch('/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const result = await response.json();

        if (response.ok && result.success) {
            const token = result.data.token || result.data.accessToken;
            if (!token) throw new Error('Máy chủ không trả về access token.');
            localStorage.setItem('token', token);

            let authenticatedUser = result.data.user || result.data.currentUser || result.data.account;
            if (!authenticatedUser && (result.data.id || result.data.username || result.data.role)) {
                authenticatedUser = result.data;
            }
            if (!authenticatedUser) {
                const profileResponse = await apiFetch('/auth/me');
                const profileResult = await profileResponse.json();
                if (!profileResponse.ok || !profileResult.success || !profileResult.data) {
                    throw new Error(profileResult.message || 'Không thể tải thông tin tài khoản.');
                }
                authenticatedUser = profileResult.data;
            }
            localStorage.setItem('user', JSON.stringify(authenticatedUser));
            queueToastAfterRedirect('Đăng nhập thành công!');
            window.location.href = getHomePageByRole(authenticatedUser.role);
        } else {
            await showAlert(result.message || 'Tên đăng nhập hoặc mật khẩu không chính xác!');
        }
    } catch (error) {
        console.error('Lỗi khi đăng nhập:', error);
        await showAlert(error.message || 'Không thể kết nối đến máy chủ Backend (http://localhost:8080)!');
    }
}

// ==========================================
// 2. XỬ LÝ ĐĂNG KÝ (POST /api/auth/register)
// ==========================================
async function handleRegister(e) {
    e.preventDefault();

    const form = document.getElementById('registerForm');
    for (const id of ['regUsername', 'fullName', 'email']) {
        const input = document.getElementById(id);
        input.value = input.value.trim();
    }
    if (!form.reportValidity()) return;

    // Lấy giá trị ID Bộ môn an toàn, tránh lỗi parseInt bị NaN khi để trống
    const deptVal = document.getElementById('departmentId')?.value;

    const payload = {
        username: document.getElementById('regUsername').value.trim(),
        password: document.getElementById('regPassword').value,
        fullName: document.getElementById('fullName').value.trim(),
        email: document.getElementById('email').value.trim(),
        phone: document.getElementById('phone').value.trim() || null,
        code: document.getElementById('code').value.trim() || null,
        role: document.getElementById('role').value,
        departmentId: document.getElementById('role').value === 'ROLE_LECTURER' && deptVal
            ? Number(deptVal) : null,
        studentClass: document.getElementById('role').value === 'ROLE_STUDENT'
            ? document.getElementById('studentClass')?.value.trim() || null
            : null
    };

    try {
        const response = await apiFetch('/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (response.ok && result.success) {
            queueToastAfterRedirect('Đăng ký tài khoản thành công! Hãy đăng nhập.');
            window.location.href = 'index.html';
        } else {
            const errors = result.data && typeof result.data === 'object'
                ? Object.values(result.data).filter(value => typeof value === 'string')
                : [];
            await showAlert(errors.length ? errors.join('\n') : result.message || 'Đăng ký thất bại!');
        }
    } catch (error) {
        console.error('Lỗi khi đăng ký:', error);
        await showAlert('Lỗi kết nối máy chủ!');
    }
}

// Hiển thị lớp cho sinh viên và bộ môn cho giảng viên.
function toggleStudentClassInput() {
    const roleEl = document.getElementById('role');
    const group = document.getElementById('studentClassGroup');
    const departmentGroup = document.getElementById('departmentGroup');
    if (!roleEl) return;

    const isLecturer = roleEl.value === 'ROLE_LECTURER';
    if (group) group.style.display = isLecturer ? 'none' : 'flex';
    if (departmentGroup) departmentGroup.style.display = isLecturer ? 'flex' : 'none';
    const departmentSelect = document.getElementById('departmentId');
    if (departmentSelect) departmentSelect.disabled = !isLecturer;
    const studentClass = document.getElementById('studentClass');
    if (studentClass) studentClass.disabled = isLecturer;
}

// ==========================================
// 3. XỬ LÝ LẤY THÔNG TIN (GET /api/auth/me)
// ==========================================
async function loadUserProfile() {
    const token = localStorage.getItem('token');
    if (!token) {
        await showAlert('Bạn chưa đăng nhập!');
        window.location.href = 'index.html';
        return;
    }

    try {
        const response = await apiFetch('/auth/me', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        const result = await response.json();

        if (!response.ok || !result.success || !result.data) {
            throw new Error(result.message || 'Không thể tải thông tin cá nhân.');
        }

        const data = result.data;
        try {
            localStorage.setItem('user', JSON.stringify(data));
        } catch (storageError) {
            console.error('Không thể lưu thông tin cá nhân:', storageError);
        }
        const fields = {
            'profile-fullname': data.fullName || data.name,
            'profile-username': data.username,
            'profile-email': data.email,
            'profile-phone': data.phone,
            'profile-code': data.userCode || data.code || data.username,
            'profile-role': data.role,
            'profile-department': data.departmentName,
            'profile-class': data.className || data.studentClass
        };
        Object.entries(fields).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) element.textContent = value || '---';
        });
    } catch (error) {
        console.error('Lỗi tải thông tin cá nhân:', error);
        await showAlert(error.message || 'Không thể tải thông tin cá nhân.');
    }
}

// ==========================================
// 4. XỬ LÝ ĐỔI MẬT KHẨU (POST /api/auth/change-password)
// ==========================================
async function handleChangePassword(e) {
    e.preventDefault();
    const token = localStorage.getItem('token');
    if (!token) {
        await showAlert('Phiên làm việc hết hạn!');
        logout();
        return;
    }

    const oldPassword = document.getElementById('oldPassword').value;
    const newPassword = document.getElementById('newPassword').value;

    try {
        const response = await apiFetch('/auth/change-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ oldPassword, newPassword })
        });

        const result = await response.json();

        if (response.ok && result.success) {
            await showAlert('Đổi mật khẩu thành công!');
            closePasswordModal();
            document.getElementById('changePasswordForm').reset();
        } else {
            await showAlert(result.message || 'Đổi mật khẩu thất bại!');
        }
    } catch (error) {
        console.error('Lỗi đổi mật khẩu:', error);
        await showAlert(error.message || 'Không thể đổi mật khẩu. Vui lòng thử lại.');
    }
}

// Modal Toggle Functions
function openPasswordModal() {
    const modal = document.getElementById('passwordModal');
    if (modal) modal.style.display = 'flex';
}

function closePasswordModal() {
    const modal = document.getElementById('passwordModal');
    if (modal) modal.style.display = 'none';
}

// Hàm Đăng xuất
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = isInPortalFolder() ? '../index.html' : 'index.html';
}
