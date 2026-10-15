![screenshot](./docs/screenshot.png)

---

# Xense Robot Viewer

[![Version](https://img.shields.io/badge/version-v1.3.2-blue.svg)](https://github.com/XenseRobotics-AI/xense-robot-viewer)
[![License](https://img.shields.io/badge/license-Apache--2.0-yellow.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-web-orange.svg)](https://github.com/XenseRobotics-AI/xense-robot-viewer)
[![JavaScript](https://img.shields.io/badge/language-JavaScript-f1e05a.svg)](https://github.com/XenseRobotics-AI/xense-robot-viewer)
[![Three.js](https://img.shields.io/badge/Three.js-0.163.0-black.svg)](https://threejs.org/)
[![Vite](https://img.shields.io/badge/Vite-4.5.0-646cff.svg)](https://vitejs.dev/)
[![Upstream Demo](https://img.shields.io/badge/Upstream_Demo-Live-brightgreen.svg)](http://viewer.robotsfan.com/)

**Xense Robot Viewer** is maintained by [XenseRobotics-AI](https://github.com/XenseRobotics-AI) for further customization. It is a web-based 3D viewer for robot models and scenes. Built on top of [Three.js](https://threejs.org/), it provides an intuitive interface for visualizing, editing, and simulating robots directly in the browser without any installation required. This tool helps you visualize and analyze robot structures, joints, and physical properties.

For part isolation, marker sizing, and recent-folder recovery instructions in Chinese, see the [中文操作说明](docs/usage.zh-CN.md).

**Upstream Live Demo** (This is the original project's deployment, not a deployment of this repository. All processing happens in your browser - your models never leave your device):

[![Try it now](https://img.shields.io/badge/🌐_Try_it_now-viewer.robotsfan.com-brightgreen?style=for-the-badge)](http://viewer.robotsfan.com/)

## Key Features

- **Format Support**:
  - **URDF**: Unified Robot Description Format
  - **Xacro**: ROS Xacro format with macro expansion and conditional logic support
  - **MJCF**: Mujoco XML format
  - **USD**: Universal Scene Description (partial support)
- **Robot Types**: Serial robot structures (parallel robots not currently supported)
- **Visualization Tools**: Visual/collision geometry, inertia tensors, center of mass, coordinate frames, joint axes, shadows, ground grid visibility, coordinate system orientation; synchronized marker sizing from 10% to 100%, defaulting to 50%
- **Interactive Controls**: Drag joints in real-time, adjust model poses, and isolate a part with Ctrl + click while keeping its inspection information locked
- **Animation Editor (Experimental)**: Multi-clip dope sheet and Bézier graph editor with auto-key, multi-selection, undo/redo, play/record ranges, event and media tracks, pose snapshots, audio-reactive keys, live-input recording, autosave, and portable `.robotanim.json` projects
- **Measurement Tools**: Measure distances between joints and links with 3D visualization, display X/Y/Z axis projections and total distance, support ground height measurement
- **Code Editor**: Built-in CodeMirror editor with syntax highlighting and live preview
- **Physics Simulation**: Integrated MuJoCo engine for dynamics simulation (MJCF models)
- **Scene Management**: File tree and scene graph visualization with hierarchical structure, last-folder and last-file recovery, and a collapsible recent-folder bar

## Getting Started

This project uses **pnpm**, but you can also use **npm** or **yarn**.

Clone the repository and install dependencies:

```bash
git clone https://github.com/XenseRobotics-AI/xense-robot-viewer.git
cd xense-robot-viewer
pnpm install
```

Start the development server:

```bash
pnpm run dev
```

Build for production:

```bash
pnpm run build
```

Output will be in the `dist/` directory.

Run regression tests:

```bash
pnpm test
```

Tests cover model inspection, asset paths, pose presets, render scheduling, isolated selection, marker sizing, and recent-workspace recovery and storage.

## Pose Shortcuts

The separate shortcut bar beside the existing display controls provides **Zero pose** and **Initial pose** buttons. On narrower windows it moves below the original bar. The selected mode is remembered for the next model load.

- **Zero pose** sets movable joints to zero, including joints whose motion limits exclude zero.
- **Initial pose** automatically reads the current workcell's `config/start_pose.robotanim.json` from the loaded asset directory and applies the active clip at its playback start. There is no need to import JSON through the animation editor. Joints omitted by the configuration retain their model-load values.

Load the complete asset directory. Its last successfully viewed file opens first when a valid recovery record exists. Without one, `forward-01-flexiv-rizon4s-taccap.urdf` is preferred when present; otherwise the original model-selection fallback applies. You can select any workcell's URDF/Xacro/MJCF file afterward. Configurations are resolved relative to that file, with the nearest parent directory taking precedence. Named variants such as `*-taccap.urdf` use `config/start_pose.taccap.robotanim.json` when present. Robot names and configured joints must match the loaded model. If the configuration is missing or invalid, **Initial pose** is disabled with an explanation on hover; **Zero pose** remains available. USD and standalone meshes do not expose pose shortcuts.

Switching poses pauses animation recording/playback and exits an active MuJoCo simulation so the displayed robot and joint controls stay synchronized. Pose shortcuts do not replace the animation project or add keyframes. Manual joint edits clear the active preset highlight. Future shortcuts can be added to `#viewer-actions-bar` independently of the original top display bar.

The company favicon is stored at `public/branding/logo.jpg`.

## Recent Folders and Files

The file panel remembers the last folder and the last successfully viewed file in each folder. Its recent-folder bar is collapsed by default, keeping the folder name and **Open last folder** button visible. Expand it for the last file's relative path, **Choose folder**, **Clear history**, and the startup-restore setting. When read permission is already granted, startup restores the last file automatically. Otherwise, the button requests read access from a user gesture. The remembered exact relative path takes priority over the default `forward-01-flexiv-rizon4s-taccap.urdf`; missing files fall back to an available default with a notice, and failed loads do not replace a successful selection.

Recovery records live in the browser's **IndexedDB → `xense-robot-viewer-recent-workspaces` → `records`** database, scoped to the site's origin and browser profile. At most ten folders are retained, along with their directory handles, last file's relative path, selection timestamps, and the startup preference. Model contents and full operation logs are not stored, and nothing is written to the repository or uploaded. Clearing history removes saved recovery records; it does not delete local files or revoke browser permissions. Private sessions and clearing browser site data can remove these records.

Folder identity uses `FileSystemHandle.isSameEntry`, so different directories with the same name do not share a file selection. Exact relative paths also distinguish duplicate filenames. Slow loads are prevented from replacing newer selections, and cleared history propagates between tabs without stale writes recreating it. Separate browser profiles have separate records. People sharing one browser profile share its history; disable startup restore or clear history before switching people. There is no application account system that could distinguish those users.

Direct reopening requires the File System Access API in a secure context, such as a supported Chromium browser on HTTPS or localhost. Other browsers keep the file-input workflow and ask the user to select the folder again; legacy folder selections are matched only by a fingerprint of their file paths, sizes, and modification times. Browser APIs expose the folder name and internal relative paths, not the full local filesystem path such as `~/src/xense-robot-viewer`. The panel labels and tooltip make that distinction explicit. Directory enumeration skips `.git`, `.aws`, `.codex`, `.agents`, `node_modules`, `.venv`, `venv`, `__pycache__`, and `dist`.

## Model Inspection

Ctrl + click a part in the 3D viewport to isolate that link and lock the physical-properties, mesh-statistics, and hover information to it. The status banner shows the isolated part and an exit button. Ctrl + click empty viewport space to restore the complete model; ordinary hovering and clicking empty space keep isolation active. Loading another model or starting physics simulation exits isolation.

The **Marker size** slider adjusts coordinate axes, joint arrows (including their rotation indicators), and center-of-mass markers together. It defaults to 50%, ranges from 10% to 100% of the previous marker dimensions, and updates existing and newly created helpers. Collision geometry and inertia boxes retain their physical dimensions.

The independent shortcut bar adds **Physical properties**, **View source**, **Mesh statistics**, and **Model health report**. The original display toolbar stays intact. Labels follow the viewer language and the floating panel supports dragging and resizing.

- **Physical properties**: select the whole URDF or a link, or click a link in the model/structure tree. Shows declared mass, center of mass, inertial-frame RPY, and the full symmetric inertia tensor. Whole-model COM and inertia update with the current joint pose, use root-link axes, and include rotation and the parallel-axis theorem. Missing values are reported; known-mass subtotals, COM and inertia are explicitly labeled as partial and are not presented as complete-model values.
- **View source**: load the asset directory with its `asset.json`, matching `assembly*.json`, or `<filename>.source.json`. Shows upstream repository and revision/version, the current file SHA-256, and checksum status. File records can associate a renamed copy by matching SHA-256. Assembly instances resolve component manifests and check their `inputs` hashes against component entrypoints. GNU/BSD SHA-256 checksum lists and `<filename>.sha256` sidecars are also supported. An assembly's upstream `source.sha256` is displayed separately from the generated URDF's checksum. Without metadata, upstream identity and version remain unknown.
- **Mesh statistics**: supports whole URDFs, individual links, and standalone STL/OBJ/DAE meshes. URDF statistics separate visual and collision geometry, count repeated instances, exclude viewer helpers, and update while meshes load. Each link shows only its own geometry; links without loaded visual or collision geometry show zero with an explanation. Shows triangles, vertex buffer entries, and mesh instances. File size is displayed in decimal MB (1 MB = 1,000,000 bytes), with up to three fractional digits; URDF file size excludes mesh assets and appears only for the whole model. Counts are independent of visibility; vertices are not welded. STL has no intrinsic length unit.
- **Model health report**: checks missing/invalid inertial data, principal moments and inertia inequalities, link/joint tree structure, joint axes and limits, mimic references, resource paths and mesh scales. Source checksum mismatches also appear in the report. Issues identify the affected link, joint or file; link issues can open its physical properties. Export the report as JSON or run the checks again after a pose change.

Inspection runs locally in the browser and does not upload models or query upstream repositories. SHA-256 requires HTTPS or localhost. Source manifests declare provenance; matching hashes establish file identity, not independent trust in a manifest. The health report does not replace dynamics simulation, collision testing, or hardware validation. URDF and expanded Xacro are supported for physics and health checks; standalone meshes provide statistics and provenance.

A source sidecar can record an imported file without changing its URDF:

```json
{
  "sha256": "<current file SHA-256>",
  "source": {
    "repository": "https://github.com/organization/robot-description",
    "revision": "<upstream commit or tag>",
    "path": "urdf/robot.urdf",
    "snapshot": "local_working_tree"
  }
}
```

Save this beside `robot.urdf` as `robot.urdf.source.json` and load both files (or their parent directory).

## Contributing

We welcome contributions from the community! Whether you're fixing bugs, adding features, or improving documentation, your help is appreciated.

- **Bug Reports**: Open an [issue](https://github.com/XenseRobotics-AI/xense-robot-viewer/issues) with details
- **Feature Requests**: Open an [issue](https://github.com/XenseRobotics-AI/xense-robot-viewer/issues) to discuss ideas
- **Pull Requests**: Submit PRs with clear descriptions and tests

## Upstream and Contributors

This independent repository originates from [fan-ziqi/robot_viewer](https://github.com/fan-ziqi/robot_viewer), imported at commit `706f8133dc3979cbe6665de607f8e04b1bdc03b6`. The original commit history, author information, and version tags are preserved. This README was adapted for XenseRobotics-AI during migration.

Thanks to the original contributors: [fan-ziqi (Ziqi Fan)](https://github.com/fan-ziqi), [Atticli](https://github.com/Atticlmr), [Jelatine](https://github.com/Jelatine), [LueApp](https://github.com/LueApp), [RobJMal](https://github.com/RobJMal), and [Shaochang TAN](https://github.com/petertheprocess).

To fetch future upstream changes from a fresh clone:

```bash
git remote add upstream https://github.com/fan-ziqi/robot_viewer.git
git fetch upstream --tags
```

Review and merge upstream changes into a development branch as needed.

## License

This project is licensed under the [Apache License 2.0](LICENSE).

## Acknowledgements

Robot Viewer builds upon the excellent work of the open-source robotics community. This project integrates several powerful open-source projects:

- **[urdf-loader](https://github.com/gkjohnson/urdf-loaders)** - Robust URDF loading for Three.js
- **[xacro-parser](https://github.com/gkjohnson/xacro-parser)** - ROS Xacro file format parser for Javascript
- **[mujoco_wasm](https://github.com/zalo/mujoco_wasm)** - MuJoCo physics engine compiled to WebAssembly
- **[usd-viewer](https://github.com/needle-tools/usd-viewer)** - OpenUSD viewer with rich USDStage support
- **[mechaverse](https://github.com/jurmy24/mechaverse)** - Universal 3D viewer for robot models, providing valuable design inspiration

Special thanks to all the maintainers and contributors of these projects for their foundational work.

Parts of this project were developed with the assistance of [Cursor](https://cursor.sh).
