const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../js/config.js'), 'utf8');

function setup(handler) {
    const requests = [];
    const storage = new Map([['token', 'test-token'], ['user', '{}']]);
    const context = {
        URLSearchParams, Headers, Response,
        document: { readyState: 'loading', addEventListener() {} },
        window: { location: { pathname: '/student/results.html', href: '' } },
        localStorage: { getItem: key => storage.get(key), removeItem: key => storage.delete(key) },
        fetch: async (url, options) => {
            requests.push({ url, options });
            return handler(new URL(url), options);
        }
    };
    vm.runInNewContext(source, context);
    return { fetch: context.apiFetchAll, fetchOne: context.apiFetch, requests, storage, context };
}

function page(page, data, hasNext, total = 5) {
    return Response.json({ success: true, data,
        pagination: { page, size: 2, totalElements: total, totalPages: Math.ceil(total / 2), hasNext } });
}

test('collects all DB pages and preserves every query filter and authorization', async () => {
    const app = setup(url => {
        const current = Number(url.searchParams.get('page') || 0);
        return page(current, current === 0 ? [1, 2] : current === 1 ? [3, 4] : [5], current < 2);
    });
    const response = await app.fetch('/api/topics?periodId=17&keyword=đề%20tài&isAssigned=false', {
        headers: { 'X-Example': 'kept' }
    });
    const payload = await response.json();
    assert.deepEqual(payload.data, [1, 2, 3, 4, 5]);
    assert.equal(payload.pagination.allPagesLoaded, true);
    assert.equal(payload.pagination.loadedPages, 3);
    assert.equal(app.requests.length, 3);
    for (const request of app.requests) {
        const url = new URL(request.url);
        assert.equal(url.pathname, '/api/topics');
        assert.equal(url.searchParams.get('periodId'), '17');
        assert.equal(url.searchParams.get('keyword'), 'đề tài');
        assert.equal(url.searchParams.get('isAssigned'), 'false');
        assert.equal(request.options.headers.get('Authorization'), 'Bearer test-token');
        assert.equal(request.options.headers.get('X-Example'), 'kept');
    }
    assert.equal(new URL(app.requests[1].url).searchParams.get('page'), '1');
    assert.equal(new URL(app.requests[1].url).searchParams.get('limit'), '2');
});

test('explicit page returns one page only for server driven pagination', async () => {
    const app = setup(() => page(1, [3, 4], true));
    const payload = await (await app.fetch('/topics?page=1&limit=2')).json();
    assert.deepEqual(payload.data, [3, 4]);
    assert.equal(app.requests.length, 1);
});

test('limit=-1 explicitly requests all rows in a single HTTP call', async () => {
    const app = setup(() => page(0, [1, 2, 3, 4, 5], false));
    assert.deepEqual((await (await app.fetch('/departments?limit=-1')).json()).data, [1, 2, 3, 4, 5]);
    assert.equal(app.requests.length, 1);
    assert.equal(new URL(app.requests[0].url).searchParams.get('limit'), '-1');
});

test('failure of a later page never returns the first page as a complete success', async () => {
    const app = setup(url => url.searchParams.has('page')
        ? Response.json({ success: false, message: 'Forbidden' }, { status: 403 })
        : page(0, [1, 2], true));
    const response = await app.fetch('/results/period/10');
    assert.equal(response.status, 403);
    assert.equal((await response.json()).success, false);
});

test('expired token during page collection clears the session', async () => {
    const app = setup(url => url.searchParams.has('page')
        ? Response.json({ success: false }, { status: 401 }) : page(0, [1, 2], true));
    assert.equal((await app.fetch('/topics')).status, 401);
    assert.equal(app.storage.has('token'), false);
    assert.equal(app.context.window.location.href, '../index.html');
});

test('network errors and aborts while loading a later page propagate', async () => {
    for (const error of [new Error('offline'), new DOMException('Aborted', 'AbortError')]) {
        const signal = new AbortController().signal;
        const app = setup((url, options) => {
            assert.equal(options.signal, signal);
            if (url.searchParams.has('page')) throw error;
            return page(0, [1, 2], true);
        });
        await assert.rejects(app.fetch('/topics', { signal }), failure => failure === error);
    }
});

test('non advancing pagination metadata cannot create an infinite loop', async () => {
    const app = setup(() => page(0, [1, 2], true));
    await assert.rejects(app.fetch('/topics'), /Không tải đủ/);
    assert.equal(app.requests.length, 2);
});

test('detail responses, empty lists and mutations keep their existing response shape', async () => {
    for (const [body, options] of [
        [{ success: true, data: { id: 1 } }, {}],
        [{ success: true, data: [] }, {}],
        [{ success: true, data: [1], pagination: { hasNext: true } }, { method: 'POST' }]
    ]) {
        const app = setup(() => Response.json(body));
        assert.deepEqual(await (await app.fetch('/topics', options)).json(), body);
        assert.equal(app.requests.length, 1);
    }
});

test('regular apiFetch never preloads other pages', async () => {
    const app = setup(() => page(0, [1, 2], true));
    assert.deepEqual((await (await app.fetchOne('/topics')).json()).data, [1, 2]);
    assert.equal(app.requests.length, 1);
});

function installTable(app) {
    class Element {
        constructor(tag) { this.tagName = tag.toUpperCase(); this.dataset = {}; this.children = []; this.attributes = {}; this.events = {}; }
        setAttribute(key, value) { this.attributes[key] = value; }
        append(...children) { this.children.push(...children); }
        replaceChildren(...children) { this.children = children; }
        after(child) { this.controls = child; }
        addEventListener(name, callback) { this.events[name] = callback; }
        querySelector() {
            return this.children.find(child => child.attributes?.['aria-current'] === 'page')
                || this.children.map(child => child.querySelector?.()).find(Boolean);
        }
        focus() {}
    }
    const table = new Element('table');
    const body = new Element('tbody');
    body.closest = () => table;
    app.context.document.getElementById = () => body;
    app.context.document.createElement = tag => new Element(tag);
    return { table, body, getState: () => app.context.getServerPagination(body) };
}

test('table navigation fetches exactly the selected DB page with limit=10 and resets on filter change', async () => {
    const app = setup(url => {
        const current = Number(url.searchParams.get('page'));
        const data = Array.from({ length: current === 2 ? 3 : 10 }, (_, i) => current * 10 + i + 1);
        return Response.json({ success: true, data, pagination: { page: current, size: 10, totalElements: 23, totalPages: 3, hasNext: current < 2 } });
    });
    const fixture = installTable(app);
    let endpoint = '/users?role=ROLE_STUDENT';
    let loaded;
    const reload = async () => { loaded = await (await app.context.apiFetchTable(endpoint, {}, 'rows', reload)).json(); };
    await reload();
    assert.equal(loaded.data.length, 10);
    assert.equal(app.requests.length, 1);
    assert.equal(new URL(app.requests[0].url).searchParams.get('limit'), '10');
    const navigation = fixture.table.controls.children.find(child => child.className === 'table-pagination-pages');
    await navigation.children.find(button => button.textContent === 'Sau').events.click();
    assert.deepEqual(loaded.data, [11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
    assert.equal(app.requests.length, 2);
    endpoint = '/users?role=ROLE_LECTURER';
    await reload();
    assert.equal(fixture.getState().page, 0);
    assert.equal(new URL(app.requests.at(-1).url).searchParams.get('page'), '0');
});
