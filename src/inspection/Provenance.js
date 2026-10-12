import { currentPath, directory, joinPath, normalizePath, uniqueFiles } from './AssetPaths.js';
const hashes = new WeakMap();
const jsonFiles = new WeakMap();
const hashPattern = /^[a-f\d]{64}$/i;
export async function sha256(file) {
    if (!globalThis.crypto?.subtle) throw new Error('SHA-256 requires HTTPS or localhost');
    if (!hashes.has(file)) hashes.set(file, file.arrayBuffer().then(data => crypto.subtle.digest('SHA-256', data)).then(buffer => [...new Uint8Array(buffer)].map(b => b.toString(16).padStart(2, '0')).join('')));
    return hashes.get(file);
}
const readJSON = file => {
    if (!jsonFiles.has(file)) jsonFiles.set(file, file.text().then(JSON.parse));
    return jsonFiles.get(file);
};
const check = (actual, expected) => typeof expected !== 'string' || !hashPattern.test(expected) ? 'unrecorded' : !actual ? 'unavailable' : actual.toLowerCase() === expected.toLowerCase() ? 'matched' : 'modified';

export async function inspectProvenance(file, fileMap = new Map()) {
    const path = currentPath(file, fileMap);
    const result = { path, hash: null, hashError: null, records: [], checksums: [], components: [], errors: [] };
    try { result.hash = await sha256(file); } catch (error) { result.hashError = error.message; }
    const entries = uniqueFiles(fileMap);
    const metadata = [];
    for (const entry of entries) {
        const name = entry.path.split('/').at(-1);
        if (!/^(asset|assembly(?:\.[^.]+)*|provenance|source|manifest)\.json$/i.test(name) && entry.path !== path + '.source.json') continue;
        try { metadata.push({ ...entry, data: await readJSON(entry.file) }); }
        catch (error) { result.errors.push({ path: entry.path, message: error.message }); }
    }
    for (const entry of metadata) {
        const base = directory(entry.path), data = entry.data;
        if (!data || typeof data !== 'object' || Array.isArray(data)) continue;
        const fileRecords = Object.entries(data.files || {}).filter(([, record]) => record && typeof record === 'object');
        const direct = fileRecords.find(([key]) => joinPath(base, key) === path);
        const byHash = result.hash && fileRecords.find(([, record]) => typeof record.sha256 === 'string' && record.sha256.toLowerCase() === result.hash);
        const match = direct || byHash;
        const entrypoints = [data.entrypoint, ...Object.values(data.entrypoints || {})].filter(value => typeof value === 'string');
        const isEntrypoint = entrypoints.some(value => joinPath(base, value) === path);
        const sidecar = entry.path === path + '.source.json';
        if (!match && !isEntrypoint && !sidecar) continue;
        // source.sha256 identifies an upstream artifact, never the generated entrypoint.
        const expected = match?.[1]?.sha256 || (sidecar && hashPattern.test(data.sha256 || '') ? data.sha256 : null);
        result.records.push({ path: entry.path, data, source: data.source || {}, fileRecord: match?.[1] || null,
            relation: direct || isEntrypoint || sidecar ? 'path' : 'hash', expected, status: check(result.hash, expected) });
        for (const [instance, component] of Object.entries(data.instances || {})) {
            const candidates = metadata.filter(m => m.data?.id === component.asset_id);
            const source = candidates.length === 1 ? candidates[0] : null;
            const variant = component.variant || 'default';
            const entrypoint = source?.data.entrypoints?.[variant];
            const componentPath = typeof entrypoint === 'string' ? joinPath(directory(source.path), entrypoint) : null;
            const input = data.inputs?.[instance];
            const expectedHash = typeof input === 'string' && hashPattern.test(input) ? input : null;
            const componentFile = entries.find(e => e.path === componentPath)?.file;
            let hash = null;
            if (componentFile) try { hash = await sha256(componentFile); } catch {}
            result.components.push({ instance, assetId: component.asset_id, path: componentPath, source: source?.data.source || {},
                expected: expectedHash, hash, status: candidates.length > 1 ? 'ambiguous' : check(hash, expectedHash) });
        }
    }
    for (const entry of entries) {
        const name = entry.path.split('/').at(-1);
        if (!/^(SHA256SUMS|checksums\.sha256)$/i.test(name) && !/\.sha256$/i.test(name)) continue;
        try {
            for (const line of (await entry.file.text()).replace(/^\uFEFF/, '').split(/\r?\n/)) {
                const gnu = line.match(/^\s*([a-f\d]{64})\s+\*?(.+?)\s*$/i);
                const bsd = line.match(/^SHA256\s*\((.+)\)\s*=\s*([a-f\d]{64})\s*$/i);
                const bare = line.trim();
                const expected = gnu?.[1] || bsd?.[2] || (hashPattern.test(bare) ? bare : null);
                const filename = gnu?.[2] || bsd?.[1];
                const target = filename ? joinPath(directory(entry.path), filename) : normalizePath(entry.path.replace(/\.sha256$/i, ''));
                if (expected && (target === path || (result.hash && expected.toLowerCase() === result.hash))) {
                    result.checksums.push({ path: entry.path, target, expected, status: check(result.hash, expected), relation: target === path ? 'path' : 'hash' });
                }
            }
        } catch (error) { result.errors.push({ path: entry.path, message: error.message }); }
    }
    return result;
}
