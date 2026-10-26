const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../js/admin/councils.js'), 'utf8');

function setup() {
    const elements = {};
    const get = id => elements[id] ||= {
        value: '', textContent: '', innerHTML: '', style: {}, disabled: false,
        classList: { remove() {}, add() {} }, attributes: {},
        setAttribute(name, value) { this.attributes[name] = value; },
        reset() {
            for (const element of Object.values(elements)) element.value = '';
        }
    };
    const requests = [], alerts = [];
    const council = { id: 7, name: 'Hội đồng 7', periodId: 2, periodName: 'Đợt 2',
        defenseDate: '2026-11-10', location: 'Room 101', notes: 'Notes', members: [
            { lecturerId: 11, lecturerName: 'Chair', councilRole: 'CHAIRMAN' },
            { lecturerId: 12, lecturerName: 'Secretary', councilRole: 'SECRETARY' },
            { lecturerId: 13, lecturerName: 'Member', councilRole: 'MEMBER' }
        ] };
    const context = { document: { addEventListener() {}, getElementById: get, querySelectorAll: () => [] },
        escapeText: value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]),
        window: {}, localStorage: { getItem: () => 'token' }, console: { error() {} },
        showAlert: async message => alerts.push(message),
        apiFetch: async (url, options) => {
            requests.push({ url, ...options });
            return { ok: true, json: async () => ({ success: true, data: council }) };
        } };
    vm.createContext(context);
    vm.runInContext(source, context);
    context.loadCouncils = async () => {};
    return { context, get, requests, alerts, council };
}

test('edit preloads all fields and roles, locks period and sends PUT', async () => {
    const { context, get, requests } = setup();
    await context.openEditCouncilModal(7);
    assert.equal(get('councilName').value, 'Hội đồng 7');
    assert.equal(get('councilDefenseDate').value, '2026-11-10');
    assert.equal(get('councilLocation').value, 'Room 101');
    assert.equal(get('councilNotes').value, 'Notes');
    assert.equal(get('councilChairmanId').value, 11);
    assert.equal(get('councilSecretaryId').value, 12);
    assert.equal(get('councilPeriodTrigger').attributes['aria-disabled'], 'true');
    context.selectCouncilPeriod(99);
    assert.equal(get('councilPeriodId').value, '2');
    get('councilName').value = 'Updated';
    await context.createCouncil({ preventDefault() {} });
    assert.equal(requests[1].url, '/councils/7');
    assert.equal(requests[1].method, 'PUT');
    const payload = JSON.parse(requests[1].body);
    assert.equal(payload.name, 'Updated');
    assert.equal(payload.periodId, 2);
    assert.deepEqual(payload.members, [
        { lecturerId: 11, councilRole: 'CHAIRMAN' },
        { lecturerId: 12, councilRole: 'SECRETARY' },
        { lecturerId: 13, councilRole: 'MEMBER' }
    ]);
    assert.equal(get('createCouncilModal').style.display, 'none');
});

test('create after edit resets membership, unlocks period and sends POST', async () => {
    const { context, get, requests } = setup();
    await context.openEditCouncilModal(7);
    context.openCreateCouncilModal();
    assert.equal(get('councilFormTitle').textContent, 'Thành lập Hội đồng mới');
    assert.equal(get('councilPeriodTrigger').attributes['aria-disabled'], 'false');
    assert.equal(get('councilChairmanId').value, '');
    context.selectCouncilPeriod(2);
    context.selectChairman(11);
    context.selectSecretary(12);
    context.toggleMemberSelection(13);
    get('councilName').value = 'New';
    get('councilDefenseDate').value = '2026-11-10';
    get('councilLocation').value = 'Room 102';
    await context.createCouncil({ preventDefault() {} });
    assert.equal(requests[1].url, '/councils');
    assert.equal(requests[1].method, 'POST');
});

test('rejected update preserves form and displays server message', async () => {
    const { context, get, alerts } = setup();
    await context.openEditCouncilModal(7);
    context.apiFetch = async () => ({ ok: false, json: async () => ({ success: false, message: 'Hội đồng đã nhập điểm' }) });
    await context.createCouncil({ preventDefault() {} });
    assert.equal(alerts[0], 'Hội đồng đã nhập điểm');
    assert.equal(get('createCouncilModal').style.display, 'flex');
    assert.equal(get('councilSaveButton').disabled, false);
    assert.equal(get('councilName').value, 'Hội đồng 7');
});

test('council list includes edit action', () => {
    const { context, get } = setup();
    context.renderCouncils([{ id: 7, name: 'Council' }]);
    assert.match(get('councilTableBody').innerHTML, /onclick="openEditCouncilModal\(7\)"/);
    assert.match(get('councilTableBody').innerHTML, /onclick="deleteCouncil\(7\)"/);
});

test('council deletion requires confirmation and sends DELETE', async () => {
    const { context, requests } = setup();
    context.confirmAction = async message => { assert.match(message, /Hội đồng đã có điểm/); return true; };
    await context.deleteCouncil(7);
    assert.equal(requests[0].url, '/councils/7');
    assert.equal(requests[0].method, 'DELETE');
});

test('council table counts the assignedTopics returned by the backend', () => {
    const { context, get } = setup();
    context.renderCouncils([{ id: 7, name: 'Council', assignedTopics: [{ topicId: 41 }, { topicId: 42 }] }]);
    assert.match(get('councilTableBody').innerHTML, /<td>2<\/td>/);
    context.renderCouncils([{ id: 8, name: 'Empty', assignedTopics: [] }]);
    assert.match(get('councilTableBody').innerHTML, /<td>0<\/td>/);
});

test('council details render assignment fields and use topicId for a missing code', async () => {
    const { context, get, council } = setup();
    council.assignedTopics = [
        { id: 901, topicId: 41, topicCode: 'DT041', topicTitleVi: '<Đề tài A>', primaryAdvisorName: 'Advisor', studentGroupName: 'Group A' },
        { id: 902, topicId: 42, topicTitleVi: 'Đề tài B' }
    ];
    await context.viewCouncilDetail(7);
    const html = get('councilDetailTopicsBody').innerHTML;
    assert.match(html, /DT041/);
    assert.match(html, /&lt;Đề tài A&gt;/);
    assert.match(html, /Advisor/);
    assert.match(html, /Group A/);
    assert.match(html, /DT042/);
    assert.doesNotMatch(html, /DT902|Chưa có dữ liệu/);
});

test('assignment modal checks existing topic IDs rather than assignment IDs', async () => {
    const { context, get, council, alerts } = setup();
    council.assignedTopics = [{ id: 901, topicId: 41 }, { id: 902, topicId: '42' }];
    context.apiFetchAll = async () => ({ ok: true, json: async () => ({ success: true, data: [
        { id: 41, titleVi: 'A' }, { id: 42, titleVi: 'B' }, { id: 43, titleVi: 'C' }
    ] }) });
    await context.openAssignTopicsModal(7);
    assert.deepEqual(alerts, []);
    const html = get('councilTopicsList').innerHTML;
    assert.match(html, /value="41" checked/);
    assert.match(html, /value="42" checked/);
    assert.doesNotMatch(html, /value="43" checked/);
});
