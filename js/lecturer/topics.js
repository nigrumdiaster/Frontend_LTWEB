// Trang đề tài (giảng viên)
// API: GET /api/topics            danh sách đề tài (lọc client theo "của tôi")
//      GET /api/topics/{id}       chi tiết
//      DELETE /api/topics/{id}    xóa đề tài của mình (khi chưa có nhóm nhận)
//      GET /api/registration-periods  đổ bộ lọc đợt

let topicsCache = [];

function openTopicModal() { const m = document.getElementById('topicModal'); if (m) m.style.display = 'flex'; }
function closeTopicModal() { const m = document.getElementById('topicModal'); if (m) m.style.display = 'none'; }

function isMyTopic(t) {
    const me = getMe();
    if (!me) return false;
    return String(t.primaryAdvisorId) === String(me.id) || String(t.coAdvisorId) === String(me.id);
}

function topicGroupText(t) {
    return `<span style="color:${t.isAssigned || t.assignedGroupId != null ? '#b45309' : '#15803d'}; font-weight:600;">${escapeText(getAssignedGroupLabel(t))}</span>`;
}

async function showTopicDetail(id) {
    const { ok, result } = await callAPI('/topics/' + id, { method: 'GET' });
    if (!ok || !result.data) { await showAlert(result.message || 'Không thể tải chi tiết đề tài.'); return; }
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
        wide('Mô tả', escapeHtml(t.description || '-')),
        wide('Yêu cầu', escapeHtml(t.requirements || '-')),
        field('GV hướng dẫn chính', advisor(t.primaryAdvisorName, t.primaryAdvisorEmail)),
        field('GV đồng hướng dẫn', advisor(t.coAdvisorName, t.coAdvisorEmail)),
        field('Bộ môn', escapeHtml(t.departmentName || '-')),
        field('Đợt đăng ký', escapeHtml(t.periodName || '-')),
        field('Số sinh viên tối đa', t.maxStudents ?? '-'),
        field('Nhóm nhận đề tài', topicGroupText(t)),
        field('Trạng thái duyệt', approvalBadge(t.approvalStatus)),
        field('Người duyệt', escapeHtml(t.approvedByName || '-')),
        field('Ngày duyệt', fmtDateTime(t.approvedAt)),
        field('Ngày tạo', fmtDateTime(t.createdAt)),
        t.rejectionReason ? wide('Lý do từ chối', escapeHtml(t.rejectionReason)) : ''
    ].join('');
    openTopicModal();
}

async function deleteTopic(id) {
    if (!(await confirmAction('Bạn chắc chắn muốn xóa đề tài này? (Chỉ xóa được khi chưa có nhóm nhận)'))) return;
    const { ok, result } = await callAPI('/topics/' + id, { method: 'DELETE' });
    if (ok) {
        await showAlert('Đã xóa đề tài.');
        document.getElementById('btnReloadTopics').click();
    } else {
        await showAlert(result.message || 'Xóa đề tài thất bại!');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btnResetFilters').addEventListener('click', () => {
        document.getElementById('periodFilter').value = '';
        document.getElementById('approvalFilter').value = '';
        document.getElementById('topicSearch').value = '';
        document.getElementById('onlyMine').checked = true;
        loadTopics();
    });

    const tbody = document.getElementById('topicTableBody');
    const periodFilter = document.getElementById('periodFilter');
    const approvalFilter = document.getElementById('approvalFilter');
    const searchInput = document.getElementById('topicSearch');
    const onlyMine = document.getElementById('onlyMine');
    const countEl = document.getElementById('topicCount');
    const errorEl = document.getElementById('topicLoadError');

    function showError(msg) {
        errorEl.textContent = msg || '';
        errorEl.style.display = msg ? 'block' : 'none';
    }

    function render() {
        const list = topicsCache;

        tbody.innerHTML = list.length ? list.map((t, i) => `
            <tr style="border-top: 1px solid #e2e8f0;">
                <td style="padding: 10px 12px;">${i + 1}</td>
                <td style="padding: 10px 12px; font-weight: 600;">${escapeHtml(t.code)}</td>
                <td style="padding: 10px 12px; min-width: 240px;">${escapeHtml(t.titleVi)}</td>
                <td style="padding: 10px 12px;">${escapeHtml(t.primaryAdvisorName || '-')}${t.coAdvisorName ? '<br><small style="color:#64748b;">+ ' + escapeHtml(t.coAdvisorName) + '</small>' : ''}</td>
                <td style="padding: 10px 12px;">${escapeHtml(t.periodName || '-')}</td>
                <td style="padding: 10px 12px;">${approvalBadge(t.approvalStatus)}</td>
                <td style="padding: 10px 12px;">${topicGroupText(t)}</td>
                <td style="padding: 10px 12px; white-space: nowrap;">
                    <button type="button" class="btn btn-secondary btn-sm" onclick="showTopicDetail(${t.id})">Chi tiết</button>
                    ${isMyTopic(t) && !t.isAssigned ? `<button type="button" class="btn btn-secondary btn-sm" onclick="openEditTopic(${t.id})">Sửa</button> <button type="button" class="btn btn-secondary btn-sm" onclick="deleteTopic(${t.id})">Xóa</button>` : ''}
                    ${canApprove(t) ? `<button type="button" class="btn btn-primary btn-sm" onclick="openApproval(${t.id})">Duyệt</button>` : ''}
                </td>
            </tr>`).join('')
            : '<tr><td colspan="100%" class="text-center py-4">Chưa có dữ liệu</td></tr>';
        countEl.textContent = `Hiển thị ${list.length} / ${getServerPagination(tbody)?.totalElements ?? topicsCache.length} đề tài`;
        updateApprovalNotice();
    }

    async function loadTopics() {
        showError('');
        tbody.innerHTML = '<tr><td colspan="100%" class="text-center py-4">Đang tải dữ liệu...</td></tr>';
        const params = new URLSearchParams({ keyword: searchInput.value.trim() });
        if (periodFilter.value) params.set('periodId', periodFilter.value);
        if (approvalFilter.value) params.set('status', approvalFilter.value);
        if (onlyMine.checked && getMe()) params.set('advisorId', getMe().id);
        const query = '?' + params;
        const { ok, result } = await callAPI('/topics' + query, { method: 'GET', pagination: { target: 'topicTableBody', reload: loadTopics } });
        if (ok) {
            topicsCache = Array.isArray(result.data) ? result.data : [];
            populateFilterOptions(
                approvalFilter,
                ['PENDING','APPROVED','REJECTED'],
                'Tất cả',
                status => ({ PENDING: 'Chờ duyệt', APPROVED: 'Đã duyệt', REJECTED: 'Bị từ chối' }[status] || status)
            );
            render();
        } else {
            topicsCache = [];
            tbody.innerHTML = '';
            countEl.textContent = '';
            showError(result.message || 'Không thể tải danh sách đề tài.');
        }
    }

    async function loadPeriods() {
        const { ok, result } = await callAPI('/registration-periods', { method: 'GET' });
        if (!ok) throw new Error(result.message || 'Không thể tải danh sách đợt đăng ký.');
        if (!Array.isArray(result.data)) return;
        result.data.filter(p => p.status !== 'DRAFT').forEach(p =>
            periodFilter.insertAdjacentHTML('beforeend', `<option value="${p.id}">${escapeHtml(p.name)}</option>`));
    }

    document.getElementById('btnReloadTopics').addEventListener('click', loadTopics);
    periodFilter.addEventListener('change', loadTopics);
    approvalFilter.addEventListener('change', loadTopics);
    onlyMine.addEventListener('change', loadTopics);
    searchInput.addEventListener('input', debounce(loadTopics));

    Promise.all([loadPeriods(), loadHeadDepartments()]).then(loadTopics).catch(error => {
        console.error('Lỗi tải bộ lọc đề tài:', error);
        showError(error.message || 'Không thể tải bộ lọc đề tài.');
        tbody.innerHTML = '<tr><td colspan="100%" class="text-center py-4">Không thể tải dữ liệu.</td></tr>';
    });
});


// ===================== ĐỀ XUẤT ĐỀ TÀI (POST /api/topics) =====================
// TopicCreateRequest: titleVi*, titleEn, description*, requirements, maxStudents*, departmentId*, periodId*, coAdvisorId

function openCreateModal() { const m = document.getElementById('createTopicModal'); if (m) m.style.display = 'flex'; }
function closeCreateTopic() { const m = document.getElementById('createTopicModal'); if (m) m.style.display = 'none'; }

async function loadCoAdvisors() {
    const deptId = document.getElementById('ctDepartment').value;
    const select = document.getElementById('ctCoAdvisor');
    select.innerHTML = '<option value="">-- Không có --</option>';
    if (!deptId) return;
    const me = getMe();
    const { ok, result } = await callAPI('/users/lecturers/department/' + encodeURIComponent(deptId), { method: 'GET' });
    if (!ok) {
        await showAlert(result.message || 'Không thể tải danh sách giảng viên.');
        return;
    }
    if (!Array.isArray(result.data)) return;
    result.data
        .filter(u => u.active !== false && (!me || String(u.id) !== String(me.id)))
        .forEach(u => select.insertAdjacentHTML('beforeend',
            `<option value="${u.id}">${escapeHtml(u.fullName)}${u.code ? ' (' + escapeHtml(u.code) + ')' : ''}</option>`));
}

async function openCreateTopic() {
    document.getElementById('createTopicForm').reset();
    document.getElementById('ctMaxStudents').value = '';
    document.getElementById('ctId').value = '';
    document.getElementById('ctTitleHeading').textContent = 'Đề Xuất Đề Tài Mới';
    document.getElementById('ctPeriod').parentElement.style.display = '';
    document.getElementById('ctPeriod').required = true;
    const me = getMe();

    const [pRes, dRes] = await Promise.all([
        callAPI('/registration-periods', { method: 'GET' }),
        callAPI('/departments', { method: 'GET' })
    ]);
    if (!pRes.ok || !dRes.ok) {
        await showAlert(pRes.result.message || dRes.result.message || 'Không thể tải dữ liệu biểu mẫu.');
        return;
    }

    const periods = pRes.ok && Array.isArray(pRes.result.data) ? pRes.result.data.filter(p => p.status !== 'DRAFT') : [];
    const periodSelect = document.getElementById('ctPeriod');
    periodSelect.innerHTML = periods.length
        ? periods.map(p => `<option value="${p.id}">${escapeHtml(p.name)}${p.status === 'PHASE1_LECTURER_REGISTRATION' ? ' - đang mở đề xuất' : ''}</option>`).join('')
        : '<option value="">Chưa có đợt đăng ký</option>';
    const open = periods.find(p => p.status === 'PHASE1_LECTURER_REGISTRATION');
    if (open) periodSelect.value = open.id;

    const depts = dRes.ok && Array.isArray(dRes.result.data) ? dRes.result.data : [];
    const deptSelect = document.getElementById('ctDepartment');
    deptSelect.innerHTML = depts.length
        ? depts.map(d => `<option value="${d.id}">${escapeHtml(d.name)}</option>`).join('')
        : '<option value="">Chưa có bộ môn</option>';
    if (me && me.departmentId && depts.some(d => String(d.id) === String(me.departmentId))) {
        deptSelect.value = me.departmentId;
    }

    await loadCoAdvisors();
    openCreateModal();
}

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('createTopicForm');
    if (!form) return;

    document.getElementById('ctDepartment').addEventListener('change', loadCoAdvisors);

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const val = id => document.getElementById(id).value.trim();

        const payload = {
            titleVi: val('ctTitleVi'),
            description: val('ctDescription'),
            maxStudents: Number(val('ctMaxStudents')),
            departmentId: Number(val('ctDepartment')),
            periodId: Number(val('ctPeriod'))
        };
        if (val('ctTitleEn')) payload.titleEn = val('ctTitleEn');
        if (val('ctRequirements')) payload.requirements = val('ctRequirements');
        if (val('ctCoAdvisor')) payload.coAdvisorId = Number(val('ctCoAdvisor'));

        const editId = document.getElementById('ctId').value;
        if ((!editId && !payload.periodId) || !payload.departmentId) {
            await showAlert('Vui lòng chọn đợt đăng ký và bộ môn!');
            return;
        }
        if (editId) {
            delete payload.periodId;
            if (!payload.coAdvisorId) payload.coAdvisorId = null; // bỏ GV đồng hướng dẫn
        }

        const { ok, result } = editId
            ? await callAPI('/topics/' + editId, { method: 'PUT', body: payload })
            : await callAPI('/topics', { method: 'POST', body: payload });
        if (ok) {
            await showAlert(editId ? 'Đã cập nhật đề tài!' : 'Đề xuất đề tài thành công! Đề tài đang chờ Trưởng khoa duyệt.');
            closeCreateTopic();
            document.getElementById('btnReloadTopics').click();
        } else {
            await showAlert(result.message || 'Đề xuất đề tài thất bại!');
        }
    });
});


// ===================== SỬA ĐỀ TÀI (PUT /api/topics/{id}) =====================
// TopicUpdateRequest: titleVi, titleEn, description, requirements, maxStudents, departmentId, coAdvisorId

async function openEditTopic(id) {
    const { ok, result } = await callAPI('/topics/' + id, { method: 'GET' });
    if (!ok || !result.data) { await showAlert(result.message || 'Không thể tải đề tài.'); return; }
    const t = result.data;

    await openCreateTopic(); // nạp danh sách bộ môn, GV và mở form
    document.getElementById('ctId').value = t.id;
    document.getElementById('ctTitleHeading').textContent = 'Sửa Đề Tài ' + (t.code || '');
    document.getElementById('ctPeriod').parentElement.style.display = 'none';
    document.getElementById('ctPeriod').required = false;

    const deptSelect = document.getElementById('ctDepartment');
    if ([...deptSelect.options].some(o => String(o.value) === String(t.departmentId))) deptSelect.value = t.departmentId;
    await loadCoAdvisors();
    document.getElementById('ctCoAdvisor').value = t.coAdvisorId || '';

    document.getElementById('ctTitleVi').value = t.titleVi || '';
    document.getElementById('ctTitleEn').value = t.titleEn || '';
    document.getElementById('ctDescription').value = t.description || '';
    document.getElementById('ctRequirements').value = t.requirements || '';
    document.getElementById('ctMaxStudents').value = t.maxStudents ?? '';
}

// ===================== DUYỆT ĐỀ TÀI (PATCH /api/topics/{id}/approval) =====================
// TopicApprovalRequest: approvalStatus (PENDING | APPROVED | REJECTED), rejectionReason
// Hiện nút "Duyệt" cho giảng viên là Trưởng bộ môn (departments[].headLecturerId = id của mình).

let headDeptIds = new Set();

async function loadHeadDepartments() {
    const me = getMe();
    headDeptIds = new Set();
    if (!me) return;
    const { ok, result } = await callAPI('/departments', { method: 'GET' });
    if (ok && Array.isArray(result.data)) {
        result.data.filter(d => String(d.headLecturerId) === String(me.id))
            .forEach(d => headDeptIds.add(String(d.id)));
    }
}

function canApprove(t) {
    return ['ROLE_ADMIN', 'ROLE_DEAN'].includes(getMe()?.role) && t.approvalStatus === 'PENDING';
}

function updateApprovalNotice() {
    const box = document.getElementById('approvalNotice');
    if (!box) return;
    const pending = topicsCache.filter(canApprove).length;
    if (!pending) { box.style.display = 'none'; return; }
    box.style.display = 'block';
    box.innerHTML = `Bạn là Trưởng bộ môn: có <strong>${pending}</strong> đề tài đang chờ duyệt.
        <a href="#" onclick="showPendingApprovals(); return false;">Xem các đề tài chờ duyệt</a>`;
}

function showPendingApprovals() {
    document.getElementById('onlyMine').checked = false;
    document.getElementById('approvalFilter').value = 'PENDING';
    document.getElementById('approvalFilter').dispatchEvent(new Event('change'));
}

function openApproval(id) {
    const t = topicsCache.find(x => x.id === id);
    if (!t) return;
    openPromptModal({
        title: 'Duyệt đề tài ' + (t.code || ''),
        sub: `<strong>${escapeHtml(t.titleVi || '')}</strong><br>GVHD: ${escapeHtml(t.primaryAdvisorName || '-')}`,
        submitText: 'Lưu quyết định',
        fields: [
            { name: 'approvalStatus', label: 'Quyết định', type: 'select', required: true, value: 'APPROVED',
              options: [{ value: 'APPROVED', label: 'Phê duyệt' }, { value: 'REJECTED', label: 'Từ chối' }] },
            { name: 'rejectionReason', label: 'Lý do từ chối (bắt buộc khi từ chối)', type: 'textarea' }
        ],
        onSubmit: async (v) => {
            if (v.approvalStatus === 'REJECTED' && !v.rejectionReason) {
                await showAlert('Vui lòng nhập lý do từ chối!');
                return false;
            }
            const body = { approvalStatus: v.approvalStatus };
            if (v.rejectionReason) body.rejectionReason = v.rejectionReason;
            const { ok, result } = await callAPI('/topics/' + id + '/approval', { method: 'PATCH', body });
            if (ok) {
                await showAlert(v.approvalStatus === 'APPROVED' ? 'Đã phê duyệt đề tài.' : 'Đã từ chối đề tài.');
                document.getElementById('btnReloadTopics').click();
                return true;
            }
            await showAlert(result.message || 'Không thể lưu quyết định!');
            return false;
        }
    });
}
