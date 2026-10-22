// Trang thông báo (sinh viên)
// API: GET /api/announcements        -> data: AnnouncementDto[]
//      GET /api/announcements/{id}   -> data: AnnouncementDto
// AnnouncementDto: id, title, content, targetRole, isPinned, fileUrl, authorId, authorName, createdAt, updatedAt

let announcementsCache = [];

function escapeHtml(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmtDateTime(value) {
    if (!value) return '';
    const d = new Date(value);
    return isNaN(d) ? escapeHtml(value)
        : d.toLocaleDateString('vi-VN') + ' ' + d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

function isPinned(a) { return (a.isPinned ?? a.pinned) === true; }

// Hiện cho sinh viên nếu thông báo dành cho tất cả / sinh viên, hoặc không ghi rõ đối tượng.
// Chỉ ẩn khi rõ ràng là dành riêng cho giảng viên/admin.
function visibleToStudent(a) {
    const r = String(a.targetRole || '');
    if (!r) return true;
    if (/ALL|STUDENT/i.test(r)) return true;
    return !/LECTURER|ADMIN|DEPARTMENT/i.test(r);
}

function targetLabel(a) {
    const r = String(a.targetRole || '');
    if (!r || /ALL/i.test(r)) return 'Tất cả';
    if (/STUDENT/i.test(r)) return 'Sinh viên';
    if (/LECTURER/i.test(r)) return 'Giảng viên';
    return r;
}

function preview(text, max) {
    const t = String(text || '').replace(/\s+/g, ' ').trim();
    return t.length > max ? t.slice(0, max) + '...' : t;
}

function openAnnouncementModal() {
    const m = document.getElementById('annModal');
    if (m) m.style.display = 'flex';
}

function closeAnnouncementModal() {
    const m = document.getElementById('annModal');
    if (m) m.style.display = 'none';
}

async function showAnnouncement(id) {
    try {
        const response = await apiFetch('/announcements/' + id, { method: 'GET' });
        const result = await response.json();
        if (!response.ok || !result.success || !result.data) {
            throw new Error(result.message || 'Không thể tải thông báo.');
        }
        const a = result.data;
        document.getElementById('annModalTitle').textContent = (isPinned(a) ? '📌 ' : '') + (a.title || 'Thông báo');
        document.getElementById('annModalBody').innerHTML = `
            <p style="color:#64748b; font-size:13px; margin:0 0 12px;">
                ${a.authorName ? 'Đăng bởi <strong>' + escapeHtml(a.authorName) + '</strong> · ' : ''}${escapeHtml(fmtDateTime(a.createdAt))}
                ${a.updatedAt && a.updatedAt !== a.createdAt ? ' · Cập nhật: ' + escapeHtml(fmtDateTime(a.updatedAt)) : ''}
                · Đối tượng: ${escapeHtml(targetLabel(a))}
            </p>
            <div style="white-space:pre-wrap; color:#0f172a; font-size:15px; line-height:1.6;">${escapeHtml(a.content || '')}</div>
            ${a.fileUrl ? `<p style="margin:16px 0 0;"><a href="${escapeHtml(a.fileUrl)}" target="_blank" rel="noopener">📎 Tệp đính kèm</a></p>` : ''}`;
        openAnnouncementModal();
    } catch (error) {
        console.error('Lỗi tải thông báo:', error);
        await showAlert(error.message || 'Lỗi kết nối máy chủ!');
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('btnResetFilters').addEventListener('click', () => {
        document.getElementById('annSearch').value = '';
        render();
    });

    const area = document.getElementById('annArea');
    const searchInput = document.getElementById('annSearch');
    const errorEl = document.getElementById('annLoadError');

    if (!localStorage.getItem('token')) {
        await showAlert('Bạn chưa đăng nhập!');
        window.location.href = '../index.html';
        return;
    }

    function showError(msg) {
        errorEl.textContent = msg || '';
        errorEl.style.display = msg ? 'block' : 'none';
    }

    function render() {
        const kw = removeVietnameseTones(searchInput.value);
        const list = announcementsCache
            .filter(a => !kw || [a.title, a.content, a.authorName].some(v => removeVietnameseTones(v).includes(kw)))
            .sort((x, y) => (isPinned(y) - isPinned(x)) || (new Date(y.createdAt) - new Date(x.createdAt)));

        if (!list.length) {
            area.innerHTML = `
                <div style="background:white; border-radius:12px; padding:24px; border:1px solid #e2e8f0; color:#64748b;">
                    Chưa có thông báo nào.
                </div>`;
            return;
        }

        area.innerHTML = list.map(a => `
            <div style="background:white; border-radius:12px; padding:20px 24px; border:1px solid ${isPinned(a) ? '#fcd34d' : '#e2e8f0'}; margin-bottom:12px;">
                <div style="display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap;">
                    <h3 style="margin:0; font-size:17px; color:#0f172a;">${isPinned(a) ? '📌 ' : ''}${escapeHtml(a.title)}</h3>
                    <span style="color:#64748b; font-size:13px;">${escapeHtml(fmtDateTime(a.createdAt))}</span>
                </div>
                <p style="color:#64748b; font-size:13px; margin:4px 0 8px;">
                    ${a.authorName ? 'Đăng bởi ' + escapeHtml(a.authorName) + ' · ' : ''}Đối tượng: ${escapeHtml(targetLabel(a))}${a.fileUrl ? ' · 📎 Có tệp đính kèm' : ''}
                </p>
                <p style="margin:0 0 12px; color:#475569; font-size:14px;">${escapeHtml(preview(a.content, 180))}</p>
                <button type="button" class="btn btn-secondary btn-sm" onclick="showAnnouncement(${a.id})">Xem chi tiết</button>
            </div>`).join('');
    }

    async function loadAnnouncements() {
        showError('');
        area.innerHTML = '<div style="background:white; border-radius:12px; padding:24px; border:1px solid #e2e8f0; color:#64748b;">Đang tải...</div>';
        try {
            const response = await apiFetch('/announcements', {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });
            const result = await response.json();
            if (response.ok && result.success) {
                announcementsCache = (Array.isArray(result.data) ? result.data : []).filter(visibleToStudent);
                render();
            } else {
                throw new Error(result.message || 'Không thể tải danh sách thông báo.');
            }
        } catch (error) {
            console.error('Lỗi tải thông báo:', error);
            announcementsCache = [];
            area.innerHTML = '';
            showError(error.message || 'Lỗi kết nối máy chủ!');
        }
    }

    document.getElementById('btnReloadAnn').addEventListener('click', loadAnnouncements);
    searchInput.addEventListener('input', render);
    loadAnnouncements();
});