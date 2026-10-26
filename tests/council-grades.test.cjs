const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../js/lecturer/councils.js'), 'utf8');

async function setup() {
    const elements = {};
    const get = id => elements[id] ||= { value: '1', checked: true, style: {}, events: {},
        addEventListener(event, callback) { this.events[event] = callback; } };
    const council = { id: 7, members: [
        { lecturerId: 10, lecturerName: '<Chair>', councilRole: 'CHAIRMAN' },
        { lecturerId: 11, lecturerName: 'Secretary', councilRole: 'SECRETARY' },
        { lecturerId: 12, lecturerName: 'Member', councilRole: 'MEMBER' }
    ], assignedTopics: [{ topicId: 41, topicCode: 'DT041', topicTitleVi: 'Topic' }] };
    const grades = [
        { graderId: 10, graderName: '<Chair>', graderRole: 'COUNCIL_CHAIRMAN', score: 0, feedback: '<Comment>' },
        { graderId: 11, graderRole: 'COUNCIL_SECRETARY', score: 8.5 },
        { graderId: 12, graderRole: 'ADVISOR', score: 9 }
    ];
    let ready;
    const alerts = [], requests = [];
    const context = {
        document: { getElementById: get, addEventListener(event, callback) { ready = callback; } },
        window: {}, getMe: () => ({ id: 10, fullName: '<Chair>' }), fmtAnyDate: () => '-',
        escapeHtml: value => String(value).replace(/</g, '&lt;').replace(/>/g, '&gt;'),
        councilRoleLabel: value => value, isChairman: value => value === 'CHAIRMAN', fmtScore: value => Number(value).toFixed(1),
        openPromptModal: config => { context.prompt = config; },
        openInfoModal: (title, html) => { context.info = html; },
        showAlert: async message => alerts.push(message),
        callAPI: async url => {
            requests.push(url);
            return { ok: true, result: { data: url.startsWith('/grades/') ? grades : url.startsWith('/councils/') ? [council] : [] } };
        }
    };
    vm.runInNewContext(source, context);
    ready();
    await get('btnReloadCouncils').events.click();
    return { context, alerts, requests, get };
}

test('grading shows member scores before finalization and preloads the current grader including zero', async () => {
    const { context, requests, get } = await setup();
    assert.match(get('councilsArea').innerHTML, /Điểm thành viên/);
    await context.window.gradeCouncil(7, 41);
    assert.equal(requests.at(-1), '/grades/topic/41');
    assert.equal(context.prompt.fields[0].value, 0);
    assert.equal(context.prompt.fields[1].value, '<Comment>');
    assert.match(context.prompt.sub, /&lt;Chair&gt;/);
    assert.match(context.prompt.sub, /&lt;Comment&gt;/);
    assert.match(context.prompt.sub, /8\.5/);
    assert.match(context.prompt.sub, /Chưa chấm/);
    assert.doesNotMatch(context.prompt.sub, /<Chair>|<Comment>|9\.0/);
    await context.window.showCouncilGrades(7, 41);
    assert.match(context.info, /0\.0/);
    assert.match(context.info, /Secretary/);
});

test('failed score loading displays the error rather than opening a blank grading form', async () => {
    const { context, alerts } = await setup();
    context.callAPI = async () => ({ ok: false, result: { message: 'Không có quyền' } });
    await context.window.gradeCouncil(7, 41);
    assert.deepEqual(alerts, ['Không có quyền']);
    assert.equal(context.prompt, undefined);
});
