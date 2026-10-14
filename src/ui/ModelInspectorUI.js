import { i18n } from '../utils/i18n.js';
import { inspectRobotPhysics } from '../inspection/PhysicalProperties.js';
import { inspectProvenance } from '../inspection/Provenance.js';
import { inspectModel } from '../inspection/ModelChecks.js';
import { inspectRobotMeshes } from '../inspection/MeshStatistics.js';
import { currentPath } from '../inspection/AssetPaths.js';

const words = {
    zh: {
        physics: '查看物理属性', source: '查看来源', mesh: '面片统计', checks: '模型体检报告', close: '关闭',
        unsupported: '当前文件不支持此项检查', noModel: '请先加载模型', loading: '正在分析…', whole: 'URDF 整体', select: '选择 link / 整体',
        pick: '也可点击模型或结构树选择 link。', mass: '质量 (kg)', subtotal: '已知质量小计 (kg)',
        knownCOM: '已知质量部分的质心 (m)', knownInertia: '已知质量部分的质心处惯量 (kg·m²)',
        com: '质心 (m)', inertia: '质心处惯量张量 (kg·m²)', origin: '质心在 link 坐标系中的位置 (m)',
        rotation: '惯性坐标系相对 link 的 RPY (rad)', linkTensor: '惯量张量 · 惯性坐标系 (kg·m²)',
        rootCOM: '质心在根坐标系中的位置 (m)', rootTensor: '质心处惯量张量 · 根坐标系 (kg·m²)',
        currentFrame: '按当前关节姿态计算，坐标轴采用根 link：', partial: '存在缺失或无效数据；小计不代表完整模型。整机完整惯量暂不可用。',
        missing: '缺失 / 无效项', unavailable: '未提供 / 无法计算', declared: '显示 URDF 声明的参数，不代表参数已标定或经过动力学验证。',
        file: '当前文件', import: '加载方式', local: '本地导入', digest: '当前文件 SHA-256', metadata: '来源清单', repo: '上游仓库',
        version: '版本 / 提交', upstreamPath: '上游路径', upstreamHash: '上游文件 SHA-256', expected: '清单记录的当前文件 SHA-256',
        snapshot: '快照方式', status: '完整性校验', matched: 'SHA-256 一致', modified: 'SHA-256 不一致，文件已变化',
        unrecorded: '未记录当前文件校验值', ambiguous: '匹配到多个清单，无法唯一确认',
        hashMatch: '通过相同 SHA-256 关联到此清单（当前文件可能是副本）', pathMatch: '通过文件路径关联到此清单',
        unknownSource: '未发现可关联的来源清单。仅靠 SHA-256 无法反推出上游仓库或版本；本地导入也无法证明文件是否修改过。',
        unknownVersion: '未记录', components: '装配体组件与锁定版本', lock: '装配体锁定的 SHA-256',
        actual: '组件当前 SHA-256', raw: '展开原始清单', checksums: 'SHA 校验文件', parseErrors: '无法读取的元数据',
        visualMeshes: '视觉几何', collisionMeshes: '碰撞几何', allMeshes: '合计（视觉 + 碰撞）', meshKind: '几何类别',
        urdfBytes: 'URDF 文件大小（不含网格）',
        emptyLinkMeshes: '此 link 没有已加载的视觉或碰撞几何。相连 link 的几何计入各自的统计。',
        robotMeshNote: '统计已加载的几何体，包括 URDF 基本形状；视觉和碰撞分别计算，同一网格的不同实例分别计数。隐藏几何仍计入，坐标轴、质心等辅助物不计入。加载期间会自动更新，加载失败的资源不计入。顶点未焊接去重。',
        triangles: '三角面片数', vertices: '顶点缓冲条目数', meshes: '网格实例数', bytes: '文件大小',
        meshNote: '按已加载几何体统计全部面片，不受显示开关影响。顶点未做焊接去重；STL 本身不声明长度单位。',
        summary: '检查结果', errors: '错误', warnings: '警告', info: '提示', passed: '当前检查项未发现问题。',
        scope: '检查 URDF 结构、资源路径和已声明的物理参数，不代替动力学仿真、碰撞测试或实物验证。',
        export: '导出 JSON 报告', refresh: '重新检查', links: 'Links', joints: 'Joints', problem: '问题', subject: '对象',
        missingInertial: '缺少惯性参数', invalidMass: '质量缺失、非有限值或为负数', invalidOrigin: '位姿参数缺失或格式无效',
        invalidInertia: '惯量张量字段不完整或无效', nonRigidTransform: 'link 变换包含缩放或非刚体变换，无法汇总惯量',
        negativeInertia: '惯量存在负的主惯性矩', inertiaTriangle: '主惯性矩不满足三角不等式', degenerateInertia: '正质量 link 的惯量退化',
        masslessInertia: '零质量 link 声明了非零惯量', unknownLink: '关节引用了不存在的 link', multipleParents: 'link 具有多个父关节',
        invalidAxis: '关节轴无效或长度为零', unnormalizedAxis: '关节轴未归一化', missingLimits: '关节缺少有效的上下限',
        invertedLimits: '关节下限大于上限', invalidLimit: '关节速度 / 力矩限制无效', unknownMimic: 'mimic 引用了不存在的关节',
        rootCount: 'URDF 必须恰好有一个根 link', cycle: '关节树存在循环', duplicateName: 'link / joint 名称重复或缺失',
        invalidXML: 'URDF XML 格式错误', missingResource: '资源文件缺失或路径无法解析', ambiguousResource: '资源路径匹配不唯一',
        fallbackResource: '资源通过查看器回退规则找到，请核对可移植路径',
        externalResource: '依赖外部资源，离线可移植性需要确认', invalidScale: '网格缩放无效或包含零', mirroredScale: '网格使用负缩放（镜像）',
        nonuniformScale: '网格使用非均匀缩放，请核对几何与物理参数', noSourceXML: '没有可检查的 URDF 源文本',
        sourceModified: '来源清单 SHA-256 校验失败',
    },
    en: {
        physics: 'Physical properties', source: 'View source', mesh: 'Mesh statistics', checks: 'Model health report', close: 'Close',
        unsupported: 'This inspection is unavailable for the current file', noModel: 'Load a model first', loading: 'Analyzing…', whole: 'Whole URDF', select: 'Select link / whole model',
        pick: 'You can also select a link in the viewport or structure tree.', mass: 'Mass (kg)', subtotal: 'Known mass subtotal (kg)',
        knownCOM: 'COM of known-mass links (m)', knownInertia: 'Inertia about COM of known-mass links (kg·m²)',
        com: 'Center of mass (m)', inertia: 'Inertia about COM (kg·m²)', origin: 'COM in link frame (m)',
        rotation: 'Inertial frame RPY relative to link (rad)', linkTensor: 'Inertia · inertial frame (kg·m²)',
        rootCOM: 'COM in root frame (m)', rootTensor: 'Inertia about COM · root axes (kg·m²)',
        currentFrame: 'Computed at the current pose, expressed in root link axes: ', partial: 'Some parameters are missing or invalid. Subtotals do not describe the complete model; full inertia is unavailable.',
        missing: 'Missing / invalid parameters', unavailable: 'Not provided / unavailable', declared: 'Parameters are declared by the URDF; they are not calibrated or validated by this viewer.',
        file: 'Current file', import: 'Loaded from', local: 'Local import', digest: 'Current file SHA-256', metadata: 'Source manifest', repo: 'Upstream repository',
        version: 'Version / commit', upstreamPath: 'Upstream path', upstreamHash: 'Upstream file SHA-256', expected: 'Manifest SHA-256 for current file',
        snapshot: 'Snapshot mode', status: 'Integrity check', matched: 'SHA-256 matches', modified: 'SHA-256 mismatch; file has changed',
        unrecorded: 'No checksum recorded for current file', ambiguous: 'Multiple matching manifests; source is ambiguous',
        hashMatch: 'Associated by SHA-256 (current file may be a copy)', pathMatch: 'Associated by file path',
        unknownSource: 'No associated source manifest found. SHA-256 alone cannot identify the upstream repository or version, and a local import does not establish whether the file was modified.',
        unknownVersion: 'Not recorded', components: 'Assembly components and pinned versions', lock: 'Assembly-pinned SHA-256',
        actual: 'Current component SHA-256', raw: 'Raw manifest', checksums: 'SHA checksum files', parseErrors: 'Unreadable metadata',
        visualMeshes: 'Visual geometry', collisionMeshes: 'Collision geometry', allMeshes: 'Total (visual + collision)', meshKind: 'Geometry',
        urdfBytes: 'URDF file size (excluding meshes)',
        emptyLinkMeshes: 'This link has no loaded visual or collision geometry. Geometry on connected links is counted under those links.',
        robotMeshNote: 'Counts loaded geometry including URDF primitives. Visuals and colliders are counted separately, including repeated mesh instances. Hidden geometry is included; viewer helpers are excluded. Updates during loading; failed resources are not counted. Vertices are not welded.',
        triangles: 'Triangles', vertices: 'Vertex buffer entries', meshes: 'Mesh instances', bytes: 'File size',
        meshNote: 'Counts all loaded geometry, independent of visibility. Vertices are not welded. STL files do not declare length units.',
        summary: 'Results', errors: 'Errors', warnings: 'Warnings', info: 'Notes', passed: 'No issues found by the current checks.',
        scope: 'Checks URDF structure, resource paths and declared physical parameters. This is not a dynamics, collision or hardware validation.',
        export: 'Export JSON report', refresh: 'Run checks again', links: 'Links', joints: 'Joints', problem: 'Issue', subject: 'Object',
        missingInertial: 'Missing inertial parameters', invalidMass: 'Missing, non-finite or negative mass', invalidOrigin: 'Invalid or missing origin values',
        invalidInertia: 'Incomplete or invalid inertia tensor', nonRigidTransform: 'Non-rigid link transform; inertia cannot be aggregated',
        negativeInertia: 'Negative principal moment of inertia', inertiaTriangle: 'Principal moments violate the triangle inequality', degenerateInertia: 'Degenerate inertia on a positive-mass link',
        masslessInertia: 'Non-zero inertia on a zero-mass link', unknownLink: 'Joint references an unknown link', multipleParents: 'Link has multiple parent joints',
        invalidAxis: 'Invalid or zero joint axis', unnormalizedAxis: 'Joint axis is not normalized', missingLimits: 'Missing or invalid joint bounds',
        invertedLimits: 'Joint lower limit exceeds upper limit', invalidLimit: 'Invalid effort / velocity limit', unknownMimic: 'Mimic references an unknown joint',
        rootCount: 'URDF must have exactly one root link', cycle: 'Cycle in the joint tree', duplicateName: 'Missing or duplicate link / joint name',
        invalidXML: 'Invalid URDF XML', missingResource: 'Resource missing or path unresolved', ambiguousResource: 'Ambiguous resource path',
        fallbackResource: 'Resource resolved through viewer fallback; verify portable paths',
        externalResource: 'External resource; check offline portability', invalidScale: 'Invalid or zero mesh scale', mirroredScale: 'Negative mesh scale (mirroring)',
        nonuniformScale: 'Non-uniform mesh scale; verify geometry and physics', noSourceXML: 'URDF source text unavailable for checks',
        sourceModified: 'Source manifest SHA-256 mismatch',
    }
};
function node(tag, text, className) {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (className) element.className = className;
    return element;
}
const format = value => Number.isFinite(value) ? (value === 0 ? '0' : Number(value.toPrecision(8)).toString()) : '—';
const formatMegabytes = bytes => (bytes / 1_000_000).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 3 }) + ' MB';

export class ModelInspectorUI {
    constructor(sceneManager, poseController, panelManager) {
        this.sceneManager = sceneManager;
        this.revision = 0;
        this.renderRevision = 0;
        this.mode = 'physics';
        this.selected = '';
        this.buttons = new Map();
        const bar = document.getElementById('viewer-actions-bar');
        for (const mode of ['physics', 'source', 'mesh', 'checks']) {
            const button = node('button', '', 'tool-button');
            button.type = 'button';
            button.id = `inspect-${mode}-btn`;
            button.disabled = true;
            button.setAttribute('aria-controls', 'model-inspector-panel');
            button.setAttribute('aria-expanded', 'false');
            button.append(node('span'));
            button.addEventListener('click', () => this.open(mode));
            bar.append(button);
            this.buttons.set(mode, button);
        }
        this.panel = node('section', undefined, 'floating-panel model-inspector');
        this.panel.id = 'model-inspector-panel';
        this.panel.style.display = 'none';
        const header = node('div', undefined, 'floating-panel-header');
        this.title = node('span');
        this.close = node('button', '×');
        this.close.type = 'button';
        this.close.addEventListener('click', () => { this.panel.style.display = 'none'; this.renderRevision++; this.watchMeshGeometry(); this.updateButtons(); });
        header.append(this.title, this.close);
        this.body = node('div', undefined, 'inspector-body');
        this.panel.append(header, this.body);
        document.body.append(this.panel);
        panelManager.registerPanel(this.panel.id);
        sceneManager.on('linkSelected', link => {
            if (!this.model?.links?.has(link.name)) return;
            this.selected = link.name;
            if (this.visible && ['physics', 'mesh'].includes(this.mode)) this.render();
        });
        poseController.subscribe(event => {
            if (event.type !== 'jointChanged' || !this.visible || this.mode !== 'physics' || this.framePending) return;
            this.framePending = true;
            requestAnimationFrame(() => { this.framePending = false; if (this.visible && this.mode === 'physics') this.render(); });
        });
        this.refreshLanguage();
    }
    get visible() { return this.panel.style.display !== 'none'; }
    t(key) { return (i18n.getCurrentLanguage() === 'zh-CN' ? words.zh : words.en)[key] || key; }
    setModel(model, file, files, isMesh = false) {
        this.revision++;
        this.model = model;
        this.file = file;
        this.files = new Map(files || []);
        this.isMesh = isMesh;
        this.selected = '';
        this.sourcePromise = null;
        this.report = null;
        this.updateButtons();
        if (this.visible) {
            if (this.buttons.get(this.mode).disabled) this.panel.style.display = 'none';
            else this.render();
        }
        this.updateButtons();
        this.watchMeshGeometry();
    }
    updateButtons() {
        const robot = !!this.model?.links?.size && !this.isMesh && !!this.model.sourceXML;
        for (const [mode, button] of this.buttons) {
            button.disabled = mode === 'source' ? !this.file : mode === 'mesh' ? !(this.model?.meshStatistics || robot) : !robot;
            button.title = button.disabled ? this.t(this.file ? 'unsupported' : 'noModel') : this.t(mode);
            button.classList.toggle('active', this.visible && mode === this.mode);
            button.setAttribute('aria-expanded', String(this.visible && mode === this.mode));
        }
    }
    refreshLanguage() {
        for (const [mode, button] of this.buttons) button.firstElementChild.textContent = this.t(mode);
        this.close.title = this.t('close');
        this.close.setAttribute('aria-label', this.t('close'));
        this.updateButtons();
        if (this.visible) this.render();
    }
    open(mode) {
        if (this.buttons.get(mode).disabled) return;
        this.mode = mode;
        this.panel.style.display = 'flex';
        this.panel.style.zIndex = String(Math.max(100, ...[...document.querySelectorAll('.floating-panel')].map(p => Number(getComputedStyle(p).zIndex) || 50)) + 1);
        this.updateButtons();
        this.render();
        this.watchMeshGeometry();
    }
    watchMeshGeometry() {
        clearInterval(this.meshTimer);
        this.meshTimer = null;
        if (!this.visible || this.mode !== 'mesh' || this.isMesh) return;
        // Mesh callbacks can finish after modelReady; keep the open panel accurate.
        this.meshTimer = setInterval(() => {
            const signature = JSON.stringify(inspectRobotMeshes(this.model));
            if (signature !== this.meshSignature) this.render();
        }, 500);
    }
    paragraph(text, kind = '') { const p = node('p', text, kind); this.body.append(p); return p; }
    field(label, value, parent = this.body) {
        const row = node('div', undefined, 'inspector-field');
        row.append(node('strong', this.t(label)), node('div', value ?? this.t('unknownVersion')));
        parent.append(row);
    }
    tensor(label, value) {
        this.body.append(node('h4', this.t(label)));
        if (!value) { this.paragraph(this.t('unavailable')); return; }
        const table = node('table', undefined, 'inspector-tensor');
        table.setAttribute('aria-label', this.t(label));
        for (const row of value) { const tr = node('tr'); for (const v of row) tr.append(node('td', format(v))); table.append(tr); }
        this.body.append(table);
    }
    sourceData() {
        return this.sourcePromise ||= inspectProvenance(this.file, this.files);
    }
    async render() {
        const revision = this.revision, renderRevision = ++this.renderRevision;
        this.title.textContent = this.t(this.mode);
        this.panel.setAttribute('aria-label', this.t(this.mode));
        this.body.replaceChildren();
        try {
            if (this.mode === 'physics') this.renderPhysics();
            else if (this.mode === 'mesh') this.renderMesh();
            else {
                this.paragraph(this.t('loading'));
                const provenance = await this.sourceData();
                if (revision !== this.revision || renderRevision !== this.renderRevision || !this.visible) return;
                this.body.replaceChildren();
                if (this.mode === 'source') this.renderSource(provenance);
                else {
                    this.report = inspectModel(this.model, { path: currentPath(this.file, this.files), files: this.files });
                    this.report.provenance = provenance;
                    for (const record of [...provenance.records, ...provenance.checksums, ...provenance.components]) {
                        if (record.status === 'modified') this.report.issues.push({ severity: 'error', code: 'sourceModified', subject: record.instance || record.path, detail: record.expected });
                    }
                    this.report.summary.errors = this.report.issues.filter(issue => issue.severity === 'error').length;
                    this.renderChecks();
                }
            }
        } catch (error) {
            if (revision === this.revision && renderRevision === this.renderRevision) { this.body.replaceChildren(); this.paragraph(error.message, 'inspector-error'); }
        }
    }
    renderPhysics() {
        const physics = inspectRobotPhysics(this.model);
        const label = node('label', this.t('select'), 'inspector-selector');
        const select = node('select');
        select.setAttribute('aria-label', this.t('select'));
        select.append(new Option(this.t('whole'), ''));
        for (const link of physics.links) select.append(new Option(link.name, link.name));
        select.value = this.selected;
        select.addEventListener('change', () => { this.selected = select.value; this.render(); });
        label.append(select);
        this.body.append(label);
        this.paragraph(this.t('pick'));
        const link = physics.links.find(l => l.name === this.selected);
        if (link) {
            this.field('mass', link.mass === null ? this.t('unavailable') : format(link.mass));
            this.field('origin', link.origin?.map(format).join(', ') || this.t('unavailable'));
            this.field('rotation', link.rpy?.map(format).join(', ') || this.t('unavailable'));
            this.tensor('linkTensor', link.inertia);
            this.field('rootCOM', link.rootCOM?.map(format).join(', ') || this.t('unavailable'));
            this.tensor('rootTensor', link.rootInertia);
            for (const issue of link.issues) this.paragraph(this.t(issue), 'inspector-warning');
        } else {
            this.paragraph(this.t('currentFrame') + physics.frame);
            this.field(physics.massComplete ? 'mass' : 'subtotal', format(physics.mass));
            this.field(physics.massComplete ? 'com' : 'knownCOM', physics.com?.map(format).join(', ') || this.t('unavailable'));
            this.tensor(physics.massComplete ? 'inertia' : 'knownInertia', physics.massComplete ? physics.inertia : physics.knownInertia);
            if (!physics.massComplete || !physics.comComplete || !physics.inertiaComplete) this.paragraph(this.t('partial'), 'inspector-warning');
            const missing = physics.links.filter(link => link.issues.length);
            if (missing.length) {
                this.body.append(node('h4', this.t('missing')));
                for (const link of missing) {
                    const button = node('button', `${link.name}: ${link.issues.map(code => this.t(code)).join('; ')}`, 'inspector-link');
                    button.type = 'button';
                    button.addEventListener('click', () => { this.selected = link.name; this.render(); });
                    this.body.append(button);
                }
            }
        }
        this.paragraph(this.t('declared'));
    }
    renderMesh() {
        this.field('file', this.file.name);
        if (this.isMesh) {
            for (const key of ['triangles', 'vertices', 'meshes']) this.field(key, this.model.meshStatistics[key].toLocaleString());
            this.field('bytes', formatMegabytes(this.file.size));
            this.paragraph(this.t('meshNote'));
            return;
        }
        const snapshot = inspectRobotMeshes(this.model);
        this.meshSignature = JSON.stringify(snapshot);
        const label = node('label', this.t('select'), 'inspector-selector');
        const select = node('select');
        select.setAttribute('aria-label', this.t('select'));
        select.append(new Option(this.t('whole'), ''));
        for (const link of snapshot.links) select.append(new Option(link.name, link.name));
        select.value = this.selected;
        select.addEventListener('change', () => { this.selected = select.value; this.render(); });
        label.append(select);
        this.body.append(label);
        this.paragraph(this.t('pick'));
        const selectedLink = snapshot.links.find(link => link.name === this.selected);
        const statistics = selectedLink || snapshot;
        const table = node('table', undefined, 'inspector-tensor');
        table.setAttribute('aria-label', this.t('mesh'));
        const head = node('tr');
        for (const key of ['meshKind', 'triangles', 'vertices', 'meshes']) head.append(node('th', this.t(key)));
        const thead = node('thead'); thead.append(head); table.append(thead);
        const tbody = node('tbody');
        for (const [category, title] of [['visual', 'visualMeshes'], ['collision', 'collisionMeshes'], ['total', 'allMeshes']]) {
            const row = node('tr');
            row.dataset.meshCategory = category;
            row.append(node('th', this.t(title)));
            for (const key of ['triangles', 'vertices', 'meshes']) row.append(node('td', statistics[category][key].toLocaleString()));
            tbody.append(row);
        }
        table.append(tbody); this.body.append(table);
        if (selectedLink && statistics.total.meshes === 0) this.paragraph(this.t('emptyLinkMeshes'));
        if (!selectedLink) this.field('urdfBytes', formatMegabytes(this.file.size));
        this.paragraph(this.t('robotMeshNote'));
    }
    renderSource(result) {
        this.field('file', result.path);
        this.field('import', this.t('local'));
        this.field('digest', result.hash || result.hashError || this.t('unavailable'));
        if (!result.records.length) this.paragraph(this.t('unknownSource'), 'inspector-warning');
        for (const record of result.records) {
            this.body.append(node('h4', `${this.t('metadata')}: ${record.path}`));
            this.paragraph(this.t(record.relation === 'hash' ? 'hashMatch' : 'pathMatch'));
            this.renderUpstream(record.source);
            if (record.fileRecord?.source) this.field('upstreamPath', record.fileRecord.source);
            if (record.fileRecord?.source_sha256) this.field('upstreamHash', record.fileRecord.source_sha256);
            this.field('expected', record.expected);
            this.field('status', this.t(record.status));
            if (record.source.sha256) this.field('upstreamHash', record.source.sha256);
            const details = node('details');
            details.append(node('summary', this.t('raw')), node('pre', JSON.stringify(record.data, null, 2)));
            this.body.append(details);
        }
        if (result.checksums.length) {
            this.body.append(node('h4', this.t('checksums')));
            for (const checksum of result.checksums) this.paragraph(`${checksum.path}: ${this.t(checksum.status)} (${checksum.target})`);
        }
        if (result.components.length) {
            this.body.append(node('h4', this.t('components')));
            for (const component of result.components) {
                const details = node('details');
                details.append(node('summary', `${component.instance} · ${component.assetId} · ${this.t(component.status)}`));
                this.field('repo', component.source.repository, details);
                this.field('version', component.source.revision || component.source.version, details);
                this.field('file', component.path, details);
                this.field('lock', component.expected, details);
                this.field('actual', component.hash, details);
                this.body.append(details);
            }
        }
        if (result.errors.length) {
            const details = node('details'); details.append(node('summary', this.t('parseErrors')));
            for (const error of result.errors) details.append(node('p', `${error.path}: ${error.message}`));
            this.body.append(details);
        }
    }
    renderUpstream(source) {
        this.field('repo', source.repository || source.url);
        this.field('version', source.revision || source.version || source.commit || source.tag);
        if (source.path) this.field('upstreamPath', source.path);
        if (source.snapshot) this.field('snapshot', source.snapshot);
    }
    renderChecks() {
        const report = this.report;
        this.field('file', report.path);
        this.paragraph(this.t('scope'));
        this.paragraph(`${this.t('links')}: ${report.summary.links} · ${this.t('joints')}: ${report.summary.joints}`);
        this.paragraph(`${this.t('errors')}: ${report.summary.errors} · ${this.t('warnings')}: ${report.summary.warnings} · ${this.t('info')}: ${report.summary.info}`);
        const actions = node('div', undefined, 'inspector-report-actions');
        const download = node('button', this.t('export'), 'tool-button');
        download.type = 'button';
        download.addEventListener('click', () => {
            const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
            const a = node('a'); a.href = url; a.download = this.file.name + '.health.json'; a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        });
        const refresh = node('button', this.t('refresh'), 'tool-button');
        refresh.type = 'button';
        refresh.addEventListener('click', () => this.render());
        actions.append(download, refresh); this.body.append(actions);
        if (!report.issues.length) this.paragraph(this.t('passed'));
        for (const issue of [...report.issues].sort((a, b) => ['error', 'warning', 'info'].indexOf(a.severity) - ['error', 'warning', 'info'].indexOf(b.severity))) {
            const item = node('div', undefined, `inspector-issue inspector-${issue.severity}`);
            item.append(node('strong', `${this.t({ error: 'errors', warning: 'warnings', info: 'info' }[issue.severity])} · ${this.t(issue.code)}`), node('div', issue.subject));
            if (issue.detail) item.append(node('small', issue.detail));
            if (this.model.links.has(issue.subject)) {
                item.tabIndex = 0;
                item.setAttribute('role', 'button');
                item.addEventListener('click', () => { this.selected = issue.subject; this.open('physics'); });
                item.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); item.click(); } });
            }
            this.body.append(item);
        }
    }
}
