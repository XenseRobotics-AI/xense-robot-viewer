import { resolveFileFromMap } from '../utils/FileUtils.js';

export function normalizePath(path) {
    const parts = [];
    for (const part of String(path).replaceAll('\\', '/').split('/')) {
        if (!part || part === '.') continue;
        if (part === '..' && parts.length && parts.at(-1) !== '..') parts.pop();
        else parts.push(part);
    }
    return parts.join('/');
}
export function directory(path) { return path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : ''; }
export function joinPath(base, path) { return normalizePath(`${base}/${path}`); }
export function currentPath(file, files) {
    return [...(files || new Map())].filter(([, f]) => f === file).map(([key]) => normalizePath(key))
        .sort((a, b) => b.split('/').length - a.split('/').length)[0] || file?.webkitRelativePath || file?.name || '';
}
export function uniqueFiles(files) {
    const paths = new Map();
    for (const [path, file] of files || []) {
        const normalized = normalizePath(path);
        if (!paths.has(file) || normalized.split('/').length > paths.get(file).split('/').length) paths.set(file, normalized);
    }
    return [...paths].map(([file, path]) => ({ file, path }));
}
export function resolveResource(reference, modelPath, files) {
    if (/^(https?:|data:|blob:)/i.test(reference)) return { status: 'external', paths: [reference] };
    const entries = uniqueFiles(files);
    const packagePath = reference.startsWith('package://') ? normalizePath(reference.slice(10)) : null;
    const direct = packagePath || joinPath(directory(modelPath), reference);
    let matches = entries.filter(entry => entry.path === direct);
    if (!matches.length && packagePath) matches = entries.filter(entry => entry.path.endsWith('/' + packagePath));
    if (!matches.length) {
        const fallback = resolveFileFromMap(reference, files, { baseDir: directory(modelPath) });
        if (fallback) return { status: 'found', resolution: 'viewerFallback', paths: [currentPath(fallback, files)] };
        const basename = normalizePath(reference).split('/').at(-1).toLowerCase();
        const sameNames = entries.filter(entry => entry.path.split('/').at(-1).toLowerCase() === basename);
        if (sameNames.length > 1) matches = sameNames;
    }
    return { status: matches.length === 1 ? 'found' : matches.length ? 'ambiguous' : 'missing', paths: matches.map(entry => entry.path) };
}
