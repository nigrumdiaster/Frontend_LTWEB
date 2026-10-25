const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../js/admin/topics.js'), 'utf8');

for (const [selection, expected] of [['', null], ['42', 42]]) {
    test(`admin topic update sends coAdvisorId=${expected}`, async () => {
        const fields = { editTopicId: '7', editDepartmentId: '2', editCoAdvisorId: selection, editTitleVi: 'Updated approved topic', editTitleEn: '', editMaxStudents: '3', editDescription: 'Description', editRequirements: '' };
        let sent;
        const context = { document: { addEventListener() {}, getElementById: id => ({ value: fields[id], style: {} }) }, window: {},
            localStorage: { getItem: () => 'token' }, showAlert: async () => {},
            apiFetch: async (url, options) => { sent = { url, options }; return { ok: false, json: async () => ({ success: false }) }; } };
        vm.createContext(context);
        vm.runInContext(source, context);
        await context.handleEditTopic({ preventDefault() {} });
        assert.equal(sent.url, '/topics/7');
        assert.equal(sent.options.method, 'PUT');
        assert.equal(JSON.parse(sent.options.body).coAdvisorId, expected);
    });
}

test('assigned approved topic retains edit action and explains protected actions', () => {
    const tbody = { innerHTML: '' };
    const context = { document: { addEventListener() {}, getElementById: () => tbody }, window: {}, escapeText: value => String(value ?? ''), getAssignedGroupLabel: () => 'Nhóm kiểm tra' };
    vm.createContext(context);
    vm.runInContext(source, context);
    context.renderTopicsTable([{ id: 7, approvalStatus: 'APPROVED', isAssigned: true }]);
    assert.match(tbody.innerHTML, /onclick="openEditTopicModal\(7\)" class="btn btn-sm btn-action-edit">Sửa/);
    assert.match(tbody.innerHTML, /onclick="deleteTopic\(7\)" class="btn btn-sm btn-action-delete">Xóa/);
    assert.match(tbody.innerHTML, /onclick="openApprovalModal\(7\)" class="btn btn-sm btn-primary">/);
});

for (const confirmed of [false, true]) {
    test(`topic deletion sends DELETE only after explicit confirmation: ${confirmed}`, async () => {
        const requests = [], confirmations = [];
        const context = { document: { addEventListener() {} }, window: {}, localStorage: { getItem: () => 'token' },
            confirmAction: async message => { confirmations.push(message); return confirmed; },
            showAlert: async () => {}, apiFetch: async (url, options) => { requests.push({ url, method: options.method }); return { ok: true, json: async () => ({ success: true }) }; } };
        vm.createContext(context);
        vm.runInContext(source, context);
        context.loadTopics = () => {};
        await context.deleteTopic(7);
        assert.equal(confirmations.length, 1);
        assert.match(confirmations[0], /Nhóm và thành viên được giữ lại/);
        assert.match(confirmations[0], /điểm, kết quả/);
        assert.match(confirmations[0], /không thể hoàn tác/);
        assert.deepEqual(requests, confirmed ? [{ url: '/topics/7', method: 'DELETE' }] : []);
    });
}
