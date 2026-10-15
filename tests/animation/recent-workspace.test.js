import test from 'node:test';
import assert from 'node:assert/strict';
import { RecentWorkspaceStore } from '../../src/controllers/RecentWorkspaceStore.js';
import { FileHandler } from '../../src/controllers/FileHandler.js';
import { readWorkspaceDirectory, readLegacyEntries } from '../../src/controllers/WorkspaceController.js';

const handle = (identity, name = 'robot') => ({ name, isSameEntry: async other => identity === other.identity, identity });
const file = path => ({ name: path.split('/').pop(), webkitRelativePath: path });

test('folder identities isolate same-named directories and restore their own selected paths', async () => {
    const store = new RecentWorkspaceStore(null);
    const first = await store.rememberFolder({ handle: handle('user-a'), name: 'robot' }, 10);
    await store.rememberFile(first.id, 'arm/robot.urdf', 11);
    const second = await store.rememberFolder({ handle: handle('user-b'), name: 'robot' }, 20);
    assert.notEqual(first.id, second.id);
    assert.equal(second.lastFile, '');
    await store.rememberFile(second.id, 'tool/robot.urdf', 21);
    const reopened = await store.rememberFolder({ handle: handle('user-a'), name: 'robot' }, 30);
    assert.equal(reopened.id, first.id);
    assert.equal(reopened.lastFile, 'arm/robot.urdf');
    assert.equal((await store.recent()).folder.id, first.id);
});

test('slow old selections cannot overwrite a newer file or another tab’s last folder', async () => {
    const store = new RecentWorkspaceStore(null);
    const first = await store.rememberFolder({ handle: handle('first'), name: 'robot' }, 10);
    await store.rememberFile(first.id, 'new.urdf', 30);
    await store.rememberFile(first.id, 'old.urdf', 20);
    assert.equal((await store.recent()).folder.lastFile, 'new.urdf');
    const second = await store.rememberFolder({ handle: handle('second'), name: 'robot' }, 40);
    await store.rememberFile(first.id, 'delayed.urdf', 35);
    assert.equal((await store.recent()).folder.id, second.id);
});

test('clearing records prevents an old tab from recreating history and preserves restore opt-out', async () => {
    const store = new RecentWorkspaceStore(null);
    const folder = await store.rememberFolder({ handle: handle('first'), name: 'robot' });
    await store.setAutoRestore(false);
    await store.clear();
    await store.rememberFile(folder.id, 'late.urdf', Date.now() + 10);
    assert.equal((await store.recent()).folder, null);
    assert.equal((await store.recent()).settings.autoRestore, false);
    assert.equal((await store.all()).length, 1);
});

test('history is bounded and unavailable IndexedDB falls back to a usable current session', async () => {
    const store = new RecentWorkspaceStore({ open() { throw new Error('Storage blocked'); } });
    for (let index = 0; index < 12; index++) {
        await store.rememberFolder({ handle: handle(index), name: 'robot' }, index);
    }
    assert.equal(store.persistent, false);
    assert.equal((await store.all()).filter(record => record.kind === 'folder').length, 10);
    assert.equal((await store.recent()).folder.handle.identity, 11);
});

test('legacy folders are reused only with an exact fingerprint, never just the same name', async () => {
    const store = new RecentWorkspaceStore(null);
    const first = await store.rememberFolder({ name: 'robot', fingerprint: 'folder-a' }, 10);
    await store.rememberFile(first.id, 'a.urdf', 11);
    const second = await store.rememberFolder({ name: 'robot', fingerprint: 'folder-b' }, 20);
    assert.notEqual(second.id, first.id);
    assert.equal(second.lastFile, '');
    const reopened = await store.rememberFolder({ name: 'robot', fingerprint: 'folder-a' }, 30);
    assert.equal(reopened.lastFile, 'a.urdf');
});

test('the last relative model or mesh path wins over the hardcoded default and duplicate basenames', () => {
    const handler = new FileHandler();
    const info = (path, category = 'model') => ({ name: path.split('/').pop(), file: file(path), category });
    const preferred = info('robot/forward-01-flexiv-rizon4s-taccap.urdf');
    const left = info('robot/left/robot.urdf');
    const right = info('robot/right/robot.urdf');
    const mesh = info('robot/tools/gripper.stl', 'mesh');
    const files = [preferred, left, right, mesh];
    handler.preferredModelPath = 'right/robot.urdf';
    assert.equal(handler.selectInitialModel(files), right);
    handler.preferredModelPath = 'tools/gripper.stl';
    assert.equal(handler.selectInitialModel(files), mesh);
    handler.preferredModelPath = 'deleted/robot.urdf';
    assert.equal(handler.selectInitialModel(files), preferred);
});

test('only the current successful load can display a model or persist its selection', async () => {
    const handler = new FileHandler();
    const first = file('robot/first.urdf'), second = file('robot/second.urdf');
    handler.beginSource({ workspaceId: 'folder-a' });
    handler.fileMap.set(first.webkitRelativePath, first);
    handler.fileMap.set(second.webkitRelativePath, second);
    const shown = [], saved = [];
    handler.onModelLoaded = async (_, file) => shown.push(file.name);
    handler.onFileViewed = async context => saved.push(context.path);
    const oldLoad = handler.createLoadContext(first);
    const newLoad = handler.createLoadContext(second);
    assert.equal(await handler.completeLoad({}, first, false, oldLoad), false);
    assert.equal(await handler.completeLoad({}, second, false, newLoad), true);
    assert.deepEqual(shown, ['second.urdf']);
    assert.deepEqual(saved, ['second.urdf']);
    const switched = handler.createLoadContext(first);
    handler.beginSource({ workspaceId: 'folder-b' });
    assert.equal(await handler.completeLoad({}, first, false, switched), false);
    assert.equal(saved.length, 1);
});

test('native directory reads retain nested asset paths, reread fresh files and skip dependency/private directories', async () => {
    let reads = 0;
    const entry = { name: 'robot.urdf', kind: 'file', async getFile() { reads++; return { name: this.name }; } };
    const nested = { name: 'models', kind: 'directory', async *values() { yield entry; } };
    const skipped = { name: '.aws', kind: 'directory', async *values() { throw new Error('Must not read private/dependency directories'); } };
    const root = { name: 'workspace', async *values() { yield nested; yield skipped; } };
    const files = await readWorkspaceDirectory(root);
    assert.equal(files[0].webkitRelativePath, 'workspace/models/robot.urdf');
    await readWorkspaceDirectory(root);
    assert.equal(reads, 2);
    assert.equal(await readWorkspaceDirectory(root, () => false), null);
});

test('legacy directory readers consume all batches and preserve asset-relative paths', async () => {
    const entry = name => ({ name, isFile: true, file(resolve) { resolve({ name }); } });
    const batches = [[entry('a.urdf')], [entry('b.stl')], []];
    const directory = { name: 'workspace', isDirectory: true, createReader() { return { readEntries(resolve) { resolve(batches.shift()); } }; } };
    const files = await readLegacyEntries([directory]);
    assert.deepEqual(files.map(file => file.webkitRelativePath), ['workspace/a.urdf', 'workspace/b.stl']);
});
