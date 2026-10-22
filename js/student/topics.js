// Trang đề tài đã công bố (Sinh viên)
// API: GET /api/topics?status=APPROVED   danh sách đề tài đã công bố
//      GET /api/topics/{id}              chi tiết đề tài
//      GET /api/registration-periods     danh sách đợt đăng ký
//      GET /api/departments             danh sách bộ môn

let topicsCache = [];

function openTopicModal() {
    const m = document.getElementById('topicModal');
    if (m) m.style.display = 'flex';
}

function closeTopicModal() {
    const m = document.getElementById('topicModal');
    if (m) m.style.display = 'none';
}

function escapeHtml(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmtDateTime(value) {
    if (!value) return '-';
    const d = new Date(value);
    return isNaN(d) ? escapeHtml(value)
        : d.toLocaleDateString('vi-VN') + ' ' + d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

function topicGroupText(t) {
    return t.isAssigned
        ? `<span style="color:#b45309; font-weight:600;">${escapeHtml(t.assignedGroupName || 'Đã có nhóm nhận')}</span>`
        : '<span style="color:#15803d; font-weight:600;">Chưa có nhóm</span>';
}

async function showTopicDetail(id) {
    try {
        const response = await apiFetch('/topics/' + id);
        const result = await response.json();
        if (!response.ok || !result.data) {
            await showAlert(result.message || 'Không thể tải chi tiết đề tài.');
            return;
        }
        const t = result.data;
        const field = (label, value) => `
            <div>
                <span style="color:#64748b; font-size:13px;">${label}</span>
                <p style="font-size:15px; font-weight:600; color:#0f172a; margin-top:4px;">${value}</p>
            </div>`;
        const wide = (label, value) => `<div style="grid-column: 1 / -1;">${field(label, value)}</div>`;
        const advisor = (n, e) => n ? escapeHtml(n) + (e ? `<br><small style="color:#64748b;">${escapeHtml(e)}</small>` : '') : '-';

        document.getElementById('topicModalTitle').textContent = `${t.code || ''} ${t.titleVi ? '- ' + t.titleVi : ''}`.trim() || 'Chi tiết đề tài';
        document.getElementById('topicModalBody').innerHTML = [
            wide('Tên đề tài (Tiếng Việt)', escapeHtml(t.titleVi || '-')),
            wide('Tên đề tài (Tiếng Anh)', escapeHtml(t.titleEn || '-')),
            wide('Mô tả đề tài', escapeHtml(t.description || '-')),
            wide('Yêu cầu thực hiện', escapeHtml(t.requirements || '-')),
            field('GV hướng dẫn chính', advisor(t.primaryAdvisorName, t.primaryAdvisorEmail)),
            field('GV đồng hướng dẫn', advisor(t.coAdvisorName, t.coAdvisorEmail)),
            field('Bộ môn', escapeHtml(t.departmentName || '-')),
            field('Đợt đăng ký', escapeHtml(t.periodName || '-')),
            field('Số sinh viên tối đa', t.maxStudents ?? '-'),
            field('Tình trạng đăng ký', topicGroupText(t)),
            field('Người duyệt', escapeHtml(t.approvedByName || '-')),
            field('Ngày duyệt', fmtDateTime(t.approvedAt))
        ].join('');
        openTopicModal();
    } catch (e) {
        console.error('Lỗi xem chi tiết đề tài:', e);
        await showAlert('Có lỗi xảy ra khi tải chi tiết đề tài.');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btnResetFilters').addEventListener('click', () => {
        document.getElementById('periodFilter').value = '';
        document.getElementById('deptFilter').value = '';
        document.getElementById('topicSearch').value = '';
        loadTopics();
    });

    const tbody = document.getElementById('topicTableBody');
    const periodFilter = document.getElementById('periodFilter');
    const deptFilter = document.getElementById('deptFilter');
    const searchInput = document.getElementById('topicSearch');
    const countEl = document.getElementById('topicCount');
    const errorEl = document.getElementById('topicLoadError');

    function showError(msg) {
        if (!errorEl) return;
        errorEl.textContent = msg || '';
        errorEl.style.display = msg ? 'block' : 'none';
    }

    function render() {
        const kw = removeVietnameseTones(searchInput?.value);
        const selectedDept = deptFilter?.value || '';

        const list = topicsCache.filter(t => {
            const matchDept = !selectedDept || String(t.departmentId) === String(selectedDept);
            const matchKw = !kw || [t.code, t.titleVi, t.titleEn, t.primaryAdvisorName, t.coAdvisorName, t.departmentName]
                .some(v => removeVietnameseTones(v).includes(kw));
            return matchDept && matchKw;
        });

        if (tbody) {
            tbody.innerHTML = list.length ? list.map((t, i) => `
                <tr style="border-top: 1px solid #e2e8f0;">
                    <td style="padding: 10px 12px;">${i + 1}</td>
                    <td style="padding: 10px 12px; font-weight: 600; color: #1e40af;">${escapeHtml(t.code)}</td>
                    <td style="padding: 10px 12px; min-width: 240px; font-weight: 500;">${escapeHtml(t.titleVi)}</td>
                    <td style="padding: 10px 12px;">${escapeHtml(t.primaryAdvisorName || '-')}${t.coAdvisorName ? '<br><small style="color:#64748b;">+ ' + escapeHtml(t.coAdvisorName) + '</small>' : ''}</td>
                    <td style="padding: 10px 12px;">${escapeHtml(t.departmentName || '-')}</td>
                    <td style="padding: 10px 12px;">${escapeHtml(t.periodName || '-')}</td>
                    <td style="padding: 10px 12px; text-align: center;">${t.maxStudents ?? '-'}</td>
                    <td style="padding: 10px 12px;">${topicGroupText(t)}</td>
                    <td style="padding: 10px 12px; white-space: nowrap; text-align: center;">
                        <button type="button" class="btn btn-secondary btn-sm" onclick="showTopicDetail(${t.id})">Chi tiết</button>
                    </td>
                </tr>`).join('')
                : '<tr><td colspan="9" class="text-center py-4" style="padding: 24px; text-align: center; color: #64748b;">Không tìm thấy đề tài nào phù hợp.</td></tr>';
        }

        if (countEl) {
            countEl.textContent = `Hiển thị ${list.length} / ${topicsCache.length} đề tài đã công bố`;
        }
    }

    async function loadTopics() {
        showError('');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="9" class="text-center py-4" style="padding: 24px; text-align: center; color: #64748b;">Đang tải danh sách đề tài...</td></tr>';
        }
        const periodId = periodFilter?.value;
        const deptId = deptFilter?.value;

        let params = new URLSearchParams();
        params.append('status', 'APPROVED');
        if (periodId) params.append('periodId', periodId);
        if (deptId) params.append('departmentId', deptId);

        try {
            const response = await apiFetch(`/topics?${params.toString()}`);
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || 'Không thể tải danh sách đề tài.');
            topicsCache = Array.isArray(result.data) ? result.data : [];
            render();
        } catch (error) {
            topicsCache = [];
            if (tbody) {
                tbody.innerHTML = `<tr><td colspan="9" class="text-center py-4" style="padding: 24px; text-align: center; color: #b91c1c;">${error.message || 'Không thể tải danh sách đề tài.'}</td></tr>`;
            }
            if (countEl) countEl.textContent = '';
            showError(error.message || 'Không thể tải danh sách đề tài.');
        }
    }

    async function loadPeriods() {
        if (!periodFilter) return;
        try {
            const response = await apiFetch('/registration-periods');
            const result = await response.json();
            if (response.ok && Array.isArray(result.data)) {
                result.data.filter(p => p.status !== 'DRAFT').forEach(p => {
                    periodFilter.insertAdjacentHTML('beforeend', `<option value="${p.id}">${escapeHtml(p.name)}</option>`);
                });
            }
        } catch (e) {
            console.error('Lỗi tải danh sách đợt:', e);
        }
    }

    async function loadDepartments() {
        if (!deptFilter) return;
        try {
            const response = await apiFetch('/departments');
            const result = await response.json();
            if (response.ok && Array.isArray(result.data)) {
                result.data.forEach(d => {
                    deptFilter.insertAdjacentHTML('beforeend', `<option value="${d.id}">${escapeHtml(d.name)}</option>`);
                });
            }
        } catch (e) {
            console.error('Lỗi tải danh sách bộ môn:', e);
        }
    }

    const btnReload = document.getElementById('btnReloadTopics');
    if (btnReload) btnReload.addEventListener('click', loadTopics);
    if (periodFilter) periodFilter.addEventListener('change', loadTopics);
    if (deptFilter) deptFilter.addEventListener('change', render);
    if (searchInput) searchInput.addEventListener('input', render);

    Promise.all([loadPeriods(), loadDepartments()])
        .then(loadTopics)
        .catch(err => {
            console.error('Lỗi khởi tạo:', err);
            showError('Lỗi khi tải bộ lọc.');
        });
});