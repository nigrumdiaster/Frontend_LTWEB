const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../js/notifications.js'), 'utf8');

function setup(fire) {
    const window = {};
    vm.runInNewContext(source, {window, Swal: {fire}});
    return window;
}

test('confirmation only approves an explicit confirm result', async () => {
    for (const result of [{isConfirmed: true}, {isConfirmed: false}, {isDismissed: true}]) {
        const app = setup(async options => {
            assert.equal(options.showCancelButton, true);
            assert.equal(options.focusCancel, true);
            return result;
        });
        assert.equal(await app.confirmAction('Xóa?'), result.isConfirmed === true);
    }
});

test('messages use text instead of interpreting server content as HTML', async () => {
    const text = '<img src=x onerror=alert(1)> Không thể lưu';
    const app = setup(async options => {
        assert.equal(options.text, text);
        assert.equal(options.html, undefined);
        assert.equal(options.icon, 'error');
        return {isConfirmed: true};
    });
    await app.showAlert(text);
});

test('a second dialog waits for the first dialog to close', async () => {
    const opened = [];
    let closeFirst;
    const app = setup(options => {
        opened.push(options.text);
        if (opened.length === 1) return new Promise(resolve => {closeFirst = resolve;});
        return Promise.resolve({isConfirmed: true});
    });
    const first = app.confirmAction('First');
    const second = app.showAlert('Second');
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(opened, ['First']);
    closeFirst({isConfirmed: false});
    assert.equal(await first, false);
    await second;
    assert.deepEqual(opened, ['First', 'Second']);
});
