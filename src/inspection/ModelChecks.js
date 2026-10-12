import { inspectRobotPhysics, principalMoments } from './PhysicalProperties.js';
import { resolveResource } from './AssetPaths.js';

const validVector = v => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite);
export function inspectModel(model, { path = '', files = new Map(), document: xml = null } = {}) {
    const issues = [];
    const add = (severity, code, subject, detail = '') => issues.push({ severity, code, subject, detail });
    const physics = inspectRobotPhysics(model);
    for (const link of physics.links) {
        for (const code of link.issues) add(code === 'missingInertial' ? 'warning' : 'error', code, link.name);
        if (link.inertia) {
            const moments = principalMoments(link.inertia);
            const tolerance = Math.max(1e-12, ...moments.map(Math.abs)) * 1e-8;
            if (moments[0] < -tolerance) add('error', 'negativeInertia', link.name, JSON.stringify(moments));
            if (moments[2] > moments[0] + moments[1] + tolerance) add('error', 'inertiaTriangle', link.name, JSON.stringify(moments));
            if (link.mass > 0 && moments[0] <= tolerance) add('warning', 'degenerateInertia', link.name);
            if (link.mass === 0 && moments.some(v => Math.abs(v) > tolerance)) add('warning', 'masslessInertia', link.name);
        }
    }
    const children = new Map([...model.links.keys()].map(name => [name, []]));
    const parents = new Map();
    for (const joint of model.joints.values()) {
        if (!model.links.has(joint.parent) || !model.links.has(joint.child)) add('error', 'unknownLink', joint.name, `${joint.parent} → ${joint.child}`);
        else {
            children.get(joint.parent).push(joint.child);
            if (parents.has(joint.child)) add('error', 'multipleParents', joint.child, `${parents.get(joint.child)}, ${joint.name}`);
            parents.set(joint.child, joint.name);
        }
        if (!validVector(joint.origin?.xyz) || !validVector(joint.origin?.rpy)) add('error', 'invalidOrigin', joint.name);
        if (['revolute', 'continuous', 'prismatic'].includes(joint.type)) {
            const axis = joint.axis?.xyz;
            if (!validVector(axis) || axis.every(v => v === 0)) add('error', 'invalidAxis', joint.name);
            else if (Math.abs(Math.hypot(...axis) - 1) > 1e-6) add('warning', 'unnormalizedAxis', joint.name, JSON.stringify(axis));
        }
        if (['revolute', 'prismatic'].includes(joint.type)) {
            const limit = joint.limits;
            if (!limit || !Number.isFinite(limit.lower) || !Number.isFinite(limit.upper)) add('error', 'missingLimits', joint.name);
            else if (limit.lower > limit.upper) add('error', 'invertedLimits', joint.name, `${limit.lower} > ${limit.upper}`);
        }
        for (const key of ['effort', 'velocity']) {
            if (joint.limits?.[key] != null && (!Number.isFinite(joint.limits[key]) || joint.limits[key] < 0)) add('error', 'invalidLimit', joint.name, key);
        }
        const mimic = joint.userData?.mimic || joint.mimic;
        if (mimic?.joint && !model.joints.has(mimic.joint)) add('error', 'unknownMimic', joint.name, mimic.joint);
    }
    const roots = [...model.links.keys()].filter(name => !parents.has(name));
    if (roots.length !== 1) add('error', 'rootCount', model.name, `${roots.length}: ${roots.join(', ')}`);
    const state = new Map();
    const visit = name => {
        if (state.get(name) === 1) { add('error', 'cycle', name); return; }
        if (state.get(name) === 2) return;
        state.set(name, 1);
        for (const child of children.get(name) || []) visit(child);
        state.set(name, 2);
    };
    for (const name of model.links.keys()) visit(name);

    if (!xml && model.sourceXML && typeof DOMParser !== 'undefined') xml = new DOMParser().parseFromString(model.sourceXML, 'text/xml');
    const resources = [];
    if (xml) {
        if (xml.querySelector('parsererror')) add('error', 'invalidXML', path);
        for (const type of ['link', 'joint']) {
            const names = new Set();
            for (const element of [...xml.documentElement.children].filter(el => el.tagName === type)) {
                const name = element.getAttribute('name');
                if (!name || names.has(name)) add('error', 'duplicateName', name || type, type);
                names.add(name);
            }
        }
        for (const origin of xml.querySelectorAll('origin')) for (const attribute of ['xyz', 'rpy']) {
            if (origin.hasAttribute(attribute) && !validVector(origin.getAttribute(attribute).trim().split(/\s+/).map(Number))) {
                add('error', 'invalidOrigin', origin.parentElement?.getAttribute('name') || path, attribute);
            }
        }
        for (const axis of xml.querySelectorAll('joint > axis')) {
            const values = (axis.getAttribute('xyz') || '').trim().split(/\s+/).map(Number);
            if (!validVector(values) || values.every(v => v === 0)) add('error', 'invalidAxis', axis.parentElement.getAttribute('name'));
            else if (Math.abs(Math.hypot(...values) - 1) > 1e-6) add('warning', 'unnormalizedAxis', axis.parentElement.getAttribute('name'), JSON.stringify(values));
        }
        for (const joint of xml.querySelectorAll('robot > joint')) {
            if (!['revolute', 'prismatic'].includes(joint.getAttribute('type'))) continue;
            const limit = joint.querySelector('limit');
            const valid = ['lower', 'upper'].every(key => limit?.hasAttribute(key)
                && limit.getAttribute(key).trim() !== '' && Number.isFinite(Number(limit.getAttribute(key))));
            if (!valid) add('error', 'missingLimits', joint.getAttribute('name'));
        }
        for (const mimic of xml.querySelectorAll('joint > mimic')) {
            if (!model.joints.has(mimic.getAttribute('joint'))) add('error', 'unknownMimic', mimic.parentElement.getAttribute('name'), mimic.getAttribute('joint'));
        }
        for (const mesh of xml.querySelectorAll('mesh, texture')) {
            const reference = mesh.getAttribute('filename');
            if (!reference) { add('error', 'missingResource', path, '(empty filename)'); continue; }
            const resolved = resolveResource(reference, path, files);
            resources.push({ reference, ...resolved });
            if (resolved.status === 'missing') add('error', 'missingResource', reference);
            if (resolved.status === 'ambiguous') add('warning', 'ambiguousResource', reference, resolved.paths.join(', '));
            if (resolved.status === 'external') add('info', 'externalResource', reference);
            if (resolved.resolution === 'viewerFallback') add('info', 'fallbackResource', reference, resolved.paths[0]);
            if (mesh.hasAttribute('scale')) {
                const scale = mesh.getAttribute('scale').trim().split(/\s+/).map(Number);
                if (!validVector(scale) || scale.some(v => v === 0)) add('error', 'invalidScale', reference);
                else if (scale.some(v => v < 0)) add('warning', 'mirroredScale', reference, JSON.stringify(scale));
                else if (Math.max(...scale) / Math.min(...scale) > 1.001) add('warning', 'nonuniformScale', reference, JSON.stringify(scale));
            }
        }
    } else add('info', 'noSourceXML', path);
    const unique = issues.filter((issue, i) => issues.findIndex(other => other.code === issue.code && other.subject === issue.subject && other.detail === issue.detail) === i);
    return { schemaVersion: 1, model: model.name, path, generatedAt: new Date().toISOString(),
        scope: 'Static URDF structure, resource resolution, and declared physical parameters. Not a dynamics or collision simulation.',
        summary: { links: model.links.size, joints: model.joints.size, errors: unique.filter(i => i.severity === 'error').length,
            warnings: unique.filter(i => i.severity === 'warning').length, info: unique.filter(i => i.severity === 'info').length },
        physics, resources, issues: unique };
}
