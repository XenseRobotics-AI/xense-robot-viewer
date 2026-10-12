import test from 'node:test';
import assert from 'node:assert/strict';
import { PosePresetController, findStartPoseFile, readStartPose } from '../../src/controllers/PosePresetController.js';
import { PoseController } from '../../src/animation/runtime/PoseController.js';
import { URDFAdapter } from '../../src/adapters/URDFAdapter.js';
import { FileHandler } from '../../src/controllers/FileHandler.js';

function model(name = 'cell') {
    const joints = new Map([
        ['arm', { type: 'revolute', currentValue: 1.2, limits: { lower: 1, upper: 3 },
            threeObject: { setJointValue() {} } }],
        ['tool', { type: 'prismatic', currentValue: 0.02, threeObject: { setJointValue() {} } }],
        ['base', { type: 'fixed', currentValue: 0 }]
    ]);
    return { name, joints, getJoint: (name) => joints.get(name) };
}

function config(name = 'cell', value = 2) {
    return JSON.stringify({ schemaVersion: 2, robot: { name }, activeClipId: 'start', clips: [
        { id: 'other', durationMs: 1000, tracks: [] },
        { id: 'start', durationMs: 1000, playRange: { startMs: 500, endMs: 1000 }, tracks: [
            { type: 'joint', jointName: 'arm', keyframes: [
                { timeMs: 0, value: value - 1, interpolation: 'linear' },
                { timeMs: 1000, value: value + 1 }
            ] }
        ] }
    ] });
}

function runtime(selected = 'zero') {
    const pose = new PoseController();
    const robot = model();
    pose.setModel(robot);
    const controller = new PosePresetController(pose, { selected });
    return { pose, robot, controller };
}

test('an assembly root link name does not replace its robot identity during pose validation', () => {
    const robotName = 'assembly_forward_01_flexiv_rizon4s_taccap';
    const converted = URDFAdapter.convert({
        name: '__workspace_scene_root__', robotName,
        links: {}, joints: {}, traverse() {}
    });
    converted.joints = model().joints;
    assert.deepEqual(readStartPose(config(robotName), converted), { arm: 2 });
});

test('folder loading prefers the 01 TacCap assembly and preserves the fallback when absent', () => {
    const handler = new FileHandler();
    const first = { name: 'a-first.urdf', category: 'model' };
    const scene = { name: 'scene.xml', category: 'model' };
    const preferred = { name: 'forward-01-flexiv-rizon4s-taccap.urdf', category: 'model' };
    assert.equal(handler.selectInitialModel([first, scene, preferred]), preferred);
    assert.equal(handler.selectInitialModel([first, scene]), scene);
    assert.equal(handler.selectInitialModel([first]), first);
    assert.equal(handler.selectInitialModel([]), null);
});

test('workcells with identical config basenames resolve by model directory, not map order', () => {
    const robot = { name: 'model.urdf' };
    const other = {};
    const correct = {};
    const map = new Map([
        ['repo/assets/assemblies/other/config/start_pose.robotanim.json', other],
        ['model.urdf', robot],
        ['/repo/assets/assemblies/current/urdf/model.urdf', robot],
        ['repo/assets/assemblies/current/config/start_pose.robotanim.json', correct]
    ]);
    assert.equal(findStartPoseFile(robot, map).file, correct);
    map.delete('repo/assets/assemblies/current/config/start_pose.robotanim.json');
    assert.equal(findStartPoseFile(robot, map), null);
});

test('named assembly variants take precedence over the standard start pose', () => {
    const robot = { name: 'cell-taccap.urdf' };
    const variant = {};
    const map = new Map([
        ['assets/cell/urdf/cell-taccap.urdf', robot],
        ['assets/cell/config/start_pose.robotanim.json', {}],
        ['assets/cell/config/start_pose.taccap.robotanim.json', variant]
    ]);
    assert.equal(findStartPoseFile(robot, map).file, variant);
});

test('initial pose samples the active clip at playback start and rejects another robot', () => {
    assert.deepEqual(readStartPose(config(), model()), { arm: 2 });
    assert.throws(() => readStartPose(config('different-cell'), model()), /belongs to/);
    const bad = JSON.parse(config());
    bad.clips[1].tracks[0].jointName = 'missing';
    assert.throws(() => readStartPose(JSON.stringify(bad), model()), /Invalid start pose joint/);
    assert.throws(() => readStartPose('{}', model()), /invalid animation/);
});

test('zero is exact outside joint limits; initial restores configured arms and model-load tool values', async () => {
    const { pose, robot, controller } = runtime();
    const file = { name: 'robot.urdf' };
    const map = new Map([['cell/urdf/robot.urdf', file],
        ['cell/config/start_pose.robotanim.json', { text: async () => config() }]]);
    await controller.setModel(robot, file, map);
    assert.equal(pose.getJointValue('arm'), 0);
    assert.equal(pose.getJointValue('tool'), 0);
    controller.apply('initial');
    assert.equal(pose.getJointValue('arm'), 2);
    assert.equal(pose.getJointValue('tool'), 0.02);
    pose.setJointValue('arm', 2.5, { source: 'user' });
    assert.equal(controller.active, null);
    assert.equal(controller.selected, 'initial');
});

test('a slow previous model config cannot overwrite the current model', async () => {
    const { pose, robot, controller } = runtime('initial');
    let finish;
    const file = { name: 'robot.urdf' };
    const pending = controller.setModel(robot, file, new Map([
        ['cell/robot.urdf', file],
        ['cell/config/start_pose.robotanim.json', { text: () => new Promise((resolve) => { finish = resolve; }) }]
    ]));
    const next = model('next');
    pose.setModel(next);
    await controller.setModel(next, { name: 'next.urdf' }, new Map());
    finish(config());
    await pending;
    assert.equal(controller.model, next);
    assert.equal(controller.initialPose, null);
    assert.equal(controller.initialStatus, 'poseMissing');
    assert.equal(pose.getJointValue('arm'), 0);
});

test('manual edits made during config loading are retained instead of applying the remembered preset', async () => {
    const { pose, robot, controller } = runtime('initial');
    let finish;
    const file = { name: 'robot.urdf' };
    const pending = controller.setModel(robot, file, new Map([
        ['cell/robot.urdf', file],
        ['cell/config/start_pose.robotanim.json', { text: () => new Promise((resolve) => { finish = resolve; }) }]
    ]));
    pose.setJointValue('arm', 2.5, { source: 'user' });
    finish(config());
    await pending;
    assert.equal(pose.getJointValue('arm'), 2.5);
    assert.equal(controller.active, null);
    assert.equal(controller.initialPose.arm, 2);
});
