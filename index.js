import { extension_settings } from '../../../extensions.js';
import { eventSource, event_types, saveSettingsDebounced } from '../../../../script.js';

const EXTENSION_NAME = 'global-prompt-injector';

const DEFAULT_SETTINGS = {
    prompts: [],
    // Each prompt: { id, name, text, position, role, enabled }
};

function getSettings() {
    if (!extension_settings[EXTENSION_NAME]) {
        extension_settings[EXTENSION_NAME] = structuredClone(DEFAULT_SETTINGS);
    }
    return extension_settings[EXTENSION_NAME];
}

function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function escHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// ---------------------------------------------------------------------------
// Injection
// CHAT_COMPLETION_PROMPT_READY fires after ST assembles the final ordered
// messages array from the CC preset. `chat` is the live array — splice into
// it to inject at an exact position. Positions are 0-based indices into the
// original assembled list (before our injections); we process highest-first
// so earlier inserts don't shift later ones.
// ---------------------------------------------------------------------------

eventSource.on(event_types.CHAT_COMPLETION_PROMPT_READY, ({ chat }) => {
    const settings = getSettings();
    const enabled = settings.prompts
        .filter(p => p.enabled && p.text?.trim())
        .sort((a, b) => b.position - a.position); // descending → no index shifting

    for (const p of enabled) {
        const pos = Math.max(0, Math.min(p.position, chat.length));
        chat.splice(pos, 0, {
            role: p.role || 'system',
            content: p.text.trim(),
        });
    }
});

// ---------------------------------------------------------------------------
// Drag helper — makes any element draggable by a handle
// ---------------------------------------------------------------------------

function makeDraggable($el, $handle) {
    $handle.css('cursor', 'grab');
    $handle.on('mousedown', function (e) {
        if ($(e.target).is('button, input, select, textarea')) return;

        const rect = $el[0].getBoundingClientRect();
        // Switch from transform-based centering to explicit coordinates
        $el.css({ transform: 'none', left: rect.left, top: rect.top });

        const startX = e.clientX - rect.left;
        const startY = e.clientY - rect.top;

        $handle.css('cursor', 'grabbing');

        $(document).on('mousemove.gpi-drag', function (e) {
            $el.css({
                left: Math.max(0, e.clientX - startX),
                top: Math.max(0, e.clientY - startY),
            });
        });

        $(document).on('mouseup.gpi-drag', function () {
            $(document).off('.gpi-drag');
            $handle.css('cursor', 'grab');
        });

        e.preventDefault();
    });
}

// ---------------------------------------------------------------------------
// Settings panel (injected into ST's Extensions sidebar)
// ---------------------------------------------------------------------------

const PANEL_HTML = `
<div id="gpi-panel" class="gpi-panel">
    <div class="inline-drawer">
        <div class="inline-drawer-toggle inline-drawer-header">
            <b>Global Prompt Injector</b>
            <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
        </div>
        <div class="inline-drawer-content">
            <div class="flex-container">
                <input id="gpi-open-btn" class="menu_button" type="button" value="Manage Global Prompts" />
            </div>
            <p id="gpi-status" class="gpi-status"></p>
        </div>
    </div>
</div>`;

function updateStatus() {
    const settings = getSettings();
    const total = settings.prompts.length;
    const active = settings.prompts.filter(p => p.enabled).length;
    $('#gpi-status').text(total ? `${active} of ${total} prompt${total !== 1 ? 's' : ''} active` : '');
}

// ---------------------------------------------------------------------------
// Manager modal
// ---------------------------------------------------------------------------

function renderList(settings) {
    if (!settings.prompts.length) {
        return '<p class="gpi-empty">No global prompts yet. Click <b>+ Add Prompt</b> to create one.</p>';
    }

    return settings.prompts.map(p => `
        <div class="gpi-item ${p.enabled ? '' : 'gpi-item--off'}" data-id="${escHtml(p.id)}">
            <div class="gpi-item-head">
                <label class="gpi-check-label">
                    <input type="checkbox" class="gpi-toggle" ${p.enabled ? 'checked' : ''} />
                    <span class="gpi-name">${escHtml(p.name)}</span>
                </label>
                <div class="gpi-badges">
                    <span class="gpi-badge gpi-role-${escHtml(p.role)}">${escHtml(p.role)}</span>
                    <span class="gpi-badge">pos&nbsp;${p.position}</span>
                </div>
            </div>
            <pre class="gpi-preview">${escHtml(p.text.slice(0, 160))}${p.text.length > 160 ? '…' : ''}</pre>
            <div class="gpi-item-actions">
                <button class="menu_button gpi-edit" data-id="${escHtml(p.id)}">Edit</button>
                <button class="menu_button gpi-delete" data-id="${escHtml(p.id)}">Delete</button>
            </div>
        </div>
    `).join('');
}

function refreshList() {
    const settings = getSettings();
    const $list = $('#gpi-list');
    if (!$list.length) return;

    $list.html(renderList(settings));

    $list.find('.gpi-toggle').off('change').on('change', function () {
        const id = $(this).closest('.gpi-item').data('id');
        const p = settings.prompts.find(x => x.id === id);
        if (p) { p.enabled = this.checked; saveSettingsDebounced(); refreshList(); updateStatus(); }
    });

    $list.find('.gpi-edit').off('click').on('click', function () {
        const id = $(this).data('id');
        openEditor(settings.prompts.find(x => x.id === id) ?? null);
    });

    $list.find('.gpi-delete').off('click').on('click', function () {
        const id = $(this).data('id');
        settings.prompts = settings.prompts.filter(x => x.id !== id);
        saveSettingsDebounced();
        refreshList();
        updateStatus();
    });

    updateStatus();
}

function openModal() {
    if ($('#gpi-modal').length) return;

    const $modal = $(`
        <div id="gpi-modal" role="dialog" aria-label="Global Prompt Injector">
            <div class="gpi-modal-head">
                <h3>&#9776;&nbsp;Global Prompt Injector</h3>
                <button id="gpi-close" class="menu_button" title="Close">&#x2715;</button>
            </div>
            <div id="gpi-modal-body">
                <div id="gpi-list"></div>
            </div>
            <div class="gpi-modal-foot">
                <button id="gpi-add" class="menu_button">+ Add Prompt</button>
            </div>
        </div>
    `);

    $('body').append($modal);
    makeDraggable($modal, $modal.find('.gpi-modal-head'));
    refreshList();

    $modal.find('#gpi-close').on('click', closeModal);
    $modal.find('#gpi-add').on('click', () => openEditor(null));
}

function closeModal() {
    $('#gpi-modal').remove();
}

// ---------------------------------------------------------------------------
// Editor modal (add / edit)
// ---------------------------------------------------------------------------

function openEditor(existing) {
    $('#gpi-editor').remove();

    const isEdit = !!existing;
    const data = existing ?? { id: uid(), name: '', text: '', position: 0, role: 'system', enabled: true };

    const $editor = $(`
        <div id="gpi-editor" role="dialog">
            <div class="gpi-modal-head">
                <h4>&#9776;&nbsp;${isEdit ? 'Edit Prompt' : 'Add Prompt'}</h4>
                <button class="gpi-editor-close menu_button" title="Close">&#x2715;</button>
            </div>
            <div class="gpi-editor-body">
                <label>
                    Name
                    <input id="gpi-e-name" class="text_pole" type="text"
                           placeholder="e.g. Always respond formally"
                           value="${escHtml(data.name)}" />
                </label>
                <label>
                    Prompt Text
                    <textarea id="gpi-e-text" class="text_pole" rows="7"
                              placeholder="Enter the prompt text that will be injected into every generation…">${escHtml(data.text)}</textarea>
                </label>
                <div class="gpi-editor-row">
                    <label class="gpi-label-narrow">
                        Insert at position
                        <input id="gpi-e-pos" class="text_pole" type="number" min="0" value="${data.position}" />
                        <small>0&nbsp;= top of the message list</small>
                    </label>
                    <label class="gpi-label-narrow">
                        Role
                        <select id="gpi-e-role" class="text_pole">
                            <option value="system"    ${data.role === 'system'    ? 'selected' : ''}>System</option>
                            <option value="user"      ${data.role === 'user'      ? 'selected' : ''}>User</option>
                            <option value="assistant" ${data.role === 'assistant' ? 'selected' : ''}>Assistant</option>
                        </select>
                    </label>
                </div>
            </div>
            <div class="gpi-modal-foot">
                <button id="gpi-e-save" class="menu_button">Save</button>
                <button class="gpi-editor-close menu_button">Cancel</button>
            </div>
        </div>
    `);

    $('body').append($editor);
    makeDraggable($editor, $editor.find('.gpi-modal-head'));
    $editor.find('#gpi-e-name').trigger('focus');

    $editor.find('.gpi-editor-close').on('click', () => $editor.remove());

    $editor.find('#gpi-e-save').on('click', () => {
        const name = $('#gpi-e-name').val().trim();
        const text = $('#gpi-e-text').val().trim();
        const position = Math.max(0, parseInt($('#gpi-e-pos').val(), 10) || 0);
        const role = $('#gpi-e-role').val();

        if (!name) { toastr.warning('Please enter a name.'); return; }
        if (!text) { toastr.warning('Please enter prompt text.'); return; }

        const settings = getSettings();

        if (isEdit) {
            const p = settings.prompts.find(x => x.id === data.id);
            if (p) Object.assign(p, { name, text, position, role });
        } else {
            settings.prompts.push({ ...data, name, text, position, role });
        }

        saveSettingsDebounced();
        $editor.remove();
        refreshList();
    });
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

jQuery(async () => {
    const $target = $('#extensions_settings2').length
        ? $('#extensions_settings2')
        : $('#extensions_settings').length
            ? $('#extensions_settings')
            : $('body');

    $target.append(PANEL_HTML);
    $('#gpi-open-btn').on('click', openModal);
    eventSource.on(event_types.SETTINGS_LOADED, updateStatus);
    updateStatus();
});
