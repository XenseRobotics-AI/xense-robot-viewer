/** Hide renderables rather than link groups, so a nested link keeps its transforms. */
export class PartIsolationManager {
    constructor(sceneManager) {
        this.sceneManager = sceneManager;
        this.link = null;
        this.savedLayers = new Map();
        this.linkObjects = new Map();
    }

    findLink(object) {
        const model = this.sceneManager.currentModel;
        for (let current = object; current; current = current.parent) {
            const data = model?.links?.get(current.name);
            if (data && (data.threeObject === current || current.isURDFLink || current.type === 'URDFLink')) {
                return { name: data.name, linkData: data, threeObject: current };
            }
            if (current === model?.threeObject) break;
        }
        return null;
    }

    isSelectable(object) {
        return !this.link || this.findLink(object)?.name === this.link.name;
    }

    enter(link) {
        const model = this.sceneManager.currentModel;
        if (!link?.threeObject || !model?.links?.has(link.name)) return false;
        this.exit();
        this.sceneManager.highlightManager.clearHighlight();
        this.link = link;
        this.linkObjects = new Map([...model.links.values()]
            .filter(item => item.threeObject).map(item => [item.threeObject, item.name]));
        this.apply();
        this.sceneManager.highlightManager.highlightLink(link, model);
        // Selecting an already hovered link must still update the inspector.
        this.sceneManager.emit('isolationChanged', link);
        this.sceneManager.redraw();
        return true;
    }

    apply() {
        if (!this.link) return;
        const visit = (object, owner = null) => {
            owner = this.linkObjects.get(object) || owner;
            // Joint axes belong to the joint's child link, rather than its parent link.
            if (object.isURDFJoint || object.type === 'URDFJoint') {
                owner = this.sceneManager.currentModel.joints.get(object.name)?.child || owner;
            }
            if (object.isMesh || object.isLine || object.isPoints || object.isSprite) {
                if (!this.savedLayers.has(object)) this.savedLayers.set(object, object.layers.mask);
                object.layers.mask = owner === this.link.name ? this.savedLayers.get(object) : 0;
            }
            for (const child of object.children) visit(child, owner);
        };
        visit(this.sceneManager.currentModel.threeObject);
    }

    exit() {
        if (!this.link) return;
        this.link = null;
        for (const [object, mask] of this.savedLayers) object.layers.mask = mask;
        this.savedLayers.clear();
        this.linkObjects.clear();
        if (this.sceneManager.dragControls) this.sceneManager.dragControls.hovered = null;
        this.sceneManager.highlightManager.clearHighlight();
        this.sceneManager.emit('isolationChanged', null);
        this.sceneManager.redraw();
    }
}
