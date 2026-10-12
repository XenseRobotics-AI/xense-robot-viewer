import { AnimationStore } from '../animation/core/AnimationStore.js';
import { evaluateClip } from '../animation/core/BezierEvaluator.js';

const normalizePath = (path) => path.replace(/\\/g, '/').replace(/^\/+/, '');

// Search from the model's directory upward so another workcell's identically
// named config can never win through a basename-only lookup.
export function findStartPoseFile(modelFile, fileMap) {
    const paths = [...fileMap].filter(([, file]) => file === modelFile)
        .map(([path]) => normalizePath(path));
    if (modelFile?.webkitRelativePath) paths.push(normalizePath(modelFile.webkitRelativePath));
    const modelPath = paths.sort((a, b) => b.split('/').length - a.split('/').length)[0];
    if (!modelPath) return null;
    const files = new Map([...fileMap].map(([path, file]) => [normalizePath(path), file]));
    const modelName = modelPath.split('/').pop().replace(/\.[^.]+$/, '');
    let directory = modelPath.split('/').slice(0, -1);
    while (true) {
        const prefix = directory.length ? `${directory.join('/')}/` : '';
        // Assemblies may ship a named variant, e.g. a -taccap URDF alongside
        // config/start_pose.taccap.robotanim.json. Prefer that exact suffix.
        const variant = [...files.keys()].filter((path) => {
            if (!path.startsWith(`${prefix}config/`)) return false;
            const match = path.slice(`${prefix}config/`.length).match(/^start_pose\.([^/]+)\.robotanim\.json$/);
            return match && modelName.endsWith(`-${match[1]}`);
        }).sort((a, b) => b.length - a.length)[0];
        if (variant) return { path: variant, file: files.get(variant) };
        for (const suffix of ['config/start_pose.robotanim.json', 'start_pose.robotanim.json']) {
            const path = prefix + suffix;
            if (files.has(path)) return { path, file: files.get(path) };
        }
        if (!directory.length) return null;
        directory.pop();
    }
}

export function readStartPose(serialized, model) {
    const store = new AnimationStore();
    store.load(serialized);
    const robotName = store.project.robot.name;
    if (robotName && robotName !== 'Robot' && robotName !== model.name) {
        throw new Error(`Pose belongs to ${robotName}, not ${model.name}`);
    }
    const values = evaluateClip(store.activeClip, store.activeClip.playRange.startMs);
    if (!Object.keys(values).length) throw new Error('Start pose has no joint values');
    for (const [name, value] of Object.entries(values)) {
        const joint = model.joints.get(name);
        if (!joint || joint.type === 'fixed' || !Number.isFinite(value)) {
            throw new Error(`Invalid start pose joint: ${name}`);
        }
    }
    return values;
}

export class PosePresetController {
    constructor(poseController, { selected = 'zero', beforeApply = () => {} } = {}) {
        this.poseController = poseController;
        this.beforeApply = beforeApply;
        this.selected = selected === 'initial' ? 'initial' : 'zero';
        this.model = null;
        this.active = null;
        this.initialPose = null;
        this.initialStatus = 'poseNoModel';
        this.listeners = new Set();
        this.revision = 0;
        poseController.subscribe((event) => {
            if (event.type === 'jointChanged' && event.source !== 'posePreset'
                && (this.active !== null || this.autoApplyPending)) {
                this.active = null;
                this.autoApplyPending = false;
                this.emit();
            }
        });
    }

    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    emit() {
        this.listeners.forEach((listener) => listener());
    }

    async setModel(model, file, fileMap) {
        const revision = ++this.revision;
        this.model = model?.joints?.size ? model : null;
        this.initialPose = null;
        this.active = null;
        this.initialStatus = this.model ? 'poseLoading' : 'poseNoModel';
        this.autoApplyPending = this.selected === 'initial';
        this.basePose = this.poseController.getPose();
        this.emit();
        if (!this.model) return;

        // Start from a deterministic zero pose while the local config is read.
        // This does not change the user's preferred mode for subsequent models.
        this.apply('zero', false);
        const candidate = findStartPoseFile(file, fileMap);
        if (!candidate) {
            this.initialStatus = 'poseMissing';
            this.emit();
            return;
        }
        try {
            const text = await candidate.file.text();
            if (revision !== this.revision) return;
            this.initialPose = { ...this.basePose, ...readStartPose(text, this.model) };
            this.initialStatus = 'poseInitialHint';
            if (this.autoApplyPending && this.selected === 'initial') this.apply('initial', false);
        } catch (error) {
            if (revision !== this.revision) return;
            this.initialStatus = 'poseInvalid';
            console.warn(`Cannot read start pose: ${candidate.path}`, error);
        }
        this.emit();
    }

    apply(mode, remember = true) {
        if (!this.model || !['zero', 'initial'].includes(mode)) return false;
        if (mode === 'initial' && !this.initialPose) return false;
        if (remember) {
            this.selected = mode;
            this.autoApplyPending = false;
        }
        const values = mode === 'initial' ? this.initialPose
            : Object.fromEntries([...this.model.joints]
                .filter(([, joint]) => joint.type !== 'fixed').map(([name]) => [name, 0]));
        this.beforeApply();
        // Like the existing reset action, presets retain their exact values,
        // including a true zero outside a joint's configured motion limits.
        this.poseController.applyPose(values, { source: 'posePreset', ignoreLimits: true });
        this.active = mode;
        this.emit();
        return true;
    }
}
