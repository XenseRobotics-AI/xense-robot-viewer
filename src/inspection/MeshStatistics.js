const emptyCounts = () => ({ triangles: 0, vertices: 0, meshes: 0 });
const addCounts = (target, counts) => {
    for (const key of ['triangles', 'vertices', 'meshes']) target[key] += counts[key];
};
function meshCounts(object) {
    const position = object.isMesh && object.geometry?.getAttribute('position');
    if (!position) return null;
    const instances = object.isInstancedMesh ? object.count : 1;
    return { triangles: Math.floor((object.geometry.index?.count ?? position.count) / 3) * instances,
        vertices: position.count * instances, meshes: instances };
}

/** Standalone mesh statistics are captured before viewer helpers are attached. */
export function inspectMesh(object) {
    const result = emptyCounts();
    object.traverse(child => {
        const counts = meshCounts(child);
        if (counts) addCounts(result, counts);
    });
    return result;
}

/** Count each link's own URDF visual/collision geometry, including hidden and shared-geometry instances. */
export function inspectRobotMeshes(model) {
    const result = { visual: emptyCounts(), collision: emptyCounts(), total: emptyCounts(), links: [] };
    const linkObjects = new Set([...model.links.values()].map(link => link.threeObject).filter(Boolean));
    for (const link of model.links.values()) {
        const entry = { name: link.name, visual: emptyCounts(), collision: emptyCounts(), total: emptyCounts() };
        const walk = (object, category = null) => {
            // Child links are visited separately; never include them in a parent's subtotal.
            if (object !== link.threeObject && (linkObjects.has(object) || object.isURDFLink)) return;
            if (object.isURDFCollider || object.type === 'URDFCollider') category = 'collision';
            else if (object.isURDFVisual || object.type === 'URDFVisual') category = 'visual';
            const counts = category && meshCounts(object);
            if (counts) addCounts(entry[category], counts);
            for (const child of object.children) walk(child, category);
        };
        if (link.threeObject) walk(link.threeObject);
        addCounts(entry.total, entry.visual);
        addCounts(entry.total, entry.collision);
        for (const key of ['visual', 'collision', 'total']) addCounts(result[key], entry[key]);
        result.links.push(entry);
    }
    return result;
}
