import { i18n } from '../utils/i18n.js';

export class PosePresetsUI {
    constructor(controller) {
        this.controller = controller;
        this.root = document.getElementById('viewer-actions-bar');
        this.topBar = document.getElementById('top-control-bar');
        this.root.addEventListener('click', (event) => {
            const button = event.target.closest('[data-pose-preset]');
            if (!button || button.disabled) return;
            if (controller.apply(button.dataset.posePreset)) {
                try { localStorage.setItem('xense-viewer-pose', controller.selected); } catch {}
            }
        });
        controller.subscribe(() => this.refresh());
        this.resizeObserver = new ResizeObserver(() => this.position());
        this.resizeObserver.observe(this.topBar);
        this.resizeObserver.observe(this.root);
        window.addEventListener('resize', () => this.position());
        this.refresh();
    }

    refresh() {
        for (const button of this.root.querySelectorAll('[data-pose-preset]')) {
            const mode = button.dataset.posePreset;
            button.disabled = !this.controller.model || (mode === 'initial' && !this.controller.initialPose);
            button.classList.toggle('active', this.controller.active === mode);
            button.setAttribute('aria-pressed', String(this.controller.active === mode));
            button.title = i18n.t(!this.controller.model ? 'poseNoModel'
                : mode === 'zero' ? 'poseZeroHint' : this.controller.initialStatus);
        }
        this.root.setAttribute('aria-label', i18n.t('viewerActions'));
        this.position();
    }

    position() {
        const bar = this.topBar.getBoundingClientRect();
        const parent = this.root.offsetParent.getBoundingClientRect();
        const width = this.root.offsetWidth;
        const fitsBeside = bar.right + 10 + width <= parent.right - 12;
        this.root.style.left = `${fitsBeside ? bar.right + 10 - parent.left
            : Math.max(12, Math.min(bar.right - parent.left - width, parent.width - width - 12))}px`;
        this.root.style.top = `${fitsBeside ? bar.top - parent.top : bar.bottom - parent.top + 10}px`;
    }
}
