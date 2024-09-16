/**
 * Helper function to use the crypto.randomUUID() as it will fail in none secure hosts (e.g. localhost)
 * @return {`${string}-${string}-${string}-${string}-${string}`|*}
 */
export function randomUUID() {
    if (!('randomUUID' in globalThis.crypto)) {
        // https://stackoverflow.com/a/2117523/2800218
        return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c) =>
            (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16),
        );
    }
    return globalThis.crypto.randomUUID();
}
