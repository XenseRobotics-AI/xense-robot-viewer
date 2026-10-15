import { RecentWorkspaceStore } from './RecentWorkspaceStore.js';
import { getFileFromEntry } from '../utils/FileUtils.js';

const skippedDirectories = new Set(['.git', '.aws', '.codex', '.agents', 'node_modules', '.venv', 'venv', '__pycache__', 'dist']);

export async function readWorkspaceDirectory(handle, isCurrent = () => true, prefix = handle.name) {
    const files = [];
    for await (const entry of handle.values()) {
        if (!isCurrent()) return null;
        if (entry.kind === 'directory') {
            if (skippedDirectories.has(entry.name)) continue;
            const children = await readWorkspaceDirectory(entry, isCurrent, `${prefix}/${entry.name}`);
            if (!children) return null;
            files.push(...children);
        } else {
            const file = await entry.getFile();
            Object.defineProperty(file, 'webkitRelativePath', { value: `${prefix}/${file.name}` });
            files.push(file);
        }
    }
    return files;
}

export async function readLegacyEntries(entries, isCurrent = () => true, prefix = '') {
    const files = [];
    for (const entry of entries) {
        if (!isCurrent()) return null;
        const path = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isFile) {
            const file = await getFileFromEntry(entry);
            if (prefix) Object.defineProperty(file, 'webkitRelativePath', { value: path });
            files.push(file);
        } else if (!skippedDirectories.has(entry.name)) {
            const reader = entry.createReader();
            while (true) {
                const batch = await new Promise((resolve, reject) => reader.readEntries(resolve, reject));
                if (!batch.length) break;
                const children = await readLegacyEntries(batch, isCurrent, path);
                if (!children) return null;
                files.push(...children);
            }
        }
    }
    return files;
}

async function legacyFingerprint(files) {
    if (!globalThis.crypto?.subtle) return null;
    const entries = files.map(file => [file.webkitRelativePath, file.size, file.lastModified]);
    entries.sort((a, b) => a[0].localeCompare(b[0]));
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(entries)));
    return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}

export class WorkspaceController {
    constructor(fileHandler, fileTree, store = new RecentWorkspaceStore()) {
        this.fileHandler = fileHandler;
        this.fileTree = fileTree;
        this.store = store;
        this.operation = 0;
        this.busy = false;
        this.message = '';
        this.root = document.getElementById('recent-workspace');
        this.reopenButton = document.getElementById('reopen-workspace-btn');
        this.clearButton = document.getElementById('forget-workspaces-btn');
        this.autoRestore = document.getElementById('restore-workspace-on-start');
        this.detailsToggle = document.getElementById('toggle-workspace-details');
        this.details = document.getElementById('recent-workspace-details');
        this.detailsToggle.addEventListener('click', () => {
            this.details.hidden = !this.details.hidden;
            this.render();
        });
        this.reopenButton.addEventListener('click', () => this.reopen());
        this.clearButton.addEventListener('click', () => this.forget());
        document.getElementById('choose-workspace-btn').addEventListener('click', () => this.pickFolder());
        this.autoRestore.addEventListener('change', async () => {
            if (!this.autoRestore.checked) { ++this.operation; this.busy = false; this.render(); }
            await store.setAutoRestore(this.autoRestore.checked);
            this.broadcast();
        });
        fileTree.onFolderRequest = () => this.pickFolder();
        fileTree.onFilesSelected = (files, isFolder) => this.loadSelection(files, isFolder);
        fileHandler.onDrop = event => this.drop(event);
        fileHandler.onFileViewed = async ({ workspaceId, path, selectedAt }) => {
            if (!workspaceId) return;
            try {
                await store.rememberFile(workspaceId, path, selectedAt);
                await this.refresh();
                this.broadcast();
            } catch { this.setMessage('recentStorageUnavailable'); }
        };
        if (globalThis.BroadcastChannel) {
            this.channel = new BroadcastChannel('xense-robot-viewer-recent-workspaces');
            this.channel.onmessage = event => {
                if (event.data === 'cleared') {
                    ++this.operation;
                    this.busy = false;
                    this.message = '';
                    this.fileHandler.workspaceId = null;
                    this.fileHandler.preferredModelPath = '';
                }
                this.refresh();
            };
        }
    }

    broadcast(type = 'changed') { this.channel?.postMessage(type); }
    t(key) { return window.i18n.t(key); }
    setMessage(key = '') { this.message = key; this.render(); }

    async refresh() {
        const { folder, settings } = await this.store.recent();
        this.recent = folder;
        this.autoRestore.checked = settings.autoRestore;
        this.render();
        return settings;
    }

    render() {
        this.detailsToggle.setAttribute('aria-expanded', String(!this.details.hidden));
        const toggleLabel = this.details.hidden ? 'expandRecentWorkspace' : 'collapseRecentWorkspace';
        this.detailsToggle.setAttribute('data-i18n-title', toggleLabel);
        this.detailsToggle.title = this.t(toggleLabel);
        this.detailsToggle.setAttribute('aria-label', this.t(toggleLabel));
        document.getElementById('recent-workspace-arrow').textContent = this.details.hidden ? '▸' : '▾';
        this.root.hidden = !this.recent && !this.message;
        this.reopenButton.disabled = this.busy || !this.recent;
        this.reopenButton.textContent = this.t(this.busy ? 'openingLastFolder' : this.recent?.handle ? 'openLastFolder' : 'reselectLastFolder');
        this.clearButton.disabled = this.busy || !this.recent;
        const path = document.getElementById('recent-workspace-path');
        path.textContent = this.recent ? `${this.recent.name}/` : '';
        path.title = this.recent ? `${this.recent.name}/\n${this.t('folderPathPrivacy')}` : '';
        const file = document.getElementById('recent-workspace-file');
        file.textContent = this.recent?.lastFile ? `${this.t('lastViewedFile')}: ${this.recent.lastFile}` : '';
        file.title = this.recent?.lastFile || '';
        document.getElementById('recent-workspace-message').textContent = this.message ? this.t(this.message)
            : !this.store.persistent ? this.t('recentStorageUnavailable') : '';
    }

    async init() {
        const operation = this.operation;
        const settings = await this.refresh();
        if (settings.autoRestore && this.recent?.handle && operation === this.operation && this.fileHandler.loadRequestId === 0) {
            const handle = this.recent.handle;
            const revision = this.fileHandler.loadRequestId;
            try {
                const permission = await handle.queryPermission({ mode: 'read' });
                if (operation !== this.operation || revision !== this.fileHandler.loadRequestId) return;
                if (permission === 'granted') await this.openHandle(handle);
                else this.setMessage('folderPermissionNeeded');
            } catch { this.setMessage('lastFolderUnavailable'); }
        }
    }

    async pickFolder() {
        const operation = ++this.operation;
        this.busy = false;
        this.render();
        if (!window.showDirectoryPicker) { this.fileTree.triggerFileInput(true); return; }
        try {
            const handle = await window.showDirectoryPicker({ id: 'robot-viewer-folder', mode: 'read' });
            if (operation !== this.operation) return;
            await this.openHandle(handle);
        } catch (error) { if (error.name !== 'AbortError') this.setMessage('folderOpenFailed'); }
    }

    async reopen() {
        const folder = this.recent;
        if (!folder || this.busy) return;
        if (!folder.handle) { this.pickFolder(); return; }
        const operation = ++this.operation;
        try {
            // Invoked directly by the button so user activation is retained.
            const permission = await folder.handle.requestPermission({ mode: 'read' });
            if (operation !== this.operation) return;
            if (permission !== 'granted') { this.setMessage('folderPermissionNeeded'); return; }
            await this.openHandle(folder.handle);
        } catch { this.setMessage('lastFolderUnavailable'); }
    }

    async openHandle(handle) {
        const operation = ++this.operation;
        const revision = this.fileHandler.loadRequestId;
        const selectedAt = Date.now();
        this.busy = true;
        this.setMessage();
        const isCurrent = () => operation === this.operation && revision === this.fileHandler.loadRequestId;
        try {
            const files = await readWorkspaceDirectory(handle, isCurrent);
            if (!files || !isCurrent()) return;
            const folder = await this.store.rememberFolder({ handle, name: handle.name }, selectedAt);
            if (!isCurrent()) return;
            await this.openFiles(files, folder);
            this.broadcast();
        } catch (error) {
            if (operation === this.operation) this.setMessage(error.name === 'NotFoundError' ? 'lastFolderUnavailable' : 'folderOpenFailed');
        } finally {
            if (operation === this.operation) { this.busy = false; await this.refresh(); }
        }
    }

    async openFiles(files, folder = null) {
        const result = await this.fileHandler.loadFiles(files, {
            workspaceId: folder?.id || null, preferredPath: folder?.lastFile || '',
        });
        if (result === 'missing') this.setMessage('lastFileMissing');
        else if (result === 'empty') this.setMessage('folderHasNoModels');
        else if (result === 'failed') this.setMessage('lastFileLoadFailed');
    }

    async loadSelection(files, isFolder = false) {
        const operation = ++this.operation;
        this.busy = true;
        this.setMessage();
        try {
            let folder = null;
            if (isFolder) {
                const name = files[0]?.webkitRelativePath.split('/')[0];
                const fingerprint = await legacyFingerprint(files);
                if (operation !== this.operation) return;
                if (name) folder = await this.store.rememberFolder({ name, fingerprint });
            }
            if (operation !== this.operation) return;
            await this.openFiles(files, folder);
            this.broadcast();
        } catch { if (operation === this.operation) this.setMessage('folderOpenFailed'); }
        finally { if (operation === this.operation) { this.busy = false; await this.refresh(); } }
    }

    async drop(event) {
        const operation = ++this.operation;
        this.busy = false;
        const items = Array.from(event.dataTransfer?.items || []);
        // Capture handles synchronously, before the drag event loses access to its items.
        const handles = items.map(item => item.getAsFileSystemHandle?.());
        const entries = items.map(item => item.webkitGetAsEntry?.()).filter(Boolean);
        const files = Array.from(event.dataTransfer?.files || []);
        try {
            if (handles.length === 1 && handles[0]) {
                const handle = await handles[0];
                if (operation !== this.operation) return;
                if (handle?.kind === 'directory') { await this.openHandle(handle); return; }
            }
            if (entries.some(entry => entry.isDirectory)) {
                const collected = await readLegacyEntries(entries, () => operation === this.operation);
                if (!collected || operation !== this.operation) return;
                await this.loadSelection(collected, entries.length === 1 && entries[0].isDirectory);
            } else await this.loadSelection(files, false);
        } catch { this.setMessage('folderOpenFailed'); }
    }

    async forget() {
        ++this.operation;
        this.fileHandler.workspaceId = null;
        this.fileHandler.preferredModelPath = '';
        await this.store.clear();
        this.message = '';
        this.busy = false;
        this.details.hidden = true;
        await this.refresh();
        this.broadcast('cleared');
    }
}
