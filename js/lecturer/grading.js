// Chấm điểm hướng dẫn (GVHD)
// API: GET /api/topics                 -> lọc đề tài mình hướng dẫn đã có nhóm nhận
//      GET /api/grades/topic/{id}      -> điểm đã chấm (để hiện điểm của mình)
//      POST /api/grades/advisor        -> AdvisorGradeRequest { topicId*, score*, feedback }

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btnResetFilters').addEventListener('click', () => {
        document.getElementById('gradingSearch').value = '';
        render();
    });

    const area = document.getElementById('gradingArea');
    const searchInput = document.getElementById('gradingSearch');
    const errorEl = document.getElementById('gradingLoadError');
    const card = 'background:white; border-radius:12px; padding:20px 24px; border:1px solid #e2e8f0; margin-bottom:16px;';
    let items = [];

    function showError(msg) {
        errorEl.textContent = msg || '';
        errorEl.style.display = msg ? 'block' : 'none';
    }

    function render() {
        const list = items;

        if (!list.length) {
            area.innerHTML = `<div style="${card} color:#64748b;">Chưa có đề tài nào cần chấm. Đề tài chỉ hiện ở đây khi đã có nhóm sinh viên nhận.</div>`;
            return;
        }

        area.innerHTML = list.map(({ topic: t, mine, canView }) => `
            <div style="${card}">
                <div style="display:flex; justify-content:space-between; flex-wrap:wrap; gap:8px;">
                    <div>
                        <h3 style="margin:0; color:#0f172a; font-size:17px;">${escapeHtml(t.code)} - ${escapeHtml(t.titleVi)}</h3>
                        <p style="color:#64748b; font-size:14px; margin:4px 0 0;">Nhóm: <strong>${escapeHtml(t.assignedGroupName || '-')}</strong> · Đợt: ${escapeHtml(t.periodName || '-')}</p>
                    </div>
                    <div style="font-size:14px; text-align:right;">
                        ${mine
                            ? `<span style="color:#15803d; font-weight:700;">Đã chấm: ${fmtScore(mine.score)}</span><br><small style="color:#64748b;">${escapeHtml(fmtDateTime(mine.gradedAt))}</small>`
                            : canView ? '<span style="color:#b45309; font-weight:600;">Chưa chấm</span>'
                                      : '<span style="color:#64748b;">Không xem được điểm đã chấm</span>'}
                    </div>
                </div>
                ${mine && mine.feedback ? `<p style="margin:10px 0 0; color:#475569; font-size:14px;">Nhận xét: ${escapeHtml(mine.feedback)}</p>` : ''}
                <div style="margin-top:12px;">
                    <button type="button" class="btn btn-primary btn-sm" onclick="gradeAdvisor(${t.id})">${mine ? 'Sửa điểm' : 'Chấm điểm'}</button>
                    <button type="button" class="btn btn-secondary btn-sm" onclick="showTopicResult(${t.id})">Xem kết quả tổng hợp</button>
                </div>
            </div>`).join('');
    }

    window.gradeAdvisor = function (topicId) {
        const it = items.find(x => x.topic.id === topicId);
        if (!it) return;
        const t = it.topic, mine = it.mine;
        openPromptModal({
            title: 'Chấm điểm GVHD',
            sub: `<strong>${escapeHtml(t.code)} - ${escapeHtml(t.titleVi)}</strong><br>Nhóm: ${escapeHtml(t.assignedGroupName || '-')}`,
            submitText: 'Lưu điểm',
            fields: [
                { name: 'score', label: 'Điểm (thang 10)', type: 'number', required: true, min: 0, max: 10, step: 0.1, value: mine ? mine.score : '' },
                { name: 'feedback', label: 'Nhận xét quá trình thực hiện', type: 'textarea', value: mine ? (mine.feedback || '') : '' }
            ],
            onSubmit: async (v) => {
                const body = { topicId, score: v.score };
                if (v.feedback) body.feedback = v.feedback;
                const { ok, result } = await callAPI('/grades/advisor', { method: 'POST', body });
                if (ok) { await showAlert('Đã lưu điểm hướng dẫn.'); load(); return true; }
                await showAlert(result.message || 'Không thể lưu điểm!');
                return false;
            }
        });
    };

    async function load() {
        showError('');
        area.innerHTML = `<div style="${card} color:#64748b;">Đang tải...</div>`;
        const me = getMe();
        const { ok, result } = await callAPI('/topics?isAssigned=true&advisorId=' + encodeURIComponent(me.id) + '&keyword=' + encodeURIComponent(searchInput.value.trim()), { method: 'GET', pagination: { target: 'gradingArea', reload: load } });
        if (!ok) { area.innerHTML = ''; showError(result.message || 'Không thể tải danh sách đề tài.'); return; }

        const topics = (Array.isArray(result.data) ? result.data : []);
        items = await Promise.all(topics.map(async t => {
            const g = await callAPI('/grades/topic/' + t.id, { method: 'GET' });
            const list = g.ok && Array.isArray(g.result.data) ? g.result.data : [];
            const mine = list.find(x => me && String(x.graderId) === String(me.id) && /ADVISOR/i.test(x.graderRole || ''));
            return { topic: t, mine, canView: g.ok };
        }));
        render();
    }

    document.getElementById('btnReloadGrading').addEventListener('click', load);
    searchInput.addEventListener('input', debounce(load));
    load();
});