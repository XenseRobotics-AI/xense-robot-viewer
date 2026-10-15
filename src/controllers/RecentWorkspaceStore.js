export const RECENT_WORKSPACE_DB = 'xense-robot-viewer-recent-workspaces';
const LIMIT = 10;
const defaults = () => ({ id: 'settings', autoRestore: true, lastId: null, selectedAt: 0 });

/** Browser-profile/origin storage. Stores handles and relative paths, never file contents. */
export class RecentWorkspaceStore {
    constructor(indexedDB = globalThis.indexedDB) {
        this.indexedDB = indexedDB;
        this.memory = new Map();
        this.persistent = !!indexedDB;
    }

    async database() {
        if (!this.indexedDB || !this.persistent) return null;
        if (!this.dbPromise) this.dbPromise = new Promise((resolve, reject) => {
            const request = this.indexedDB.open(RECENT_WORKSPACE_DB, 1);
            request.onupgradeneeded = () => request.result.createObjectStore('records', { keyPath: 'id' });
            request.onsuccess = () => {
                request.result.onversionchange = () => { request.result.close(); this.dbPromise = null; };
                resolve(request.result);
            };
            request.onerror = () => reject(request.error);
            request.onblocked = () => reject(new Error('Recent workspace storage is blocked'));
        }).catch(() => { this.persistent = false; return null; });
        return this.dbPromise;
    }

    async all() {
        const db = await this.database();
        if (!db) return [...this.memory.values()];
        try {
            const records = await new Promise((resolve, reject) => {
                const transaction = db.transaction('records', 'readonly');
                const request = transaction.objectStore('records').getAll();
                transaction.oncomplete = () => resolve(request.result);
                transaction.onabort = () => reject(transaction.error);
                transaction.onerror = () => reject(transaction.error);
            });
            this.memory = new Map(records.map(record => [record.id, record]));
            return records;
        } catch { this.persistent = false; return [...this.memory.values()]; }
    }

    async update(id, change) {
        const db = await this.database();
        const fallback = () => {
            const value = change(this.memory.get(id));
            if (value) this.memory.set(id, value);
            return value;
        };
        if (!db) return fallback();
        try {
            return await new Promise((resolve, reject) => {
                const transaction = db.transaction('records', 'readwrite');
                const store = transaction.objectStore('records');
                const request = store.get(id);
                let value;
                request.onsuccess = () => { value = change(request.result); if (value) store.put(value); };
                transaction.oncomplete = () => { if (value) this.memory.set(id, value); resolve(value); };
                transaction.onabort = () => reject(transaction.error);
                transaction.onerror = () => reject(transaction.error);
            });
        } catch { this.persistent = false; return fallback(); }
    }

    async recent() {
        const records = await this.all();
        const settings = records.find(record => record.id === 'settings') || defaults();
        const folder = records.find(record => record.id === settings.lastId && record.kind === 'folder');
        return { settings, folder: folder || null };
    }

    async rememberFolder({ handle = null, name, fingerprint = null }, selectedAt = Date.now()) {
        const save = async () => {
            const records = (await this.all()).filter(record => record.kind === 'folder');
            let previous;
            for (const record of records) {
                if (handle && record.handle) {
                    try { if (await handle.isSameEntry(record.handle)) { previous = record; break; } } catch { /* stale handle */ }
                } else if (!handle && fingerprint && record.fingerprint === fingerprint) {
                    previous = record; break;
                }
            }
            const id = previous?.id || `folder:${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`}`;
            const folder = await this.update(id, current => ({
                ...current, id, kind: 'folder', name, handle, fingerprint,
                lastFile: current?.lastFile || '', fileSelectedAt: current?.fileSelectedAt || 0,
                openedAt: Math.max(current?.openedAt || 0, selectedAt),
            }));
            await this.selectFolder(id, selectedAt);
            await this.prune(id);
            return folder;
        };
        return this.withFolderLock(save);
    }

    withFolderLock(action) {
        return globalThis.navigator?.locks
            ? navigator.locks.request(`${RECENT_WORKSPACE_DB}:folders`, action) : action();
    }

    async selectFolder(id, selectedAt) {
        return this.update('settings', current => {
            const settings = current || defaults();
            return selectedAt >= settings.selectedAt ? { ...settings, lastId: id, selectedAt } : settings;
        });
    }

    async rememberFile(id, path, selectedAt) {
        // A cleared/pruned record must never be resurrected by an old tab or slow load.
        const folder = await this.update(id, current => current && selectedAt >= current.fileSelectedAt
            ? { ...current, lastFile: path, fileSelectedAt: selectedAt } : current);
        if (folder) await this.selectFolder(id, selectedAt);
        return folder;
    }

    async setAutoRestore(autoRestore) {
        await this.update('settings', current => ({ ...(current || defaults()), autoRestore }));
    }

    async prune(keepId) {
        const folders = (await this.all()).filter(record => record.kind === 'folder')
            .sort((a, b) => Math.max(b.openedAt, b.fileSelectedAt) - Math.max(a.openedAt, a.fileSelectedAt));
        const ids = folders.filter(record => record.id !== keepId).slice(LIMIT - 1).map(record => record.id);
        if (!ids.length) return;
        const db = await this.database();
        if (db) await new Promise(resolve => {
            const transaction = db.transaction('records', 'readwrite');
            ids.forEach(id => transaction.objectStore('records').delete(id));
            transaction.oncomplete = transaction.onabort = transaction.onerror = resolve;
        });
        ids.forEach(id => this.memory.delete(id));
    }

    async clear() {
        return this.withFolderLock(() => this.clearRecords());
    }

    async clearRecords() {
        const { settings } = await this.recent();
        const db = await this.database();
        if (db) await new Promise((resolve, reject) => {
            const transaction = db.transaction('records', 'readwrite');
            const store = transaction.objectStore('records');
            store.clear();
            store.put({ ...defaults(), autoRestore: settings.autoRestore });
            transaction.oncomplete = resolve;
            transaction.onabort = transaction.onerror = () => reject(transaction.error);
        }).catch(() => { this.persistent = false; });
        this.memory.clear();
        this.memory.set('settings', { ...defaults(), autoRestore: settings.autoRestore });
    }
}
