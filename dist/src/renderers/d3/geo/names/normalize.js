export function normalizeGeoName(input) {
    return input
        .trim()
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/\./g, '')
        .replace(/\s+/g, ' ')
        .replace(/^the\s+/, '');
}
//# sourceMappingURL=normalize.js.map