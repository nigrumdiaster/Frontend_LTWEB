// Trang kết quả đề tài (sinh viên)
// API: GET /api/results/student/my-results  -> data: FinalResultDto[]
// FinalResultDto: id, periodId, periodName, topicId, topicTitleVi, topic{}, studentGroupId, studentGroupName,
//   studentGroup{}, advisorAvgScore, reviewerScore, councilAvgScore, finalScore, letterGrade, passed,
//   isPublished, publishedAt, chairmanSummary, detailedGrades[]
// GradeDto: graderName, graderRole, score, feedback, gradedAt

const GRADER_ROLE_LABELS = {
    ADVISOR: 'GVHD',
    CO_ADVISOR: 'GVHD phụ',
    COUNCIL_CHAIRMAN: 'Chủ tịch hội đồng',
    COUNCIL_SECRETARY: 'Thư ký hội đồng',
    REVIEWER: 'GVPB',
    COUNCIL_MEMBER: 'Thành viên hội đồng',
    COUNCIL: 'Hội đồng',
    CHAIRMAN: 'Chủ tịch hội đồng',
    CHAIR: 'Chủ tịch hội đồng',
    SECRETARY: 'Thư ký hội đồng',
    MEMBER: 'Thành viên hội đồng'
};

function escapeHtml(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmtScore(v) {
    return (typeof v === 'number' && !isNaN(v)) ? v.toFixed(2) : '-';
}

function fmtDateTime(value) {
    if (!value) return '-';
    const d = new Date(value);
    return isNaN(d) ? escapeHtml(value)
        : d.toLocaleDateString('vi-VN') + ' ' + d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

document.addEventListener('DOMContentLoaded', async () => {
    const area = document.getElementById('resultArea');
    const errorEl = document.getElementById('resultLoadError');
    const periodSelect = document.getElementById('resultPeriodSelect');
    let requestVersion = 0;
    let refreshing = false;

    if (!localStorage.getItem('token')) {
        await showAlert('Bạn chưa đăng nhập!');
        window.location.href = '../index.html';
        return;
    }

    function showError(msg) {
        errorEl.textContent = msg || '';
        errorEl.style.display = msg ? 'block' : 'none';
    }

    const card = 'background:white; border-radius:12px; padding:24px; border:1px solid #e2e8f0; margin-bottom:20px;';

    function scoreBox(label, value, highlight) {
        return `
            <div style="flex:1; min-width:150px; background:${highlight ? '#eff6ff' : '#f8fafc'}; border:1px solid ${highlight ? '#bfdbfe' : '#e2e8f0'}; border-radius:10px; padding:14px;">
                <div style="color:#64748b; font-size:13px;">${label}</div>
                <div style="font-size:24px; font-weight:700; color:${highlight ? '#1d4ed8' : '#0f172a'}; margin-top:4px;">${value}</div>
            </div>`;
    }

    function renderResult(r) {
        const published = r.isPublished ?? r.published;
        const topic = r.topic || {};
        const group = r.studentGroup || {};
        const grades = Array.isArray(r.detailedGrades) ? r.detailedGrades : [];

        const passedHtml = r.passed === true
            ? '<span style="color:#15803d; font-weight:700;">Đạt</span>'
            : r.passed === false ? '<span style="color:#b91c1c; font-weight:700;">Không đạt</span>' : '-';

        const publishBadge = published
            ? `<span style="color:#15803d; font-weight:600;">Đã công bố${r.publishedAt ? ' · ' + fmtDateTime(r.publishedAt) : ''}</span>`
            : '<span style="color:#b45309; font-weight:600;">Chưa công bố</span>';

        const gradeRows = grades.length ? grades.map(g => `
            <tr style="border-top:1px solid #e2e8f0;">
                <td style="padding:10px 12px; font-weight:600;">${escapeHtml(GRADER_ROLE_LABELS[g.graderRole] || g.graderRole || '-')}</td>
                <td style="padding:10px 12px;">${escapeHtml(g.graderName || '-')}</td>
                <td style="padding:10px 12px; text-align:center; font-weight:700;">${fmtScore(g.score)}</td>
                <td style="padding:10px 12px;">${escapeHtml(g.feedback || '-')}</td>
                <td style="padding:10px 12px; white-space:nowrap;">${fmtDateTime(g.gradedAt)}</td>
            </tr>`).join('')
            : '<tr><td colspan="100%" class="text-center py-4">Chưa có dữ liệu</td></tr>';

        return `
            <div style="${card}">
                <div style="display:flex; justify-content:space-between; flex-wrap:wrap; gap:8px;">
                    <div>
                        <h3 style="margin:0; color:#0f172a;">${escapeHtml(topic.code ? topic.code + ' - ' : '')}${escapeHtml(r.topicTitleVi || topic.titleVi || '-')}</h3>
                        <p style="color:#64748b; font-size:14px; margin:4px 0 0;">
                            Đợt: ${escapeHtml(r.periodName || '-')} · Nhóm: ${escapeHtml(r.studentGroupName || group.name || '-')}
                            ${topic.primaryAdvisorName ? ' · GVHD: ' + escapeHtml(topic.primaryAdvisorName) : ''}
                        </p>
                    </div>
                    <div style="font-size:14px;">${publishBadge}</div>
                </div>

                <div style="display:flex; gap:12px; flex-wrap:wrap; margin-top:16px;">
                    ${scoreBox('Điểm GVHD (TB)', fmtScore(r.advisorAvgScore))}
                    ${scoreBox('Điểm GVPB', fmtScore(r.reviewerScore))}
                    ${scoreBox('Điểm hội đồng (TB)', fmtScore(r.councilAvgScore))}
                    ${scoreBox('Điểm tổng kết', fmtScore(r.finalScore), true)}
                    ${scoreBox('Xếp loại', escapeHtml(r.letterGrade || '-'), true)}
                    ${scoreBox('Kết quả', passedHtml)}
                </div>

                ${r.chairmanSummary ? `
                    <div style="margin-top:16px;">
                        <div style="color:#64748b; font-size:13px; margin-bottom:4px;">Nhận xét tổng hợp của Chủ tịch hội đồng</div>
                        <p style="margin:0; color:#0f172a; font-size:15px;">${escapeHtml(r.chairmanSummary)}</p>
                    </div>` : ''}

                <h4 style="margin:20px 0 8px; color:#0f172a;">Điểm thành phần</h4>
                <div style="overflow-x:auto;">
                    <table style="width:100%; border-collapse:collapse; font-size:14px;">
                        <thead><tr style="background:#f1f5f9; text-align:left; color:#475569;">
                            <th style="padding:10px 12px;">Vai trò</th>
                            <th style="padding:10px 12px;">Người chấm</th>
                            <th style="padding:10px 12px; text-align:center;">Điểm</th>
                            <th style="padding:10px 12px;">Nhận xét</th>
                            <th style="padding:10px 12px;">Thời gian chấm</th>
                        </tr></thead>
                        <tbody>${gradeRows}</tbody>
                    </table>
                </div>
            </div>`;
    }

    function renderEmpty(msg) {
        area.innerHTML = `
            <div style="${card}">
                <h3 style="margin:0 0 4px; color:#0f172a;">Chưa có kết quả</h3>
                <p style="color:#64748b; margin:0;">${escapeHtml(msg || 'Đề tài của bạn chưa được chấm điểm hoặc chưa được Khoa công bố kết quả. Vui lòng quay lại sau.')}</p>
            </div>`;
    }

    async function loadResults() {
        const periodId = periodSelect.value;
        const version = ++requestVersion;
        showError('');
        if (!periodId) {
            renderEmpty('Bạn chưa đăng ký đề tài trong đợt nào.');
            return;
        }
        area.innerHTML = `<div style="${card} color:#64748b;">Đang tải...</div>`;
        try {
            const response = await apiFetchTable('/results/student/my-results?periodId=' + encodeURIComponent(periodId), {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            }, 'resultArea', loadResults);
            const result = await response.json();
            if (version !== requestVersion) return;

            if (response.status === 403) {
                area.innerHTML = '';
                showError('Bạn không có quyền xem kết quả, hoặc phiên đăng nhập không hợp lệ (403).');
                return;
            }
            if (response.status === 404) {
                renderEmpty(result && result.message);
                return;
            }
            if (!response.ok || !result || result.success === false) {
                throw new Error((result && result.message) || 'Không thể tải kết quả.');
            }

            const list = Array.isArray(result.data) ? result.data : (result.data ? [result.data] : []);
            if (!list.length) { renderEmpty(); return; }
            area.innerHTML = list.map(renderResult).join('');
        } catch (error) {
            if (version !== requestVersion) return;
            console.error('Lỗi tải kết quả:', error);
            area.innerHTML = '';
            showError(error.message || 'Lỗi kết nối máy chủ!');
        }
    }

    async function refreshPeriodsAndResults() {
        if (refreshing) return;
        refreshing = true;
        document.getElementById('btnReloadResults').disabled = true;
        ++requestVersion;
        periodSelect.disabled = true;
        showError('');
        try {
            const response = await apiFetchAll('/results/student/periods', { method: 'GET' });
            const result = await response.json();
            if (!response.ok || result.success === false) {
                throw new Error(result.message || 'Không thể tải các đợt đã đăng ký.');
            }
            const periods = Array.isArray(result.data) ? result.data : [];
            const previous = periodSelect.value;
            periodSelect.replaceChildren(...periods.map(period => new Option(period.name, String(period.id))));
            if (!periods.length) {
                periodSelect.replaceChildren(new Option('Chưa đăng ký đề tài trong đợt nào', ''));
            } else {
                periodSelect.disabled = false;
                periodSelect.value = periods.some(p => String(p.id) === previous) ? previous : String(periods[0].id);
            }
            await loadResults();
        } catch (error) {
            periodSelect.replaceChildren(new Option('Không tải được đợt đăng ký', ''));
            area.innerHTML = '';
            showError(error.message || 'Không thể tải các đợt đã đăng ký.');
        } finally {
            refreshing = false;
            document.getElementById('btnReloadResults').disabled = false;
        }
    }

    periodSelect.addEventListener('change', loadResults);
    document.getElementById('btnReloadResults').addEventListener('click', refreshPeriodsAndResults);
    await refreshPeriodsAndResults();
});
