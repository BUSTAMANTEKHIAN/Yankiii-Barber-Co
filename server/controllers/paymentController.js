'use strict';

const pool = require('../config/db');
const { mayaRequest, createCheckout, newPaymentReference } = require('../services/mayaCheckout');

const SANDBOX_IPS = new Set(['13.229.160.234', '3.1.199.75']);
const PRODUCTION_IPS = new Set(['18.138.50.235', '3.1.207.200']);

function clientIp(req) {
    return String(req.ip || req.socket?.remoteAddress || '').replace(/^::ffff:/, '');
}

function mayaWebhookIpAllowed(req) {
    const allowed = String(process.env.MAYA_ENV || 'sandbox').toLowerCase() === 'production' ? PRODUCTION_IPS : SANDBOX_IPS;
    return allowed.has(clientIp(req));
}

function toCents(value) {
    const amount = Number(value);
    return Number.isFinite(amount) ? Math.round(amount * 100) : NaN;
}

async function createCheckoutForBooking(bookingId, userId) {
    const [rows] = await pool.query(`
        SELECT b.id, b.user_id, b.booking_reference, b.customer_name, b.customer_email, b.customer_phone,
               b.service_id, b.total_price, b.status, s.name AS service_name
        FROM bookings b JOIN services s ON s.id = b.service_id
        WHERE b.id = ? LIMIT 1`, [bookingId]);
    const booking = rows[0];
    if (!booking || Number(booking.user_id) !== Number(userId)) {
        const error = new Error('Booking not found.'); error.status = 404; throw error;
    }
    if (booking.status === 'cancelled') { const error = new Error('Cancelled bookings cannot be paid.'); error.status = 409; throw error; }

    const [payments] = await pool.query(`SELECT id, payment_status, checkout_url, maya_checkout_id, created_at
        FROM booking_payments WHERE booking_id = ? ORDER BY id DESC LIMIT 1`, [booking.id]);
    const [paidRows] = await pool.query("SELECT id FROM booking_payments WHERE booking_id = ? AND payment_status IN ('paid','refunded') LIMIT 1", [booking.id]);
    if (paidRows.length) { const error = new Error('This booking is already paid or has a recorded refund.'); error.status = 409; throw error; }
    const latestPayment = payments[0];
    if (latestPayment?.payment_status === 'pending' && latestPayment.checkout_url &&
        Date.now() - new Date(latestPayment.created_at).getTime() < 65 * 60 * 1000) {
        return { checkoutUrl: latestPayment.checkout_url, paymentStatus: 'pending' };
    }

    const requestReferenceNumber = newPaymentReference();
    const [insert] = await pool.query(`INSERT INTO booking_payments
        (booking_id, payment_reference, amount, currency, payment_method, payment_status)
        VALUES (?, ?, ?, 'PHP', 'maya_checkout', 'pending')`, [booking.id, requestReferenceNumber, booking.total_price]);
    try {
        const checkout = await createCheckout({ booking, requestReferenceNumber });
        if (!checkout.checkoutId || !checkout.redirectUrl) throw new Error('Maya did not return a checkout session.');
        await pool.query(`UPDATE booking_payments SET maya_checkout_id = ?, checkout_url = ? WHERE id = ?`,
            [checkout.checkoutId, checkout.redirectUrl, insert.insertId]);
        return { checkoutUrl: checkout.redirectUrl, paymentStatus: 'pending' };
    } catch (error) {
        await pool.query(`UPDATE booking_payments SET payment_status = 'failed' WHERE id = ?`, [insert.insertId]);
        throw error;
    }
}

async function createCheckoutRoute(req, res) {
    try {
        const id = Number.parseInt(req.params.id, 10);
        if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ success: false, message: 'Invalid booking.' });
        const result = await createCheckoutForBooking(id, req.user.id);
        return res.json({ success: true, data: result });
    } catch (error) {
        return res.status(error.status || 502).json({ success: false, message: error.status ? error.message : 'Unable to start Maya Checkout. Your appointment remains reserved; please try again.' });
    }
}

async function getPaymentStatus(req, res) {
    try {
        let [rows] = await pool.query(`
            SELECT b.id AS booking_id, b.booking_reference, b.user_id, b.total_price,
                   p.payment_status, p.payment_method, p.amount, p.currency, p.provider_transaction_reference,
                   p.paid_at, p.created_at AS payment_created_at
            FROM bookings b LEFT JOIN booking_payments p ON p.booking_id = b.id
            WHERE LOWER(b.booking_reference) = LOWER(?) ORDER BY p.id DESC LIMIT 1`, [req.params.reference]);
        const payment = rows[0];
        if (!payment || Number(payment.user_id) !== Number(req.user.id)) return res.status(404).json({ success: false, message: 'Booking not found.' });
        if (payment.payment_status === 'pending') {
            const [pendingRows] = await pool.query(`SELECT p.*, b.total_price AS booking_amount FROM booking_payments p
                JOIN bookings b ON b.id = p.booking_id WHERE b.id = ? ORDER BY p.id DESC LIMIT 1`, [payment.booking_id]);
            if (pendingRows[0]?.maya_checkout_id) await reconcilePayment(pendingRows[0]);
            [rows] = await pool.query(`
                SELECT b.id AS booking_id, b.booking_reference, b.user_id, b.total_price,
                       p.payment_status, p.payment_method, p.amount, p.currency, p.provider_transaction_reference, p.paid_at
                FROM bookings b LEFT JOIN booking_payments p ON p.booking_id = b.id
                WHERE b.id = ? ORDER BY p.id DESC LIMIT 1`, [payment.booking_id]);
        }
        const current = rows[0];
        return res.json({ success: true, data: {
            booking_reference: current.booking_reference,
            payment_status: current.payment_status || 'pending',
            payment_method: current.payment_method || 'pay_at_shop',
            amount: current.amount || current.total_price,
            currency: current.currency || 'PHP',
            provider_transaction_reference: current.provider_transaction_reference,
            paid_at: current.paid_at
        } });
    } catch (_) { return res.status(500).json({ success: false, message: 'Unable to retrieve payment status.' }); }
}

function authoritativeAmount(payment) {
    return payment?.totalAmount || payment?.paymentDetails?.responses?.efs?.amount?.total || payment?.paymentDetails?.amount?.total || payment?.amount;
}

async function reconcilePayment(payment, expectedEventStatus) {
    const verified = await mayaRequest(`/payments/v1/payments/${encodeURIComponent(payment.maya_checkout_id)}`, { key: process.env.MAYA_SECRET_KEY });
    const amount = authoritativeAmount(verified);
    const status = String(verified.paymentStatus || verified.status || '').toUpperCase();
    if (expectedEventStatus && status !== expectedEventStatus && !(expectedEventStatus === 'PAYMENT_SUCCESS' && status === 'CAPTURED')) return;
    if (toCents(payment.amount) !== toCents(payment.booking_amount) ||
        String(verified.id || '') !== String(payment.maya_checkout_id) ||
        String(verified.requestReferenceNumber || '') !== String(payment.payment_reference) ||
        toCents(amount?.value ?? amount) !== toCents(payment.amount) ||
        String(amount?.currency || verified.currency || '').toUpperCase() !== 'PHP') return;
    const stateMap = { PAYMENT_SUCCESS: 'paid', CAPTURED: 'paid', PAYMENT_FAILED: 'failed', PAYMENT_EXPIRED: 'failed', PAYMENT_CANCELLED: 'cancelled', REFUNDED: 'refunded' };
    const paymentStatus = stateMap[status];
    if (!paymentStatus) return;
    const transaction = verified.paymentDetails?.responses?.efs?.paymentTransactionReferenceNo || verified.paymentDetails?.responses?.efs?.receipt?.transactionId || verified.receiptNumber || verified.transactionReferenceNumber || null;
    const method = verified.paymentScheme || verified.fundSource?.type || null;
    await pool.query(`UPDATE booking_payments SET payment_status = ?, payment_method = COALESCE(?, payment_method),
        provider_transaction_reference = COALESCE(?, provider_transaction_reference),
        paid_at = CASE WHEN ? = 'paid' THEN COALESCE(paid_at, CURRENT_TIMESTAMP) ELSE paid_at END
        WHERE id = ?`, [paymentStatus, method, transaction, paymentStatus, payment.id]);
}

async function processWebhookEvent(eventId) {
    const [events] = await pool.query('SELECT * FROM payment_webhook_events WHERE id = ? LIMIT 1', [eventId]);
    const event = events[0];
    if (!event || event.processed_at) return;
    const [payments] = await pool.query(`SELECT p.*, b.total_price AS booking_amount FROM booking_payments p
        JOIN bookings b ON b.id = p.booking_id
        WHERE p.payment_reference = ? AND p.maya_checkout_id = ? LIMIT 1`, [event.request_reference_number, event.provider_payment_id]);
    const payment = payments[0];
    if (!payment) return;
    if (toCents(payment.amount) !== toCents(payment.booking_amount)) return;
    await reconcilePayment(payment, event.event_status);
    await pool.query('UPDATE payment_webhook_events SET processed_at = CURRENT_TIMESTAMP WHERE id = ?', [eventId]);
}

async function mayaWebhook(req, res) {
    // Maya's current Checkout webhook guide calls for source-IP allowlisting.
    // The event is then independently checked against Maya's Secret-Key retrieval API.
    if (!mayaWebhookIpAllowed(req)) return res.status(403).json({ success: false });
    const event = req.body || {};
    const providerId = String(event.id || '');
    const eventStatus = String(event.paymentStatus || '').toUpperCase();
    const requestRef = String(event.requestReferenceNumber || '');
    const accepted = new Set(['PAYMENT_SUCCESS', 'PAYMENT_FAILED', 'PAYMENT_EXPIRED', 'PAYMENT_CANCELLED', 'AUTHORIZED']);
    if (!providerId || !requestRef || !accepted.has(eventStatus)) return res.status(400).json({ success: false });

    const eventKey = `${providerId}:${eventStatus}`;
    try {
        const [matchingPayment] = await pool.query(`SELECT id FROM booking_payments
            WHERE payment_reference = ? AND maya_checkout_id = ? LIMIT 1`, [requestRef, providerId]);
        if (!matchingPayment.length) return res.status(404).json({ success: false });
        await pool.query(`INSERT IGNORE INTO payment_webhook_events (event_key, provider_payment_id, event_status, request_reference_number)
            VALUES (?, ?, ?, ?)`, [eventKey, providerId, eventStatus, requestRef]);
        const [events] = await pool.query('SELECT id FROM payment_webhook_events WHERE event_key = ? LIMIT 1', [eventKey]);
        // Persist first and acknowledge promptly, as required by Maya's webhook guide.
        res.status(200).json({ success: true });
        if (events[0]) setImmediate(() => processWebhookEvent(events[0].id).catch(() => {}));
        return;
    } catch (_) {
        // Do not log raw webhook data or provider errors containing sensitive details.
        return res.status(500).json({ success: false });
    }
}

module.exports = { createCheckoutRoute, createCheckoutForBooking, getPaymentStatus, mayaWebhook, mayaWebhookIpAllowed };
