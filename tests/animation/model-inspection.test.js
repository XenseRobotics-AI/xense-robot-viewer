import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { Group, Matrix4, Mesh, BoxGeometry, BufferGeometry, Float32BufferAttribute, InstancedMesh, MeshBasicMaterial } from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { inspectRobotPhysics, principalMoments } from '../../src/inspection/PhysicalProperties.js';
import { inspectMesh, inspectRobotMeshes } from '../../src/inspection/MeshStatistics.js';
import { inspectProvenance, sha256 } from '../../src/inspection/Provenance.js';
import { inspectModel } from '../../src/inspection/ModelChecks.js';
import { resolveResource } from '../../src/inspection/AssetPaths.js';
if (!globalThis.crypto) globalThis.crypto = webcrypto;
const file = (name, content) => Object.assign(new Blob([typeof content === 'string' ? content : JSON.stringify(content)]), { name });
const inertial = (mass = 1) => ({ mass, origin: { xyz: [0, 0, 0], rpy: [0, 0, 0] }, ixx: 1, iyy: 2, izz: 3, ixy: 0, ixz: 0, iyz: 0 });
function robot() {
    const root = new Group();
    const links = new Map();
    for (const [name, x] of [['left', -1], ['right', 1]]) {
        const object = new Group(); object.position.x = x; root.add(object);
        links.set(name, { name, threeObject: object, inertial: inertial() });
    }
    return { name: 'test', rootLink: 'world', links, joints: new Map(), threeObject: root };
}
const approximately = (actual, expected) => {
    if (Array.isArray(expected)) expected.forEach((value, i) => approximately(actual[i], value));
    else assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);
};

test('whole-robot inertia applies the parallel-axis theorem about combined COM', () => {
    const result = inspectRobotPhysics(robot());
    assert.equal(result.mass, 2);
    approximately(result.com, [0, 0, 0]);
    approximately(result.inertia, [[2, 0, 0], [0, 6, 0], [0, 0, 8]]);
    assert.equal(result.inertiaComplete, true);
});
test('viewer translation, rotation and display scale do not change robot-frame physics', () => {
    const model = robot();
    model.threeObject.position.set(20, 30, 40);
    model.threeObject.rotation.set(0.4, -0.3, 1.2);
    model.threeObject.scale.setScalar(0.01);
    const result = inspectRobotPhysics(model);
    approximately(result.com, [0, 0, 0]);
    approximately(result.inertia, [[2, 0, 0], [0, 6, 0], [0, 0, 8]]);
});
test('inertial RPY rotates tensor axes and current link pose changes COM', () => {
    const model = robot();
    model.links.get('left').inertial.origin.rpy[2] = Math.PI / 2;
    model.links.get('right').threeObject.position.x = 3;
    const result = inspectRobotPhysics(model);
    approximately(result.com, [1, 0, 0]);
    approximately(result.links[0].rootInertia, [[2, 0, 0], [0, 1, 0], [0, 0, 3]]);
    approximately(result.inertia, [[3, 0, 0], [0, 11, 0], [0, 0, 14]]);
});
test('URDF mixed roll/pitch/yaw uses fixed-axis Rz Ry Rx', () => {
    const model = robot(), link = model.links.get('left');
    link.inertial.origin.rpy = [0.3, 0.4, 0.5];
    const r = new Matrix4().makeRotationZ(0.5).multiply(new Matrix4().makeRotationY(0.4)).multiply(new Matrix4().makeRotationX(0.3));
    const e = r.elements;
    const expected = [0,1,2].map(i => [0,1,2].map(j => [1,2,3].reduce((sum, v, k) => sum + v * e[k*4+i] * e[k*4+j], 0)));
    approximately(inspectRobotPhysics(model).links[0].rootInertia, expected);
});
test('missing inertial parameters never silently contribute fabricated zero mass', () => {
    const model = robot(); model.links.get('left').inertial = null;
    const result = inspectRobotPhysics(model);
    assert.equal(result.mass, 1); assert.equal(result.massComplete, false);
    assert.equal(result.comComplete, false); assert.equal(result.inertia, null);
    approximately(result.com, [1,0,0]);
    approximately(result.knownInertia, [[1,0,0],[0,2,0],[0,0,3]]);
    assert.deepEqual(result.links[0].issues, ['missingInertial']);
});
test('missing inertia fields and non-rigid link scales prevent full inertia aggregation', () => {
    const model = robot(); model.links.get('left').inertial.sourceValidity = { inertia: false };
    let result = inspectRobotPhysics(model);
    assert.equal(result.massComplete, true); assert.equal(result.inertia, null);
    model.links.get('left').inertial = inertial(); model.links.get('left').threeObject.scale.x = 2;
    result = inspectRobotPhysics(model);
    assert.equal(result.com, null); assert.ok(result.links[0].issues.includes('nonRigidTransform'));
});
test('zero total mass leaves COM undefined without NaN values', () => {
    const model = robot(); for (const link of model.links.values()) link.inertial.mass = 0;
    const result = inspectRobotPhysics(model);
    assert.equal(result.mass, 0); assert.equal(result.com, null); assert.equal(result.inertia, null);
});
test('principal moments detect physically impossible and negative tensors, including off-diagonals', () => {
    approximately(principalMoments([[2,1,0],[1,2,0],[0,0,3]]), [1,3,3]);
    const model = robot(); model.links.get('left').inertial.izz = 9; model.links.get('right').inertial.ixx = -1;
    const report = inspectModel(model);
    assert.ok(report.issues.some(i => i.code === 'inertiaTriangle' && i.subject === 'left'));
    assert.ok(report.issues.some(i => i.code === 'negativeInertia' && i.subject === 'right'));
});
test('model health checks detect cycles, invalid axes, reversed limits and unknown links', () => {
    const model = robot();
    const joint = (name, parent, child) => ({ name, parent, child, type:'revolute', origin:{xyz:[0,0,0],rpy:[0,0,0]}, axis:{xyz:[0,0,0]}, limits:{lower:2,upper:1} });
    model.joints.set('a',joint('a','left','right')); model.joints.set('b',joint('b','right','left'));
    model.joints.set('bad',joint('bad','missing','left'));
    const codes = new Set(inspectModel(model).issues.map(i => i.code));
    for (const code of ['cycle','rootCount','invalidAxis','invertedLimits','unknownLink']) assert.ok(codes.has(code), code);
});
test('mesh counts cover indexed, nonindexed and instanced geometry without counting material groups twice', () => {
    const root = new Group(); const box = new BoxGeometry();
    root.add(new Mesh(box));
    const geometry = new BufferGeometry(); geometry.setAttribute('position',new Float32BufferAttribute([0,0,0,1,0,0,0,1,0],3));
    root.add(new Mesh(geometry)); root.add(new InstancedMesh(geometry,new MeshBasicMaterial(),2));
    assert.deepEqual(inspectMesh(root), {triangles:15, vertices:33, meshes:4});
});
test('ASCII and binary STL report the actual number of triangles', () => {
    const ascii = 'solid test\nfacet normal 0 0 1\nouter loop\nvertex 0 0 0\nvertex 1 0 0\nvertex 0 1 0\nendloop\nendfacet\nendsolid test';
    const loader = new STLLoader();
    assert.equal(inspectMesh(new Mesh(loader.parse(ascii))).triangles,1);
    const binary = new ArrayBuffer(84+50*2); new DataView(binary).setUint32(80,2,true);
    assert.equal(inspectMesh(new Mesh(loader.parse(binary))).triangles,2);
});
test('provenance links renamed local copies to upstream using SHA-256', async () => {
    const model = file('renamed.urdf','robot data'); const hash = await sha256(model);
    const manifest = file('asset.json',{id:'arm',source:{repository:'https://example.com/upstream',revision:'abc'},files:{'urdf/original.urdf':{sha256:hash,source:'resources/original.urdf'}}});
    const result = await inspectProvenance(model,new Map([['copy/renamed.urdf',model],['assets/arm/asset.json',manifest]]));
    assert.equal(result.records[0].relation,'hash'); assert.equal(result.records[0].status,'matched');
    assert.equal(result.records[0].source.revision,'abc');
});
test('assembly source hash is not confused with generated URDF hash; components verify lock hashes', async () => {
    const model = file('cell-taccap.urdf','generated'); const component = file('arm.urdf','arm'); const hash = await sha256(component);
    const assembly = file('assembly.taccap.json',{id:'cell',entrypoint:'urdf/cell-taccap.urdf',source:{sha256:'f'.repeat(64)},instances:{left:{asset_id:'arm',variant:'default'}},inputs:{left:hash}});
    const wrongVariant = file('assembly.json',{entrypoint:'urdf/cell.urdf'});
    const asset = file('asset.json',{id:'arm',source:{repository:'official',revision:'123'},entrypoints:{default:'urdf/arm.urdf'}});
    const map = new Map([['assets/cell/urdf/cell-taccap.urdf',model],['assets/cell/assembly.taccap.json',assembly],['assets/cell/assembly.json',wrongVariant],['assets/arm/asset.json',asset],['assets/arm/urdf/arm.urdf',component]]);
    const result = await inspectProvenance(model,map);
    assert.equal(result.records.length,1); assert.equal(result.records[0].status,'unrecorded');
    assert.equal(result.components[0].status,'matched'); assert.equal(result.components[0].source.revision,'123');
});
test('path-associated manifest detects a modified current file rather than matching a different hash entry', async () => {
    const model = file('robot.urdf','changed'); const manifest = file('asset.json',{files:{'robot.urdf':{sha256:'a'.repeat(64)}}});
    const result = await inspectProvenance(model,new Map([['arm/robot.urdf',model],['arm/asset.json',manifest]]));
    assert.equal(result.records[0].status,'modified');
});
test('GNU, BSD and per-file SHA256 checksums support path and renamed-copy matching', async () => {
    const model = file('renamed.stl','mesh'); const hash = await sha256(model);
    const map = new Map([['copy/renamed.stl',model],['original/SHA256SUMS',file('SHA256SUMS',hash+'  original.stl')],['copy/renamed.stl.sha256',file('renamed.stl.sha256','b'.repeat(64))],['other/checksums.sha256',file('checksums.sha256',`SHA256 (original.stl) = ${hash}`)]]);
    const result = await inspectProvenance(model,map);
    assert.equal(result.checksums.length,3); assert.equal(result.checksums.filter(c => c.status==='matched').length,2);
    assert.equal(result.checksums.find(c => c.relation==='path').status,'modified');
});
test('local file without metadata stays unknown and malformed metadata does not stop other matches', async () => {
    const model = file('robot.urdf','bare');
    const result = await inspectProvenance(model,new Map([['robot.urdf',model],['asset.json',file('asset.json','broken json')]]));
    assert.equal(result.records.length,0); assert.equal(result.errors.length,1); assert.equal(result.hash.length,64);
});
test('resource paths resolve relative traversal and package roots without choosing ambiguous basenames', () => {
    const mesh = file('arm.stl','mesh');
    const map = new Map([['repo/robots/arm/meshes/arm.stl',mesh]]);
    assert.equal(resolveResource('../../robots/arm/meshes/arm.stl','repo/cells/urdf/cell.urdf',map).status,'found');
    assert.equal(resolveResource('package://arm/meshes/arm.stl','repo/cell.urdf',map).status,'found');
    map.set('other/arm/meshes/arm.stl',file('arm.stl','other'));
    assert.equal(resolveResource('package://arm/meshes/arm.stl','repo/cell.urdf',map).status,'ambiguous');
    assert.equal(resolveResource('missing.stl','repo/cell.urdf',map).status,'missing');
});


test('omitted optional effort and velocity are not mistaken for invalid declarations', () => {
    const model = robot();
    model.joints.set('fixed',{name:'fixed',type:'fixed',parent:'left',child:'right',origin:{xyz:[0,0,0],rpy:[0,0,0]},limits:{lower:0,upper:0,effort:null,velocity:null}});
    assert.ok(!inspectModel(model).issues.some(i => i.code === 'invalidLimit'));
    model.joints.get('fixed').limits.effort = NaN;
    assert.ok(inspectModel(model).issues.some(i => i.code === 'invalidLimit'));
});
test('resource audit honors loader fallback and identifies truncated package paths', () => {
    const mesh = file('part.stl','mesh');
    const map = new Map([['renamed/meshes/part.stl',mesh]]);
    const result = resolveResource('package://original/meshes/part.stl','renamed/urdf/robot.urdf',map);
    assert.equal(result.status,'found'); assert.equal(result.resolution,'viewerFallback');
});


test('URDF mesh totals separate visual/collision geometry without recounting child links or helpers', () => {
    const root = new Group(), child = new Group(), joint = new Group();
    root.isURDFLink = true; child.isURDFLink = true; root.add(joint); joint.add(child);
    const visual = new Group(); visual.isURDFVisual = true;
    const collision = new Group(); collision.isURDFCollider = true; collision.visible = false;
    const childVisual = new Group(); childVisual.isURDFVisual = true;
    const geometry = new BoxGeometry();
    visual.add(new Mesh(geometry)); collision.add(new Mesh(geometry)); childVisual.add(new Mesh(geometry));
    root.add(visual,collision,new Mesh(geometry)); child.add(childVisual);
    const model = {links:new Map([['base',{name:'base',threeObject:root}],['arm',{name:'arm',threeObject:child}],['frame',{name:'frame',threeObject:new Group()}]])};
    const snapshot = inspectRobotMeshes(model);
    assert.deepEqual(snapshot.visual,{triangles:24,vertices:48,meshes:2});
    assert.deepEqual(snapshot.collision,{triangles:12,vertices:24,meshes:1});
    assert.deepEqual(snapshot.total,{triangles:36,vertices:72,meshes:3});
    assert.equal(snapshot.links.find(link=>link.name==='base').total.triangles,24);
    assert.equal(snapshot.links.find(link=>link.name==='arm').total.triangles,12);
    assert.equal(snapshot.links.find(link=>link.name==='frame').total.triangles,0);
    visual.visible = false;
    assert.deepEqual(inspectRobotMeshes(model),snapshot);
    childVisual.add(new Mesh(geometry));
    assert.equal(inspectRobotMeshes(model).visual.triangles,36);
});
test('URDF mesh traversal includes nested mesh groups and counts shared or instanced geometry occurrences', () => {
    const root = new Group(), visual = new Group(), nested = new Group(); visual.isURDFVisual = true;
    const geometry = new BufferGeometry(); geometry.setAttribute('position',new Float32BufferAttribute([0,0,0,1,0,0,0,1,0],3));
    nested.add(new InstancedMesh(geometry,new MeshBasicMaterial(),3),new Mesh(geometry)); visual.add(nested); root.add(visual);
    const snapshot = inspectRobotMeshes({links:new Map([['base',{name:'base',threeObject:root}]])});
    assert.deepEqual(snapshot.total,{triangles:4,vertices:12,meshes:4});
});
