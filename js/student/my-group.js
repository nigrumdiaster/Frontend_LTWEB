// Trang "Nhóm của tôi" (sinh viên)
// API dùng:
//   GET    /api/groups/my-group?periodId=            xem nhóm (404 nếu chưa có nhóm)
//   POST   /api/groups                {name, periodId, memberStudentIds[]}
//   POST   /api/groups/{id}/members   {studentId}
//   DELETE /api/groups/{id}/members/{studentId}
//   POST   /api/groups/{id}/register-topic  {topicId}
//   DELETE /api/groups/{id}/cancel-topic
//   POST   /api/groups/{id}/reports   {reportUrl, reportNote}
//   GET    /api/topics/published?periodId=            đề tài để đăng ký
//   GET    /api/registration-periods                  danh sách đợt

const MIN_GROUP_MEMBERS = 3;
const MAX_GROUP_MEMBERS = 5;

let me = null;
let currentGroup = null;
let selectedMembers = []; // dùng khi tạo nhóm mới

function escapeHtml(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function getMe() {
    try { return JSON.parse(localStorage.getItem('user')); } catch (e) { return null; }
}

// Gọi API, luôn trả về { ok, status, result } và không ném lỗi khi server trả 4xx
async function callAPI(path, options = {}) {
    const opts = { ...options };
    if (opts.body && typeof opts.body !== 'string') {
        opts.headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
        opts.body = JSON.stringify(opts.body);
    }
    try {
        const response = await apiFetchAll(path, opts);
        const result = response.status === 204 ? {} : await response.json();
        return { ok: response.ok && result.success !== false, status: response.status, result };
    } catch (error) {
        console.error(`Lỗi gọi API ${path}:`, error);
        return {
            ok: false,
            status: 0,
            result: { success: false, message: error.message || 'Không thể kết nối đến máy chủ.' }
        };
    }
}

function cardStyle() {
    return 'background:white; border-radius:12px; padding:24px; border:1px solid #e2e8f0; margin-bottom:20px;';
}

// ---------- Thành viên (theo response thực tế của API nhóm) ----------
// members[]: { id, studentId, studentName, studentCode, studentEmail, studentPhone, studentClass, groupRole: LEADER|MEMBER }
function memberId(m) { return m.studentId; }
function memberName(m) { return m.studentName || '-'; }
function memberCode(m) { return m.studentCode || ''; }
function memberIsLeader(m) { return m.groupRole === 'LEADER'; }
function getMembers(g) { return Array.isArray(g.members) ? g.members : []; }

const GROUP_STATUS_LABELS = {
    REGISTERED: 'Đã đăng ký đề tài'
};

function formatDateTime(value) {
    if (!value) return '';
    const d = new Date(value);
    return isNaN(d) ? String(value) : d.toLocaleDateString('vi-VN') + ' ' +
        d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

// true / false / null (không xác định được)
function amILeader(g) {
    if (!me) return null;
    if (g.leaderId != null) return String(g.leaderId) === String(me.id);
    const mine = getMembers(g).find(m => String(m.studentId) === String(me.id));
    return mine ? memberIsLeader(mine) : null;
}

document.addEventListener('DOMContentLoaded', async () => {
    const periodSelect = document.getElementById('periodSelect');
    let defaultPeriodId = '';
    document.getElementById('btnResetFilters').addEventListener('click', () => {
        periodSelect.value = defaultPeriodId;
        loadGroup();
    });
    const area = document.getElementById('groupArea');
    const errorEl = document.getElementById('groupLoadError');

    if (!localStorage.getItem('token')) {
        await showAlert('Bạn chưa đăng nhập!');
        window.location.href = '../index.html';
        return;
    }
    me = getMe();
    const idNote = document.getElementById('myIdNote');
    if (idNote && me && me.id != null) {
        idNote.innerHTML = 'ID tài khoản của bạn: <strong>' + escapeHtml(me.id) + '</strong> (đưa cho nhóm trưởng để được thêm vào nhóm)';
    }

    function showError(msg) {
        errorEl.textContent = msg || '';
        errorEl.style.display = msg ? 'block' : 'none';
    }

    // ---------- Tải đợt ----------
    async function loadPeriods() {
        const { ok, result } = await callAPI('/registration-periods', { method: 'GET' });
        if (!ok) throw new Error(result.message || 'Không thể tải danh sách đợt đăng ký.');
        const periods = ok && Array.isArray(result.data) ? result.data.filter(p => p.status !== 'DRAFT') : [];
        if (!periods.length) {
            periodSelect.innerHTML = '<option value="">Chưa có đợt đăng ký</option>';
            area.innerHTML = '';
            return false;
        }
        periodSelect.innerHTML = periods.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
        const open = periods.find(p => p.status === 'PHASE2_STUDENT_REGISTRATION');
        periodSelect.value = (open || periods[0]).id;
        defaultPeriodId = periodSelect.value;
        return true;
    }

    // ---------- Tải nhóm ----------
    let groupRequestVersion = 0;
    async function loadGroup() {
        const version = ++groupRequestVersion;
        showError('');
        currentGroup = null;
        const periodId = periodSelect.value;
        if (!periodId) return;
        area.innerHTML = `<div style="${cardStyle()} color:#64748b;">Đang tải...</div>`;
        try {
            const { ok, status, result } = await callAPI('/groups/my-group?periodId=' + encodeURIComponent(periodId), { method: 'GET' });
            if (version !== groupRequestVersion) return;
            if (ok && result.data) {
                currentGroup = result.data;
                await renderGroup(currentGroup);
            } else if (status === 404 || (ok && result.data === null)) {
                currentGroup = null;
                selectedMembers = [];
                renderNoGroup();
            } else {
                throw new Error(result.message || 'Không thể tải thông tin nhóm.');
            }
        } catch (error) {
            if (version !== groupRequestVersion) return;
            console.error('Lỗi tải nhóm:', error);
            area.innerHTML = '';
            showError(error.message || 'Lỗi kết nối máy chủ!');
        }
    }

    // ---------- Chưa có nhóm: form tạo nhóm ----------
    function renderNoGroup() {
        area.innerHTML = `
            <div style="${cardStyle()}">
                <h3 style="margin:0 0 4px; color:#0f172a;">Bạn chưa có nhóm trong đợt này</h3>
                <p style="color:#64748b; font-size:14px; margin:0 0 16px;">Tạo nhóm mới, bạn sẽ là nhóm trưởng. Mỗi nhóm tối đa ${MAX_GROUP_MEMBERS} sinh viên (gồm cả bạn).</p>

                <label style="display:block; color:#64748b; font-size:13px; margin-bottom:4px;">Tên nhóm (*)</label>
                <input type="text" id="newGroupName" placeholder="Nhập tên nhóm" style="width:100%; max-width:420px; padding:8px 12px; border:1px solid #cbd5e1; border-radius:8px; box-sizing:border-box;">

                <div style="margin-top:16px;">
                    <label style="display:block; color:#64748b; font-size:13px; margin-bottom:4px;">Thêm thành viên (tùy chọn)</label>
                    ${memberSearchHtml('create')}
                    <div id="selectedMembers" style="margin-top:8px;"></div>
                </div>

                <div style="margin-top:20px;">
                    <button type="button" class="btn btn-primary" id="btnCreateGroup">Tạo nhóm</button>
                </div>
            </div>`;
        bindMemberSearch('create');
        renderSelectedMembers();
        document.getElementById('btnCreateGroup').addEventListener('click', createGroup);
    }

    // GET /api/users trả 403 với tài khoản sinh viên nên không thể tìm theo tên.
    // Nhóm trưởng thêm thành viên bằng ID tài khoản (mỗi sinh viên xem ID của mình ở đầu trang này).
    function memberSearchHtml(mode) {
        return `
            <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
                <input type="number" min="1" id="searchInput_${mode}" placeholder="Nhập ID sinh viên..." style="min-width:200px; padding:8px 12px; border:1px solid #cbd5e1; border-radius:8px; box-sizing:border-box;">
                <button type="button" class="btn btn-secondary" id="btnSearch_${mode}">Thêm</button>
            </div>
            <p style="color:#64748b; font-size:13px; margin:6px 0 0;">Hỏi bạn học ID tài khoản của họ (hiển thị ở đầu trang "Nhóm của tôi" của họ).</p>`;
    }

    function bindMemberSearch(mode) {
        const input = document.getElementById('searchInput_' + mode);
        const btn = document.getElementById('btnSearch_' + mode);
        if (!input || !btn) return;
        btn.addEventListener('click', () => addById(mode));
        input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addById(mode); } });
    }

    function addById(mode) {
        const input = document.getElementById('searchInput_' + mode);
        const id = Number(input.value);
        if (!Number.isInteger(id) || id <= 0) { showAlert('Vui lòng nhập ID sinh viên hợp lệ!'); return; }
        if (me && Number(me.id) === id) { showAlert('Đó là ID của chính bạn.'); return; }
        if (mode === 'create') addSelectedMember({ id, name: 'Sinh viên', code: 'ID ' + id });
        else addMemberToGroup(id);
        input.value = '';
    }

    // ---------- Tạo nhóm ----------
    function addSelectedMember(m) {
        if (selectedMembers.some(x => x.id === m.id)) return;
        if (selectedMembers.length >= MAX_GROUP_MEMBERS - 1) {
            showAlert(`Nhóm tối đa ${MAX_GROUP_MEMBERS} thành viên (gồm cả bạn).`);
            return;
        }
        selectedMembers.push(m);
        renderSelectedMembers();
    }

    function renderSelectedMembers() {
        const box = document.getElementById('selectedMembers');
        if (!box) return;
        box.innerHTML = selectedMembers.length
            ? selectedMembers.map((m, i) => `
                <span style="display:inline-flex; align-items:center; gap:6px; background:#eff6ff; color:#1d4ed8; border-radius:999px; padding:4px 10px; margin:0 6px 6px 0; font-size:13px;">
                    ${escapeHtml(m.name)} ${escapeHtml(m.code)}
                    <a href="#" data-i="${i}" style="color:#b91c1c; text-decoration:none;">✕</a>
                </span>`).join('')
            : '<span style="color:#64748b; font-size:13px;">Chưa chọn thành viên nào (có thể thêm sau khi tạo nhóm).</span>';
        box.querySelectorAll('a[data-i]').forEach(a => a.addEventListener('click', e => {
            e.preventDefault();
            selectedMembers.splice(Number(a.dataset.i), 1);
            renderSelectedMembers();
        }));
    }

    async function createGroup() {
        const name = document.getElementById('newGroupName').value.trim();
        if (!name) { await showAlert('Vui lòng nhập tên nhóm!'); return; }
        const { ok, result } = await callAPI('/groups', {
            method: 'POST',
            body: { name, periodId: Number(periodSelect.value), memberStudentIds: selectedMembers.map(m => m.id) }
        });
        if (ok) { await showAlert('Tạo nhóm thành công!'); loadGroup(); }
        else await showAlert(result.message || 'Tạo nhóm thất bại!');
    }

    // ---------- Đã có nhóm ----------
    async function renderGroup(g) {
        const leader = amILeader(g);               // true | false | null
        const canAct = leader !== false;           // null => hiện nút, để backend kiểm tra quyền
        const members = getMembers(g);
        const hasTopic = !!(g.topicId || g.topic);
        const topic = g.topic || {};
        const topicTitle = g.topicTitleVi || topic.titleVi || '';

        const leaderNote = leader === null
            ? '<p style="color:#b45309; font-size:13px; margin:8px 0 0;">Chưa xác định được nhóm trưởng từ dữ liệu trả về; các thao tác dành cho nhóm trưởng vẫn hiển thị và sẽ do máy chủ kiểm tra quyền.</p>' : '';

        const memberRows = members.length ? members.map(m => {
            const isL = memberIsLeader(m, g);
            const removable = canAct && !isL && String(memberId(m)) !== String(me && me.id);
            return `
                <tr style="border-top:1px solid #e2e8f0;">
                    <td style="padding:10px 12px; font-weight:600;">${escapeHtml(memberName(m))}${isL ? ' <span style="color:#2563eb; font-size:12px;">(Nhóm trưởng)</span>' : ''}</td>
                    <td style="padding:10px 12px;">${escapeHtml(memberCode(m) || '-')}</td>
                    <td style="padding:10px 12px;">${escapeHtml(m.studentEmail || '-')}</td>
                    <td style="padding:10px 12px;">${escapeHtml(m.studentClass || '-')}</td>
                    <td style="padding:10px 12px; text-align:right;">
                        ${removable ? `<button type="button" class="btn btn-action-delete btn-sm" data-remove="${memberId(m)}">Xóa</button>` : ''}
                    </td>
                </tr>`;
        }).join('') : '<tr><td colspan="100%" class="text-center py-4">Chưa có dữ liệu</td></tr>';

        area.innerHTML = `
            <div style="${cardStyle()}">
                <div style="display:flex; justify-content:space-between; flex-wrap:wrap; gap:8px;">
                    <div>
                        <h3 style="margin:0; color:#0f172a;">${escapeHtml(g.name)}</h3>
                        <p style="color:#64748b; font-size:14px; margin:4px 0 0;">Mã nhóm: <strong>${escapeHtml(g.code || '-')}</strong> · Đợt: ${escapeHtml(g.periodName || '-')}${g.status ? ' · Trạng thái: <strong>' + escapeHtml(GROUP_STATUS_LABELS[g.status] || g.status) + '</strong>' : ''}</p>
                    </div>
                    <div style="color:#64748b; font-size:14px;">Vai trò của bạn: <strong>${leader === true ? 'Nhóm trưởng' : leader === false ? 'Thành viên' : '-'}</strong></div>
                </div>
                ${leaderNote}
            </div>

            <div style="${cardStyle()}">
                <h3 style="margin:0 0 12px; color:#0f172a;">Thành viên (${members.length || '?'}/${MAX_GROUP_MEMBERS})</h3>
                <div style="overflow-x:auto;">
                    <table style="width:100%; border-collapse:collapse; font-size:14px;">
                        <thead><tr style="background:#f1f5f9; text-align:left; color:#475569;">
                            <th style="padding:10px 12px;">Họ và tên</th><th style="padding:10px 12px;">Mã SV</th>
                            <th style="padding:10px 12px;">Email</th><th style="padding:10px 12px;">Lớp</th><th style="padding:10px 12px;"></th>
                        </tr></thead>
                        <tbody>${memberRows}</tbody>
                    </table>
                </div>
                ${canAct && members.length < MAX_GROUP_MEMBERS ? `
                    <div style="margin-top:16px;">
                        <label style="display:block; color:#64748b; font-size:13px; margin-bottom:4px;">Thêm thành viên</label>
                        ${memberSearchHtml('add')}
                    </div>` : ''}
            </div>

            <div style="${cardStyle()}">
                <h3 style="margin:0 0 12px; color:#0f172a;">Đề tài</h3>
                <div id="topicSection"></div>
            </div>

            <div style="${cardStyle()}">
                <h3 style="margin:0 0 12px; color:#0f172a;">Báo cáo</h3>
                <div id="reportSection"></div>
            </div>`;

        area.querySelectorAll('button[data-remove]').forEach(b =>
            b.addEventListener('click', () => removeMember(Number(b.dataset.remove))));
        bindMemberSearch('add');

        // Đề tài
        const topicBox = document.getElementById('topicSection');
        if (hasTopic) {
            topicBox.innerHTML = `
                <p style="margin:0; font-weight:600; color:#0f172a;">${escapeHtml(topic.code ? topic.code + ' - ' : '')}${escapeHtml(topicTitle || '-')}</p>
                ${topic.primaryAdvisorName ? `<p style="margin:4px 0 0; color:#64748b; font-size:14px;">GVHD: ${escapeHtml(topic.primaryAdvisorName)}${topic.primaryAdvisorEmail ? ' (' + escapeHtml(topic.primaryAdvisorEmail) + ')' : ''}</p>` : ''}
                ${topic.description ? `<p style="margin:8px 0 0; color:#475569; font-size:14px;">${escapeHtml(topic.description)}</p>` : ''}
                ${canAct ? '<div style="margin-top:12px;"><button type="button" class="btn btn-secondary" id="btnCancelTopic">Hủy đăng ký đề tài</button></div>' : ''}`;
            const c = document.getElementById('btnCancelTopic');
            if (c) c.addEventListener('click', cancelTopic);
        } else if (canAct) {
            await renderTopicPicker(topicBox);
            if (currentGroup !== g || !topicBox.isConnected) return;
        } else {
            topicBox.innerHTML = '<p style="color:#64748b; margin:0;">Nhóm chưa đăng ký đề tài. Nhóm trưởng sẽ đăng ký trong giai đoạn đăng ký của sinh viên.</p>';
        }

        // Báo cáo
        const reportBox = document.getElementById('reportSection');
        const reportUrl = g.reportUrl || '';
        const reportNote = g.reportNote || '';
        const current = reportUrl
            ? `<p style="margin:0 0 12px; font-size:14px;">Báo cáo đã nộp: <a href="${escapeHtml(reportUrl)}" target="_blank" rel="noopener">${escapeHtml(reportUrl)}</a>${reportNote ? '<br><span style="color:#64748b;">Ghi chú: ' + escapeHtml(reportNote) + '</span>' : ''}${g.submittedAt ? '<br><span style="color:#64748b;">Nộp lúc: ' + escapeHtml(formatDateTime(g.submittedAt)) + '</span>' : ''}</p>` : '';
        if (!hasTopic) {
            reportBox.innerHTML = '<p style="color:#64748b; margin:0;">Nhóm cần đăng ký đề tài trước khi nộp báo cáo.</p>';
        } else if (canAct) {
            reportBox.innerHTML = `${current}
                <label style="display:block; color:#64748b; font-size:13px; margin-bottom:4px;">Link báo cáo (*)</label>
                <input type="url" id="reportUrl" value="${escapeHtml(reportUrl)}" placeholder="https://drive.google.com/..." style="width:100%; max-width:520px; padding:8px 12px; border:1px solid #cbd5e1; border-radius:8px; box-sizing:border-box;">
                <label style="display:block; color:#64748b; font-size:13px; margin:12px 0 4px;">Ghi chú</label>
                <textarea id="reportNote" rows="3" style="width:100%; max-width:520px; padding:8px 12px; border:1px solid #cbd5e1; border-radius:8px; box-sizing:border-box;">${escapeHtml(reportNote)}</textarea>
                <div style="margin-top:12px;"><button type="button" class="btn btn-primary" id="btnSubmitReport">Nộp báo cáo</button></div>`;
            document.getElementById('btnSubmitReport').addEventListener('click', submitReport);
        } else {
            reportBox.innerHTML = current || '<p style="color:#64748b; margin:0;">Chỉ nhóm trưởng được nộp báo cáo.</p>';
        }
    }

    // ---------- Đăng ký đề tài ----------
    async function renderTopicPicker(box) {
        box.innerHTML = '<span style="color:#64748b;">Đang tải đề tài...</span>';
        const { ok, result } = await callAPI('/topics/published?periodId=' + encodeURIComponent(periodSelect.value), { method: 'GET' });
        if (!box.isConnected) return;
        if (!ok) {
            box.textContent = result.message || 'Không thể tải danh sách đề tài. Vui lòng thử lại.';
            return;
        }
        const topics = ok && Array.isArray(result.data) ? result.data.filter(t => !t.isAssigned) : [];
        if (!topics.length) {
            box.innerHTML = '<p style="color:#64748b; margin:0;">Hiện chưa có đề tài còn trống để đăng ký trong đợt này.</p>';
            return;
        }
        box.innerHTML = `
            <p style="color:#64748b; font-size:14px; margin:0 0 8px;">Nhóm chưa đăng ký đề tài. Chọn một đề tài còn trống:</p>
            <select id="topicPick" style="padding:8px 12px; border:1px solid #cbd5e1; border-radius:8px; min-width:320px; max-width:100%;">
                ${topics.map(t => `<option value="${t.id}">${escapeHtml(t.code)} - ${escapeHtml(t.titleVi)} (${escapeHtml(t.primaryAdvisorName || '')})</option>`).join('')}
            </select>
            <button type="button" class="btn btn-primary" id="btnRegisterTopic" style="margin-left:8px;">Đăng ký đề tài</button>`;
        box.querySelector('#btnRegisterTopic').addEventListener('click', registerTopic);
    }

    async function registerTopic() {
        if (!(await validateGroupSize())) return;
        const topicId = Number(document.getElementById('topicPick').value);
        if (!(await confirmAction('Xác nhận đăng ký đề tài này cho nhóm?'))) return;
        const { ok, result } = await callAPI(`/groups/${currentGroup.id}/register-topic`, { method: 'POST', body: { topicId } });
        if (ok) { await showAlert('Đăng ký đề tài thành công!'); loadGroup(); }
        else await showAlert(result.message || 'Đăng ký đề tài thất bại!');
    }

    async function cancelTopic() {
        if (!(await confirmAction('Bạn chắc chắn muốn hủy đăng ký đề tài?'))) return;
        const { ok, result } = await callAPI(`/groups/${currentGroup.id}/cancel-topic`, { method: 'DELETE' });
        if (ok) { await showAlert('Đã hủy đăng ký đề tài.'); loadGroup(); }
        else await showAlert(result.message || 'Hủy đăng ký thất bại!');
    }

    // ---------- Thành viên ----------
    async function addMemberToGroup(studentId) {
        const { ok, result } = await callAPI(`/groups/${currentGroup.id}/members`, { method: 'POST', body: { studentId } });
        if (ok) { await showAlert('Đã thêm thành viên!'); loadGroup(); }
        else await showAlert(result.message || 'Thêm thành viên thất bại!');
    }

    async function removeMember(studentId) {
        if (!(await confirmAction('Xóa thành viên này khỏi nhóm?'))) return;
        const { ok, result } = await callAPI(`/groups/${currentGroup.id}/members/${studentId}`, { method: 'DELETE' });
        if (ok) { await showAlert('Đã xóa thành viên.'); loadGroup(); }
        else await showAlert(result.message || 'Xóa thành viên thất bại!');
    }

    // ---------- Nộp báo cáo ----------
    async function validateGroupSize() {
        const count = getMembers(currentGroup).length;
        if (count < MIN_GROUP_MEMBERS || count > MAX_GROUP_MEMBERS) {
            await showAlert('Nhóm phải có từ 3 đến 5 sinh viên để đăng ký đề tài hoặc nộp báo cáo!');
            return false;
        }
        return true;
    }

    async function submitReport() {
        if (!(await validateGroupSize())) return;
        const reportUrl = document.getElementById('reportUrl').value.trim();
        const reportNote = document.getElementById('reportNote').value.trim();
        if (!reportUrl) { await showAlert('Vui lòng nhập link báo cáo!'); return; }
        const { ok, result } = await callAPI(`/groups/${currentGroup.id}/reports`, { method: 'POST', body: { reportUrl, reportNote } });
        if (ok) { await showAlert('Nộp báo cáo thành công!'); loadGroup(); }
        else await showAlert(result.message || 'Nộp báo cáo thất bại!');
    }

    document.getElementById('btnReloadGroup').addEventListener('click', loadGroup);
    periodSelect.addEventListener('change', loadGroup);

    loadPeriods().then(has => { if (has) loadGroup(); }).catch(error => {
        console.error('Lỗi tải danh sách đợt:', error);
        showError(error.message || 'Không thể tải danh sách đợt đăng ký.');
    });
});
