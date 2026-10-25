// Tiện ích dùng chung cho cổng giảng viên (nạp sau config.js và auth.js)

(async function guard() {
    const token = localStorage.getItem('token');
    if (!token) {
        await showAlert('Bạn chưa đăng nhập!');
        window.location.href = '../index.html';
        return;
    }
    let user = null;
    try { user = JSON.parse(localStorage.getItem('user')); } catch (e) { /* bỏ qua */ }
    if (user && user.role === 'ROLE_STUDENT') {
        window.location.href = '../student/profile.html';
    }
})();

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

function getMe() {
    try { return JSON.parse(localStorage.getItem('user')); } catch (e) { return null; }
}

// Gọi API, không ném lỗi khi server trả 4xx: { ok, status, result }
async function callAPI(path, options = {}) {
    const opts = { ...options };
    if (opts.body && typeof opts.body !== 'string') {
        opts.headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
        opts.body = JSON.stringify(opts.body);
    }
    try {
        const pagination = opts.pagination;
        delete opts.pagination;
        const response = pagination
            ? await apiFetchTable(path, opts, pagination.target, pagination.reload)
            : await apiFetchAll(path, opts);
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

const APPROVAL_LABELS = {
    PENDING: ['Chờ duyệt', '#b45309'],
    APPROVED: ['Đã duyệt', '#15803d'],
    REJECTED: ['Bị từ chối', '#b91c1c']
};

function approvalBadge(status) {
    const [label, color] = APPROVAL_LABELS[status] || [status || '-', '#475569'];
    return `<span style="color:${color}; font-weight:600;">${escapeHtml(label)}</span>`;
}

// ===================== Tiện ích bổ sung (chấm điểm / hội đồng) =====================
function fmtScore(v) {
    return (typeof v === 'number' && !isNaN(v)) ? v.toFixed(2) : '-';
}

function fmtDate(value) {
    if (!value) return '-';
    const s = String(value);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) { const [y, m, d] = s.split('-'); return `${d}/${m}/${y}`; }
    const d = new Date(s);
    return isNaN(d) ? escapeHtml(s) : d.toLocaleDateString('vi-VN');
}

function fmtAnyDate(value) {
    if (!value) return '-';
    const s = String(value);
    if (/^\d{2}:\d{2}/.test(s)) return escapeHtml(s.slice(0, 5));
    return s.includes('T') ? fmtDateTime(s) : fmtDate(s);
}

function isMyTopic(t) {
    const me = getMe();
    if (!me) return false;
    return String(t.primaryAdvisorId) === String(me.id) || String(t.coAdvisorId) === String(me.id);
}

function isChairman(role) { return /CHAIR/i.test(String(role || '')); }
function councilRoleLabel(role) {
    if (isChairman(role)) return 'Chủ tịch';
    if (/SECRET/i.test(String(role || ''))) return 'Thư ký';
    return role ? 'Thành viên' : '-';
}

const GRADER_ROLE_LABELS = {
    ADVISOR: 'GVHD', REVIEWER: 'GVPB', COUNCIL_MEMBER: 'Thành viên hội đồng', COUNCIL: 'Hội đồng',
    CHAIRMAN: 'Chủ tịch hội đồng', CHAIR: 'Chủ tịch hội đồng', SECRETARY: 'Thư ký hội đồng', MEMBER: 'Thành viên hội đồng'
};

// ---------- Modal động ----------
function ensureDynModal() {
    let m = document.getElementById('dynModal');
    if (m) return m;
    m = document.createElement('div');
    m.id = 'dynModal';
    m.className = 'modal';
    m.innerHTML = `
        <div class="modal-content" style="max-width:700px; max-height:90vh; overflow-y:auto;">
            <div class="modal-header"><h3 id="dynModalTitle"></h3></div>
            <div id="dynModalSub" style="color:#64748b; font-size:14px; margin-top:8px;"></div>
            <form id="dynModalForm">
                <div id="dynModalFields" style="display:grid; gap:14px; margin:16px 0;"></div>
                <div style="display:flex; gap:8px; justify-content:flex-end;">
                    <button type="button" class="btn btn-secondary" onclick="closeDynModal()">Hủy</button>
                    <button type="submit" class="btn btn-primary" id="dynModalSubmit">Xác nhận</button>
                </div>
            </form>
            <div id="dynModalInfo"></div>
            <div id="dynModalInfoFooter" style="display:none; justify-content:flex-end; margin-top:16px;">
                <button type="button" class="btn btn-secondary" onclick="closeDynModal()">Đóng</button>
            </div>
        </div>`;
    document.body.appendChild(m);
    return m;
}

function closeDynModal() {
    const m = document.getElementById('dynModal');
    if (m) m.style.display = 'none';
}

// cfg: { title, sub, submitText, fields:[{name,label,type,required,value,min,max,step,options}], onSubmit(values) -> true nếu thành công }
function openPromptModal(cfg) {
    const m = ensureDynModal();
    m.querySelector('#dynModalTitle').textContent = cfg.title || '';
    m.querySelector('#dynModalSub').innerHTML = cfg.sub || '';
    m.querySelector('#dynModalInfo').innerHTML = '';
    m.querySelector('#dynModalInfoFooter').style.display = 'none';
    const form = m.querySelector('#dynModalForm');
    form.style.display = 'block';

    const style = 'width:100%; padding:8px 12px; border:1px solid #cbd5e1; border-radius:8px; box-sizing:border-box;';
    m.querySelector('#dynModalFields').innerHTML = cfg.fields.map(f => {
        const id = 'dyn_' + f.name;
        const req = f.required ? 'required' : '';
        let control;
        if (f.type === 'textarea') {
            control = `<textarea id="${id}" rows="4" ${req} style="${style}">${escapeHtml(f.value ?? '')}</textarea>`;
        } else if (f.type === 'select') {
            control = `<select id="${id}" ${req} style="${style}">${(f.options || []).map(o =>
                `<option value="${escapeHtml(o.value)}" ${String(o.value) === String(f.value ?? '') ? 'selected' : ''}>${escapeHtml(o.label)}</option>`).join('')}</select>`;
        } else {
            control = `<input type="${f.type || 'text'}" id="${id}" ${req} value="${escapeHtml(f.value ?? '')}"
                ${f.min !== undefined ? `min="${f.min}"` : ''} ${f.max !== undefined ? `max="${f.max}"` : ''} ${f.step !== undefined ? `step="${f.step}"` : ''} style="${style}">`;
        }
        return `<div><label for="${id}" style="display:block; color:#64748b; font-size:13px; margin-bottom:4px;">${escapeHtml(f.label)}${f.required ? ' (*)' : ''}</label>${control}</div>`;
    }).join('');
    m.querySelector('#dynModalSubmit').textContent = cfg.submitText || 'Xác nhận';

    form.onsubmit = async (e) => {
        e.preventDefault();
        const values = {};
        cfg.fields.forEach(f => {
            const el = document.getElementById('dyn_' + f.name);
            let v = typeof el.value === 'string' ? el.value.trim() : el.value;
            if (f.type === 'number') v = v === '' ? null : Number(v);
            values[f.name] = v;
        });
        const ok = await cfg.onSubmit(values);
        if (ok) closeDynModal();
    };
    m.style.display = 'flex';
}

function openInfoModal(title, html) {
    const m = ensureDynModal();
    m.querySelector('#dynModalTitle').textContent = title || '';
    m.querySelector('#dynModalSub').innerHTML = '';
    m.querySelector('#dynModalForm').style.display = 'none';
    m.querySelector('#dynModalInfo').innerHTML = html;
    m.querySelector('#dynModalInfoFooter').style.display = 'flex';
    m.style.display = 'flex';
}

// Xem kết quả tổng hợp của một đề tài: GET /api/results/topic/{id}
async function showTopicResult(topicId) {
    const { ok, status, result } = await callAPI('/results/topic/' + topicId, { method: 'GET' });
    if (!ok || !result.data) {
        await showAlert(status === 404 ? (result.message || 'Chưa có kết quả tổng hợp cho đề tài này.') : (result.message || 'Không thể tải kết quả.'));
        return;
    }
    const r = result.data;
    const grades = Array.isArray(r.detailedGrades) ? r.detailedGrades : [];
    const box = (label, value) => `<div style="flex:1; min-width:130px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:10px 12px;">
        <div style="color:#64748b; font-size:12px;">${label}</div><div style="font-size:20px; font-weight:700; color:#0f172a;">${value}</div></div>`;
    const passed = r.passed === true ? 'Đạt' : r.passed === false ? 'Không đạt' : '-';
    openInfoModal('Kết quả: ' + (r.topicTitleVi || ''), `
        <div style="display:flex; gap:10px; flex-wrap:wrap; margin:12px 0;">
            ${box('GVHD (TB)', fmtScore(r.advisorAvgScore))}${box('GVPB', fmtScore(r.reviewerScore))}${box('Hội đồng (TB)', fmtScore(r.councilAvgScore))}
            ${box('Tổng kết', fmtScore(r.finalScore))}${box('Xếp loại', escapeHtml(r.letterGrade || '-'))}${box('Kết quả', passed)}
        </div>
        <p style="color:#64748b; font-size:13px; margin:0 0 8px;">${(r.isPublished ?? r.published) ? 'Đã công bố' : 'Chưa công bố'}${r.publishedAt ? ' · ' + escapeHtml(fmtDateTime(r.publishedAt)) : ''}</p>
        ${r.chairmanSummary ? `<p style="margin:0 0 12px;"><strong>Nhận xét Chủ tịch:</strong> ${escapeHtml(r.chairmanSummary)}</p>` : ''}
        <table style="width:100%; border-collapse:collapse; font-size:14px;">
            <thead><tr style="background:#f1f5f9; text-align:left; color:#475569;"><th style="padding:8px;">Vai trò</th><th style="padding:8px;">Người chấm</th><th style="padding:8px;">Điểm</th><th style="padding:8px;">Nhận xét</th></tr></thead>
            <tbody>${grades.length ? grades.map(g => `<tr style="border-top:1px solid #e2e8f0;"><td style="padding:8px;">${escapeHtml(GRADER_ROLE_LABELS[g.graderRole] || g.graderRole || '-')}</td><td style="padding:8px;">${escapeHtml(g.graderName || '-')}</td><td style="padding:8px; font-weight:700;">${fmtScore(g.score)}</td><td style="padding:8px;">${escapeHtml(g.feedback || '-')}</td></tr>`).join('')
                : '<tr><td colspan="100%" class="text-center py-4">Chưa có dữ liệu</td></tr>'}</tbody>
        </table>`);
}