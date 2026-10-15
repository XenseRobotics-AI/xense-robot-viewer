import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { PartIsolationManager } from '../../src/renderer/PartIsolationManager.js';
import { HighlightManager } from '../../src/renderer/HighlightManager.js';
import { SceneManager } from '../../src/renderer/SceneManager.js';
import { CoordinateAxesManager } from '../../src/renderer/CoordinateAxesManager.js';
import { InertialVisualization } from '../../src/renderer/InertialVisualization.js';

function fixture() {
    const root = new THREE.Group();
    const model = { threeObject: root, links: new Map(), joints: new Map() };
    const links = ['base', 'arm', 'fixedTool'].map(name => {
        const threeObject = new THREE.Group();
        threeObject.name = name;
        threeObject.isURDFLink = true;
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), new THREE.MeshBasicMaterial());
        threeObject.add(mesh);
        const link = { name, threeObject, mesh, inertial: { mass: 1 } };
        model.links.set(name, link);
        return link;
    });
    root.add(links[0].threeObject);
    for (let index = 1; index < links.length; index++) {
        const joint = new THREE.Group();
        joint.name = `joint${index}`;
        joint.isURDFJoint = true;
        joint.position.x = 0.5;
        links[index - 1].threeObject.add(joint);
        joint.add(links[index].threeObject);
        model.joints.set(joint.name, { name: joint.name, child: links[index].name, type: index === 1 ? 'revolute' : 'fixed', threeObject: joint });
    }
    root.updateMatrixWorld(true);
    const events = [];
    const manager = Object.assign(Object.create(SceneManager.prototype), {
        scene: new THREE.Scene(), currentModel: model, helperDisplayScale: 0.5,
        redraw() {}, emit(...args) { events.push(args); },
    });
    manager.scene.add(root);
    manager.highlightManager = new HighlightManager(manager);
    // Avoid DOM dependencies while exercising the actual highlight state and materials.
    manager.highlightManager.showHoverInfo = () => {};
    manager.highlightManager.hideHoverInfo = () => {};
    manager.axesManager = new CoordinateAxesManager(manager);
    manager.inertialVisualization = new InertialVisualization(manager);
    manager.isolationManager = new PartIsolationManager(manager);
    return { manager, model, links, events };
}

test('isolating a nested link hides parents and fixed children while retaining its world pose', () => {
    const { manager, links } = fixture();
    const [base, arm, tool] = links;
    const before = arm.mesh.getWorldPosition(new THREE.Vector3());
    manager.isolationManager.enter(arm);
    assert.equal(base.mesh.layers.mask, 0);
    assert.equal(tool.mesh.layers.mask, 0);
    assert.equal(arm.mesh.layers.mask, 1);
    assert.equal(base.threeObject.visible, true);
    assert.deepEqual(arm.mesh.getWorldPosition(new THREE.Vector3()), before);
    const raycaster = new THREE.Raycaster(new THREE.Vector3(0, 0, 2), new THREE.Vector3(0, 0, -1));
    raycaster.layers.enableAll();
    assert.equal(raycaster.intersectObject(base.mesh).length, 0);
    assert.equal(manager.isolationManager.isSelectable(tool.mesh), false);
});

test('hover, unhover, and clear requests cannot change the isolated selection', () => {
    const { manager, links, events } = fixture();
    manager.isolationManager.enter(links[1]);
    manager.highlightManager.highlightLink(links[0], manager.currentModel);
    manager.highlightManager.unhighlightLink(links[1], manager.currentModel);
    manager.highlightManager.clearHighlight();
    assert.equal(manager.highlightManager.currentHighlightedLink.name, 'arm');
    assert.equal(events.filter(([name]) => name === 'linkSelected').length, 1);
    manager.isolationManager.exit();
    manager.highlightManager.highlightLink(links[0], manager.currentModel);
    assert.equal(manager.highlightManager.currentHighlightedLink.name, 'base');
});

test('exit restores original layers and retains display toggles made during isolation', () => {
    const { manager, links } = fixture();
    links[0].mesh.layers.set(3);
    links[2].mesh.visible = false;
    manager.isolationManager.enter(links[1]);
    const added = new THREE.Mesh(new THREE.SphereGeometry(0.02), new THREE.MeshBasicMaterial());
    links[0].threeObject.add(added);
    manager.isolationManager.apply();
    assert.equal(added.layers.mask, 0);
    links[1].mesh.visible = false;
    manager.isolationManager.exit();
    assert.equal(links[0].mesh.layers.mask, 8);
    assert.equal(added.layers.mask, 1);
    assert.equal(links[1].mesh.visible, false);
    assert.equal(links[2].mesh.visible, false);
    assert.equal(manager.isolationManager.savedLayers.size, 0);
});

test('isolated joint helper belongs to its child link', () => {
    const { manager, model, links } = fixture();
    const axis = manager.axesManager.createJointAxis(model.joints.get('joint1'), 'joint1');
    manager.axesManager.showAllJointAxes();
    manager.isolationManager.enter(links[1]);
    axis.traverse(object => { if (object.isMesh) assert.equal(object.layers.mask, 1); });
    manager.isolationManager.enter(links[0]);
    axis.traverse(object => { if (object.isMesh) assert.equal(object.layers.mask, 0); });
});

test('helper scaling defaults to half size, scales thickness, and preserves anchors and robot geometry', () => {
    const { manager, model, links } = fixture();
    const arm = links[1];
    const axis = manager.axesManager.createLinkAxes(arm, arm.name);
    const jointAxis = manager.axesManager.createJointAxis(model.joints.get('joint1'), 'joint1');
    const position = new THREE.Vector3(0.1, 0.05, 0.02);
    manager.inertialVisualization.createCOMMarker(model, arm, position);
    const com = manager.inertialVisualization.comMarkers[0];
    assert.equal(axis.scale.x, 0.5);
    assert.equal(jointAxis.scale.x, 0.5);
    assert.equal(com.scale.x, 0.5);
    const bounds = object => new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3());
    const halfSize = bounds(axis);
    const robotSize = bounds(arm.mesh);
    manager.setHelperDisplayScale(1);
    assert.ok(bounds(axis).distanceTo(halfSize.clone().multiplyScalar(2)) < 1e-8);
    assert.equal(jointAxis.scale.x, 1); // Detached helpers update too.
    assert.deepEqual(bounds(arm.mesh), robotSize);
    assert.deepEqual(com.position, position);
    manager.setHelperDisplayScale(0);
    assert.equal(axis.scale.x, 0.1);
    assert.equal(com.scale.x, 0.1);
    manager.setHelperDisplayScale(2);
    assert.equal(axis.scale.x, 1);
    const laterAxis = manager.axesManager.createLinkAxes(links[2], links[2].name);
    assert.equal(laterAxis.scale.x, 1);
});
