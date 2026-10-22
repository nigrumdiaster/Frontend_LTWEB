// SweetAlert2 dialogs share a queue so concurrent requests do not replace each other.
(() => {
    let pending = Promise.resolve();
    const titles = {success: 'Thành công', error: 'Có lỗi xảy ra', warning: 'Lưu ý', info: 'Thông báo'};
    function enqueue(options) {
        const result = pending.then(() => Swal.fire({
            heightAuto: false,
            confirmButtonText: 'Đồng ý',
            cancelButtonText: 'Hủy',
            confirmButtonColor: '#0f172a',
            cancelButtonColor: '#64748b',
            ...options
        }));
        pending = result.catch(() => {});
        return result;
    }
    window.showAlert = (message, icon) => {
        const text = String(message ?? '');
        icon ||= /thất bại|không thể|lỗi|không chính xác/i.test(text) ? 'error'
            : /thành công|^✅|^Đã /i.test(text) ? 'success'
            : /vui lòng|chưa đăng nhập|hết hạn|tối đa|ít nhất|hợp lệ/i.test(text) ? 'warning' : 'info';
        return enqueue({titleText: titles[icon] || titles.info, text, icon});
    };
    window.confirmAction = async message => {
        const result = await enqueue({
            titleText: 'Xác nhận thao tác',
            text: String(message ?? ''),
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Xác nhận',
            focusCancel: true,
            allowOutsideClick: false
        });
        return result.isConfirmed === true;
    };
})();
