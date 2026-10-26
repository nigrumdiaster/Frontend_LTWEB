const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../js/auth.js'), 'utf8');

function setup({token = 'token', status = 200, role = 'ROLE_STUDENT', networkError = false} = {}) {
    const stored = new Map(token ? [['token', token], ['user', '{"role":"ROLE_ADMIN"}']] : []);
    const form = {inert: false, before() {}, setAttribute() {}, removeAttribute() {}};
    const statusElement = {setAttribute() {}};
    const redirects = [];
    let requests = 0;
    const context = {
        document: {addEventListener() {}, querySelectorAll: () => [form], getElementById: () => statusElement},
        window: {addEventListener() {}, location: {replace: value => redirects.push(value)}},
        localStorage: {getItem: key => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value), removeItem: key => stored.delete(key)},
        API_BASE_URL: 'https://example.com/api',
        fetch: async () => {
            requests++;
            if (networkError) throw new Error('offline');
            return {status, ok: status === 200, json: async () => ({success: true, data: {id: 1, role}})};
        }
    };
    vm.createContext(context);
    vm.runInContext(source, context);
    return {check: context.redirectAuthenticatedVisitor, stored, form, redirects, requests: () => requests};
}

test('verified server role determines destination instead of cached role', async () => {
    for (const [role, target] of [['ROLE_STUDENT', 'student'], ['ROLE_LECTURER', 'lecturer'], ['ROLE_ADMIN', 'admin'], ['ROLE_DEAN', 'admin'], ['ROLE_DEPARTMENT_HEAD', 'lecturer']]) {
        const app = setup({role});
        assert.equal(await app.check(), true);
        assert.deepEqual(app.redirects, [`${target}/profile.html`]);
    }
});

test('expired token is cleared without a redirect loop', async () => {
    const app = setup({status: 401});
    assert.equal(await app.check(), false);
    assert.equal(app.stored.has('token'), false);
    assert.equal(app.stored.has('user'), false);
    assert.equal(app.form.inert, false);
    assert.deepEqual(app.redirects, []);
});

test('anonymous visitors do not need a session request', async () => {
    const app = setup({token: null});
    assert.equal(await app.check(), false);
    assert.equal(app.requests(), 0);
});

test('network failure preserves token and enables the form', async () => {
    const app = setup({networkError: true});
    assert.equal(await app.check(), false);
    assert.equal(app.stored.get('token'), 'token');
    assert.equal(app.form.inert, false);
});

test('concurrent checks share one request', async () => {
    const app = setup();
    await Promise.all([app.check(), app.check()]);
    assert.equal(app.requests(), 1);
});
