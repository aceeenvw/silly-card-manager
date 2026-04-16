// Card Manager v2.0 — Full-screen character card manager for SillyTavern
// Author: aceenvw

(function() {
'use strict';

// ══════════════════════════════════════════════════════════════
// CONSTANTS & STATE
// ══════════════════════════════════════════════════════════════

const MODULE_NAME = 'card-manager';
const EXTENSION_NAME = 'third-party/card-manager';

const TABS = Object.freeze({
    CARDS: 'cards',
    STATS: 'stats',
    SHOWCASE: 'showcase',
    IMPORT: 'import',
    EXPORT: 'export',
});

const FILTERS = Object.freeze({
    ALL: '__all__',
    ACTIVE: '__active__',
    FOLDER: '__folder__',
    IN_GROUPS: '__in_groups__',
    HAS_LOREBOOK: '__has_lorebook__',
    NEEDS_ATTENTION: '__needs_attention__',
    TAG: '__tag__',
    CREATOR: '__creator__',
});

const SORT_OPTIONS = Object.freeze([
    { value: 'name-asc', label: 'Name A→Z' },
    { value: 'name-desc', label: 'Name Z→A' },
    { value: 'tokens-desc', label: 'Tokens ↓' },
    { value: 'tokens-asc', label: 'Tokens ↑' },
    { value: 'creator-asc', label: 'Creator A→Z' },
]);

const PAGE_SIZE_OPTIONS = Object.freeze([10, 25, 50, 100]);

const DEFAULT_SETTINGS = Object.freeze({
    activeTab: TABS.CARDS,
    activeFilter: FILTERS.ALL,
    sort: 'name-asc',
    pageSize: 25,
    sidebarCollapsed: false,
    folders: [],
    folderAssignments: {},
    cardStyle: 'grid',
    showTokenCount: true,
    showCreator: true,
    showFolderBadge: true,
    showTagPills: true,
    confirmBeforeDelete: true,
    defaultExportFormat: 'png',
    defaultExportLorebook: false,
    defaultExportTemplate: '{name}',
    theme: 'default',
});

const state = {
    initialized: false,
    isOpen: false,
    isLoading: false,
    activeTab: TABS.CARDS,
    activeFilter: FILTERS.ALL,
    search: '',
    sort: 'name-asc',
    pageSize: 25,
    cardStyle: 'grid',
    showTokenCount: true,
    showCreator: true,
    showFolderBadge: true,
    showTagPills: true,
    confirmBeforeDelete: true,
    theme: 'default',
    currentPage: 1,
    characters: [],
    groups: [],
    selectedCards: new Set(),
    refreshToken: 0,
    sidebarCollapsed: false,
    isBulkOperating: false,
    exportInProgress: false,
    showcaseIndex: 0,
    showcaseTheme: 'default',
    showcaseCustomAccent: '#e0a030',
    showcaseCustomBg: '#1a1a1e',
    showcaseCustomFontHeading: 'system-ui',
    showcaseCustomFontName: 'system-ui',
    showcaseCustomFontBody: 'system-ui',
    showcaseCustomFontLabel: 'system-ui',
    showcaseControlsOpen: false,
    showcaseAvatarSize: 'medium',
    showcaseFontStep: 3,
    showcaseLayout: 'card',
    showcaseCleanMode: false,
    importFiles: [],
    importInProgress: false,
    importCancelled: false,
    importHistory: [],
    exportCancelled: false,
    exportHistory: [],
    exportFormat: 'png',
    exportIncludeLorebook: false,
    exportFilenameTemplate: '{name}',
    exportPreviewVisible: false,
    activeTagFilter: null,
    activeCreatorFilter: null,
    activeFolderId: null,
    dom: {},
};

// ══════════════════════════════════════════════════════════════
// ST API HELPERS
// ══════════════════════════════════════════════════════════════

// Cached per render cycle — avoids 19 separate lookups during a single re-render.
let _renderCtx = null;
function getContext() {
    return _renderCtx || window.SillyTavern?.getContext?.() || window.getContext?.() || {};
}

function getRequestHeaders() {
    const ctx = getContext();
    if (typeof ctx.getRequestHeaders === 'function') return ctx.getRequestHeaders();
    if (typeof window.getRequestHeaders === 'function') return window.getRequestHeaders();
    return { 'Content-Type': 'application/json', 'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]')?.content || '' };
}

// Robust confirmation popup - works across ST versions
async function cmConfirm(msg) {
    try {
        const ctx = getContext();
        if (ctx.Popup?.show?.confirm) {
            return !!(await ctx.Popup.show.confirm('Confirm', msg.replace(/\n/g, '<br>')));
        }
    } catch(e) { /* fall through */ }
    try {
        if (typeof callPopup === 'function') {
            return !!(await callPopup(msg, 'confirm'));
        }
    } catch(e) { /* fall through */ }
    return confirm(msg);
}

// Non-blocking prompt popup - replaces native prompt()
async function cmPrompt(msg, defaultValue = '') {
    try {
        const ctx = getContext();
        if (ctx.Popup?.show?.input) {
            const result = await ctx.Popup.show.input('Card Manager', msg, defaultValue);
            return (result === false || result === null) ? null : String(result);
        }
    } catch(e) { /* fall through */ }
    try {
        if (typeof callPopup === 'function') {
            const result = await callPopup(msg, 'input', defaultValue);
            return result || null;
        }
    } catch(e) { /* fall through */ }
    return prompt(msg, defaultValue);
}


function getExtensionSettings() {
    const ctx = getContext();
    if (!ctx.extensionSettings) ctx.extensionSettings = {};
    if (!ctx.extensionSettings[MODULE_NAME]) {
        ctx.extensionSettings[MODULE_NAME] = structuredClone(DEFAULT_SETTINGS);
    }
    return ctx.extensionSettings[MODULE_NAME];
}

function saveSettings() {
    const ctx = getContext();
    if (typeof ctx.saveSettingsDebounced === 'function') ctx.saveSettingsDebounced();
}

function persistState() {
    const settings = getExtensionSettings();
    settings.activeTab = state.activeTab;
    settings.activeFilter = state.activeFilter;
    settings.sort = state.sort;
    settings.pageSize = state.pageSize;
    settings.sidebarCollapsed = state.sidebarCollapsed;
    settings.activeFolderId = state.activeFolderId;
    settings.cardStyle = state.cardStyle;
    settings.showTokenCount = state.showTokenCount;
    settings.showCreator = state.showCreator;
    settings.showFolderBadge = state.showFolderBadge;
    settings.showTagPills = state.showTagPills;
    settings.confirmBeforeDelete = state.confirmBeforeDelete;
    settings.theme = state.theme;
    settings.defaultExportFormat = state.exportFormat;
    settings.showcaseTheme = state.showcaseTheme;
    settings.showcaseCustomAccent = state.showcaseCustomAccent;
    settings.showcaseCustomBg = state.showcaseCustomBg;
    settings.showcaseCustomFontHeading = state.showcaseCustomFontHeading;
    settings.showcaseCustomFontName = state.showcaseCustomFontName;
    settings.showcaseCustomFontBody = state.showcaseCustomFontBody;
    settings.showcaseCustomFontLabel = state.showcaseCustomFontLabel;
    settings.showcaseAvatarSize = state.showcaseAvatarSize;
    settings.showcaseFontStep = state.showcaseFontStep;
    settings.showcaseLayout = state.showcaseLayout;
    settings.defaultExportLorebook = state.exportIncludeLorebook;
    settings.defaultExportTemplate = state.exportFilenameTemplate;
    saveSettings();
}

function loadPersistedState() {
    const settings = getExtensionSettings();
    state.activeTab = settings.activeTab || DEFAULT_SETTINGS.activeTab;
    state.activeFilter = settings.activeFilter || DEFAULT_SETTINGS.activeFilter;
    state.sort = settings.sort || DEFAULT_SETTINGS.sort;
    state.cardStyle = settings.cardStyle || 'grid';
    state.showTokenCount = settings.showTokenCount !== false;
    state.showCreator = settings.showCreator !== false;
    state.showFolderBadge = settings.showFolderBadge !== false;
    state.showTagPills = settings.showTagPills !== false;
    state.confirmBeforeDelete = settings.confirmBeforeDelete !== false;
    state.theme = settings.theme || 'default';
    state.exportFormat = settings.defaultExportFormat || 'png';
    state.showcaseTheme = settings.showcaseTheme || 'default';
    state.showcaseCustomAccent = settings.showcaseCustomAccent || '#e0a030';
    state.showcaseCustomBg = settings.showcaseCustomBg || '#1a1a1e';
    state.showcaseCustomFontHeading = settings.showcaseCustomFontHeading || 'system-ui';
    state.showcaseCustomFontName = settings.showcaseCustomFontName || 'system-ui';
    state.showcaseCustomFontBody = settings.showcaseCustomFontBody || 'system-ui';
    state.showcaseCustomFontLabel = settings.showcaseCustomFontLabel || 'system-ui';
    state.showcaseAvatarSize = settings.showcaseAvatarSize || 'medium';
    state.showcaseFontStep = settings.showcaseFontStep ?? 3;
    state.showcaseLayout = settings.showcaseLayout || 'card';
    state.exportIncludeLorebook = settings.defaultExportLorebook || false;
    state.exportFilenameTemplate = settings.defaultExportTemplate || '{name}';
    state.pageSize = PAGE_SIZE_OPTIONS.includes(settings.pageSize) ? settings.pageSize : DEFAULT_SETTINGS.pageSize;
    state.sidebarCollapsed = !!settings.sidebarCollapsed;
    state.activeFolderId = settings.activeFolderId || null;
    if (!Array.isArray(settings.folders)) settings.folders = [];
    if (!settings.folderAssignments || typeof settings.folderAssignments !== 'object') settings.folderAssignments = {};
}

// ══════════════════════════════════════════════════════════════
// DOM CREATION — MODAL SHELL
// ══════════════════════════════════════════════════════════════

function ensureManagerDom() {
    if (state.dom.modal) return;

    const modal = document.createElement('div');
    modal.id = 'cm-modal';
    modal.className = 'cm-modal cm-hidden';
    modal.innerHTML = `
        <div class="cm-backdrop" data-cm-action="close"></div>
        <div class="cm-panel">
            <div class="cm-header">
                <div class="cm-header-left">
                    
                    <h2 class="cm-title">Card Manager <span class="cm-title-count" id="cm-title-count"></span></h2>
                </div>
                <div class="cm-tabs" id="cm-tabs">
                    <button class="cm-tab is-active" data-cm-tab="${TABS.CARDS}" aria-label="Cards tab">
                        <i class="fa-solid fa-address-card"></i> Cards
                    </button>
                    <button class="cm-tab" data-cm-tab="${TABS.STATS}" aria-label="Stats tab">
                        <i class="fa-solid fa-chart-pie"></i> Stats
                    </button>
                    
                    <button class="cm-tab" data-cm-tab="${TABS.SHOWCASE}" aria-label="Showcase tab">
                        <i class="fa-solid fa-id-card"></i> <span class="cm-tab-label">Showcase</span>
                    </button>
<button class="cm-tab" data-cm-tab="${TABS.IMPORT}" aria-label="Import tab">
                        <i class="fa-solid fa-file-import"></i> <span class="cm-tab-label">Import</span>
                    </button>
                    <button class="cm-tab" data-cm-tab="${TABS.EXPORT}" aria-label="Export tab">
                        <i class="fa-solid fa-file-zipper"></i> Export
                    </button>
                </div>
                <div class="cm-header-right">
                    <button class="cm-close menu_button" data-cm-action="close" title="Close (Esc)">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
            </div>
            <div class="cm-body">
                <button class="cm-sidebar-toggle" id="cm-sidebar-toggle">
                        <i class="fa-solid fa-filter"></i>
                        <span>Filters & Tags</span>
                        <i class="fa-solid fa-chevron-down"></i>
                    </button>
                    <aside class="cm-sidebar" id="cm-sidebar">
                    <div class="cm-sidebar-section">
                        <div class="cm-sidebar-label">Filters</div>
                        <div class="cm-filter-list" id="cm-filter-list"></div>
                    </div>
                    <div class="cm-sidebar-section">
                        <div class="cm-sidebar-label">Folders</div>
                        <div class="cm-folder-tree" id="cm-folder-tree">
                            <span class="cm-muted">Loading…</span>
                        </div>
                    </div>
                    <div class="cm-sidebar-section">
                        <div class="cm-sidebar-label">Tags</div>
                        <div class="cm-tag-tree" id="cm-tag-tree">
                            <span class="cm-muted">Loading…</span>
                        </div>
                    </div>
                    <div class="cm-sidebar-section">
                        <div class="cm-sidebar-label">Creators</div>
                        <div class="cm-creator-tree" id="cm-creator-tree">
                            <span class="cm-muted">Loading…</span>
                        </div>
                    </div>
                </aside>
                <main class="cm-main">
                    <div class="cm-toolbar" id="cm-toolbar">
                        <div class="cm-toolbar-left">
                            <input type="text" class="cm-search text_pole" id="cm-search" placeholder="Search characters…" autocomplete="off" />
                        </div>
                        <div class="cm-toolbar-right">
                            <select class="cm-sort text_pole" id="cm-sort"></select>
                            <select class="cm-page-size text_pole" id="cm-page-size"></select>
                            <button class="cm-refresh menu_button" id="cm-refresh" title="Refresh">
                                <i class="fa-solid fa-arrows-rotate"></i>
                            </button>
                        <button class="cm-random menu_button" id="cm-random" title="Random character"><i class="fa-solid fa-dice"></i></button>
                        </div>
                    </div>
                    <div class="cm-content" id="cm-content">
                        <div class="cm-loading cm-hidden" id="cm-loading">
                            <i class="fa-solid fa-spinner fa-spin"></i> Loading…
                        </div>
                        <div class="cm-empty cm-hidden" id="cm-empty"></div>
                        <div class="cm-grid" id="cm-grid"></div>
                    </div>
                    <div class="cm-pagination" id="cm-pagination">
                        <button class="cm-page-btn menu_button" id="cm-prev-page" disabled>
                            <i class="fa-solid fa-chevron-left"></i>
                        </button>
                        <span class="cm-page-label" id="cm-page-label">Page 1 of 1</span>
                        <button class="cm-page-btn menu_button" id="cm-next-page" disabled>
                            <i class="fa-solid fa-chevron-right"></i>
                        </button>
                    </div>
                    <div class="cm-select-bar cm-hidden" id="cm-select-bar">
                        <span id="cm-select-count">0 selected</span>
                        <button class="menu_button" id="cm-select-all" title="Select all on current page">
                            <i class="fa-solid fa-check-double"></i> Page
                        </button>
                        <button class="menu_button" id="cm-select-all-visible" title="Select all matching current filter">
                            <i class="fa-solid fa-layer-group"></i> All Visible
                        </button>
                        <button class="menu_button" id="cm-deselect-all">
                            <i class="fa-solid fa-xmark"></i> Clear
                        </button>
                        <button class="menu_button" id="cm-invert-selection" title="Invert selection">
                            <i class="fa-solid fa-right-left"></i> Invert
                        </button>
                        <div class="cm-select-spacer"></div>
                        <button class="menu_button" id="cm-bulk-tag" title="Tag selected cards">
                            <i class="fa-solid fa-tags"></i> Tag
                        </button>
                        <button class="menu_button" id="cm-bulk-folder" title="Move selected to folder">
                            <i class="fa-solid fa-folder-open"></i> Folder
                        </button>
                        <button class="menu_button" id="cm-bulk-export">
                            <i class="fa-solid fa-file-export"></i> Export
                        </button>
                        <button class="menu_button cm-danger" id="cm-bulk-delete">
                            <i class="fa-solid fa-trash-can"></i> Delete
                        </button>
                    </div>
                </main>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Cache DOM refs
    state.dom = {
        modal,
        panel: modal.querySelector('.cm-panel'),
            titleCount: modal.querySelector('#cm-title-count'),
        tabs: modal.querySelector('#cm-tabs'),
        sidebar: modal.querySelector('#cm-sidebar'),
        
        sidebarToggle: modal.querySelector('#cm-sidebar-toggle'),
        filterList: modal.querySelector('#cm-filter-list'),
        folderTree: modal.querySelector('#cm-folder-tree'),
        tagTree: modal.querySelector('#cm-tag-tree'),
        creatorTree: modal.querySelector('#cm-creator-tree'),
        toolbar: modal.querySelector('#cm-toolbar'),
        search: modal.querySelector('#cm-search'),
        sort: modal.querySelector('#cm-sort'),
        pageSize: modal.querySelector('#cm-page-size'),
        refresh: modal.querySelector('#cm-refresh'),
            random: modal.querySelector('#cm-random'),
        content: modal.querySelector('#cm-content'),
        loading: modal.querySelector('#cm-loading'),
        empty: modal.querySelector('#cm-empty'),
        grid: modal.querySelector('#cm-grid'),
        pagination: modal.querySelector('#cm-pagination'),
        prevPage: modal.querySelector('#cm-prev-page'),
        nextPage: modal.querySelector('#cm-next-page'),
        pageLabel: modal.querySelector('#cm-page-label'),
        selectBar: modal.querySelector('#cm-select-bar'),
        selectCount: modal.querySelector('#cm-select-count'),
        selectAll: modal.querySelector('#cm-select-all'),
        deselectAll: modal.querySelector('#cm-deselect-all'),
        invertSelection: modal.querySelector('#cm-invert-selection'),
        bulkExport: modal.querySelector('#cm-bulk-export'),
        selectAllVisible: modal.querySelector('#cm-select-all-visible'),
        bulkTag: modal.querySelector('#cm-bulk-tag'),
        bulkFolder: modal.querySelector('#cm-bulk-folder'),
        bulkDelete: modal.querySelector('#cm-bulk-delete'),
    };

    // Populate sort options
    SORT_OPTIONS.forEach(opt => {
        const o = document.createElement('option');
        o.value = opt.value;
        o.textContent = opt.label;
        state.dom.sort.appendChild(o);
    });

    // Populate page size options
    PAGE_SIZE_OPTIONS.forEach(size => {
        const o = document.createElement('option');
        o.value = size;
        o.textContent = `${size} / page`;
        state.dom.pageSize.appendChild(o);
    });

    bindEvents();
}

// ══════════════════════════════════════════════════════════════
// EVENT BINDING
// ══════════════════════════════════════════════════════════════

function bindEvents() {
    // Close
    state.dom.modal.addEventListener('click', (e) => {
        if (e.target.closest('[data-cm-action="close"]')) closeManager();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (!state.isOpen) return;
        if (e.key === 'Escape') {
            if (state.selectedCards.size > 0) { onDeselectAll(); e.preventDefault(); return; }
            closeManager();
            return;
        }
        // Showcase tab: ← → keyboard navigation
        if (state.activeTab === TABS.SHOWCASE && !e.target.closest('input, textarea, select')) {
            if (e.key === 'ArrowLeft')  { e.preventDefault(); state.showcaseIndex--; renderShowcaseTab(); return; }
            if (e.key === 'ArrowRight') { e.preventDefault(); state.showcaseIndex++; renderShowcaseTab(); return; }
        }
        if (state.activeTab !== TABS.CARDS) return;
        // Ctrl+A: select all visible
        if ((e.ctrlKey || e.metaKey) && e.key === 'a' && !e.target.closest('input, textarea')) {
            e.preventDefault();
            onSelectAllVisible();
        }
        // Delete: bulk delete
        if (e.key === 'Delete' && state.selectedCards.size > 0 && !e.target.closest('input, textarea')) {
            e.preventDefault();
            onBulkDelete();
        }
    });

    // Tabs
    state.dom.tabs.addEventListener('click', (e) => {
        const tab = e.target.closest('[data-cm-tab]');
        if (!tab) return;
        switchTab(tab.dataset.cmTab);
    });

    // Sidebar toggle
    state.dom.sidebarToggle.addEventListener('click', toggleSidebar);

    // Search
    state.dom.search.addEventListener('input', debounce(() => {
        state.search = state.dom.search.value;
        state.currentPage = 1;
        renderManager();
    }, 250));

    // Sort
    state.dom.sort.addEventListener('change', () => {
        state.sort = state.dom.sort.value;
        state.currentPage = 1;
        persistState();
        renderManager();
    });

    // Page size
    state.dom.pageSize.addEventListener('change', () => {
        state.pageSize = Number(state.dom.pageSize.value) || 25;
        state.currentPage = 1;
        persistState();
        renderManager();
    });

    // Refresh
    state.dom.refresh.addEventListener('click', () => refreshData(true));
        state.dom.random?.addEventListener('click', onRandomCharacter);

    // Pagination
    state.dom.prevPage.addEventListener('click', () => {
        if (state.currentPage > 1) {
            state.currentPage--;
            renderManager();
        }
    });
    state.dom.nextPage.addEventListener('click', () => {
        state.currentPage++;
        renderManager();
    });

    // Filter list (delegated)
    state.dom.filterList.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-cm-filter]');
        if (!btn) return;
        state.activeFilter = btn.dataset.cmFilter;
        state.activeTagFilter = null;
        state.activeCreatorFilter = null;
        state.currentPage = 1;
        persistState();
        renderManager();
    });

    // Folder tree (delegated)
    state.dom.folderTree.addEventListener('click', onFolderTreeClick);

    // Tag tree (delegated)
    state.dom.tagTree.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-cm-tree-action="tag"]');
        if (!btn) return;
        const tag = btn.dataset.cmTreeValue;
        if (state.activeFilter === FILTERS.TAG && state.activeTagFilter === tag) {
            state.activeFilter = FILTERS.ALL;
            state.activeTagFilter = null;
        } else {
            state.activeFilter = FILTERS.TAG;
            state.activeTagFilter = tag;
        }
        state.activeCreatorFilter = null;
        state.currentPage = 1;
        renderManager();
    });

    // Creator tree (delegated)
    state.dom.creatorTree.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-cm-tree-action="creator"]');
        if (!btn) return;
        const creator = btn.dataset.cmTreeValue;
        if (state.activeFilter === FILTERS.CREATOR && state.activeCreatorFilter === creator) {
            state.activeFilter = FILTERS.ALL;
            state.activeCreatorFilter = null;
        } else {
            state.activeFilter = FILTERS.CREATOR;
            state.activeCreatorFilter = creator;
        }
        state.activeTagFilter = null;
        state.currentPage = 1;
        renderManager();
    });

    // Grid click delegation
    state.dom.grid.addEventListener('click', onGridClick);

    // Select bar
    state.dom.selectAll?.addEventListener('click', onSelectAll);
    state.dom.selectAllVisible?.addEventListener('click', onSelectAllVisible);
    state.dom.deselectAll?.addEventListener('click', onDeselectAll);
    state.dom.invertSelection?.addEventListener('click', onInvertSelection);
    state.dom.bulkExport?.addEventListener('click', onBulkExport);
    state.dom.bulkTag?.addEventListener('click', (e) => openBulkTagEditor(e.currentTarget));
    state.dom.bulkFolder?.addEventListener('click', (e) => openBulkFolderPicker(e.currentTarget));
    state.dom.bulkDelete?.addEventListener('click', onBulkDelete);
}

// ══════════════════════════════════════════════════════════════
// OPEN / CLOSE
// ══════════════════════════════════════════════════════════════

function openManager() {
    ensureManagerDom();
    loadPersistedState();
    if (window.innerWidth <= 768 && state.pageSize > 15) state.pageSize = 15;
    state.isOpen = true;
    applyTheme(state.theme);
    state.dom.modal.classList.remove('cm-hidden');
    state.dom.search.value = state.search;
    state.dom.sort.value = state.sort;
    state.dom.pageSize.value = String(state.pageSize);
    syncSidebarState();
    syncTabState();
    refreshData(true);
}

function closeManager() {
    if (!state.dom.modal) return;
    state.isOpen = false;
    state.selectedCards.clear();
    state.activeTagFilter = null;
    state.activeCreatorFilter = null;
    state.exportPreviewVisible = false;
    state.dom.modal.classList.add('cm-hidden');
    state.dom.grid?.scrollTo?.(0, 0);
    persistState();
}

// ══════════════════════════════════════════════════════════════
// TABS
// ══════════════════════════════════════════════════════════════

function switchTab(tabId) {
    if (!Object.values(TABS).includes(tabId)) return;
    state.activeTab = tabId;
    persistState();
    syncTabState();
    renderManager();
}

function syncTabState() {
    if (!state.dom.tabs) return;
    state.dom.tabs.querySelectorAll('.cm-tab').forEach(btn => {
        btn.classList.toggle('is-active', btn.dataset.cmTab === state.activeTab);
    });

    // Show/hide toolbar + pagination based on tab
    const isCards = state.activeTab === TABS.CARDS;
    state.dom.toolbar?.classList.toggle('cm-hidden', !isCards);
    state.dom.pagination?.classList.toggle('cm-hidden', !isCards);
    state.dom.selectBar?.classList.toggle('cm-hidden', !isCards || state.selectedCards.size === 0);

    // Sidebar visibility delegated to syncSidebarState
    syncSidebarState();
}

// ══════════════════════════════════════════════════════════════
// SIDEBAR
// ══════════════════════════════════════════════════════════════

function toggleSidebar() {
    state.sidebarCollapsed = !state.sidebarCollapsed;
    persistState();
    syncSidebarState();
}

function syncSidebarState() {
    const isCards = state.activeTab === TABS.CARDS;
    state.dom.sidebar?.classList.toggle('cm-hidden', !isCards);
    state.dom.sidebar?.classList.toggle('is-collapsed', state.sidebarCollapsed);
    state.dom.sidebarToggle?.classList.toggle('is-open', !state.sidebarCollapsed);
    state.dom.sidebarToggle?.classList.toggle('cm-hidden', !isCards);
}

// ══════════════════════════════════════════════════════════════
// DATA REFRESH
// ══════════════════════════════════════════════════════════════

async function refreshData(showLoader = false) {
    const token = ++state.refreshToken;
    if (showLoader) {
        setLoading(true);
    }

    try {
        const ctx = getContext();
        const rawChars = Array.isArray(ctx.characters) ? ctx.characters : [];
        state.groups = Array.isArray(ctx.groups) ? ctx.groups : [];

        // Skip re-normalization if character list unchanged
        const charHash = rawChars.length + '|' + (rawChars[0]?.avatar || '') + '|' + (rawChars[rawChars.length - 1]?.avatar || '');
        if (state._charHash === charHash && state.characters.length > 0) {
            renderManager();
            return;
        }
        state._charHash = charHash;

        // Normalize with fast token estimate first
        state.characters = rawChars.map((c, idx) => normalizeCharacter(c, idx, ctx));

        if (token !== state.refreshToken) return;
        state.selectedCards.clear();
        renderManager();


    } catch (err) {
        console.error(`[${MODULE_NAME}] Failed to refresh data`, err);
        setEmpty('Failed to load character data.');
    } finally {
        if (showLoader) setLoading(false);
        scheduleAccurateTokenCount();
    }
}

function scheduleAccurateTokenCount() {
    if (state._tokenCountScheduled) return;
    state._tokenCountScheduled = true;
    let idx = 0;
    const BATCH = 5;
    function processBatch() {
        const ctx = getContext();
        if (!ctx || typeof ctx.getTokenCount !== 'function' || !state.isOpen) {
            state._tokenCountScheduled = false;
            return;
        }
        const end = Math.min(idx + BATCH, state.characters.length);
        let changed = false;
        for (let i = idx; i < end; i++) {
            const c = state.characters[i];
            const fields = { description: c.description, personality: c.personality, firstMes: c.firstMes, scenario: c.scenario };
            let total = 0;
            for (const [key, text] of Object.entries(fields)) {
                if (!text) continue;
                const accurate = countTokens(text, ctx);
                if (c.fieldTokens[key] !== accurate) { c.fieldTokens[key] = accurate; changed = true; }
                total += accurate;
            }
            if (c.totalTokens !== total) { c.totalTokens = total; changed = true; }
        }
        idx = end;
        if (idx < state.characters.length) {
            setTimeout(processBatch, 50);
        } else {
            state._tokenCountScheduled = false;
            if (changed && state.isOpen) renderManager();
        }
    }
    setTimeout(processBatch, 500);
}


// ══════════════════════════════════════════════════════════════
// CHARACTER NORMALIZATION & TOKEN COUNTING
// ══════════════════════════════════════════════════════════════

function normalizeCharacter(c, idx, ctx) {
    const name = c.name || 'Unknown';
    const avatar = c.avatar || '';
    const creator = c.data?.creator || '';
    const description = c.data?.description || c.description || '';
    const personality = c.data?.personality || c.personality || '';
    const firstMes = c.data?.first_mes || c.first_mes || '';
    const mesExample = c.data?.mes_example || c.mes_example || '';
    const scenario = c.data?.scenario || c.scenario || '';
    const creatorNotes = c.data?.creator_notes || '';

    const fields = { description, personality, firstMes, mesExample, scenario, creatorNotes };
    const fieldTokens = {};
    let totalTokens = 0;
    for (const [key, text] of Object.entries(fields)) {
        const t = countTokensFast(text);
        fieldTokens[key] = t;
        totalTokens += t;
    }

    const hasLorebook = !!(c.data?.extensions?.world || (c.data?.character_book?.entries && Object.keys(c.data.character_book.entries).length > 0));
    const hasAvatar = !!avatar && avatar !== 'none';
    const tags = getTagsForCharacter(c, ctx);
    const inGroups = state.groups.some(g => g.members?.includes(avatar));

    return {
        index: idx,
        name,
        avatar,
        creator,
        description,
        personality,
        firstMes,
        scenario,
        totalTokens,
        fieldTokens,
        hasLorebook,
        hasAvatar,
        tags,
        inGroups,
        emptyDescription: !description.trim(),
        emptyFirstMessage: !firstMes.trim(),
        noPersonality: !personality.trim(),
        raw: c,
    };
}

function countTokensFast(text) {
    if (!text) return 0;
    return Math.ceil(text.length / 3.5);
}

function countTokens(text, ctx) {
    if (!text) return 0;
    try {
        if (typeof ctx?.getTokenCount === 'function') return ctx.getTokenCount(text);
    } catch (_) {}
    return countTokensFast(text);
}

function getTagsForCharacter(c, ctx) {
    try {
        return getTagObjectsForAvatar(c.avatar, ctx).map(t => t.name);
    } catch (_) {}
    return [];
}

// Returns full tag objects {id, name, color, color2} for an avatar
function getTagObjectsForAvatar(avatar, ctx) {
    if (!avatar) return [];
    try {
        const tagMap = ctx.tagMap || window.SillyTavern?.getContext?.()?.tagMap;
        const tags = ctx.tags || window.SillyTavern?.getContext?.()?.tags;
        if (!tagMap || !tags) return [];

        // ST tag_map: { 'avatar.png': ['tag-id-1', ...] } OR could be inverted
        const tagIds = tagMap[avatar];
        if (Array.isArray(tagIds)) {
            const tagList = Array.isArray(tags) ? tags : Object.values(tags);
            return tagIds
                .map(id => tagList.find(t => t.id === id || String(t.id) === String(id)))
                .filter(Boolean);
        }

        // Fallback: tagMap might be { tagId: {name, list:[avatars]} } (older ST)
        if (typeof tagMap === 'object') {
            const results = [];
            for (const [key, val] of Object.entries(tagMap)) {
                if (val?.name && Array.isArray(val.list) && val.list.includes(avatar)) {
                    results.push({ id: key, name: val.name, color: val.color || '', color2: val.color2 || '' });
                }
            }
            if (results.length) return results;
        }

        // Fallback: tags array with character_ids
        if (Array.isArray(tags)) {
            return tags
                .filter(t => Array.isArray(t.character_ids) && t.character_ids.includes(String(avatar)))
                .map(t => ({ id: t.id, name: t.name, color: t.color || '', color2: t.color2 || '' }))
                .filter(t => t.name);
        }
    } catch (_) {}
    return [];
}

// Get all known tags from ST context
function getAllTags() {
    try {
        const ctx = getContext();
        const tags = ctx.tags || [];
        return (Array.isArray(tags) ? tags : Object.values(tags))
            .filter(t => t && t.name)
            .map(t => ({ id: t.id, name: t.name, color: t.color || '', color2: t.color2 || '' }));
    } catch (_) {}
    return [];
}

// ── TAG MUTATION ──

function getSTTagMap() {
    try {
        const ctx = getContext();
        // Direct reference to the live tag_map object
        if (ctx.tagMap && typeof ctx.tagMap === 'object') return ctx.tagMap;
    } catch (_) {}
    return null;
}

function saveSTSettings() {
    try {
        const ctx = getContext();
        if (typeof ctx.saveSettingsDebounced === 'function') { ctx.saveSettingsDebounced(); return; }
        if (typeof window.saveSettingsDebounced === 'function') { window.saveSettingsDebounced(); return; }
    } catch (_) {}
}

function addTagToCharacter(avatar, tagId) {
    const map = getSTTagMap();
    if (!map || !avatar || !tagId) return false;
    if (!Array.isArray(map[avatar])) map[avatar] = [];
    if (!map[avatar].includes(tagId)) {
        map[avatar].push(tagId);
        saveSTSettings();
        return true;
    }
    return false;
}

function removeTagFromCharacter(avatar, tagId) {
    const map = getSTTagMap();
    if (!map || !avatar || !tagId || !Array.isArray(map[avatar])) return false;
    const idx = map[avatar].indexOf(tagId);
    if (idx !== -1) {
        map[avatar].splice(idx, 1);
        if (map[avatar].length === 0) delete map[avatar];
        saveSTSettings();
        return true;
    }
    return false;
}

function createNewTag(name) {
    if (!name || !name.trim()) return null;
    try {
        const ctx = getContext();
        const tags = ctx.tags;
        if (!Array.isArray(tags)) return null;
        const trimmed = name.trim();
        // Check duplicate
        const existing = tags.find(t => t.name?.toLowerCase() === trimmed.toLowerCase());
        if (existing) return existing;
        const newTag = {
            id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            name: trimmed,
            color: '',
            color2: '',
            character_ids: [],
            group_ids: [],
        };
        tags.push(newTag);
        saveSTSettings();
        return newTag;
    } catch (_) {}
    return null;
}

const _avatarTimestamps = {};
function getAvatarUrl(avatar) {
    if (!avatar || avatar === 'none') return '';
    if (!_avatarTimestamps[avatar]) _avatarTimestamps[avatar] = Date.now();
    return `/thumbnail?type=avatar&file=${encodeURIComponent(avatar)}&timestamp=${_avatarTimestamps[avatar]}`;
}
function invalidateAvatarCache(avatar) {
    if (avatar) delete _avatarTimestamps[avatar];
    else Object.keys(_avatarTimestamps).forEach(k => delete _avatarTimestamps[k]);
}

// ══════════════════════════════════════════════════════════════
// VISIBLE CARDS (search + sort + filter)
// ══════════════════════════════════════════════════════════════

function getVisibleCards() {
    const searchTerm = state.search.trim().toLowerCase();
    const ctx = getContext();

    return state.characters
        .filter(c => {
            // Smart filter
            switch (state.activeFilter) {
                case FILTERS.ACTIVE:
                    if (ctx.characterId == null) return false;
                    { const activeChar = ctx.characters?.[ctx.characterId]; if (!activeChar) return false; return c.avatar === activeChar.avatar; }
                case FILTERS.IN_GROUPS:
                    return c.inGroups;
                case FILTERS.HAS_LOREBOOK:
                    return c.hasLorebook;
                case FILTERS.NEEDS_ATTENTION:
                    return !c.hasAvatar || c.emptyDescription || c.emptyFirstMessage || c.noPersonality;
                case FILTERS.FOLDER:
                    {
                        const settings = getExtensionSettings();
                        const assignments = settings.folderAssignments || {};
                        if (state.activeFolderId === '__no_folder__') return !assignments[c.avatar];
                        return assignments[c.avatar] === state.activeFolderId;
                    }
                case FILTERS.TAG:
                    return state.activeTagFilter && c.tags.includes(state.activeTagFilter);
                case FILTERS.CREATOR:
                    return state.activeCreatorFilter && (c.creator || '') === state.activeCreatorFilter;
                case FILTERS.ALL:
                default:
                    return true;
            }
        })
        .filter(c => {
            if (!searchTerm) return true;
            const haystack = [c.name, c.creator, ...c.tags].join(' ').toLowerCase();
            return haystack.includes(searchTerm);
        })
        .sort((a, b) => {
            switch (state.sort) {
                case 'name-desc': return b.name.localeCompare(a.name);
                case 'tokens-desc': return b.totalTokens - a.totalTokens;
                case 'tokens-asc': return a.totalTokens - b.totalTokens;
                case 'creator-asc': return (a.creator || 'zzz').localeCompare(b.creator || 'zzz');
                case 'name-asc':
                default: return a.name.localeCompare(b.name);
            }
        });
}

function getPageSlice(visible) {
    const total = visible.length;
    const totalPages = Math.max(1, Math.ceil(total / state.pageSize));
    state.currentPage = Math.min(Math.max(1, state.currentPage), totalPages);
    const start = (state.currentPage - 1) * state.pageSize;
    return { items: visible.slice(start, start + state.pageSize), totalPages, total };
}

// ══════════════════════════════════════════════════════════════
// RENDER ORCHESTRATOR
// ══════════════════════════════════════════════════════════════


function onRandomCharacter() {
    const visible = getVisibleCards();
    if (visible.length === 0) return;
    const pick = visible[Math.floor(Math.random() * visible.length)];
    // Navigate to the page containing this card
    const idx = visible.indexOf(pick);
    const targetPage = Math.floor(idx / state.pageSize) + 1;
    state.currentPage = targetPage;
    renderManager();
    // Highlight the card briefly
    requestAnimationFrame(() => {
        const cardEl = state.dom.grid?.querySelector(`[data-char-index="${pick.index}"]`);
        if (cardEl) {
            cardEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            cardEl.classList.add('cm-highlight');
            setTimeout(() => cardEl.classList.remove('cm-highlight'), 1500);
        }
    });
}

let _renderRafId = null;
function renderManager() {
    if (_renderRafId) return;
    _renderRafId = requestAnimationFrame(() => {
        _renderRafId = null;
        _renderManagerImpl();
    });
}

function _renderManagerImpl() {
    if (!state.dom.modal || !state.isOpen) return;
    // Cache context for the entire render cycle
    _renderCtx = window.SillyTavern?.getContext?.() || window.getContext?.() || {};
    try {
    syncTabState();
    renderFilters();

    switch (state.activeTab) {
        case TABS.CARDS:
            renderCardsTab();
            break;
        case TABS.STATS:
            renderStatsTab();
            break;
        case TABS.SHOWCASE:
            renderShowcaseTab();
            break;
        case TABS.IMPORT:
            renderImportTab();
            break;
        case TABS.EXPORT:
            renderExportTab();
            break;
    }
    } finally { _renderCtx = null; }
}


// ══════════════════════════════════════════════════════════════
// SETTINGS TAB
// ══════════════════════════════════════════════════════════════

function applyTheme(themeName) {
    const modal = state.dom.modal;
    if (!modal) return;
    modal.classList.remove('cm-theme-default', 'cm-theme-compact', 'cm-theme-cozy');
    modal.classList.add('cm-theme-' + (themeName || 'default'));
}


// ══════════════════════════════════════════════════════════════
// FILTER SIDEBAR RENDER
// ══════════════════════════════════════════════════════════════

function renderFilters() {
    const list = state.dom.filterList;
    if (!list) return;
    const hash = state.characters.length + '|' + state.activeFilter + '|' + (state.activeTagFilter || '') + '|' + (state.activeCreatorFilter || '');
    if (state._filterHash === hash) return;
    state._filterHash = hash;
    list.innerHTML = '';

    const chars = state.characters;
    const ctx = getContext();
    const lorebookCount = chars.filter(c => c.hasLorebook).length;
    const groupCount = chars.filter(c => c.inGroups).length;
    const attentionCount = chars.filter(c => !c.hasAvatar || c.emptyDescription || c.emptyFirstMessage || c.noPersonality).length;
    const activeCount = ctx.characterId != null ? 1 : 0;

    const filters = [
        { id: FILTERS.ALL, icon: 'fa-layer-group', label: 'All Characters', count: chars.length },
        { id: FILTERS.ACTIVE, icon: 'fa-bolt', label: 'Active', count: activeCount },
        { id: FILTERS.IN_GROUPS, icon: 'fa-users', label: 'In Groups', count: groupCount },
        { id: FILTERS.HAS_LOREBOOK, icon: 'fa-book-atlas', label: 'Has Lorebook', count: lorebookCount },
        { id: FILTERS.NEEDS_ATTENTION, icon: 'fa-triangle-exclamation', label: 'Needs Attention', count: attentionCount },
    ];

    filters.forEach(f => {
        const btn = document.createElement('button');
        btn.className = 'cm-filter-btn';
        btn.dataset.cmFilter = f.id;
        if (state.activeFilter === f.id) btn.classList.add('is-active');
        btn.innerHTML = `
            <i class="fa-solid ${f.icon}"></i>
            <span class="cm-filter-label">${f.label}</span>
            <span class="cm-filter-count">${f.count}</span>
        `;
        list.appendChild(btn);
    });

    renderFolderTree();
    renderTagTree();
    renderCreatorTree();
}

// ══════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════
// FOLDER SYSTEM
// ══════════════════════════════════════════════════════════════

function getFolders() {
    return getExtensionSettings().folders || [];
}

function getFolderById(id) {
    return getFolders().find(f => f.id === id) || null;
}

function getFolderAssignments() {
    return getExtensionSettings().folderAssignments || {};
}

function getCardFolderId(avatar) {
    return getFolderAssignments()[avatar] || null;
}

function getCardFolderName(avatar) {
    const fid = getCardFolderId(avatar);
    if (!fid) return null;
    const folder = getFolderById(fid);
    return folder ? folder.name : null;
}

function getSortedFolders(parentId) {
    return getFolders()
        .filter(f => (f.parentId || null) === (parentId || null))
        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0) || a.name.localeCompare(b.name));
}

function getFolderSubtreeIds(folderId) {
    const ids = new Set();
    if (!folderId) return ids;
    const queue = [folderId];
    while (queue.length) {
        const cur = queue.shift();
        if (ids.has(cur)) continue;
        ids.add(cur);
        getFolders().filter(f => f.parentId === cur).forEach(f => queue.push(f.id));
    }
    return ids;
}

function countCardsInFolder(folderId) {
    const subtree = getFolderSubtreeIds(folderId);
    const assignments = getFolderAssignments();
    return state.characters.filter(c => subtree.has(assignments[c.avatar])).length;
}

function countUnfolderedCards() {
    const assignments = getFolderAssignments();
    return state.characters.filter(c => !assignments[c.avatar]).length;
}

function createFolder(name, parentId) {
    if (!name || !name.trim()) return null;
    const settings = getExtensionSettings();
    if (!Array.isArray(settings.folders)) settings.folders = [];
    const folder = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        name: name.trim(),
        parentId: parentId || null,
        collapsed: false,
        sortOrder: Date.now(),
    };
    settings.folders.push(folder);
    saveSettings();
    return folder;
}

function renameFolder(folderId, newName) {
    if (!newName || !newName.trim()) return;
    const folder = getFolderById(folderId);
    if (!folder) return;
    folder.name = newName.trim();
    saveSettings();
}

function deleteFolder(folderId) {
    const settings = getExtensionSettings();
    const folder = getFolderById(folderId);
    if (!folder) return;
    // Reassign children to parent
    settings.folders.forEach(f => {
        if (f.parentId === folderId) f.parentId = folder.parentId || null;
    });
    // Unassign cards in this folder
    const assignments = settings.folderAssignments || {};
    for (const [avatar, fid] of Object.entries(assignments)) {
        if (fid === folderId) delete assignments[avatar];
    }
    // Remove folder
    settings.folders = settings.folders.filter(f => f.id !== folderId);
    // Reset active if was this folder
    if (state.activeFolderId === folderId) {
        state.activeFolderId = null;
        state.activeFilter = FILTERS.ALL;
    }
    saveSettings();
}

function toggleFolderCollapsed(folderId) {
    const folder = getFolderById(folderId);
    if (folder) {
        folder.collapsed = !folder.collapsed;
        saveSettings();
    }
}

function assignCardToFolder(avatar, folderId) {
    if (!avatar) return;
    const settings = getExtensionSettings();
    if (!settings.folderAssignments) settings.folderAssignments = {};
    if (folderId) {
        settings.folderAssignments[avatar] = folderId;
    } else {
        delete settings.folderAssignments[avatar];
    }
    saveSettings();
}

// ── FOLDER TREE RENDER ──

function renderFolderTree() {
    const container = state.dom.folderTree;
    if (!container) return;
    container.innerHTML = '';

    const folders = getFolders();
    const assignments = getFolderAssignments();
    const totalAssigned = state.characters.filter(c => assignments[c.avatar]).length;

    // Virtual: All Characters (reset folder filter)
    container.appendChild(createFolderVirtualRow('__all_folders__', 'All', 'fa-layer-group', state.characters.length, state.activeFilter !== FILTERS.FOLDER));
    container.appendChild(createFolderVirtualRow('__no_folder__', 'No Folder', 'fa-inbox', countUnfolderedCards(), state.activeFilter === FILTERS.FOLDER && state.activeFolderId === '__no_folder__'));

    // Real folders (top-level)
    getSortedFolders(null).forEach(f => container.appendChild(createFolderBranch(f, 0)));

    // Add folder button
    const addBtn = document.createElement('button');
    addBtn.className = 'cm-folder-add-btn';
    addBtn.innerHTML = '<i class="fa-solid fa-folder-plus"></i> New Folder';
    addBtn.addEventListener('click', async () => {
        const name = await cmPrompt('Folder name:');
        if (name) { createFolder(name, null); renderManager(); }
    });
    container.appendChild(addBtn);
}

function createFolderVirtualRow(id, label, icon, count, isActive) {
    const row = document.createElement('button');
    row.className = 'cm-folder-row cm-folder-virtual';
    if (isActive) row.classList.add('is-active');
    row.dataset.cmFolderAction = 'select';
    row.dataset.cmFolderId = id;
    row.innerHTML = `
        <i class="fa-solid ${icon}"></i>
        <span class="cm-folder-name">${escapeHtml(label)}</span>
        <span class="cm-folder-count">${count}</span>
    `;
    // Drop target for "No Folder"
    if (id === '__no_folder__') {
        row.addEventListener('dragover', onFolderDragOver);
        row.addEventListener('dragleave', onFolderDragLeave);
        row.addEventListener('drop', (e) => onFolderDrop(e, null));
    }
    return row;
}

function createFolderBranch(folder, depth) {
    const fragment = document.createDocumentFragment();
    const row = document.createElement('div');
    row.className = 'cm-folder-row';
    row.style.paddingLeft = `${8 + depth * 14}px`;
    if (state.activeFilter === FILTERS.FOLDER && state.activeFolderId === folder.id) row.classList.add('is-active');
    row.dataset.cmFolderId = folder.id;

    const children = getSortedFolders(folder.id);
    const hasChildren = children.length > 0;

    // Toggle
    const toggle = document.createElement('button');
    toggle.className = 'cm-folder-toggle';
    toggle.dataset.cmFolderAction = 'toggle';
    toggle.dataset.cmFolderId = folder.id;
    toggle.innerHTML = hasChildren
        ? `<i class="fa-solid ${folder.collapsed ? 'fa-chevron-right' : 'fa-chevron-down'}"></i>`
        : '<i class="fa-solid fa-minus" style="opacity:0.2"></i>';

    // Select button
    const selectBtn = document.createElement('button');
    selectBtn.className = 'cm-folder-select';
    selectBtn.dataset.cmFolderAction = 'select';
    selectBtn.dataset.cmFolderId = folder.id;
    selectBtn.innerHTML = `
        <i class="fa-solid ${folder.collapsed ? 'fa-folder' : 'fa-folder-open'}"></i>
        <span class="cm-folder-name">${escapeHtml(folder.name)}</span>
        <span class="cm-folder-count">${countCardsInFolder(folder.id)}</span>
    `;

    // Tools
    const tools = document.createElement('div');
    tools.className = 'cm-folder-tools';
    tools.innerHTML = `
        <button title="New subfolder" data-cm-folder-action="create-sub" data-cm-folder-id="${folder.id}"><i class="fa-solid fa-folder-plus"></i></button>
        <button title="Rename" data-cm-folder-action="rename" data-cm-folder-id="${folder.id}"><i class="fa-solid fa-pencil"></i></button>
        <button title="Delete" data-cm-folder-action="delete" data-cm-folder-id="${folder.id}"><i class="fa-solid fa-trash-can"></i></button>
    `;

    row.append(toggle, selectBtn, tools);

    // Drop target
    row.addEventListener('dragover', onFolderDragOver);
    row.addEventListener('dragleave', onFolderDragLeave);
    row.addEventListener('drop', (e) => onFolderDrop(e, folder.id));

    fragment.appendChild(row);

    // Children
    if (hasChildren && !folder.collapsed) {
        children.forEach(child => fragment.appendChild(createFolderBranch(child, depth + 1)));
    }

    return fragment;
}

// ── FOLDER TREE EVENT HANDLERS ──

async function onFolderTreeClick(e) {
    const btn = e.target.closest('[data-cm-folder-action]');
    if (!btn) return;
    const action = btn.dataset.cmFolderAction;
    const folderId = btn.dataset.cmFolderId;

    switch (action) {
        case 'select':
            if (folderId === '__all_folders__') {
                state.activeFilter = FILTERS.ALL;
                state.activeFolderId = null;
            } else {
                state.activeFilter = FILTERS.FOLDER;
                state.activeFolderId = folderId;
            }
            state.currentPage = 1;
            persistState();
            renderManager();
            break;
        case 'toggle':
            toggleFolderCollapsed(folderId);
            renderManager();
            break;
        case 'create-sub': {
            const name = await cmPrompt('Subfolder name:');
            if (name) { createFolder(name, folderId); renderManager(); }
            break;
        }
        case 'rename': {
            const folder = getFolderById(folderId);
            if (!folder) break;
            const newName = await cmPrompt('Rename folder:', folder.name);
            if (newName) { renameFolder(folderId, newName); renderManager(); }
            break;
        }
        case 'delete': {
            const delFolder = getFolderById(folderId);
            if (!delFolder) break;
            const cardCount = countCardsInFolder(folderId);
            let msg = 'Delete folder "' + delFolder.name + '"?\n\nSubfolders will be moved up.';
            if (cardCount > 0) {
                msg += '\n' + cardCount + ' card(s) in this folder will be unassigned.';
            }
            if (await cmConfirm(msg)) {
                deleteFolder(folderId);
                renderManager();
            }
            break;
        }
    }
}

// ── DRAG AND DROP ──

function onFolderDragOver(e) {
    e.preventDefault();
    e.currentTarget.classList.add('is-drop-target');
}

function onFolderDragLeave(e) {
    e.currentTarget.classList.remove('is-drop-target');
}

function onFolderDrop(e, targetFolderId) {
    e.preventDefault();
    e.currentTarget.classList.remove('is-drop-target');
    const avatar = e.dataTransfer?.getData('text/cm-avatar');
    if (!avatar) return;
    assignCardToFolder(avatar, targetFolderId);
    renderManager();
}

// TAG TREE
// ══════════════════════════════════════════════════════════════

function renderTagTree() {
    const container = state.dom.tagTree;
    if (!container) return;
    container.innerHTML = '';

    const tagCounts = {};
    state.characters.forEach(c => {
        c.tags.forEach(t => { tagCounts[t] = (tagCounts[t] || 0) + 1; });
    });

    const sorted = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]);

    if (sorted.length === 0) {
        container.innerHTML = '<span class="cm-muted">No tags found</span>';
        return;
    }

    sorted.forEach(([tag, count]) => {
        const btn = document.createElement('button');
        btn.className = 'cm-tree-item';
        if (state.activeFilter === FILTERS.TAG && state.activeTagFilter === tag) {
            btn.classList.add('is-active');
        }
        btn.dataset.cmTreeAction = 'tag';
        btn.dataset.cmTreeValue = tag;
        btn.innerHTML = `
            <i class="fa-solid fa-tag"></i>
            <span class="cm-tree-label">${escapeHtml(tag)}</span>
            <span class="cm-tree-count">${count}</span>
        `;
        container.appendChild(btn);
    });
}

// ══════════════════════════════════════════════════════════════
// CREATOR TREE
// ══════════════════════════════════════════════════════════════

function renderCreatorTree() {
    const container = state.dom.creatorTree;
    if (!container) return;
    container.innerHTML = '';

    const creatorCounts = {};
    state.characters.forEach(c => {
        const key = c.creator || '(unknown)';
        creatorCounts[key] = (creatorCounts[key] || 0) + 1;
    });

    const sorted = Object.entries(creatorCounts).sort((a, b) => b[1] - a[1]);

    if (sorted.length === 0) {
        container.innerHTML = '<span class="cm-muted">No creators found</span>';
        return;
    }

    sorted.forEach(([creator, count]) => {
        const btn = document.createElement('button');
        btn.className = 'cm-tree-item';
        if (state.activeFilter === FILTERS.CREATOR && state.activeCreatorFilter === creator) {
            btn.classList.add('is-active');
        }
        btn.dataset.cmTreeAction = 'creator';
        btn.dataset.cmTreeValue = creator;
        btn.innerHTML = `
            <i class="fa-solid fa-user-pen"></i>
            <span class="cm-tree-label">${escapeHtml(creator)}</span>
            <span class="cm-tree-count">${count}</span>
        `;
        container.appendChild(btn);
    });
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ══════════════════════════════════════════════════════════════
// TAB RENDERERS
// ══════════════════════════════════════════════════════════════

function renderCardsTab() {
    const grid = state.dom.grid;
    if (!grid) return;
    grid.innerHTML = '';

    const visible = getVisibleCards();
    const { items, totalPages, total } = getPageSlice(visible);

    if (total === 0) {
        setEmpty(state.characters.length === 0
            ? 'No characters found. Import some cards to get started!'
            : 'No characters match your current filters.');
        renderPagination(0, 1);
        return;
    }

    setEmpty('');
    const frag = document.createDocumentFragment();
    items.forEach(card => frag.appendChild(createCharacterCard(card)));
    grid.appendChild(frag);
    renderPagination(total, totalPages);
    updateSelectUI();
}

function renderPagination(total, totalPages) {
    if (!state.dom.pagination) return;
    state.dom.pageLabel.textContent = total > 0
        ? `Page ${state.currentPage} of ${totalPages} (${total} cards)`
        : 'No results';
    state.dom.prevPage.disabled = state.currentPage <= 1;
    state.dom.nextPage.disabled = state.currentPage >= totalPages;
}

// ══════════════════════════════════════════════════════════════
// CHARACTER CARD CREATION
// ══════════════════════════════════════════════════════════════

function createCharacterCard(c) {
    const card = document.createElement('article');
    card.className = 'cm-card';
    card.dataset.charIndex = c.index;
    card.dataset.charName = c.name;

    if (state.selectedCards.has(c.index)) card.classList.add('is-selected');

    // Avatar
    const cover = document.createElement('div');
    cover.className = 'cm-card-cover';

    if (c.hasAvatar) {
        const img = document.createElement('img');
        img.className = 'cm-card-avatar';
        img.src = getAvatarUrl(c.avatar);
        img.alt = c.name;
        img.loading = 'lazy';
        img.decoding = 'async';
        img.onerror = () => {
            img.style.display = 'none';
            cover.querySelector('.cm-card-fallback')?.classList.remove('cm-hidden');
        };
        cover.appendChild(img);
    }

    const fallback = document.createElement('div');
    fallback.className = `cm-card-fallback${c.hasAvatar ? ' cm-hidden' : ''}`;
    fallback.innerHTML = '<i class="fa-solid fa-user"></i>';
    cover.appendChild(fallback);

    // Badges
    const badges = document.createElement('div');
    badges.className = 'cm-card-badges';
    if (c.hasLorebook) badges.appendChild(createBadge('📗', 'Lorebook'));
    if (c.inGroups) badges.appendChild(createBadge('👥', 'In Group'));
    if (!c.hasAvatar) badges.appendChild(createBadge('⚠️', 'No Avatar', 'warning'));
    if (c.emptyDescription) badges.appendChild(createBadge('⚠️', 'No Desc', 'warning'));
    cover.appendChild(badges);

    // Checkbox
    const checkbox = document.createElement('div');
    checkbox.className = 'cm-card-checkbox';
    checkbox.dataset.cmAction = 'toggle-select';
    checkbox.innerHTML = state.selectedCards.has(c.index)
        ? '<i class="fa-solid fa-check"></i>'
        : '<i class="fa-regular fa-square"></i>';
    cover.appendChild(checkbox);

    // Body
    const body = document.createElement('div');
    body.className = 'cm-card-body';

    const titleRow = document.createElement('div');
    titleRow.className = 'cm-card-title-row';
    const title = document.createElement('h3');
    title.className = 'cm-card-title';
    title.textContent = c.name;
    title.title = c.name;
    const tokenBadge = document.createElement('span');
    tokenBadge.className = 'cm-card-tokens';
    tokenBadge.textContent = `${c.totalTokens.toLocaleString()} tok`;
    titleRow.append(title, tokenBadge);

    body.appendChild(titleRow);

    if (c.creator) {
        const creatorEl = document.createElement('p');
        creatorEl.className = 'cm-card-meta';
        creatorEl.textContent = c.creator;
        body.appendChild(creatorEl);
    }

    // Description snippet
        if (c.description) {
            const desc = document.createElement('p');
            desc.className = 'cm-card-desc';
            desc.textContent = c.description.slice(0, 120).replace(/\n/g, ' ') + (c.description.length > 120 ? '…' : '');
            body.appendChild(desc);
        }

        // Folder badge
    {
        const folderName = getCardFolderName(c.avatar);
        if (folderName) {
            const folderBadge = document.createElement('div');
            folderBadge.className = 'cm-card-folder-badge';
            folderBadge.innerHTML = '<i class="fa-solid fa-folder"></i> ' + escapeHtml(folderName);
            body.appendChild(folderBadge);
        }
    }

    // Tags — colored pills + edit button
    {
        const tagRow = document.createElement('div');
        tagRow.className = 'cm-card-tags';
        const ctx = getContext();
        const tagObjs = getTagObjectsForAvatar(c.avatar, ctx);
        tagObjs.slice(0, 4).forEach(t => {
            const pill = document.createElement('span');
            pill.className = 'cm-tag-pill';
            if (t.color) pill.style.backgroundColor = t.color;
            if (t.color2) pill.style.color = t.color2;
            pill.textContent = t.name;
            tagRow.appendChild(pill);
        });
        if (tagObjs.length > 4) {
            const more = document.createElement('span');
            more.className = 'cm-tag-pill cm-tag-more';
            more.textContent = `+${tagObjs.length - 4}`;
            tagRow.appendChild(more);
        }
        // Edit tags button
        const editBtn = document.createElement('button');
        editBtn.className = 'cm-tag-edit-btn';
        editBtn.dataset.cmCardAction = 'edit-tags';
        editBtn.title = 'Edit tags';
        editBtn.innerHTML = '<i class="fa-solid fa-pen-to-square"></i>';
        tagRow.appendChild(editBtn);
        body.appendChild(tagRow);
    }

    // Actions
    const actions = document.createElement('div');
    actions.className = 'cm-card-actions';
    actions.appendChild(createCardAction('open', 'fa-arrow-right', 'Open'));
    actions.appendChild(createCardAction('export', 'fa-download', 'Export'));
    actions.appendChild(createCardAction('delete', 'fa-trash-can', 'Delete'));
    if (getCardFolderId(c.avatar)) {
        actions.appendChild(createCardAction('remove-folder', 'fa-folder-minus', 'Remove from folder'));
    }

    card.append(cover, body, actions);

    // Drag support for folder assignment
    card.draggable = true;
    card.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/cm-avatar', c.avatar);
        card.classList.add('is-dragging');
    });
    card.addEventListener('dragend', () => card.classList.remove('is-dragging'));

    // Click handlers via delegation on grid
    return card;
}

function createBadge(emoji, label, type = '') {
    const badge = document.createElement('span');
    badge.className = `cm-badge${type ? ` cm-badge-${type}` : ''}`;
    badge.title = label;
    badge.textContent = emoji;
    return badge;
}

function createCardAction(action, icon, label) {
    const btn = document.createElement('button');
    btn.className = 'cm-card-action';
    btn.dataset.cmCardAction = action;
    btn.title = label;
    btn.innerHTML = `<i class="fa-solid ${icon}"></i>`;
    return btn;
}


// ══════════════════════════════════════════════════════════════
// TAG EDITOR POPOVER
// ══════════════════════════════════════════════════════════════

function openTagEditor(avatar, anchorEl) {
    closeTagEditor(); // close any existing
    const ctx = getContext();
    const allTags = getAllTags();
    const charTagObjs = getTagObjectsForAvatar(avatar, ctx);
    const charTagIds = new Set(charTagObjs.map(t => t.id));

    const popover = document.createElement('div');
    popover.className = 'cm-tag-editor';
    popover.id = 'cm-tag-editor-popover';
    popover.dataset.avatar = avatar;

    // Header
    const header = document.createElement('div');
    header.className = 'cm-tag-editor-header';
    header.innerHTML = '<span>Edit Tags</span>';
    const closeBtn = document.createElement('button');
    closeBtn.className = 'cm-tag-editor-close';
    closeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
    closeBtn.addEventListener('click', closeTagEditor);
    header.appendChild(closeBtn);
    popover.appendChild(header);

    // Create new tag input
    const createRow = document.createElement('div');
    createRow.className = 'cm-tag-editor-create';
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'New tag name…';
    input.className = 'cm-tag-editor-input';
    const addBtn = document.createElement('button');
    addBtn.className = 'cm-tag-editor-add';
    addBtn.innerHTML = '<i class="fa-solid fa-plus"></i>';
    const doCreate = () => {
        const name = input.value.trim();
        if (!name) return;
        const tag = createNewTag(name);
        if (tag) {
            addTagToCharacter(avatar, tag.id);
            refreshAfterTagEdit();
        }
        input.value = '';
    };
    addBtn.addEventListener('click', doCreate);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doCreate(); });
    createRow.append(input, addBtn);
    popover.appendChild(createRow);

    // Tag list
    const list = document.createElement('div');
    list.className = 'cm-tag-editor-list';
    allTags.sort((a, b) => a.name.localeCompare(b.name)).forEach(tag => {
        const row = document.createElement('label');
        row.className = 'cm-tag-editor-row';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = charTagIds.has(tag.id);
        cb.addEventListener('change', () => {
            if (cb.checked) addTagToCharacter(avatar, tag.id);
            else removeTagFromCharacter(avatar, tag.id);
            refreshAfterTagEdit();
        });
        const dot = document.createElement('span');
        dot.className = 'cm-tag-dot';
        if (tag.color) dot.style.backgroundColor = tag.color;
        const label = document.createElement('span');
        label.className = 'cm-tag-editor-label';
        label.textContent = tag.name;
        row.append(cb, dot, label);
        list.appendChild(row);
    });
    if (allTags.length === 0) {
        list.innerHTML = '<span class="cm-muted" style="padding:8px;font-size:11px;">No tags exist yet. Create one above.</span>';
    }
    popover.appendChild(list);

    // Position near anchor
    document.body.appendChild(popover);
    positionPopover(popover, anchorEl);

    // Close on outside click (delayed to avoid immediate close)
    setTimeout(() => {
        document.addEventListener('click', onTagEditorOutsideClick, true);
    }, 50);
}

function positionPopover(popover, anchor) {
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const popW = 240, popH = 320;
    let top = rect.bottom + 4;
    let left = rect.left;
    if (top + popH > window.innerHeight) top = rect.top - popH - 4;
    if (left + popW > window.innerWidth) left = window.innerWidth - popW - 8;
    if (left < 8) left = 8;
    popover.style.top = `${top}px`;
    popover.style.left = `${left}px`;
}

function closeTagEditor() {
    const existing = document.getElementById('cm-tag-editor-popover');
    if (existing) existing.remove();
    document.removeEventListener('click', onTagEditorOutsideClick, true);
}

function onTagEditorOutsideClick(e) {
    const popover = document.getElementById('cm-tag-editor-popover');
    if (popover && !popover.contains(e.target) && !e.target.closest('[data-cm-card-action="edit-tags"]')) {
        closeTagEditor();
    }
}

function refreshAfterTagEdit() {
    // Re-normalize tags for all characters and re-render
    const ctx = getContext();
    state.characters = state.characters.map(c => ({
        ...c,
        tags: getTagsForCharacter(c, ctx),
    }));
    renderManager();
}

// ── BULK TAG ──

function openBulkTagEditor(anchorEl) {
    closeTagEditor();
    const selected = getSelectedCharacters().map(c => c.avatar);
    if (selected.length === 0) return;

    const allTags = getAllTags();
    const ctx = getContext();

    const popover = document.createElement('div');
    popover.className = 'cm-tag-editor';
    popover.id = 'cm-tag-editor-popover';
    popover.dataset.bulk = 'true';

    const header = document.createElement('div');
    header.className = 'cm-tag-editor-header';
    header.innerHTML = `<span>Tag ${selected.length} cards</span>`;
    const closeBtn = document.createElement('button');
    closeBtn.className = 'cm-tag-editor-close';
    closeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
    closeBtn.addEventListener('click', closeTagEditor);
    header.appendChild(closeBtn);
    popover.appendChild(header);

    // Create new tag
    const createRow = document.createElement('div');
    createRow.className = 'cm-tag-editor-create';
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'New tag name…';
    input.className = 'cm-tag-editor-input';
    const addBtn = document.createElement('button');
    addBtn.className = 'cm-tag-editor-add';
    addBtn.innerHTML = '<i class="fa-solid fa-plus"></i>';
    const doBulkCreate = () => {
        const name = input.value.trim();
        if (!name) return;
        const tag = createNewTag(name);
        if (tag) {
            selected.forEach(avatar => addTagToCharacter(avatar, tag.id));
            refreshAfterTagEdit();
        }
        input.value = '';
    };
    addBtn.addEventListener('click', doBulkCreate);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doBulkCreate(); });
    createRow.append(input, addBtn);
    popover.appendChild(createRow);

    // Tag list with tri-state: all have it, some have it, none
    const list = document.createElement('div');
    list.className = 'cm-tag-editor-list';
    allTags.sort((a, b) => a.name.localeCompare(b.name)).forEach(tag => {
        const count = selected.filter(avatar => {
            const ids = getTagObjectsForAvatar(avatar, ctx).map(t => t.id);
            return ids.includes(tag.id);
        }).length;
        const row = document.createElement('label');
        row.className = 'cm-tag-editor-row';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = count === selected.length;
        cb.indeterminate = count > 0 && count < selected.length;
        cb.addEventListener('change', () => {
            if (cb.checked) {
                selected.forEach(avatar => addTagToCharacter(avatar, tag.id));
            } else {
                selected.forEach(avatar => removeTagFromCharacter(avatar, tag.id));
            }
            refreshAfterTagEdit();
        });
        const dot = document.createElement('span');
        dot.className = 'cm-tag-dot';
        if (tag.color) dot.style.backgroundColor = tag.color;
        const label = document.createElement('span');
        label.className = 'cm-tag-editor-label';
        label.textContent = tag.name;
        row.append(cb, dot, label);
        list.appendChild(row);
    });
    popover.appendChild(list);

    document.body.appendChild(popover);
    positionPopover(popover, anchorEl);
    setTimeout(() => {
        document.addEventListener('click', onTagEditorOutsideClick, true);
    }, 50);
}


// ── BULK FOLDER PICKER ──

function openBulkFolderPicker(anchorEl) {
    closeTagEditor(); // reuse close mechanism
    closeBulkFolderPicker();
    const selected = [...state.selectedCards];
    if (selected.length === 0) return;

    const folders = getFolders();
    const assignments = getFolderAssignments();

    const popover = document.createElement('div');
    popover.className = 'cm-tag-editor cm-folder-picker';
    popover.id = 'cm-folder-picker-popover';

    // Header
    const header = document.createElement('div');
    header.className = 'cm-tag-editor-header';
    header.innerHTML = `<span>Move ${selected.length} cards</span>`;
    const closeBtn = document.createElement('button');
    closeBtn.className = 'cm-tag-editor-close';
    closeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
    closeBtn.addEventListener('click', closeBulkFolderPicker);
    header.appendChild(closeBtn);
    popover.appendChild(header);

    // Folder list
    const list = document.createElement('div');
    list.className = 'cm-tag-editor-list';

    // "No Folder" option
    const noRow = document.createElement('button');
    noRow.className = 'cm-folder-picker-row';
    noRow.innerHTML = '<i class="fa-solid fa-inbox"></i> <span>No Folder</span>';
    noRow.addEventListener('click', () => {
        const chars = getSelectedCharacters();
        chars.forEach(c => assignCardToFolder(c.avatar, null));
        closeBulkFolderPicker();
        toastr?.success?.(`${chars.length} card(s) removed from folders`);
        renderManager();
    });
    list.appendChild(noRow);

    // Real folders (flat list for simplicity)
    const allFolders = getSortedFolders(null);
    function addFolderRows(parentId, depth) {
        getSortedFolders(parentId).forEach(folder => {
            const row = document.createElement('button');
            row.className = 'cm-folder-picker-row';
            row.style.paddingLeft = `${10 + depth * 14}px`;
            row.innerHTML = `<i class="fa-solid fa-folder"></i> <span>${escapeHtml(folder.name)}</span>`;
            row.addEventListener('click', () => {
                const chars = getSelectedCharacters();
                chars.forEach(c => assignCardToFolder(c.avatar, folder.id));
                closeBulkFolderPicker();
                toastr?.success?.(`${chars.length} card(s) moved to "${folder.name}"`);
                renderManager();
            });
            list.appendChild(row);
            addFolderRows(folder.id, depth + 1);
        });
    }
    addFolderRows(null, 0);

    if (folders.length === 0) {
        const hint = document.createElement('div');
        hint.className = 'cm-muted';
        hint.style.cssText = 'padding:8px;font-size:11px;';
        hint.textContent = 'No folders yet. Create one from the sidebar.';
        list.appendChild(hint);
    }

    popover.appendChild(list);
    document.body.appendChild(popover);
    positionPopover(popover, anchorEl);

    setTimeout(() => {
        document.addEventListener('click', onFolderPickerOutsideClick, true);
    }, 50);
}

function closeBulkFolderPicker() {
    const el = document.getElementById('cm-folder-picker-popover');
    if (el) el.remove();
    document.removeEventListener('click', onFolderPickerOutsideClick, true);
}

function onFolderPickerOutsideClick(e) {
    const popover = document.getElementById('cm-folder-picker-popover');
    if (popover && !popover.contains(e.target) && !e.target.closest('#cm-bulk-folder')) {
        closeBulkFolderPicker();
    }
}

function renderStatsTab() {
    const grid = state.dom.grid;
    if (!grid) return;
    grid.innerHTML = '';
    setEmpty('');

    const chars = state.characters;
    if (chars.length === 0) {
        setEmpty('No characters to analyze.');
        return;
    }

    const stats = computeStats(chars);
    const container = document.createElement('div');
    container.className = 'cm-stats';

    container.appendChild(buildOverviewCards(stats));
    container.appendChild(buildTokenDistribution(stats));
    container.appendChild(buildRankings(stats));
    container.appendChild(buildHealthReport(stats));
    container.appendChild(buildTagDistribution(stats));
    container.appendChild(buildCreatorDistribution(stats));
    container.appendChild(buildCoverageReport(stats));
        container.appendChild(buildDuplicateReport(stats));

    grid.appendChild(container);
}

// ══════════════════════════════════════════════════════════════
// STATS ENGINE
// ══════════════════════════════════════════════════════════════

function computeStats(chars) {
    const tokens = chars.map(c => c.totalTokens).sort((a, b) => a - b);
    const totalTokens = tokens.reduce((s, t) => s + t, 0);
    const avg = Math.round(totalTokens / chars.length);


    // Per-field aggregation
    const fieldNames = ['description', 'personality', 'firstMes', 'mesExample', 'scenario', 'creatorNotes'];
    const fieldLabels = {
        description: 'Description',
        personality: 'Personality',
        firstMes: 'First Message',
        mesExample: 'Examples',
        scenario: 'Scenario',
        creatorNotes: 'Creator Notes',
    };
    const fieldTotals = {};
    const fieldNonEmpty = {};
    fieldNames.forEach(f => { fieldTotals[f] = 0; fieldNonEmpty[f] = 0; });
    chars.forEach(c => {
        fieldNames.forEach(f => {
            const t = c.fieldTokens[f] || 0;
            fieldTotals[f] += t;
            if (t > 0) fieldNonEmpty[f]++;
        });
    });

    // Tags
    const tagCounts = {};
    chars.forEach(c => c.tags.forEach(t => { tagCounts[t] = (tagCounts[t] || 0) + 1; }));
    const tagsSorted = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]);

    // Creators
    const creatorCounts = {};
    chars.forEach(c => {
        const key = c.creator || '(unknown)';
        creatorCounts[key] = (creatorCounts[key] || 0) + 1;
    });
    const creatorsSorted = Object.entries(creatorCounts).sort((a, b) => b[1] - a[1]);

    // Health
    const health = {
        noAvatar: chars.filter(c => !c.hasAvatar),
        emptyDesc: chars.filter(c => c.emptyDescription),
        emptyFirstMes: chars.filter(c => c.emptyFirstMessage),
        noPersonality: chars.filter(c => c.noPersonality),
        veryLow: chars.filter(c => c.totalTokens < 100 && c.totalTokens > 0),
        veryHigh: chars.filter(c => c.totalTokens > 10000),
    };
    const healthTotal = Object.values(health).reduce((s, arr) => s + arr.length, 0);

    // Rankings
    const byTokensDesc = [...chars].sort((a, b) => b.totalTokens - a.totalTokens);
    const byTokensAsc = [...chars].sort((a, b) => a.totalTokens - b.totalTokens);

    // Coverage
    const withLorebook = chars.filter(c => c.hasLorebook).length;
    const inGroups = chars.filter(c => c.inGroups).length;

    // New metrics
    const largestCard = byTokensDesc[0] || null;
    const smallestCard = byTokensAsc[0] || null;
    const noDescCount = chars.filter(c => c.emptyDescription).length;
    const noAvatarCount = chars.filter(c => !c.hasAvatar).length;
    const topCreator = creatorsSorted[0] || null;
    const folderAssignments = getExtensionSettings().folderAssignments || {};
    const inFolders = chars.filter(c => folderAssignments[c.avatar]).length;

    return {
        total: chars.length,
        totalTokens, avg, tokens,
        min: tokens[0], max: tokens[tokens.length - 1],
        fieldNames, fieldLabels, fieldTotals, fieldNonEmpty,
        tagsSorted, creatorsSorted,
        health, healthTotal,
        byTokensDesc, byTokensAsc,
        groupCount: state.groups.length,
        largestCard, smallestCard, noDescCount, noAvatarCount, topCreator, inFolders,
    };
}

// ══════════════════════════════════════════════════════════════
// STATS UI BUILDERS
// ══════════════════════════════════════════════════════════════

function buildOverviewCards(stats) {
    const section = statsSection('Overview');
    const grid = document.createElement('div');
    grid.className = 'cm-stat-cards';

    const cards = [
        { label: 'Characters', value: stats.total, icon: 'fa-users' },
        { label: 'Groups', value: stats.groupCount, icon: 'fa-people-group' },
        { label: 'Total Tokens', value: stats.totalTokens.toLocaleString(), icon: 'fa-coins' },
        { label: 'Average', value: `${stats.avg.toLocaleString()} tok`, icon: 'fa-scale-balanced' },
        { label: 'Range', value: `${stats.min.toLocaleString()} – ${stats.max.toLocaleString()}`, icon: 'fa-arrow-right-arrow-left' },
        { label: 'Largest Card', value: stats.largestCard ? `${stats.largestCard.name} (${stats.largestCard.totalTokens.toLocaleString()})` : '—', icon: 'fa-arrow-up-wide-short' },
        { label: 'Smallest Card', value: stats.smallestCard ? `${stats.smallestCard.name} (${stats.smallestCard.totalTokens.toLocaleString()})` : '—', icon: 'fa-arrow-down-short-wide' },
        { label: 'No Description', value: stats.noDescCount, icon: 'fa-file-circle-xmark', accent: stats.noDescCount > 0 ? 'warning' : 'success' },
        { label: 'No Avatar', value: stats.noAvatarCount, icon: 'fa-image', accent: stats.noAvatarCount > 0 ? 'warning' : 'success' },
        { label: 'Top Creator', value: stats.topCreator ? `${stats.topCreator[0]} (${stats.topCreator[1]})` : '—', icon: 'fa-crown' },
        { label: 'Health Issues', value: stats.healthTotal, icon: 'fa-triangle-exclamation', accent: stats.healthTotal > 0 ? 'warning' : 'success' },
        { label: 'Unique Tags', value: stats.tagsSorted.length, icon: 'fa-tags' },
        { label: 'In Folders', value: stats.inFolders, icon: 'fa-folder' },
    ];

    cards.forEach(c => {
        const card = document.createElement('div');
        card.className = `cm-stat-card${c.accent ? ` cm-stat-${c.accent}` : ''}`;
        card.innerHTML = `
            <div class="cm-stat-icon"><i class="fa-solid ${c.icon}"></i></div>
            <div class="cm-stat-value">${c.value}</div>
            <div class="cm-stat-label">${c.label}</div>
        `;
        grid.appendChild(card);
    });

    section.appendChild(grid);
    return section;
}

function buildTokenDistribution(stats) {
    const section = statsSection('Token Distribution by Field');
    const table = document.createElement('table');
    table.className = 'cm-stats-table cm-stats-table-tokens';
    table.innerHTML = `<thead><tr>
        <th>Field</th><th>Tokens</th><th>%</th><th>Avg</th><th>Using</th><th>Coverage</th>
    </tr></thead>`;
    const tbody = document.createElement('tbody');

    stats.fieldNames.forEach(f => {
        const total = stats.fieldTotals[f];
        const pct = stats.totalTokens > 0 ? ((total / stats.totalTokens) * 100).toFixed(1) : '0.0';
        const avg = stats.total > 0 ? Math.round(total / stats.total) : 0;
        const used = stats.fieldNonEmpty[f];
        const coverage = stats.total > 0 ? ((used / stats.total) * 100).toFixed(0) : '0';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${stats.fieldLabels[f]}</strong></td>
            <td>${total.toLocaleString()}</td>
            <td>
                <div class="cm-bar-cell">
                    <div class="cm-bar-fill" style="width:${Math.min(pct, 100)}%"></div>
                    <span>${pct}%</span>
                </div>
            </td>
            <td>${avg.toLocaleString()}</td>
            <td>${used} / ${stats.total}</td>
            <td>${coverage}%</td>
        `;
        tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    section.appendChild(table);
    return section;
}

function buildRankings(stats) {
    const section = statsSection('Rankings');
    const wrap = document.createElement('div');
    wrap.className = 'cm-rankings-grid';

    wrap.appendChild(buildRankingList('Largest Cards', stats.byTokensDesc.slice(0, 10), 'desc'));
    wrap.appendChild(buildRankingList('Smallest Cards', stats.byTokensAsc.slice(0, 10), 'asc'));

    section.appendChild(wrap);
    return section;
}

function buildRankingList(title, chars, direction) {
    const col = document.createElement('div');
    col.className = 'cm-ranking-col';
    const h = document.createElement('h4');
    h.className = 'cm-ranking-title';
    h.textContent = title;
    col.appendChild(h);

    const maxTokens = chars.length > 0 ? chars[0].totalTokens : 1;

    chars.forEach((c, i) => {
        const row = document.createElement('div');
        row.className = 'cm-ranking-row';
        const barWidth = maxTokens > 0 ? Math.max(2, (c.totalTokens / maxTokens) * 100) : 0;
        row.innerHTML = `
            <span class="cm-rank-num">${i + 1}</span>
            <span class="cm-rank-name" title="${escapeHtml(c.name)}">${escapeHtml(c.name)}</span>
            <div class="cm-rank-bar">
                <div class="cm-rank-fill" style="width:${barWidth}%"></div>
            </div>
            <span class="cm-rank-value">${c.totalTokens.toLocaleString()}</span>
        `;
        col.appendChild(row);
    });

    return col;
}

function buildHealthReport(stats) {
    const section = statsSection('Health Report');

    const categories = [
        { key: 'noAvatar', label: 'Missing Avatar', icon: 'fa-image', severity: 'warning' },
        { key: 'emptyDesc', label: 'Empty Description', icon: 'fa-align-left', severity: 'danger' },
        { key: 'emptyFirstMes', label: 'Empty First Message', icon: 'fa-comment-slash', severity: 'danger' },
        { key: 'noPersonality', label: 'No Personality', icon: 'fa-masks-theater', severity: 'warning' },
        { key: 'veryLow', label: 'Very Low Tokens (<100)', icon: 'fa-arrow-down', severity: 'warning' },
        { key: 'veryHigh', label: 'Very High Tokens (>10k)', icon: 'fa-arrow-up', severity: 'info' },
    ];

    categories.forEach(cat => {
        const chars = stats.health[cat.key];
        const group = document.createElement('div');
        group.className = 'cm-health-group';

        const header = document.createElement('button');
        header.className = `cm-health-header cm-severity-${cat.severity}`;
        header.innerHTML = `
            <i class="fa-solid ${cat.icon}"></i>
            <span class="cm-health-label">${cat.label}</span>
            <span class="cm-health-count">${chars.length}</span>
            <i class="fa-solid fa-chevron-down cm-health-chevron"></i>
        `;

        const body = document.createElement('div');
        body.className = 'cm-health-body cm-hidden';

        if (chars.length === 0) {
            body.innerHTML = '<span class="cm-muted">No issues found ✓</span>';
        } else {
            chars.slice(0, 50).forEach(c => {
                const row = document.createElement('div');
                row.className = 'cm-health-item';
                row.innerHTML = `<span>${escapeHtml(c.name)}</span><span class="cm-muted">${c.totalTokens.toLocaleString()} tok</span>`;
                body.appendChild(row);
            });
            if (chars.length > 50) {
                const more = document.createElement('div');
                more.className = 'cm-muted';
                more.textContent = `…and ${chars.length - 50} more`;
                body.appendChild(more);
            }
        }

        header.addEventListener('click', () => {
            body.classList.toggle('cm-hidden');
            header.querySelector('.cm-health-chevron')?.classList.toggle('cm-rotated');
        });

        group.append(header, body);
        section.appendChild(group);
    });

    return section;
}

function buildTagDistribution(stats) {
    const section = statsSection('Tag Distribution');

    if (stats.tagsSorted.length === 0) {
        section.appendChild(makeMuted('No tags found.'));
        return section;
    }

    const cloud = document.createElement('div');
    cloud.className = 'cm-tag-cloud';
    const maxCount = stats.tagsSorted[0]?.[1] || 1;

    stats.tagsSorted.forEach(([tag, count]) => {
        const weight = Math.max(0.6, Math.min(1, (count / maxCount) * 1));
        const pill = document.createElement('span');
        pill.className = 'cm-cloud-tag';
        pill.style.fontSize = `${weight}em`;
        pill.style.opacity = Math.max(0.5, weight);
        pill.title = `${count} card(s)`;
        pill.textContent = `${tag} (${count})`;
        cloud.appendChild(pill);
    });

    section.appendChild(cloud);
    return section;
}

function buildCreatorDistribution(stats) {
    const section = statsSection('Creator Distribution');

    if (stats.creatorsSorted.length === 0) {
        section.appendChild(makeMuted('No creator data found.'));
        return section;
    }

    const table = document.createElement('table');
    table.className = 'cm-stats-table';
    table.innerHTML = '<thead><tr><th>Creator</th><th>Cards</th><th>Share</th></tr></thead>';
    const tbody = document.createElement('tbody');

    stats.creatorsSorted.slice(0, 30).forEach(([creator, count]) => {
        const pct = ((count / stats.total) * 100).toFixed(1);
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${escapeHtml(creator)}</td>
            <td>${count}</td>
            <td>
                <div class="cm-bar-cell">
                    <div class="cm-bar-fill" style="width:${Math.min(pct, 100)}%"></div>
                    <span>${pct}%</span>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });

    if (stats.creatorsSorted.length > 30) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td class="cm-muted" colspan="3">…and ${stats.creatorsSorted.length - 30} more creators</td>`;
        tbody.appendChild(tr);
    }

    table.appendChild(tbody);
    section.appendChild(table);
    return section;
}

function buildCoverageReport(stats) {
    const section = statsSection('Coverage');
    const grid = document.createElement('div');
    grid.className = 'cm-stat-cards';

    const items = [
        { label: 'With Lorebook', value: stats.withLorebook, total: stats.total, icon: 'fa-book-atlas' },
        { label: 'In Groups', value: stats.inGroups, total: stats.total, icon: 'fa-people-group' },
    ];

    items.forEach(item => {
        const card = document.createElement('div');
        card.className = 'cm-stat-card';
        const pct = typeof item.value === 'number' && item.total > 0
            ? ` (${((item.value / item.total) * 100).toFixed(0)}%)`
            : '';
        card.innerHTML = `
            <div class="cm-stat-icon"><i class="fa-solid ${item.icon}"></i></div>
            <div class="cm-stat-value">${typeof item.value === 'number' ? item.value : item.value} / ${item.total}${pct}</div>
            <div class="cm-stat-label">${item.label}</div>
        `;
        grid.appendChild(card);
    });

    section.appendChild(grid);
    return section;
}

// ── Stats helpers ──

function statsSection(title) {
    const section = document.createElement('section');
    section.className = 'cm-stats-section';
    const h = document.createElement('h3');
    h.className = 'cm-stats-heading';
    h.textContent = title;
    section.appendChild(h);
    return section;
}

function makeMuted(text) {
    const el = document.createElement('span');
    el.className = 'cm-muted';
    el.textContent = text;
    return el;
}

function resolveExportFilename(charRecord) {
    const tpl = state.exportFilenameTemplate || '{name}';
    const dateStr = new Date().toISOString().slice(0, 10);
    return safeName(
        tpl.replace('{name}', charRecord.name || 'unknown')
           .replace('{date}', dateStr)
           .replace('{index}', String(charRecord.index ?? 0))
           .replace('{creator}', charRecord.creator || 'unknown')
    );
}


// ═══════════════════════════════════════════════════════════
// IMPORT TAB
// ═══════════════════════════════════════════════════════════


// ═══════════════════════════════════════════════════════════
// SHOWCASE TAB — Phase 1: Core Layout
// ═══════════════════════════════════════════════════════════


const SHOWCASE_FONTS = [
    { name: 'system-ui', category: 'system', google: false },
    // Serif
    { name: 'Cinzel', category: 'serif', google: true },
    { name: 'Lora', category: 'serif', google: true },
    { name: 'Playfair Display', category: 'serif', google: true },
    // Sans-serif
    { name: 'Inter', category: 'sans', google: true },
    { name: 'Nunito', category: 'sans', google: true },
    { name: 'Montserrat', category: 'sans', google: true },
    // Monospace
    { name: 'JetBrains Mono', category: 'mono', google: true },
    { name: 'Share Tech Mono', category: 'mono', google: true },
    // Display
    { name: 'Orbitron', category: 'display', google: true },
];

const _loadedFonts = new Set();
const _loadingFonts = new Set();
const _fontListeners = [];

let _html2canvasLoaded = false;
async function loadHtml2Canvas() {
    if (_html2canvasLoaded && window.html2canvas) return true;
    if (document.querySelector('script[data-html2canvas]')) {
        return new Promise(r => setTimeout(() => r(!!window.html2canvas), 500));
    }
    return new Promise(resolve => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
        script.setAttribute('data-html2canvas', '1');
        script.onload = () => { _html2canvasLoaded = true; resolve(true); };
        script.onerror = () => resolve(false);
        document.head.appendChild(script);
    });
}

async function screenshotShowcase(profileEl) {
    if (!profileEl) { toastr?.warning?.('No card to capture.'); return; }
    toastr?.info?.('Capturing card...');
    if (!(await loadHtml2Canvas())) {
        toastr?.error?.('Failed to load screenshot library.');
        return;
    }
    try {
        // Remove max-height/overflow constraints temporarily
        const scrollables = profileEl.querySelectorAll('.cm-showcase-text, .cm-showcase-first-message, .cm-showcase-personality');
        const saved = [];
        scrollables.forEach(el => {
            saved.push({ el, mh: el.style.maxHeight, ov: el.style.overflow });
            el.style.maxHeight = 'none';
            el.style.overflow = 'visible';
        });

        // Fix avatar — prevent squish
        const avatar = profileEl.querySelector('.cm-showcase-avatar img, .cm-showcase-avatar');
        const savedAvatar = avatar ? { mh: avatar.style.maxHeight, h: avatar.style.height } : null;
        if (avatar) {
            avatar.style.maxHeight = 'none';
            avatar.style.height = 'auto';
        }

        // Also fix the profile container itself
        const savedProfile = { mh: profileEl.style.maxHeight, ov: profileEl.style.overflow };
        profileEl.style.maxHeight = 'none';
        profileEl.style.overflow = 'visible';

        const canvas = await html2canvas(profileEl, {
            backgroundColor: null,
            useCORS: true,
            scale: 2,
            logging: false,
            scrollY: 0,
            scrollX: 0,
            windowHeight: profileEl.scrollHeight,
            
        });

        // Restore everything
        saved.forEach(({ el, mh, ov }) => { el.style.maxHeight = mh; el.style.overflow = ov; });
        if (avatar && savedAvatar) { avatar.style.maxHeight = savedAvatar.mh; avatar.style.height = savedAvatar.h; }
        profileEl.style.maxHeight = savedProfile.mh;
        profileEl.style.overflow = savedProfile.ov;
        const link = document.createElement('a');
        const charName = profileEl.querySelector('.cm-showcase-name')?.textContent || 'showcase';
        link.download = charName.replace(/[^a-zA-Z0-9_-]/g, '_') + '_card.png';
        link.href = canvas.toDataURL('image/png');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toastr?.success?.('Card saved as PNG!');
    } catch (e) {
        console.error('[card-manager] Screenshot failed:', e);
        toastr?.error?.('Screenshot failed: ' + e.message);
    }
}

function loadGoogleFont(fontName, onLoad) {
    if (!fontName || fontName === 'system-ui') { onLoad?.(); return; }
    if (_loadedFonts.has(fontName)) { onLoad?.(); return; }
    const id = 'gf-' + fontName.replace(/\s+/g, '-').toLowerCase();
    if (!document.getElementById(id)) {
        const link = document.createElement('link');
        link.id = id;
        link.rel = 'stylesheet';
        link.href = 'https://fonts.googleapis.com/css2?family=' + encodeURIComponent(fontName) + '&display=swap';
        document.head.appendChild(link);
        _loadingFonts.add(fontName);
        link.onload = () => {
            _loadingFonts.delete(fontName);
            _loadedFonts.add(fontName);
            _fontListeners.forEach(fn => fn(fontName));
            onLoad?.();
        };
        link.onerror = () => {
            _loadingFonts.delete(fontName);
            onLoad?.();
        };
    } else {
        _loadedFonts.add(fontName);
        onLoad?.();
    }
}

function preloadGoogleFont(fontName) {
    if (!fontName || fontName === 'system-ui' || _loadedFonts.has(fontName)) return;
    const id = 'gf-' + fontName.replace(/\s+/g, '-').toLowerCase();
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'prefetch';
    link.as = 'style';
    link.href = 'https://fonts.googleapis.com/css2?family=' + encodeURIComponent(fontName) + '&display=swap';
    document.head.appendChild(link);
}

function makeShowcaseFontSelect(labelText, currentValue, onChange) {
    const wrap = document.createElement('div');
    wrap.className = 'cm-showcase-font-select-group';

    const label = document.createElement('span');
    label.className = 'cm-showcase-font-select-label';
    label.textContent = labelText;
    wrap.appendChild(label);

    const select = document.createElement('select');
    select.className = 'cm-showcase-font-select text_pole';

    const categories = [
        { key: 'system', label: '── System ──' },
        { key: 'serif', label: '── Serif ──' },
        { key: 'sans', label: '── Sans-serif ──' },
        { key: 'mono', label: '── Monospace ──' },
        { key: 'display', label: '── Display ──' },
    ];

    for (const cat of categories) {
        const fonts = SHOWCASE_FONTS.filter(f => f.category === cat.key);
        if (!fonts.length) continue;
        const optgroup = document.createElement('optgroup');
        optgroup.label = cat.label;
        for (const f of fonts) {
            const opt = document.createElement('option');
            opt.value = f.name;
            opt.textContent = f.name;
            opt.style.fontFamily = f.name + ', system-ui';
            if (f.name === currentValue) opt.selected = true;
            optgroup.appendChild(opt);
        }
        select.appendChild(optgroup);
    }

    select.addEventListener('change', (e) => {
        const val = e.target.value;
        loadGoogleFont(val);
        onChange(val);
    });
    let _fontsPreloaded = false;
    const _preloadAll = () => {
        if (_fontsPreloaded) return;
        _fontsPreloaded = true;
        SHOWCASE_FONTS.filter(f => f.google).forEach(f => preloadGoogleFont(f.name));
    };
    select.addEventListener('mouseenter', _preloadAll);
    select.addEventListener('focus', _preloadAll);

    wrap.appendChild(select);
    return wrap;
}

function renderShowcaseTab() {
    const grid = state.dom.grid;
    if (!grid) return;
    grid.innerHTML = '';
    setEmpty('');

    const visible = getVisibleCards();
    if (visible.length === 0) {
        setEmpty('No characters to showcase. Try changing your filters.');
        return;
    }

    // Clamp index
    if (state.showcaseIndex >= visible.length) state.showcaseIndex = 0;
    if (state.showcaseIndex < 0) state.showcaseIndex = visible.length - 1;
    const card = visible[state.showcaseIndex];
    const ctx = getContext();

    const showcase = document.createElement('div');
    showcase.className = 'cm-showcase cm-showcase-theme-' + state.showcaseTheme
        + (state.showcaseCleanMode ? ' cm-showcase-clean' : '')
        + ' cm-showcase-avatar-' + state.showcaseAvatarSize
        
        + ' cm-showcase-layout-' + state.showcaseLayout;

    // ── Genre Google Font loading ──
    try {
    const _genreFontNames = {
        'romance':    ['Playfair Display', 'Lora'],
        'fantasy':    ['Cinzel', 'Lora'],
        'scifi':      ['Orbitron', 'Inter', 'Share Tech Mono'],
        'horror':     ['Orbitron', 'Lora', 'Share Tech Mono'],
        'slice':      ['Nunito'],
        'noir':       ['Playfair Display', 'Lora', 'Montserrat'],
        'cyberpunk':  ['Orbitron', 'Inter', 'JetBrains Mono'],
        'comedy':     ['Nunito'],
        'historical': ['Playfair Display', 'Lora', 'Cinzel'],
        'mystery':    ['Playfair Display', 'Lora', 'Share Tech Mono'],
        'wholesome':  ['Nunito'],
        'action':     ['Montserrat', 'Inter'],
    };
    const _themeFonts = _genreFontNames[state.showcaseTheme] || [];
    _themeFonts.forEach(n => loadGoogleFont(n));
    } catch (_gfErr) { console.warn('[CardManager] Genre font loading failed:', _gfErr); }

    // ── Font system + controls panel (defensive) ──
    try {
        if (state.showcaseTheme === 'custom') {
        showcase.style.setProperty('--sc-accent', state.showcaseCustomAccent);
        showcase.style.setProperty('--sc-bg', state.showcaseCustomBg);
        showcase.style.setProperty('--sc-surface', state.showcaseCustomBg);
        showcase.style.setProperty('--sc-accent-soft', state.showcaseCustomAccent + '22');
        const hf = state.showcaseCustomFontHeading !== 'system-ui' ? "'" + state.showcaseCustomFontHeading + "', " : '';
        const bf = state.showcaseCustomFontBody !== 'system-ui' ? "'" + state.showcaseCustomFontBody + "', " : '';
        const lf = state.showcaseCustomFontLabel !== 'system-ui' ? "'" + state.showcaseCustomFontLabel + "', " : '';
        const nf = state.showcaseCustomFontName !== 'system-ui' ? "'" + state.showcaseCustomFontName + "', " : '';
        showcase.style.setProperty('--sc-ff-name', nf + 'system-ui, sans-serif');
        showcase.style.setProperty('--sc-ff-heading', hf + 'system-ui, sans-serif');
        showcase.style.setProperty('--sc-ff-body', bf + 'system-ui, sans-serif');
        showcase.style.setProperty('--sc-ff-label', lf + 'system-ui, sans-serif');
    }
    // Font size from slider
    const fontSteps = [0.7, 0.78, 0.86, 0.92, 1.0, 1.1, 1.25, 1.4];
    const baseFont = fontSteps[state.showcaseFontStep] || 0.92;
    showcase.style.setProperty('--sc-font-base', baseFont + 'rem');
    showcase.style.setProperty('--sc-font-heading', (baseFont * 1.75) + 'rem');

    // ── Navigation bar ──
    const nav = document.createElement('div');
    nav.className = 'cm-showcase-nav' + (state.showcaseCleanMode ? ' cm-showcase-nav-clean' : '');

    const prevBtn = document.createElement('button');
    prevBtn.className = 'menu_button cm-showcase-nav-btn';
    prevBtn.innerHTML = '<i class="fa-solid fa-chevron-left"></i>';
    prevBtn.disabled = visible.length <= 1;
    prevBtn.addEventListener('click', () => { state.showcaseIndex--; renderShowcaseTab(); });

    const counter = document.createElement('span');
    counter.className = 'cm-showcase-counter';
    counter.textContent = (state.showcaseIndex + 1) + ' / ' + visible.length;

    const nextBtn = document.createElement('button');
    nextBtn.className = 'menu_button cm-showcase-nav-btn';
    nextBtn.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';
    nextBtn.disabled = visible.length <= 1;
    nextBtn.addEventListener('click', () => { state.showcaseIndex++; renderShowcaseTab(); });

    // Card selector dropdown
    const selector = document.createElement('select');
    selector.className = 'cm-showcase-selector textpole';
    visible.forEach((c, i) => {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = c.name + (c.creator ? ' — ' + c.creator : '');
        if (i === state.showcaseIndex) opt.selected = true;
        selector.appendChild(opt);
    });
    selector.addEventListener('change', () => {
        state.showcaseIndex = Number(selector.value);
        renderShowcaseTab();
    });

    
    // Clean mode toggle
    const cleanBtn = document.createElement('button');
    cleanBtn.className = 'menu_button cm-showcase-clean-btn';
    cleanBtn.title = state.showcaseCleanMode ? 'Show controls' : 'Hide controls (screenshot mode)';
    cleanBtn.innerHTML = state.showcaseCleanMode
        ? '<i class="fa-solid fa-eye"></i>'
        : '<i class="fa-solid fa-eye-slash"></i>';
    cleanBtn.addEventListener('click', () => {
        state.showcaseCleanMode = !state.showcaseCleanMode;
        renderShowcaseTab();
    });

    
    // Screenshot download
    const screenshotBtn = document.createElement('button');
    screenshotBtn.className = 'menu_button cm-showcase-clean-btn';
    screenshotBtn.title = 'Download card as PNG';
    screenshotBtn.innerHTML = '<i class="fa-solid fa-camera"></i>';
    screenshotBtn.addEventListener('click', () => {
        const prof = showcase.querySelector('.cm-showcase-profile');
        screenshotShowcase(prof);
    });

    // Controls toggle (visible on mobile)
    const controlsToggle = document.createElement('button');
    controlsToggle.className = 'menu_button cm-showcase-nav-btn cm-showcase-controls-toggle' + (state.showcaseControlsOpen ? ' is-active' : '');
    controlsToggle.innerHTML = '<i class="fa-solid fa-sliders"></i>';
    controlsToggle.title = 'Toggle settings panel';
    controlsToggle.addEventListener('click', () => {
        state.showcaseControlsOpen = !state.showcaseControlsOpen;
        const panel = showcase.querySelector('.cm-showcase-controls');
        if (panel) panel.classList.toggle('is-open', state.showcaseControlsOpen);
        controlsToggle.classList.toggle('is-active', state.showcaseControlsOpen);
        const fab = showcase.querySelector('.cm-showcase-controls-fab');
        if (fab) fab.classList.toggle('cm-hidden', state.showcaseControlsOpen);
    });

    nav.append(prevBtn, counter, selector, nextBtn, cleanBtn, screenshotBtn, controlsToggle);
    showcase.appendChild(nav);


    // ── Theme selector ──
    const themeRow = document.createElement('div');
    themeRow.className = 'cm-showcase-themes';

    const themes = [
        { id: 'default', label: 'Default', icon: 'fa-circle', color: '#1a1a2e', accent: '#e0a030' },
        { id: 'romance', label: 'Romance', icon: 'fa-heart', color: '#3d1f2b', accent: '#e8859a' },
        { id: 'fantasy', label: 'Fantasy', icon: 'fa-hat-wizard', color: '#1f1a33', accent: '#c9a0dc' },
        { id: 'scifi', label: 'Sci-Fi', icon: 'fa-rocket', color: '#0a1218', accent: '#00d4ff' },
        { id: 'horror', label: 'Horror', icon: 'fa-skull', color: '#120808', accent: '#cc2222' },
        { id: 'slice', label: 'Slice of Life', icon: 'fa-sun', color: '#1e2024', accent: '#f0a870' },
        { id: 'noir', label: 'Noir', icon: 'fa-mask', color: '#141414', accent: '#d4d4d4' },
        { id: 'cyberpunk', label: 'Cyberpunk', icon: 'fa-bolt', color: '#0a0012', accent: '#ff2a6d' },
        { id: 'custom', label: 'Custom', icon: 'fa-palette', color: null, accent: state.showcaseCustomAccent },
    ];

    themes.forEach(t => {
        const btn = document.createElement('button');
        btn.className = 'cm-showcase-theme-btn' + (state.showcaseTheme === t.id ? ' is-active' : '');
        btn.title = t.label;
        btn.innerHTML = '<i class="fa-solid ' + (t.icon || 'fa-circle') + '"></i><span>' + t.label + '</span>';
        if (t.color) {
            btn.style.setProperty('--stb-accent', t.accent);
        } else {
            btn.style.setProperty('--stb-accent', state.showcaseCustomAccent);
        }
        btn.addEventListener('click', () => {
            state.showcaseTheme = t.id;
            // Reset custom fonts when selecting a pre-built theme
            if (t.id !== 'custom') {
                state.showcaseCustomFontName = 'system-ui';
                state.showcaseCustomFontHeading = 'system-ui';
                state.showcaseCustomFontBody = 'system-ui';
                state.showcaseCustomFontLabel = 'system-ui';
                state.showcaseCustomBg = '#1a1a1e';
            }
            persistState();
            renderShowcaseTab();
        });
        themeRow.appendChild(btn);
    });

    // Custom accent color picker (only visible when custom theme active)
    if (state.showcaseTheme === 'custom') {
        const picker = document.createElement('input');
        picker.type = 'color';
        picker.className = 'cm-showcase-color-picker';
        picker.value = state.showcaseCustomAccent;
        picker.title = 'Pick accent color';
        picker.addEventListener('input', (e) => {
            state.showcaseCustomAccent = e.target.value;
            persistState();
            // Live update CSS custom property
            showcase.style.setProperty('--sc-accent', e.target.value);
            showcase.style.setProperty('--sc-accent-soft', e.target.value + '22');
        });
        themeRow.appendChild(picker);

        // Background color picker
        const bgPicker = document.createElement('input');
        bgPicker.type = 'color';
        bgPicker.className = 'cm-showcase-color-picker';
        bgPicker.value = state.showcaseCustomBg || '#1a1a1e';
        bgPicker.title = 'Pick background color';
        bgPicker.addEventListener('input', (e) => {
            state.showcaseCustomBg = e.target.value;
            persistState();
            showcase.style.setProperty('--sc-bg', e.target.value);
            showcase.style.setProperty('--sc-surface', e.target.value);
            const prof = showcase.querySelector('.cm-showcase-profile');
            if (prof) prof.style.background = e.target.value;
        });
        themeRow.appendChild(bgPicker);
    }

    
    // ── Controls panel (collapsible on mobile) ──
    const controlsPanel = document.createElement('div');
    controlsPanel.className = 'cm-showcase-controls' + (state.showcaseControlsOpen ? ' is-open' : '');

if (!state.showcaseCleanMode) controlsPanel.appendChild(themeRow);


    
    
    // ── Custom font pickers (only in custom theme) ──
    if (!state.showcaseCleanMode) {
        const fontRow = document.createElement('div');
        fontRow.className = 'cm-showcase-font-row';

        // Load currently selected fonts
        loadGoogleFont(state.showcaseCustomFontName);
        loadGoogleFont(state.showcaseCustomFontHeading);
        loadGoogleFont(state.showcaseCustomFontBody);
        loadGoogleFont(state.showcaseCustomFontLabel);

        fontRow.appendChild(makeShowcaseFontSelect('Name', state.showcaseCustomFontName, (val) => {
            state.showcaseCustomFontName = val;
            if (val !== 'system-ui') { state.showcaseTheme = 'custom'; }
            persistState();
            renderShowcaseTab();
        }));

        fontRow.appendChild(makeShowcaseFontSelect('Heading', state.showcaseCustomFontHeading, (val) => {
            state.showcaseCustomFontHeading = val;
            if (val !== 'system-ui') { state.showcaseTheme = 'custom'; }
            persistState();
            renderShowcaseTab();
        }));

        fontRow.appendChild(makeShowcaseFontSelect('Body', state.showcaseCustomFontBody, (val) => {
            state.showcaseCustomFontBody = val;
            if (val !== 'system-ui') { state.showcaseTheme = 'custom'; }
            persistState();
            renderShowcaseTab();
        }));

        fontRow.appendChild(makeShowcaseFontSelect('Labels', state.showcaseCustomFontLabel, (val) => {
            state.showcaseCustomFontLabel = val;
            if (val !== 'system-ui') { state.showcaseTheme = 'custom'; }
            persistState();
            renderShowcaseTab();
        }));

        controlsPanel.appendChild(fontRow);

        // Live font preview
        const fontPreview = document.createElement('div');
        fontPreview.className = 'cm-showcase-font-preview';

        const previewName = document.createElement('div');
        previewName.className = 'cm-showcase-font-preview-name';
        previewName.textContent = 'Display Name';
        previewName.style.wordBreak = 'break-word';
        const nmFont = state.showcaseCustomFontName !== 'system-ui' ? "'" + state.showcaseCustomFontName + "', " : '';
        previewName.style.fontFamily = nmFont + 'system-ui, sans-serif';

        const previewHeading = document.createElement('div');
        previewHeading.className = 'cm-showcase-font-preview-heading';
        previewHeading.textContent = 'Character Name';
        previewHeading.style.wordBreak = 'break-word';
        const hFont = state.showcaseCustomFontHeading !== 'system-ui' ? "'" + state.showcaseCustomFontHeading + "', " : '';
        previewHeading.style.fontFamily = hFont + 'system-ui, sans-serif';

        const previewLabel = document.createElement('div');
        previewLabel.className = 'cm-showcase-font-preview-label';
        previewLabel.textContent = '≡ DESCRIPTION';
        const lFont = state.showcaseCustomFontLabel !== 'system-ui' ? "'" + state.showcaseCustomFontLabel + "', " : '';
        previewLabel.style.fontFamily = lFont + 'system-ui, sans-serif';

        const previewBody = document.createElement('div');
        previewBody.className = 'cm-showcase-font-preview-body';
        previewBody.textContent = 'The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs.';
        previewBody.style.wordBreak = 'break-word';
        const bFont = state.showcaseCustomFontBody !== 'system-ui' ? "'" + state.showcaseCustomFontBody + "', " : '';
        previewBody.style.fontFamily = bFont + 'system-ui, sans-serif';

        // Loading indicator
        const anyLoading = _loadingFonts.has(state.showcaseCustomFontName) ||
            _loadingFonts.has(state.showcaseCustomFontHeading) ||
            _loadingFonts.has(state.showcaseCustomFontBody) ||
            _loadingFonts.has(state.showcaseCustomFontLabel);
        if (anyLoading) {
            const loadingDot = document.createElement('div');
            loadingDot.className = 'cm-showcase-font-loading';
            loadingDot.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Loading fonts…';
            fontPreview.appendChild(loadingDot);
        }
        fontPreview.append(previewName, previewHeading, previewLabel, previewBody);
        controlsPanel.appendChild(fontPreview);
    }

    // ── Size controls ──
    const settingsRow = document.createElement('div');
    settingsRow.className = 'cm-showcase-settings';

    // Avatar size
    const avatarGroup = makeSettingGroup('Avatar', [
        { id: 'small', label: 'S', icon: null },
        { id: 'medium', label: 'M', icon: null },
        { id: 'large', label: 'L', icon: null },
    ], state.showcaseAvatarSize, (val) => {
        state.showcaseAvatarSize = val;
        persistState();
        renderShowcaseTab();
    });
    settingsRow.appendChild(avatarGroup);

    // Font size slider
    const fontGroup = document.createElement('div');
    fontGroup.className = 'cm-showcase-setting-group cm-showcase-font-slider-group';

    const fontLabel = document.createElement('span');
    fontLabel.className = 'cm-showcase-setting-label';
    fontLabel.textContent = 'Font';
    fontGroup.appendChild(fontLabel);

    const fontStepLabels = ['XS', 'S', 'M−', 'M', 'M+', 'L', 'XL', 'XXL'];
    const fontSliderWrap = document.createElement('div');
    fontSliderWrap.className = 'cm-showcase-slider-wrap';

    const fontSlider = document.createElement('input');
    fontSlider.type = 'range';
    fontSlider.className = 'cm-showcase-font-slider';
    fontSlider.min = 0;
    fontSlider.max = 7;
    fontSlider.step = 1;
    fontSlider.value = state.showcaseFontStep;
    fontSlider.title = fontStepLabels[state.showcaseFontStep];

    const fontValueLabel = document.createElement('span');
    fontValueLabel.className = 'cm-showcase-slider-value';
    fontValueLabel.textContent = fontStepLabels[state.showcaseFontStep];

    fontSlider.addEventListener('input', (e) => {
        const step = Number(e.target.value);
        state.showcaseFontStep = step;
        fontValueLabel.textContent = fontStepLabels[step];
        const fs = [0.7, 0.78, 0.86, 0.92, 1.0, 1.1, 1.25, 1.4];
        showcase.style.setProperty('--sc-font-base', fs[step] + 'rem');
        showcase.style.setProperty('--sc-font-heading', (fs[step] * 1.75) + 'rem');
        persistState();
    });

    fontSliderWrap.append(fontSlider, fontValueLabel);
    fontGroup.appendChild(fontSliderWrap);
    settingsRow.appendChild(fontGroup);

    // Layout
    const layoutGroup = makeSettingGroup('Layout', [
        { id: 'card', label: null, icon: 'fa-id-card' },
        { id: 'page', label: null, icon: 'fa-newspaper' },
    ], state.showcaseLayout, (val) => {
        state.showcaseLayout = val;
        persistState();
        renderShowcaseTab();
    });
    settingsRow.appendChild(layoutGroup);

    // Font override toggle
    

    if (!state.showcaseCleanMode) controlsPanel.appendChild(settingsRow);

    showcase.appendChild(controlsPanel);
    } catch (_fcErr) {
        console.warn('[CardManager] Font controls failed, falling back:', _fcErr);
        // Fallback: append themeRow/settingsRow directly if they exist
        try {
            if (typeof themeRow !== 'undefined') showcase.appendChild(themeRow);
            if (typeof settingsRow !== 'undefined') showcase.appendChild(settingsRow);
        } catch (_fbErr) { /* silent */ }
    }

    // ── Floating controls hint (mobile) ──
    const controlsFab = document.createElement('button');
    controlsFab.className = 'menu_button cm-showcase-controls-fab' + (state.showcaseControlsOpen ? ' cm-hidden' : '');
    controlsFab.innerHTML = '<i class="fa-solid fa-sliders"></i> Settings';
    controlsFab.addEventListener('click', () => {
        state.showcaseControlsOpen = true;
        const panel = showcase.querySelector('.cm-showcase-controls');
        if (panel) panel.classList.toggle('is-open', true);
        controlsToggle.classList.toggle('is-active', true);
        controlsFab.classList.add('cm-hidden');
    });
    showcase.appendChild(controlsFab);


    // ── Profile card ──
    const profile = document.createElement('div');
    profile.className = 'cm-showcase-profile';

    // Left column: avatar
    const avatarCol = document.createElement('div');
    avatarCol.className = 'cm-showcase-avatar-col';

    if (card.hasAvatar) {
        const img = document.createElement('img');
        img.className = 'cm-showcase-avatar';
        img.src = getAvatarUrl(card.avatar);
        img.alt = card.name;
        img.loading = 'eager';
        avatarCol.appendChild(img);
    } else {
        const placeholder = document.createElement('div');
        placeholder.className = 'cm-showcase-avatar-placeholder';
        placeholder.innerHTML = '<i class="fa-solid fa-user"></i>';
        avatarCol.appendChild(placeholder);
    }

    // Stat pills under avatar
    const statPills = document.createElement('div');
    statPills.className = 'cm-showcase-stat-pills';

    statPills.appendChild(makeShowcasePill('fa-quote-left', card.totalTokens.toLocaleString() + ' tokens'));
    if (card.hasLorebook) {
        const lbEntries = card.raw?.data?.character_book?.entries;
        const lbCount = lbEntries ? Object.keys(lbEntries).length : 0;
        statPills.appendChild(makeShowcasePill('fa-book-atlas', 'Lorebook' + (lbCount > 0 ? ' · ' + lbCount + ' entries' : '')));
    }
    if (card.inGroups) {
        statPills.appendChild(makeShowcasePill('fa-users', 'In Group'));
    }
    avatarCol.appendChild(statPills);

    // Tags under stats
    const tagObjs = getTagObjectsForAvatar(card.avatar, ctx);
    if (tagObjs.length > 0) {
        const tagRow = document.createElement('div');
        tagRow.className = 'cm-showcase-tags';
        tagObjs.forEach(t => {
            const pill = document.createElement('span');
            pill.className = 'cm-tag-pill';
            if (t.color) pill.style.backgroundColor = t.color;
            if (t.color2) pill.style.color = t.color2;
            pill.textContent = t.name;
            tagRow.appendChild(pill);
        });
        avatarCol.appendChild(tagRow);
    }

    profile.appendChild(avatarCol);

    // Right column: info
    const infoCol = document.createElement('div');
    infoCol.className = 'cm-showcase-info-col';

    // Name + creator
    const nameBlock = document.createElement('div');
    nameBlock.className = 'cm-showcase-name-block';
    const nameEl = document.createElement('h2');
    nameEl.className = 'cm-showcase-name';
    nameEl.textContent = card.name;
    nameBlock.appendChild(nameEl);
    if (card.creator) {
        const creatorEl = document.createElement('p');
        creatorEl.className = 'cm-showcase-creator';
        creatorEl.innerHTML = '<i class="fa-solid fa-user-pen"></i> ' + escapeHtml(card.creator);
        nameBlock.appendChild(creatorEl);
    }
    infoCol.appendChild(nameBlock);

    // Description
    if (card.description && card.description.trim()) {
        const descSection = document.createElement('div');
        descSection.className = 'cm-showcase-section';
        descSection.innerHTML = '<div class="cm-showcase-section-label"><i class="fa-solid fa-align-left"></i> Description</div>';
        const descBody = document.createElement('div');
        descBody.className = 'cm-showcase-text';
        descBody.innerHTML = formatShowcaseText(card.description);
        descSection.appendChild(descBody);
        infoCol.appendChild(descSection);
    }

    // Personality
    if (card.personality && card.personality.trim()) {
        const persSection = document.createElement('div');
        persSection.className = 'cm-showcase-section';
        persSection.innerHTML = '<div class="cm-showcase-section-label"><i class="fa-solid fa-brain"></i> Personality</div>';
        const persBody = document.createElement('div');
        persBody.className = 'cm-showcase-text cm-showcase-personality';
        persBody.innerHTML = formatShowcaseText(card.personality);
        persSection.appendChild(persBody);
        infoCol.appendChild(persSection);
    }

    // Scenario
    if (card.scenario && card.scenario.trim()) {
        const scenSection = document.createElement('div');
        scenSection.className = 'cm-showcase-section';
        scenSection.innerHTML = '<div class="cm-showcase-section-label"><i class="fa-solid fa-map"></i> Scenario</div>';
        const scenBody = document.createElement('div');
        scenBody.className = 'cm-showcase-text';
        scenBody.innerHTML = formatShowcaseText(card.scenario);
        scenSection.appendChild(scenBody);
        infoCol.appendChild(scenSection);
    }

    // First message
    if (card.firstMes && card.firstMes.trim()) {
        const fmSection = document.createElement('div');
        fmSection.className = 'cm-showcase-section';
        fmSection.innerHTML = '<div class="cm-showcase-section-label"><i class="fa-solid fa-comment-dots"></i> First Message</div>';
        const fmBody = document.createElement('div');
        fmBody.className = 'cm-showcase-text cm-showcase-first-message';
        const preview = card.firstMes.length > 600 ? card.firstMes.slice(0, 600) + '…' : card.firstMes;
        fmBody.innerHTML = formatShowcaseText(preview);
        fmSection.appendChild(fmBody);
        infoCol.appendChild(fmSection);
    }

    // Token breakdown
    if (card.fieldTokens) {
        const tokenSection = document.createElement('div');
        tokenSection.className = 'cm-showcase-section';
        tokenSection.innerHTML = '<div class="cm-showcase-section-label"><i class="fa-solid fa-chart-bar"></i> Token Breakdown</div>';
        const bars = document.createElement('div');
        bars.className = 'cm-showcase-token-bars';

        const fields = [
            { key: 'description', label: 'Description', color: 'var(--cm-accent, #e0a030)' },
            { key: 'firstMes', label: 'First Message', color: '#6cba6c' },
            { key: 'personality', label: 'Personality', color: '#6c9fdb' },
            { key: 'scenario', label: 'Scenario', color: '#c97bdb' },
            { key: 'mesExample', label: 'Examples', color: '#db7b7b' },
            { key: 'creatorNotes', label: 'Creator Notes', color: '#7bdbc9' },
        ];
        const maxTokens = Math.max(1, ...fields.map(f => card.fieldTokens[f.key] || 0));

        fields.forEach(f => {
            const val = card.fieldTokens[f.key] || 0;
            if (val === 0) return;
            const pct = Math.round((val / maxTokens) * 100);
            const row = document.createElement('div');
            row.className = 'cm-showcase-bar-row';
            row.innerHTML = ''
                + '<span class="cm-showcase-bar-label">' + f.label + '</span>'
                + '<div class="cm-showcase-bar-track">'
                +   '<div class="cm-showcase-bar-fill" style="width:' + pct + '%;background:' + f.color + '"></div>'
                + '</div>'
                + '<span class="cm-showcase-bar-value">' + val.toLocaleString() + '</span>';
            bars.appendChild(row);
        });

        tokenSection.appendChild(bars);
        infoCol.appendChild(tokenSection);
    }

    profile.appendChild(infoCol);
    // Collapsible sections — click label to toggle
    profile.addEventListener('click', (e) => {
        const label = e.target.closest('.cm-showcase-section-label');
        if (!label) return;
        const section = label.parentElement;
        if (!section) return;
        section.classList.toggle('is-collapsed');
    });
    showcase.appendChild(profile);

    grid.appendChild(showcase);

    // Keyboard: ← → navigation is handled in the global keydown listener
}


function makeSettingGroup(label, options, activeValue, onChange) {
    const group = document.createElement('div');
    group.className = 'cm-showcase-setting-group';

    const lbl = document.createElement('span');
    lbl.className = 'cm-showcase-setting-label';
    lbl.textContent = label;
    group.appendChild(lbl);

    const btnRow = document.createElement('div');
    btnRow.className = 'cm-showcase-setting-btns';

    options.forEach((opt, i) => {
        const btn = document.createElement('button');
        btn.className = 'cm-showcase-setting-btn' + (activeValue === opt.id ? ' is-active' : '');
        btn.title = opt.id.charAt(0).toUpperCase() + opt.id.slice(1);
        if (opt.icon) {
            btn.innerHTML = '<i class="fa-solid ' + opt.icon + '"></i>';
        } else {
            btn.textContent = opt.label;
        }
        // Visual size hint for font buttons
        if (label === 'Font') {
            btn.style.fontSize = ['0.68rem', '0.82rem', '0.96rem'][i];
        }
        btn.addEventListener('click', () => onChange(opt.id));
        btnRow.appendChild(btn);
    });

    group.appendChild(btnRow);
    return group;
}

function makeShowcasePill(icon, text) {
    const pill = document.createElement('span');
    pill.className = 'cm-showcase-pill';
    pill.innerHTML = '<i class="fa-solid ' + icon + '"></i> ' + text;
    return pill;
}

function formatShowcaseText(text) {
    if (!text) return '';
    // Escape HTML, preserve line breaks, highlight {{user}} and {{char}} macros
    let html = escapeHtml(text);
    html = html.replace(/\n/g, '<br>');
    html = html.replace(/\{\{user\}\}/gi, '<mark class="cm-showcase-macro">{{user}}</mark>');
    html = html.replace(/\{\{char\}\}/gi, '<mark class="cm-showcase-macro">{{char}}</mark>');
    return html;
}


function renderImportTab() {
    const grid = state.dom.grid;
    if (!grid) return;
    grid.innerHTML = '';
    setEmpty('');

    const container = document.createElement('div');
    container.className = 'cm-import';

    // Drop zone
    const dropSection = document.createElement('section');
    dropSection.className = 'cm-export-section';
    dropSection.innerHTML = ''
        + '<h3 class="cm-stats-heading"><i class="fa-solid fa-file-import"></i> Import Characters</h3>'
        + '<p class="cm-export-desc">Import character cards from PNG (V2) or JSON files.</p>'
        + '<div class="cm-import-dropzone" id="cm-import-dropzone">'
        +   '<i class="fa-solid fa-cloud-arrow-up"></i>'
        +   '<p>Drag & drop files here</p>'
        +   '<span class="cm-muted">or</span>'
        +   '<button class="menu_button" id="cm-import-browse"><i class="fa-solid fa-folder-open"></i> Browse Files</button>'
        +   '<input type="file" id="cm-import-file-input" multiple accept=".png,.json" hidden>'
        +   '<span class="cm-export-hint">Supports: PNG (V2 cards), JSON</span>'
        + '</div>';
    container.appendChild(dropSection);

    // Preview list (shown after files are selected)
    if (state.importFiles.length > 0) {
        const previewSection = document.createElement('section');
        previewSection.className = 'cm-export-section';
        previewSection.id = 'cm-import-preview';

        const dupeNames = new Set(state.characters.map(c => c.name.toLowerCase().trim()));

        let previewRows = '';
        state.importFiles.forEach((f, i) => {
            const isDupe = dupeNames.has(f.detectedName.toLowerCase().trim());
            const dupeIcon = isDupe ? '<i class="fa-solid fa-triangle-exclamation cm-import-dupe-icon" title="A character with this name already exists"></i>' : '';
            previewRows += ''
                + '<div class="cm-import-preview-row' + (f.excluded ? ' is-excluded' : '') + '" data-import-index="' + i + '">'
                +   '<label class="cm-import-checkbox"><input type="checkbox" ' + (f.excluded ? '' : 'checked') + ' data-import-action="toggle" data-import-index="' + i + '"></label>'
                +   '<span class="cm-import-file-icon"><i class="fa-solid ' + getFileIcon(f.file) + '"></i></span>'
                +   '<span class="cm-import-name">' + escapeHtml(f.detectedName) + dupeIcon + '</span>'
                +   '<span class="cm-muted cm-import-size">' + formatBytes(f.file.size) + '</span>'
                + '</div>';
        });

        const included = state.importFiles.filter(f => !f.excluded).length;
        previewSection.innerHTML = ''
            + '<h3 class="cm-stats-heading"><i class="fa-solid fa-list-check"></i> Preview — ' + included + ' of ' + state.importFiles.length + ' files</h3>'
            + '<div class="cm-import-preview-list">' + previewRows + '</div>'
            + '<div class="cm-export-actions">'
            +   '<button class="menu_button cm-export-btn" id="cm-import-start" ' + (included === 0 ? 'disabled' : '') + '><i class="fa-solid fa-file-import"></i> Import ' + included + ' Cards</button>'
            +   '<button class="menu_button cm-export-btn" id="cm-import-clear"><i class="fa-solid fa-xmark"></i> Clear</button>'
            + '</div>';
        container.appendChild(previewSection);
    }

    // Progress (hidden by default)
    const progressSection = document.createElement('section');
    progressSection.className = 'cm-export-section cm-hidden';
    progressSection.id = 'cm-import-progress';
    progressSection.innerHTML = ''
        + '<h3 class="cm-stats-heading"><i class="fa-solid fa-spinner fa-spin"></i> Importing...</h3>'
        + '<div class="cm-export-progress">'
        +   '<div class="cm-progress-bar"><div class="cm-progress-fill" id="cm-import-progress-fill"></div></div>'
        +   '<div class="cm-progress-info"><span id="cm-import-progress-text">0 / 0</span><span id="cm-import-progress-pct">0%</span></div>'
        +   '<div class="cm-progress-controls"><button class="menu_button cm-danger" id="cm-import-cancel"><i class="fa-solid fa-xmark"></i> Cancel</button></div>'
        + '</div>';
    container.appendChild(progressSection);

    // Errors (hidden by default)
    const errorSection = document.createElement('section');
    errorSection.className = 'cm-export-section cm-hidden';
    errorSection.id = 'cm-import-errors-section';
    errorSection.innerHTML = ''
        + '<h3 class="cm-stats-heading"><i class="fa-solid fa-triangle-exclamation"></i> Errors</h3>'
        + '<div class="cm-export-errors" id="cm-import-errors"></div>';
    container.appendChild(errorSection);

    // History
    const historySection = document.createElement('section');
    historySection.className = 'cm-export-section';
    let historyHtml = '<h3 class="cm-stats-heading"><i class="fa-solid fa-clock-rotate-left"></i> Import History</h3>';
    if (state.importHistory.length === 0) {
        historyHtml += '<div class="cm-export-history"><span class="cm-muted">No imports yet this session.</span></div>';
    } else {
        historyHtml += '<div class="cm-export-history">';
        const reversed = state.importHistory.slice().reverse();
        for (const entry of reversed) {
            const icon = entry.success ? 'fa-circle-check' : 'fa-circle-xmark';
            const cls = entry.success ? 'cm-history-success' : 'cm-history-fail';
            historyHtml += '<div class="cm-history-row ' + cls + '">'
                + '<span class="cm-history-icon"><i class="fa-solid ' + icon + ' "></i></span>'
                + '<span class="cm-history-name">' + escapeHtml(entry.label) + '</span>'
                + '<span class="cm-history-detail">' + entry.count + ' cards</span>'
                + '<span class="cm-history-time">' + entry.time + '</span>'
                + '</div>';
        }
        historyHtml += '</div>';
    }
    historySection.innerHTML = historyHtml;
    container.appendChild(historySection);

    grid.appendChild(container);

    // Bind events
    bindImportEvents();
}

function getFileIcon(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'png') return 'fa-image';
    if (ext === 'json') return 'fa-code';
    return 'fa-file';
}

function bindImportEvents() {
    const dropzone = document.getElementById('cm-import-dropzone');
    const fileInput = document.getElementById('cm-import-file-input');
    const browseBtn = document.getElementById('cm-import-browse');

    if (dropzone) {
        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.classList.add('is-dragover');
        });
        dropzone.addEventListener('dragleave', () => {
            dropzone.classList.remove('is-dragover');
        });
        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.classList.remove('is-dragover');
            handleImportFiles(e.dataTransfer.files);
        });
    }

    browseBtn?.addEventListener('click', () => fileInput?.click());
    fileInput?.addEventListener('change', (e) => {
        handleImportFiles(e.target.files);
        e.target.value = '';
    });

    // Preview toggles
    document.getElementById('cm-import-preview')?.addEventListener('change', (e) => {
        const cb = e.target.closest('[data-import-action="toggle"]');
        if (!cb) return;
        const idx = Number(cb.dataset.importIndex);
        if (state.importFiles[idx]) {
            state.importFiles[idx].excluded = !cb.checked;
            renderImportTab();
        }
    });

    document.getElementById('cm-import-start')?.addEventListener('click', runImport);
    document.getElementById('cm-import-clear')?.addEventListener('click', () => {
        state.importFiles = [];
        renderImportTab();
    });
    document.getElementById('cm-import-cancel')?.addEventListener('click', () => {
        state.importCancelled = true;
    });
}

async function handleImportFiles(fileList) {
    if (!fileList || fileList.length === 0) return;

    const validExts = ['png', 'json'];
    const newFiles = [];

    for (const file of fileList) {
        const ext = file.name.split('.').pop().toLowerCase();
        if (!validExts.includes(ext)) continue;

        // Detect name from filename (strip extension)
        const detectedName = file.name.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ').trim() || 'Unknown';

        newFiles.push({
            file,
            detectedName,
            excluded: false,
        });
    }

    if (newFiles.length === 0) {
        toastr?.warning?.('No valid character files found. Supported: PNG, JSON');
        return;
    }

    state.importFiles = [...state.importFiles, ...newFiles];
    renderImportTab();
}

async function runImport() {
    const files = state.importFiles.filter(f => !f.excluded);
    if (files.length === 0) return;
    if (state.importInProgress) return;

    state.importInProgress = true;
    state.importCancelled = false;

    const progressSection = document.getElementById('cm-import-progress');
    const errorsSection = document.getElementById('cm-import-errors-section');
    const errorsContainer = document.getElementById('cm-import-errors');
    const progressFill = document.getElementById('cm-import-progress-fill');
    const progressText = document.getElementById('cm-import-progress-text');
    const progressPct = document.getElementById('cm-import-progress-pct');

    progressSection?.classList.remove('cm-hidden');
    errorsSection?.classList.add('cm-hidden');
    if (errorsContainer) errorsContainer.innerHTML = '';

    const errors = [];
    let completed = 0;
    const total = files.length;

    function updateProgress() {
        const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
        if (progressFill) progressFill.style.width = pct + '%';
        if (progressText) progressText.textContent = completed + ' / ' + total;
        if (progressPct) progressPct.textContent = pct + '%';
    }
    updateProgress();

    for (const entry of files) {
        if (state.importCancelled) {
            errors.push({ name: '(cancelled)', error: 'Import cancelled at ' + completed + '/' + total });
            break;
        }

        try {
            const formData = new FormData();
            formData.append('avatar', entry.file, entry.file.name);
            formData.append('file_type', entry.file.name.split('.').pop().toLowerCase());

            // Get headers but strip Content-Type so browser sets multipart boundary
            const baseHeaders = getRequestHeaders();
            const headers = Object.fromEntries(
                Object.entries(baseHeaders).filter(([k]) => k.toLowerCase() !== 'content-type')
            );

            const resp = await fetch('/api/characters/import', {
                method: 'POST',
                headers,
                body: formData,
            });

            if (!resp.ok) {
                const text = await resp.text().catch(() => '');
                throw new Error('HTTP ' + resp.status + (text ? ': ' + text.slice(0, 120) : ''));
            }

            // Server returns { file_name } on success or { error: true } on failure
            const result = await resp.json().catch(() => null);
            if (result && result.error) throw new Error('Server error (invalid character card?)');

        } catch (err) {
            errors.push({ name: entry.detectedName, error: err.message || 'Unknown error' });
        }

        completed++;
        updateProgress();

        // Small delay between imports
        if (total > 3) await sleep(100);
    }

    // Show errors if any
    if (errors.length > 0 && errorsSection && errorsContainer) {
        errorsSection.classList.remove('cm-hidden');
        errors.forEach(e => {
            const row = document.createElement('div');
            row.className = 'cm-error-row';
            row.innerHTML = '<span class="cm-error-name">' + escapeHtml(e.name) + '</span>'
                + '<span class="cm-error-msg">' + escapeHtml(e.error) + '</span>';
            errorsContainer.appendChild(row);
        });
    }

    // History entry
    const successCount = completed - errors.length;
    state.importHistory.push({
        label: successCount + ' imported' + (errors.length > 0 ? ', ' + errors.length + ' failed' : ''),
        count: successCount,
        time: new Date().toLocaleTimeString(),
        success: errors.length === 0 && !state.importCancelled,
    });
    if (state.importHistory.length > 5) state.importHistory.shift();

    // Cleanup
    state.importInProgress = false;
    state.importCancelled = false;
    state.importFiles = [];

    if (successCount > 0) {
        toastr?.success?.('Imported ' + successCount + ' character cards.');
        // Refresh ST's character list so ctx.characters is up-to-date
        try {
            const ctx2 = getContext();
            if (ctx2?.eventSource && ctx2?.event?.CHARACTER_PAGE_LOADED) {
                await ctx2.eventSource.emit(ctx2.event.CHARACTER_PAGE_LOADED);
            } else if (ctx2?.eventSource && ctx2?.event_types?.CHARACTER_PAGE_LOADED) {
                await ctx2.eventSource.emit(ctx2.event_types.CHARACTER_PAGE_LOADED);
            } else if (typeof getCharacters === 'function') {
                await getCharacters();
            } else if (typeof window.getCharacters === 'function') {
                await window.getCharacters();
            }
        } catch (e) {
            console.warn('[card-manager] Could not refresh ST character list after import:', e);
        }
        // Wait for ST to finish reloading characters from server
        await sleep(500);
        await refreshData(false);
    }
    if (errors.length > 0) {
        toastr?.warning?.(errors.length + ' imports failed.');
    }

    renderImportTab();
}



// ═══════════════════════════════════════════════════════════
// DUPLICATE DETECTION (Stats tab addition)
// ═══════════════════════════════════════════════════════════

function buildDuplicateReport(stats) {
    const section = statsSection('Possible Duplicates');
    const chars = state.characters;

    // Group by lowercase name
    const nameGroups = {};
    chars.forEach(c => {
        const key = c.name.toLowerCase().trim();
        if (!nameGroups[key]) nameGroups[key] = [];
        nameGroups[key].push(c);
    });

    const dupes = Object.entries(nameGroups).filter(([, arr]) => arr.length > 1);

    if (dupes.length === 0) {
        section.appendChild(makeMuted('No duplicates found — all character names are unique.'));
        return section;
    }

    const list = document.createElement('div');
    list.className = 'cm-duplicates-list';

    dupes.forEach(([name, cards]) => {
        const group = document.createElement('div');
        group.className = 'cm-dupe-group';

        const header = document.createElement('div');
        header.className = 'cm-dupe-header';
        header.innerHTML = '<i class="fa-solid fa-copy"></i> '
            + '<strong>' + escapeHtml(cards[0].name) + '</strong>'
            + ' <span class="cm-muted">× ' + cards.length + '</span>';
        group.appendChild(header);

        const rows = document.createElement('div');
        rows.className = 'cm-dupe-rows';

        cards.forEach(c => {
            const row = document.createElement('div');
            row.className = 'cm-dupe-row';

            // Avatar (built via DOM API to avoid XSS from avatar URLs)
            const avatarSpan = document.createElement('span');
            avatarSpan.className = 'cm-dupe-avatar';
            if (c.hasAvatar) {
                const img = document.createElement('img');
                img.src = getAvatarUrl(c.avatar);
                img.loading = 'lazy';
                avatarSpan.appendChild(img);
            } else {
                avatarSpan.innerHTML = '<i class="fa-solid fa-user"></i>';
            }
            row.appendChild(avatarSpan);

            // Info
            const infoSpan = document.createElement('span');
            infoSpan.className = 'cm-dupe-info';
            const nameSpan = document.createElement('span');
            nameSpan.className = 'cm-dupe-card-name';
            nameSpan.textContent = c.name;
            const metaSpan = document.createElement('span');
            metaSpan.className = 'cm-muted';
            metaSpan.textContent = (c.creator || 'unknown') + ' · ' + c.totalTokens.toLocaleString() + ' tok';
            infoSpan.append(nameSpan, metaSpan);
            row.appendChild(infoSpan);

            // Action buttons
            const openBtn = document.createElement('button');
            openBtn.className = 'menu_button cm-dupe-open';
            openBtn.dataset.cmDupeIndex = c.index;
            openBtn.title = 'Open in editor';
            openBtn.innerHTML = '<i class="fa-solid fa-arrow-right"></i>';
            row.appendChild(openBtn);

            const delBtn = document.createElement('button');
            delBtn.className = 'menu_button cm-danger cm-dupe-delete';
            delBtn.dataset.cmDupeIndex = c.index;
            delBtn.title = 'Delete';
            delBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
            row.appendChild(delBtn);

            rows.appendChild(row);
        });

        group.appendChild(rows);
        list.appendChild(group);
    });

    // Event delegation
    list.addEventListener('click', async (e) => {
        const openBtn = e.target.closest('.cm-dupe-open');
        const deleteBtn = e.target.closest('.cm-dupe-delete');

        if (openBtn) {
            const idx = Number(openBtn.dataset.cmDupeIndex);
            const card = state.characters.find(c => c.index === idx);
            if (card) { navigateToCharacter(card); closeManager(); }
        }

        if (deleteBtn) {
            const idx = Number(deleteBtn.dataset.cmDupeIndex);
            const card = state.characters.find(c => c.index === idx);
            if (card) {
                await deleteSingleCard(card);
                renderManager();
            }
        }
    });

    section.appendChild(list);
    return section;
}


function renderExportTab() {
    const grid = state.dom.grid;
    if (!grid) return;
    grid.innerHTML = '';
    setEmpty('');

    const container = document.createElement('div');
    container.className = 'cm-export';

    const selectedCount = state.selectedCards.size;
    const totalCount = state.characters.length;
    const filteredCount = getVisibleCards().length;
    const fmt = state.exportFormat || 'png';
    const fmtLabel = fmt === 'png' ? 'V2 PNG' : 'JSON';

    // ── Settings Section ──
    const settingsSection = document.createElement('section');
    settingsSection.className = 'cm-export-section';
    
    const pngActive = fmt === 'png' ? 'is-active' : '';
    const jsonActive = fmt === 'json' ? 'is-active' : '';
    const tplValue = escapeHtml(state.exportFilenameTemplate);

    settingsSection.innerHTML = '<h3 class="cm-stats-heading"><i class="fa-solid fa-gear"></i> Export Settings</h3>'
        + '<div class="cm-export-settings">'
        + '<div class="cm-export-setting-row">'
        +   '<label class="cm-export-label">Format</label>'
        +   '<div class="cm-export-format-group">'
        +     '<button class="cm-format-btn ' + pngActive + '" data-cm-format="png"><i class="fa-solid fa-image"></i> PNG Card</button>'
        +     '<button class="cm-format-btn ' + jsonActive + '" data-cm-format="json"><i class="fa-solid fa-code"></i> JSON</button>'
        +   '</div>'
        + '</div>'
        + ''
        + '<div class="cm-export-setting-row">'
        +   '<label class="cm-export-label">Filename Template</label>'
        +   '<input type="text" class="text_pole cm-export-template-input" id="cm-export-template" value="' + tplValue + '" placeholder="{name}">'
        +   '<span class="cm-export-hint">Variables: {name}, {date}, {index}, {creator}</span>'
        + '</div>'
        + '</div>';
    container.appendChild(settingsSection);

    // ── Actions Section ──
    const actionsSection = document.createElement('section');
    actionsSection.className = 'cm-export-section';
    actionsSection.innerHTML = '<h3 class="cm-stats-heading"><i class="fa-solid fa-file-export"></i> Export</h3>'
        + '<p class="cm-export-desc">Export character cards as ' + fmtLabel + ' files in a ZIP archive.</p>'
        + '<div class="cm-export-actions">'
        +   '<button class="menu_button cm-export-btn" id="cm-export-all" ' + (totalCount === 0 ? 'disabled' : '') + '><i class="fa-solid fa-file-zipper"></i> All (' + totalCount + ')</button>'
        +   '<button class="menu_button cm-export-btn" id="cm-export-filtered" ' + (filteredCount === 0 ? 'disabled' : '') + '><i class="fa-solid fa-filter"></i> Filtered (' + filteredCount + ')</button>'
        +   '<button class="menu_button cm-export-btn" id="cm-export-selected" ' + (selectedCount === 0 ? 'disabled' : '') + '><i class="fa-solid fa-check-double"></i> Selected (' + selectedCount + ')</button>'
        +   '<button class="menu_button cm-export-btn cm-export-preview-btn" id="cm-export-preview-toggle"><i class="fa-solid fa-eye"></i> Preview</button>'
        + '</div>';
    container.appendChild(actionsSection);

    // ── Preview Section ──
    const previewSection = document.createElement('section');
    previewSection.className = 'cm-export-section cm-export-preview-section';
    previewSection.id = 'cm-export-preview-section';
    if (!state.exportPreviewVisible) previewSection.classList.add('cm-hidden');
    const previewChars = selectedCount > 0 ? getSelectedCharacters() : getVisibleCards();
    const previewLabel = selectedCount > 0 ? 'Selected' : 'Filtered/All';
    let previewRows = '';
    const previewSlice = previewChars.slice(0, 50);
    for (const c of previewSlice) {
        const fname = resolveExportFilename(c);
        previewRows += '<div class="cm-preview-row">'
            + '<span class="cm-preview-name">' + escapeHtml(c.name) + '</span>'
            + '<span class="cm-preview-arrow"><i class="fa-solid fa-arrow-right"></i></span>'
            + '<span class="cm-preview-filename">' + escapeHtml(fname) + '.' + fmt + '</span>'
            + '</div>';
    }
    const moreCount = Math.max(0, previewChars.length - 50);
    previewSection.innerHTML = '<h3 class="cm-stats-heading"><i class="fa-solid fa-list-check"></i> Preview \u2014 ' + previewLabel + ' (' + previewChars.length + ')</h3>'
        + '<div class="cm-export-preview-list">' + previewRows + '</div>'
        + (moreCount > 0 ? '<span class="cm-muted">\u2026and ' + moreCount + ' more</span>' : '');
    container.appendChild(previewSection);

    // ── Progress Section ──
    const progressSection = document.createElement('section');
    progressSection.className = 'cm-export-section';
    progressSection.id = 'cm-export-progress-section';
    progressSection.classList.add('cm-hidden');
    progressSection.innerHTML = '<h3 class="cm-stats-heading"><i class="fa-solid fa-spinner fa-spin"></i> Progress</h3>'
        + '<div class="cm-export-progress">'
        +   '<div class="cm-progress-bar"><div class="cm-progress-fill" id="cm-progress-fill"></div></div>'
        +   '<div class="cm-progress-info"><span id="cm-progress-text">0 / 0</span><span id="cm-progress-pct">0%</span></div>'
        +   '<div class="cm-progress-controls"><button class="menu_button cm-danger" id="cm-export-cancel"><i class="fa-solid fa-xmark"></i> Cancel</button></div>'
        + '</div>';
    container.appendChild(progressSection);

    // ── Error Log ──
    const errorSection = document.createElement('section');
    errorSection.className = 'cm-export-section cm-hidden';
    errorSection.id = 'cm-export-errors-section';
    errorSection.innerHTML = '<h3 class="cm-stats-heading"><i class="fa-solid fa-triangle-exclamation"></i> Errors</h3>'
        + '<div class="cm-export-errors" id="cm-export-errors"></div>';
    container.appendChild(errorSection);

    // ── History ──
    const historySection = document.createElement('section');
    historySection.className = 'cm-export-section';
    let historyHtml = '<h3 class="cm-stats-heading"><i class="fa-solid fa-clock-rotate-left"></i> Export History</h3>';
    if (state.exportHistory.length === 0) {
        historyHtml += '<div class="cm-export-history"><span class="cm-muted">No exports yet this session.</span></div>';
    } else {
        historyHtml += '<div class="cm-export-history">';
        const reversed = state.exportHistory.slice().reverse();
        for (const entry of reversed) {
            const icon = entry.success ? 'fa-circle-check' : 'fa-circle-xmark';
            const cls = entry.success ? 'cm-history-success' : 'cm-history-fail';
            const fmtStr = (entry.format || 'png').toUpperCase();
            historyHtml += '<div class="cm-history-row ' + cls + '">'
                + '<span class="cm-history-icon"><i class="fa-solid ' + icon + '"></i></span>'
                + '<span class="cm-history-name">' + escapeHtml(entry.filename) + '</span>'
                + '<span class="cm-history-detail">' + entry.count + ' cards \u00b7 ' + formatBytes(entry.size) + ' \u00b7 ' + fmtStr + '</span>'
                + '<span class="cm-history-time">' + entry.time + '</span>'
                + '</div>';
        }
        historyHtml += '</div>';
    }
    historySection.innerHTML = historyHtml;
    container.appendChild(historySection);

    grid.appendChild(container);

    // ── Bind events ──
    document.getElementById('cm-export-all')?.addEventListener('click', () => runZipExport('all'));
    document.getElementById('cm-export-selected')?.addEventListener('click', () => runZipExport('selected'));
    document.getElementById('cm-export-filtered')?.addEventListener('click', () => runZipExport('filtered'));
    document.getElementById('cm-export-cancel')?.addEventListener('click', () => { state.exportCancelled = true; });

    container.querySelectorAll('[data-cm-format]').forEach(btn => {
        btn.addEventListener('click', () => {
            state.exportFormat = btn.dataset.cmFormat;
            renderExportTab();
        });
    });

    

    document.getElementById('cm-export-template')?.addEventListener('input', (e) => {
        state.exportFilenameTemplate = e.target.value || '{name}';
    });

    document.getElementById('cm-export-preview-toggle')?.addEventListener('click', () => {
        state.exportPreviewVisible = !state.exportPreviewVisible;
        const el = document.getElementById('cm-export-preview-section');
        if (el) el.classList.toggle('cm-hidden', !state.exportPreviewVisible);
    });
}

// ══════════════════════════════════════════════════════════════
// ZIP EXPORT ENGINE
// ══════════════════════════════════════════════════════════════

async function ensureJSZip() {
    if (window.JSZip) return window.JSZip;
    // Try loading from ST's bundled lib or CDN
    const sources = [
        '/lib/jszip.min.js',
        'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
    ];
    for (const src of sources) {
        try {
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = src;
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
            if (window.JSZip) return window.JSZip;
        } catch (_) { continue; }
    }
    throw new Error('JSZip library not available. Cannot create ZIP archive.');
}

async function runZipExport(mode) {
  try {
    if (state.exportInProgress) { toastr?.info?.('Export already in progress.'); return; }

    let chars;
    switch (mode) {
        case 'selected':
            chars = getSelectedCharacters();
            if (chars.length === 0) { toastr?.info?.('No cards selected.'); return; }
            break;
        case 'filtered':
            chars = getVisibleCards();
            if (chars.length === 0) { toastr?.info?.('No cards match current filters.'); return; }
            break;
        case 'all':
        default:
            chars = state.characters;
            break;
    }

    let JSZipLib;
    try {
        JSZipLib = await ensureJSZip();
    } catch (err) {
        toastr?.error?.(err.message);
        return;
    }

    state.exportInProgress = true;
    state.exportCancelled = false;

    const progressSection = document.getElementById('cm-export-progress-section');
    const errorsSection = document.getElementById('cm-export-errors-section');
    const errorsContainer = document.getElementById('cm-export-errors');
    const progressFill = document.getElementById('cm-progress-fill');
    const progressText = document.getElementById('cm-progress-text');
    const progressPct = document.getElementById('cm-progress-pct');

    progressSection?.classList.remove('cm-hidden');
    errorsSection?.classList.add('cm-hidden');
    if (errorsContainer) errorsContainer.innerHTML = '';

    const zip = new JSZipLib();
    const errors = [];
    const usedNames = new Set();
    let completed = 0;
    const total = chars.length;

    function updateProgress() {
        const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
        if (progressFill) progressFill.style.width = `${pct}%`;
        if (progressText) progressText.textContent = `${completed} / ${total}`;
        if (progressPct) progressPct.textContent = `${pct}%`;
    }

    updateProgress();

    for (const c of chars) {
        if (state.exportCancelled) {
            errors.push({ name: '(cancelled)', error: `Export cancelled at ${completed}/${total}` });
            break;
        }

        try {
            if (!c.avatar || c.avatar === 'none') throw new Error('No avatar file');
            const resp = await fetch('/api/characters/export', {
                method: 'POST',
                headers: getRequestHeaders(),
                body: JSON.stringify({ avatar_url: c.avatar, format: state.exportFormat || 'png' }),
            });
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const blob = await resp.blob();

            let filename = resolveExportFilename(c);
            if (usedNames.has(filename.toLowerCase())) {
                filename += `_${c.index}`;
            }
            usedNames.add(filename.toLowerCase());

            zip.file(`${filename}.${state.exportFormat || 'png'}`, blob);
        } catch (err) {
            errors.push({ name: c.name, error: err.message || 'Unknown error' });
        }

        completed++;
        updateProgress();

        if (total > 5) await sleep(50);
    }

    // Generate ZIP
    let zipBlob = null;
    let zipSize = 0;
    if (!state.exportCancelled && completed > errors.length) {
        try {
            if (progressText) progressText.textContent = 'Generating ZIP…';
            zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
            zipSize = zipBlob.size;
        } catch (err) {
            errors.push({ name: '(zip)', error: `ZIP generation failed: ${err.message}` });
        }
    }

    // Download
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
    const zipFilename = `characters-${mode}-${timestamp}.zip`;

    if (zipBlob) {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(zipBlob);
        a.download = zipFilename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
        toastr?.success?.(`Exported ${completed - errors.length} cards as ${zipFilename}`);
    }

    // Errors
    if (errors.length > 0 && errorsSection && errorsContainer) {
        errorsSection.classList.remove('cm-hidden');
        errors.forEach(e => {
            const row = document.createElement('div');
            row.className = 'cm-error-row';
            row.innerHTML = `<span class="cm-error-name">${escapeHtml(e.name)}</span><span class="cm-error-msg">${escapeHtml(e.error)}</span>`;
            errorsContainer.appendChild(row);
        });
    }

    // History
    state.exportHistory.push({
        filename: zipFilename,
        count: completed - errors.length,
        size: zipSize,
        time: new Date().toLocaleTimeString(),
        format: state.exportFormat || 'png',
        success: errors.length === 0 && !state.exportCancelled,
    });
    if (state.exportHistory.length > 5) state.exportHistory.shift();

    state.exportInProgress = false;
    state.exportCancelled = false;

    // Re-render to update history
    renderExportTab();
} catch (err) {
        console.error('[CardManager] Export failed:', err);
        toastr?.error?.('Export failed: ' + (err.message || 'Unknown error'));
        state.exportInProgress = false;
        state.exportCancelled = false;
    }
}

function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

// ══════════════════════════════════════════════════════════════
// SELECTION ACTIONS
// ══════════════════════════════════════════════════════════════

function onGridClick(e) {
    const card = e.target.closest('.cm-card');
    if (!card) return;
    const idx = Number(card.dataset.charIndex);

    // Checkbox toggle
    if (e.target.closest('[data-cm-action="toggle-select"]')) {
        if (state.selectedCards.has(idx)) {
            state.selectedCards.delete(idx);
        } else {
            state.selectedCards.add(idx);
        }
        updateSelectUI();
        // Update just this card's visual
        card.classList.toggle('is-selected', state.selectedCards.has(idx));
        const cb = card.querySelector('.cm-card-checkbox i');
        if (cb) cb.className = state.selectedCards.has(idx) ? 'fa-solid fa-check' : 'fa-regular fa-square';
        return;
    }

    // Card actions
    const actionBtn = e.target.closest('[data-cm-card-action]');
    if (actionBtn) {
        const action = actionBtn.dataset.cmCardAction;
        const charRecord = state.characters[idx];
        if (!charRecord) return;

        switch (action) {
            case 'open':
                closeManager();
                navigateToCharacter(charRecord);
                break;
            case 'export':
                exportSingleCard(charRecord);
                break;
            case 'delete':
                deleteSingleCard(charRecord);
                break;
            case 'edit-tags':
                openTagEditor(charRecord.avatar, actionBtn);
                break;
            case 'remove-folder':
                assignCardToFolder(charRecord.avatar, null);
                renderManager();
                break;
        }
        return;
    }

    // Clicking the avatar cover = navigate to character
    if (e.target.closest('.cm-card-cover')) {
        const charRecord = state.characters[idx];
        if (charRecord) {
            closeManager();
            navigateToCharacter(charRecord);
        }
    }
}

function navigateToCharacter(charRecord) {
    try {
        const ctx = getContext();
        if (typeof ctx.selectCharacterById === 'function') {
            ctx.selectCharacterById(charRecord.index);
        } else if (typeof window.selectCharacterById === 'function') {
            window.selectCharacterById(charRecord.index);
        } else {
            toastr?.info?.(`Select "${charRecord.name}" manually.`);
            return;
        }
        toastr?.success?.(`Switched to ${charRecord.name}`);
    } catch (err) {
        console.error(`[${MODULE_NAME}] Failed to navigate`, err);
    }
}

async function exportSingleCard(charRecord) {
    if (state._exportingCard) return;
    state._exportingCard = true;
    toastr?.info?.(`Exporting ${charRecord.name}...`, '', { timeOut: 15000, extendedTimeOut: 0, tapToDismiss: false });
    try {
        const headers = getRequestHeaders();
        const resp = await fetch('/api/characters/export', {
            method: 'POST',
            headers,
            body: JSON.stringify({ avatar_url: charRecord.avatar, format: 'png' }),
        });
        if (!resp.ok) throw new Error(`Export failed (${resp.status})`);
        const blob = await resp.blob();
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${charRecord.name.replace(/[^\w\s\u0400-\u04FF-]/g, '_')}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
        toastr?.clear?.();
        toastr?.success?.(`Exported ${charRecord.name}`);
    } catch (err) {
        console.error(`[${MODULE_NAME}] Export failed`, err);
        toastr?.clear?.();
        toastr?.error?.(`Failed to export ${charRecord.name}`);
    } finally {
        state._exportingCard = false;
    }
}

async function deleteSingleCard(charRecord) {
    if (state.confirmBeforeDelete) { if (!(await cmConfirm(`Delete "${charRecord.name}"? This cannot be undone.`))) return; }
    try {
        const headers = getRequestHeaders();
        const resp = await fetch('/api/characters/delete', {
            method: 'POST',
            headers,
            body: JSON.stringify({ avatar_url: charRecord.avatar }),
        });
        if (!resp.ok) throw new Error(`Delete failed (${resp.status})`);
        toastr?.success?.(`Deleted ${charRecord.name}`);
        await refreshData(false);
    } catch (err) {
        console.error(`[${MODULE_NAME}] Delete failed`, err);
        toastr?.error?.(`Failed to delete ${charRecord.name}`);
    }
}

function onSelectAll() {
    const visible = getVisibleCards();
    const { items } = getPageSlice(visible);
    items.forEach(c => state.selectedCards.add(c.index));
    updateSelectUI();
    syncGridSelection();
}
function onSelectAllVisible() {
    const visible = getVisibleCards();
    visible.forEach(c => state.selectedCards.add(c.index));
    updateSelectUI();
    syncGridSelection();
}

function onDeselectAll() {
    state.selectedCards.clear();
    updateSelectUI();
    syncGridSelection();
}

function onInvertSelection() {
    const visible = getVisibleCards();
    visible.forEach(c => {
        if (state.selectedCards.has(c.index)) state.selectedCards.delete(c.index);
        else state.selectedCards.add(c.index);
    });
    updateSelectUI();
    syncGridSelection();
}
async function onBulkExport() {
    if (state.isBulkOperating) return;
    const selected = getSelectedCharacters();
    if (selected.length === 0) { toastr?.info?.('No cards selected.'); return; }

    const count = selected.length;
    if (!(await cmConfirm(`Export ${count} card(s) as individual PNG files?`))) return;

    state.isBulkOperating = true;
    let success = 0;
    let failed = 0;

    for (const c of selected) {
        setBulkProgress('Exporting', success + failed + 1, count, c.name);
        if (!c.avatar || c.avatar === 'none') { failed++; continue; }
        try {
            const resp = await fetch('/api/characters/export', {
                method: 'POST',
                headers: getRequestHeaders(),
                body: JSON.stringify({ avatar_url: c.avatar, format: 'png' }),
            });
            if (!resp.ok) throw new Error(`${resp.status}`);
            const blob = await resp.blob();
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `${safeName(c.name)}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(a.href);
            success++;
        } catch (err) {
            console.error(`[${MODULE_NAME}] Failed to export ${c.name}`, err);
            failed++;
        }
        // Small delay to avoid browser download throttling
        if (count > 3) await sleep(150);
    }

    state.isBulkOperating = false;
    clearBulkProgress();

    if (success > 0) toastr?.success?.(`Exported ${success} card(s).`);
    if (failed > 0) toastr?.warning?.(`Failed to export ${failed} card(s).`);
}
async function onBulkDelete() {
    if (state.isBulkOperating) return;
    const selected = getSelectedCharacters();
    if (selected.length === 0) { toastr?.info?.('No cards selected.'); return; }

    const count = selected.length;
    const names = selected.slice(0, 5).map(c => c.name).join(', ');
    const suffix = count > 5 ? ` and ${count - 5} more` : '';
    if (!(await cmConfirm(`Delete ${count} card(s)?\n\n${names}${suffix}\n\nThis cannot be undone!`))) return;

    state.isBulkOperating = true;
    let success = 0;
    let failed = 0;

    for (const c of selected) {
        setBulkProgress('Deleting', success + failed + 1, count, c.name);
        try {
            const resp = await fetch('/api/characters/delete', {
                method: 'POST',
                headers: getRequestHeaders(),
                body: JSON.stringify({ avatar_url: c.avatar }),
            });
            if (!resp.ok) throw new Error(`${resp.status}`);
            success++;
        } catch (err) {
            console.error(`[${MODULE_NAME}] Failed to delete ${c.name}`, err);
            failed++;
        }
    }

    state.selectedCards.clear();
    clearBulkProgress();
    updateSelectUI();

    state.isBulkOperating = false;

    if (success > 0) toastr?.success?.(`Deleted ${success} card(s).`);
    if (failed > 0) toastr?.warning?.(`Failed to delete ${failed} card(s).`);

    await refreshData(false);
}


function updateSelectUI() {
    const count = state.selectedCards.size;
    const hasSelection = count > 0;
    state.dom.selectBar?.classList.toggle('cm-hidden', !hasSelection || state.activeTab !== TABS.CARDS);
    state.dom.modal?.classList.toggle('is-selecting', hasSelection);
    if (state.dom.selectCount) {
        if (hasSelection) {
            const chars = getSelectedCharacters();
            const totalTokens = chars.reduce((sum, c) => sum + c.totalTokens, 0);
            const avg = Math.round(totalTokens / chars.length);
            state.dom.selectCount.textContent = `${count} selected · ${totalTokens.toLocaleString()} tok (avg ${avg.toLocaleString()})`;
        } else {
            state.dom.selectCount.textContent = '0 selected';
        }
    }
}

function setBulkProgress(action, current, total, itemName) {
    if (!state.dom.selectCount) return;
    const pct = Math.round((current / total) * 100);
    state.dom.selectCount.innerHTML = `
        <span class="cm-bulk-progress">
            <strong>${action}</strong> ${current}/${total}
            <span class="cm-bulk-progress-name">${escapeHtml(itemName || '')}</span>
            <span class="cm-bulk-progress-bar"><span class="cm-bulk-progress-fill" style="width:${pct}%"></span></span>
        </span>
    `;
}

function clearBulkProgress() {
    updateSelectUI();
}

// ══════════════════════════════════════════════════════════════
// SELECTION HELPERS
// ══════════════════════════════════════════════════════════════

function getSelectedCharacters() {
    return state.characters.filter(c => state.selectedCards.has(c.index));
}

function syncGridSelection() {
    if (!state.dom.grid) return;
    state.dom.grid.querySelectorAll('.cm-card').forEach(card => {
        const idx = Number(card.dataset.charIndex);
        const selected = state.selectedCards.has(idx);
        card.classList.toggle('is-selected', selected);
        const cb = card.querySelector('.cm-card-checkbox i');
        if (cb) cb.className = selected ? 'fa-solid fa-check' : 'fa-regular fa-square';
    });
}

function safeName(name) {
    return (name || 'card').replace(/[^\w\s\u0400-\u04FF-]/g, '_').replace(/\s+/g, '_').substring(0, 80);
}

function debounce(fn, delay) {
    let timer;
    return function(...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ══════════════════════════════════════════════════════════════
// TOUCH SUPPORT
// ══════════════════════════════════════════════════════════════


// ══════════════════════════════════════════════════════════════
// UTILITY
// ══════════════════════════════════════════════════════════════

function setLoading(isLoading) {
    state.isLoading = isLoading;
    state.dom.loading?.classList.toggle('cm-hidden', !isLoading);
    state.dom.grid?.classList.toggle('cm-hidden', isLoading);
}

function setEmpty(message) {
    if (!state.dom.empty) return;
    state.dom.empty.textContent = message;
    state.dom.empty.classList.toggle('cm-hidden', !message);
}

// ══════════════════════════════════════════════════════════════
// SIDEBAR PANEL (ST Extensions Drawer)
// ══════════════════════════════════════════════════════════════

function createExtensionUI() {
    const container = document.getElementById('extensions_settings2');
    if (!container) {
        console.warn(`[${MODULE_NAME}] Extensions container not found.`);
        return;
    }

    const panel = document.createElement('div');
    panel.id = 'card-manager-settings';
    panel.innerHTML = `
        <div class="inline-drawer">
            <div class="inline-drawer-toggle inline-drawer-header">
                <b>Card Manager</b>
                <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
            </div>
            <div class="inline-drawer-content">
                <p class="cm-ext-description">
                    Browse, analyze, and manage your character cards.
                </p>
                <button class="menu_button" id="cm-launch-btn">
                    <i class="fa-solid fa-grip"></i> Open Card Manager
                </button>
            </div>
        </div>
    `;

    container.appendChild(panel);

    // Launch button
    document.getElementById('cm-launch-btn').addEventListener('click', openManager);
}

// ══════════════════════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════════════════════

function init() {
    if (state.initialized) return;
    state.initialized = true;
    createExtensionUI();
    console.debug(`[${MODULE_NAME}] Extension loaded.`);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

})(); // End IIFE
