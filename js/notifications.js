// SweetAlert2 dialogs share a queue so concurrent requests do not replace each other.
(() => {
    let pending = Promise.resolve();
    const titles = {success: 'Thành công', error: 'Có lỗi xảy ra', warning: 'Lưu ý', info: 'Thông báo'};
    function enqueue(options) {
        const result = pending.then(() => Swal.fire({
            heightAuto: false,
            confirmButtonText: 'Đồng ý',
            cancelButtonText: 'Hủy',
            buttonsStyling: false,
            customClass: {
                confirmButton: 'btn btn-primary',
                cancelButton: 'btn btn-secondary'
            },
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
        if (icon === 'success' || icon === 'info') {
            enqueue({
                toast: true,
                position: 'top-end',
                titleText: text,
                icon,
                showConfirmButton: false,
                showCloseButton: true,
                closeButtonAriaLabel: 'Đóng thông báo',
                timer: 3000,
                timerProgressBar: true
            });
            return Promise.resolve();
        }
        return enqueue({titleText: titles[icon] || titles.info, text, icon});
    };
    // Display success on the destination page without delaying navigation.
    window.queueToastAfterRedirect = message => {
        sessionStorage.setItem('portal-toast', JSON.stringify({message: String(message), icon: 'success'}));
    };
    function displayRedirectToast() {
        const stored = sessionStorage.getItem('portal-toast');
        if (!stored) return;
        sessionStorage.removeItem('portal-toast');
        try {
            const toast = JSON.parse(stored);
            if (typeof toast.message === 'string') window.showAlert(toast.message, 'success');
        } catch { /* Ignore invalid or expired notification state. */ }
    }
    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', displayRedirectToast, {once: true});
        } else displayRedirectToast();
    }
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
