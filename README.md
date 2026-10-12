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

**Upstream Live Demo** (This is the original project's deployment, not a deployment of this repository. All processing happens in your browser - your models never leave your device):

[![Try it now](https://img.shields.io/badge/🌐_Try_it_now-viewer.robotsfan.com-brightgreen?style=for-the-badge)](http://viewer.robotsfan.com/)

## Key Features

- **Format Support**:
  - **URDF**: Unified Robot Description Format
  - **Xacro**: ROS Xacro format with macro expansion and conditional logic support
  - **MJCF**: Mujoco XML format
  - **USD**: Universal Scene Description (partial support)
- **Robot Types**: Serial robot structures (parallel robots not currently supported)
- **Visualization Tools**: Visual/collision geometry, inertia tensors, center of mass, coordinate frames, joint axes, shadows, ground grid visibility, coordinate system orientation
- **Interactive Controls**: Drag joints in real-time, adjust model poses
- **Animation Editor (Experimental)**: Multi-clip dope sheet and Bézier graph editor with auto-key, multi-selection, undo/redo, play/record ranges, event and media tracks, pose snapshots, audio-reactive keys, live-input recording, autosave, and portable `.robotanim.json` projects
- **Measurement Tools**: Measure distances between joints and links with 3D visualization, display X/Y/Z axis projections and total distance, support ground height measurement
- **Code Editor**: Built-in CodeMirror editor with syntax highlighting and live preview
- **Physics Simulation**: Integrated MuJoCo engine for dynamics simulation (MJCF models)
- **Scene Management**: File tree and scene graph visualization with hierarchical structure

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
