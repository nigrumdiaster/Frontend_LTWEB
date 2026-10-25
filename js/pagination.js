// Pagination runs on the rows already rendered by each page.
(() => {
    const paginatedBodies = new WeakSet();

    function paginateTable(table) {
        if (table.dataset?.serverPagination === 'true') return;
        const body = table.tBodies[0];
        if (!body || paginatedBodies.has(body)) return;
        paginatedBodies.add(body);

        let page = 1;
        let pageSize = 10;
        const controls = document.createElement('div');
        controls.className = 'table-pagination';
        controls.setAttribute('role', 'group');
        controls.setAttribute('aria-label', 'Phân trang bảng');

        const sizeLabel = document.createElement('label');
        sizeLabel.className = 'table-pagination-size';
        sizeLabel.append('Số dòng mỗi trang: ');
        const sizeSelect = document.createElement('select');
        // Keep this compact control native rather than adding a search dropdown.
        sizeSelect.dataset.searchableSelect = 'true';
        [10, 20, 50, 100].forEach(size => sizeSelect.add(new Option(String(size), String(size))));
        sizeLabel.append(sizeSelect);

        const summary = document.createElement('span');
        summary.className = 'table-pagination-summary';
        summary.setAttribute('aria-live', 'polite');
        const navigation = document.createElement('nav');
        navigation.className = 'table-pagination-pages';
        navigation.setAttribute('aria-label', 'Chọn trang của bảng');
        controls.append(sizeLabel, summary, navigation);
        table.after(controls);

        function addButton(text, targetPage, disabled, current = false) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'table-pagination-button';
            button.textContent = text;
            button.disabled = disabled;
            if (current) button.setAttribute('aria-current', 'page');
            button.addEventListener('click', () => {
                page = targetPage;
                render();
                // The previous button is replaced on render; keep keyboard focus in navigation.
                navigation.querySelector('[aria-current="page"]')?.focus();
            });
            navigation.append(button);
        }

        function render() {
            if (table.dataset?.serverPagination === 'true') {
                controls.hidden = true;
                [...body.rows].forEach(row => { row.hidden = false; });
                return;
            }
            const rows = [...body.rows];
            // Loading, error and empty states use a single cell spanning the table.
            const dataRows = rows.filter(row => !(row.cells.length === 1 && row.cells[0].colSpan > 1));
            const total = dataRows.length;
            const totalPages = Math.max(1, Math.ceil(total / pageSize));
            page = Math.max(1, Math.min(page, totalPages));
            const start = (page - 1) * pageSize;
            rows.forEach(row => { row.hidden = false; });
            dataRows.forEach((row, index) => {
                row.hidden = index < start || index >= start + pageSize;
            });
            controls.hidden = total === 0;
            summary.textContent = total ? `${start + 1}–${Math.min(start + pageSize, total)} / ${total} dòng · Trang ${page}/${totalPages}` : '';
            navigation.replaceChildren();
            addButton('Trước', page - 1, page === 1);

            const first = Math.max(1, Math.min(page - 2, totalPages - 4));
            const last = Math.min(totalPages, first + 4);
            if (first > 1) {
                addButton('1', 1, false);
                if (first > 2) navigation.append('…');
            }
            for (let index = first; index <= last; index++) {
                addButton(String(index), index, false, index === page);
            }
            if (last < totalPages) {
                if (last < totalPages - 1) navigation.append('…');
                addButton(String(totalPages), totalPages, false);
            }
            addButton('Sau', page + 1, page === totalPages);
        }

        sizeSelect.addEventListener('change', () => {
            pageSize = Number(sizeSelect.value);
            page = 1;
            render();
        });
        // Page renderers replace their rows after search, reset, reload or CRUD actions.
        // Observe row changes only, so toggling hidden never triggers a render loop.
        new MutationObserver(() => {
            page = 1;
            render();
        }).observe(body, { childList: true });
        render();
    }

    function scan(root) {
        if (root.matches?.('table')) paginateTable(root);
        // Also handle a tbody inserted into an existing table.
        if (root.matches?.('tbody')) paginateTable(root.closest('table'));
        root.querySelectorAll?.('table').forEach(paginateTable);
    }

    function initialize() {
        scan(document);
        new MutationObserver(mutations => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) scan(node);
                });
            });
        }).observe(document.body, { childList: true, subtree: true });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize, { once: true });
    } else {
        initialize();
    }
})();
