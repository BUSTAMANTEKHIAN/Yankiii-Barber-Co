'use strict';

const crypto = require('crypto');

function mayaBaseUrl() {
    const environment = String(process.env.MAYA_ENV || 'sandbox').toLowerCase();
    if (environment === 'sandbox') return 'https://pg-sandbox.paymaya.com';
    if (environment === 'production') return 'https://pg.maya.ph';
    throw new Error('MAYA_ENV must be sandbox or production.');
}

function mayaAuth(key) {
    if (!key) throw new Error('Maya API credentials are not configured.');
    return `Basic ${Buffer.from(`${key}:`).toString('base64')}`;
}

async function mayaRequest(endpoint, { method = 'GET', key, body } = {}) {
    const response = await fetch(`${mayaBaseUrl()}${endpoint}`, {
        method,
        headers: {
            Authorization: mayaAuth(key),
            Accept: 'application/json',
            ...(body ? { 'Content-Type': 'application/json' } : {})
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(15000)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error(`Maya API request failed (${response.status}).`);
        error.status = response.status;
        throw error;
    }
    return data;
}

function createCheckout({ booking, requestReferenceNumber }) {
    const siteUrl = (process.env.SITE_URL || '').replace(/\/$/, '');
    const withReference = (configured, state) => {
        const url = configured || `${siteUrl}/confirmation.html?payment=${state}`;
        return url.includes('{reference}') ? url.replace('{reference}', encodeURIComponent(booking.booking_reference))
            : `${url}${url.includes('?') ? '&' : '?'}ref=${encodeURIComponent(booking.booking_reference)}`;
    };
    const success = withReference(process.env.MAYA_SUCCESS_URL, 'success');
    const failure = withReference(process.env.MAYA_FAILURE_URL, 'failure');
    const cancel = withReference(process.env.MAYA_CANCEL_URL, 'cancelled');
    const webhookUrl = process.env.MAYA_WEBHOOK_URL;
    if (!siteUrl && (!process.env.MAYA_SUCCESS_URL || !process.env.MAYA_FAILURE_URL || !process.env.MAYA_CANCEL_URL)) {
        throw new Error('Set SITE_URL or all Maya result URLs before enabling online payments.');
    }
    if (!webhookUrl || !/^https:\/\//i.test(webhookUrl)) throw new Error('MAYA_WEBHOOK_URL must be a public HTTPS URL.');
    return mayaRequest('/checkout/v1/checkouts', {
        method: 'POST',
        key: process.env.MAYA_PUBLIC_KEY,
        body: {
            totalAmount: { value: Number(booking.total_price).toFixed(2), currency: 'PHP' },
            redirectUrl: { success, failure, cancel },
            requestReferenceNumber
        }
    });
}

function newPaymentReference() { return crypto.randomUUID(); }

module.exports = { mayaRequest, createCheckout, newPaymentReference, mayaBaseUrl };
