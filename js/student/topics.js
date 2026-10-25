// Trang đề tài đã công bố (Sinh viên)
// API: GET /api/topics?status=APPROVED   danh sách đề tài đã công bố
//      GET /api/topics/{id}              chi tiết đề tài
//      GET /api/registration-periods     danh sách đợt đăng ký
//      GET /api/departments             danh sách bộ môn

let topicsCache = [];
let cataloguePeriods = [];

function topicGroupLink(topic) {
    return `my-group.html?periodId=${encodeURIComponent(topic.periodId)}&topicId=${encodeURIComponent(topic.id)}`;
}

function topicCard(topic) {
    const period = cataloguePeriods.find(p => String(p.id) === String(topic.periodId));
    const available = topic.isAssigned === false;
    return `<article class="topic-card">
        <div class="catalogue-card-top"><span class="topic-code">${escapeText(topic.code || 'ĐỀ TÀI')}</span><span class="catalogue-badge ${available ? 'open' : 'neutral'}">${available ? '● Còn trống' : topic.isAssigned ? 'Đã có nhóm' : 'Chưa rõ tình trạng'}</span></div>
        <h2>${escapeText(topic.titleVi || 'Đề tài chưa có tên')}</h2>
        <p class="topic-description">${escapeText(topic.description || 'Xem chi tiết để tìm hiểu nội dung và yêu cầu thực hiện.')}</p>
        <p class="topic-registered-group"><span>Nhóm đăng ký:</span> <strong>${escapeText(getAssignedGroupLabel(topic))}</strong></p>
        <dl class="topic-facts"><div><dt>Giảng viên hướng dẫn</dt><dd>${escapeText(topic.primaryAdvisorName || 'Chưa cập nhật')}</dd></div><div><dt>Bộ môn</dt><dd>${escapeText(topic.departmentName || 'Chưa cập nhật')}</dd></div><div><dt>Đợt đăng ký</dt><dd>${escapeText(topic.periodName || period?.name || 'Chưa cập nhật')}</dd></div><div><dt>Quy mô nhóm tối đa</dt><dd>${escapeText(topic.maxStudents ?? '—')} sinh viên</dd></div></dl>
        <div class="catalogue-actions"><button type="button" class="btn btn-action-view" onclick="showTopicDetail(${Number(topic.id)})">Xem chi tiết <span aria-hidden="true">→</span></button>${available && StudentDiscovery.registration(period).open ? `<a class="btn btn-ghost" href="${topicGroupLink(topic)}">Đến nhóm của tôi</a>` : ''}</div>
    </article>`;
}

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
    return `<span style="color:${t.isAssigned || t.assignedGroupId != null ? '#b45309' : '#15803d'}; font-weight:600;">${escapeText(getAssignedGroupLabel(t))}</span>`;
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
            field('Giảng viên hướng dẫn', advisor(t.primaryAdvisorName, t.primaryAdvisorEmail)),
            field('Bộ môn', escapeHtml(t.departmentName || '-')),
            field('Đợt đăng ký', escapeHtml(t.periodName || '-')),
            field('Số sinh viên tối đa', t.maxStudents ?? '-'),
            field('Nhóm đã đăng ký', topicGroupText(t)),
            field('Người duyệt', escapeHtml(t.approvedByName || '-')),
            field('Ngày duyệt', fmtDateTime(t.approvedAt))
        ].join('');
        const groupLink = document.getElementById('topicModalGroupLink');
        const period = cataloguePeriods.find(p => String(p.id) === String(t.periodId));
        groupLink.hidden = t.isAssigned !== false || !StudentDiscovery.registration(period).open;
        groupLink.href = topicGroupLink(t);
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
        document.getElementById('onlyAvailableTopics').checked = false;
        loadTopics();
    });

    const tbody = document.getElementById('topicTableBody');
    const periodFilter = document.getElementById('periodFilter');
    const deptFilter = document.getElementById('deptFilter');
    const searchInput = document.getElementById('topicSearch');
    const countEl = document.getElementById('topicCount');
    const errorEl = document.getElementById('topicLoadError');
    const cards = document.getElementById('topicCards');
    const onlyAvailable = document.getElementById('onlyAvailableTopics');
    let requestVersion = 0;
    StudentDiscovery.initViews(view => {
        cards.hidden = view !== 'cards';
        document.getElementById('topicTableView').hidden = view !== 'table';
    });

    function renderPeriodContext() {
        const p = cataloguePeriods.find(p => String(p.id) === periodFilter.value);
        const area = document.getElementById('selectedPeriodContext');
        area.hidden = !p;
        area.innerHTML = p ? `<div class="catalogue-card-top"><span class="catalogue-eyebrow">ĐỀ TÀI TRONG ĐỢT</span>${StudentDiscovery.badge(p)}</div><h2>${escapeText(p.name)}</h2><p class="catalogue-muted">${escapeText(StudentDiscovery.types[p.type] || p.type || '')} · Học kỳ ${escapeText(p.semester || '—')} / ${escapeText(p.academicYear || '—')}<br>Hạn đăng ký: <strong>${escapeText(StudentDiscovery.date(p.studentRegEnd))}</strong></p>${StudentDiscovery.progress(p)}` : '';
        const url = new URL(window.location.href);
        if (periodFilter.value) url.searchParams.set('periodId', periodFilter.value);
        else url.searchParams.delete('periodId');
        history.replaceState(null, '', url);
    }

    function showError(msg) {
        if (!errorEl) return;
        errorEl.textContent = msg || '';
        errorEl.style.display = msg ? 'block' : 'none';
    }

    function render() {
        const list = topicsCache;
        cards.innerHTML = list.length ? list.map(topicCard).join('') : StudentDiscovery.empty('Không tìm thấy đề tài phù hợp. Thử đổi đợt, bộ môn hoặc bỏ bộ lọc còn trống.');

        if (tbody) {
            tbody.innerHTML = list.length ? list.map((t, i) => `
                <tr style="border-top: 1px solid #e2e8f0;">
                    <td style="padding: 10px 12px;">${i + 1}</td>
                    <td style="padding: 10px 12px; font-weight: 600; color: #1e40af;">${escapeHtml(t.code)}</td>
                    <td style="padding: 10px 12px; min-width: 240px; font-weight: 500;">${escapeHtml(t.titleVi)}</td>
                    <td style="padding: 10px 12px;">${escapeHtml(t.primaryAdvisorName || '-')}</td>
                    <td style="padding: 10px 12px;">${escapeHtml(t.departmentName || '-')}</td>
                    <td style="padding: 10px 12px;">${escapeHtml(t.periodName || '-')}</td>
                    <td style="padding: 10px 12px; text-align: center;">${t.maxStudents ?? '-'}</td>
                    <td style="padding: 10px 12px;">${topicGroupText(t)}</td>
                    <td style="padding: 10px 12px; white-space: nowrap; text-align: center;">
                        <button type="button" class="btn btn-action-view btn-sm" onclick="showTopicDetail(${t.id})">Chi tiết</button>
                    </td>
                </tr>`).join('')
                : '<tr><td colspan="9" class="text-center py-4" style="padding: 24px; text-align: center; color: #64748b;">Không tìm thấy đề tài nào phù hợp.</td></tr>';
        }

        if (countEl) {
            countEl.textContent = `Hiển thị ${list.length} / ${getServerPagination(tbody)?.totalElements ?? topicsCache.length} đề tài đã công bố`;
        }
    }

    async function loadTopics() {
        const version = ++requestVersion;
        showError('');
        renderPeriodContext();
        cards.innerHTML = StudentDiscovery.empty('Đang tải đề tài đã công bố…');
        countEl.textContent = 'Đang tải dữ liệu…';
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="9" class="text-center py-4" style="padding: 24px; text-align: center; color: #64748b;">Đang tải danh sách đề tài...</td></tr>';
        }
        const periodId = periodFilter?.value;
        const deptId = deptFilter?.value;

        let params = new URLSearchParams();
        params.append('status', 'APPROVED');
        if (searchInput.value.trim()) params.set('keyword', searchInput.value.trim());
        if (periodId) params.append('periodId', periodId);
        if (deptId) params.append('departmentId', deptId);
        if (onlyAvailable.checked) params.set('isAssigned', 'false');

        try {
            const response = await apiFetchTable(`/topics?${params.toString()}`, {}, 'topicTableBody', loadTopics);
            StudentDiscovery.movePager(tbody);
            const result = await response.json();
            if (version !== requestVersion) return;
            if (!response.ok || !result.success) throw new Error(result.message || 'Không thể tải danh sách đề tài.');
            topicsCache = Array.isArray(result.data) ? result.data : [];
            render();
        } catch (error) {
            if (version !== requestVersion) return;
            topicsCache = [];
            cards.innerHTML = StudentDiscovery.empty('Chưa tải được đề tài. Bấm “Tải lại” để thử lại.');
            if (tbody) {
                tbody.innerHTML = `<tr><td colspan="9" class="text-center py-4">${escapeText(error.message || 'Không thể tải danh sách đề tài.')}</td></tr>`;
            }
            if (countEl) countEl.textContent = '';
            showError(error.message || 'Không thể tải danh sách đề tài.');
        }
    }

    async function loadPeriods() {
        if (!periodFilter) return;
        try {
            const response = await apiFetchAll('/registration-periods');
            const result = await response.json();
            if (response.ok && result.success && Array.isArray(result.data)) {
                const requestedId = periodFilter.value || new URLSearchParams(window.location.search).get('periodId');
                cataloguePeriods = result.data.filter(p => p.status !== 'DRAFT');
                periodFilter.replaceChildren(new Option('Tất cả đợt đăng ký', ''));
                cataloguePeriods.forEach(p => {
                    periodFilter.add(new Option(p.name, p.id));
                });
                if (cataloguePeriods.some(p => String(p.id) === requestedId)) periodFilter.value = requestedId;
            } else {
                throw new Error(result.message || 'Không thể tải danh sách đợt đăng ký.');
            }
        } catch (e) {
            console.error('Lỗi tải danh sách đợt:', e);
            throw e;
        }
    }

    async function loadDepartments() {
        if (!deptFilter) return;
        try {
            const response = await apiFetchAll('/departments');
            const result = await response.json();
            if (response.ok && result.success && Array.isArray(result.data)) {
                const selected = deptFilter.value;
                deptFilter.replaceChildren(new Option('Tất cả bộ môn', ''));
                result.data.forEach(d => {
                    deptFilter.add(new Option(d.name, d.id));
                });
                deptFilter.value = selected;
            } else {
                throw new Error(result.message || 'Không thể tải danh sách bộ môn.');
            }
        } catch (e) {
            console.error('Lỗi tải danh sách bộ môn:', e);
            throw e;
        }
    }

    const btnReload = document.getElementById('btnReloadTopics');
    if (btnReload) btnReload.addEventListener('click', initializeCatalogue);
    if (periodFilter) periodFilter.addEventListener('change', loadTopics);
    if (deptFilter) deptFilter.addEventListener('change', loadTopics);
    if (searchInput) searchInput.addEventListener('input', debounce(loadTopics));
    onlyAvailable.addEventListener('change', loadTopics);

    async function initializeCatalogue() {
        try {
            await Promise.all([loadPeriods(), loadDepartments()]);
            await loadTopics();
        } catch (err) {
            console.error('Lỗi khởi tạo:', err);
            showError(err.message || 'Lỗi khi tải bộ lọc.');
            cards.innerHTML = StudentDiscovery.empty('Không tải được bộ lọc. Bấm “Tải lại” để thử lại.');
            countEl.textContent = '';
        }
    }
    initializeCatalogue();
});
