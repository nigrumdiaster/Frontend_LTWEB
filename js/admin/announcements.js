document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btnCreateAnnouncement').addEventListener('click', openCreateAnnouncement);
    document.getElementById('btnSearchAnnouncements').addEventListener('click', loadAnnouncements);
    document.getElementById('searchTitle').addEventListener('keydown', event => {
        if (event.key === 'Enter') loadAnnouncements();
    });
    document.getElementById('announcementForm').addEventListener('submit', saveAnnouncement);
    document.getElementById('btnCancelAnnouncement').addEventListener('click', closeAnnouncementModal);
    document.getElementById('btnCloseViewAnnouncement').addEventListener('click', closeViewAnnouncementModal);
    document.getElementById('announcementsTableBody').addEventListener('click', handleAnnouncementAction);
    loadAnnouncements();
});

function getAuthHeaders() {
    return {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
    };
}

async function requestAnnouncementApi(path, options = {}) {
    const response = await apiFetch(`${path}`, {
        ...options,
        headers: { ...getAuthHeaders(), ...(options.headers || {}) }
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
        throw new Error(result.message || 'Không thể hoàn tất thao tác với thông báo.');
    }
    return result;
}

async function loadAnnouncements() {
    const params = new URLSearchParams();
    const targetRole = document.getElementById('filterTargetRole').value;
    const title = document.getElementById('searchTitle').value.trim();
    if (targetRole && targetRole !== 'ALL') params.set('targetRole', targetRole);

    setAnnouncementTableMessage('Đang tải danh sách thông báo...');
    try {
        const query = params.toString();
        const result = await requestAnnouncementApi(`/api/announcements${query ? `?${query}` : ''}`);
        const announcements = Array.isArray(result.data) ? result.data : [];
        const queryText = removeVietnameseTones(title);
        renderAnnouncements(announcements.filter(announcement => !queryText ||
            removeVietnameseTones(announcement.title).includes(queryText)));
    } catch (error) {
        console.error('Lỗi tải thông báo:', error);
        setAnnouncementTableMessage(error.message || 'Không thể tải danh sách thông báo.', true);
    }
}

function renderAnnouncements(announcements) {
    const tbody = document.getElementById('announcementsTableBody');
    if (!announcements.length) {
        setAnnouncementTableMessage('Chưa có dữ liệu');
        return;
    }

    tbody.innerHTML = announcements.map((announcement, index) => {
        const fileUrl = getSafeFileUrl(announcement.fileUrl);
        return `
        <tr>
            <td>${index + 1}<br><small style="color: #64748b;">#${escapeHtml(announcement.id)}</small></td>
            <td>${announcement.isPinned
                ? '<span class="badge" style="background: #fef3c7; color: #92400e;">📌 Ghim</span>'
                : '<span style="color: #94a3b8;">—</span>'}</td>
            <td><strong>${escapeHtml(announcement.title)}</strong></td>
            <td>${targetRoleBadge(announcement.targetRole)}</td>
            <td>${fileUrl ? `<a href="${escapeHtml(fileUrl)}" target="_blank" rel="noopener noreferrer">Tải tệp</a>` : '—'}</td>
            <td>${escapeHtml(announcement.authorName || '—')}</td>
            <td>${formatDateTime(announcement.createdAt)}</td>
            <td style="text-align: right; white-space: nowrap;">
                <button type="button" class="btn btn-sm btn-action-view" data-action="view" data-id="${escapeHtml(announcement.id)}">👁️ Chi tiết</button>
                <button type="button" class="btn btn-sm btn-action-edit" data-action="edit" data-id="${escapeHtml(announcement.id)}">✏️ Sửa</button>
                <button type="button" class="btn btn-sm btn-action-delete" data-action="delete" data-id="${escapeHtml(announcement.id)}">🗑️ Xóa</button>
            </td>
        </tr>
    `;
    }).join('');
}

function targetRoleBadge(role) {
    const badges = {
        ALL: ['Tất cả', '#e0f2fe', '#075985'],
        ROLE_STUDENT: ['Sinh viên', '#dcfce7', '#166534'],
        ROLE_LECTURER: ['Giảng viên', '#ede9fe', '#5b21b6'],
        ROLE_ADMIN: ['Admin', '#fee2e2', '#991b1b']
    };
    const [label, background, color] = badges[role] || [role || '—', '#f1f5f9', '#475569'];
    return `<span class="badge" style="background: ${background}; color: ${color};">${escapeHtml(label)}</span>`;
}

function formatDateTime(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    }).format(date);
}

function setAnnouncementTableMessage(message, isError = false) {
    document.getElementById('announcementsTableBody').innerHTML = `
        <tr><td colspan="100%" class="text-center py-4${isError ? ' text-danger' : ''}">${escapeHtml(message)}</td></tr>
    `;
}

function openCreateAnnouncement() {
    document.getElementById('announcementForm').reset();
    document.getElementById('announcementId').value = '';
    document.getElementById('announcementModalTitle').textContent = 'Đăng thông báo mới';
    document.getElementById('announcementModal').style.display = 'flex';
}

async function openEditAnnouncement(id) {
    try {
        const result = await requestAnnouncementApi(`/api/announcements/${encodeURIComponent(id)}`);
        const announcement = result.data;
        document.getElementById('announcementId').value = announcement.id;
        document.getElementById('announcementTitle').value = announcement.title || '';
        document.getElementById('announcementContent').value = announcement.content || '';
        document.getElementById('announcementTargetRole').value = announcement.targetRole || 'ALL';
        document.getElementById('announcementFileUrl').value = announcement.fileUrl || '';
        document.getElementById('announcementIsPinned').checked = Boolean(announcement.isPinned);
        document.getElementById('announcementModalTitle').textContent = 'Cập nhật thông báo';
        document.getElementById('announcementModal').style.display = 'flex';
    } catch (error) {
        console.error('Lỗi tải thông báo cần sửa:', error);
        await showAlert(error.message || 'Không thể tải thông báo cần sửa.');
    }
}

async function saveAnnouncement(event) {
    event.preventDefault();
    const id = document.getElementById('announcementId').value;
    const payload = {
        title: document.getElementById('announcementTitle').value.trim(),
        content: document.getElementById('announcementContent').value,
        targetRole: document.getElementById('announcementTargetRole').value,
        isPinned: document.getElementById('announcementIsPinned').checked,
        fileUrl: document.getElementById('announcementFileUrl').value.trim()
    };

    try {
        const result = await requestAnnouncementApi(
            id ? `/api/announcements/${encodeURIComponent(id)}` : '/api/announcements',
            {
                method: id ? 'PUT' : 'POST',
                body: JSON.stringify(payload)
            }
        );
        closeAnnouncementModal();
        await showAlert(result.message || (id ? 'Cập nhật thông báo thành công.' : 'Đăng thông báo thành công.'));
        await loadAnnouncements();
    } catch (error) {
        console.error('Lỗi lưu thông báo:', error);
        await showAlert(error.message || 'Không thể lưu thông báo.');
    }
}

async function deleteAnnouncement(id) {
    if (!(await confirmAction('Bạn có chắc chắn muốn xóa thông báo này?'))) return;
    try {
        const result = await requestAnnouncementApi(`/api/announcements/${encodeURIComponent(id)}`, {
            method: 'DELETE'
        });
        await showAlert(result.message || 'Xóa thông báo thành công.');
        await loadAnnouncements();
    } catch (error) {
        console.error('Lỗi xóa thông báo:', error);
        await showAlert(error.message || 'Không thể xóa thông báo.');
    }
}

async function viewAnnouncement(id) {
    try {
        const result = await requestAnnouncementApi(`/api/announcements/${encodeURIComponent(id)}`);
        const announcement = result.data;
        document.getElementById('viewAnnouncementTitle').textContent = announcement.title || 'Chi tiết thông báo';
        document.getElementById('viewAnnouncementMeta').textContent =
            `${announcement.authorName || '—'} · ${formatDateTime(announcement.createdAt)} · ${roleLabel(announcement.targetRole)}`;
        document.getElementById('viewAnnouncementContent').textContent = announcement.content || '';

        const fileContainer = document.getElementById('viewAnnouncementFile');
        fileContainer.replaceChildren();
        const safeUrl = getSafeFileUrl(announcement.fileUrl);
        if (safeUrl) {
            const link = document.createElement('a');
            link.href = safeUrl;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.textContent = '📎 Mở tệp đính kèm';
            fileContainer.appendChild(link);
        }
        document.getElementById('viewAnnouncementModal').style.display = 'flex';
    } catch (error) {
        console.error('Lỗi xem chi tiết thông báo:', error);
        await showAlert(error.message || 'Không thể tải chi tiết thông báo.');
    }
}

function getSafeFileUrl(value) {
    if (!value) return '';
    try {
        const url = new URL(value, window.location.href);
        return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '';
    } catch (error) {
        console.error('Đường dẫn tệp đính kèm không hợp lệ:', error);
        return '';
    }
}

function roleLabel(role) {
    return {
        ALL: 'Tất cả',
        ROLE_STUDENT: 'Sinh viên',
        ROLE_LECTURER: 'Giảng viên',
        ROLE_ADMIN: 'Admin'
    }[role] || role || '—';
}

function handleAnnouncementAction(event) {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const { action, id } = button.dataset;
    if (action === 'view') viewAnnouncement(id);
    if (action === 'edit') openEditAnnouncement(id);
    if (action === 'delete') deleteAnnouncement(id);
}

function closeAnnouncementModal() {
    document.getElementById('announcementModal').style.display = 'none';
}

function closeViewAnnouncementModal() {
    document.getElementById('viewAnnouncementModal').style.display = 'none';
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[character]);
}

function resetFilters() {
    document.getElementById('filterTargetRole').value = 'ALL';
    document.getElementById('searchTitle').value = '';
    document.querySelectorAll('.filter-card .custom-multiselect-dropdown.open').forEach(dropdown => dropdown.classList.remove('open'));
    loadAnnouncements();
}
