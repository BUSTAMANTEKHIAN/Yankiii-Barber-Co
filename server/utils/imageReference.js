'use strict';

function isSafeImageReference(value) {
    if (value == null || value === '') return true;
    if (typeof value !== 'string' || value.length > 255) return false;
    const image = value.trim();
    if (!image || /[\u0000-\u001f\\]/.test(image)) return false;

    if (/^https:\/\//i.test(image)) {
        try {
            const url = new URL(image);
            return Boolean(url.hostname) && !url.username && !url.password;
        } catch (_) {
            return false;
        }
    }

    return /^(?:\/)?assets\/(?:images|logo)\/[a-z0-9._-]+\.(?:avif|gif|jpe?g|png|webp|svg)$/i.test(image)
        && !image.includes('..');
}

module.exports = { isSafeImageReference };
