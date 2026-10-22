const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = name => fs.readFileSync(path.join(__dirname, '../js', name), 'utf8').replace(/\r\n/g, '\n');
const config = read('config.js');
const escapeFunction = config.slice(config.indexOf('function escapeText'), config.indexOf('\n}', config.indexOf('function escapeText')) + 2);
const source = read('admin/users.js');
const renderFunction = source.slice(source.indexOf('function renderUserTable'), source.indexOf('function showTableMessage'));

function render(canManageUsers) {
    const tbody = {innerHTML: ''};
    const context = {
        document: {getElementById: () => tbody},
        canManageUsers,
        userDeleteLabels: new Map(),
        formatRoleName: role => role,
        showTableMessage() {}
    };
    vm.createContext(context);
    vm.runInContext(escapeFunction + '\n' + renderFunction, context);
    context.renderUserTable([{id: 1, username: 'demo', fullName: '<img src=x onerror=alert(1)>',
        email: '"<script>unsafe</script>', role: 'ROLE_STUDENT', active: true}]);
    return tbody.innerHTML;
}

test('user data remains text in table HTML', () => {
    const html = render(true);
    assert.ok(!html.includes('<img'));
    assert.ok(!html.includes('<script>'));
    assert.ok(html.includes('&lt;img'));
});

test('read-only roles receive hidden mutation controls', () => {
    assert.match(render(false), /<button hidden onclick="editUser/);
    assert.match(render(false), /<button hidden onclick="deleteUser/);
    assert.doesNotMatch(render(true), /<button hidden/);
});
