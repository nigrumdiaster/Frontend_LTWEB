// Phản biện (GVPB)
// API: GET /api/reviewers/my-tasks    -> ReviewerAssignmentDto[] (đề tài được phân công phản biện)
//      POST /api/reviewers/grade      -> ReviewerGradeRequest { topicId*, score*, feedback }
//      GET /api/registration-periods  -> lấy hạn nộp điểm GVPB (reviewerDeadline)

document.addEventListener('DOMContentLoaded', () => {
    const area = document.getElementById('reviewsArea');
    const errorEl = document.getElementById('reviewsLoadError');
    const card = 'background:white; border-radius:12px; padding:20px 24px; border:1px solid #e2e8f0; margin-bottom:16px;';
    let tasks = [];
    let periodsById = {};

    function showError(msg) {
        errorEl.textContent = msg || '';
        errorEl.style.display = msg ? 'block' : 'none';
    }

    function render() {
        if (!tasks.length) {
            area.innerHTML = `<div style="${card} color:#64748b;">Bạn chưa được phân công phản biện đề tài nào.</div>`;
            return;
        }
        area.innerHTML = tasks.map(a => {
            const submitted = !!a.submittedAt || (a.score !== null && a.score !== undefined);
            const period = periodsById[a.periodId] || {};
            return `
            <div style="${card}">
                <div style="display:flex; justify-content:space-between; flex-wrap:wrap; gap:8px;">
                    <div>
                        <h3 style="margin:0; color:#0f172a; font-size:17px;">${escapeHtml(a.topicCode || '')} - ${escapeHtml(a.topicTitleVi || '')}</h3>
                        <p style="color:#64748b; font-size:14px; margin:4px 0 0;">
                            Nhóm: <strong>${escapeHtml(a.studentGroupName || '-')}</strong> · Đợt: ${escapeHtml(a.periodName || period.name || '-')}
                            · Được phân công: ${escapeHtml(fmtDateTime(a.assignedAt))}
                        </p>
                        ${period.reviewerDeadline ? `<p style="color:#b45309; font-size:14px; margin:4px 0 0;">Hạn nộp điểm: <strong>${escapeHtml(fmtDate(period.reviewerDeadline))}</strong></p>` : ''}
                    </div>
                    <div style="font-size:14px; text-align:right;">
                        ${submitted
                            ? `<span style="color:#15803d; font-weight:700;">Đã nộp: ${fmtScore(a.score)}</span><br><small style="color:#64748b;">${escapeHtml(fmtDateTime(a.submittedAt))}</small>`
                            : '<span style="color:#b45309; font-weight:600;">Chưa nộp điểm</span>'}
                    </div>
                </div>
                ${a.feedback ? `<p style="margin:10px 0 0; color:#475569; font-size:14px;">Nhận xét: ${escapeHtml(a.feedback)}</p>` : ''}
                <div style="margin-top:12px;">
                    <button type="button" class="btn btn-primary btn-sm" onclick="gradeReview(${a.topicId})">${submitted ? 'Cập nhật điểm' : 'Nhập điểm phản biện'}</button>
                </div>
            </div>`;
        }).join('');
    }

    window.gradeReview = function (topicId) {
        const a = tasks.find(x => x.topicId === topicId);
        if (!a) return;
        openPromptModal({
            title: 'Nhập điểm phản biện (GVPB)',
            sub: `<strong>${escapeHtml(a.topicCode || '')} - ${escapeHtml(a.topicTitleVi || '')}</strong><br>Nhóm: ${escapeHtml(a.studentGroupName || '-')}`,
            submitText: 'Nộp điểm',
            fields: [
                { name: 'score', label: 'Điểm (thang 10)', type: 'number', required: true, min: 0, max: 10, step: 0.1, value: a.score ?? '' },
                { name: 'feedback', label: 'Nhận xét phản biện', type: 'textarea', value: a.feedback || '' }
            ],
            onSubmit: async (v) => {
                const body = { topicId, score: v.score };
                if (v.feedback) body.feedback = v.feedback;
                const { ok, result } = await callAPI('/reviewers/grade', { method: 'POST', body });
                if (ok) { await showAlert('Đã nộp điểm phản biện.'); load(); return true; }
                await showAlert(result.message || 'Không thể nộp điểm!');
                return false;
            }
        });
    };

    async function load() {
        showError('');
        area.innerHTML = `<div style="${card} color:#64748b;">Đang tải...</div>`;
        const [pRes, tRes] = await Promise.all([
            callAPI('/registration-periods', { method: 'GET' }),
            callAPI('/reviewers/my-tasks', { method: 'GET' })
        ]);
        periodsById = {};
        if (pRes.ok && Array.isArray(pRes.result.data)) pRes.result.data.forEach(p => { periodsById[p.id] = p; });

        if (!tRes.ok) {
            tasks = [];
            area.innerHTML = '';
            showError(tRes.result.message || 'Không thể tải danh sách phân công.');
            return;
        }
        const d = tRes.result.data;
        tasks = Array.isArray(d) ? d : (d ? [d] : []);
        render();
    }

    document.getElementById('btnReloadReviews').addEventListener('click', load);
    load();
});