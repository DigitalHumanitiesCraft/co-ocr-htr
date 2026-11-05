/**
 * Turn a IIIF label into display text. Presentation 3 labels are language maps
 * ({ "en": ["Title"], "none": ["Titel"] }), Presentation 2 labels are strings or
 * lists of { "@value": ... }. Rendering a map directly produced "[object Object]".
 * @param {*} label - Label as found in the manifest or canvas
 * @param {string} fallback - Text when no label value is present
 * @returns {string}
 */
export function iiifLabel(label, fallback = '') {
    if (typeof label === 'string') return label || fallback;
    if (Array.isArray(label)) {
        const first = label.find(v => v !== null && v !== undefined);
        return iiifLabel(typeof first === 'object' ? first['@value'] : first, fallback);
    }
    if (label && typeof label === 'object') {
        if ('@value' in label) return iiifLabel(label['@value'], fallback);
        const lang = typeof document !== 'undefined' ? document.documentElement.lang : '';
        const values = label[lang] || label.en || label.none || Object.values(label)[0];
        return iiifLabel(values, fallback);
    }
    return fallback;
}
