const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const context = { escapeText: value => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') };
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/student/discovery.js'), 'utf8') + '\nthis.discovery = StudentDiscovery;', context);
const ui = context.discovery;
const now = Date.parse('2026-10-25T09:00:00Z');
const period = { id: 1, status: 'PHASE2_STUDENT_REGISTRATION', studentRegStart: '2026-10-24T09:00:00Z', studentRegEnd: '2026-10-26T09:00:00Z' };
test('registration opens only in the student phase and within both deadlines', () => {
    assert.equal(ui.registration(period, now).open, true);
    assert.equal(ui.registration({ ...period, status: 'PHASE1_REVIEWING' }, now).open, false);
    for (const status of ['CANCELLED', 'COMPLETED', 'IN_PROGRESS', 'REVIEWING', 'DEFENSE']) assert.equal(ui.registration({ ...period, status }, now).open, false);
    assert.equal(ui.registration(period, Date.parse(period.studentRegStart)).open, true);
    assert.equal(ui.registration(period, Date.parse(period.studentRegEnd)).open, true);
    assert.equal(ui.registration(period, Date.parse(period.studentRegStart) - 1).open, false);
    assert.equal(ui.registration(period, Date.parse(period.studentRegEnd) + 1).open, false);
});
test('missing, invalid and reversed schedules never imply registration is open', () => {
    for (const patch of [{ studentRegStart: null }, { studentRegEnd: null }, { studentRegEnd: 'invalid' }, { studentRegStart: period.studentRegEnd, studentRegEnd: period.studentRegStart }]) assert.equal(ui.registration({ ...period, ...patch }, now).open, false);
    assert.equal(ui.registration(null, now).open, false);
});
test('period progress marks one current step and handles cancellation explicitly', () => {
    const html = ui.progress(period);
    assert.equal((html.match(/aria-current="step"/g) || []).length, 1);
    assert.match(html, /current.*?SV đăng ký/);
    assert.doesNotMatch(ui.progress({ status: 'CANCELLED' }), /aria-current/);
});
test('period cards escape API text and link directly to the selected period', () => {
    const html = ui.periodCard({ ...period, name: '<img src=x onerror=alert(1)>', type: '<script>', topicCount: 0, groupCount: 0 });
    assert.doesNotMatch(html, /<img|<script>/);
    assert.match(html, /&lt;img/);
    assert.match(html, /topics\.html\?periodId=1/);
    assert.match(html, /0 đề tài · 0 nhóm/);
});
