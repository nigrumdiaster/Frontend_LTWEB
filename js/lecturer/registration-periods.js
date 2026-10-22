// Trang đợt đăng ký đề tài (giảng viên)
// API: GET /api/registration-periods?type=&status=   (danh sách, có lọc)
//      GET /api/registration-periods/{id}            (chi tiết)

const PERIOD_TYPE_LABELS = {
    COURSE_PROJECT: 'Đồ án môn học',
    SCIENTIFIC_RESEARCH: 'Nghiên cứu khoa học',
    SPECIALIZED_PROJECT: 'Đồ án chuyên ngành',
    GRADUATION_THESIS: 'Khóa luận tốt nghiệp'
};

const PERIOD_STATUS_LABELS = {
    DRAFT: ['Nháp', '#64748b'],
    PHASE1_LECTURER_REGISTRATION: ['Giảng viên đăng ký đề tài', '#b45309'],
    PHASE1_REVIEWING: ['Đang duyệt đề tài', '#b45309'],
    PHASE2_STUDENT_REGISTRATION: ['Sinh viên đăng ký', '#15803d'],
    IN_PROGRESS: ['Đang thực hiện', '#2563eb'],
    REVIEWING: ['Đang phản biện', '#7c3aed'],
    DEFENSE: ['Bảo vệ', '#7c3aed'],
    COMPLETED: ['Hoàn thành', '#475569'],
    CANCELLED: ['Đã hủy', '#b91c1c']
};

let periodsCache = [];

function escapeHtml(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// "2026-10-14" (chỉ ngày) hoặc "2026-10-14T18:09:13.609Z" (ngày giờ)
function formatPeriodDate(value) {
    if (!value) return '-';
    const str = String(value);
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
        const [y, m, d] = str.split('-');
        return `${d}/${m}/${y}`;
    }
    const d = new Date(str);
    if (isNaN(d)) return escapeHtml(str);
    return d.toLocaleDateString('vi-VN') + ' ' +
        d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

function periodStatusBadge(status) {
    const [label, color] = PERIOD_STATUS_LABELS[status] || [status || '-', '#475569'];
    return `<span style="color:${color}; font-weight:600;">${escapeHtml(label)}</span>`;
}

function openPeriodModal() {
    const m = document.getElementById('periodModal');
    if (m) m.style.display = 'flex';
}

function closePeriodModal() {
    const m = document.getElementById('periodModal');
    if (m) m.style.display = 'none';
}

async function showPeriodDetail(id) {
    try {
        const response = await apiFetch('/registration-periods/' + id, { method: 'GET' });
        const result = await response.json();
        if (!response.ok || !result.success || !result.data) {
            throw new Error(result.message || 'Không thể tải chi tiết đợt đăng ký.');
        }
        const p = result.data;
        const field = (label, value) => `
            <div>
                <span style="color:#64748b; font-size:13px;">${label}</span>
                <p style="font-size:15px; font-weight:600; color:#0f172a; margin-top:4px;">${value}</p>
            </div>`;

        document.getElementById('periodModalTitle').textContent = p.name || 'Chi tiết đợt đăng ký';
        document.getElementById('periodModalBody').innerHTML = [
            field('Loại đề tài', escapeHtml(PERIOD_TYPE_LABELS[p.type] || p.type || '-')),
            field('Trạng thái', periodStatusBadge(p.status)),
            field('Học kỳ', escapeHtml(p.semester || '-')),
            field('Năm học', escapeHtml(p.academicYear || '-')),
            field('Giảng viên đăng ký từ', formatPeriodDate(p.lecturerRegStart)),
            field('Giảng viên đăng ký đến', formatPeriodDate(p.lecturerRegEnd)),
            field('Sinh viên đăng ký từ', formatPeriodDate(p.studentRegStart)),
            field('Sinh viên đăng ký đến', formatPeriodDate(p.studentRegEnd)),
            field('Hạn phản biện', formatPeriodDate(p.reviewerDeadline)),
            field('Ngày bảo vệ', formatPeriodDate(p.defenseDate)),
            field('Số đề tài', p.topicCount ?? '-'),
            field('Số nhóm', p.groupCount ?? '-'),
            field('Người tạo', escapeHtml(p.createdByName || '-')),
            field('Ngày tạo', formatPeriodDate(p.createdAt)),
            `<div style="grid-column: 1 / -1;">${field('Mô tả', escapeHtml(p.description || '-'))}</div>`
        ].join('');
        openPeriodModal();
    } catch (error) {
        console.error('Lỗi tải chi tiết đợt:', error);
        await showAlert(error.message || 'Lỗi kết nối máy chủ!');
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('btnResetFilters').addEventListener('click', () => {
        document.getElementById('typeFilter').value = '';
        document.getElementById('statusFilter').value = '';
        document.getElementById('periodSearch').value = '';
        loadPeriods();
    });

    const tbody = document.getElementById('periodTableBody');
    const typeFilter = document.getElementById('typeFilter');
    const statusFilter = document.getElementById('statusFilter');
    const searchInput = document.getElementById('periodSearch');
    const countEl = document.getElementById('periodCount');
    const errorEl = document.getElementById('periodLoadError');

    if (!localStorage.getItem('token')) {
        await showAlert('Bạn chưa đăng nhập!');
        window.location.href = '../index.html';
        return;
    }

    function showError(msg) {
        errorEl.textContent = msg || '';
        errorEl.style.display = msg ? 'block' : 'none';
    }

    function render() {
        const kw = removeVietnameseTones(searchInput.value);
        const list = periodsCache.filter(p =>
            !kw || [p.name, p.semester, p.academicYear].some(v => removeVietnameseTones(v).includes(kw)));

        tbody.innerHTML = list.length ? list.map((p, i) => `
            <tr style="border-top: 1px solid #e2e8f0;">
                <td style="padding: 10px 12px;">${i + 1}</td>
                <td style="padding: 10px 12px; font-weight: 600;">${escapeHtml(p.name)}</td>
                <td style="padding: 10px 12px;">${escapeHtml(PERIOD_TYPE_LABELS[p.type] || p.type || '-')}</td>
                <td style="padding: 10px 12px;">${escapeHtml(p.semester || '-')} / ${escapeHtml(p.academicYear || '-')}</td>
                <td style="padding: 10px 12px; white-space: nowrap;">${formatPeriodDate(p.studentRegStart)}<br>→ ${formatPeriodDate(p.studentRegEnd)}</td>
                <td style="padding: 10px 12px;">${formatPeriodDate(p.defenseDate)}</td>
                <td style="padding: 10px 12px;">${periodStatusBadge(p.status)}</td>
                <td style="padding: 10px 12px; text-align: center;">${p.topicCount ?? '-'}</td>
                <td style="padding: 10px 12px; text-align: center;">${p.groupCount ?? '-'}</td>
                <td style="padding: 10px 12px;"><button type="button" class="btn btn-secondary btn-sm" onclick="showPeriodDetail(${p.id})">Chi tiết</button></td>
            </tr>`).join('')
            : '<tr><td colspan="100%" class="text-center py-4">Chưa có dữ liệu</td></tr>';
        countEl.textContent = `Hiển thị ${list.length} đợt đăng ký`;
    }

    async function loadPeriods() {
        showError('');
        tbody.innerHTML = '<tr><td colspan="100%" class="text-center py-4">Đang tải dữ liệu...</td></tr>';

        const params = new URLSearchParams();
        if (typeFilter.value) params.set('type', typeFilter.value);
        if (statusFilter.value) params.set('status', statusFilter.value);
        const query = params.toString() ? '?' + params.toString() : '';

        try {
            const response = await apiFetch('/registration-periods' + query, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });
            const result = await response.json();
            if (response.ok && result.success) {
                // Sinh viên không cần thấy đợt còn ở trạng thái nháp
                periodsCache = (Array.isArray(result.data) ? result.data : [])
                    .filter(p => p.status !== 'DRAFT');
                populateFilterOptions(
                    typeFilter,
                    periodsCache.map(period => period.type),
                    'Tất cả',
                    type => PERIOD_TYPE_LABELS[type] || type
                );
                populateFilterOptions(
                    statusFilter,
                    periodsCache.map(period => period.status),
                    'Tất cả',
                    status => (PERIOD_STATUS_LABELS[status] || [status])[0]
                );
                render();
            } else {
                throw new Error(result.message || 'Không thể tải danh sách đợt đăng ký.');
            }
        } catch (error) {
            console.error('Lỗi tải đợt đăng ký:', error);
            periodsCache = [];
            tbody.innerHTML = '';
            countEl.textContent = '';
            showError(error.message || 'Lỗi kết nối máy chủ!');
        }
    }

    document.getElementById('btnReloadPeriods').addEventListener('click', loadPeriods);
    typeFilter.addEventListener('change', loadPeriods);
    statusFilter.addEventListener('change', loadPeriods);
    searchInput.addEventListener('input', render);
    loadPeriods();
});