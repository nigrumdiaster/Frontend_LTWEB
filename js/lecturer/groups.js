// Trang nhóm hướng dẫn (giảng viên)
// API: GET /api/groups?periodId=   danh sách nhóm trong đợt (lọc client theo đề tài tôi hướng dẫn)
//      GET /api/registration-periods  đổ danh sách đợt

let groupsCache = [];

function isMyGroup(g) {
    const me = getMe();
    const t = g.topic || {};
    if (!me) return false;
    return String(t.primaryAdvisorId) === String(me.id);
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btnResetFilters').addEventListener('click', () => {
        document.getElementById('periodSelect').value = '';
        document.getElementById('groupSearch').value = '';
        document.getElementById('onlyMineGroups').checked = true;
        loadGroups();
    });

    const periodSelect = document.getElementById('periodSelect');
    const searchInput = document.getElementById('groupSearch');
    const onlyMine = document.getElementById('onlyMineGroups');
    const area = document.getElementById('groupArea');
    const errorEl = document.getElementById('groupLoadError');

    const card = 'background:white; border-radius:12px; padding:20px 24px; border:1px solid #e2e8f0; margin-bottom:16px;';

    function showError(msg) {
        errorEl.textContent = msg || '';
        errorEl.style.display = msg ? 'block' : 'none';
    }

    function render() {
        const list = groupsCache;

        if (!list.length) {
            area.innerHTML = `<div style="${card} color:#64748b;">Không có nhóm nào.</div>`;
            return;
        }

        area.innerHTML = list.map(g => {
            const t = g.topic || {};
            const members = (g.members || []).map(m => `
                <tr style="border-top:1px solid #f1f5f9;">
                    <td style="padding:8px 12px; font-weight:600;">${escapeHtml(m.studentName)}${m.groupRole === 'LEADER' ? ' <span style="color:#2563eb; font-size:12px;">(Nhóm trưởng)</span>' : ''}</td>
                    <td style="padding:8px 12px;">${escapeHtml(m.studentCode || '-')}</td>
                    <td style="padding:8px 12px;">${escapeHtml(m.studentEmail || '-')}</td>
                    <td style="padding:8px 12px;">${escapeHtml(m.studentPhone || '-')}</td>
                    <td style="padding:8px 12px;">${escapeHtml(m.studentClass || '-')}</td>
                </tr>`).join('');

            const report = g.reportUrl
                ? `<a href="${escapeHtml(g.reportUrl)}" target="_blank" rel="noopener">${escapeHtml(g.reportUrl)}</a>${g.reportNote ? '<br><span style="color:#64748b;">Ghi chú: ' + escapeHtml(g.reportNote) + '</span>' : ''}${g.submittedAt ? '<br><span style="color:#64748b;">Nộp lúc: ' + escapeHtml(fmtDateTime(g.submittedAt)) + '</span>' : ''}`
                : '<span style="color:#64748b;">Chưa nộp báo cáo</span>';

            return `
                <div style="${card}">
                    <div style="display:flex; justify-content:space-between; flex-wrap:wrap; gap:8px;">
                        <div>
                            <h3 style="margin:0; color:#0f172a;">${escapeHtml(g.name)}</h3>
                            <p style="color:#64748b; font-size:14px; margin:4px 0 0;">Mã nhóm: <strong>${escapeHtml(g.code || '-')}</strong>${g.status ? ' · Trạng thái: <strong>' + escapeHtml(g.status === 'REGISTERED' ? 'Đã đăng ký đề tài' : g.status) + '</strong>' : ''}</p>
                        </div>
                        <div style="font-size:14px; color:#64748b;">${(g.members || []).length} thành viên</div>
                    </div>
                    <p style="margin:12px 0 0; font-size:14px;"><span style="color:#64748b;">Đề tài:</span> <strong>${escapeHtml(t.code ? t.code + ' - ' : '')}${escapeHtml(g.topicTitleVi || t.titleVi || 'Chưa đăng ký')}</strong>
                        ${t.primaryAdvisorName ? '<br><span style="color:#64748b;">GVHD:</span> ' + escapeHtml(t.primaryAdvisorName) : ''}</p>
                    <div style="overflow-x:auto; margin-top:12px;">
                        <table style="width:100%; border-collapse:collapse; font-size:14px;">
                            <thead><tr style="background:#f1f5f9; text-align:left; color:#475569;">
                                <th style="padding:8px 12px;">Họ và tên</th><th style="padding:8px 12px;">Mã SV</th>
                                <th style="padding:8px 12px;">Email</th><th style="padding:8px 12px;">SĐT</th><th style="padding:8px 12px;">Lớp</th>
                            </tr></thead>
                            <tbody>${members || '<tr><td colspan="100%" class="text-center py-4">Chưa có dữ liệu</td></tr>'}</tbody>
                        </table>
                    </div>
                    <p style="margin:12px 0 0; font-size:14px;"><span style="color:#64748b;">Báo cáo:</span> ${report}</p>
                </div>`;
        }).join('');
    }

    async function loadGroups() {
        showError('');
        const periodId = periodSelect.value;
        if (!periodId) {
        hideServerPagination('groupArea');
            groupsCache = [];
            area.textContent = 'Vui lòng chọn đợt đăng ký.';
            return;
        }
        area.innerHTML = `<div style="${card} color:#64748b;">Đang tải...</div>`;
        const { ok, result } = await callAPI('/groups?periodId=' + encodeURIComponent(periodId) + '&keyword=' + encodeURIComponent(searchInput.value.trim()) + (onlyMine.checked && getMe() ? '&advisorId=' + getMe().id : ''), { method: 'GET', pagination: { target: 'groupArea', reload: loadGroups } });
        if (ok) {
            groupsCache = Array.isArray(result.data) ? result.data : [];
            render();
        } else {
            groupsCache = [];
            area.innerHTML = '';
            showError(result.message || 'Không thể tải danh sách nhóm.');
        }
    }

    async function loadPeriods() {
        const { ok, result } = await callAPI('/registration-periods', { method: 'GET' });
        if (!ok) throw new Error(result.message || 'Không thể tải danh sách đợt đăng ký.');
        const periods = ok && Array.isArray(result.data) ? result.data.filter(p => p.status !== 'DRAFT') : [];
        if (!periods.length) {
            periodSelect.innerHTML = '<option value="">Chưa có đợt đăng ký</option>';
            area.innerHTML = '';
            return false;
        }
        periodSelect.innerHTML = '<option value="">-- Chọn đợt đăng ký --</option>' + 
            periods.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
        area.innerHTML = `<div style="${card} color:#64748b;">Vui lòng chọn đợt đăng ký để xem danh sách nhóm sinh viên.</div>`;
        return true;
    }

    document.getElementById('btnReloadGroups').addEventListener('click', loadGroups);
    periodSelect.addEventListener('change', loadGroups);
    onlyMine.addEventListener('change', loadGroups);
    searchInput.addEventListener('input', debounce(loadGroups));

    loadPeriods().catch(error => {
        console.error('Lỗi tải danh sách đợt:', error);
        showError(error.message || 'Không thể tải danh sách đợt đăng ký.');
    });
});