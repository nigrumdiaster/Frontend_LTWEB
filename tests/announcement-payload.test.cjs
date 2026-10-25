const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../js/admin/announcements.js'), 'utf8');

test('everyone audience is displayed consistently in table and details', () => {
    const context = {document: {addEventListener() {}}};
    vm.createContext(context);
    vm.runInContext(source, context);
    for (const value of [null, undefined, '', 'ALL']) {
        assert.equal(context.roleLabel(value), 'Tất cả');
        assert.ok(context.targetRoleBadge(value).includes('Tất cả'));
    }
    assert.equal(context.roleLabel('ROLE_STUDENT'), 'Sinh viên');
});

for (const id of ['', '42']) {
    for (const sendEmail of [true, false]) {
        for (const audience of ['ALL', 'ROLE_STUDENT', 'ROLE_LECTURER', 'ROLE_ADMIN']) {
            test(`${id ? 'update' : 'create'} announcement for ${audience}, email=${sendEmail}`, async () => {
                let sent;
                const context = {
                    document: {
                        addEventListener() {},
                        getElementById: name => ({value: name === 'announcementId' ? id : name === 'announcementTargetRole' ? audience : 'Example', checked: name === 'announcementSendEmail' && sendEmail})
                    },
                    showAlert: async () => {},
                    console
                };
                vm.createContext(context);
                vm.runInContext(source, context);
                context.requestAnnouncementApi = async (url, options) => {sent = {url, options}; return {success: true};};
                context.closeAnnouncementModal = () => {};
                context.loadAnnouncements = async () => {};
                await context.saveAnnouncement({preventDefault() {}});
                assert.ok(sent, 'Request must be sent');
                assert.equal(JSON.parse(sent.options.body).targetRole, audience === 'ALL' ? null : audience);
                assert.equal(sent.options.method, id ? 'PUT' : 'POST');
                assert.equal(JSON.parse(sent.options.body).sendEmail, !id && sendEmail);
            });
        }
    }
}
