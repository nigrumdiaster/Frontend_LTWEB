// Presentation helpers shared by the student period and topic catalogues.
const StudentDiscovery = (() => {
    const types = { COURSE_PROJECT: 'Đồ án môn học', SCIENTIFIC_RESEARCH: 'Nghiên cứu khoa học', SPECIALIZED_PROJECT: 'Đồ án chuyên ngành', GRADUATION_THESIS: 'Khóa luận tốt nghiệp' };
    const statuses = { DRAFT: 'Nháp', PHASE1_LECTURER_REGISTRATION: 'Giảng viên đề xuất', PHASE1_REVIEWING: 'Duyệt đề tài', PHASE2_STUDENT_REGISTRATION: 'Sinh viên đăng ký', IN_PROGRESS: 'Đang thực hiện', REVIEWING: 'Đang phản biện', DEFENSE: 'Bảo vệ', COMPLETED: 'Hoàn thành', CANCELLED: 'Đã hủy' };
    const date = value => {
        if (!value) return 'Chưa cập nhật';
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? 'Chưa cập nhật' : parsed.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) + (String(value).includes('T') ? ' · ' + parsed.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '');
    };
    function registration(period, now = Date.now()) {
        if (!period) return { label: 'Chọn đợt để xem lịch đăng ký', tone: 'neutral', open: false };
        if (period.status === 'CANCELLED') return { label: 'Đợt đã hủy', tone: 'closed', open: false };
        if (['IN_PROGRESS', 'REVIEWING', 'DEFENSE', 'COMPLETED'].includes(period.status)) return { label: 'Đã đóng đăng ký', tone: 'neutral', open: false };
        const start = Date.parse(period.studentRegStart), end = Date.parse(period.studentRegEnd);
        if (Number.isFinite(end) && now > end) return { label: 'Đã hết hạn đăng ký', tone: 'neutral', open: false };
        if (Number.isFinite(start) && now < start) return { label: 'Sắp mở đăng ký', tone: 'upcoming', open: false };
        if (period.status === 'PHASE2_STUDENT_REGISTRATION' && Number.isFinite(start) && Number.isFinite(end) && start <= end) return { label: 'Đang mở đăng ký', tone: 'open', open: true };
        return { label: period.status === 'PHASE2_STUDENT_REGISTRATION' ? 'Chưa có lịch đầy đủ' : 'Chưa mở cho sinh viên', tone: 'upcoming', open: false };
    }
    function badge(period) {
        const state = registration(period);
        return `<span class="catalogue-badge ${state.tone}"><span aria-hidden="true">●</span> ${escapeText(state.label)}</span>`;
    }
    function progress(period) {
        if (period.status === 'CANCELLED') return '<p class="catalogue-muted">Đợt này đã hủy.</p>';
        const steps = ['Đề xuất', 'Duyệt đề tài', 'SV đăng ký', 'Thực hiện', period.type === 'GRADUATION_THESIS' ? 'PB / Bảo vệ' : 'Đánh giá', 'Hoàn thành'];
        const index = { DRAFT: -1, PHASE1_LECTURER_REGISTRATION: 0, PHASE1_REVIEWING: 1, PHASE2_STUDENT_REGISTRATION: 2, IN_PROGRESS: 3, REVIEWING: 4, DEFENSE: 4, COMPLETED: 5 }[period.status] ?? -1;
        return `<ol class="period-progress" aria-label="Tiến trình đợt đăng ký">${steps.map((label, i) => `<li class="${i < index ? 'done' : i === index ? 'current' : ''}" ${i === index ? 'aria-current="step"' : ''}><span class="step-dot" aria-hidden="true">${i < index ? '✓' : i + 1}</span><span>${label}</span></li>`).join('')}</ol>`;
    }
    function periodCard(p, featured = false) {
        const state = registration(p);
        return `<article class="period-card ${featured ? 'featured' : ''}">
            <div class="catalogue-card-top"><span class="catalogue-eyebrow">${escapeText(types[p.type] || p.type || 'Đợt đăng ký')}</span>${badge(p)}</div>
            <h2>${escapeText(p.name || 'Đợt đăng ký')}</h2>
            <p class="catalogue-muted">Học kỳ ${escapeText(p.semester || '—')} · Năm học ${escapeText(p.academicYear || '—')}</p>
            ${progress(p)}
            <div class="period-dates"><div><span>Mở đăng ký sinh viên</span><strong>${escapeText(date(p.studentRegStart))}</strong></div><div><span>Hạn đăng ký</span><strong>${escapeText(date(p.studentRegEnd))}</strong></div></div>
            <div class="catalogue-card-bottom"><span class="catalogue-muted">${escapeText(p.topicCount ?? '—')} đề tài · ${escapeText(p.groupCount ?? '—')} nhóm</span><span class="catalogue-stage">${escapeText(statuses[p.status] || p.status || '')}</span></div>
            <div class="catalogue-actions"><a class="btn ${state.open ? 'btn-primary' : 'btn-secondary'}" href="topics.html?periodId=${encodeURIComponent(p.id)}">Xem đề tài <span aria-hidden="true">→</span></a><button class="btn btn-action-view" type="button" onclick="showPeriodDetail(${Number(p.id)})">Lịch chi tiết</button></div>
        </article>`;
    }
    function empty(message) { return `<div class="catalogue-empty"><span aria-hidden="true">⌕</span><p>${escapeText(message)}</p></div>`; }
    function initViews(onChange) {
        let view = 'cards';
        document.querySelectorAll('[data-catalogue-view]').forEach(button => button.addEventListener('click', () => {
            view = button.dataset.catalogueView;
            document.querySelectorAll('[data-catalogue-view]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
            onChange(view);
        }));
        return () => view;
    }
    function movePager(target) {
        const pager = getServerPagination(target)?.controls;
        if (pager) document.getElementById('cataloguePagination').append(pager);
    }
    return { types, statuses, date, registration, badge, progress, periodCard, empty, initViews, movePager };
})();
