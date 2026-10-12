import { Matrix3, Matrix4, Euler, Vector3 } from 'three';

const tensorKeys = ['ixx', 'iyy', 'izz', 'ixy', 'ixz', 'iyz'];
const vector = (value) => Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);
const rows = (matrix) => Array.from({ length: 3 }, (_, r) => Array.from({ length: 3 }, (_, c) => matrix.elements[c * 3 + r]));

export function inspectLinkPhysics(link, rootInverse = new Matrix4()) {
    const p = link.inertial;
    const issues = [];
    const validity = p?.sourceValidity || {};
    const mass = p && validity.mass !== false && Number.isFinite(p.mass) && p.mass >= 0 ? p.mass : null;
    if (mass === null) issues.push(p ? 'invalidMass' : 'missingInertial');
    const origin = p && validity.origin !== false && vector(p.origin?.xyz) && vector(p.origin?.rpy) ? p.origin.xyz : null;
    if (p && !origin) issues.push('invalidOrigin');
    const inertia = p && validity.inertia !== false && tensorKeys.every(key => Number.isFinite(p[key]))
        ? new Matrix3().set(p.ixx, p.ixy, p.ixz, p.ixy, p.iyy, p.iyz, p.ixz, p.iyz, p.izz) : null;
    if (p && !inertia) issues.push('invalidInertia');
    let rootCOM = null;
    let rootInertia = null;
    if (link.threeObject && origin) {
        const transform = rootInverse.clone().multiply(link.threeObject.matrixWorld);
        const e = transform.elements;
        const columns = [new Vector3(e[0], e[1], e[2]), new Vector3(e[4], e[5], e[6]), new Vector3(e[8], e[9], e[10])];
        const rigid = e.every(Number.isFinite) && columns.every(v => Math.abs(v.length() - 1) < 1e-6)
            && Math.abs(columns[0].dot(columns[1])) < 1e-6 && Math.abs(columns[0].dot(columns[2])) < 1e-6
            && Math.abs(columns[1].dot(columns[2])) < 1e-6 && Math.abs(transform.determinant() - 1) < 1e-6;
        if (rigid) {
            rootCOM = new Vector3(...origin).applyMatrix4(transform).toArray();
            if (inertia) {
                // URDF fixed-axis RPY: Rz(yaw) Ry(pitch) Rx(roll).
                const inertialRotation = new Matrix4().makeRotationFromEuler(new Euler(...p.origin.rpy, 'ZYX'));
                const rotation = new Matrix3().setFromMatrix4(transform.clone().multiply(inertialRotation));
                rootInertia = rows(rotation.clone().multiply(inertia).multiply(rotation.clone().transpose()));
            }
        } else issues.push('nonRigidTransform');
    }
    return { name: link.name, mass, origin, rpy: origin ? p.origin.rpy : null, inertia: inertia ? rows(inertia) : null, rootCOM, rootInertia, issues };
}

export function inspectRobotPhysics(model) {
    model.threeObject?.updateWorldMatrix(true, true);
    const inverse = model.threeObject ? model.threeObject.matrixWorld.clone().invert() : new Matrix4();
    const links = [...model.links.values()].map(link => inspectLinkPhysics(link, inverse));
    const mass = links.reduce((sum, link) => sum + (link.mass ?? 0), 0);
    const massComplete = links.every(link => link.mass !== null);
    const positive = links.filter(link => link.mass > 0);
    const knownCOM = mass > 0 && positive.every(link => link.rootCOM !== null);
    const com = knownCOM ? [0, 1, 2].map(i => positive.reduce((sum, link) => sum + link.mass * link.rootCOM[i], 0) / mass) : null;
    const comComplete = massComplete && !!com;
    const inertiaComplete = comComplete && positive.every(link => link.rootInertia !== null);
    const knownInertia = knownCOM && positive.every(link => link.rootInertia !== null)
        ? Array.from({ length: 3 }, () => [0, 0, 0]) : null;
    if (knownInertia) for (const link of positive) {
        const d = link.rootCOM.map((v, i) => v - com[i]);
        const distanceSquared = d.reduce((sum, v) => sum + v * v, 0);
        for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
            knownInertia[r][c] += link.rootInertia[r][c] + link.mass * ((r === c ? distanceSquared : 0) - d[r] * d[c]);
        }
    }
    return { frame: model.rootLink, mass, com, inertia: inertiaComplete ? knownInertia : null, knownInertia, massComplete, comComplete, inertiaComplete, links };
}

export function principalMoments(tensor) {
    const a = tensor.map(row => [...row]);
    for (let step = 0; step < 32; step++) {
        let p = 0, q = 1;
        for (const [i, j] of [[0, 2], [1, 2]]) if (Math.abs(a[i][j]) > Math.abs(a[p][q])) { p = i; q = j; }
        if (Math.abs(a[p][q]) <= 1e-14 * Math.max(1e-12, ...a.flat().map(Math.abs))) break;
        const angle = 0.5 * Math.atan2(2 * a[p][q], a[q][q] - a[p][p]);
        const c = Math.cos(angle), s = Math.sin(angle), pp = a[p][p], qq = a[q][q], pq = a[p][q];
        a[p][p] = c * c * pp - 2 * s * c * pq + s * s * qq;
        a[q][q] = s * s * pp + 2 * s * c * pq + c * c * qq;
        a[p][q] = a[q][p] = 0;
        for (let k = 0; k < 3; k++) if (k !== p && k !== q) {
            const kp = a[k][p], kq = a[k][q];
            a[k][p] = a[p][k] = c * kp - s * kq;
            a[k][q] = a[q][k] = s * kp + c * kq;
        }
    }
    return [a[0][0], a[1][1], a[2][2]].sort((a, b) => a - b);
}
