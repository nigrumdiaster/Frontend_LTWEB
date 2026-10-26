const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../js/config.js'), 'utf8');

function setup(role, { token = 'token', status = 200, offline = false } = {}) {
    const storage = new Map([['token', token], ['user', '{"role":"ROLE_ADMIN"}']]);
    const requests = [], redirects = [];
    const context = {
        Headers, Response,
        document: { readyState: 'loading', addEventListener() {} },
        window: { location: { pathname: '/admin/users.html', replace: url => redirects.push(url) } },
        localStorage: {
            getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value)
        },
        fetch: async (url, options) => {
            requests.push({ url, options });
            if (offline) throw new Error('offline');
            return Response.json({ success: status === 200, data: { role } }, { status });
        }
    };
    vm.runInNewContext(source, context);
    return { context, requests, redirects, storage };
}

test('direct admin access uses backend role and blocks requests for other roles', async () => {
    for (const [role, portal] of [
        ['ROLE_DEPARTMENT_HEAD', 'lecturer'], ['ROLE_LECTURER', 'lecturer'], ['ROLE_STUDENT', 'student']
    ]) {
        const app = setup(role);
        const responses = await Promise.all([
            app.context.apiFetch('/users'),
            app.context.apiFetch('/users/1', { method: 'DELETE' })
        ]);
        assert(responses.every(response => response.status === 403));
        assert.equal(app.requests.length, 1);
        assert(app.requests[0].url.endsWith('/auth/me'));
        assert.deepEqual(app.redirects, [`../${portal}/profile.html`]);
        assert.equal(JSON.parse(app.storage.get('user')).role, role);
    }
});

test('admin and dean may continue after role verification', async () => {
    for (const role of ['ROLE_ADMIN', 'ROLE_DEAN']) {
        const app = setup(role);
        assert.equal((await app.context.apiFetch('/users')).status, 200);
        assert.equal(app.requests.length, 2);
        assert.deepEqual(app.redirects, []);
        assert.equal(app.requests[0].options.headers.Authorization, 'Bearer token');
    }
});

test('missing, expired, unknown and unverifiable sessions cannot issue admin requests', async () => {
    for (const options of [{ token: null }, { status: 401 }, { offline: true }, {}]) {
        const app = setup('ROLE_UNKNOWN', options);
        assert.equal((await app.context.apiFetch('/users')).status, 403);
        assert(app.requests.length <= 1);
        assert.deepEqual(app.redirects, ['../index.html']);
    }
});
