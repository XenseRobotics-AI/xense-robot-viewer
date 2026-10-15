export const DEFAULT_HELPER_SCALE = 0.5;

export function normalizeHelperScale(value) {
    return Number.isFinite(value) ? Math.max(0.1, Math.min(1, value)) : DEFAULT_HELPER_SCALE;
}

// Scale geometry around its anchor; never scale the link or the COM position.
export function scaleDisplayHelper(object, value = DEFAULT_HELPER_SCALE) {
    object.userData.isDisplayHelper = true;
    object.scale.setScalar(normalizeHelperScale(value));
    return object;
}
