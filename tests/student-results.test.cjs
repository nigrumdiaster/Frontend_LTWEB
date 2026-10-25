const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../js/student/results.js'), 'utf8');

function setup(periods = [{ id: 10, name: 'Đợt đã đăng ký' }], handler) {
    const elements = new Map();
    for (const id of ['resultArea', 'resultLoadError', 'resultPeriodSelect', 'btnReloadResults']) {
        elements.set(id, {
            value: '', innerHTML: '', style: {}, listeners: {}, options: [],
            addEventListener(name, callback) { this.listeners[name] = callback; },
            replaceChildren(...options) { this.options = options; this.value = options[0]?.value || ''; }
        });
    }
    let ready;
    const requests = [];
    const context = {
        document: {
            getElementById: id => elements.get(id),
            addEventListener(name, callback) { ready = callback; }
        },
        localStorage: { getItem: () => 'token' },
        window: { location: {} }, console: { error() {} },
        showAlert: async () => {},
        Option: function(text, value) { this.text = text; this.value = value; },
        apiFetch: async url => {
            requests.push(url);
            if (handler) {
                const response = handler(url);
                if (response) return response;
            }
            return { ok: true, status: 200, json: async () => ({ success: true,
                data: url === '/results/student/periods' ? periods : [] }) };
        }
    };
    context.apiFetchAll = context.apiFetch;
    context.apiFetchTable = context.apiFetch;
    vm.runInNewContext(source, context);
    return { elements, requests, ready: () => ready() };
}

test('only registered periods populate the selector and results include selected period ID', async () => {
    const app = setup([{ id: 10, name: 'Đợt 1' }, { id: 20, name: 'Đợt 2' }]);
    await app.ready();
    const select = app.elements.get('resultPeriodSelect');
    assert.deepEqual(select.options.map(o => o.value), ['10', '20']);
    assert.equal(select.disabled, false);
    assert.equal(app.requests.at(-1), '/results/student/my-results?periodId=10');
    select.value = '20';
    await select.listeners.change();
    assert.equal(app.requests.at(-1), '/results/student/my-results?periodId=20');
    await app.elements.get('btnReloadResults').listeners.click();
    assert.equal(select.value, '20');
});

test('no registered periods means no request for results', async () => {
    const app = setup([]);
    await app.ready();
    assert.deepEqual(app.requests, ['/results/student/periods']);
    assert.equal(app.elements.get('resultPeriodSelect').disabled, true);
    assert.match(app.elements.get('resultArea').innerHTML, /chưa đăng ký đề tài/);
});

test('forbidden results clear old content and show the access error', async () => {
    const app = setup(undefined, url => url.includes('my-results')
        ? { ok: false, status: 403, json: async () => ({ success: false }) } : null);
    await app.ready();
    assert.equal(app.elements.get('resultArea').innerHTML, '');
    assert.match(app.elements.get('resultLoadError').textContent, /không có quyền/);
});

test('a slow response for a previous selection cannot overwrite the current period', async () => {
    let resolveFirst;
    let slow = false;
    const app = setup([{ id: 10, name: 'Đợt 1' }, { id: 20, name: 'Đợt 2' }], url => {
        if (slow && url.endsWith('=10')) {
            return new Promise(resolve => { resolveFirst = resolve; });
        }
        return null;
    });
    await app.ready();
    const select = app.elements.get('resultPeriodSelect');
    slow = true;
    const first = select.listeners.change();
    select.value = '20';
    await select.listeners.change();
    const current = app.elements.get('resultArea').innerHTML;
    resolveFirst({ ok: false, status: 403, json: async () => ({ success: false }) });
    await first;
    assert.equal(app.elements.get('resultArea').innerHTML, current);
    assert.equal(app.elements.get('resultLoadError').textContent, '');
});
