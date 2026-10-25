function getAuthHeaders() {
    return {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
    };
}

let registrationPeriods = [];
let selectedPeriodId = '';
let periodSearchQuery = '';

function safeRemoveTones(str) {
    if (typeof removeVietnameseTones === 'function') {
        return removeVietnameseTones(str);
    }
    return (str || '')
        .toString()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[đĐ]/g, 'd')
        .toLowerCase()
        .trim();
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btnLoadResults').addEventListener('click', loadPeriodResults);
    document.getElementById('btnPublishResults').addEventListener('click', publishPeriodResults);

    setupPeriodSearchableSelect();
    loadRegistrationPeriods();
});

function closePeriodDropdown() {
    const dropdown = document.getElementById('filterPeriodDropdown');
    const trigger = document.getElementById('filterPeriodTrigger');
    if (dropdown) dropdown.classList.remove('open');
    if (trigger) trigger.classList.remove('active');
}

function setupPeriodSearchableSelect() {
    const trigger = document.getElementById('filterPeriodTrigger');
    const dropdown = document.getElementById('filterPeriodDropdown');
    const searchInput = document.getElementById('filterPeriodSearchInput');

    if (trigger && dropdown) {
        trigger.addEventListener('click', () => {
            const isOpen = dropdown.classList.contains('open');
            if (isOpen) {
                closePeriodDropdown();
            } else {
                dropdown.classList.add('open');
                trigger.classList.add('active');
                if (searchInput) {
                    setTimeout(() => searchInput.focus(), 60);
                }
            }
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            periodSearchQuery = e.target.value.trim();
            renderPeriodOptions();
        });
        searchInput.addEventListener('click', (e) => e.stopPropagation());
    }

    document.addEventListener('click', (e) => {
        if (!e.target.closest('#filterPeriodContainer')) {
            closePeriodDropdown();
        }
    });
}

async function loadRegistrationPeriods() {
    try {
        const response = await apiFetchAll(`/registration-periods`, {
            method: 'GET',
            headers: getAuthHeaders()
        });
        const result = await response.json();
        if (!response.ok || !result.success) {
            throw new Error(result.message || 'Không thể tải danh sách đợt đăng ký.');
        }

        registrationPeriods = result.data || [];
        selectedPeriodId = '';
        const hiddenInput = document.getElementById('filterPeriod');
        if (hiddenInput) hiddenInput.value = '';

        renderPeriodSelect();
        showResultsMessage('Vui lòng chọn đợt đăng ký để xem kết quả.');
    } catch (error) {
        console.error('Lỗi tải đợt đăng ký:', error);
        showResultsMessage(error.message || 'Không thể tải danh sách đợt đăng ký.', true);
    }
}

function renderPeriodSelect() {
    const label = document.getElementById('filterPeriodLabel');
    const currentPeriod = registrationPeriods.find(p => String(p.id) === String(selectedPeriodId));

    if (label) {
        if (currentPeriod) {
            label.textContent = currentPeriod.name || currentPeriod.title || `Đợt ${currentPeriod.id}`;
            label.classList.remove('placeholder');
        } else {
            label.textContent = 'Chọn đợt đăng ký...';
            label.classList.add('placeholder');
        }
    }

    renderPeriodOptions();
}

function renderPeriodOptions() {
    const optionsContainer = document.getElementById('filterPeriodOptionsList');
    if (!optionsContainer) return;

    const query = safeRemoveTones(periodSearchQuery);
    let filtered = registrationPeriods;
    if (query) {
        filtered = filtered.filter(p => {
            const name = safeRemoveTones(p.name || p.title || `Đợt ${p.id}`);
            return name.includes(query);
        });
    }

    if (filtered.length === 0) {
        optionsContainer.innerHTML = '<div style="padding: 10px; color: #64748b; font-size: 13px; text-align: center;">Không tìm thấy đợt phù hợp</div>';
        return;
    }

    optionsContainer.innerHTML = filtered.map(p => {
        const isSelected = String(p.id) === String(selectedPeriodId);
        const name = p.name || p.title || `Đợt ${p.id}`;
        return `
            <div class="select-option-item ${isSelected ? 'selected' : ''}" onclick="selectPeriod('${p.id}')">
                <span>${isSelected ? '✓ ' : ''}${name}</span>
            </div>
        `;
    }).join('');
}

function selectPeriod(id) {
    selectedPeriodId = String(id);
    const hidden = document.getElementById('filterPeriod');
    if (hidden) hidden.value = selectedPeriodId;
    closePeriodDropdown();
    renderPeriodSelect();
    loadPeriodResults();
}
window.selectPeriod = selectPeriod;


async function loadPeriodResults() {
    const periodId = document.getElementById('filterPeriod').value;
    if (!periodId) {
        hideServerPagination('resultsTableBody');
        showResultsMessage('Vui lòng chọn đợt đăng ký.');
        return;
    }

    showResultsMessage('Đang tải kết quả...');
    try {
        const response = await apiFetchTable(`/results/period/${encodeURIComponent(periodId)}`, {
            method: 'GET',
            headers: getAuthHeaders()
        }, 'resultsTableBody', loadPeriodResults);
        const result = await response.json();
        if (!response.ok || !result.success) {
            throw new Error(result.message || 'Không thể tải kết quả của đợt.');
        }
        renderResultsTable(result.data || []);
    } catch (error) {
        console.error('Lỗi GET kết quả theo đợt:', error);
        showResultsMessage(error.message || 'Không thể tải kết quả.', true);
    }
}

function renderResultsTable(results) {
    const tbody = document.getElementById('resultsTableBody');
    if (!results.length) {
        showResultsMessage('Chưa có dữ liệu');
        return;
    }

    tbody.innerHTML = results.map(result => `
        <tr>
            <td>
                <strong>${result.topic?.code || `DT${String(result.topicId).padStart(3, '0')}`}</strong><br>
                <small>${result.topicTitleVi || result.topic?.titleVi || '-'}</small>
            </td>
            <td>${result.studentGroupName || result.studentGroup?.code || '-'}</td>
            <td>${formatScore(result.advisorAvgScore)}</td>
            <td>${formatScore(result.reviewersScore)}</td>
            <td>${formatScore(result.councilAvgScore)}</td>
            <td><strong>${formatScore(result.finalScore)}</strong></td>
            <td>
                <strong>${result.letterGrade || '-'}</strong><br>
                <span class="badge ${result.passed ? 'badge-success' : 'badge-danger'}">${result.passed ? 'ĐẠT' : 'KHÔNG ĐẠT'}</span>
            </td>
            <td>${result.isPublished
                ? '<span class="badge badge-success">Đã công bố</span>'
                : '<span class="badge" style="background-color: #fef3c7; color: #b45309;">Chưa công bố</span>'}</td>
            <td style="text-align: right; white-space: nowrap;">
                <button type="button" onclick="viewResultDetail(${result.topicId})" class="btn btn-sm btn-action-view">👁️ Chi tiết điểm</button>
            </td>
        </tr>
    `).join('');
}

function formatScore(score) {
    return score == null ? '-' : Number(score).toFixed(1);
}

function showResultsMessage(message, isError = false) {
    const tbody = document.getElementById('resultsTableBody');
    if (tbody) {
        tbody.innerHTML = `<tr><td colspan="100%" class="text-center py-4${isError ? ' text-danger' : ''}">${message}</td></tr>`;
    }
}

async function publishPeriodResults() {
    const periodId = document.getElementById('filterPeriod').value;
    if (!periodId) {
        hideServerPagination('resultsTableBody');
        await showAlert('Vui lòng chọn đợt đăng ký cần công bố.');
        return;
    }
    if (!(await confirmAction('Bạn có chắc chắn muốn công bố điểm toàn bộ đợt này cho Sinh viên tra cứu?'))) return;

    try {
        const response = await apiFetch(`/results/publish`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ periodId: Number.parseInt(periodId, 10), publish: true })
        });
        const result = await response.json();
        if (!response.ok || !result.success) {
            throw new Error(result.message || 'Không thể công bố kết quả.');
        }
        await showAlert(result.message || 'Công bố kết quả thành công!');
        await loadPeriodResults();
    } catch (error) {
        console.error('Lỗi POST công bố kết quả:', error);
        await showAlert(error.message || 'Không thể công bố kết quả.');
    }
}

async function viewResultDetail(topicId) {
    try {
        const [resultResponse, gradesResponse] = await Promise.all([
            apiFetch(`/results/topic/${encodeURIComponent(topicId)}`, {
                method: 'GET',
                headers: getAuthHeaders()
            }),
            apiFetch(`/grades/topic/${encodeURIComponent(topicId)}`, {
                method: 'GET',
                headers: getAuthHeaders()
            })
        ]);
        const [resultBody, gradesBody] = await Promise.all([resultResponse.json(), gradesResponse.json()]);
        if (!resultResponse.ok || !resultBody.success || !resultBody.data) {
            throw new Error(resultBody.message || 'Không thể tải chi tiết kết quả.');
        }
        if (!gradesResponse.ok || !gradesBody.success) {
            throw new Error(gradesBody.message || 'Không thể tải điểm thành phần.');
        }

        const result = resultBody.data;
        const topic = result.topic || {};
        const group = result.studentGroup || {};
        document.getElementById('resultSummary').innerHTML = `
            <div style="background: #f8fafc; padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0;">
                <p><strong>Đề tài:</strong> ${result.topicTitleVi || topic.titleVi || '-'} (${topic.code || '-'})</p>
                <p><strong>Bộ môn:</strong> ${topic.departmentName || '-'}</p>
                <p><strong>Giảng viên hướng dẫn:</strong> ${topic.primaryAdvisorName || '-'}</p>
                <p><strong>Nhóm sinh viên:</strong> ${result.studentGroupName || group.code || '-'} — ${group.leaderName || '-'}</p>
                <p><strong>Thành viên:</strong> ${(group.members || []).map(member => `${member.studentName} (${member.studentCode})`).join(', ') || '-'}</p>
                <p><strong>Điểm tổng:</strong> ${formatScore(result.finalScore)} (${result.letterGrade || '-'}) — ${result.passed ? 'ĐẠT' : 'KHÔNG ĐẠT'}</p>
                <p style="margin-bottom: 0;"><strong>Nhận xét Chủ tịch:</strong> ${result.chairmanSummary || '-'}</p>
            </div>
        `;

        const grades = gradesBody.data || result.detailedGrades || [];
        document.getElementById('detailedGradesTableBody').innerHTML = grades.length
            ? grades.map(grade => `
                <tr>
                    <td>${grade.graderRole || '-'}</td>
                    <td>${grade.graderName || '-'}</td>
                    <td><strong>${formatScore(grade.score)}</strong></td>
                    <td>${grade.feedback || '-'}</td>
                    <td>${grade.gradedAt ? new Date(grade.gradedAt).toLocaleString('vi-VN') : '-'}</td>
                </tr>
            `).join('')
            : '<tr><td colspan="100%" class="text-center py-4">Chưa có dữ liệu</td></tr>';
        document.getElementById('resultDetailModal').style.display = 'flex';
    } catch (error) {
        console.error('Lỗi tải chi tiết điểm:', error);
        await showAlert(error.message || 'Không thể tải chi tiết điểm.');
    }
}

function closeResultDetailModal() {
    document.getElementById('resultDetailModal').style.display = 'none';
}

window.viewResultDetail = viewResultDetail;
window.closeResultDetailModal = closeResultDetailModal;

function resetFilters() {
    document.getElementById('filterPeriod').value = '';
    document.getElementById('filterPeriodSearchInput').value = '';
    selectedPeriodId = '';
    periodSearchQuery = '';
    renderPeriodSelect();
    document.querySelectorAll('.filter-card .custom-multiselect-dropdown.open').forEach(dropdown => dropdown.classList.remove('open'));
    loadPeriodResults();
}
