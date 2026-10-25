const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../js/admin/results.js'), 'utf8');
const config = fs.readFileSync(path.join(__dirname, '../js/config.js'), 'utf8');
const escape = config.slice(config.indexOf('function escapeText'), config.indexOf('\n}', config.indexOf('function escapeText')) + 2);
function setup() {
    const elements = new Map();
    const context = { document: { addEventListener() {}, getElementById(id) {
        if (!elements.has(id)) elements.set(id, { innerHTML: '', style: {} });
        return elements.get(id);
    } }, window: {}, localStorage: { getItem() { return 'test-token'; } } };
    vm.createContext(context);
    vm.runInContext(escape + '\n' + source, context);
    return { context, elements };
}
test('admin results displays the backend reviewerScore field including zero', () => {
    const { context, elements } = setup();
    context.renderResultsTable([{ topicId: 1, reviewerScore: 8.5 }, { topicId: 2, reviewerScore: 0 }]);
    const html = elements.get('resultsTableBody').innerHTML;
    assert.match(html, /<td>8\.5<\/td>/);
    assert.match(html, /<td>0\.0<\/td>/);
});
test('ungraded results stay distinct from a failed result', () => {
    const { context, elements } = setup();
    context.renderResultsTable([{ topicId: 1, passed: null }]);
    assert.match(elements.get('resultsTableBody').innerHTML, /Chưa có kết quả/);
    assert.doesNotMatch(elements.get('resultsTableBody').innerHTML, /KHÔNG ĐẠT/);
    context.renderResultsTable([{ topicId: 1, passed: false }]);
    assert.match(elements.get('resultsTableBody').innerHTML, /KHÔNG ĐẠT/);
});
test('result table, summary and grade feedback render API strings as text', async () => {
    const { context, elements } = setup();
    const payload = '<img src=x onerror=alert(1)>';
    const result = { topicId: 1, topicTitleVi: payload, studentGroupName: payload,
        chairmanSummary: payload, topic: { code: payload }, studentGroup: { members: [{ studentName: payload, studentCode: payload }] } };
    context.renderResultsTable([result]);
    context.apiFetch = async endpoint => ({ ok: true, json: async () => ({ success: true,
        data: endpoint.startsWith('/grades') ? [{ graderName: payload, feedback: payload }] : result }) });
    await context.viewResultDetail(1);
    for (const id of ['resultsTableBody', 'resultSummary', 'detailedGradesTableBody']) {
        assert.doesNotMatch(elements.get(id).innerHTML, /<img/);
        assert.match(elements.get(id).innerHTML, /&lt;img/);
    }
    assert.equal(elements.get('resultDetailModal').style.display, 'flex');
});
