// Hội đồng bảo vệ
// API: GET /api/councils/period/{periodId}  -> DefenseCouncilDto[] (members[], assignedTopics[])
//      POST /api/councils/{id}/grade        -> CouncilGradingRequest { topicId*, score*, feedback }
//      POST /api/results/finalize           -> FinalizeCouncilResultRequest { topicId*, chairmanSummary }  (Chủ tịch)
//      GET /api/results/topic/{id}          -> xem kết quả tổng hợp

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btnResetFilters').addEventListener('click', () => {
        document.getElementById('councilPeriod').value = '';
        document.getElementById('onlyMyCouncils').checked = true;
        loadCouncils();
    });

    const periodSelect = document.getElementById('councilPeriod');
    const onlyMine = document.getElementById('onlyMyCouncils');
    const area = document.getElementById('councilsArea');
    const errorEl = document.getElementById('councilsLoadError');
    const card = 'background:white; border-radius:12px; padding:20px 24px; border:1px solid #e2e8f0; margin-bottom:16px;';
    const me = getMe();
    let councils = [];

    function showError(msg) {
        errorEl.textContent = msg || '';
        errorEl.style.display = msg ? 'block' : 'none';
    }

    function myMembership(c) {
        return (c.members || []).find(m => me && String(m.lecturerId) === String(me.id));
    }

    function render() {
        const list = councils.filter(c => !onlyMine.checked || myMembership(c));
        if (!list.length) {
            area.innerHTML = `<div style="${card} color:#64748b;">${councils.length ? 'Bạn không thuộc hội đồng nào trong đợt này.' : 'Đợt này chưa có hội đồng nào.'}</div>`;
            return;
        }

        area.innerHTML = list.map(c => {
            const mem = myMembership(c);
            const amChair = mem && isChairman(mem.councilRole);
            const members = (c.members || []).map(m => `
                <tr style="border-top:1px solid #f1f5f9;">
                    <td style="padding:8px 12px; font-weight:600;">${escapeHtml(m.lecturerName)}${me && String(m.lecturerId) === String(me.id) ? ' <span style="color:#2563eb; font-size:12px;">(Bạn)</span>' : ''}</td>
                    <td style="padding:8px 12px;">${escapeHtml(m.lecturerCode || '-')}</td>
                    <td style="padding:8px 12px;">${escapeHtml(m.lecturerEmail || '-')}</td>
                    <td style="padding:8px 12px;">${escapeHtml(councilRoleLabel(m.councilRole))}</td>
                </tr>`).join('');

            const topics = (c.assignedTopics || []).map(a => {
                const ownTopic = me && (String(a.primaryAdvisorId) === String(me.id) || String(a.coAdvisorId) === String(me.id));
                const actions = [];
                if (mem && !ownTopic) actions.push(`<button type="button" class="btn btn-primary btn-sm" onclick="gradeCouncil(${c.id}, ${a.topicId})">Chấm điểm</button>`);
                if (amChair && !ownTopic) actions.push(`<button type="button" class="btn btn-secondary btn-sm" onclick="finalizeTopic(${c.id}, ${a.topicId})">Chốt kết quả</button>`);
                actions.push(`<button type="button" class="btn btn-secondary btn-sm" onclick="showTopicResult(${a.topicId})">Kết quả</button>`);
                return `
                <tr style="border-top:1px solid #f1f5f9;">
                    <td style="padding:8px 12px; font-weight:600;">${escapeHtml(a.topicCode || '')}</td>
                    <td style="padding:8px 12px; min-width:220px;">${escapeHtml(a.topicTitleVi || '')}${ownTopic ? '<br><small style="color:#b45309;">Đề tài bạn hướng dẫn (không được chấm)</small>' : ''}</td>
                    <td style="padding:8px 12px;">${escapeHtml(a.primaryAdvisorName || '-')}${a.coAdvisorName ? '<br><small style="color:#64748b;">+ ' + escapeHtml(a.coAdvisorName) + '</small>' : ''}</td>
                    <td style="padding:8px 12px;">${escapeHtml(a.studentGroupName || '-')}</td>
                    <td style="padding:8px 12px;">${escapeHtml(fmtAnyDate(a.defenseTime))}</td>
                    <td style="padding:8px 12px; white-space:nowrap;">${actions.join(' ')}</td>
                </tr>`;
            }).join('');

            return `
            <div style="${card}">
                <div style="display:flex; justify-content:space-between; flex-wrap:wrap; gap:8px;">
                    <div>
                        <h3 style="margin:0; color:#0f172a;">${escapeHtml(c.name)}</h3>
                        <p style="color:#64748b; font-size:14px; margin:4px 0 0;">Mã: <strong>${escapeHtml(c.code || '-')}</strong> · Đợt: ${escapeHtml(c.periodName || '-')}</p>
                        <p style="color:#64748b; font-size:14px; margin:4px 0 0;">Ngày bảo vệ: <strong>${escapeHtml(fmtAnyDate(c.defenseDate))}</strong> · Địa điểm: <strong>${escapeHtml(c.location || '-')}</strong></p>
                        ${c.notes ? `<p style="color:#64748b; font-size:14px; margin:4px 0 0;">Ghi chú: ${escapeHtml(c.notes)}</p>` : ''}
                    </div>
                    <div style="font-size:14px; color:#64748b;">${mem ? 'Vai trò của bạn: <strong>' + escapeHtml(councilRoleLabel(mem.councilRole)) + '</strong>' : 'Bạn không thuộc hội đồng này'}</div>
                </div>

                <h4 style="margin:16px 0 8px; color:#0f172a;">Thành viên hội đồng (${(c.members || []).length})</h4>
                <div style="overflow-x:auto;"><table style="width:100%; border-collapse:collapse; font-size:14px;">
                    <thead><tr style="background:#f1f5f9; text-align:left; color:#475569;"><th style="padding:8px 12px;">Họ và tên</th><th style="padding:8px 12px;">Mã GV</th><th style="padding:8px 12px;">Email</th><th style="padding:8px 12px;">Vai trò</th></tr></thead>
                    <tbody>${members || '<tr><td colspan="100%" class="text-center py-4">Chưa có dữ liệu</td></tr>'}</tbody>
                </table></div>

                <h4 style="margin:16px 0 8px; color:#0f172a;">Đề tài được phân công (${(c.assignedTopics || []).length})</h4>
                <div style="overflow-x:auto;"><table style="width:100%; border-collapse:collapse; font-size:14px;">
                    <thead><tr style="background:#f1f5f9; text-align:left; color:#475569;"><th style="padding:8px 12px;">Mã</th><th style="padding:8px 12px;">Đề tài</th><th style="padding:8px 12px;">GVHD</th><th style="padding:8px 12px;">Nhóm</th><th style="padding:8px 12px;">Giờ bảo vệ</th><th style="padding:8px 12px;"></th></tr></thead>
                    <tbody>${topics || '<tr><td colspan="100%" class="text-center py-4">Chưa có dữ liệu</td></tr>'}</tbody>
                </table></div>
            </div>`;
        }).join('');
    }

    function findTopic(councilId, topicId) {
        const c = councils.find(x => x.id === councilId);
        return c && (c.assignedTopics || []).find(a => a.topicId === topicId);
    }

    window.gradeCouncil = function (councilId, topicId) {
        const a = findTopic(councilId, topicId);
        if (!a) return;
        openPromptModal({
            title: 'Chấm điểm hội đồng',
            sub: `<strong>${escapeHtml(a.topicCode || '')} - ${escapeHtml(a.topicTitleVi || '')}</strong><br>Nhóm: ${escapeHtml(a.studentGroupName || '-')}`,
            submitText: 'Lưu điểm',
            fields: [
                { name: 'score', label: 'Điểm (thang 10)', type: 'number', required: true, min: 0, max: 10, step: 0.1 },
                { name: 'feedback', label: 'Nhận xét', type: 'textarea' }
            ],
            onSubmit: async (v) => {
                const body = { topicId, score: v.score };
                if (v.feedback) body.feedback = v.feedback;
                const { ok, result } = await callAPI(`/councils/${councilId}/grade`, { method: 'POST', body });
                if (ok) { await showAlert('Đã lưu điểm hội đồng.'); return true; }
                await showAlert(result.message || 'Không thể lưu điểm!');
                return false;
            }
        });
    };

    window.finalizeTopic = function (councilId, topicId) {
        const a = findTopic(councilId, topicId);
        if (!a) return;
        openPromptModal({
            title: 'Chốt kết quả phản biện (Chủ tịch hội đồng)',
            sub: `<strong>${escapeHtml(a.topicCode || '')} - ${escapeHtml(a.topicTitleVi || '')}</strong><br>Hệ thống tổng hợp điểm các thành phần thành điểm cuối cùng.`,
            submitText: 'Chốt kết quả',
            fields: [{ name: 'chairmanSummary', label: 'Nhận xét tổng hợp của Chủ tịch', type: 'textarea' }],
            onSubmit: async (v) => {
                if (!(await confirmAction('Chốt kết quả cho đề tài này?'))) return false;
                const body = { topicId };
                if (v.chairmanSummary) body.chairmanSummary = v.chairmanSummary;
                const { ok, result } = await callAPI('/results/finalize', { method: 'POST', body });
                if (ok) { await showAlert('Đã chốt kết quả đề tài.'); return true; }
                await showAlert(result.message || 'Không thể chốt kết quả!');
                return false;
            }
        });
    };

    async function loadCouncils() {
        showError('');
        const periodId = periodSelect.value;
        if (!periodId) {
            councils = [];
            area.textContent = 'Vui lòng chọn đợt đăng ký.';
            return;
        }
        area.innerHTML = `<div style="${card} color:#64748b;">Đang tải...</div>`;
        const { ok, result } = await callAPI('/councils/period/' + encodeURIComponent(periodId), { method: 'GET' });
        if (ok) {
            councils = Array.isArray(result.data) ? result.data : [];
            render();
        } else {
            councils = [];
            area.innerHTML = '';
            showError(result.message || 'Không thể tải danh sách hội đồng.');
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
        area.innerHTML = `<div style="${card} color:#64748b;">Vui lòng chọn đợt đăng ký để xem danh sách hội đồng.</div>`;
        return true;
    }

    document.getElementById('btnReloadCouncils').addEventListener('click', loadCouncils);
    periodSelect.addEventListener('change', loadCouncils);
    onlyMine.addEventListener('change', render);
    loadPeriods().catch(error => {
        console.error('Lỗi tải danh sách đợt:', error);
        showError(error.message || 'Không thể tải danh sách đợt đăng ký.');
    });
});